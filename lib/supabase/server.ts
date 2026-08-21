import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/types';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads the session from cookies, so RLS applies as it does from the browser.
 * Async because `cookies()` is async as of Next 15.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Annotated explicitly: the cookies option is a union with the
        // deprecated get/set/remove API, which defeats contextual inference.
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies; safe to ignore only
            // because middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that bypasses RLS. Server-only — importing it into a Client
 * Component would ship the secret key to the browser.
 *
 * Exists because `anime` has no write policy: the catalogue cache is writable by
 * the server alone. Use it for `upsertAnimeCache()` and nothing else.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
