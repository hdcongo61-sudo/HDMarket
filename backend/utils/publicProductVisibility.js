import mongoose from 'mongoose';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';

const VERIFIED_PRODUCT_CACHE_TTL_MS = Math.max(
  15_000,
  Number(process.env.VERIFIED_PRODUCT_CACHE_TTL_MS || 60_000)
);

let cachedVerifiedProductIds = null;
let cachedAtMs = 0;
let inFlightPromise = null;

const normalizeObjectIds = (values = []) =>
  values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

export const invalidateVerifiedProductCache = () => {
  cachedVerifiedProductIds = null;
  cachedAtMs = 0;
};

export const getVerifiedProductIds = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  const hasFreshCache =
    !forceRefresh &&
    Array.isArray(cachedVerifiedProductIds) &&
    now - cachedAtMs < VERIFIED_PRODUCT_CACHE_TTL_MS;

  if (hasFreshCache) {
    return cachedVerifiedProductIds;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = Promise.all([
    Payment.distinct('product', { status: 'verified' }),
    Product.distinct('_id', { listingFeeSettled: true })
  ])
    .then(([paidIds, settledIds]) => {
      const normalized = normalizeObjectIds([...paidIds, ...settledIds]);
      cachedVerifiedProductIds = normalized;
      cachedAtMs = Date.now();
      return normalized;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
};

export const withVerifiedPublicProductFilter = async (baseFilter = {}) => {
  const verifiedProductIds = await getVerifiedProductIds();
  const verifiedConstraint = { _id: { $in: verifiedProductIds } };

  if (!baseFilter || Object.keys(baseFilter).length === 0) {
    return verifiedConstraint;
  }

  return { $and: [baseFilter, verifiedConstraint] };
};

export const hasVerifiedPaymentForProduct = async (paymentId) => {
  if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
    return false;
  }
  const found = await Payment.exists({ _id: paymentId, status: 'verified' });
  return Boolean(found);
};

// Listing fee settled for this product doc — via a verified Payment or the
// listingFeeSettled flag (waived/zero commission). Doc must include the
// `payment` and `listingFeeSettled` fields.
export const isListingFeeSettledForProduct = async (product) => {
  if (!product) return false;
  if (product.listingFeeSettled) return true;
  return hasVerifiedPaymentForProduct(product.payment);
};
