import { describe, expect, it } from 'vitest';
import {
  chunkSettlementsForPayout,
  isOrderEscrowReleasedForSettlement,
  normalizePayoutPhone,
  payoutLimitsForProvider,
  resolveSellerSettlementPolicy
} from './sellerSettlementService.js';

describe('escrow settlement eligibility', () => {
  it('requires a released PawaPay escrow, including for partial payments', () => {
    expect(isOrderEscrowReleasedForSettlement({
      paymentSource: 'pawapay',
      escrowStatus: 'RELEASED',
      paidAmount: 5000,
      remainingAmount: 5000
    })).toBe(true);
    expect(isOrderEscrowReleasedForSettlement({
      paymentSource: 'pawapay',
      escrowStatus: 'WAITING_BUYER_CONFIRMATION',
      remainingAmount: 0
    })).toBe(false);
    expect(isOrderEscrowReleasedForSettlement({
      paymentSource: 'mobile_money',
      escrowStatus: 'RELEASED'
    })).toBe(false);
  });
});

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

describe('PawaPay payout provider limits', () => {
  it('returns the documented Airtel and MTN ceilings', () => {
    expect(payoutLimitsForProvider('AIRTEL_COG')).toEqual({ min: 10, max: 1_500_000 });
    expect(payoutLimitsForProvider('MTN_MOMO_COG')).toEqual({ min: 1, max: 2_000_000 });
  });

  it('falls back to the tighter Airtel ceiling for an unrecognized provider', () => {
    expect(payoutLimitsForProvider('')).toEqual({ min: 10, max: 1_500_000 });
    expect(payoutLimitsForProvider(undefined)).toEqual({ min: 10, max: 1_500_000 });
  });
});

describe('chunking settlements into PawaPay-sized payout batches', () => {
  const settlement = (id, netAmount) => ({ _id: id, netAmount });

  it('keeps a single small batch together when it fits under the ceiling', () => {
    const { batches, oversized } = chunkSettlementsForPayout(
      [settlement('a', 100_000), settlement('b', 200_000)],
      1_500_000
    );
    expect(oversized).toEqual([]);
    expect(batches).toHaveLength(1);
    expect(batches[0].map((item) => item._id)).toEqual(['a', 'b']);
  });

  it('splits an aggregate that would otherwise exceed the Airtel ceiling', () => {
    const { batches, oversized } = chunkSettlementsForPayout(
      [settlement('a', 600_000), settlement('b', 600_000), settlement('c', 600_000)],
      1_500_000
    );
    expect(oversized).toEqual([]);
    expect(batches).toHaveLength(2);
    expect(batches[0].map((item) => item._id)).toEqual(['a', 'b']);
    expect(batches[0].reduce((sum, item) => sum + item.netAmount, 0)).toBeLessThanOrEqual(1_500_000);
    expect(batches[1].map((item) => item._id)).toEqual(['c']);
  });

  it('sets aside a settlement whose own amount already exceeds the ceiling', () => {
    const { batches, oversized } = chunkSettlementsForPayout(
      [settlement('a', 200_000), settlement('b', 1_800_000), settlement('c', 100_000)],
      1_500_000
    );
    expect(oversized.map((item) => item._id)).toEqual(['b']);
    expect(batches).toHaveLength(1);
    expect(batches[0].map((item) => item._id)).toEqual(['a', 'c']);
  });

  it('never produces a batch exceeding the ceiling across randomized settlement sizes', () => {
    const settlements = Array.from({ length: 30 }, (_, index) =>
      settlement(`s${index}`, Math.round(50_000 + Math.random() * 400_000))
    );
    const { batches, oversized } = chunkSettlementsForPayout(settlements, 1_500_000);
    expect(oversized).toEqual([]);
    batches.forEach((batch) => {
      const total = batch.reduce((sum, item) => sum + item.netAmount, 0);
      expect(total).toBeLessThanOrEqual(1_500_000);
    });
    const totalIn = settlements.reduce((sum, item) => sum + item.netAmount, 0);
    const totalOut = batches.flat().reduce((sum, item) => sum + item.netAmount, 0);
    expect(totalOut).toBe(totalIn);
  });
});
