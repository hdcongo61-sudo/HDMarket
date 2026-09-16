import { describe, expect, it } from 'vitest';
import { parseVisualSearchFilters } from './visualSearchFilters.js';
describe('photo search filters', () => {
  it('accepts keywords, price range and ordering', () => {
    const result = parseVisualSearchFilters({ query: 'robe', minPrice: 100, maxPrice: 200, sort: 'price_asc', offset: 12 });
    expect(result.productFilter.price).toEqual({ $gte: 100, $lte: 200 });
    expect(result.offset).toBe(12);
  });
  it('escapes regex syntax', () => expect(parseVisualSearchFilters({ query: '(a+)' }).productFilter.$or[0].title.$regex).toBe('\\(a\\+\\)'));
  it('rejects malformed or reversed ranges and unsafe inputs', () => {
    for (const body of [{ query: { $ne: null } }, { sort: 'bad' }, { minPrice: 2, maxPrice: 1 }, { minPrice: -1 }, { offset: -1 }, { maxPrice: Infinity }]) expect(() => parseVisualSearchFilters(body)).toThrow();
  });
});
