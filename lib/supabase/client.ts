import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/types';

/**
 * Supabase client for use in Client Components.
 *
 * Only ever reads the publishable (anon) key, which is safe to ship to the
 * browser: every table is gated by RLS, so this key grants nothing beyond what
 * the signed-in user is already allowed to see.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
