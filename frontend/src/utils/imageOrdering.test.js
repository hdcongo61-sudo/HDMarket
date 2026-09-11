import { describe, expect, it } from 'vitest';
import {
  applyOrder,
  isValidPermutation,
  materializeOrder,
  moveInOrder,
  reconcileOrderAfterAdd,
  reconcileOrderAfterRemove
} from './imageOrdering';

describe('materializeOrder', () => {
  it('returns the stored permutation when lengths match', () => {
    expect(materializeOrder([2, 0, 1], 3)).toEqual([2, 0, 1]);
  });

  it('falls back to natural order otherwise', () => {
    expect(materializeOrder(null, 3)).toEqual([0, 1, 2]);
    expect(materializeOrder([2, 0], 3)).toEqual([0, 1, 2]);
  });
});

describe('moveInOrder', () => {
  it('swaps with the right neighbour', () => {
    expect(moveInOrder(null, 3, 0, 1)).toEqual([1, 0, 2]);
    expect(moveInOrder([2, 0, 1], 3, 2, 1)).toEqual([0, 2, 1]);
  });

  it('returns null at the edges', () => {
    expect(moveInOrder(null, 3, 0, -1)).toBeNull();
    expect(moveInOrder(null, 3, 2, 1)).toBeNull();
    expect(moveInOrder(null, 1, 0, 1)).toBeNull();
  });
});

describe('reconcileOrderAfterRemove', () => {
  it('drops the removed index and shifts higher ones down', () => {
    expect(reconcileOrderAfterRemove([3, 0, 2, 1], 1)).toEqual([2, 0, 1]);
    expect(reconcileOrderAfterRemove([2, 0, 1], 2)).toEqual([0, 1]);
  });

  it('keeps natural order as null', () => {
    expect(reconcileOrderAfterRemove(null, 1)).toBeNull();
  });
});

describe('reconcileOrderAfterAdd', () => {
  it('appends new combined indices', () => {
    expect(reconcileOrderAfterAdd([1, 0], 2, 2)).toEqual([1, 0, 2, 3]);
  });

  it('keeps natural order as null', () => {
    expect(reconcileOrderAfterAdd(null, 2, 0)).toBeNull();
  });
});

describe('applyOrder', () => {
  it('reorders a list according to the permutation', () => {
    expect(applyOrder(['a', 'b', 'c'], [2, 0, 1])).toEqual(['c', 'a', 'b']);
  });

  it('returns the list as-is for natural order', () => {
    expect(applyOrder(['a', 'b'], null)).toEqual(['a', 'b']);
  });
});

describe('isValidPermutation', () => {
  it('accepts only complete, unique, in-range indices', () => {
    expect(isValidPermutation([2, 0, 1], 3)).toBe(true);
    expect(isValidPermutation([0, 1], 3)).toBe(false);
    expect(isValidPermutation([0, 0, 1], 3)).toBe(false);
    expect(isValidPermutation([0, 3, 1], 3)).toBe(false);
    expect(isValidPermutation(null, 3)).toBe(false);
  });
});
