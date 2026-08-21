import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/types';

/**
 * Supabase client for Client Components. The anon key is safe to ship: every
 * table is gated by RLS, so it grants nothing the signed-in user cannot see.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
