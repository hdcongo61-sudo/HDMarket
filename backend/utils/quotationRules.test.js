import { describe, expect, it } from 'vitest';
import { quotationCanCreateOrder, quotationIsExpired, quotationSavings } from './quotationRules.js';

const now = new Date('2026-08-13T12:00:00.000Z');

describe('quotation security rules', () => {
  it('allows order creation only for an accepted, locked and unexpired quote', () => {
    expect(quotationCanCreateOrder({ status: 'ACCEPTED', pricesLockedAt: now, expirationDate: '2026-08-14T12:00:00.000Z' }, now)).toBe(true);
    expect(quotationCanCreateOrder({ status: 'COUNTERED', pricesLockedAt: now, expirationDate: '2026-08-14T12:00:00.000Z' }, now)).toBe(false);
    expect(quotationCanCreateOrder({ status: 'ACCEPTED', expirationDate: '2026-08-14T12:00:00.000Z' }, now)).toBe(false);
  });

  it('blocks an expired quote and never reports negative savings', () => {
    expect(quotationIsExpired({ expirationDate: '2026-08-13T11:59:59.000Z' }, now)).toBe(true);
    expect(quotationSavings({ originalSubtotal: 40000, quotedSubtotal: 45000 })).toBe(0);
  });
});
