import { describe, expect, it } from 'vitest';
import {
  normalizePayoutPhone,
  resolveSellerSettlementPolicy
} from './sellerSettlementService.js';

describe('seller payout phone normalization', () => {
  it('normalizes Congo local and international Mobile Money numbers', () => {
    expect(normalizePayoutPhone('06 123 45 67')).toBe('242061234567');
    expect(normalizePayoutPhone('+242 06 123 45 67')).toBe('242061234567');
    expect(normalizePayoutPhone('00242 06 123 45 67')).toBe('242061234567');
  });
});

describe('seller settlement policy', () => {
  it('pays each completed order immediately by default', () => {
    expect(resolveSellerSettlementPolicy({
      seller_min_payout: 5000,
      seller_settlement_hold_hours: 72,
      dispute_window_hours: 72
    })).toMatchObject({
      immediateOnCompletion: true,
      minimumPayout: 0,
      holdHours: 0
    });
  });

  it('keeps the configured batching policy when immediate payout is disabled', () => {
    expect(resolveSellerSettlementPolicy({
      seller_payout_immediate_on_completion: false,
      seller_min_payout: 5000,
      seller_settlement_hold_hours: 24,
      dispute_window_hours: 72
    })).toMatchObject({
      immediateOnCompletion: false,
      minimumPayout: 5000,
      holdHours: 72
    });
  });
});
