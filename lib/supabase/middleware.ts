import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/lib/types';

/**
 * Refreshes the Supabase session on every request.
 *
 * Server Components cannot write cookies, so `createClient()` in ./server.ts
 * silently swallows cookie writes. That is only safe because this runs first:
 * without it an expired access token is never renewed, and users get silently
 * signed out roughly an hour after logging in.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not put anything between createServerClient and getUser(). This call is
  // what actually performs the refresh, and code in between can cause sessions
  // to be dropped at random and be very hard to debug.
  await supabase.auth.getUser();

  return supabaseResponse;
}
