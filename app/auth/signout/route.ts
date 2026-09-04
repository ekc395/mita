import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Sign out. A Route Handler because clearing the session writes cookies, which
 * Server Components cannot, and because a client button importing the browser
 * Supabase client put ~67 kB of auth bundle on whatever page rendered it.
 *
 * scope 'local', not the supabase-js default 'global' which revokes every device.
 * POST only, so a link prefetch cannot sign the user out.
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  // Route handlers get no origin check, unlike Server Actions. A cross-site POST
  // sends no cookies under SameSite=Lax, but the reply's deletions still land.
  if (request.headers.get('origin') !== origin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  // 303 so the browser follows with GET; 307 would repeat the POST.
  const response = NextResponse.redirect(`${origin}/login`, { status: 303 });

  // signOut returns early *without* clearing the session when it cannot load one
  // -- expired access token, token endpoint briefly down. Redirecting alone would
  // look like a sign-out that middleware refreshes straight back.
  if (error) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name);
    }
  }

  return response;
}
