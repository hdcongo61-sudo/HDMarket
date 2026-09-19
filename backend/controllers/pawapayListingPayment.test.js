import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPawaPayCheckout, retryPawaPayCheckoutCompletionAdmin } from './pawapayController.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import User from '../models/userModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import { getListingCommissionRate } from '../services/listingCommissionService.js';
import * as provider from '../services/pawapayService.js';
import * as paymentService from '../services/paymentService.js';
import * as cache from '../utils/cache.js';

vi.mock('../services/listingCommissionService.js', () => ({ getListingCommissionRate: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
const response = () => { const res = { status: vi.fn(() => res), json: vi.fn(() => res) }; return res; };
const product = { _id: '507f1f77bcf86cd799439011', user: 'seller', price: 190000, countryId: 'country', attributes: [] };

describe('PawaPay publication checkout', () => {
  it.each([0, 3])('rejects an old 0.1%% amount before charging when the current rate is %s%%', async (rate) => {
    getListingCommissionRate.mockResolvedValue(rate);
    vi.spyOn(Product, 'findById').mockReturnValue({ select: () => ({ lean: async () => product }) });
    const initiate = vi.spyOn(provider, 'initiatePawaPayCheckout').mockRejectedValue(new Error('Must not contact provider'));
    const create = vi.spyOn(PawaPayCheckout, 'create');
    const res = response();
    const next = vi.fn();
    await createPawaPayCheckout({ user: { _id: 'seller' }, body: { purpose: 'LISTING_FEE_FUNDING', productId: product._id, amount: 190 } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAWAPAY_LISTING_AMOUNT_CHANGED' }));
    expect(initiate).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('saves the current fractional rate and amount before opening the provider', async () => {
    getListingCommissionRate.mockResolvedValue(0.1);
    vi.spyOn(Product, 'findById').mockReturnValue({ select: () => ({ lean: async () => product }) });
    vi.spyOn(paymentService, 'resolvePaymentProvider').mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: 'country' } });
    const create = vi.spyOn(PawaPayCheckout, 'create').mockImplementation(async (data) => ({ ...data, save: vi.fn() }));
    vi.spyOn(provider, 'initiatePawaPayCheckout').mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://example.com/checkout' });
    const res = response();
    const next = vi.fn();
    await createPawaPayCheckout({ user: { _id: 'seller' }, body: { purpose: 'LISTING_FEE_FUNDING', productId: product._id, amount: 190 } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getListingCommissionRate).toHaveBeenCalledWith('country');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount: 190, listingFeeSnapshot: expect.objectContaining({ ratePercent: 0.1, baseAmount: 190, dueAmount: 190 }) }));
  });

  it.each([null, { ratePercent: 0.1, referencePrice: 190000, baseAmount: 190, dueAmount: 190 }])(
    'records actual payment after confirmation without reading a changed rate (snapshot: %j)', async (listingFeeSnapshot) => {
      const checkout = { _id: 'checkout', checkoutId: 'test-checkout', user: 'seller', product: product._id,
        amount: 190, purpose: 'LISTING_FEE_FUNDING', status: 'COMPLETED', paymentState: 'CONFIRMED',
        autoValidationState: 'FAILED', listingFeeSnapshot, save: vi.fn() };
      const listing = { ...product, listingFeeRequired: 5700, save: vi.fn() };
      vi.spyOn(PawaPayCheckout, 'findOne').mockResolvedValue(checkout);
      vi.spyOn(PawaPayCheckout, 'findOneAndUpdate').mockResolvedValue(checkout);
      vi.spyOn(PawaPayCheckout, 'findById').mockResolvedValue(checkout);
      vi.spyOn(Product, 'findById').mockReturnValue({ select: async () => listing });
      vi.spyOn(Payment, 'findOne').mockResolvedValue(null);
      const create = vi.spyOn(Payment, 'create').mockImplementation(async (data) => ({ ...data, _id: 'payment', save: vi.fn() }));
      vi.spyOn(User, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
      vi.spyOn(cache, 'invalidateProductCache').mockResolvedValue();
      getListingCommissionRate.mockResolvedValue(0);
      const req = { user: { role: 'admin' }, params: { checkoutId: 'test-checkout' } };
      const next = vi.fn();
      await retryPawaPayCheckoutCompletionAdmin(req, response(), next);
      expect(next).not.toHaveBeenCalled();
      expect(getListingCommissionRate).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountPaid: 190, amount: 190, paymentMethod: 'pawapay', commissionBaseAmount: 190 }));
      expect(listing).toMatchObject({ listingFeePaid: 190, listingFeeRequired: 190, listingFeeStatus: 'PAID', listingFeeRate: 0.001 });
      await retryPawaPayCheckoutCompletionAdmin(req, response(), next);
      expect(create).toHaveBeenCalledTimes(1);
    }
  );
});
