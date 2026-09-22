import { createIdempotencyKey } from './idempotency';

const PREFIX = 'hdmarket:pawapay-attempt:';
const memory = new Map();

// Hash the payload so addresses and payment context never appear in storage keys.
export const getPawaPayAttempt = async (scope, payload) => {
  const raw = JSON.stringify([scope, payload]);
  const digest = globalThis.crypto?.subtle
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)) : null;
  const key = digest
    ? PREFIX + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    : null;
  let previous = memory.get(raw);
  try { if (key) previous = JSON.parse(sessionStorage.getItem(key) || 'null') || previous; } catch { /* Optional storage. */ }
  // An unresolved payment never becomes permission to charge again with time.
  if (previous) return { ...previous, storageKey: key, memoryKey: raw };
  const attempt = { idempotencyKey: createIdempotencyKey('pawapay-checkout'), createdAt: Date.now() };
  memory.set(raw, attempt);
  try { if (key) sessionStorage.setItem(key, JSON.stringify(attempt)); } catch { /* Optional storage. */ }
  return { ...attempt, storageKey: key, memoryKey: raw };
};

export const updatePawaPayAttempt = (attempt, checkoutId) => {
  if (!attempt) return;
  const value = { idempotencyKey: attempt.idempotencyKey, createdAt: attempt.createdAt, checkoutId };
  memory.set(attempt.memoryKey, value);
  try { if (attempt.storageKey) sessionStorage.setItem(attempt.storageKey, JSON.stringify(value)); } catch { /* Optional storage. */ }
};

export const clearPawaPayAttempt = (attempt) => {
  if (!attempt) return;
  memory.delete(attempt.memoryKey);
  try { if (attempt.storageKey) sessionStorage.removeItem(attempt.storageKey); } catch { /* Optional storage. */ }
};

export const clearPawaPayAttemptByCheckout = (checkoutId) => {
  if (!checkoutId) return;
  for (const [key, value] of memory) if (value.checkoutId === checkoutId) memory.delete(key);
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX) && JSON.parse(sessionStorage.getItem(key) || 'null')?.checkoutId === checkoutId) sessionStorage.removeItem(key);
    }
  } catch { /* Optional storage. */ }
};
