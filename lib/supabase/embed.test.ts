import { describe, expect, it } from 'vitest';

import { toOne } from './embed';

/** The array branch is the point: it is what slipped through the old casts. */

const profile = { username: 'ethan', display_name: 'Ethan' };

describe('toOne', () => {
  it('passes an object through unchanged', () => {
    expect(toOne(profile, 'actor')).toBe(profile);
  });

  it('unwraps a one-element array', () => {
    expect(toOne([profile], 'actor')).toEqual(profile);
  });

  it('treats an empty array as no row', () => {
    expect(toOne([], 'actor')).toBeNull();
  });

  it('treats null and undefined as no row', () => {
    expect(toOne(null, 'actor')).toBeNull();
    expect(toOne(undefined, 'actor')).toBeNull();
  });

  it('throws when a to-one embed returns several rows', () => {
    expect(() => toOne([profile, profile], 'activity.actor')).toThrow(
      /activity\.actor: expected a to-one embed, got 2 rows/,
    );
  });

  it('does not confuse a falsy scalar with a missing row', () => {
    expect(toOne(0, 'score')).toBe(0);
    expect(toOne('', 'title')).toBe('');
    expect(toOne(false, 'flag')).toBe(false);
  });
});
