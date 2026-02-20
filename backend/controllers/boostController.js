import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import BoostPricing from '../models/boostPricingModel.js';
import SeasonalPricing from '../models/seasonalPricingModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import NetworkSetting from '../models/networkSettingModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import {
  BOOST_REQUEST_STATUSES,
  BOOST_TYPES,
  buildBoostRequestResponse,
  calculateBoostPrice,
  expireBoostRequests,
  getActiveSeasonalCampaign,
  normalizeBoostCity,
  normalizeBoostType,
  resolveBoostPricing
} from '../utils/boostService.js';
import {
  getCloudinaryFolder,
  isCloudinaryConfigured,
  uploadToCloudinary
} from '../utils/cloudinaryUploader.js';
import { createNotification } from '../utils/notificationService.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif'
]);

const parseProductIds = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // fallback to comma parser
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizePageParams = ({ page = 1, limit = DEFAULT_PAGE_SIZE }) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_PAGE_SIZE));
  return { pageNumber, pageSize, skip: (pageNumber - 1) * pageSize };
};

const ensureSellerEligible = async (userId) => {
  const seller = await User.findById(userId).select(
    'role accountType city shopName shopVerified isBlocked restrictions'
  );
  if (!seller) {
    const error = new Error('Vendeur introuvable.');
    error.status = 404;
    throw error;
  }
  if (['admin', 'manager'].includes(String(seller.role || ''))) {
    const error = new Error('Ce compte ne peut pas soumettre de demande de boost vendeur.');
    error.status = 403;
    throw error;
  }
  return seller;
};

const validateProductOwnership = async ({ productIds = [], sellerId }) => {
  if (!Array.isArray(productIds) || !productIds.length) return [];
  const validIds = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return [];
  const products = await Product.find({
    _id: { $in: validIds },
    user: sellerId,
    status: 'approved'
  })
    .select('_id title city')
    .lean();
  if (products.length !== validIds.length) {
    const error = new Error('Un ou plusieurs produits ne vous appartiennent pas ou ne sont pas approuvés.');
    error.status = 400;
    throw error;
  }
  return products;
};

const uploadPaymentProofImage = async (file) => {
  if (!file) return null;
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    const error = new Error('La preuve de paiement doit être une image valide (jpg, png, webp).');
    error.status = 400;
    throw error;
  }
  if (!isCloudinaryConfigured()) {
    const error = new Error('Cloudinary n’est pas configuré pour stocker la preuve de paiement.');
    error.status = 503;
    throw error;
  }
  const uploaded = await uploadToCloudinary({
    buffer: file.buffer,
    resourceType: 'image',
    folder: getCloudinaryFolder(['boosts', 'payment-proofs'])
  });
  return {
    url: uploaded.secure_url || uploaded.url || '',
    path: uploaded.public_id || '',
    mimeType: file.mimetype || '',
    size: Number(file.size || 0),
    uploadedAt: new Date()
  };
};

const buildPricingBreakdown = ({
  pricing,
  seasonalCampaign,
  computed,
  productCount,
  city
}) => ({
  boostType: pricing.type,
  city: city || null,
  basePrice: Number(pricing.basePrice || 0),
  priceType: pricing.priceType,
  pricingMultiplier: Number(pricing.multiplier || 1),
  unitPrice: Number(computed.unitPrice || 0),
  duration: Number(computed.billingUnits || 0),
  productCount: Number(productCount || 0),
  subtotal: Number(computed.subtotal || 0),
  seasonalMultiplier: Number(computed.seasonalMultiplier || 1),
  seasonalCampaign: seasonalCampaign
    ? {
        id: seasonalCampaign._id,
        name: seasonalCampaign.name,
        multiplier: Number(seasonalCampaign.multiplier || 1),
        startDate: seasonalCampaign.startDate,
        endDate: seasonalCampaign.endDate
      }
    : null,
  totalPrice: Number(computed.totalPrice || 0)
});

const notifyBoostManagers = async ({ actorId, message, metadata = {} }) => {
  const recipients = await User.find({
    $or: [{ role: 'admin' }, { canManageBoosts: true }]
  })
    .select('_id')
    .lean();
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient._id,
        actorId,
        type: 'admin_broadcast',
        metadata: {
          title: 'Gestion des boosts',
          message,
          ...metadata
        },
        allowSelf: true
      })
    )
  );
};

const applyLegacyBoostFlagsOnActivation = async ({ request, now }) => {
  if (!request) return;
  if (request.boostType === BOOST_TYPES.SHOP_BOOST) {
    await User.updateOne(
      { _id: request.sellerId },
      {
        $set: {
          shopBoosted: true,
          shopBoostScore: Date.now(),
          shopBoostStartDate: now,
          shopBoostEndDate: request.endDate || null
        }
      }
    );
    return;
  }
  const ids = Array.isArray(request.productIds) ? request.productIds : [];
  if (!ids.length) return;
  await Product.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        boosted: true,
        boostScore: Date.now(),
        boostStartDate: now,
        boostEndDate: request.endDate || null
      }
    }
  );
};

export const getBoostPricePreview = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  const seller = await ensureSellerEligible(sellerId);
  const boostType = normalizeBoostType(req.query.boostType || req.body?.boostType);
  const duration = Math.max(1, Number(req.query.duration || req.body?.duration || 1));
  const requestedCity = normalizeBoostCity(req.query.city || req.body?.city || seller.city);
  const providedProductIds = parseProductIds(req.query.productIds || req.body?.productIds);

  if (!boostType) {
    return res.status(400).json({ message: 'Type de boost invalide.' });
  }

  let ownedProducts = [];
  if (
    [BOOST_TYPES.PRODUCT_BOOST, BOOST_TYPES.LOCAL_PRODUCT_BOOST, BOOST_TYPES.HOMEPAGE_FEATURED].includes(
      boostType
    )
  ) {
    if (!providedProductIds.length) {
      return res.status(400).json({ message: 'Sélectionnez au moins un produit.' });
    }
    ownedProducts = await validateProductOwnership({ productIds: providedProductIds, sellerId });
  }

  if (boostType === BOOST_TYPES.SHOP_BOOST && seller.accountType !== 'shop') {
    return res.status(400).json({ message: 'Le boost boutique est réservé aux boutiques.' });
  }

  if (boostType === BOOST_TYPES.LOCAL_PRODUCT_BOOST && !requestedCity) {
    return res.status(400).json({ message: 'La ville est requise pour un boost local.' });
  }

  const pricing = await resolveBoostPricing({ boostType, city: requestedCity });
  if (!pricing) {
    return res.status(404).json({
      message:
        'Aucune tarification active trouvée pour ce type de boost. Contactez un administrateur.'
    });
  }

  const seasonalCampaign = await getActiveSeasonalCampaign({ boostType });
  const seasonalMultiplier = Number(seasonalCampaign?.multiplier || 1);
  const computed = calculateBoostPrice({
    boostType,
    duration,
    productCount: ownedProducts.length,
    pricing,
    seasonalMultiplier
  });

  return res.json({
    breakdown: buildPricingBreakdown({
      pricing,
      seasonalCampaign,
      computed,
      productCount: ownedProducts.length,
      city: requestedCity
    }),
    pricing
  });
});

export const createBoostRequest = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  const seller = await ensureSellerEligible(sellerId);
  await expireBoostRequests();

  const boostType = normalizeBoostType(req.body?.boostType);
  if (!boostType) {
    return res.status(400).json({ message: 'Type de boost invalide.' });
  }

  const duration = Math.max(1, Number(req.body?.duration || 1));
  const productIds = parseProductIds(req.body?.productIds);
  const paymentOperator = String(req.body?.paymentOperator || '').trim();
  const paymentSenderName = String(req.body?.paymentSenderName || '').trim();
  const paymentTransactionId = String(req.body?.paymentTransactionId || '').replace(/\D/g, '');
  let city = normalizeBoostCity(req.body?.city || seller.city);

  if (boostType === BOOST_TYPES.SHOP_BOOST && seller.accountType !== 'shop') {
    return res.status(400).json({ message: 'Le boost boutique est réservé aux comptes boutique.' });
  }
  if (boostType === BOOST_TYPES.LOCAL_PRODUCT_BOOST && !city) {
    return res.status(400).json({ message: 'La ville est requise pour un boost local.' });
  }
  if (boostType !== BOOST_TYPES.LOCAL_PRODUCT_BOOST) {
    city = city || null;
  }
  if (!paymentOperator) {
    return res.status(400).json({ message: 'L’opérateur Mobile Money est requis.' });
  }
  if (!paymentSenderName) {
    return res.status(400).json({ message: 'Le nom de l’expéditeur est requis.' });
  }
  if (!/^\d{10}$/.test(paymentTransactionId)) {
    return res.status(400).json({ message: 'L’ID de transaction doit contenir exactement 10 chiffres.' });
  }

  const selectedNetwork = await NetworkSetting.findOne({
    isActive: true,
    name: { $regex: new RegExp(`^${escapeRegex(paymentOperator)}$`, 'i') }
  })
    .select('name')
    .lean();
  let resolvedPaymentOperator = selectedNetwork?.name || '';
  if (!resolvedPaymentOperator) {
    const activeNetworksCount = await NetworkSetting.countDocuments({ isActive: true });
    const fallbackOperators = new Set(['MTN', 'Airtel']);
    if (activeNetworksCount === 0 && fallbackOperators.has(paymentOperator)) {
      resolvedPaymentOperator = paymentOperator;
    } else {
      return res.status(400).json({ message: 'Opérateur invalide ou indisponible.' });
    }
  }

  let ownedProducts = [];
  if (
    [BOOST_TYPES.PRODUCT_BOOST, BOOST_TYPES.LOCAL_PRODUCT_BOOST, BOOST_TYPES.HOMEPAGE_FEATURED].includes(
      boostType
    )
  ) {
    if (!productIds.length) {
      return res.status(400).json({ message: 'Au moins un produit est requis pour ce boost.' });
    }
    ownedProducts = await validateProductOwnership({ productIds, sellerId });

    const overlapping = await BoostRequest.findOne({
      status: {
        $in: [
          BOOST_REQUEST_STATUSES.PENDING,
          BOOST_REQUEST_STATUSES.APPROVED,
          BOOST_REQUEST_STATUSES.ACTIVE
        ]
      },
      productIds: { $in: ownedProducts.map((item) => item._id) },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }]
    })
      .select('_id status')
      .lean();
    if (overlapping) {
      return res.status(409).json({
        message:
          'Un des produits sélectionnés est déjà concerné par une demande de boost active/en attente.'
      });
    }
  } else {
    const overlappingShop = await BoostRequest.findOne({
      sellerId,
      boostType,
      status: {
        $in: [
          BOOST_REQUEST_STATUSES.PENDING,
          BOOST_REQUEST_STATUSES.APPROVED,
          BOOST_REQUEST_STATUSES.ACTIVE
        ]
      },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }]
    })
      .select('_id status')
      .lean();
    if (overlappingShop) {
      return res.status(409).json({
        message: 'Une demande de boost boutique est déjà active ou en attente pour cette boutique.'
      });
    }
  }

  const pricing = await resolveBoostPricing({ boostType, city });
  if (!pricing) {
    return res.status(404).json({
      message:
        'Aucune tarification active trouvée pour ce type de boost. Contactez un administrateur.'
    });
  }

  const seasonalCampaign = await getActiveSeasonalCampaign({ boostType });
  const seasonalMultiplier = Number(seasonalCampaign?.multiplier || 1);
  const computed = calculateBoostPrice({
    boostType,
    duration,
    productCount: ownedProducts.length,
    pricing,
    seasonalMultiplier
  });

  if (!Number.isFinite(computed.totalPrice) || computed.totalPrice <= 0) {
    return res.status(400).json({ message: 'Impossible de calculer le prix de cette demande.' });
  }

  const paymentProofImage = req.file ? await uploadPaymentProofImage(req.file) : undefined;
  const boostRequest = await BoostRequest.create({
    sellerId,
    boostType,
    productIds: ownedProducts.map((item) => item._id),
    city,
    duration,
    unitPrice: computed.unitPrice,
    basePrice: Number(pricing.basePrice || 0),
    priceType: pricing.priceType,
    pricingMultiplier: Number(pricing.multiplier || 1),
    seasonalMultiplier,
    seasonalCampaignId: seasonalCampaign?._id || null,
    seasonalCampaignName: seasonalCampaign?.name || '',
    totalPrice: computed.totalPrice,
    paymentOperator: resolvedPaymentOperator,
    paymentSenderName,
    paymentTransactionId,
    paymentProofImage,
    status: BOOST_REQUEST_STATUSES.PENDING
  });

  await notifyBoostManagers({
    actorId: sellerId,
    message: `${seller.shopName || seller.name || 'Un vendeur'} a soumis une demande de boost ${boostType}.`,
    metadata: {
      boostRequestId: boostRequest._id,
      boostType,
      sellerId,
      totalPrice: computed.totalPrice
    }
  });

  return res.status(201).json({
    message: 'Demande de boost envoyée. En attente de validation.',
    boostRequest: buildBoostRequestResponse(boostRequest),
    breakdown: buildPricingBreakdown({
      pricing,
      seasonalCampaign,
      computed,
      productCount: ownedProducts.length,
      city
    })
  });
});

export const listMyBoostRequests = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  await ensureSellerEligible(sellerId);
  await expireBoostRequests();

  const { pageNumber, pageSize, skip } = sanitizePageParams({
    page: req.query?.page,
    limit: req.query?.limit
  });
  const status = String(req.query?.status || '').trim().toUpperCase();
  const filter = { sellerId };
  if (Object.values(BOOST_REQUEST_STATUSES).includes(status)) {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    BoostRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('productIds', 'title images slug city')
      .lean(),
    BoostRequest.countDocuments(filter)
  ]);

  return res.json({
    items: items.map((item) => ({
      ...buildBoostRequestResponse(item),
      products: Array.isArray(item.productIds) ? item.productIds : []
    })),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const trackBoostImpressions = asyncHandler(async (req, res) => {
  const requestIdsRaw = Array.isArray(req.body?.requestIds) ? req.body.requestIds : [];
  const requestIds = Array.from(
    new Set(
      requestIdsRaw
        .map((id) => String(id || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .slice(0, 100)
    )
  );
  if (!requestIds.length) {
    return res.status(400).json({ message: 'Aucun identifiant de boost valide fourni.' });
  }

  const now = new Date();
  const operations = requestIds.map((id) => ({
    updateOne: {
      filter: {
        _id: new mongoose.Types.ObjectId(id),
        status: BOOST_REQUEST_STATUSES.ACTIVE,
        startDate: { $lte: now },
        endDate: { $gte: now }
      },
      update: { $inc: { impressions: 1 } }
    }
  }));
  const result = await BoostRequest.bulkWrite(operations, { ordered: false });
  return res.json({
    success: true,
    tracked: Number(result.modifiedCount || 0)
  });
});

export const trackBoostClick = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }
  const now = new Date();
  const updated = await BoostRequest.findOneAndUpdate(
    {
      _id: id,
      status: BOOST_REQUEST_STATUSES.ACTIVE,
      startDate: { $lte: now },
      endDate: { $gte: now }
    },
    { $inc: { clicks: 1 } },
    { new: true }
  )
    .select('_id impressions clicks')
    .lean();
  if (!updated) return res.status(404).json({ message: 'Boost actif introuvable.' });
  return res.json({
    success: true,
    id: updated._id,
    impressions: Number(updated.impressions || 0),
    clicks: Number(updated.clicks || 0)
  });
});

export const listBoostPricingAdmin = asyncHandler(async (req, res) => {
  const type = normalizeBoostType(req.query?.type);
  const city = normalizeBoostCity(req.query?.city);
  const filter = {};
  if (type) filter.type = type;
  if (req.query?.isActive === 'true') filter.isActive = true;
  if (req.query?.isActive === 'false') filter.isActive = false;
  if (city) filter.city = city;

  const items = await BoostPricing.find(filter)
    .sort({ type: 1, city: 1, updatedAt: -1 })
    .populate('updatedBy', 'name email')
    .lean();
  return res.json({
    items: items.map((item) => ({
      id: item._id,
      type: item.type,
      city: item.city || null,
      basePrice: Number(item.basePrice || 0),
      priceType: item.priceType,
      multiplier: Number(item.multiplier || 1),
      isActive: Boolean(item.isActive),
      updatedBy: item.updatedBy || null,
      updatedAt: item.updatedAt,
      history: Array.isArray(item.history) ? item.history : []
    }))
  });
});

export const upsertBoostPricingAdmin = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const type = normalizeBoostType(req.body?.type);
  const city = normalizeBoostCity(req.body?.city);
  const basePrice = Number(req.body?.basePrice || 0);
  const priceType = String(req.body?.priceType || '').trim();
  const multiplier = Number(req.body?.multiplier || 1);
  const isActive = req.body?.isActive !== undefined ? Boolean(req.body?.isActive) : true;

  if (!type) return res.status(400).json({ message: 'Type de boost invalide.' });
  if (!['per_day', 'per_week', 'fixed'].includes(priceType)) {
    return res.status(400).json({ message: 'Type de prix invalide.' });
  }
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return res.status(400).json({ message: 'Prix de base invalide.' });
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return res.status(400).json({ message: 'Multiplicateur invalide.' });
  }

  const existing = await BoostPricing.findOne({ type, city: city || null });
  if (existing) {
    existing.history = Array.isArray(existing.history) ? existing.history : [];
    existing.history.unshift({
      basePrice: Number(existing.basePrice || 0),
      priceType: existing.priceType,
      multiplier: Number(existing.multiplier || 1),
      isActive: Boolean(existing.isActive),
      updatedBy: existing.updatedBy || null,
      updatedAt: existing.updatedAt || new Date()
    });
    existing.history = existing.history.slice(0, 30);
    existing.basePrice = basePrice;
    existing.priceType = priceType;
    existing.multiplier = multiplier;
    existing.isActive = isActive;
    existing.updatedBy = userId;
    await existing.save();
    return res.json({ message: 'Tarification mise à jour.', pricing: existing });
  }

  const created = await BoostPricing.create({
    type,
    city: city || null,
    basePrice,
    priceType,
    multiplier,
    isActive,
    updatedBy: userId
  });
  return res.status(201).json({ message: 'Tarification créée.', pricing: created });
});

export const updateBoostPricingAdmin = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant de tarification invalide.' });
  }

  const pricing = await BoostPricing.findById(id);
  if (!pricing) return res.status(404).json({ message: 'Tarification introuvable.' });

  pricing.history = Array.isArray(pricing.history) ? pricing.history : [];
  pricing.history.unshift({
    basePrice: Number(pricing.basePrice || 0),
    priceType: pricing.priceType,
    multiplier: Number(pricing.multiplier || 1),
    isActive: Boolean(pricing.isActive),
    updatedBy: pricing.updatedBy || null,
    updatedAt: pricing.updatedAt || new Date()
  });
  pricing.history = pricing.history.slice(0, 30);

  if (req.body?.type) {
    const normalizedType = normalizeBoostType(req.body.type);
    if (!normalizedType) return res.status(400).json({ message: 'Type de boost invalide.' });
    pricing.type = normalizedType;
  }
  if (req.body?.city !== undefined) {
    pricing.city = normalizeBoostCity(req.body.city);
  }
  if (req.body?.basePrice !== undefined) {
    const basePrice = Number(req.body.basePrice);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return res.status(400).json({ message: 'Prix de base invalide.' });
    }
    pricing.basePrice = basePrice;
  }
  if (req.body?.priceType !== undefined) {
    const priceType = String(req.body.priceType || '').trim();
    if (!['per_day', 'per_week', 'fixed'].includes(priceType)) {
      return res.status(400).json({ message: 'Type de prix invalide.' });
    }
    pricing.priceType = priceType;
  }
  if (req.body?.multiplier !== undefined) {
    const multiplier = Number(req.body.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return res.status(400).json({ message: 'Multiplicateur invalide.' });
    }
    pricing.multiplier = multiplier;
  }
  if (req.body?.isActive !== undefined) {
    pricing.isActive = Boolean(req.body.isActive);
  }
  pricing.updatedBy = userId;
  await pricing.save();
  return res.json({ message: 'Tarification modifiée.', pricing });
});

export const listSeasonalPricingAdmin = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await SeasonalPricing.find({})
    .sort({ createdAt: -1 })
    .populate('updatedBy', 'name email')
    .lean();
  return res.json({
    items: items.map((item) => ({
      id: item._id,
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      multiplier: Number(item.multiplier || 1),
      isActive: Boolean(item.isActive),
      appliesTo: Array.isArray(item.appliesTo) ? item.appliesTo : [],
      updatedBy: item.updatedBy || null,
      updatedAt: item.updatedAt,
      isRunning: Boolean(item.isActive && item.startDate <= now && item.endDate >= now)
    }))
  });
});

export const createSeasonalPricingAdmin = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const name = String(req.body?.name || '').trim();
  const startDate = parseDate(req.body?.startDate);
  const endDate = parseDate(req.body?.endDate);
  const multiplier = Number(req.body?.multiplier || 1);
  const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;
  const appliesTo = Array.isArray(req.body?.appliesTo)
    ? req.body.appliesTo.map((item) => normalizeBoostType(item)).filter(Boolean)
    : [];

  if (!name) return res.status(400).json({ message: 'Nom de campagne requis.' });
  if (!startDate || !endDate) return res.status(400).json({ message: 'Dates de campagne invalides.' });
  if (endDate <= startDate) {
    return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début.' });
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return res.status(400).json({ message: 'Multiplicateur invalide.' });
  }

  const created = await SeasonalPricing.create({
    name,
    startDate,
    endDate,
    multiplier,
    isActive,
    appliesTo,
    updatedBy: userId
  });
  return res.status(201).json({ message: 'Campagne saisonnière créée.', campaign: created });
});

export const updateSeasonalPricingAdmin = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant de campagne invalide.' });
  }
  const campaign = await SeasonalPricing.findById(id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });

  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Nom de campagne requis.' });
    campaign.name = name;
  }
  if (req.body?.startDate !== undefined) {
    const startDate = parseDate(req.body.startDate);
    if (!startDate) return res.status(400).json({ message: 'Date de début invalide.' });
    campaign.startDate = startDate;
  }
  if (req.body?.endDate !== undefined) {
    const endDate = parseDate(req.body.endDate);
    if (!endDate) return res.status(400).json({ message: 'Date de fin invalide.' });
    campaign.endDate = endDate;
  }
  if (campaign.endDate <= campaign.startDate) {
    return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début.' });
  }
  if (req.body?.multiplier !== undefined) {
    const multiplier = Number(req.body.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return res.status(400).json({ message: 'Multiplicateur invalide.' });
    }
    campaign.multiplier = multiplier;
  }
  if (req.body?.isActive !== undefined) {
    campaign.isActive = Boolean(req.body.isActive);
  }
  if (req.body?.appliesTo !== undefined) {
    const appliesTo = Array.isArray(req.body.appliesTo)
      ? req.body.appliesTo.map((item) => normalizeBoostType(item)).filter(Boolean)
      : [];
    campaign.appliesTo = appliesTo;
  }
  campaign.updatedBy = userId;
  await campaign.save();
  return res.json({ message: 'Campagne saisonnière mise à jour.', campaign });
});

export const listBoostRequestsAdmin = asyncHandler(async (req, res) => {
  await expireBoostRequests();
  const { pageNumber, pageSize, skip } = sanitizePageParams({
    page: req.query?.page,
    limit: req.query?.limit
  });
  const status = String(req.query?.status || '').trim().toUpperCase();
  const boostType = normalizeBoostType(req.query?.boostType);
  const city = normalizeBoostCity(req.query?.city);
  const sellerId = mongoose.Types.ObjectId.isValid(req.query?.sellerId || '')
    ? new mongoose.Types.ObjectId(req.query.sellerId)
    : null;

  const filter = {};
  if (Object.values(BOOST_REQUEST_STATUSES).includes(status)) filter.status = status;
  if (boostType) filter.boostType = boostType;
  if (city) filter.city = city;
  if (sellerId) filter.sellerId = sellerId;

  const [items, total] = await Promise.all([
    BoostRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('sellerId', 'name email shopName city accountType')
      .populate('productIds', 'title images slug city')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .lean(),
    BoostRequest.countDocuments(filter)
  ]);

  return res.json({
    items: items.map((item) => ({
      ...buildBoostRequestResponse(item),
      seller: item.sellerId || null,
      products: Array.isArray(item.productIds) ? item.productIds : [],
      approvedBy: item.approvedBy || null,
      rejectedBy: item.rejectedBy || null
    })),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const updateBoostRequestStatusAdmin = asyncHandler(async (req, res) => {
  const adminId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant de demande invalide.' });
  }

  const nextStatus = String(req.body?.status || '').trim().toUpperCase();
  if (
    ![
      BOOST_REQUEST_STATUSES.APPROVED,
      BOOST_REQUEST_STATUSES.REJECTED,
      BOOST_REQUEST_STATUSES.ACTIVE,
      BOOST_REQUEST_STATUSES.EXPIRED
    ].includes(nextStatus)
  ) {
    return res.status(400).json({ message: 'Statut cible invalide.' });
  }

  const request = await BoostRequest.findById(id);
  if (!request) return res.status(404).json({ message: 'Demande de boost introuvable.' });

  if (request.status === BOOST_REQUEST_STATUSES.EXPIRED && nextStatus !== BOOST_REQUEST_STATUSES.ACTIVE) {
    return res.status(400).json({ message: 'Une demande expirée ne peut pas être modifiée ainsi.' });
  }

  const now = new Date();
  if ([BOOST_REQUEST_STATUSES.APPROVED, BOOST_REQUEST_STATUSES.ACTIVE].includes(nextStatus)) {
    request.status = BOOST_REQUEST_STATUSES.ACTIVE;
    request.approvedBy = adminId;
    request.approvedAt = now;
    request.rejectedAt = null;
    request.rejectedBy = null;
    request.rejectionReason = '';
    request.startDate = parseDate(req.body?.startDate) || now;
    const endDateFromBody = parseDate(req.body?.endDate);
    if (endDateFromBody && endDateFromBody > request.startDate) {
      request.endDate = endDateFromBody;
    } else {
      request.endDate = new Date(
        request.startDate.getTime() + Math.max(1, Number(request.duration || 1)) * 24 * 60 * 60 * 1000
      );
    }
    await request.save();
    await applyLegacyBoostFlagsOnActivation({ request, now: request.startDate });
    await createNotification({
      userId: request.sellerId,
      actorId: adminId,
      type: 'admin_broadcast',
      metadata: {
        title: 'Boost approuvé',
        message: `Votre demande de boost ${request.boostType} a été approuvée et activée.`,
        boostRequestId: request._id,
        status: request.status
      },
      allowSelf: true
    });
    return res.json({
      message: 'Demande de boost approuvée et activée.',
      boostRequest: buildBoostRequestResponse(request)
    });
  }

  if (nextStatus === BOOST_REQUEST_STATUSES.REJECTED) {
    request.status = BOOST_REQUEST_STATUSES.REJECTED;
    request.rejectedBy = adminId;
    request.rejectedAt = now;
    request.rejectionReason = String(req.body?.rejectionReason || '').trim();
    await request.save();
    await createNotification({
      userId: request.sellerId,
      actorId: adminId,
      type: 'admin_broadcast',
      metadata: {
        title: 'Boost rejeté',
        message: request.rejectionReason
          ? `Votre demande de boost a été rejetée: ${request.rejectionReason}`
          : 'Votre demande de boost a été rejetée.',
        boostRequestId: request._id,
        status: request.status
      },
      allowSelf: true
    });
    return res.json({
      message: 'Demande de boost rejetée.',
      boostRequest: buildBoostRequestResponse(request)
    });
  }

  request.status = BOOST_REQUEST_STATUSES.EXPIRED;
  request.endDate = now;
  await request.save();
  await expireBoostRequests({ now: new Date(now.getTime() + 1000) });
  return res.json({
    message: 'Demande de boost expirée.',
    boostRequest: buildBoostRequestResponse(request)
  });
});

const aggregateRevenueByPeriod = async ({ startDate, endDate }) => {
  const [result] = await BoostRequest.aggregate([
    {
      $match: {
        status: { $in: [BOOST_REQUEST_STATUSES.ACTIVE, BOOST_REQUEST_STATUSES.EXPIRED] },
        createdAt: { $gte: startDate, $lt: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalPrice' },
        totalRequests: { $sum: 1 }
      }
    }
  ]);
  return {
    totalRevenue: Number(result?.totalRevenue || 0),
    totalRequests: Number(result?.totalRequests || 0)
  };
};

export const getBoostRevenueDashboardAdmin = asyncHandler(async (req, res) => {
  await expireBoostRequests();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  const dayOfWeek = startOfWeek.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - offset);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextDay = new Date(startOfDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextWeek = new Date(startOfWeek);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [daily, weekly, monthly, revenueByType, revenueByCity, statusSummary, seasonalSummary, topSellers] =
    await Promise.all([
      aggregateRevenueByPeriod({ startDate: startOfDay, endDate: nextDay }),
      aggregateRevenueByPeriod({ startDate: startOfWeek, endDate: nextWeek }),
      aggregateRevenueByPeriod({ startDate: startOfMonth, endDate: nextMonth }),
      BoostRequest.aggregate([
        {
          $match: {
            status: { $in: [BOOST_REQUEST_STATUSES.ACTIVE, BOOST_REQUEST_STATUSES.EXPIRED] }
          }
        },
        {
          $group: {
            _id: '$boostType',
            revenue: { $sum: '$totalPrice' },
            requests: { $sum: 1 },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' }
          }
        },
        { $sort: { revenue: -1 } }
      ]),
      BoostRequest.aggregate([
        {
          $match: {
            status: { $in: [BOOST_REQUEST_STATUSES.ACTIVE, BOOST_REQUEST_STATUSES.EXPIRED] }
          }
        },
        {
          $group: {
            _id: { $ifNull: ['$city', 'GLOBAL'] },
            revenue: { $sum: '$totalPrice' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]),
      BoostRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      BoostRequest.aggregate([
        {
          $match: {
            status: { $in: [BOOST_REQUEST_STATUSES.ACTIVE, BOOST_REQUEST_STATUSES.EXPIRED] },
            seasonalCampaignName: { $exists: true, $ne: '' }
          }
        },
        {
          $group: {
            _id: '$seasonalCampaignName',
            revenue: { $sum: '$totalPrice' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]),
      BoostRequest.aggregate([
        {
          $match: {
            status: { $in: [BOOST_REQUEST_STATUSES.ACTIVE, BOOST_REQUEST_STATUSES.EXPIRED] }
          }
        },
        {
          $group: {
            _id: '$sellerId',
            revenue: { $sum: '$totalPrice' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'seller'
          }
        },
        { $unwind: '$seller' },
        {
          $project: {
            _id: 0,
            sellerId: '$seller._id',
            sellerName: {
              $ifNull: ['$seller.shopName', '$seller.name']
            },
            city: '$seller.city',
            revenue: 1,
            requests: 1
          }
        }
      ])
    ]);

  const statusMap = Object.fromEntries(
    statusSummary.map((entry) => [String(entry._id || ''), Number(entry.count || 0)])
  );

  return res.json({
    revenue: {
      daily,
      weekly,
      monthly
    },
    byType: revenueByType.map((entry) => {
      const impressions = Number(entry.impressions || 0);
      const clicks = Number(entry.clicks || 0);
      return {
        boostType: entry._id,
        revenue: Number(entry.revenue || 0),
        requests: Number(entry.requests || 0),
        impressions,
        clicks,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
      };
    }),
    byCity: revenueByCity.map((entry) => ({
      city: entry._id,
      revenue: Number(entry.revenue || 0),
      requests: Number(entry.requests || 0)
    })),
    status: {
      pending: Number(statusMap.PENDING || 0),
      approved: Number(statusMap.APPROVED || 0),
      active: Number(statusMap.ACTIVE || 0),
      rejected: Number(statusMap.REJECTED || 0),
      expired: Number(statusMap.EXPIRED || 0)
    },
    seasonalPerformance: seasonalSummary.map((entry) => ({
      campaign: entry._id,
      revenue: Number(entry.revenue || 0),
      requests: Number(entry.requests || 0)
    })),
    topSpendingSellers: topSellers.map((entry) => ({
      sellerId: entry.sellerId,
      sellerName: entry.sellerName || 'Vendeur',
      city: entry.city || null,
      revenue: Number(entry.revenue || 0),
      requests: Number(entry.requests || 0)
    }))
  });
});
