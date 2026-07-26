import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import GlobalNotificationRequest, {
  GLOBAL_NOTIFICATION_STATUSES
} from '../models/globalNotificationRequestModel.js';
import GlobalNotificationPricing from '../models/globalNotificationPricingModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import {
  buildBroadcastRecipientFilter,
  buildBroadcastShopLink
} from '../utils/broadcastNotification.js';
import {
  getCloudinaryFolder,
  isCloudinaryConfigured,
  uploadToCloudinary
} from '../utils/cloudinaryUploader.js';
import { getRuntimeConfig } from '../services/configService.js';

const DEFAULT_PAGE_SIZE = 20;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const normalizeGender = (value) => {
  const normalized = String(value || 'all').trim().toLowerCase();
  return ['all', 'homme', 'femme'].includes(normalized) ? normalized : 'all';
};

const normalizeCity = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const sanitizePageParams = ({ page, limit } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE));
  return { pageNumber, pageSize, skip: (pageNumber - 1) * pageSize };
};

const ensureSellerEligible = async (userId) => {
  const seller = await User.findById(userId).select('role accountType city shopName name isBlocked');
  if (!seller) {
    const error = new Error('Utilisateur introuvable.');
    error.status = 404;
    throw error;
  }
  if (['admin', 'founder', 'manager'].includes(String(seller.role || ''))) {
    const error = new Error('Ce compte ne peut pas soumettre de demande de notification globale.');
    error.status = 403;
    throw error;
  }
  if (seller.isBlocked) {
    const error = new Error('Ce compte est bloqué.');
    error.status = 403;
    throw error;
  }
  return seller;
};

const ensureAdminOrFounder = (user) => {
  if (!user || !['admin', 'founder'].includes(String(user.role || ''))) {
    const error = new Error('Accès réservé aux administrateurs.');
    error.status = 403;
    throw error;
  }
};

const resolveGlobalNotificationPrice = async (city) => {
  const normalizedCity = normalizeCity(city);
  if (normalizedCity) {
    const cityPricing = await GlobalNotificationPricing.findOne({
      city: normalizedCity,
      isActive: true
    }).lean();
    if (cityPricing) return cityPricing;
  }
  const nationalPricing = await GlobalNotificationPricing.findOne({ city: null, isActive: true }).lean();
  return nationalPricing || null;
};

const estimateAudience = async ({ city, gender }) => {
  const filter = buildBroadcastRecipientFilter({ target: 'all', gender: normalizeGender(gender), city });
  return User.countDocuments(filter);
};

const buildRequestResponse = (request) => ({
  id: request._id,
  sellerId: request.sellerId,
  product: request.product,
  title: request.title,
  message: request.message,
  image: request.image,
  audienceCity: request.audienceCity,
  audienceGender: request.audienceGender,
  estimatedReach: request.estimatedReach,
  price: request.price,
  paymentStatus: request.paymentStatus,
  status: request.status,
  rejectionReason: request.rejectionReason,
  approvedAt: request.approvedAt,
  rejectedAt: request.rejectedAt,
  sentAt: request.sentAt,
  matchedCount: request.matchedCount,
  sentCount: request.sentCount,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
});

const computeCampaignStats = async (requestIds = []) => {
  const ids = requestIds.map((id) => String(id)).filter(Boolean);
  if (!ids.length) return new Map();
  const rows = await Notification.aggregate([
    { $match: { entityType: 'globalNotification', entityId: { $in: ids } } },
    {
      $group: {
        _id: '$entityId',
        delivered: { $sum: 1 },
        opened: { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: ['$clickCount', 0] }, 1, 0] } }
      }
    }
  ]);
  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), {
      delivered: row.delivered || 0,
      opened: row.opened || 0,
      clicked: row.clicked || 0
    });
  });
  return map;
};

/** Shop-facing: upload the campaign creative ahead of payment (returns a hosted URL to echo back in actionContext). */
export const uploadGlobalNotificationImage = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  await ensureSellerEligible(sellerId);

  if (!req.file) {
    return res.status(400).json({ message: 'Une image est requise.' });
  }
  if (!IMAGE_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ message: 'L’image doit être au format jpg, png ou webp.' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ message: 'Cloudinary n’est pas configuré pour stocker cette image.' });
  }
  const uploaded = await uploadToCloudinary({
    buffer: req.file.buffer,
    resourceType: 'image',
    folder: getCloudinaryFolder(['global-notifications'])
  });

  res.json({
    image: {
      url: uploaded.secure_url || uploaded.url || '',
      path: uploaded.public_id || '',
      mimeType: req.file.mimetype || '',
      size: Number(req.file.size || 0)
    }
  });
});

/** Shop-facing: price + estimated reach for a given targeting choice, before paying. */
export const getGlobalNotificationPricePreview = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  await ensureSellerEligible(sellerId);

  const city = normalizeCity(req.query?.city);
  const gender = normalizeGender(req.query?.gender);

  const [pricing, estimatedReach] = await Promise.all([
    resolveGlobalNotificationPrice(city),
    estimateAudience({ city, gender })
  ]);

  if (!pricing) {
    // Not configured yet, not an error — the seller-facing form renders this as
    // "unavailable" rather than a failed request (avoids console/network noise
    // on every city/gender change while the admin hasn't set a price yet).
    return res.json({
      price: null,
      city,
      estimatedReach,
      message: 'Aucune tarification active pour les notifications globales. Contactez un administrateur.'
    });
  }

  res.json({
    price: Number(pricing.price || 0),
    city: pricing.city,
    estimatedReach
  });
});

/** Shop-facing: create a campaign request. Payment (PawaPay) must already be confirmed. */
export const createGlobalNotificationRequest = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  const seller = await ensureSellerEligible(sellerId);

  const enabled = await getRuntimeConfig('enable_global_notifications', { fallback: true });
  if (enabled === false) {
    return res.status(403).json({ message: 'Les notifications globales sponsorisées sont désactivées.' });
  }

  const title = String(req.body?.title || '').trim();
  const message = String(req.body?.message || '').trim();
  const productId = String(req.body?.productId || '').trim();
  const audienceCity = normalizeCity(req.body?.audienceCity);
  const audienceGender = normalizeGender(req.body?.audienceGender);

  if (!title) return res.status(400).json({ message: 'Le titre est requis.' });
  if (!message) return res.status(400).json({ message: 'Le message est requis.' });

  if (!req.pawaPayCheckout) {
    return res.status(403).json({
      code: 'PAWAPAY_ONLY',
      message: 'Payez cette notification globale avec PawaPay.'
    });
  }

  let product = null;
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Produit invalide.' });
    }
    product = await Product.findOne({ _id: productId, user: sellerId, status: 'approved' })
      .select('_id title slug images')
      .lean();
    if (!product) {
      return res.status(400).json({ message: 'Ce produit ne vous appartient pas ou n’est pas approuvé.' });
    }
  }

  const pricing = await resolveGlobalNotificationPrice(audienceCity);
  if (!pricing) {
    return res.status(404).json({
      message: 'Aucune tarification active pour les notifications globales. Contactez un administrateur.'
    });
  }
  const price = Number(pricing.price || 0);
  if (Math.abs(Number(req.pawaPayCheckout.amount || 0) - price) > 0.01) {
    return res.status(400).json({ message: 'Le montant confirmé par PawaPay est invalide.' });
  }

  // The image must already be hosted before payment starts: the PawaPay completion step
  // rebuilds this request from a small JSON actionContext, which can't carry a file body —
  // see uploadGlobalNotificationImage, called by the frontend before PawaPayButton fires.
  const imageUrl = String(req.body?.image?.url || '').trim();
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return res.status(400).json({ message: 'Une image valide est requise pour la notification globale.' });
  }
  const image = {
    url: imageUrl,
    path: String(req.body?.image?.path || '').trim(),
    mimeType: String(req.body?.image?.mimeType || '').trim(),
    size: Number(req.body?.image?.size || 0)
  };

  const estimatedReach = await estimateAudience({ city: audienceCity, gender: audienceGender });

  const request = await GlobalNotificationRequest.create({
    sellerId,
    product: product?._id || null,
    title,
    message,
    image,
    audienceCity,
    audienceGender,
    estimatedReach,
    price,
    paymentMethod: 'pawapay',
    paymentStatus: 'paid',
    paymentTransactionId: req.pawaPayCheckout.checkoutId,
    status: 'PENDING'
  });

  const recipients = await User.find({
    $or: [{ role: { $in: ['admin', 'founder'] } }]
  })
    .select('_id role')
    .lean();
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient._id,
        actorId: sellerId,
        type: 'validation_required',
        audience: String(recipient.role || '').toLowerCase() === 'founder' ? 'FOUNDER' : 'ADMIN',
        targetRole: [String(recipient.role || 'ADMIN').toUpperCase()],
        actionRequired: true,
        actionType: 'APPROVE',
        actionStatus: 'PENDING',
        validationType: 'sponsoredAds',
        entityType: 'globalNotification',
        entityId: String(request._id),
        deepLink: `/admin/global-notifications?requestId=${request._id}`,
        actionLink: `/admin/global-notifications?requestId=${request._id}`,
        title: 'Notification globale à valider',
        message: `${seller.shopName || seller.name || 'Un vendeur'} a payé ${price.toLocaleString('fr-FR')} FCFA pour diffuser une notification globale. Vérifiez le contenu et confirmez la diffusion.`,
        metadata: { globalNotificationRequestId: request._id, price, estimatedReach }
      })
    )
  );

  res.status(201).json({
    message: 'Notification globale payée avec PawaPay. En attente de validation par un administrateur.',
    request: buildRequestResponse(request)
  });
});

/** Shop-facing: list my campaign requests, with live delivery/open/click stats once sent. */
export const listMyGlobalNotificationRequests = asyncHandler(async (req, res) => {
  const sellerId = req.user?.id || req.user?._id;
  await ensureSellerEligible(sellerId);

  const { pageNumber, pageSize, skip } = sanitizePageParams(req.query);
  const status = String(req.query?.status || '').trim().toUpperCase();
  const filter = { sellerId };
  if (GLOBAL_NOTIFICATION_STATUSES.includes(status)) filter.status = status;

  const [items, total] = await Promise.all([
    GlobalNotificationRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('product', 'title slug images')
      .lean(),
    GlobalNotificationRequest.countDocuments(filter)
  ]);

  const statsByRequestId = await computeCampaignStats(
    items.filter((item) => item.status === 'SENT').map((item) => item._id)
  );

  res.json({
    items: items.map((item) => ({
      ...buildRequestResponse(item),
      product: item.product || null,
      stats: statsByRequestId.get(String(item._id)) || null
    })),
    pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) }
  });
});

/** Admin: pricing management. */
export const listGlobalNotificationPricingAdmin = asyncHandler(async (req, res) => {
  ensureAdminOrFounder(req.user);
  const items = await GlobalNotificationPricing.find({}).sort({ city: 1 }).lean();
  res.json({ items });
});

export const upsertGlobalNotificationPricingAdmin = asyncHandler(async (req, res) => {
  ensureAdminOrFounder(req.user);
  const adminId = req.user?.id || req.user?._id;
  const city = normalizeCity(req.body?.city);
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: 'Le prix doit être un nombre positif.' });
  }
  const pricing = await GlobalNotificationPricing.findOneAndUpdate(
    { city },
    { $set: { price, isActive: true, updatedBy: adminId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ message: 'Tarification enregistrée.', pricing });
});

/** Admin: list campaign requests (pending queue by default via ?status=PENDING). */
export const listGlobalNotificationRequestsAdmin = asyncHandler(async (req, res) => {
  ensureAdminOrFounder(req.user);
  const { pageNumber, pageSize, skip } = sanitizePageParams(req.query);
  const status = String(req.query?.status || '').trim().toUpperCase();
  const filter = {};
  if (GLOBAL_NOTIFICATION_STATUSES.includes(status)) filter.status = status;

  const [items, total] = await Promise.all([
    GlobalNotificationRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('sellerId', 'name shopName phone city')
      .populate('product', 'title slug images')
      .lean(),
    GlobalNotificationRequest.countDocuments(filter)
  ]);

  const statsByRequestId = await computeCampaignStats(
    items.filter((item) => item.status === 'SENT').map((item) => item._id)
  );

  res.json({
    items: items.map((item) => ({
      ...buildRequestResponse(item),
      seller: item.sellerId || null,
      product: item.product || null,
      stats: statsByRequestId.get(String(item._id)) || null
    })),
    pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) }
  });
});

/** Admin: confirm and broadcast — payment is already captured, this only gates the content/reach. */
export const approveAndSendGlobalNotificationAdmin = asyncHandler(async (req, res) => {
  ensureAdminOrFounder(req.user);
  const adminId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant de demande invalide.' });
  }

  const request = await GlobalNotificationRequest.findById(id).populate('product', 'slug');
  if (!request) return res.status(404).json({ message: 'Demande introuvable.' });
  if (request.status !== 'PENDING') {
    return res.status(409).json({ message: 'Cette demande a déjà été traitée.' });
  }

  const dailyCap = Number(
    await getRuntimeConfig('global_notification_daily_send_cap', { fallback: 5 })
  );
  if (Number.isFinite(dailyCap) && dailyCap > 0) {
    const sentToday = await GlobalNotificationRequest.countDocuments({
      status: 'SENT',
      sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (sentToday >= dailyCap) {
      return res.status(429).json({
        message: `Le quota quotidien de notifications globales (${dailyCap}) est atteint. Réessayez plus tard ou ajustez le quota.`
      });
    }
  }

  const filter = buildBroadcastRecipientFilter({
    target: 'all',
    gender: request.audienceGender,
    city: request.audienceCity || ''
  });
  filter._id = { $ne: request.sellerId };
  const recipients = await User.find(filter).select('_id').lean();

  const seller = await User.findById(request.sellerId).select('slug shopName name').lean();
  const shopLink = buildBroadcastShopLink(seller);
  const productIdentifier = request.product?.slug || request.product?._id;
  const deepLink = productIdentifier
    ? `/product/${encodeURIComponent(String(productIdentifier))}`
    : shopLink || '/';

  const BATCH_SIZE = 200;
  let sentCount = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((recipient) =>
        createNotification({
          userId: recipient._id,
          actorId: request.sellerId,
          type: 'sponsored_notification',
          allowSelf: true,
          entityType: 'globalNotification',
          entityId: String(request._id),
          deepLink,
          actionLink: deepLink,
          title: request.title,
          message: request.message,
          snapshot: {
            actorName: seller?.shopName || seller?.name || ''
          },
          metadata: {
            image: request.image?.url || '',
            globalNotificationRequestId: String(request._id)
          }
        })
      )
    );
    sentCount += results.filter(Boolean).length;
  }

  request.status = 'SENT';
  request.approvedBy = adminId;
  request.approvedAt = new Date();
  request.sentAt = new Date();
  request.matchedCount = recipients.length;
  request.sentCount = sentCount;
  await request.save();

  await resolveValidationTaskNotifications({
    entityType: 'globalNotification',
    entityId: String(request._id),
    actionStatus: 'DONE',
    actorId: adminId,
    validationType: 'sponsoredAds'
  }).catch(() => {});

  createNotification({
    userId: request.sellerId,
    actorId: adminId,
    type: 'admin_broadcast',
    allowSelf: true,
    metadata: {
      title: 'Notification globale diffusée',
      message: `Votre notification globale a été diffusée à ${recipients.length} utilisateur(s).`,
      globalNotificationRequestId: request._id
    }
  }).catch(() => {});

  res.json({
    message: `Notification diffusée à ${sentCount} utilisateur(s) sur ${recipients.length} ciblé(s).`,
    request: buildRequestResponse(request)
  });
});

export const rejectGlobalNotificationRequestAdmin = asyncHandler(async (req, res) => {
  ensureAdminOrFounder(req.user);
  const adminId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant de demande invalide.' });
  }

  const request = await GlobalNotificationRequest.findById(id);
  if (!request) return res.status(404).json({ message: 'Demande introuvable.' });
  if (request.status !== 'PENDING') {
    return res.status(409).json({ message: 'Cette demande a déjà été traitée.' });
  }

  request.status = 'REJECTED';
  request.rejectedBy = adminId;
  request.rejectedAt = new Date();
  request.rejectionReason = String(req.body?.rejectionReason || '').trim();
  await request.save();

  await resolveValidationTaskNotifications({
    entityType: 'globalNotification',
    entityId: String(request._id),
    actionStatus: 'DONE',
    actorId: adminId,
    validationType: 'sponsoredAds'
  }).catch(() => {});

  createNotification({
    userId: request.sellerId,
    actorId: adminId,
    type: 'admin_broadcast',
    allowSelf: true,
    metadata: {
      title: 'Notification globale rejetée',
      message: request.rejectionReason
        ? `Votre demande de notification globale a été rejetée : ${request.rejectionReason}.`
        : 'Votre demande de notification globale a été rejetée.',
      globalNotificationRequestId: request._id
    }
  }).catch(() => {});

  res.json({
    message: 'Demande rejetée. Le paiement PawaPay associé peut être remboursé manuellement depuis le Centre PawaPay si nécessaire.',
    request: buildRequestResponse(request)
  });
});
