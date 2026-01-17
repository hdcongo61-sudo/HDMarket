import api from '../services/api';

const STORAGE_KEY = 'hdmarket:recent-product-views';
const MAX_VIEWS = 50;

const safeParse = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const loadRecentProductViews = () => {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

export const saveRecentProductViews = (views) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
};

export const recordProductView = (product) => {
  if (!product?._id) return;
  const category = product.category || '';
  const current = loadRecentProductViews();
  const next = [
    { id: String(product._id), category, visitedAt: Date.now() },
    ...current.filter((entry) => String(entry.id) !== String(product._id))
  ].slice(0, MAX_VIEWS);
  saveRecentProductViews(next);

  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('qm_token');
    if (token) {
      const identifier = product.slug || product._id;
      api.post(`/users/product-views/${identifier}`).catch(() => undefined);
    }
  }
};

export const fetchRecentProductViews = async (limit = 50) => {
  const { data } = await api.get('/users/product-views', { params: { limit } });
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
