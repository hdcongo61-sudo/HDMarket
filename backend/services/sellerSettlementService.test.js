import { describe, expect, it } from 'vitest';
import { normalizePayoutPhone } from './sellerSettlementService.js';

describe('seller payout phone normalization', () => {
  it('normalizes Congo local and international Mobile Money numbers', () => {
    expect(normalizePayoutPhone('06 123 45 67')).toBe('242061234567');
    expect(normalizePayoutPhone('+242 06 123 45 67')).toBe('242061234567');
    expect(normalizePayoutPhone('00242 06 123 45 67')).toBe('242061234567');
  });
});
