/**
 * Binary search placing a newly logged title in its sentiment bucket in
 * ~log2(n) head-to-head questions.
 *
 * A state machine, not a loop, because the comparisons are interactive. Works
 * purely in indices, which keeps it exhaustively testable.
 *
 * Callers pass the chosen bucket's titles best first (ascending
 * `rank_position`); the 1-based `bucketIndex` goes straight to `set_anime_rank`.
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

/** One more question, or the answer once the range holds a single slot. */
function settle(lo: number, hi: number): PlacementState {
  if (lo >= hi) {
    return { status: 'placed', bucketIndex: lo + 1 };
  }
  return { status: 'comparing', lo, hi, probe: Math.floor((lo + hi) / 2) };
}

/** An empty bucket needs no questions: the title is trivially first. */
export function startPlacement(bucketSize: number): PlacementState {
  if (!Number.isInteger(bucketSize) || bucketSize < 0) {
    throw new RangeError(`bucketSize must be a non-negative integer, got ${bucketSize}`);
  }
  return settle(0, bucketSize);
}

/**
 * Preferring the new title puts the answer at or above `probe`; preferring the
 * existing one rules out `probe` and everything above it.
 */
export function answerComparison(state: PlacementState, choice: Choice): PlacementState {
  if (state.status === 'placed') {
    throw new Error('answerComparison: placement is already complete');
  }

  return choice === 'new'
    ? settle(state.lo, state.probe)
    : settle(state.probe + 1, state.hi);
}

/** Upper bound on questions still to come, for a progress hint in the wizard. */
export function remainingComparisons(state: PlacementState): number {
  if (state.status === 'placed') return 0;
  return Math.ceil(Math.log2(state.hi - state.lo + 1));
}
