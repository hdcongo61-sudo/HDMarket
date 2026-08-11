import { describe, expect, it } from 'vitest';
import { getPaymentPeriodStart, sortPaymentsByRecency } from './paymentVerificationFilters';

describe('payment verification filters', () => {
  const payments = [
    { _id: 'old', submittedAt: '2026-08-01T10:00:00.000Z' },
    { _id: 'new', submittedAt: '2026-08-11T10:00:00.000Z' },
    { _id: 'middle', createdAt: '2026-08-05T10:00:00.000Z' }
  ];

  it('shows the most recent payment first by default', () => {
    expect(sortPaymentsByRecency(payments).map((payment) => payment._id)).toEqual([
      'new',
      'middle',
      'old'
    ]);
  });

  it('can show the oldest payment first', () => {
    expect(sortPaymentsByRecency(payments, 'oldest').map((payment) => payment._id)).toEqual([
      'old',
      'middle',
      'new'
    ]);
  });

  it('builds a local start-of-day boundary for period filters', () => {
    const start = getPaymentPeriodStart('7d', new Date('2026-08-11T12:00:00.000Z'));
    expect(new Date(start).getTime()).toBeLessThan(new Date('2026-08-11T12:00:00.000Z').getTime());
  });
});
