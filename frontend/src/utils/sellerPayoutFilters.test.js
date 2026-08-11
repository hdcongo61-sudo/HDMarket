import { describe, expect, it } from 'vitest';
import {
  countPayoutsByGroup,
  filterSellerPayouts,
  summarizeSellerPayouts
} from './sellerPayoutFilters';

const payouts = [
  {
    _id: 'old-failed',
    status: 'FAILED',
    amount: 5000,
    provider: 'MTN_MOMO_COG',
    payoutId: 'payout-mtn',
    createdAt: '2026-08-01T10:00:00.000Z',
    seller: { shopName: 'Boutique Congo' }
  },
  {
    _id: 'new-completed',
    status: 'COMPLETED',
    amount: 12000,
    provider: 'AIRTEL_COG',
    payoutId: 'payout-airtel',
    createdAt: '2026-08-11T10:00:00.000Z',
    seller: { name: 'Marie' }
  },
  {
    _id: 'processing',
    status: 'PROCESSING',
    amount: 7000,
    provider: 'MTN_MOMO_COG',
    createdAt: '2026-08-07T10:00:00.000Z',
    seller: { email: 'vendeur@hdmarket.cg' }
  }
];

describe('seller payout filters', () => {
  it('shows the most recent payouts first by default', () => {
    expect(filterSellerPayouts(payouts).map((payout) => payout._id)).toEqual([
      'new-completed',
      'processing',
      'old-failed'
    ]);
  });

  it('combines attention statuses and filters providers', () => {
    expect(filterSellerPayouts(payouts, { status: 'attention' }).map((payout) => payout._id)).toEqual([
      'old-failed'
    ]);
    expect(filterSellerPayouts(payouts, { provider: 'MTN_MOMO_COG' })).toHaveLength(2);
  });

  it('searches seller identity and technical references', () => {
    expect(filterSellerPayouts(payouts, { search: 'marie' })[0]?._id).toBe('new-completed');
    expect(filterSellerPayouts(payouts, { search: 'payout-mtn' })[0]?._id).toBe('old-failed');
  });

  it('summarizes operational states and paid volume', () => {
    expect(summarizeSellerPayouts(payouts)).toEqual({
      total: 3,
      attention: 1,
      processing: 1,
      completed: 1,
      completedAmount: 12000
    });
    expect(countPayoutsByGroup(payouts, 'processing')).toBe(1);
  });
});
