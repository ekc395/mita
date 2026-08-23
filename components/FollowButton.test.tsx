import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FollowButton } from './FollowButton';

/**
 * Covers the write path and the re-entrancy guard. The guard is the point:
 * `disabled={pending}` lands a paint after the handler, so without the ref two
 * clicks in one tick both reach the database.
 */

const { insert, del, eq, from, createClient, refresh } = vi.hoisted(() => ({
  insert: vi.fn(),
  del: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

/**
 * The delete path chains `.eq().eq()` and is awaited at the end, so `eq`
 * returns the chain and the chain is thenable. `insert` resolves directly.
 */
function stubClient(result: { error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  chain.eq = eq.mockReturnValue(chain);
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  del.mockReturnValue(chain);
  insert.mockResolvedValue(result);
  from.mockReturnValue({ insert, delete: del });
  createClient.mockReturnValue({ from });
}

function renderButton(initialFollowing = false) {
  return render(
    <FollowButton viewerId="viewer-1" targetId="target-2" initialFollowing={initialFollowing} />,
  );
}

const button = () => screen.getByRole('button');

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Both clicks dispatched before React commits the first — what the ref guards. */
async function clickTwiceInOneTick(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubClient({ error: null });
});

afterEach(cleanup);

describe('following', () => {
  it('inserts the follow and refreshes', async () => {
    renderButton(false);

    await click(button());

    expect(insert).toHaveBeenCalledWith({
      follower_id: 'viewer-1',
      following_id: 'target-2',
    });
    expect(refresh).toHaveBeenCalled();
    expect(button().textContent).toBe('Following');
  });

  it('deletes the follow when already following', async () => {
    renderButton(true);

    await click(button());

    expect(del).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(button().textContent).toBe('Follow');
  });
});

describe('clicks arriving before the next render', () => {
  it('writes once when double-clicked', async () => {
    // Without the guard the second click still sees `following === false` and
    // inserts again rather than deleting, so the insert count is what catches
    // it -- `del` staying unused holds either way and proves nothing alone.
    renderButton(false);

    await clickTwiceInOneTick(button());

    expect(insert).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
    expect(button().textContent).toBe('Following');
  });
});

describe('when the write fails', () => {
  it('surfaces the error and leaves the button clickable', async () => {
    stubClient({ error: { message: 'permission denied' } });
    renderButton(false);

    await click(button());

    expect(screen.queryByText('permission denied')).not.toBeNull();
    expect(button().textContent).toBe('Follow');
    expect(refresh).not.toHaveBeenCalled();

    stubClient({ error: null });
    await click(button());

    // Two inserts total: the rejected one and the retry that succeeded.
    expect(insert).toHaveBeenCalledTimes(2);
    expect(button().textContent).toBe('Following');
  });

  it('surfaces a rejected request', async () => {
    // supabase-js rejects on transport failure rather than returning `error`.
    insert.mockRejectedValueOnce(new Error('network down'));
    renderButton(false);

    await click(button());

    expect(screen.queryByText(/Could not reach the server/)).not.toBeNull();
    expect(button().textContent).toBe('Follow');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recovers when the client throws before any await', async () => {
    // A synchronous throw skips the awaited call entirely; only `finally`
    // re-enables the button.
    createClient.mockImplementationOnce(() => {
      throw new Error('missing env');
    });
    renderButton(false);

    await click(button());

    expect(screen.queryByText(/Could not reach the server/)).not.toBeNull();
    expect(insert).not.toHaveBeenCalled();

    await click(button());

    expect(insert).toHaveBeenCalledTimes(1);
    expect(button().textContent).toBe('Following');
  });
});
