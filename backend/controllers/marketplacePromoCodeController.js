import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import MarketplacePromoCode from '../models/marketplacePromoCodeModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import {
  normalizeMarketplacePromoCode,
  previewMarketplacePromoForOrder
} from '../utils/marketplacePromoCodeService.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const isBoutiqueOwner = (user) =>
  Boolean(user && (user.accountType === 'shop' || user.role === 'boutique_owner'));

const ensureClientRole = (user) => {
  const role = String(user?.role || '');
  return !['admin', 'manager'].includes(role);
};

const parseDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} invalide.`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const getStartOfWeek = (date = new Date()) => {
  const target = new Date(date);
  const day = target.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + diff);
  return target;
};

const getEndOfWeek = (date = new Date()) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
};

const toPromoResponse = (promo, now = new Date()) => {
  const usageLimit = Number(promo.usageLimit || 0);
  const usedCount = Number(promo.usedCount || 0);
  const usageRemaining = Math.max(0, usageLimit - usedCount);
  const startDate = promo.startDate ? new Date(promo.startDate) : null;
  const endDate = promo.endDate ? new Date(promo.endDate) : null;
  const isExpired = endDate ? endDate < now : false;
  const isUpcoming = startDate ? startDate > now : false;

  return {
    id: promo._id,
    code: promo.code,
    boutiqueId: promo.boutiqueId,
    appliesTo: promo.appliesTo,
    productId: promo.productId || null,
    discountType: promo.discountType,
    discountValue: Number(promo.discountValue || 0),
    usageLimit,
    usedCount,
    usageRemaining,
    usageRate: usageLimit > 0 ? Number(((usedCount / usageLimit) * 100).toFixed(2)) : 0,
    startDate: promo.startDate,
    endDate: promo.endDate,
    isActive: Boolean(promo.isActive),
    isExpired,
    isUpcoming,
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt
  };
};

export const createMarketplacePromoCode = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const owner = await User.findById(userId).select('accountType role');
  if (!isBoutiqueOwner(owner)) {
    return res.status(403).json({ message: 'Seules les boutiques peuvent créer des codes promo.' });
  }

  const {
    code,
    appliesTo,
    productId,
    discountType,
    discountValue,
    usageLimit,
    startDate,
    endDate,
    isActive = true
  } = req.body;

  const normalizedCode = normalizeMarketplacePromoCode(code);
  if (!normalizedCode) {
    return res.status(400).json({ message: 'Le code promo est requis.' });
  }

  const startsAt = parseDate(startDate, 'startDate');
  const endsAt = parseDate(endDate, 'endDate');
  if (startsAt >= endsAt) {
    return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début.' });
  }

  const promoAppliesTo = appliesTo === 'product' ? 'product' : 'boutique';
  let productObjectId = null;
  if (promoAppliesTo === 'product') {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'productId invalide.' });
    }
    const product = await Product.findOne({ _id: productId, user: userId }).select('_id');
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable pour cette boutique.' });
    }
    productObjectId = product._id;
  }

  const existing = await MarketplacePromoCode.findOne({
    boutiqueId: userId,
    code: normalizedCode
  })
    .select('_id')
    .lean();
  if (existing) {
    return res.status(409).json({ message: 'Ce code existe déjà pour votre boutique.' });
  }

  const promo = await MarketplacePromoCode.create({
    code: normalizedCode,
    boutiqueId: userId,
    appliesTo: promoAppliesTo,
    productId: productObjectId,
    discountType,
    discountValue,
    usageLimit,
    usedBy: [],
    usedCount: 0,
    startDate: startsAt,
    endDate: endsAt,
    isActive: Boolean(isActive)
  });

  res.status(201).json({
    message: 'Code promo créé.',
    promoCode: toPromoResponse(promo)
  });
});

export const listMyMarketplacePromoCodes = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const owner = await User.findById(userId).select('accountType role');
  if (!isBoutiqueOwner(owner)) {
    return res.status(403).json({ message: 'Accès boutique requis.' });
  }

  const { page = 1, limit = DEFAULT_PAGE_SIZE, status = 'all', search = '' } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_PAGE_SIZE));
  const now = new Date();

  const filter = { boutiqueId: userId };
  const searchTerm = String(search || '').trim();
  if (searchTerm) {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.code = { $regex: escaped, $options: 'i' };
  }

  if (status === 'active') {
    filter.isActive = true;
    filter.startDate = { $lte: now };
    filter.endDate = { $gte: now };
  } else if (status === 'inactive') {
    filter.isActive = false;
  } else if (status === 'expired') {
    filter.endDate = { $lt: now };
  } else if (status === 'upcoming') {
    filter.startDate = { $gt: now };
  }

  const [items, total] = await Promise.all([
    MarketplacePromoCode.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('productId', 'title slug')
      .lean(),
    MarketplacePromoCode.countDocuments(filter)
  ]);

  res.json({
    items: items.map((item) => toPromoResponse(item, now)),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const updateMyMarketplacePromoCode = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const owner = await User.findById(userId).select('accountType role');
  if (!isBoutiqueOwner(owner)) {
    return res.status(403).json({ message: 'Accès boutique requis.' });
  }

  const promo = await MarketplacePromoCode.findOne({ _id: req.params.id, boutiqueId: userId });
  if (!promo) {
    return res.status(404).json({ message: 'Code promo introuvable.' });
  }

  const {
    code,
    appliesTo,
    productId,
    discountType,
    discountValue,
    usageLimit,
    startDate,
    endDate,
    isActive
  } = req.body;

  if (typeof code !== 'undefined') {
    const normalizedCode = normalizeMarketplacePromoCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: 'Code promo invalide.' });
    }
    const duplicate = await MarketplacePromoCode.findOne({
      _id: { $ne: promo._id },
      boutiqueId: userId,
      code: normalizedCode
    })
      .select('_id')
      .lean();
    if (duplicate) {
      return res.status(409).json({ message: 'Ce code existe déjà pour votre boutique.' });
    }
    promo.code = normalizedCode;
  }

  if (typeof discountType !== 'undefined') promo.discountType = discountType;
  if (typeof discountValue !== 'undefined') promo.discountValue = discountValue;
  if (typeof usageLimit !== 'undefined') promo.usageLimit = usageLimit;
  if (typeof isActive === 'boolean') promo.isActive = isActive;

  if (typeof appliesTo !== 'undefined') {
    promo.appliesTo = appliesTo === 'product' ? 'product' : 'boutique';
  }

  if (promo.appliesTo === 'product') {
    const resolvedProductId = productId ?? promo.productId;
    if (!resolvedProductId || !mongoose.Types.ObjectId.isValid(resolvedProductId)) {
      return res.status(400).json({ message: 'productId requis pour un code produit.' });
    }
    const product = await Product.findOne({ _id: resolvedProductId, user: userId }).select('_id');
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable pour cette boutique.' });
    }
    promo.productId = product._id;
  } else {
    promo.productId = null;
  }

  if (typeof startDate !== 'undefined') promo.startDate = parseDate(startDate, 'startDate');
  if (typeof endDate !== 'undefined') promo.endDate = parseDate(endDate, 'endDate');
  if (promo.startDate >= promo.endDate) {
    return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début.' });
  }

  await promo.save();

  res.json({
    message: 'Code promo mis à jour.',
    promoCode: toPromoResponse(promo)
  });
});

export const toggleMyMarketplacePromoCode = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const owner = await User.findById(userId).select('accountType role');
  if (!isBoutiqueOwner(owner)) {
    return res.status(403).json({ message: 'Accès boutique requis.' });
  }

  const { isActive } = req.body;
  const promo = await MarketplacePromoCode.findOne({ _id: req.params.id, boutiqueId: userId });
  if (!promo) {
    return res.status(404).json({ message: 'Code promo introuvable.' });
  }

  promo.isActive = Boolean(isActive);
  await promo.save();

  res.json({
    message: promo.isActive ? 'Code promo activé.' : 'Code promo désactivé.',
    promoCode: toPromoResponse(promo)
  });
});

export const getMyMarketplacePromoAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const owner = await User.findById(userId).select('accountType role');
  if (!isBoutiqueOwner(owner)) {
    return res.status(403).json({ message: 'Accès boutique requis.' });
  }

  const boutiqueObjectId = toObjectId(userId);
  const now = new Date();

  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const [overview, orderImpact, totalOrders, clientAcquisition, topCodes, monthlyRanking] = await Promise.all([
    MarketplacePromoCode.aggregate([
      { $match: { boutiqueId: boutiqueObjectId } },
      {
        $group: {
          _id: null,
          totalCodes: { $sum: 1 },
          activeCodes: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $lte: ['$startDate', now] },
                    { $gte: ['$endDate', now] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalUsage: { $sum: '$usedCount' }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          'items.snapshot.shopId': boutiqueObjectId,
          'appliedPromoCode.code': { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: null,
          promoOrders: { $sum: 1 },
          revenueImpact: { $sum: { $ifNull: ['$appliedPromoCode.discountAmount', 0] } },
          promoRevenueTotal: { $sum: { $ifNull: ['$totalAmount', 0] } },
          uniquePromoClientsSet: { $addToSet: '$customer' }
        }
      }
    ]),
    Order.countDocuments({
      isDraft: { $ne: true },
      'items.snapshot.shopId': boutiqueObjectId
    }),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          'items.snapshot.shopId': boutiqueObjectId
        }
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$customer',
          firstOrderWithPromo: {
            $first: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$appliedPromoCode.code', null] },
                    { $ne: ['$appliedPromoCode.code', ''] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalClients: { $sum: 1 },
          acquiredViaPromo: { $sum: '$firstOrderWithPromo' }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          'items.snapshot.shopId': boutiqueObjectId,
          'appliedPromoCode.code': { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$appliedPromoCode.code',
          usage: { $sum: 1 },
          discountAmount: { $sum: { $ifNull: ['$appliedPromoCode.discountAmount', 0] } }
        }
      },
      { $sort: { usage: -1, discountAmount: -1 } },
      { $limit: 5 }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          createdAt: { $gte: monthStart, $lt: monthEnd },
          'appliedPromoCode.discountAmount': { $gt: 0 },
          'appliedPromoCode.boutiqueId': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$appliedPromoCode.boutiqueId',
          totalDiscount: { $sum: { $ifNull: ['$appliedPromoCode.discountAmount', 0] } },
          promoOrders: { $sum: 1 }
        }
      },
      { $sort: { totalDiscount: -1, promoOrders: -1 } }
    ])
  ]);

  const summary = overview[0] || { totalCodes: 0, activeCodes: 0, totalUsage: 0 };
  const impact = orderImpact[0] || {
    promoOrders: 0,
    revenueImpact: 0,
    promoRevenueTotal: 0,
    uniquePromoClientsSet: []
  };
  const acquisition = clientAcquisition[0] || { totalClients: 0, acquiredViaPromo: 0 };
  const promoOrders = Number(impact.promoOrders || 0);
  const totalOrderCount = Number(totalOrders || 0);
  const conversionRate = totalOrderCount > 0 ? Number(((promoOrders / totalOrderCount) * 100).toFixed(2)) : 0;
  const uniquePromoClients = Array.isArray(impact.uniquePromoClientsSet)
    ? impact.uniquePromoClientsSet.length
    : 0;
  const rank = monthlyRanking.findIndex((entry) => String(entry._id) === String(userId));
  const monthlyEntry = rank >= 0 ? monthlyRanking[rank] : null;
  const isMostGenerousOfMonth = rank === 0 && Number(monthlyEntry?.totalDiscount || 0) > 0;

  res.json({
    overview: {
      totalCodes: Number(summary.totalCodes || 0),
      activeCodes: Number(summary.activeCodes || 0),
      totalUsage: Number(summary.totalUsage || 0),
      promoOrders,
      revenueImpact: Number((impact.revenueImpact || 0).toFixed(2))
    },
    metrics: {
      promoRevenueTotal: Number((impact.promoRevenueTotal || 0).toFixed(2)),
      clientsAcquiredViaPromo: Number(acquisition.acquiredViaPromo || 0),
      totalClients: Number(acquisition.totalClients || 0),
      uniquePromoClients,
      totalOrders: totalOrderCount,
      promoOrders,
      conversionRate
    },
    gamification: {
      badge: isMostGenerousOfMonth ? 'Boutique la plus généreuse du mois' : '',
      isMostGenerousOfMonth,
      month: monthStart.toISOString(),
      rank: rank >= 0 ? rank + 1 : null,
      totalParticipants: Number(monthlyRanking.length || 0),
      discountGivenThisMonth: Number((monthlyEntry?.totalDiscount || 0).toFixed(2))
    },
    topCodes: topCodes.map((entry) => ({
      code: entry._id,
      usage: Number(entry.usage || 0),
      discountAmount: Number((entry.discountAmount || 0).toFixed(2))
    }))
  });
});

export const getMarketplacePromoHomeData = asyncHandler(async (req, res) => {
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = getEndOfWeek(now);
  const shopLimit = Math.max(1, Math.min(Number(req.query?.shopLimit) || 8, 20));
  const flashLimit = Math.max(1, Math.min(Number(req.query?.flashLimit) || 8, 20));

  const [shopPromos, productPromos, boutiquePromos] = await Promise.all([
    MarketplacePromoCode.aggregate([
      {
        $match: {
          isActive: true,
          startDate: { $lte: weekEnd },
          endDate: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: '$boutiqueId',
          promoCountThisWeek: { $sum: 1 },
          activePromoCountNow: {
            $sum: {
              $cond: [
                {
                  $and: [{ $lte: ['$startDate', now] }, { $gte: ['$endDate', now] }]
                },
                1,
                0
              ]
            }
          },
          maxDiscountValue: { $max: '$discountValue' },
          nextEndingAt: { $min: '$endDate' }
        }
      },
      { $sort: { activePromoCountNow: -1, promoCountThisWeek: -1, nextEndingAt: 1 } },
      { $limit: shopLimit * 2 }
    ]),
    MarketplacePromoCode.find({
      isActive: true,
      appliesTo: 'product',
      startDate: { $lte: now },
      endDate: { $gte: now },
      productId: { $ne: null }
    })
      .select('code discountType discountValue endDate startDate productId boutiqueId appliesTo')
      .sort({ endDate: 1, createdAt: -1 })
      .limit(flashLimit * 3)
      .lean(),
    MarketplacePromoCode.find({
      isActive: true,
      appliesTo: 'boutique',
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .select('code discountType discountValue endDate startDate boutiqueId appliesTo')
      .sort({ endDate: 1, createdAt: -1 })
      .limit(flashLimit * 2)
      .lean()
  ]);

  const shopIds = Array.from(new Set(shopPromos.map((entry) => String(entry._id))));
  const shopObjectIds = shopIds.map((id) => new mongoose.Types.ObjectId(id));
  const [shopDocs, productCounts] = await Promise.all([
    User.find({
      _id: { $in: shopObjectIds },
      $or: [{ accountType: 'shop' }, { role: 'boutique_owner' }],
      isBlocked: { $ne: true }
    })
      .select('name shopName shopLogo shopAddress shopVerified slug role accountType')
      .lean(),
    Product.aggregate([
      {
        $match: {
          user: { $in: shopObjectIds },
          status: 'approved'
        }
      },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ])
  ]);

  const productCountMap = new Map(productCounts.map((entry) => [String(entry._id), Number(entry.count || 0)]));
  const shopMap = new Map(shopDocs.map((shop) => [String(shop._id), shop]));
  const promoShops = shopPromos
    .map((entry) => {
      const shop = shopMap.get(String(entry._id));
      if (!shop) return null;
      return {
        _id: shop._id,
        slug: shop.slug || null,
        shopName: shop.shopName || shop.name || 'Boutique',
        shopLogo: shop.shopLogo || null,
        shopAddress: shop.shopAddress || '',
        shopVerified: Boolean(shop.shopVerified),
        productCount: productCountMap.get(String(shop._id)) || 0,
        promoCountThisWeek: Number(entry.promoCountThisWeek || 0),
        activePromoCountNow: Number(entry.activePromoCountNow || 0),
        maxDiscountValue: Number(entry.maxDiscountValue || 0),
        nextEndingAt: entry.nextEndingAt || null
      };
    })
    .filter(Boolean)
    .slice(0, shopLimit);

  const candidateProductIds = Array.from(
    new Set(productPromos.map((promo) => String(promo.productId)).filter(Boolean))
  );
  const boutiqueIds = Array.from(
    new Set(boutiquePromos.map((promo) => String(promo.boutiqueId)).filter(Boolean))
  );

  const [productPromoProducts, boutiqueProducts] = await Promise.all([
    candidateProductIds.length
      ? Product.find({ _id: { $in: candidateProductIds }, status: 'approved' })
          .select('title price priceBeforeDiscount discount images user slug category condition')
          .populate('user', 'name shopName shopLogo slug accountType')
          .lean()
      : [],
    boutiqueIds.length
      ? Product.aggregate([
          {
            $match: {
              status: 'approved',
              user: { $in: boutiqueIds.map((id) => new mongoose.Types.ObjectId(id)) }
            }
          },
          { $sort: { discount: -1, createdAt: -1 } },
          {
            $group: {
              _id: '$user',
              product: { $first: '$$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: '$product' } },
          { $limit: flashLimit * 2 }
        ])
      : []
  ]);

  const productById = new Map(productPromoProducts.map((product) => [String(product._id), product]));
  const boutiqueProductByShopId = new Map(boutiqueProducts.map((product) => [String(product.user), product]));

  const computePromoPrice = (price, promo) => {
    const base = Number(price || 0);
    if (!promo) return base;
    if (promo.discountType === 'percentage') {
      return Number((base * (1 - Number(promo.discountValue || 0) / 100)).toFixed(2));
    }
    return Number(Math.max(0, base - Number(promo.discountValue || 0)).toFixed(2));
  };

  const flashCandidates = [];
  productPromos.forEach((promo) => {
    const product = productById.get(String(promo.productId));
    if (!product) return;
    const promoPrice = computePromoPrice(product.price, promo);
    flashCandidates.push({
      ...product,
      promoPrice,
      promoSavedAmount: Number((Number(product.price || 0) - promoPrice).toFixed(2)),
      flashPromo: {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue || 0),
        startDate: promo.startDate,
        endDate: promo.endDate,
        appliesTo: promo.appliesTo
      }
    });
  });

  boutiquePromos.forEach((promo) => {
    const product = boutiqueProductByShopId.get(String(promo.boutiqueId));
    if (!product) return;
    const promoPrice = computePromoPrice(product.price, promo);
    flashCandidates.push({
      ...product,
      promoPrice,
      promoSavedAmount: Number((Number(product.price || 0) - promoPrice).toFixed(2)),
      flashPromo: {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue || 0),
        startDate: promo.startDate,
        endDate: promo.endDate,
        appliesTo: promo.appliesTo
      }
    });
  });

  const seenProducts = new Set();
  const flashDeals = flashCandidates
    .sort((a, b) => {
      const aEnd = new Date(a.flashPromo?.endDate || 0).getTime();
      const bEnd = new Date(b.flashPromo?.endDate || 0).getTime();
      if (aEnd !== bEnd) return aEnd - bEnd;
      return Number(b.promoSavedAmount || 0) - Number(a.promoSavedAmount || 0);
    })
    .filter((product) => {
      const key = String(product._id);
      if (seenProducts.has(key)) return false;
      seenProducts.add(key);
      return true;
    })
    .slice(0, flashLimit);

  res.json({
    generatedAt: now.toISOString(),
    weekRange: {
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString()
    },
    promoShops,
    flashDeals
  });
});

export const previewMarketplacePromoCode = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const client = await User.findById(userId).select('role accountType');
  if (!client || !ensureClientRole(client)) {
    return res.status(403).json({ message: 'Seuls les clients peuvent utiliser les codes promo.' });
  }

  const { code, productId, quantity, items } = req.body;

  let previewItems = [];
  let boutiqueId = null;
  if (Array.isArray(items) && items.length > 0) {
    const normalizedItems = items
      .map((item) => ({
        productId: item?.productId,
        quantity: Number(item?.quantity || 1)
      }))
      .filter((item) => mongoose.Types.ObjectId.isValid(item.productId));

    if (!normalizedItems.length) {
      return res.status(400).json({ message: 'Aucun produit valide transmis.' });
    }

    const productDocs = await Product.find({
      _id: { $in: normalizedItems.map((item) => item.productId) },
      status: 'approved'
    }).select('_id user price');

    if (!productDocs.length) {
      return res.status(404).json({ message: 'Produits introuvables.' });
    }
    const byId = new Map(productDocs.map((doc) => [String(doc._id), doc]));
    const sellerIds = Array.from(new Set(productDocs.map((doc) => String(doc.user))));
    if (sellerIds.length !== 1) {
      return res.status(400).json({ message: 'Le preview promo doit cibler une seule boutique.' });
    }
    boutiqueId = sellerIds[0];

    previewItems = normalizedItems
      .map((item) => {
        const product = byId.get(String(item.productId));
        if (!product) return null;
        return {
          product: product._id,
          quantity: Math.max(1, Number(item.quantity || 1)),
          unitPrice: Number(product.price || 0)
        };
      })
      .filter(Boolean);
  } else {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Produit invalide.' });
    }
    const product = await Product.findOne({ _id: productId, status: 'approved' }).select('user price');
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable.' });
    }
    boutiqueId = product.user;
    previewItems = [
      {
        product: productId,
        quantity: Math.max(1, Number(quantity || 1)),
        unitPrice: Number(product.price || 0)
      }
    ];
  }

  const preview = await previewMarketplacePromoForOrder({
    code,
    boutiqueId,
    clientId: userId,
    items: previewItems
  });

  if (!preview.valid) {
    return res.status(400).json({
      valid: false,
      message: preview.message,
      reason: preview.reason,
      pricing: preview.pricing
    });
  }

  res.json({
    valid: true,
    message: preview.message,
    promo: preview.promo,
    pricing: preview.pricing
  });
});
