import { describe, expect, it } from 'vitest';

import {
  answerComparison,
  remainingComparisons,
  startPlacement,
  type Choice,
  type PlacementState,
} from './place';

/**
 * Drive a full placement against an oracle answering as though the new title
 * belongs at 1-based slot `target`. The oracle defines "correct": that title
 * beats every entry at or below `target - 1` and loses to everything above.
 */
function placeWithOracle(bucketSize: number, target: number) {
  const boundary = target - 1;
  let state = startPlacement(bucketSize);
  let comparisons = 0;

  while (state.status === 'comparing') {
    const choice: Choice = state.probe >= boundary ? 'new' : 'existing';
    state = answerComparison(state, choice);
    comparisons += 1;
  }

  return { bucketIndex: state.bucketIndex, comparisons };
}

describe('startPlacement', () => {
  it('places into an empty bucket with no questions', () => {
    expect(startPlacement(0)).toEqual({ status: 'placed', bucketIndex: 1 });
  });

  it('asks a question when the bucket is non-empty', () => {
    expect(startPlacement(1).status).toBe('comparing');
  });

  it('rejects a nonsensical bucket size', () => {
    expect(() => startPlacement(-1)).toThrow(RangeError);
    expect(() => startPlacement(1.5)).toThrow(RangeError);
  });
});

describe('answerComparison', () => {
  it('puts the new title first when preferred over the only entry', () => {
    expect(answerComparison(startPlacement(1), 'new')).toEqual({
      status: 'placed',
      bucketIndex: 1,
    });
  });

  it('puts the new title last when the only entry is preferred', () => {
    expect(answerComparison(startPlacement(1), 'existing')).toEqual({
      status: 'placed',
      bucketIndex: 2,
    });
  });

  it('refuses to accept an answer once placement is complete', () => {
    expect(() => answerComparison(startPlacement(0), 'new')).toThrow(/already complete/);
  });
});

describe('binary search correctness', () => {
  // The load-bearing test: for every bucket size and every slot a title could
  // belong in, a consistent user must be led to exactly that slot.
  it('finds every slot for every bucket size up to 12', () => {
    for (let bucketSize = 0; bucketSize <= 12; bucketSize += 1) {
      for (let target = 1; target <= bucketSize + 1; target += 1) {
        const { bucketIndex } = placeWithOracle(bucketSize, target);
        expect(bucketIndex, `bucketSize=${bucketSize} target=${target}`).toBe(target);
      }
    }
  });

  it('never asks more than ceil(log2(n + 1)) questions', () => {
    for (let bucketSize = 0; bucketSize <= 64; bucketSize += 1) {
      const budget = Math.ceil(Math.log2(bucketSize + 1));
      for (let target = 1; target <= bucketSize + 1; target += 1) {
        const { comparisons } = placeWithOracle(bucketSize, target);
        expect(
          comparisons,
          `bucketSize=${bucketSize} target=${target}`,
        ).toBeLessThanOrEqual(budget);
      }
    }
  });

  it('stays within the range set_anime_rank accepts', () => {
    // 0001_init.sql:355 clamps p_bucket_index to [1, bucket_size + 1]. Anything
    // outside that would be silently corrected server-side, hiding a bug here.
    for (let bucketSize = 0; bucketSize <= 32; bucketSize += 1) {
      for (let target = 1; target <= bucketSize + 1; target += 1) {
        const { bucketIndex } = placeWithOracle(bucketSize, target);
        expect(bucketIndex).toBeGreaterThanOrEqual(1);
        expect(bucketIndex).toBeLessThanOrEqual(bucketSize + 1);
      }
    }
  });

  it('keeps the probe pointing at a real entry', () => {
    for (let bucketSize = 1; bucketSize <= 32; bucketSize += 1) {
      for (let target = 1; target <= bucketSize + 1; target += 1) {
        const boundary = target - 1;
        let state: PlacementState = startPlacement(bucketSize);

        while (state.status === 'comparing') {
          expect(state.probe).toBeGreaterThanOrEqual(0);
          expect(state.probe).toBeLessThan(bucketSize);
          state = answerComparison(state, state.probe >= boundary ? 'new' : 'existing');
        }
      }
    }
  });
});

describe('remainingComparisons', () => {
  it('is zero once placed', () => {
    expect(remainingComparisons(startPlacement(0))).toBe(0);
  });

  it('never increases as the search proceeds', () => {
    let state: PlacementState = startPlacement(50);
    let previous = remainingComparisons(state);

    while (state.status === 'comparing') {
      state = answerComparison(state, 'existing');
      const next = remainingComparisons(state);
      expect(next).toBeLessThanOrEqual(previous);
      previous = next;
    }
  });
});
