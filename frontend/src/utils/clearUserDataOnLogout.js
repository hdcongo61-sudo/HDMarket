/**
 * Clear all user-specific and cached data on logout.
 * Prevents the next user on the same device (e.g. shared mobile) from seeing
 * the previous user's data.
 */

import storage from './storage.js';

const LOCAL_STORAGE_KEYS_TO_REMOVE = [
  'cached_orders',
  'hdmarket:recent-product-views',
  'hdmarket_saved_searches',
  'hdmarket_custom_nav_items',
  'hdmarket_chat_hidden',
  'hdmarket_chat_button_collapsed',
  'hdmarket_order_chat_encryption',
  'user' // legacy key sometimes used as fallback
];

const STORAGE_KEYS_TO_REMOVE = ['userDashboard_savedFilters'];

const CHAT_KEY_PREFIX = 'hdmarket_chat_key_';

/**
 * Clear all keys that may contain previous user's data.
 * Call this on logout before redirecting.
 */
export const clearUserDataOnLogout = async () => {
  if (typeof window === 'undefined') return;

  try {
    // Clear known localStorage keys (some features use localStorage directly)
    for (const key of LOCAL_STORAGE_KEYS_TO_REMOVE) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    // Clear all chat encryption keys (hdmarket_chat_key_*)
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CHAT_KEY_PREFIX)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // ignore
    }

    // Clear unified storage keys (used on web and native)
    for (const key of STORAGE_KEYS_TO_REMOVE) {
      try {
        await storage.remove(key);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[clearUserDataOnLogout]', err?.message || err);
    }
  }
};

export default clearUserDataOnLogout;
