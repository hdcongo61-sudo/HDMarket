import api from '../services/api';
import { buildCategoryPreferences, loadRecentProductViews } from './recentViews';

// Shared "suggestions for empty search results" loader.
//
// - Logged in  -> server-side personalization (product views + favorites +
//                 search history, popular fallback in the engine).
// - Guest      -> local browsing-history categories first (recentViews),
//                 then global popular products.
// Returns { products, source } with source in 'personalized' | 'history' | 'popular'.

const TOKEN_KEY = 'qm_token';

const isLoggedIn = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
};

const extractItems = (data) => {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
};

export const loadSearchSuggestions = async ({ limit = 12, excludeIds = [] } = {}) => {
  if (isLoggedIn()) {
    try {
      const params = { limit };
      if (excludeIds.length) params.exclude = excludeIds.join(',');
      const { data } = await api.get('/products/recommendations', { params });
      const items = extractItems(data);
      if (items.length) {
        return { products: items.slice(0, limit), source: 'personalized' };
      }
    } catch {
      // Fall through to the guest path below.
    }
  }

  // Guest: try the visitor's top browsing-history category first.
  const prefs = buildCategoryPreferences(loadRecentProductViews(), 3);
  if (prefs.length) {
    try {
      const { data } = await api.get('/products/public', {
        params: { limit: Math.max(8, limit), sort: 'popular', category: prefs[0] }
      });
      const items = extractItems(data);
      if (items.length) {
        return { products: items.slice(0, limit), source: 'history' };
      }
    } catch {
      // Retry without the category below.
    }
  }

  // Global popular fallback.
  try {
    const { data } = await api.get('/products/public', {
      params: { limit: Math.max(8, limit), sort: 'popular' }
    });
    const items = extractItems(data);
    if (items.length) {
      return { products: items.slice(0, limit), source: 'popular' };
    }
  } catch {
    // No suggestions available.
  }

  return { products: [], source: 'popular' };
};
