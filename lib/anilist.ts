import { gql, request } from 'graphql-request';

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Anime, AnimeInsert } from '@/lib/types';

/**
 * AniList catalogue access, plus the local cache that fronts it.
 *
 * Server-only. Not enforced by the `server-only` package (not a dependency),
 * but importing lib/supabase/server pulls in next/headers, which already fails
 * loudly inside a Client Component.
 *
 * Everything here writes through the service-role client, because `anime` is
 * granted SELECT only to `authenticated` and has no write policy: the cache is
 * deliberately fillable by the server alone. Caching is not just a speed
 * tactic -- user_anime has a foreign key to anime, so a title must be cached
 * before it can be ranked at all.
 */

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

/** Re-fetch a cached title once its metadata is a week old. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * AniList descriptions carry markup regardless of `asHtml`, so normalise once
 * on the way into the cache rather than making every consumer strip tags (or
 * reach for dangerouslySetInnerHTML) at render time.
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
 * Write titles into the local catalogue cache.
 *
 * Callers should await this before letting a user rank a title -- user_anime's
 * foreign key means an uncached title cannot be logged.
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
 * Search AniList by title, caching whatever comes back.
 *
 * Results are cached eagerly rather than at log time so that picking a title
 * from search results is immediately rankable, and so the detail page can be
 * served from Postgres without a second round trip.
 */
export async function searchAnime(query: string, perPage = 20): Promise<Anime[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const data = await request<{ Page: { media: AniListMedia[] } }>(
    ANILIST_ENDPOINT,
    SEARCH_QUERY,
    { search: trimmed, perPage },
  );

  return upsertAnimeCache(data.Page?.media ?? []);
}

/** Fetch one title straight from AniList, bypassing the cache. */
export async function fetchAnimeFromAniList(anilistId: number): Promise<AniListMedia | null> {
  const data = await request<{ Media: AniListMedia | null }>(
    ANILIST_ENDPOINT,
    MEDIA_QUERY,
    { id: anilistId },
  );

  return data.Media ?? null;
}

/**
 * Read a title, preferring the cache.
 *
 * AniList allows roughly 90 requests per minute, so the cache is what keeps a
 * busy detail page from exhausting the budget. Only a cache miss or metadata
 * older than STALE_AFTER_MS reaches the network -- and a stale row is still
 * returned if AniList is unreachable, since slightly dated metadata beats a
 * broken page.
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
