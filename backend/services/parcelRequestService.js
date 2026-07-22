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
import { getManyRuntimeConfigs, getRuntimeConfig } from './configService.js';
import { createNotification } from '../utils/notificationService.js';
import { createAuditLogEntry } from './auditLogService.js';
import { invalidateAdminCache, invalidateUserCache } from '../utils/cache.js';
import {
  appendTimeline,
  emitNotificationBatch,
  extractLngLatFromGeoPoint,
  haversineMeters,
  hashPinCode,
  encryptDeliveryPin,
  decryptDeliveryPin
} from '../controllers/courierDeliveryController.js';

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
  contactName: String(raw.contactName || '').trim(),
  contactPhone: String(raw.contactPhone || '').trim()
});

/**
 * Distance-based pricing when both ends have GPS coordinates (from the
 * requester's "use my location" capture); otherwise a same-commune /
 * cross-commune flat rate, since street-address geocoding isn't wired up.
 */
export const estimateParcelPrice = async ({ pickup, dropoff }) => {
  const settings = await getManyRuntimeConfigs([
    'parcel_delivery_base_price',
    'parcel_delivery_price_per_km',
    'parcel_delivery_min_price',
    'parcel_delivery_same_commune_price',
    'parcel_delivery_cross_commune_price',
    'parcel_delivery_max_distance_km'
  ]);

  const minPrice = Math.max(0, Number(settings.parcel_delivery_min_price || 1000));
  const pickupCoords = extractLngLatFromGeoPoint(pickup?.coordinates);
  const dropoffCoords = extractLngLatFromGeoPoint(dropoff?.coordinates);
  const distanceMeters = haversineMeters(pickupCoords, dropoffCoords);

  if (Number.isFinite(distanceMeters)) {
    const maxDistanceKm = Math.max(1, Number(settings.parcel_delivery_max_distance_km || 30));
    if (distanceMeters / 1000 > maxDistanceKm) {
      throw createHttpError(
        `La distance dépasse la zone de service (${maxDistanceKm} km max).`,
        400
      );
    }
    const basePrice = Math.max(0, Number(settings.parcel_delivery_base_price || 1000));
    const pricePerKm = Math.max(0, Number(settings.parcel_delivery_price_per_km || 150));
    const price = basePrice + pricePerKm * (distanceMeters / 1000);
    return { distanceMeters: Math.round(distanceMeters), price: Math.max(minPrice, Math.round(price)) };
  }

  const sameCommune =
    pickup?.communeId && dropoff?.communeId && String(pickup.communeId) === String(dropoff.communeId);
  const flatPrice = sameCommune
    ? Number(settings.parcel_delivery_same_commune_price || 1500)
    : Number(settings.parcel_delivery_cross_commune_price || 2500);
  return { distanceMeters: 0, price: Math.max(minPrice, Math.round(flatPrice)) };
};

export const createParcelRequest = async ({
  requesterId,
  pickup,
  dropoff,
  parcelDescription = '',
  authorization = {}
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

  const { distanceMeters, price } = await estimateParcelPrice({
    pickup: normalizedPickup,
    dropoff: normalizedDropoff
  });

  const pinCode = String(Math.floor(1000 + Math.random() * 9000));

  const parcelRequest = await ParcelRequest.create({
    requesterId,
    pickup: normalizedPickup,
    dropoff: normalizedDropoff,
    parcelDescription: String(parcelDescription || '').trim().slice(0, 300),
    authorization: {
      proofImageUrl: String(authorization.proofImageUrl || '').trim(),
      referenceCode: String(authorization.referenceCode || '').trim(),
      notes: String(authorization.notes || '').trim().slice(0, 500)
    },
    distanceMeters,
    deliveryPrice: price,
    deliveryPinCodeHash: hashPinCode(pinCode),
    deliveryPinCodeEncrypted: encryptDeliveryPin(pinCode),
    deliveryPinCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    timeline: [{ type: 'PARCEL_REQUEST_CREATED', by: requesterId, at: new Date(), meta: { price } }]
  });

  await invalidateAdminCache(['admin', 'dashboard', 'delivery']);

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
      { $group: { _id: null, total: { $sum: '$deliveryPrice' } } }
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
    totalRevenue: revenueAgg[0]?.total || 0
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
