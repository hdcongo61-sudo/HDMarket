import { describe, expect, it } from 'vitest';
import {
  filterActiveInstallmentProducts,
  isInstallmentOfferActive
} from './installmentAvailability';

const now = new Date('2026-07-21T12:00:00.000Z');

describe('installment availability', () => {
  it('keeps only offers whose installment period is currently active', () => {
    const active = {
      _id: 'active',
      installmentEnabled: true,
      installmentStartDate: '2026-07-20T00:00:00.000Z',
      installmentEndDate: '2026-07-22T00:00:00.000Z'
    };
    const expired = {
      _id: 'expired',
      installmentEnabled: true,
      installmentStartDate: '2026-07-01T00:00:00.000Z',
      installmentEndDate: '2026-07-21T11:59:59.000Z'
    };
    const future = {
      _id: 'future',
      installmentEnabled: true,
      installmentStartDate: '2026-07-22T00:00:00.000Z',
      installmentEndDate: '2026-07-23T00:00:00.000Z'
    };

    expect(filterActiveInstallmentProducts([active, expired, future], now)).toEqual([active]);
  });

  it('treats an offer as expired at its exact end time', () => {
    expect(
      isInstallmentOfferActive(
        {
          installmentEnabled: true,
          installmentStartDate: '2026-07-20T00:00:00.000Z',
          installmentEndDate: now.toISOString()
        },
        now
      )
    ).toBe(false);
  });
});
