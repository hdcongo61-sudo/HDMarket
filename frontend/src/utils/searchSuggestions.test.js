import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./recentViews', () => ({
  buildCategoryPreferences: vi.fn(),
  loadRecentProductViews: vi.fn()
}));

const createWindowStub = (token = null) => {
  const map = new Map();
  if (token) map.set('qm_token', token);
  return {
    localStorage: {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key)
    }
  };
};

const PRODUCTS = [
  { _id: 'p1', title: 'Canapé moderne', price: 120000 },
  { _id: 'p2', title: 'Meuble TV', price: 80000 }
];

describe('loadSearchSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete globalThis.window;
  });

  it('uses personalized recommendations when logged in', async () => {
    globalThis.window = createWindowStub('token-123');
    const { default: api } = await import('../services/api');
    const { buildCategoryPreferences, loadRecentProductViews } = await import('./recentViews');
    const { loadSearchSuggestions } = await import('./searchSuggestions');

    api.get.mockResolvedValue({ data: { items: PRODUCTS } });

    const result = await loadSearchSuggestions({ limit: 12 });

    expect(api.get).toHaveBeenCalledWith('/products/recommendations', { params: { limit: 12 } });
    expect(result).toEqual({ products: PRODUCTS, source: 'personalized' });
    expect(buildCategoryPreferences).not.toHaveBeenCalled();
    expect(loadRecentProductViews).not.toHaveBeenCalled();
  });

  it('falls back to browsing-history categories for guests', async () => {
    globalThis.window = createWindowStub();
    const { default: api } = await import('../services/api');
    const { buildCategoryPreferences, loadRecentProductViews } = await import('./recentViews');
    const { loadSearchSuggestions } = await import('./searchSuggestions');

    buildCategoryPreferences.mockReturnValue(['canapes', 'meubles']);
    loadRecentProductViews.mockReturnValue([{ id: 'p1', category: 'canapes' }]);
    api.get.mockResolvedValue({ data: { items: PRODUCTS } });

    const result = await loadSearchSuggestions({ limit: 8 });

    expect(api.get).toHaveBeenCalledWith('/products/public', {
      params: { limit: 8, sort: 'popular', category: 'canapes' }
    });
    expect(result).toEqual({ products: PRODUCTS, source: 'history' });
  });

  it('falls back to popular products when a guest has no history', async () => {
    globalThis.window = createWindowStub();
    const { default: api } = await import('../services/api');
    const { buildCategoryPreferences } = await import('./recentViews');
    const { loadSearchSuggestions } = await import('./searchSuggestions');

    buildCategoryPreferences.mockReturnValue([]);
    api.get.mockResolvedValue({ data: { items: PRODUCTS } });

    const result = await loadSearchSuggestions({ limit: 12 });

    expect(api.get).toHaveBeenCalledWith('/products/public', {
      params: { limit: 12, sort: 'popular' }
    });
    expect(result).toEqual({ products: PRODUCTS, source: 'popular' });
  });

  it('uses popular fallback when personalized recommendations fail', async () => {
    globalThis.window = createWindowStub('token-123');
    const { default: api } = await import('../services/api');
    const { buildCategoryPreferences } = await import('./recentViews');
    const { loadSearchSuggestions } = await import('./searchSuggestions');

    api.get.mockRejectedValueOnce(new Error('offline'));
    buildCategoryPreferences.mockReturnValue([]);
    api.get.mockResolvedValueOnce({ data: { items: PRODUCTS } });

    const result = await loadSearchSuggestions({ limit: 12 });

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ products: PRODUCTS, source: 'popular' });
  });

  it('returns empty products when everything fails', async () => {
    globalThis.window = createWindowStub('token-123');
    const { default: api } = await import('../services/api');
    const { buildCategoryPreferences } = await import('./recentViews');
    const { loadSearchSuggestions } = await import('./searchSuggestions');

    api.get.mockRejectedValue(new Error('offline'));
    buildCategoryPreferences.mockReturnValue(['canapes']);

    const result = await loadSearchSuggestions({ limit: 12 });

    expect(result).toEqual({ products: [], source: 'popular' });
  });
});
