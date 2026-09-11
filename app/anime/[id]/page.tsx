import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { subtitle } from '@/components/AnimeCard';
import { RecommendButton, type Recipient } from '@/components/RecommendButton';
import { getAnime } from '@/lib/anilist';
import { toOne } from '@/lib/supabase/embed';
import { createClient } from '@/lib/supabase/server';
import { animeTitle, profileName, type ProfileSummary } from '@/lib/types';
import { buttonClass } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';

/** A followed user's score for this title. */
interface FriendRank {
  score: number | null;
  profiles: ProfileSummary | null;
}

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anilistId = Number(id);

  if (!Number.isInteger(anilistId)) notFound();

  // getAnime may hit AniList on a stale cache; auth need not queue behind it.
  const supabase = await createClient();
  const [
    anime,
    {
      data: { user },
    },
  ] = await Promise.all([getAnime(anilistId), supabase.auth.getUser()]);

  if (!anime) notFound();
  if (!user) redirect('/login');

  // user_anime is readable for anyone can_view_user() admits, hence the user
  // filter. follows has two FKs into profiles, so the embed must name one.
  const [{ data: entry }, { data: following, error: followingError }] = await Promise.all([
    supabase
      .from('user_anime')
      .select('status, score')
      .eq('anilist_id', anilistId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id, username, display_name)')
      .eq('follower_id', user.id),
  ]);

  if (followingError) {
    throw new Error(`Could not load who you follow: ${followingError.message}`);
  }

  const followingIds = (following ?? []).map((row) => row.following_id);

  const recipients: Recipient[] = (following ?? [])
    .map((row) => toOne(row.profiles, 'follows.profiles'))
    .filter((person): person is Recipient => person !== null);

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
      <Link href="/search" className="text-sm text-muted-foreground hover:underline">
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
            <p className="mt-1 text-sm text-muted-foreground">{anime.title_romaji}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{subtitle(anime)}</p>

          {entry?.score != null ? (
            <p className="mt-3 text-sm font-medium">Your score: {entry.score}</p>
          ) : entry ? (
            <p className="mt-3 text-sm text-muted-foreground">On your list: {entry.status}</p>
          ) : null}

          <Link
            href={`/log/${anilistId}`}
            className={buttonClass({ className: 'mt-4 inline-block' })}
          >
            {entry?.score != null ? 'Re-rank' : 'I watched this'}
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <SectionHeading>Recommend</SectionHeading>
        <div className="mt-3">
          <RecommendButton viewerId={user.id} anilistId={anilistId} people={recipients} />
        </div>
      </section>

      {friends.length > 0 && (
        <section className="mt-8">
          <SectionHeading>
            Friends who ranked this
            {friendAverage !== null && (
              <span className="ml-2 font-normal normal-case tracking-normal">
                · avg {friendAverage.toFixed(1)}
              </span>
            )}
          </SectionHeading>

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
                    {profileName(friend.profiles)}
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
        <p className="mt-6 text-sm text-muted-foreground">{anime.genres.join(', ')}</p>
      )}

      {anime.description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">
          {anime.description}
        </p>
      )}
    </main>
  );
}
