import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RankingWizard, type BucketEntry } from './RankingWizard';

/**
 * Wiring and failure handling around lib/ranking/place; place.test.ts covers the
 * algorithm itself. The load-bearing cases are the ones this component got
 * wrong: a click landing before React re-renders, and a save that throws.
 */

const { rpc, createClient, push, refresh } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

// next/image needs the Next runtime for its loader; the tests only care that a
// poster's title is reachable, which lives in a sibling <p>.
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function entry(anilistId: number, title: string): BucketEntry {
  return { anilist_id: anilistId, title, cover_image_url: null };
}

/** An empty ranking for every sentiment, so tests fill in only what they use. */
function emptyBuckets() {
  return { liked: [] as BucketEntry[], ok: [] as BucketEntry[], disliked: [] as BucketEntry[] };
}

function renderWizard(buckets: Partial<ReturnType<typeof emptyBuckets>> = {}) {
  return render(
    <RankingWizard
      anilistId={101}
      title="New Title"
      coverImageUrl={null}
      buckets={{ ...emptyBuckets(), ...buckets }}
    />,
  );
}

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/**
 * Two clicks inside one act(), so both handlers run before React commits the
 * first. fireEvent flushes between calls, which defeats the point.
 */
async function clickTwiceInOneTick(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** The poster that is not the title being ranked. */
function opponentButton() {
  return screen
    .getAllByRole('button')
    .find((candidate) => !candidate.textContent?.includes('New Title'))!;
}

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ rpc });
  rpc.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe('saving a placement', () => {
  it('saves without asking anything when the bucket is empty', async () => {
    renderWizard();

    await click(button('I liked it'));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('set_anime_rank', {
      p_anilist_id: 101,
      p_sentiment: 'liked',
      p_bucket_index: 1,
    });
    expect(push).toHaveBeenCalledWith('/list');
    expect(refresh).toHaveBeenCalled();
  });

  it('saves the sentiment that was chosen, not the first one', async () => {
    renderWizard();

    await click(button("I didn't like it"));

    expect(rpc).toHaveBeenCalledWith(
      'set_anime_rank',
      expect.objectContaining({ p_sentiment: 'disliked' }),
    );
  });

  it('ranks above the only entry when the new title wins', async () => {
    renderWizard({ liked: [entry(1, 'Old Title')] });
    await click(button('I liked it'));

    await click(button(/New Title/));

    expect(rpc).toHaveBeenCalledWith(
      'set_anime_rank',
      expect.objectContaining({ p_bucket_index: 1 }),
    );
  });

  it('ranks below the only entry when the existing title wins', async () => {
    renderWizard({ liked: [entry(1, 'Old Title')] });
    await click(button('I liked it'));

    await click(button(/Old Title/));

    expect(rpc).toHaveBeenCalledWith(
      'set_anime_rank',
      expect.objectContaining({ p_bucket_index: 2 }),
    );
  });

  it('walks a multi-entry bucket down to the last slot', async () => {
    renderWizard({ liked: [entry(1, 'First'), entry(2, 'Second'), entry(3, 'Third')] });
    await click(button('I liked it'));

    // Losing every head-to-head puts the new title at the bottom.
    while (screen.queryByText('Which did you like more?')) {
      await click(opponentButton());
    }

    expect(rpc).toHaveBeenCalledWith(
      'set_anime_rank',
      expect.objectContaining({ p_bucket_index: 4 }),
    );
  });
});

describe('clicks arriving before the next render', () => {
  it('saves once when a sentiment is double-clicked', async () => {
    renderWizard();

    await clickTwiceInOneTick(button('I liked it'));

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('saves once when the deciding comparison is double-clicked', async () => {
    renderWizard({ liked: [entry(1, 'Old Title')] });
    await click(button('I liked it'));

    await clickTwiceInOneTick(button(/New Title/));

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('advances one question when a mid-search comparison is double-clicked', async () => {
    renderWizard({
      liked: [entry(1, 'First'), entry(2, 'Second'), entry(3, 'Third'), entry(4, 'Fourth')],
    });
    await click(button('I liked it'));
    const firstOpponent = opponentButton();
    const firstOpponentTitle = firstOpponent.textContent;

    await clickTwiceInOneTick(firstOpponent);

    // Still comparing, and against a different entry than before: two clicks
    // moved the search exactly one step, and neither was silently swallowed.
    expect(screen.queryByText('Which did you like more?')).not.toBeNull();
    expect(opponentButton().textContent).not.toBe(firstOpponentTitle);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('when the save fails', () => {
  it('surfaces an error the server returned and allows a retry', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'permission denied' } });
    renderWizard();

    await click(button('I liked it'));

    expect(screen.queryByText('Saving…')).toBeNull();
    expect(screen.queryByText('permission denied')).not.toBeNull();

    await click(button('I liked it'));

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith('/list');
  });

  it('surfaces a rejected request and allows a retry', async () => {
    rpc.mockRejectedValueOnce(new Error('network down'));
    renderWizard();

    await click(button('I liked it'));

    expect(screen.queryByText('Saving…')).toBeNull();
    expect(screen.queryByText(/Could not reach the server/)).not.toBeNull();

    await click(button('I liked it'));

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith('/list');
  });

  it('recovers when the client throws before any await', async () => {
    // The synchronous throw batches both setSubmitting calls, so the effect that
    // normally clears the busy ref never re-runs -- submit() has to release it.
    createClient.mockImplementationOnce(() => {
      throw new Error('missing env');
    });
    renderWizard();

    await click(button('I liked it'));

    expect(screen.queryByText('Saving…')).toBeNull();
    expect(screen.queryByText(/Could not reach the server/)).not.toBeNull();

    await click(button('I liked it'));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/list');
  });

  it('keeps the same question on screen when a comparison fails to save', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'permission denied' } });
    renderWizard({ liked: [entry(1, 'Old Title')] });
    await click(button('I liked it'));

    await click(button(/New Title/));

    expect(screen.queryByText('permission denied')).not.toBeNull();
    expect(screen.queryByText('Which did you like more?')).not.toBeNull();

    await click(button(/New Title/));

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith(
      'set_anime_rank',
      expect.objectContaining({ p_bucket_index: 1 }),
    );
  });
});
