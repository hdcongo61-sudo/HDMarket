const MAX_AGE = 2 * 60 * 60 * 1000;
const keyFor = (userId, countryId) => `hdmarket:checkout-draft:${userId}:${countryId}`;

export const readCheckoutDraft = (userId, countryId) => {
  if (!userId) return {};
  try {
    const value = JSON.parse(sessionStorage.getItem(keyFor(userId, countryId)) || 'null');
    const age = Date.now() - value?.savedAt;
    if (value && Number.isFinite(value.savedAt) && age >= 0 && age < MAX_AGE) return value.draft || {};
    if (value) sessionStorage.removeItem(keyFor(userId, countryId));
  } catch { /* Checkout still works with storage disabled. */ }
  return {};
};

export const saveCheckoutDraft = (userId, countryId, draft) => {
  if (!userId) return;
  // Short-lived, per-tab recovery. No tokens, transaction codes or guarantor identity.
  const { deliveryMode, shippingAddress, paymentMode, paymentPercent, installmentPaymentMethod, groupBuyId } = draft;
  try {
    sessionStorage.setItem(keyFor(userId, countryId), JSON.stringify({
      savedAt: Date.now(), draft: { deliveryMode, shippingAddress, paymentMode, paymentPercent, installmentPaymentMethod, groupBuyId }
    }));
  } catch { /* Storage is optional. */ }
};

export const clearCheckoutDraft = (userId, countryId) => {
  try { sessionStorage.removeItem(keyFor(userId, countryId)); } catch { /* Storage is optional. */ }
};
