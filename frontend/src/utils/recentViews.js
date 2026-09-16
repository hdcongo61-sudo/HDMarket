import api from '../services/api';

const STORAGE_KEY = 'hdmarket:recent-product-views:v2';
let activeUserId = null;
export const setRecentViewsUser = (userId) => { activeUserId = userId ? String(userId) : null; };
const storageKey = (userId = activeUserId) => `${STORAGE_KEY}:${userId || 'guest'}`;
const MAX_VIEWS = 50;
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

const safeParse = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const loadRecentProductViews = (userId = activeUserId) => {
  if (typeof window === 'undefined') return [];
  try { return safeParse(window.localStorage.getItem(storageKey(userId))); } catch { return []; }
};

export const saveRecentProductViews = (views, userId = activeUserId) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(views)); } catch { /* Storage may be disabled. */ }
};

export const recordProductView = (product) => {
  if (!product) return;
  const rawId = product?._id ? String(product._id) : '';
  const rawSlug = product?.slug ? String(product.slug) : '';
  const viewId = rawId || rawSlug;
  if (!viewId) return;
  const category = product.category || '';
  const current = loadRecentProductViews();
  const next = [
    { id: viewId, category, visitedAt: Date.now() },
    ...current.filter((entry) => String(entry.id) !== viewId)
  ].slice(0, MAX_VIEWS);
  saveRecentProductViews(next);

  if (typeof window !== 'undefined') {
    if (activeUserId) {
      if (product?.status && product.status !== 'approved') return;
      const identifier = OBJECT_ID_REGEX.test(rawId) ? rawId : rawSlug;
      if (!identifier) return;
      api.post(`/users/product-views/${identifier}`).catch(() => undefined);
    }
  }
};

export const fetchRecentProductViews = async (limit = 50, options = {}) => {
  const { data } = await api.get('/users/product-views', { ...options, params: { limit }, skipCache: true });
  return Array.isArray(data) ? data : [];
};

export const buildCategoryPreferences = (views, maxCategories = 4) => {
  const stats = new Map();
  views.forEach((entry) => {
    if (!entry?.category) return;
    const existing = stats.get(entry.category) || { count: 0, last: 0 };
    stats.set(entry.category, {
      count: existing.count + 1,
      last: Math.max(existing.last, Number(entry.visitedAt) || 0)
    });
  });
  return Array.from(stats.entries())
    .sort((a, b) => {
      const countDiff = b[1].count - a[1].count;
      if (countDiff !== 0) return countDiff;
      return b[1].last - a[1].last;
    })
    .slice(0, maxCategories)
    .map(([category]) => category);
};
