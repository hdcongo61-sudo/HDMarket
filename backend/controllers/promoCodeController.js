import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import PromoCode from '../models/promoCodeModel.js';
import PromoCodeUsage from '../models/promoCodeUsageModel.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import { 
  calculateCommissionBreakdown,
  generateRandomPromoCode,
  normalizePromoCode,
  serializePromoCodeSummary
} from '../utils/promoCodeUtils.js';
import { findPromoCodeByCode, previewPromoForSeller } from '../utils/promoCodeService.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ensureAdmin = (req) => {
  if (req.user?.role !== 'admin') {
    const error = new Error('Seuls les administrateurs peuvent gérer les codes promo.');
    error.status = 403;
    throw error;
  }
};

const parseDateInput = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} invalide.`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

const computePromoDates = ({ startDate, endDate, isFlashPromo, flashDurationHours }) => {
  const startsAt = parseDateInput(startDate, 'startDate');
  let endsAt = endDate ? parseDateInput(endDate, 'endDate') : null;

  if (!endsAt && isFlashPromo && Number(flashDurationHours || 0) > 0) {
    endsAt = new Date(startsAt.getTime() + Number(flashDurationHours) * 60 * 60 * 1000);
  }

  if (!endsAt) {
    const error = new Error('endDate est requis.');
    error.status = 400;
    throw error;
  }

  if (startsAt.getTime() >= endsAt.getTime()) {
    const error = new Error('endDate doit être après startDate.');
    error.status = 400;
    throw error;
  }

  return { startsAt, endsAt };
};

const buildPromoCodeResponse = (promo) => {
  if (!promo) return null;
  const now = new Date();
  const startsAt = new Date(promo.startDate);
  const endsAt = new Date(promo.endDate);
  const isExpired = endsAt.getTime() < now.getTime();
  const isUpcoming = startsAt.getTime() > now.getTime();
  const usageLimit = Number(promo.usageLimit || 0);
  const usedCount = Number(promo.usedCount || 0);
  const usageRemaining = Math.max(0, usageLimit - usedCount);

  return {
    ...serializePromoCodeSummary(promo),
    usageRemaining,
    usageRate: usageLimit > 0 ? Number(((usedCount / usageLimit) * 100).toFixed(2)) : 0,
    isExpired,
    isUpcoming,
    totalCommissionWaived: Number(promo.totalCommissionWaived || 0),
    createdBy: promo.createdBy || null,
    updatedBy: promo.updatedBy || null,
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
    deactivatedAt: promo.deactivatedAt || null,
    deactivatedReason: promo.deactivatedReason || null
  };
};

const getUniqueGeneratedCode = async ({ codePrefix, codeLength }) => {
  const normalizedPrefix = normalizePromoCode(codePrefix || '');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateRandomPromoCode({ length: codeLength, prefix: normalizedPrefix });
    // eslint-disable-next-line no-await-in-loop
    const exists = await PromoCode.exists({ code: candidate });
    if (!exists) {
      return candidate;
    }
  }

  const error = new Error('Impossible de générer un code promo unique.');
  error.status = 500;
  throw error;
};

const calculateSellerPromoEligibilityScore = async (sellerId) => {
  const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

  const [paymentsAgg, productsAgg, usagesCount] = await Promise.all([
    Payment.aggregate([
      { $match: { user: sellerObjectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$status', 'verified'] }, 1, 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
            }
          }
        }
      }
    ]),
    Product.aggregate([
      { $match: { user: sellerObjectId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          approvedProducts: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, 1, 0]
            }
          }
        }
      }
    ]),
    PromoCodeUsage.countDocuments({ seller: sellerObjectId })
  ]);

  const paymentSummary = paymentsAgg[0] || { total: 0, verified: 0, rejected: 0 };
  const productSummary = productsAgg[0] || { totalProducts: 0, approvedProducts: 0 };

  const verificationRate = paymentSummary.total
    ? paymentSummary.verified / paymentSummary.total
    : 0.5;
  const rejectionRate = paymentSummary.total
    ? paymentSummary.rejected / paymentSummary.total
    : 0;
  const approvalRate = productSummary.totalProducts
    ? productSummary.approvedProducts / productSummary.totalProducts
    : 0.5;

  let score = 55;
  score += Math.round(verificationRate * 25);
  score += Math.round(approvalRate * 20);
  score -= Math.round(rejectionRate * 25);
  score -= Math.min(10, Number(usagesCount || 0));

  score = Math.max(0, Math.min(100, score));

  let tier = 'high_risk';
  if (score >= 75) tier = 'trusted';
  else if (score >= 50) tier = 'standard';

  return {
    score,
    tier,
    metrics: {
      verifiedPayments: Number(paymentSummary.verified || 0),
      rejectedPayments: Number(paymentSummary.rejected || 0),
      totalPayments: Number(paymentSummary.total || 0),
      approvedProducts: Number(productSummary.approvedProducts || 0),
      totalProducts: Number(productSummary.totalProducts || 0),
      promoUsages: Number(usagesCount || 0)
    }
  };
};

export const createPromoCode = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const {
    code,
    discountType,
    discountValue,
    usageLimit,
    startDate,
    endDate,
    isActive = true,
    autoGenerate = false,
    codePrefix,
    codeLength,
    referralTag = '',
    isFlashPromo = false,
    flashDurationHours = null
  } = req.body;

  let promoCodeValue = normalizePromoCode(code);
  if (autoGenerate || !promoCodeValue) {
    promoCodeValue = await getUniqueGeneratedCode({ codePrefix, codeLength });
  }

  const existing = await findPromoCodeByCode(promoCodeValue, { lean: true, select: '_id' });
  if (existing) {
    return res.status(409).json({ message: 'Ce code promo existe déjà.' });
  }

  const { startsAt, endsAt } = computePromoDates({
    startDate,
    endDate,
    isFlashPromo,
    flashDurationHours
  });

  const promo = await PromoCode.create({
    code: promoCodeValue,
    discountType,
    discountValue,
    usageLimit,
    startDate: startsAt,
    endDate: endsAt,
    isActive,
    autoGenerated: Boolean(autoGenerate),
    referralTag: String(referralTag || '').trim(),
    isFlashPromo: Boolean(isFlashPromo),
    flashDurationHours: flashDurationHours || null,
    createdBy: req.user.id,
    updatedBy: req.user.id,
    deactivatedAt: isActive ? null : new Date(),
    deactivatedReason: isActive ? null : 'manual'
  });

  res.status(201).json({
    message: 'Code promo créé avec succès.',
    promoCode: buildPromoCodeResponse(promo)
  });
});

export const listPromoCodesAdmin = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    status = 'all',
    search = '',
    sort = 'recent'
  } = req.query;

  const now = new Date();
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_PAGE_SIZE));

  const filter = {};
  const trimmedSearch = String(search || '').trim();

  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const sortMap = {
    recent: { createdAt: -1 },
    oldest: { createdAt: 1 },
    usage_desc: { usedCount: -1, createdAt: -1 },
    ending_soon: { endDate: 1, createdAt: -1 }
  };

  const [items, total] = await Promise.all([
    PromoCode.find(filter)
      .sort(sortMap[sort] || sortMap.recent)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean(),
    PromoCode.countDocuments(filter)
  ]);

  res.json({
    items: items.map((item) => buildPromoCodeResponse(item)),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const updatePromoCode = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const promo = await PromoCode.findById(req.params.id);
  if (!promo) {
    return res.status(404).json({ message: 'Code promo introuvable.' });
  }

  const {
    code,
    discountType,
    discountValue,
    usageLimit,
    startDate,
    endDate,
    isActive,
    referralTag,
    isFlashPromo,
    flashDurationHours
  } = req.body;

  if (typeof code !== 'undefined') {
    const normalizedCode = normalizePromoCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: 'Code promo invalide.' });
    }
    const duplicate = await PromoCode.findOne({ code: normalizedCode, _id: { $ne: promo._id } })
      .select('_id')
      .lean();
    if (duplicate) {
      return res.status(409).json({ message: 'Ce code promo existe déjà.' });
    }
    promo.code = normalizedCode;
  }

  if (typeof discountType !== 'undefined') promo.discountType = discountType;
  if (typeof discountValue !== 'undefined') promo.discountValue = discountValue;
  if (typeof usageLimit !== 'undefined') promo.usageLimit = usageLimit;
  if (typeof referralTag !== 'undefined') promo.referralTag = String(referralTag || '').trim();
  if (typeof isFlashPromo !== 'undefined') promo.isFlashPromo = Boolean(isFlashPromo);
  if (typeof flashDurationHours !== 'undefined') promo.flashDurationHours = flashDurationHours || null;

  const shouldRecomputeDates =
    typeof startDate !== 'undefined' ||
    typeof endDate !== 'undefined' ||
    typeof isFlashPromo !== 'undefined' ||
    typeof flashDurationHours !== 'undefined';

  if (shouldRecomputeDates) {
    const { startsAt, endsAt } = computePromoDates({
      startDate: typeof startDate !== 'undefined' ? startDate : promo.startDate,
      endDate: typeof endDate !== 'undefined' ? endDate : promo.endDate,
      isFlashPromo: typeof isFlashPromo !== 'undefined' ? isFlashPromo : promo.isFlashPromo,
      flashDurationHours:
        typeof flashDurationHours !== 'undefined' ? flashDurationHours : promo.flashDurationHours
    });
    promo.startDate = startsAt;
    promo.endDate = endsAt;
  }

  if (typeof isActive === 'boolean') {
    promo.isActive = isActive;
    promo.deactivatedAt = isActive ? null : new Date();
    promo.deactivatedReason = isActive ? null : 'manual';
  }

  promo.updatedBy = req.user.id;

  await promo.save();

  res.json({
    message: 'Code promo mis à jour.',
    promoCode: buildPromoCodeResponse(promo)
  });
});

export const togglePromoCodeStatus = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const { isActive } = req.body;
  const promo = await PromoCode.findById(req.params.id);
  if (!promo) {
    return res.status(404).json({ message: 'Code promo introuvable.' });
  }

  promo.isActive = Boolean(isActive);
  promo.updatedBy = req.user.id;
  promo.deactivatedAt = promo.isActive ? null : new Date();
  promo.deactivatedReason = promo.isActive ? null : 'manual';

  await promo.save();

  res.json({
    message: promo.isActive ? 'Code promo activé.' : 'Code promo désactivé.',
    promoCode: buildPromoCodeResponse(promo)
  });
});

export const validatePromoCodeForSeller = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { code, productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const product = await Product.findById(productId).select('_id user price title');
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable.' });
  }
  if (String(product.user) !== String(userId) && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const [promoPreview, eligibility] = await Promise.all([
    previewPromoForSeller({ code, sellerId: userId, productPrice: product.price }),
    calculateSellerPromoEligibilityScore(userId)
  ]);

  if (!promoPreview.valid) {
    return res.status(400).json({
      valid: false,
      message: promoPreview.message,
      reason: promoPreview.reason,
      commission: promoPreview.commission,
      sellerEligibility: eligibility
    });
  }

  return res.json({
    valid: true,
    message: promoPreview.message,
    promoCode: promoPreview.promo,
    commission: promoPreview.commission,
    sellerEligibility: eligibility
  });
});

export const getPromoCodeAnalytics = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalCodes,
    activeCodes,
    inactiveCodes,
    expiredCodes,
    upcomingCodes,
    flashPromoCodes,
    totalUsage,
    totalsAgg,
    topCodes,
    referralPerformance,
    newSellerAcquisition
  ] = await Promise.all([
    PromoCode.countDocuments(),
    PromoCode.countDocuments({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }),
    PromoCode.countDocuments({ isActive: false }),
    PromoCode.countDocuments({ endDate: { $lt: now } }),
    PromoCode.countDocuments({ startDate: { $gt: now } }),
    PromoCode.countDocuments({ isFlashPromo: true }),
    PromoCodeUsage.countDocuments(),
    PromoCodeUsage.aggregate([
      {
        $group: {
          _id: null,
          totalCommissionBase: { $sum: '$baseCommissionAmount' },
          totalCommissionDiscounted: { $sum: '$discountAmount' },
          totalCommissionDue: { $sum: '$commissionDueAmount' }
        }
      }
    ]),
    PromoCodeUsage.aggregate([
      {
        $group: {
          _id: '$promoCode',
          usageCount: { $sum: 1 },
          commissionDiscounted: { $sum: '$discountAmount' },
          commissionBase: { $sum: '$baseCommissionAmount' },
          commissionDue: { $sum: '$commissionDueAmount' },
          lastUsedAt: { $max: '$createdAt' }
        }
      },
      { $sort: { usageCount: -1, commissionDiscounted: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'promocodes',
          localField: '_id',
          foreignField: '_id',
          as: 'promo'
        }
      },
      { $unwind: { path: '$promo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          promoCodeId: '$_id',
          code: '$promo.code',
          discountType: '$promo.discountType',
          discountValue: '$promo.discountValue',
          usageCount: 1,
          commissionDiscounted: 1,
          commissionBase: 1,
          commissionDue: 1,
          lastUsedAt: 1,
          usageLimit: '$promo.usageLimit',
          referralTag: '$promo.referralTag'
        }
      }
    ]),
    PromoCodeUsage.aggregate([
      {
        $match: {
          referralTag: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$referralTag',
          usageCount: { $sum: 1 },
          commissionDiscounted: { $sum: '$discountAmount' }
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 }
    ]),
    PromoCodeUsage.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'seller',
          foreignField: '_id',
          as: 'sellerInfo'
        }
      },
      { $unwind: { path: '$sellerInfo', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          isNewSeller: {
            $lte: [
              { $subtract: ['$createdAt', '$sellerInfo.createdAt'] },
              1000 * 60 * 60 * 24 * 30
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPromoUsers: { $addToSet: '$seller' },
          newPromoUsers: {
            $addToSet: {
              $cond: ['$isNewSeller', '$seller', '$$REMOVE']
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalPromoUsers: { $size: '$totalPromoUsers' },
          newPromoUsers: { $size: '$newPromoUsers' }
        }
      }
    ])
  ]);

  const totals = totalsAgg[0] || {
    totalCommissionBase: 0,
    totalCommissionDiscounted: 0,
    totalCommissionDue: 0
  };

  const sellerAcq = newSellerAcquisition[0] || { totalPromoUsers: 0, newPromoUsers: 0 };
  const newSellerAcquisitionRate = sellerAcq.totalPromoUsers
    ? Number(((sellerAcq.newPromoUsers / sellerAcq.totalPromoUsers) * 100).toFixed(2))
    : 0;

  const usageLast30Days = await PromoCodeUsage.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

  res.json({
    overview: {
      totalCodes,
      activeCodes,
      inactiveCodes,
      expiredCodes,
      upcomingCodes,
      flashPromoCodes,
      totalUsage,
      usageLast30Days,
      totalCommissionBase: Number(totals.totalCommissionBase || 0),
      totalCommissionWaived: Number(totals.totalCommissionDiscounted || 0),
      totalCommissionStillDue: Number(totals.totalCommissionDue || 0),
      revenueImpact: Number(totals.totalCommissionDiscounted || 0),
      newSellerAcquisitionRate
    },
    topCodes: topCodes.map((item) => ({
      ...item,
      usageRate:
        Number(item.usageLimit || 0) > 0
          ? Number(((Number(item.usageCount || 0) / Number(item.usageLimit || 0)) * 100).toFixed(2))
          : 0
    })),
    referralPerformance: referralPerformance.map((entry) => ({
      referralTag: entry._id,
      usageCount: Number(entry.usageCount || 0),
      commissionDiscounted: Number(entry.commissionDiscounted || 0)
    }))
  });
});

export const getPromoCodeUsageHistory = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const { page = 1, limit = DEFAULT_PAGE_SIZE, code, sellerId } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_PAGE_SIZE));

  const filter = {};
  if (code) {
    const normalized = normalizePromoCode(code);
    const promo = await PromoCode.findOne({ code: normalized }).select('_id').lean();
    if (!promo) {
      return res.json({
        items: [],
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: 0,
          pages: 1
        }
      });
    }
    filter.promoCode = promo._id;
  }

  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.seller = new mongoose.Types.ObjectId(sellerId);
  }

  const [items, total] = await Promise.all([
    PromoCodeUsage.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('promoCode', 'code discountType discountValue usageLimit usedCount')
      .populate('seller', 'name email phone')
      .populate('product', 'title slug price confirmationNumber')
      .populate('payment', 'status amount createdAt')
      .lean(),
    PromoCodeUsage.countDocuments(filter)
  ]);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const generatePromoCodeSample = asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const { prefix = '', length = 8 } = req.body;
  const code = await getUniqueGeneratedCode({ codePrefix: prefix, codeLength: length });

  res.json({
    code,
    message: 'Code généré.'
  });
});

export const previewPromoCommission = asyncHandler(async (req, res) => {
  const { code, productPrice } = req.body;

  const normalized = normalizePromoCode(code);
  const promo = normalized
    ? await PromoCode.findOne({ code: normalized }).select('code discountType discountValue').lean()
    : null;

  const commission = calculateCommissionBreakdown({ productPrice, promo });

  res.json({
    code: normalized || null,
    promo: promo ? serializePromoCodeSummary(promo) : null,
    commission
  });
});
