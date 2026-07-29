/**
 * Parcel pickup / errand delivery (Lalamove/FlashEx-style), standalone from
 * marketplace orders. A requester describes a pickup point, a dropoff point,
 * and an "authorization" packet (a proof photo — invoice/receipt/ID — plus a
 * name/reference/notes) that the assigned courier presents at the pickup
 * point to prove they're collecting the parcel on the requester's behalf.
 */
import ParcelRequest from '../models/parcelRequestModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import User from '../models/userModel.js';
import { getRuntimeConfig } from './configService.js';
import { createNotification } from '../utils/notificationService.js';
import { createAuditLogEntry } from './auditLogService.js';
import { invalidateAdminCache, invalidateUserCache } from '../utils/cache.js';
import {
  appendTimeline,
  emitNotificationBatch,
  hashPinCode,
  encryptDeliveryPin,
  decryptDeliveryPin
} from '../controllers/courierDeliveryController.js';
import { estimateDeliveryPrice, finalizePromotionUsage } from './deliveryPricingEngine/DeliveryPricingEngine.js';
import { validatePriceAdjustment } from './deliveryPricingEngine/DriverAdjustmentService.js';
import { splitDeliveryCommission } from './deliveryPricingEngine/CommissionService.js';

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toGeoPoint = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
};

const normalizeLocation = (raw = {}) => ({
  cityId: raw.cityId || null,
  cityName: String(raw.cityName || '').trim(),
  communeId: raw.communeId || null,
  communeName: String(raw.communeName || '').trim(),
  address: String(raw.address || '').trim(),
  coordinates: toGeoPoint(raw.coordinates),
  // Explicit landmark pick from the request form's autocomplete — the
  // pricing engine looks this up server-side rather than trusting any
  // client-supplied coordinates for it (see LocationResolverService).
  landmarkId: raw.landmarkId || null,
  contactName: String(raw.contactName || '').trim(),
  contactPhone: String(raw.contactPhone || '').trim()
});

/**
 * Delegates to the modular DeliveryPricingEngine (GPS -> landmark -> commune
 * -> city location resolution, zone/package/weight/speed/time/promotion
 * pricing). Kept as a thin wrapper so callers (this file + the controller)
 * don't need to know the engine exists.
 */
export const estimateParcelPrice = async ({
  pickup,
  dropoff,
  packageTypeId = null,
  weightKg = null,
  deliverySpeed = 'STANDARD',
  promoCode = ''
}) => estimateDeliveryPrice({ pickup, dropoff, packageTypeId, weightKg, deliverySpeed, promoCode });

export const createParcelRequest = async ({
  requesterId,
  pickup,
  dropoff,
  parcelDescription = '',
  authorization = {},
  paymentMethod = 'COD',
  paymentStatus = 'PENDING',
  pawaPayCheckoutId = '',
  packageTypeId = null,
  weightKg = null,
  deliverySpeed = 'STANDARD',
  promoCode = ''
}) => {
  const enabled = await getRuntimeConfig('enable_parcel_delivery', { fallback: true });
  if (!enabled) throw createHttpError('La livraison de colis est désactivée.', 403);

  const normalizedPickup = normalizeLocation(pickup);
  const normalizedDropoff = normalizeLocation(dropoff);
  if (!normalizedPickup.address || !normalizedDropoff.address) {
    throw createHttpError('Adresse de retrait et de dépôt requises.', 400);
  }
  if (!authorization?.proofImageUrl) {
    throw createHttpError('Une photo de justificatif (facture, reçu...) est requise.', 400);
  }

  const {
    distanceMeters,
    price,
    breakdown,
    resolvedPickup,
    resolvedDropoff,
    appliedPromotionId,
    pricingVersion
  } =
    await estimateParcelPrice({
      pickup: normalizedPickup,
      dropoff: normalizedDropoff,
      packageTypeId,
      weightKg,
      deliverySpeed,
      promoCode
    });
  const { platformCommission, courierEarning } = await splitDeliveryCommission(price);

  const pinCode = String(Math.floor(1000 + Math.random() * 9000));

  const parcelRequest = await ParcelRequest.create({
    requesterId,
    pickup: {
      ...normalizedPickup,
      landmarkId: resolvedPickup?.landmarkId || null,
      resolvedFrom: resolvedPickup?.resolvedFrom || 'UNRESOLVED'
    },
    dropoff: {
      ...normalizedDropoff,
      landmarkId: resolvedDropoff?.landmarkId || null,
      resolvedFrom: resolvedDropoff?.resolvedFrom || 'UNRESOLVED'
    },
    parcelDescription: String(parcelDescription || '').trim().slice(0, 300),
    authorization: {
      proofImageUrl: String(authorization.proofImageUrl || '').trim(),
      referenceCode: String(authorization.referenceCode || '').trim(),
      notes: String(authorization.notes || '').trim().slice(0, 500)
    },
    distanceMeters,
    deliveryPrice: price,
    platformCommission,
    courierEarning,
    priceBreakdown: breakdown,
    pricingVersion,
    packageType: packageTypeId || null,
    weightKg: Number.isFinite(Number(weightKg)) ? Number(weightKg) : null,
    deliverySpeed: String(deliverySpeed || 'STANDARD').toUpperCase(),
    promoCode: appliedPromotionId ? String(promoCode || '').trim().toUpperCase() : '',
    paymentMethod,
    paymentStatus,
    pawaPayCheckoutId,
    deliveryPinCodeHash: hashPinCode(pinCode),
    deliveryPinCodeEncrypted: encryptDeliveryPin(pinCode),
    deliveryPinCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    timeline: [{ type: 'PARCEL_REQUEST_CREATED', by: requesterId, at: new Date(), meta: { price } }]
  });

  await Promise.all([
    invalidateAdminCache(['admin', 'dashboard', 'delivery']),
    finalizePromotionUsage(appliedPromotionId)
  ]);

  const plain = parcelRequest.toObject();
  plain.deliveryPinCode = pinCode;
  return plain;
};

export const listMyParcelRequests = async ({ requesterId, status = '', page = 1, limit = 20 }) => {
  const filter = { requesterId };
  const normalizedStatus = String(status || '').trim().toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    filter.status = normalizedStatus;
  }
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const [items, total] = await Promise.all([
    ParcelRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('assignedDeliveryGuyId', 'fullName name phone photoUrl')
      .lean(),
    ParcelRequest.countDocuments(filter)
  ]);
  return { items, total, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getParcelRequestForRequester = async ({ id, requesterId }) => {
  const parcelRequest = await ParcelRequest.findOne({ _id: id, requesterId })
    .populate('assignedDeliveryGuyId', 'fullName name phone photoUrl')
    .lean();
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (parcelRequest.status !== 'DELIVERED' && parcelRequest.deliveryPinCodeEncrypted) {
    parcelRequest.deliveryPinCode = decryptDeliveryPin(parcelRequest.deliveryPinCodeEncrypted);
  }
  return parcelRequest;
};

export const replaceParcelAuthorizationProof = async ({
  id,
  requesterId,
  proofImageUrl
}) => {
  const url = String(proofImageUrl || '').trim();
  if (!url) throw createHttpError('Une nouvelle photo de justificatif est requise.', 400);

  const parcelRequest = await ParcelRequest.findOne({ _id: id, requesterId });
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (
    ['DELIVERED', 'CANCELED', 'FAILED'].includes(parcelRequest.status) ||
    ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'].includes(parcelRequest.currentStage)
  ) {
    throw createHttpError('Le justificatif ne peut plus être remplacé après le retrait du colis.', 409);
  }

  parcelRequest.authorization = {
    ...(parcelRequest.authorization?.toObject?.() || parcelRequest.authorization || {}),
    proofImageUrl: url
  };
  appendTimeline(parcelRequest, {
    type: 'PARCEL_AUTHORIZATION_PROOF_REPLACED',
    by: requesterId
  });
  await parcelRequest.save();
  await Promise.all([
    invalidateUserCache(requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);
  return getParcelRequestForRequester({ id, requesterId });
};

export const cancelParcelRequest = async ({ id, requesterId }) => {
  const parcelRequest = await ParcelRequest.findOne({ _id: id, requesterId });
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (['DELIVERED', 'CANCELED', 'FAILED'].includes(parcelRequest.status)) {
    throw createHttpError('Cette demande ne peut plus être annulée.', 409);
  }
  parcelRequest.status = 'CANCELED';
  parcelRequest.cancelledAt = new Date();
  parcelRequest.cancelledBy = requesterId;
  appendTimeline(parcelRequest, { type: 'PARCEL_REQUEST_CANCELED', by: requesterId });
  await parcelRequest.save();

  if (parcelRequest.assignedDeliveryGuyId) {
    const deliveryGuy = await DeliveryGuy.findById(parcelRequest.assignedDeliveryGuyId).select('userId').lean();
    if (deliveryGuy?.userId) {
      createNotification({
        userId: deliveryGuy.userId,
        actorId: requesterId,
        type: 'parcel_request_cancelled',
        allowSelf: false,
        priority: 'HIGH',
        pushEnabled: true,
        metadata: {
          title: 'Course annulée',
          message: 'Le client a annulé cette course colis.'
        },
        entityType: 'parcel_request',
        entityId: String(parcelRequest._id)
      }).catch(() => {});
    }
  }

  await invalidateAdminCache(['admin', 'dashboard', 'delivery']);
  return parcelRequest;
};

// ─── ADMIN ──────────────────────────────────────────────────

export const adminListParcelRequests = async ({ status = '', search = '', page = 1, limit = 20 } = {}) => {
  const filter = {};
  const normalizedStatus = String(status || '').trim().toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    filter.status = normalizedStatus;
  }

  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) {
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: normalizedSearch, $options: 'i' } },
        { phone: { $regex: normalizedSearch, $options: 'i' } }
      ]
    })
      .select('_id')
      .limit(500)
      .lean();
    filter.requesterId = { $in: matchingUsers.map((u) => u._id) };
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const [items, total] = await Promise.all([
    ParcelRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('requesterId', 'name phone')
      .populate('assignedDeliveryGuyId', 'fullName name phone')
      .lean(),
    ParcelRequest.countDocuments(filter)
  ]);

  items.forEach((item) => {
    if (item.deliveryPinCodeEncrypted) {
      item.deliveryPinCode = decryptDeliveryPin(item.deliveryPinCodeEncrypted);
    }
  });

  return { items, total, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getAdminParcelStats = async () => {
  const [byStatus, revenueAgg] = await Promise.all([
    ParcelRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ParcelRequest.aggregate([
      { $match: { status: 'DELIVERED' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$deliveryPrice' },
          totalCommission: { $sum: '$platformCommission' },
          totalCourierEarnings: { $sum: '$courierEarning' }
        }
      }
    ])
  ]);

  const counts = byStatus.reduce((acc, entry) => {
    acc[entry._id] = entry.count;
    return acc;
  }, {});

  return {
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    pending: counts.PENDING || 0,
    accepted: counts.ACCEPTED || 0,
    inProgress: counts.IN_PROGRESS || 0,
    delivered: counts.DELIVERED || 0,
    canceled: (counts.CANCELED || 0) + (counts.FAILED || 0) + (counts.REJECTED || 0),
    totalRevenue: revenueAgg[0]?.total || 0,
    totalCommission: revenueAgg[0]?.totalCommission || 0,
    totalCourierEarnings: revenueAgg[0]?.totalCourierEarnings || 0
  };
};

export const adminCancelParcelRequest = async ({ id, actorId, reason = '' }) => {
  const parcelRequest = await ParcelRequest.findById(id);
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (['DELIVERED', 'CANCELED', 'FAILED'].includes(parcelRequest.status)) {
    throw createHttpError('Cette demande ne peut plus être annulée.', 409);
  }

  const hadCourier = parcelRequest.assignedDeliveryGuyId;
  parcelRequest.status = 'CANCELED';
  parcelRequest.cancelledAt = new Date();
  parcelRequest.cancelledBy = actorId;
  appendTimeline(parcelRequest, { type: 'PARCEL_REQUEST_CANCELED', by: actorId, meta: { reason, byAdmin: true } });
  await parcelRequest.save();

  createNotification({
    userId: parcelRequest.requesterId,
    actorId,
    type: 'parcel_request_cancelled',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      title: 'Course annulée',
      message: reason ? `Votre course colis a été annulée : ${reason}` : 'Votre course colis a été annulée.'
    },
    entityType: 'parcel_request',
    entityId: String(parcelRequest._id)
  }).catch(() => {});

  if (hadCourier) {
    const deliveryGuy = await DeliveryGuy.findById(hadCourier).select('userId').lean();
    if (deliveryGuy?.userId) {
      createNotification({
        userId: deliveryGuy.userId,
        actorId,
        type: 'parcel_request_cancelled',
        allowSelf: false,
        priority: 'HIGH',
        pushEnabled: true,
        metadata: { title: 'Course annulée', message: 'Cette course colis a été annulée par un administrateur.' },
        entityType: 'parcel_request',
        entityId: String(parcelRequest._id)
      }).catch(() => {});
    }
  }

  await createAuditLogEntry({
    performedBy: actorId,
    targetUser: parcelRequest.requesterId,
    actionType: 'PARCEL_REQUEST_CANCELED_ADMIN',
    newValue: { parcelRequestId: String(parcelRequest._id), reason }
  });

  await Promise.all([
    invalidateUserCache(parcelRequest.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  return parcelRequest;
};

export const assignCourierToParcelRequest = async ({ requestId, deliveryGuyId, actorId, courierMustAcceptAssignment = true }) => {
  const [parcelRequest, deliveryGuy] = await Promise.all([
    ParcelRequest.findById(requestId),
    DeliveryGuy.findById(deliveryGuyId).lean()
  ]);
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (!deliveryGuy) throw createHttpError('Livreur introuvable.', 404);
  if (['CANCELED', 'DELIVERED', 'FAILED'].includes(parcelRequest.status)) {
    throw createHttpError('Impossible d’assigner un livreur à une course clôturée.', 409);
  }

  parcelRequest.assignedDeliveryGuyId = deliveryGuyId;
  parcelRequest.assignmentStatus = courierMustAcceptAssignment ? 'PENDING' : 'ACCEPTED';
  parcelRequest.assignmentAcceptedAt = courierMustAcceptAssignment ? null : new Date();
  parcelRequest.assignmentRejectedAt = null;
  parcelRequest.assignmentRejectReason = '';
  parcelRequest.currentStage = courierMustAcceptAssignment ? 'ASSIGNED' : 'ACCEPTED';
  parcelRequest.status = courierMustAcceptAssignment ? 'ACCEPTED' : 'IN_PROGRESS';

  appendTimeline(parcelRequest, {
    type: 'COURIER_ASSIGNED',
    by: actorId,
    meta: { courierId: String(deliveryGuy._id), courierName: deliveryGuy.fullName || deliveryGuy.name || '' }
  });
  await parcelRequest.save();

  if (deliveryGuy.userId) {
    await emitNotificationBatch({
      actorId,
      recipients: [String(deliveryGuy.userId)],
      type: 'parcel_request_assigned',
      metadata: {
        title: 'Nouvelle course colis',
        message: 'Une course colis vous a été assignée.',
        parcelRequestId: String(parcelRequest._id)
      },
      priority: 'HIGH'
    });
  }

  createNotification({
    userId: parcelRequest.requesterId,
    actorId,
    type: 'parcel_request_assigned',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      title: 'Livreur assigné',
      message: 'Un livreur a été assigné à votre course colis.'
    },
    entityType: 'parcel_request',
    entityId: String(parcelRequest._id)
  }).catch(() => {});

  await createAuditLogEntry({
    performedBy: actorId,
    targetUser: parcelRequest.requesterId,
    actionType: 'PARCEL_COURIER_ASSIGNED',
    newValue: { parcelRequestId: String(parcelRequest._id), courierId: String(deliveryGuy._id) }
  });

  await Promise.all([
    invalidateUserCache(parcelRequest.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  return parcelRequest;
};

// ─── DRIVER PRICE ADJUSTMENT ────────────────────────────────

export const requestParcelPriceAdjustment = async ({ requestId, deliveryGuyId, actorId, amount, reason = '' }) => {
  const parcelRequest = await ParcelRequest.findById(requestId);
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (String(parcelRequest.assignedDeliveryGuyId || '') !== String(deliveryGuyId)) {
    throw createHttpError('Vous n’êtes pas assigné à cette course.', 403);
  }
  if (['DELIVERED', 'CANCELED', 'FAILED'].includes(parcelRequest.status)) {
    throw createHttpError('Cette course est clôturée.', 409);
  }
  if (parcelRequest.priceAdjustment?.status === 'PENDING') {
    throw createHttpError('Un ajustement est déjà en attente pour cette course.', 409);
  }

  const validation = await validatePriceAdjustment({
    estimatedPrice: parcelRequest.deliveryPrice,
    amount
  });
  if (!validation.allowed) {
    throw createHttpError(validation.reason, 400);
  }

  parcelRequest.priceAdjustment = {
    amount: Number(amount),
    reason: String(reason || '').trim().slice(0, 300),
    status: 'PENDING',
    requestedBy: actorId,
    requestedAt: new Date(),
    respondedAt: null
  };
  appendTimeline(parcelRequest, {
    type: 'PRICE_ADJUSTMENT_REQUESTED',
    by: actorId,
    meta: { amount: Number(amount), reason }
  });
  await parcelRequest.save();

  createNotification({
    userId: parcelRequest.requesterId,
    actorId,
    type: 'parcel_request_assigned',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      title: 'Ajustement de prix proposé',
      message: `Le livreur propose un ajustement de ${Number(amount) > 0 ? '+' : ''}${amount} CFA${reason ? ` : ${reason}` : ''}.`
    },
    entityType: 'parcel_request',
    entityId: String(parcelRequest._id)
  }).catch(() => {});

  await invalidateUserCache(parcelRequest.requesterId, ['notifications']);
  return parcelRequest;
};

export const respondToParcelPriceAdjustment = async ({ requestId, requesterId, approve }) => {
  const parcelRequest = await ParcelRequest.findOne({ _id: requestId, requesterId });
  if (!parcelRequest) throw createHttpError('Demande introuvable.', 404);
  if (parcelRequest.priceAdjustment?.status !== 'PENDING') {
    throw createHttpError('Aucun ajustement en attente pour cette course.', 409);
  }

  parcelRequest.priceAdjustment.status = approve ? 'APPROVED' : 'REJECTED';
  parcelRequest.priceAdjustment.respondedAt = new Date();
  if (approve) {
    parcelRequest.deliveryPrice = Math.max(
      0,
      Number(parcelRequest.deliveryPrice || 0) + Number(parcelRequest.priceAdjustment.amount || 0)
    );
    parcelRequest.priceBreakdown = [
      ...(parcelRequest.priceBreakdown || []),
      { label: 'Ajustement livreur', amount: Number(parcelRequest.priceAdjustment.amount || 0) }
    ];
    const { platformCommission, courierEarning } = await splitDeliveryCommission(parcelRequest.deliveryPrice);
    parcelRequest.platformCommission = platformCommission;
    parcelRequest.courierEarning = courierEarning;
  }
  appendTimeline(parcelRequest, {
    type: approve ? 'PRICE_ADJUSTMENT_APPROVED' : 'PRICE_ADJUSTMENT_REJECTED',
    by: requesterId,
    meta: { amount: parcelRequest.priceAdjustment.amount }
  });
  await parcelRequest.save();

  if (parcelRequest.assignedDeliveryGuyId) {
    const deliveryGuy = await DeliveryGuy.findById(parcelRequest.assignedDeliveryGuyId).select('userId').lean();
    if (deliveryGuy?.userId) {
      createNotification({
        userId: deliveryGuy.userId,
        actorId: requesterId,
        type: 'parcel_request_assigned',
        allowSelf: false,
        priority: 'HIGH',
        pushEnabled: true,
        metadata: {
          title: approve ? 'Ajustement approuvé' : 'Ajustement refusé',
          message: approve
            ? `Le client a approuvé l’ajustement. Nouveau prix : ${parcelRequest.deliveryPrice} CFA.`
            : 'Le client a refusé votre ajustement de prix.'
        },
        entityType: 'parcel_request',
        entityId: String(parcelRequest._id)
      }).catch(() => {});
    }
  }

  await invalidateAdminCache(['admin', 'dashboard', 'delivery']);
  return parcelRequest;
};
