const STORAGE_KEY = 'hdmarket:recently-viewed';
const MAX_ITEMS = 20;
const UPDATE_EVENT = 'hdmarket:recently-viewed-updated';

const safeParse = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readRecentlyViewed = () => {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY)).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

/**
 * Records a viewed product into the device-local footprint ring buffer.
 * Works for logged-out browsers too — no backend round-trip.
 */
export const trackRecentlyViewed = (product = null) => {
  if (typeof window === 'undefined' || !product) return;
  const id = String(product._id || product.id || '');
  const slug = String(product.slug || '');
  if (!id && !slug) return;

  const entry = {
    id,
    slug,
    title: String(product.title || '').slice(0, 160),
    price: Number(product.price || 0),
    discount: Number(product.discount || 0),
    priceBeforeDiscount: Number(product.priceBeforeDiscount || 0),
    image: String((Array.isArray(product.images) ? product.images[0] : product.images) || ''),
    viewedAt: Date.now()
  };

  try {
    const next = [entry, ...readRecentlyViewed().filter((item) => item.slug !== entry.slug && item.id !== entry.id)].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    /* storage may be unavailable (private mode) — footprint is best-effort */
  }
};

export const clearRecentlyViewed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    /* ignore */
  }
};
