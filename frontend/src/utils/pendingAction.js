/**
 * Pending action storage: when an action requires login, we store it here
 * so after login we can resume (e.g. add to favorites, add to cart).
 * Uses sessionStorage so it survives the redirect to /login and back.
 */

const KEY = 'hdmarket_pending_action';

export function setPendingAction(action) {
  if (typeof window === 'undefined') return;
  try {
    if (action) {
      sessionStorage.setItem(KEY, JSON.stringify(action));
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch (e) {
    console.warn('pendingAction: set failed', e);
  }
}

export function getPendingAction() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('pendingAction: get failed', e);
    return null;
  }
}

export function clearPendingAction() {
  setPendingAction(null);
}
