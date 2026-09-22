// Run against an isolated local MongoDB with LISTING_TEST_MONGO_URI set.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import ListingFeePayment from '../models/listingFeePaymentModel.js';
import { getListingPaymentReport } from './listingPaymentReportService.js';
import { getPlatformFinance } from './platformFinanceService.js';
import { listPaymentsAdmin } from '../controllers/paymentController.js';
const uri = process.env.LISTING_TEST_MONGO_URI;
const id = () => new mongoose.Types.ObjectId();
const countryA = id(), countryB = id(), productA = id(), productB = id();
describe.skipIf(!uri)('publication reports against MongoDB', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hdmarket_listing_test_[a-z0-9_]+$/i.test(uri)) throw new Error('An isolated local test database is required');
    await mongoose.connect(uri, { autoIndex: false });
    const date = new Date();
    await Product.collection.insertMany([{ _id: productA, title: 'Commode', countryId: countryA, currency: 'XAF' }, { _id: productB, title: 'Miroir', countryId: countryB, currency: 'USD' }]);
    await Payment.collection.insertMany([
      { product: productA, countryId: countryA, currency: 'XAF', paymentType: 'LISTING_FEE', status: 'verified', amount: 5700, amountPaid: 190, createdAt: date },
      { product: productA, countryId: countryA, currency: 'XAF', paymentType: 'LISTING_FEE', status: 'VERIFIED', amount: 800, amountPaid: 0, createdAt: date },
      { product: productA, countryId: countryA, currency: 'XAF', status: 'verified', amount: 50, createdAt: date },
      { product: productA, countryId: countryA, currency: 'XAF', paymentType: 'LISTING_FEE', status: 'verified', waivedByPromo: true, amountPaid: 1000, createdAt: date },
      { product: productA, countryId: countryA, currency: 'XAF', paymentType: 'LISTING_FEE', status: 'REFUNDED', amountPaid: 90, createdAt: date },
      { product: productA, countryId: countryA, currency: 'XAF', paymentType: 'ORDER_PAYMENT', status: 'VERIFIED', amountPaid: 900000, createdAt: date },
      { product: productB, countryId: countryB, currency: 'USD', paymentType: 'LISTING_FEE', status: 'VERIFIED', amountPaid: 12.5, createdAt: date }
    ]);
    await ListingFeePayment.collection.insertMany([
      { productId: productA, status: 'APPROVED', amountPaid: 10, paymentMethod: 'pawapay', transactionReference: 'top-up', submittedAt: date, createdAt: date },
      { productId: productA, status: 'PENDING', amountPaid: 500, createdAt: date }
    ]);
  });
  afterAll(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  it('includes initial receipts, uppercase statuses, legacy fees and top-ups without mixing currencies', async () => {
    const report = await getListingPaymentReport();
    expect(report.verified).toBe(6);
    expect(report.revenue).toBeNull();
    expect(report.currencies).toEqual([{ currency: 'USD', revenue: 12.5, revenueLast30Days: 12.5 }, { currency: 'XAF', revenue: 250, revenueLast30Days: 250 }]);
    const scoped = await getListingPaymentReport({ countryFilter: { countryId: String(countryA) } });
    expect(scoped.revenue).toBe(250);
    expect(scoped.verified).toBe(5);
    const finance = await getPlatformFinance();
    expect(finance.currencies.find(row => row.currency === 'XAF').channels).toMatchObject({ listing: 240, listing_adjustment: 10 });
  });
  it('verification returns only the selected country and normalizes confirmed statuses', async () => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }, next = vi.fn();
    await listPaymentsAdmin({ user: { role: 'founder' }, countryContext: { countryId: countryA, code: 'CG' }, query: { status: 'verified' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.status === 'verified' && row.currency === 'XAF')).toBe(true);
    expect(rows.some(row => row.paymentKind === 'LISTING_FEE_RECONCILIATION' && row.paymentMethod === 'pawapay')).toBe(true);
  });
});
