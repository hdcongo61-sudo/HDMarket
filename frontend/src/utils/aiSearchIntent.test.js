import { describe, expect, it } from 'vitest';
import { searchIntentPath } from './aiSearchIntent';
describe('reviewed AI search navigation', () => {
  it('keeps budget and condition without injecting arbitrary route parameters', () => {
    const url = new URL(searchIntentPath('sac & robe', { maxPrice: 50000, condition: 'used', redirect: 'https://other.test' }), 'https://local.test');
    expect(url.pathname).toBe('/search'); expect(url.searchParams.get('q')).toBe('sac & robe');
    expect(url.searchParams.get('maxPrice')).toBe('50000'); expect(url.searchParams.get('condition')).toBe('used'); expect(url.searchParams.has('redirect')).toBe(false);
  });
  it('drops invalid filters and accepts zero as a price', () => {
    const url = searchIntentPath('sac', { minPrice: 0, maxPrice: -5, condition: 'invalid' });
    expect(url).toContain('minPrice=0'); expect(url).not.toContain('maxPrice'); expect(url).not.toContain('condition');
  });
});
