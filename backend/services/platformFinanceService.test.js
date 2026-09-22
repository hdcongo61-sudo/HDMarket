import { describe, it, expect } from 'vitest';
import { combineFinanceRows, financeSources } from './platformFinanceService.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Payment from '../models/paymentModel.js';
describe('platform finance separation', () => {
  it('never adds merchant payments or duplicates funding rows to platform receipts', () => {
    expect(financeSources.find(x => x.model === Payment).match.$or).toEqual([{ paymentType: 'LISTING_FEE' }, { paymentType: { $exists: false }, product: { $ne: null } }]);
    expect(financeSources.find(x => x.model === PawaPayCheckout).match).toEqual({ purpose: 'IMAGE_EDIT_FUNDING', status: 'COMPLETED', paymentState: 'CONFIRMED' });
    expect(financeSources.some(x => x.match.paymentType === 'ORDER_PAYMENT')).toBe(false);
  });
  it('separates currencies, refunds, actual expenses and unknown currency', () => {
    const result = combineFinanceRows([{ channel: 'listing', currency: 'XAF', receipts: 10000, refunds: 1000 }, { channel: 'ai', currency: 'XAF', receipts: 2000 }, { channel: 'shop', currency: null, receipts: 50000 }], [{ _id: 'XAF', amount: 500 }, { _id: 'USD', amount: 20 }]);
    expect(result.find(x => x.currency === 'XAF')).toMatchObject({ receipts: 12000, recordedRefunds: 1000, recordedExpenses: 500, balanceAfterRecordedCosts: 10500 });
    expect(result.find(x => x.currency === 'USD')).toMatchObject({ receipts: 0, balanceAfterRecordedCosts: -20 });
    expect(result.find(x => x.currency === 'UNKNOWN').receipts).toBe(50000);
  });
});
