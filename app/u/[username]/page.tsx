import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FollowButton } from '@/components/FollowButton';
import { createClient } from '@/lib/supabase/server';
import { animeTitle } from '@/lib/types';

interface ProfileRow {
  anilist_id: number;
  status: string;
  score: number | null;
  anime: {
    title_english: string | null;
    title_romaji: string | null;
    cover_image_url: string | null;
  } | null;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // profiles_select applies can_view_user(), so a private profile reads as no
  // rows -- indistinguishable from nonexistent, which is the intent.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const isSelf = profile.id === user.id;

  const [{ data: entries, error: entriesError }, followers, following, existingFollow] =
    await Promise.all([
      supabase
        .from('user_anime')
        .select('anilist_id, status, score, anime(title_english, title_romaji, cover_image_url)')
        .eq('user_id', profile.id)
        .order('rank_position', { nullsFirst: false }),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profile.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profile.id),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
        .maybeSingle(),
    ]);

  // A swallowed error renders as "Nothing ranked yet" on a populated profile,
  // zeroed counts, or Follow for someone the viewer already follows.
  const loadError =
    entriesError ?? followers.error ?? following.error ?? existingFollow.error;
  if (loadError) throw new Error(`Could not load this profile: ${loadError.message}`);

  const rows = (entries ?? []) as ProfileRow[];
  const ranked = rows.filter((row) => row.score !== null);
  const want = rows.filter((row) => row.status === 'want');

  return (
    <main className="py-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Home
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {profile.display_name ?? `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className="mt-1 text-sm text-neutral-500">@{profile.username}</p>
          )}
          {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}

          <p className="mt-3 text-sm text-neutral-500">
            {ranked.length} ranked · {followers.count ?? 0} followers ·{' '}
            {following.count ?? 0} following
          </p>
        </div>

        {!isSelf && (
          <FollowButton
            viewerId={user.id}
            targetId={profile.id}
            initialFollowing={existingFollow.data !== null}
          />
        )}
      </div>

      {ranked.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          {isSelf ? 'You have not ranked anything yet.' : 'Nothing ranked yet.'}
        </p>
      )}

      {ranked.length > 0 && (
        <ol className="mt-8 space-y-1">
          {ranked.map((row, index) => (
            <li key={row.anilist_id}>
              <Link
                href={`/anime/${row.anilist_id}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <span className="w-5 shrink-0 text-sm text-neutral-400">{index + 1}</span>

                {row.anime?.cover_image_url ? (
                  <Image
                    src={row.anime.cover_image_url}
                    alt=""
                    width={40}
                    height={56}
                    className="h-14 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
                )}

                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {row.anime ? animeTitle(row.anime) : 'Unknown'}
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {row.score?.toFixed(1)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {want.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Want to watch
          </h2>
          <ul className="mt-3 space-y-1">
            {want.map((row) => (
              <li key={row.anilist_id}>
                <Link
                  href={`/anime/${row.anilist_id}`}
                  className="block truncate rounded-lg p-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  {row.anime ? animeTitle(row.anime) : 'Unknown'}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
