import { createIdempotencyKey } from './idempotency';
import { recalculateCart } from './cartPricing';

const memory = new Map();
const storageKey = (countryId) => `hdmarket:guest-cart:${countryId || 'default'}`;
export const readGuestCart = (countryId) => {
  const key = storageKey(countryId);
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    if (stored && Array.isArray(stored.items)) return stored;
  } catch { /* Private browsing can disable storage. */ }
  return memory.get(key) || { items: [], countryId: countryId || '', mergeId: '' };
};
export const writeGuestCart = (countryId, cart, { changed = true } = {}) => {
  const next = { ...recalculateCart(cart, { preservePricing: true }), mergeId: changed ? createIdempotencyKey('guest-cart') : cart.mergeId };
  const key = storageKey(countryId);
  memory.set(key, next);
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep this session's cart. */ }
  return next;
};
export const clearGuestCart = (countryId, mergeId) => {
  // A newer cart must not be erased by an older merge response.
  if (mergeId && readGuestCart(countryId).mergeId !== mergeId) return;
  const key = storageKey(countryId);
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
};
export const guestCartSelections = (cart) => (cart.items || []).map((item) => ({
  productId: String(item.product?._id || item.product),
  quantity: item.quantity,
  selectedAttributes: item.selectedAttributes || []
}));
