import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

/**
 * The scope and the redirect status are the load-bearing assertions: the
 * supabase-js default revokes every device, and NextResponse.redirect's default
 * of 307 would replay the POST against /login.
 */

const { signOut, createClient } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));

/** Same-origin by default: browsers send Origin on every POST, including forms. */
function post(
  url = 'https://mita-black.vercel.app/auth/signout',
  { origin, cookie }: { origin?: string; cookie?: string } = {},
) {
  const headers = new Headers();
  headers.set('origin', origin ?? new URL(url).origin);
  if (cookie) headers.set('cookie', cookie);

  return POST(new NextRequest(url, { method: 'POST', headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
  createClient.mockResolvedValue({ auth: { signOut } });
});

describe('POST /auth/signout', () => {
  it('signs out of this browser only', async () => {
    await post();

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('redirects to /login with 303 so the browser follows with GET', async () => {
    const response = await post();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://mita-black.vercel.app/login');
  });

  it('redirects back to the origin it was called on', async () => {
    const response = await post('http://localhost:3000/auth/signout');

    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('clears the auth cookies itself when signOut reports an error', async () => {
    // signOut can return early without removing the session; see route.ts.
    signOut.mockResolvedValueOnce({ error: { message: 'session not found' } });

    const response = await post(undefined, {
      cookie: 'sb-abc-auth-token=xyz; sb-abc-auth-token.1=more; other=keep',
    });

    expect(response.status).toBe(303);

    // Next expresses a deletion as an empty value with an epoch expiry, not as
    // maxAge 0 -- maxAge is undefined here, so testing it would match anything.
    const cleared = response.cookies
      .getAll()
      .filter((c) => c.value === '')
      .map((c) => c.name);

    expect(cleared).toContain('sb-abc-auth-token');
    expect(cleared).toContain('sb-abc-auth-token.1');
    expect(cleared).not.toContain('other');
  });

  it('leaves cookies alone when signOut succeeds', async () => {
    const response = await post(undefined, { cookie: 'sb-abc-auth-token=xyz' });

    expect(response.cookies.getAll()).toHaveLength(0);
  });
});

describe('cross-site requests', () => {
  it('refuses a POST from another origin', async () => {
    // An auto-submitting form elsewhere would otherwise sign the visitor out.
    const response = await post(undefined, { origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });
});
