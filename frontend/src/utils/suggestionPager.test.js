import { describe, expect, it, vi } from 'vitest';
import { createSuggestionPager } from './suggestionPager';
const products = (category, size) => Array.from({ length: size }, (_, i) => ({ _id: `${category}${i}`, category }));
describe('suggestion pagination', () => {
  it('mixes categories without losing overflow products', async () => {
    const fetchPage = vi.fn(async ({ category }) => ({ items: products(category, 12), pagination: { pages: 1 } }));
    const next = createSuggestionPager({ categories: ['a', 'b'], fetchPage });
    const first = await next();
    expect(first.items.slice(0, 4).map(p => p._id)).toEqual(['a0', 'b0', 'a1', 'b1']);
    const second = await next();
    expect(new Set([...first.items, ...second.items].map(p => p._id)).size).toBe(24);
    expect(second.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
  it('uses popular products without history', async () => {
    const fetchPage = vi.fn(async () => []);
    await createSuggestionPager({ categories: [], fetchPage })();
    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ category: null, sort: 'popular' }));
  });
  it('excludes viewed products, duplicates and own products', async () => {
    const next = createSuggestionPager({ categories: ['a'], userId: 'owner', visitedIds: new Set(['seen']), fetchPage: async () => [{ _id: 'seen' }, { _id: 'mine', user: { _id: 'owner' } }, { _id: 'new' }, { _id: 'new' }] });
    expect((await next()).items.map(p => p._id)).toEqual(['new']);
  });
  it('preserves pagination after a failed request', async () => {
    let fail = true;
    const next = createSuggestionPager({ categories: ['a', 'b'], fetchPage: async ({ category }) => {
      if (category === 'b' && fail) throw new Error('offline');
      return products(category, 2);
    } });
    await expect(next()).rejects.toThrow('offline');
    fail = false;
    expect((await next()).items.map(p => p._id)).toEqual(['a0', 'b0', 'a1', 'b1']);
  });
  it('discards aborted responses without advancing pagination', async () => {
    const controller = new AbortController();
    let abort = true;
    const next = createSuggestionPager({ categories: ['a'], fetchPage: async () => {
      if (abort) controller.abort();
      return products('a', 2);
    } });
    await expect(next(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    abort = false;
    expect((await next()).items).toHaveLength(2);
  });
});
