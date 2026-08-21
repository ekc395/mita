'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Follow / unfollow toggle. viewerId is a prop because follows has no default
 * for follower_id and the rendering server component already knows it. RLS
 * still requires it to equal auth.uid(), so a forged id fails at the database.
 */
export function FollowButton({
  viewerId,
  targetId,
  initialFollowing,
}: {
  viewerId: string;
  targetId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = following
      ? await supabase
          .from('follows')
          .delete()
          .eq('follower_id', viewerId)
          .eq('following_id', targetId)
      : await supabase
          .from('follows')
          .insert({ follower_id: viewerId, following_id: targetId });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    setFollowing(!following);
    setPending(false);
    // Following changes what the viewer is allowed to see, so the counts and
    // anything can_view_user() gates have to come back from the server.
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={pending}
        className={
          following
            ? 'rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900'
            : 'rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-900'
        }
      >
        {following ? 'Following' : 'Follow'}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
