import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { toOne } from '@/lib/supabase/embed';
import { createClient } from '@/lib/supabase/server';
import { animeTitle } from '@/lib/types';

/** Under PostgREST's 1000-row cap, so any truncation is ours, not the server's. */
const LIKED_ROW_LIMIT = 500;

/** One followed user's liked ranking, with both embeds already normalised. */
interface LikedRow {
  anilist_id: number;
  score: number | null;
  anime: {
    title_english: string | null;
    title_romaji: string | null;
    cover_image_url: string | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
}

/** A title several people you follow liked, collapsed into one card. */
interface Suggestion {
  anilist_id: number;
  title: string;
  cover_image_url: string | null;
  averageScore: number;
  fans: string[];
}

function fanName(profile: LikedRow['profiles']): string {
  return profile?.display_name ?? (profile?.username ? `@${profile.username}` : 'Someone');
}

/** The fan list is the reason to trust a suggestion, so it leads the subtitle. */
function fansLine(fans: string[]): string {
  if (fans.length === 1) return `${fans[0]} liked this`;
  if (fans.length === 2) return `${fans[0]} and ${fans[1]} liked this`;
  return `${fans[0]}, ${fans[1]} and ${fans.length - 2} other${fans.length > 3 ? 's' : ''} liked this`;
}

/**
 * Titles the people you follow liked and you have not logged. Personalized from
 * overlap, not global popularity -- every entry is there because someone you
 * chose to follow ranked it highly.
 */
export default async function RecsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: following, error: followingError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followingError) {
    throw new Error(`Could not load who you follow: ${followingError.message}`);
  }

  const followingIds = (following ?? []).map((row) => row.following_id);

  // recommendations_select already limits rows to sender and recipient; the
  // to_user filter is what makes this the inbox rather than both directions.
  const { data: inboxRows, error: inboxError } = await supabase
    .from('recommendations')
    .select(
      'id, note, created_at, anilist_id, profiles!recommendations_from_user_fkey(username, display_name), anime(title_english, title_romaji, cover_image_url)',
    )
    .eq('to_user', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (inboxError) {
    throw new Error(`Could not load your recommendations: ${inboxError.message}`);
  }

  const inbox = (inboxRows ?? []).map((row) => ({
    ...row,
    profiles: toOne(row.profiles, 'recommendations.profiles'),
    anime: toOne(row.anime, 'recommendations.anime'),
  }));

  // PostgREST truncates an oversized response *silently*, so unbounded this
  // would under-count fans and mis-rank with no error. Score order also settles
  // the fan names, which would otherwise shuffle between renders.
  const liked = followingIds.length
    ? await supabase
        .from('user_anime')
        .select(
          'anilist_id, score, anime(title_english, title_romaji, cover_image_url), profiles(username, display_name)',
        )
        .in('user_id', followingIds)
        .eq('sentiment', 'liked')
        .order('score', { ascending: false })
        .limit(LIKED_ROW_LIMIT)
    : { data: [], error: null };

  if (liked.error) {
    throw new Error(`Could not load recommendations: ${liked.error.message}`);
  }

  const candidates = [...new Set((liked.data ?? []).map((row) => row.anilist_id))];

  // Candidates only, not the viewer's whole list: PostgREST has no anti-join,
  // and scoping keeps this read bounded too.
  const mine = candidates.length
    ? await supabase
        .from('user_anime')
        .select('anilist_id')
        .eq('user_id', user.id)
        .in('anilist_id', candidates)
    : { data: [], error: null };

  if (mine.error) {
    throw new Error(`Could not load your list: ${mine.error.message}`);
  }

  const alreadyLogged = new Set((mine.data ?? []).map((row) => row.anilist_id));

  // Collapse per title: agreement is the signal, and the fan list is what makes
  // a suggestion legible.
  const byTitle = new Map<number, { row: LikedRow; scores: number[]; fans: string[] }>();

  for (const raw of liked.data ?? []) {
    const row: LikedRow = {
      ...raw,
      anime: toOne(raw.anime, 'user_anime.anime'),
      profiles: toOne(raw.profiles, 'user_anime.profiles'),
    };

    if (!row.anime || alreadyLogged.has(row.anilist_id)) continue;

    const entry = byTitle.get(row.anilist_id) ?? { row, scores: [], fans: [] };
    if (row.score !== null) entry.scores.push(row.score);
    entry.fans.push(fanName(row.profiles));
    byTitle.set(row.anilist_id, entry);
  }

  const suggestions: Suggestion[] = [...byTitle.values()]
    .map(({ row, scores, fans }) => ({
      anilist_id: row.anilist_id,
      title: animeTitle(row.anime!),
      cover_image_url: row.anime!.cover_image_url,
      averageScore: scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0,
      fans,
    }))
    // Agreement first, then how highly they rated it.
    .sort((a, b) => b.fans.length - a.fans.length || b.averageScore - a.averageScore)
    .slice(0, 50);

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>

      {inbox.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Sent to you
          </h2>

          <div className="mt-3 space-y-1">
            {inbox.map((row) => (
              <Link
                key={row.id}
                href={`/anime/${row.anilist_id}`}
                className="block rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <p className="truncate text-sm font-medium">
                  {row.anime ? animeTitle(row.anime) : 'Untitled'}
                </p>
                <p className="truncate text-sm text-neutral-500">
                  {fanName(row.profiles)} recommended this
                  {row.note ? ` — "${row.note}"` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {followingIds.length === 0 && inbox.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Recommendations come from people you follow.{' '}
          <Link href="/search" className="underline">
            Find someone to follow.
          </Link>
        </p>
      )}

      {followingIds.length > 0 && candidates.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nobody you follow has liked anything yet. Recommendations appear once they start
          ranking.
        </p>
      )}

      {candidates.length > 0 && suggestions.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing new right now — you have already logged everything the people you follow
          liked.
        </p>
      )}

      <div className="mt-6 space-y-1">
        {suggestions.map((suggestion) => (
          <Link
            key={suggestion.anilist_id}
            href={`/anime/${suggestion.anilist_id}`}
            className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
          >
            {suggestion.cover_image_url ? (
              <Image
                src={suggestion.cover_image_url}
                alt=""
                width={48}
                height={64}
                className="h-16 w-12 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-16 w-12 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{suggestion.title}</p>
              <p className="truncate text-sm text-neutral-500">{fansLine(suggestion.fans)}</p>
            </div>

            <span className="self-center text-sm tabular-nums text-neutral-500">
              {suggestion.averageScore.toFixed(1)}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
