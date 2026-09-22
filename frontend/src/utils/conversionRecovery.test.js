import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readGuestCart, writeGuestCart, clearGuestCart } from './guestCart';
import { readCheckoutDraft, saveCheckoutDraft } from './checkoutDraft';
import { getPawaPayAttempt, updatePawaPayAttempt, clearPawaPayAttemptByCheckout } from './pawapayAttempt';
const storage = () => {
  const values = {};
  return new Proxy(values, { get: (target, key) => {
    if (key === 'getItem') return (name) => target[name] || null;
    if (key === 'setItem') return (name, value) => { target[name] = value; };
    if (key === 'removeItem') return (name) => { delete target[name]; };
    return target[key];
  } });
};
beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('crypto', webcrypto);
});
describe('conversion recovery', () => {
  it('keeps server-priced guest variants and separates countries', () => {
    const saved = writeGuestCart('country-a', { items: [{ product: { _id: 'product', price: 10000 }, quantity: 2, unitPrice: 7000, lineTotal: 14000, selectedAttributes: [{ name: 'Taille', value: 'S' }] }] });
    expect(readGuestCart('country-a').totals.subtotal).toBe(14000);
    expect(readGuestCart('country-b').items).toEqual([]);
    const newer = writeGuestCart('country-a', { ...saved, items: [] });
    clearGuestCart('country-a', saved.mergeId);
    expect(readGuestCart('country-a').mergeId).toBe(newer.mergeId);
  });
  it('recovers checkout details only for the same user and country without sensitive proof fields', () => {
    saveCheckoutDraft('buyer', 'cg', { deliveryMode: 'DELIVERY', shippingAddress: { addressLine: 'Test street' }, paymentPercent: 70, password: 'private', guarantor: { nationalId: 'private' } });
    expect(readCheckoutDraft('buyer', 'cg')).toMatchObject({ deliveryMode: 'DELIVERY', paymentPercent: 70 });
    expect(readCheckoutDraft('buyer', 'cg')).not.toHaveProperty('password');
    expect(readCheckoutDraft('buyer', 'cg')).not.toHaveProperty('guarantor');
    expect(readCheckoutDraft('other', 'cg')).toEqual({});
    expect(readCheckoutDraft('buyer', 'other')).toEqual({});
  });
  it('reuses an attempt after a lost response and renews it only after a terminal result', async () => {
    const payload = { amount: 1200, shippingAddress: { addressLine: 'Private street' } };
    const first = await getPawaPayAttempt('buyer:cg', payload);
    expect((await getPawaPayAttempt('buyer:cg', payload)).idempotencyKey).toBe(first.idempotencyKey);
    expect((await getPawaPayAttempt('other:cg', payload)).idempotencyKey).not.toBe(first.idempotencyKey);
    expect((await getPawaPayAttempt('buyer:cg', { ...payload, amount: 1300 })).idempotencyKey).not.toBe(first.idempotencyKey);
    expect(JSON.stringify(sessionStorage)).not.toContain('Private street');
    updatePawaPayAttempt(first, 'completed-checkout');
    clearPawaPayAttemptByCheckout('completed-checkout');
    expect((await getPawaPayAttempt('buyer:cg', payload)).idempotencyKey).not.toBe(first.idempotencyKey);
  });
  it('removes expired delivery drafts instead of retaining the address in storage', () => {
    const key = 'hdmarket:checkout-draft:buyer:cg';
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now() - 2 * 60 * 60 * 1000, draft: { shippingAddress: { addressLine: 'Private street' } } }));
    expect(readCheckoutDraft('buyer', 'cg')).toEqual({});
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
