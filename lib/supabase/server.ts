import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/types';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Reads the session from cookies, so queries run as the signed-in user and RLS
 * applies exactly as it does from the browser. Async because `cookies()` is
 * async as of Next 15.
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
            // Server Components cannot write cookies. Ignoring this is safe
            // only because middleware refreshes the session on every request;
            // without that middleware, expired tokens are never renewed.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that bypasses RLS entirely. Server-only — importing this
 * into a Client Component would ship the secret key to the browser.
 *
 * This exists because `anime` is granted SELECT only to `authenticated` and has
 * no write policy: the AniList catalogue cache is deliberately writable solely
 * by the server. Use it for `upsertAnimeCache()` and nothing else — for
 * anything acting on behalf of a user, use `createClient()` above so RLS holds.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
