import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FeedItem, type FeedActivity } from '@/components/FeedItem';
import { toOne } from '@/lib/supabase/embed';
import { createClient } from '@/lib/supabase/server';

/** Home feed: activity from the viewer and the people they follow. */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have redirected already; this satisfies the type checker
  // and covers the gap if the matcher ever stops covering this route.
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.username) redirect('/onboarding');

  // activity's RLS predicate can_view_user() also admits every public profile,
  // so without an explicit user filter this renders a global feed.
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const authorIds = [user.id, ...(following ?? []).map((row) => row.following_id)];

  const { data: activity } = await supabase
    .from('activity')
    .select(
      'id, type, anilist_id, score, created_at, actor:profiles!activity_user_id_fkey(username, display_name), target:profiles!activity_target_user_fkey(username, display_name), anime(title_english, title_romaji, cover_image_url)',
    )
    .in('user_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(50);

  const items: FeedActivity[] = (activity ?? []).map((row) => ({
    ...row,
    actor: toOne(row.actor, 'activity.actor'),
    target: toOne(row.target, 'activity.target'),
    anime: toOne(row.anime, 'activity.anime'),
  }));

  return (
    <main className="py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">mita</h1>
        <div className="flex gap-4 text-sm text-neutral-500">
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          <Link href="/list" className="hover:underline">
            Your list
          </Link>
          <Link href="/recs" className="hover:underline">
            For you
          </Link>
          <Link href={`/u/${profile.username}`} className="hover:underline">
            @{profile.username}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
          {authorIds.length === 1 ? (
            <>
              Your feed is empty.{' '}
              <Link href="/search" className="underline">
                Search
              </Link>{' '}
              for something you have watched, or find people to follow.
            </>
          ) : (
            'Nobody you follow has done anything yet.'
          )}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-100 dark:divide-neutral-900">
          {items.map((item) => (
            <FeedItem key={item.id} activity={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
