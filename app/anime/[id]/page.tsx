import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getAnime } from '@/lib/anilist';
import { toOne } from '@/lib/supabase/embed';
import { createClient } from '@/lib/supabase/server';
import { animeTitle } from '@/lib/types';

/** A followed user's score for this title. */
interface FriendRank {
  score: number | null;
  profiles: { username: string | null; display_name: string | null } | null;
}

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anilistId = Number(id);

  if (!Number.isInteger(anilistId)) notFound();

  const anime = await getAnime(anilistId);
  if (!anime) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // user_anime is readable for anyone can_view_user() admits, so this needs an
  // explicit user filter or it matches other people's rows too.
  const { data: entry } = await supabase
    .from('user_anime')
    .select('status, score')
    .eq('anilist_id', anilistId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = (following ?? []).map((row) => row.following_id);

  const { data: friendRows } = followingIds.length
    ? await supabase
        .from('user_anime')
        .select('score, profiles(username, display_name)')
        .eq('anilist_id', anilistId)
        .in('user_id', followingIds)
        .not('score', 'is', null)
        .order('score', { ascending: false })
    : { data: [] };

  // profiles is a to-one embed; see lib/supabase/embed.ts.
  const friends: FriendRank[] = (friendRows ?? []).map((row) => ({
    ...row,
    profiles: toOne(row.profiles, 'user_anime.profiles'),
  }));
  const friendAverage =
    friends.length > 0
      ? friends.reduce((sum, row) => sum + (row.score ?? 0), 0) / friends.length
      : null;

  return (
    <main className="py-8">
      <Link href="/search" className="text-sm text-neutral-500 hover:underline">
        ← Search
      </Link>

      <div className="mt-6 flex gap-4">
        {anime.cover_image_url && (
          <Image
            src={anime.cover_image_url}
            alt=""
            width={112}
            height={160}
            className="h-40 w-28 shrink-0 rounded object-cover"
          />
        )}

        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{animeTitle(anime)}</h1>
          {anime.title_romaji && anime.title_english && (
            <p className="mt-1 text-sm text-neutral-500">{anime.title_romaji}</p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            {[anime.format, anime.season_year, anime.episodes && `${anime.episodes} eps`]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {entry?.score != null ? (
            <p className="mt-3 text-sm font-medium">Your score: {entry.score}</p>
          ) : entry ? (
            <p className="mt-3 text-sm text-neutral-500">On your list: {entry.status}</p>
          ) : null}

          <Link
            href={`/log/${anilistId}`}
            className="mt-4 inline-block rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {entry?.score != null ? 'Re-rank' : 'I watched this'}
          </Link>
        </div>
      </div>

      {friends.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Friends who ranked this
            {friendAverage !== null && (
              <span className="ml-2 font-normal normal-case tracking-normal">
                · avg {friendAverage.toFixed(1)}
              </span>
            )}
          </h2>

          <ul className="mt-3 space-y-1">
            {friends.map((friend, index) => (
              <li
                key={friend.profiles?.username ?? index}
                className="flex items-center justify-between text-sm"
              >
                {friend.profiles?.username ? (
                  <Link
                    href={`/u/${friend.profiles.username}`}
                    className="font-medium hover:underline"
                  >
                    {friend.profiles.display_name ?? `@${friend.profiles.username}`}
                  </Link>
                ) : (
                  <span className="font-medium">Someone</span>
                )}
                <span className="font-semibold tabular-nums">
                  {friend.score?.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anime.genres.length > 0 && (
        <p className="mt-6 text-sm text-neutral-500">{anime.genres.join(', ')}</p>
      )}

      {anime.description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">
          {anime.description}
        </p>
      )}
    </main>
  );
}
