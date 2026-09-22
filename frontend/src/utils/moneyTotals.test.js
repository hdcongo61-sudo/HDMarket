import { describe, expect, it } from 'vitest';
import { sumRecordedPayments, formatMoneyTotals, formatRecordedMoney } from './moneyTotals';
describe('recorded payment totals', () => {
  it('uses received amounts, preserves zero, and separates currencies', () => {
    const totals = sumRecordedPayments([
      { currency: 'XAF', amount: 5700, amountPaid: 190 },
      { currency: 'XAF', amount: 100, amountPaid: 0 },
      { currency: 'USD', amountPaid: 12.5 },
      { product: { currency: 'XAF' }, amount: 50 },
      { amount: 20 }
    ]);
    expect(totals).toEqual([{ currency: 'UNKNOWN', amount: 20 }, { currency: 'USD', amount: 12.5 }, { currency: 'XAF', amount: 240 }]);
    expect(formatMoneyTotals(totals)).toBe('20 (devise inconnue) · 12,5 USD · 240 FCFA');
    expect(formatRecordedMoney(0, 'USD')).toBe('0 USD');
  });
});
