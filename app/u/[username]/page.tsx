import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FollowButton } from '@/components/FollowButton';
import { RankedList } from '@/components/RankedList';
import { WantSection } from '@/components/WantSection';
import { createClient } from '@/lib/supabase/server';
import type { AnimeSummary } from '@/lib/types';

interface ProfileRow {
  anilist_id: number;
  status: string;
  score: number | null;
  anime: AnimeSummary | null;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // profiles_select applies can_view_user(), so a private profile is
  // indistinguishable from a nonexistent one -- the intent. It scopes from the
  // cookie, not from getUser().
  const [
    {
      data: { user },
    },
    { data: profile },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select('id, username, display_name, bio')
      .eq('username', username)
      .maybeSingle(),
  ]);

  if (!user) redirect('/login');
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
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Home
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {profile.display_name ?? `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
          )}
          {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}

          <p className="mt-3 text-sm text-muted-foreground">
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
        <p className="mt-8 text-sm text-muted-foreground">
          {isSelf ? 'You have not ranked anything yet.' : 'Nothing ranked yet.'}
        </p>
      )}

      <RankedList rows={ranked} className="mt-8" />

      <WantSection rows={want} />
    </main>
  );
}
