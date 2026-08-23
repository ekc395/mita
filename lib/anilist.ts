import { gql, request, type Variables } from 'graphql-request';

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Anime, AnimeInsert } from '@/lib/types';

/**
 * AniList catalogue access, plus the local cache that fronts it.
 *
 * Server-only: importing lib/supabase/server pulls in next/headers, which fails
 * loudly inside a Client Component.
 *
 * Writes go through the service-role client because `anime` has no write policy.
 * Caching is not just a speed tactic -- user_anime has a foreign key to anime,
 * so a title must be cached before it can be ranked at all.
 */

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

/** Re-fetch a cached title once its metadata is a week old. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** AniList sits on the render path; a hung connection must not hold a page open. */
const REQUEST_TIMEOUT_MS = 8_000;

/** Fields shared by search and single-title lookups. */
const MEDIA_FIELDS = gql`
  fragment MediaFields on Media {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      large
    }
    bannerImage
    format
    status
    season
    seasonYear
    episodes
    duration
    genres
    averageScore
    # Still contains <br> and the odd <i> even with asHtml: false; see
    # toPlainText below.
    description(asHtml: false)
  }
`;

const SEARCH_QUERY = gql`
  ${MEDIA_FIELDS}
  query SearchAnime($search: String!, $perPage: Int!) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        ...MediaFields
      }
    }
  }
`;

const MEDIA_QUERY = gql`
  ${MEDIA_FIELDS}
  query GetAnime($id: Int!) {
    Media(id: $id, type: ANIME) {
      ...MediaFields
    }
  }
`;

/** The subset of AniList's Media type we request above. */
export interface AniListMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  duration: number | null;
  genres: string[] | null;
  averageScore: number | null;
  description: string | null;
}

/** One AniList query, bounded by REQUEST_TIMEOUT_MS. */
function anilistRequest<T>(document: string, variables: Variables): Promise<T> {
  return request<T>({
    url: ANILIST_ENDPOINT,
    document,
    variables,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * AniList descriptions carry markup regardless of `asHtml`; normalise on the way
 * in so no consumer needs dangerouslySetInnerHTML.
 */
function toPlainText(description: string | null): string | null {
  if (!description) return null;

  return description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toAnimeRow(media: AniListMedia): AnimeInsert {
  return {
    anilist_id: media.id,
    title_romaji: media.title?.romaji ?? null,
    title_english: media.title?.english ?? null,
    title_native: media.title?.native ?? null,
    cover_image_url: media.coverImage?.large ?? null,
    banner_image_url: media.bannerImage,
    format: media.format,
    status: media.status,
    season: media.season,
    season_year: media.seasonYear,
    episodes: media.episodes,
    duration: media.duration,
    genres: media.genres ?? [],
    average_score: media.averageScore,
    description: toPlainText(media.description),
    synced_at: new Date().toISOString(),
  };
}

/**
 * Write titles into the local catalogue cache. Await it before letting a user
 * rank a title: user_anime's foreign key rejects an uncached one.
 */
export async function upsertAnimeCache(media: AniListMedia[]): Promise<Anime[]> {
  if (media.length === 0) return [];

  const { data, error } = await createServiceRoleClient()
    .from('anime')
    .upsert(media.map(toAnimeRow), { onConflict: 'anilist_id' })
    .select();

  if (error) {
    throw new Error(`Failed to cache anime: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Search AniList by title, caching eagerly rather than at log time so a result
 * is immediately rankable and the detail page needs no second round trip.
 *
 * Throws if AniList is unreachable: an arbitrary query has no cached answer, and
 * [] would render as "nothing found" -- a lie. Callers decide; see /search.
 */
export async function searchAnime(query: string, perPage = 20): Promise<Anime[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const data = await anilistRequest<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
    search: trimmed,
    perPage,
  });

  return upsertAnimeCache(data.Page?.media ?? []);
}

/** Fetch one title straight from AniList, bypassing the cache. */
export async function fetchAnimeFromAniList(anilistId: number): Promise<AniListMedia | null> {
  const data = await anilistRequest<{ Media: AniListMedia | null }>(MEDIA_QUERY, {
    id: anilistId,
  });

  return data.Media ?? null;
}

/**
 * Read a title, preferring the cache -- AniList allows only ~90 requests/minute.
 * Only a miss or a row older than STALE_AFTER_MS hits the network, and a stale
 * row is still returned if AniList is down: dated metadata beats a broken page.
 */
export async function getAnime(anilistId: number): Promise<Anime | null> {
  const { data: cached } = await createServiceRoleClient()
    .from('anime')
    .select()
    .eq('anilist_id', anilistId)
    .maybeSingle();

  const isFresh =
    cached && Date.now() - new Date(cached.synced_at).getTime() < STALE_AFTER_MS;

  if (isFresh) return cached;

  try {
    const media = await fetchAnimeFromAniList(anilistId);
    if (!media) return cached ?? null;

    const [row] = await upsertAnimeCache([media]);
    return row ?? cached ?? null;
  } catch {
    return cached ?? null;
  }
}
