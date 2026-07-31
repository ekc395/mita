import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Home feed.
 *
 * Currently a placeholder that proves the session round-trips: middleware
 * guarantees a user exists by the time this renders, so anything here is
 * already scoped to them by RLS. The activity feed replaces this once
 * following exists.
 */
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

  return (
    <main className="py-8">
      <h1 className="text-2xl font-semibold">mita</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Signed in as <span className="font-medium">@{profile.username}</span>
      </p>

      <div className="mt-8 rounded-lg border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
        Your feed is empty.{' '}
        <Link href="/search" className="underline">
          Search
        </Link>{' '}
        for something you have watched to start ranking.
      </div>
    </main>
  );
}
