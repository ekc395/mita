import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecommendButton, type Recipient } from './RecommendButton';

/**
 * The payload, plus the two error paths that are not just `error.message`: the
 * unique-constraint collision, and a transport failure that rejects.
 */

const { insert, from, createClient, refresh } = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const ben: Recipient = { id: 'person-1', username: 'ben', display_name: 'Ben' };
const ana: Recipient = { id: 'person-2', username: 'ana', display_name: null };

function renderButton(people: Recipient[] = [ben]) {
  return render(<RecommendButton viewerId="viewer-1" anilistId={101} people={people} />);
}

const sendButton = () => screen.getByRole('button');

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Both clicks before React commits the first -- what the busy ref guards. */
async function clickTwiceInOneTick(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  from.mockReturnValue({ insert });
  createClient.mockReturnValue({ from });
});

afterEach(cleanup);

describe('sending', () => {
  it('inserts the recommendation and refreshes', async () => {
    renderButton();

    await click(sendButton());

    expect(from).toHaveBeenCalledWith('recommendations');
    expect(insert).toHaveBeenCalledWith({
      from_user: 'viewer-1',
      to_user: 'person-1',
      anilist_id: 101,
      note: null,
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(/Sent to Ben/)).not.toBeNull();
  });

  it('trims the note before sending it', async () => {
    renderButton();

    // fireEvent.change, not a raw input event: React tracks its own value on the
    // node, so a hand-dispatched one never reaches state -- and then the
    // whitespace test below passes on an empty note, proving nothing.
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), {
      target: { value: '  worth it for the soundtrack  ' },
    });
    await click(sendButton());

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'worth it for the soundtrack' }),
    );
  });

  it('sends a whitespace-only note as null', async () => {
    renderButton();

    fireEvent.change(screen.getByPlaceholderText(/Add a note/), {
      target: { value: '   ' },
    });
    await click(sendButton());

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('falls back to the username when there is no display name', async () => {
    renderButton([ana]);

    await click(sendButton());

    expect(screen.queryByText(/Sent to @ana/)).not.toBeNull();
  });
});

describe('with nobody to recommend to', () => {
  it('explains instead of rendering an unusable picker', async () => {
    renderButton([]);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Follow someone/)).not.toBeNull();
  });
});

describe('clicks arriving before the next render', () => {
  it('writes once when double-clicked', async () => {
    renderButton();

    await clickTwiceInOneTick(sendButton());

    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe('when the write fails', () => {
  it('explains a duplicate rather than showing the raw constraint error', async () => {
    insert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    renderButton();

    await click(sendButton());

    expect(screen.queryByText(/already recommended this to Ben/)).not.toBeNull();
    expect(screen.queryByText(/duplicate key/)).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports any other error as-is', async () => {
    insert.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });
    renderButton();

    await click(sendButton());

    expect(screen.queryByText('permission denied')).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('surfaces a rejected request and stays clickable', async () => {
    insert.mockRejectedValueOnce(new Error('network down'));
    renderButton();

    await click(sendButton());

    expect(screen.queryByText(/Could not reach the server/)).not.toBeNull();

    insert.mockResolvedValueOnce({ error: null });
    await click(sendButton());

    expect(insert).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Sent to Ben/)).not.toBeNull();
  });
});
