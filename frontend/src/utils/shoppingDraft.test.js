import { describe, it, expect } from 'vitest';
import { shoppingDraftFrom } from './shoppingDraft';

describe('reusing a shopping list', () => {
  it('copies editable items without reusing money, private evidence or addresses', () => {
    const draft = shoppingDraftFrom({ _id: 'old', status: 'COMPLETED', payment: { checkoutId: 'paid' }, receiptId: 'private', dropoff: { address: 'Private address' },
      items: [{ name: 'Riz', quantity: 2, estimatedUnitPrice: 1000, imageUrl: 'private', status: 'FOUND' }, { name: 'Removed', status: 'CANCELED' }] });
    expect(draft.items).toEqual([{ name: 'Riz', quantity: '2', estimatedUnitPrice: '1000', note: '' }]);
    expect(draft).not.toHaveProperty('payment'); expect(draft).not.toHaveProperty('dropoff'); expect(draft).not.toHaveProperty('receiptId');
  });
});
