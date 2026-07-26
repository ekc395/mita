/**
 * Binary search that decides where a newly logged title lands inside its
 * sentiment bucket, by asking the user a short series of head-to-head
 * questions -- roughly log2(n) of them rather than n.
 *
 * Modelled as a state machine rather than a loop because the comparisons are
 * interactive: the caller renders a question, waits for a tap, and feeds the
 * answer back. Nothing here touches the network, the database, or even an
 * anime title -- it works purely in indices, which keeps it exhaustively
 * testable and keeps the UI free to render however it likes.
 *
 * The caller supplies the user's existing titles *in the chosen bucket only*,
 * ordered best first (ascending `rank_position`). The resulting `bucketIndex`
 * is 1-based and is passed straight to `set_anime_rank(_, _, p_bucket_index)`.
 */

/** Which title the user preferred in a head-to-head. */
export type Choice = 'new' | 'existing';

export type PlacementState =
  | {
      readonly status: 'comparing';
      /** Inclusive lower bound of the surviving 0-based insertion range. */
      readonly lo: number;
      /** Exclusive upper bound of the surviving 0-based insertion range. */
      readonly hi: number;
      /** 0-based index into the bucket of the title to show head-to-head. */
      readonly probe: number;
    }
  | {
      readonly status: 'placed';
      /** 1-based slot within the bucket, ready for `set_anime_rank`. */
      readonly bucketIndex: number;
    };

/**
 * Collapse a surviving range into the next state: either one more question, or
 * a final answer once the range holds a single slot.
 */
function settle(lo: number, hi: number): PlacementState {
  if (lo >= hi) {
    return { status: 'placed', bucketIndex: lo + 1 };
  }
  return { status: 'comparing', lo, hi, probe: Math.floor((lo + hi) / 2) };
}

/**
 * Begin placing a title into a bucket that currently holds `bucketSize` items.
 *
 * An empty bucket needs no questions at all: the title is trivially first.
 */
export function startPlacement(bucketSize: number): PlacementState {
  if (!Number.isInteger(bucketSize) || bucketSize < 0) {
    throw new RangeError(`bucketSize must be a non-negative integer, got ${bucketSize}`);
  }
  return settle(0, bucketSize);
}

/**
 * Fold one head-to-head answer into the search.
 *
 * Preferring the new title means it outranks everything from `probe` down, so
 * the answer lies at or above it; preferring the existing one rules out `probe`
 * and everything above it.
 */
export function answerComparison(state: PlacementState, choice: Choice): PlacementState {
  if (state.status === 'placed') {
    throw new Error('answerComparison: placement is already complete');
  }

  return choice === 'new'
    ? settle(state.lo, state.probe)
    : settle(state.probe + 1, state.hi);
}

/**
 * Upper bound on questions still to come, for a progress hint in the wizard.
 */
export function remainingComparisons(state: PlacementState): number {
  if (state.status === 'placed') return 0;
  return Math.ceil(Math.log2(state.hi - state.lo + 1));
}
