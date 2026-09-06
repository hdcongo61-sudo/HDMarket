import { describe, expect, it } from 'vitest';
import { dedupeProducts, mergeProducts } from './dedupeProducts';

describe('dedupeProducts', () => {
  it('keeps first occurrence order and drops duplicates', () => {
    const list = [
      { _id: 'a', title: 'A1' },
      { slug: 'b', title: 'B' },
      { _id: 'a', title: 'A2' },
      { slug: 'b', title: 'B2' },
      { _id: 'c', title: 'C' }
    ];
    expect(dedupeProducts(list)).toEqual([
      { _id: 'a', title: 'A1' },
      { slug: 'b', title: 'B' },
      { _id: 'c', title: 'C' }
    ]);
  });

  it('matches _id against slug when both exist on different items', () => {
    const list = [
      { _id: 'x1', slug: 'x' },
      { slug: 'x1' }
    ];
    expect(dedupeProducts(list)).toEqual([{ _id: 'x1', slug: 'x' }]);
  });

  it('keeps items without identity', () => {
    const list = [{ title: 'no id' }, { title: 'no id' }];
    expect(dedupeProducts(list)).toHaveLength(2);
  });

  it('returns an empty array for non-arrays', () => {
    expect(dedupeProducts(null)).toEqual([]);
    expect(dedupeProducts({})).toEqual([]);
  });
});

describe('mergeProducts', () => {
  it('skips incoming products already present', () => {
    const existing = [{ _id: 'a' }, { _id: 'b' }];
    const incoming = [{ _id: 'b' }, { _id: 'c' }, { _id: 'a' }];
    expect(mergeProducts(existing, incoming)).toEqual([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]);
  });

  it('dedupes within incoming and preserves existing order', () => {
    const existing = [{ _id: 'z' }];
    const incoming = [{ _id: 'y' }, { _id: 'y' }];
    expect(mergeProducts(existing, incoming)).toEqual([{ _id: 'z' }, { _id: 'y' }]);
  });
});
