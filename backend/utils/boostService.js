import mongoose from 'mongoose';
import BoostPricing from '../models/boostPricingModel.js';
import SeasonalPricing from '../models/seasonalPricingModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';

export const BOOST_TYPES = Object.freeze({
  PRODUCT_BOOST: 'PRODUCT_BOOST',
  LOCAL_PRODUCT_BOOST: 'LOCAL_PRODUCT_BOOST',
  SHOP_BOOST: 'SHOP_BOOST',
  HOMEPAGE_FEATURED: 'HOMEPAGE_FEATURED'
});

export const BOOST_TYPE_VALUES = Object.freeze(Object.values(BOOST_TYPES));
export const BOOST_REQUEST_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED'
});

export const SUPPORTED_CITIES = Object.freeze([
  'Brazzaville',
  'Pointe-Noire',
  'Ouesso',
  'Oyo'
]);

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

export const normalizeBoostType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!BOOST_TYPE_VALUES.includes(normalized)) return '';
  return normalized;
};

export const normalizeBoostCity = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return SUPPORTED_CITIES.includes(normalized) ? normalized : null;
};

export const getActiveSeasonalCampaign = async ({ now = new Date(), boostType = null } = {}) => {
  const normalizedType = normalizeBoostType(boostType);
  const campaigns = await SeasonalPricing.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [{ appliesTo: { $size: 0 } }, ...(normalizedType ? [{ appliesTo: normalizedType }] : [])]
  })
    .sort({ multiplier: -1, updatedAt: -1 })
    .limit(1)
    .lean();
  return campaigns[0] || null;
};

export const resolveBoostPricing = async ({ boostType, city = null, includeInactive = false } = {}) => {
  const normalizedType = normalizeBoostType(boostType);
  if (!normalizedType) return null;
  const normalizedCity = normalizeBoostCity(city);
  const baseFilter = {
    type: normalizedType,
    ...(includeInactive ? {} : { isActive: true })
  };

  if (normalizedCity) {
    const cityPricing = await BoostPricing.findOne({
      ...baseFilter,
      city: normalizedCity
    })
      .sort({ updatedAt: -1 })
      .lean();
    if (cityPricing) return cityPricing;
  }

  return BoostPricing.findOne({
    ...baseFilter,
    city: null
  })
    .sort({ updatedAt: -1 })
    .lean();
};

const computeBillingUnits = ({ priceType, duration }) => {
  const safeDuration = Math.max(1, Number(duration || 1));
  if (priceType === 'per_day') return safeDuration;
  if (priceType === 'per_week') return Math.max(1, Math.ceil(safeDuration / 7));
  return 1;
};

export const calculateBoostPrice = ({
  boostType,
  duration,
  productCount = 0,
  pricing,
  seasonalMultiplier = 1
}) => {
  const normalizedType = normalizeBoostType(boostType);
  if (!normalizedType || !pricing) {
    return {
      billingUnits: 0,
      quantityFactor: 0,
      subtotal: 0,
      totalPrice: 0,
      unitPrice: 0,
      seasonalMultiplier: 1
    };
  }

  const safeSeasonalMultiplier =
    Number.isFinite(Number(seasonalMultiplier)) && Number(seasonalMultiplier) > 0
      ? Number(seasonalMultiplier)
      : 1;
  const safeBasePrice = Number(pricing.basePrice || 0);
  const safePricingMultiplier =
    Number.isFinite(Number(pricing.multiplier)) && Number(pricing.multiplier) > 0
      ? Number(pricing.multiplier)
      : 1;
  const unitPrice = Number((safeBasePrice * safePricingMultiplier).toFixed(2));
  const billingUnits = computeBillingUnits({
    priceType: pricing.priceType || 'fixed',
    duration
  });
  const safeProductCount = Math.max(1, Number(productCount || 1));

  let quantityFactor = billingUnits;
  if (
    normalizedType === BOOST_TYPES.PRODUCT_BOOST ||
    normalizedType === BOOST_TYPES.LOCAL_PRODUCT_BOOST
  ) {
    quantityFactor = billingUnits * safeProductCount;
  } else if (normalizedType === BOOST_TYPES.HOMEPAGE_FEATURED) {
    quantityFactor = 1;
  }

  const subtotal = Number((unitPrice * quantityFactor).toFixed(2));
  const totalPrice = Number((subtotal * safeSeasonalMultiplier).toFixed(2));

  return {
    billingUnits,
    quantityFactor,
    subtotal,
    totalPrice,
    unitPrice,
    seasonalMultiplier: safeSeasonalMultiplier
  };
};

const isRequestCurrentlyActive = (request, now = new Date()) => {
  if (!request || request.status !== BOOST_REQUEST_STATUSES.ACTIVE) return false;
  const startTime = request.startDate ? new Date(request.startDate).getTime() : null;
  const endTime = request.endDate ? new Date(request.endDate).getTime() : null;
  const nowTime = now.getTime();
  if (startTime && Number.isFinite(startTime) && startTime > nowTime) return false;
  if (endTime && Number.isFinite(endTime) && endTime < nowTime) return false;
  return true;
};

const getPriorityByType = ({ boostType, requestCity, userCity }) => {
  if (boostType === BOOST_TYPES.LOCAL_PRODUCT_BOOST) {
    if (!userCity || !requestCity) return null;
    return String(userCity).toLowerCase() === String(requestCity).toLowerCase() ? 0 : null;
  }
  if (boostType === BOOST_TYPES.PRODUCT_BOOST) return 1;
  if (boostType === BOOST_TYPES.SHOP_BOOST) return 2;
  if (boostType === BOOST_TYPES.HOMEPAGE_FEATURED) return 3;
  return null;
};

export const getBoostPriorityMaps = async ({
  productIds = [],
  sellerIds = [],
  userCity = null,
  now = new Date()
} = {}) => {
  const normalizedProductIds = Array.from(
    new Set((Array.isArray(productIds) ? productIds : []).map((id) => String(id || '')).filter(Boolean))
  );
  const normalizedSellerIds = Array.from(
    new Set((Array.isArray(sellerIds) ? sellerIds : []).map((id) => String(id || '')).filter(Boolean))
  );

  if (!normalizedProductIds.length && !normalizedSellerIds.length) {
    return { productBoostMap: new Map(), shopBoostMap: new Map() };
  }

  const queries = [];
  if (normalizedProductIds.length) {
    queries.push({ productIds: { $in: normalizedProductIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (normalizedSellerIds.length) {
    queries.push({
      boostType: BOOST_TYPES.SHOP_BOOST,
      sellerId: { $in: normalizedSellerIds.map((id) => new mongoose.Types.ObjectId(id)) }
    });
  }

  const activeRequests = await BoostRequest.find({
    status: BOOST_REQUEST_STATUSES.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: queries
  })
    .select('boostType productIds sellerId city')
    .lean();

  const productBoostMap = new Map();
  const shopBoostMap = new Map();
  const safeUserCity = normalizeBoostCity(userCity);

  activeRequests.forEach((request) => {
    if (!isRequestCurrentlyActive(request, now)) return;
    const priority = getPriorityByType({
      boostType: request.boostType,
      requestCity: request.city,
      userCity: safeUserCity
    });
    if (request.boostType === BOOST_TYPES.SHOP_BOOST) {
      const sellerKey = String(request.sellerId || '');
      if (sellerKey) {
        shopBoostMap.set(sellerKey, { priority: 2, requestId: String(request._id || '') });
      }
      return;
    }
    if (priority === null) return;
    const ids = Array.isArray(request.productIds) ? request.productIds : [];
    ids.forEach((productId) => {
      const key = String(productId || '');
      if (!key) return;
      const current = productBoostMap.get(key);
      if (!current || priority < current.priority) {
        productBoostMap.set(key, {
          priority,
          boostType: request.boostType,
          requestId: String(request._id || '')
        });
      }
    });
  });

  return { productBoostMap, shopBoostMap };
};

const syncLegacyBoostFlags = async ({ expiredRequests = [], now = new Date() } = {}) => {
  if (!Array.isArray(expiredRequests) || !expiredRequests.length) return;
  const productIds = new Set();
  const sellerIds = new Set();
  expiredRequests.forEach((request) => {
    const type = String(request.boostType || '');
    if (type === BOOST_TYPES.SHOP_BOOST && request.sellerId) {
      sellerIds.add(String(request.sellerId));
      return;
    }
    const ids = Array.isArray(request.productIds) ? request.productIds : [];
    ids.forEach((id) => id && productIds.add(String(id)));
  });

  const productIdList = Array.from(productIds).map((id) => new mongoose.Types.ObjectId(id));
  const sellerIdList = Array.from(sellerIds).map((id) => new mongoose.Types.ObjectId(id));

  if (productIdList.length) {
    const activeProductBoosts = await BoostRequest.aggregate([
      {
        $match: {
          status: BOOST_REQUEST_STATUSES.ACTIVE,
          startDate: { $lte: now },
          endDate: { $gte: now },
          productIds: { $in: productIdList }
        }
      },
      { $unwind: '$productIds' },
      { $match: { productIds: { $in: productIdList } } },
      {
        $group: {
          _id: '$productIds',
          maxEndDate: { $max: '$endDate' },
          maxStartDate: { $max: '$startDate' }
        }
      }
    ]);
    const activeMap = new Map(activeProductBoosts.map((item) => [String(item._id), item]));
    await Promise.all(
      productIdList.map(async (productId) => {
        const key = String(productId);
        const active = activeMap.get(key);
        if (active) {
          await Product.updateOne(
            { _id: productId },
            {
              $set: {
                boosted: true,
                boostScore: Date.now(),
                boostStartDate: active.maxStartDate || now,
                boostEndDate: active.maxEndDate || null
              }
            }
          );
          return;
        }
        await Product.updateOne(
          { _id: productId },
          {
            $set: {
              boosted: false,
              boostScore: 0,
              boostedBy: null,
              boostedAt: null,
              boostedByName: null,
              boostStartDate: null,
              boostEndDate: null
            }
          }
        );
      })
    );
  }

  if (sellerIdList.length) {
    const activeShopBoosts = await BoostRequest.aggregate([
      {
        $match: {
          status: BOOST_REQUEST_STATUSES.ACTIVE,
          boostType: BOOST_TYPES.SHOP_BOOST,
          sellerId: { $in: sellerIdList },
          startDate: { $lte: now },
          endDate: { $gte: now }
        }
      },
      {
        $group: {
          _id: '$sellerId',
          maxEndDate: { $max: '$endDate' },
          maxStartDate: { $max: '$startDate' }
        }
      }
    ]);
    const activeMap = new Map(activeShopBoosts.map((item) => [String(item._id), item]));
    await Promise.all(
      sellerIdList.map(async (sellerId) => {
        const key = String(sellerId);
        const active = activeMap.get(key);
        if (active) {
          await User.updateOne(
            { _id: sellerId },
            {
              $set: {
                shopBoosted: true,
                shopBoostScore: Date.now(),
                shopBoostStartDate: active.maxStartDate || now,
                shopBoostEndDate: active.maxEndDate || null
              }
            }
          );
          return;
        }
        await User.updateOne(
          { _id: sellerId },
          {
            $set: {
              shopBoosted: false,
              shopBoostScore: 0,
              shopBoostedBy: null,
              shopBoostedAt: null,
              shopBoostedByName: null,
              shopBoostStartDate: null,
              shopBoostEndDate: null
            }
          }
        );
      })
    );
  }
};

export const expireBoostRequests = async ({ now = new Date() } = {}) => {
  const expiredRequests = await BoostRequest.find({
    status: BOOST_REQUEST_STATUSES.ACTIVE,
    endDate: { $lt: now }
  })
    .select('_id boostType productIds sellerId')
    .lean();

  if (!expiredRequests.length) return 0;

  const ids = expiredRequests.map((item) => item._id);
  await BoostRequest.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        status: BOOST_REQUEST_STATUSES.EXPIRED
      }
    }
  );

  await syncLegacyBoostFlags({ expiredRequests, now });
  return ids.length;
};

export const buildBoostRequestResponse = (request) => {
  if (!request) return null;
  const impressions = Number(request.impressions || 0);
  const clicks = Number(request.clicks || 0);
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
  return {
    id: request._id,
    sellerId: request.sellerId,
    boostType: request.boostType,
    productIds: Array.isArray(request.productIds) ? request.productIds : [],
    city: request.city || null,
    duration: Number(request.duration || 0),
    unitPrice: Number(request.unitPrice || 0),
    basePrice: Number(request.basePrice || 0),
    priceType: request.priceType || 'fixed',
    pricingMultiplier: Number(request.pricingMultiplier || 1),
    seasonalMultiplier: Number(request.seasonalMultiplier || 1),
    seasonalCampaignId: request.seasonalCampaignId || null,
    seasonalCampaignName: request.seasonalCampaignName || '',
    totalPrice: Number(request.totalPrice || 0),
    paymentOperator: request.paymentOperator || '',
    paymentSenderName: request.paymentSenderName || '',
    paymentTransactionId: request.paymentTransactionId || '',
    paymentProofImage: request.paymentProofImage || null,
    status: request.status,
    startDate: request.startDate || null,
    endDate: request.endDate || null,
    impressions,
    clicks,
    ctr,
    rejectionReason: request.rejectionReason || '',
    approvedAt: request.approvedAt || null,
    rejectedAt: request.rejectedAt || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
};
