import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import { hasAnyPermission } from '../services/rbacService.js';
import { createNotification } from '../utils/notificationService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import {
  assertPlatformDeliveryEnabled,
  canManageDeliveryRequests
} from '../services/platformDeliveryService.js';
import {
  invalidateAdminCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const normalizeText = (value = '') => String(value || '').trim();
const normalizePhoneToDigits = (value = '') => String(value || '').replace(/\D/g, '');
const isObjectId = (value = '') => OBJECT_ID_REGEX.test(normalizeText(value));
const pickFirstText = (...values) => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
};
const resolveDeliveryGuyProfileImage = (deliveryGuy = {}) =>
  pickFirstText(
    deliveryGuy?.photoUrl,
    deliveryGuy?.profileImage,
    deliveryGuy?.userId?.shopLogo
  );
const toPublicDeliveryGuy = (value = {}) => {
  if (!value || typeof value !== 'object') return value;
  const raw = value?.toObject ? value.toObject() : value;
  const userObject = raw?.userId && typeof raw.userId === 'object' ? raw.userId : null;
  const fullName = pickFirstText(raw?.fullName, raw?.name);
  const isActive =
    typeof raw?.isActive === 'boolean'
      ? raw.isActive
      : typeof raw?.active === 'boolean'
      ? raw.active
      : true;
  const profileImage = resolveDeliveryGuyProfileImage(raw);
  return {
    ...raw,
    userId: userObject?._id || raw?.userId || null,
    fullName,
    name: fullName,
    photoUrl: profileImage,
    profileImage,
    isActive,
    active: isActive
  };
};
const DELIVERY_GUY_POPULATE = {
  path: 'assignedDeliveryGuyId',
  select: '_id userId fullName name phone isActive active photoUrl',
  populate: { path: 'userId', select: '_id name shopLogo' }
};
const hashPinCode = (value = '') =>
  crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');

const DELIVERY_PIN_SECRET = normalizeText(
  process.env.DELIVERY_PIN_SECRET || process.env.JWT_SECRET || process.env.SECRET_KEY || ''
);
const DELIVERY_PIN_KEY = DELIVERY_PIN_SECRET
  ? crypto.createHash('sha256').update(DELIVERY_PIN_SECRET).digest()
  : null;

const encryptDeliveryPin = (value = '') => {
  const pin = normalizeText(value);
  if (!pin) return '';
  if (!DELIVERY_PIN_KEY) return pin;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DELIVERY_PIN_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptDeliveryPin = (payload = '') => {
  const value = normalizeText(payload);
  if (!value) return '';
  // If no encryption key is configured, we store the pin in clear text.
  if (!DELIVERY_PIN_KEY) return value;
  const [ivHex, tagHex, dataHex] = value.split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      DELIVERY_PIN_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final()
    ]);
    return normalizeText(decrypted.toString('utf8'));
  } catch (_error) {
    return '';
  }
};

const resolveVisibleDeliveryPin = ({
  encryptedPin = '',
  legacyDeliveryCode = '',
  exposeDeliveryPin = true,
  pinExpired = false,
  terminalStatus = false
} = {}) => {
  if (!exposeDeliveryPin || pinExpired || terminalStatus) return '';

  const decrypted = decryptDeliveryPin(encryptedPin);
  if (decrypted) return decrypted;

  // Backward compatibility for legacy records that stored plain numeric PIN directly.
  const legacyEncrypted = normalizeText(encryptedPin);
  if (/^\d{4,8}$/.test(legacyEncrypted)) return legacyEncrypted;

  // Fallback to historical order delivery code when no platform PIN is available.
  const fallbackCode = normalizeText(legacyDeliveryCode);
  if (/^\d{4,8}$/.test(fallbackCode)) return fallbackCode;

  return '';
};

const STAGE_TO_ORDER_STATUS = Object.freeze({
  ASSIGNED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  PICKUP_STARTED: 'IN_PROGRESS',
  PICKED_UP: 'IN_PROGRESS',
  IN_TRANSIT: 'IN_PROGRESS',
  ARRIVED: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  FAILED: 'CANCELED'
});

const ALLOWED_STAGE_TRANSITIONS = Object.freeze({
  ASSIGNED: ['ACCEPTED', 'FAILED'],
  ACCEPTED: ['PICKUP_STARTED', 'FAILED'],
  PICKUP_STARTED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['ARRIVED', 'DELIVERED', 'FAILED'],
  ARRIVED: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: []
});

const normalizeStage = (value = '') => {
  const stage = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(ALLOWED_STAGE_TRANSITIONS, stage) ? stage : '';
};

const appendTimeline = (requestDoc, event) => {
  const timeline = Array.isArray(requestDoc.timeline) ? requestDoc.timeline : [];
  timeline.push({
    type: String(event.type || '').trim() || 'COURIER_EVENT',
    by: event.by || null,
    at: event.at || new Date(),
    meta: event.meta && typeof event.meta === 'object' ? event.meta : {}
  });
  requestDoc.timeline = timeline;
};

const hasProofContent = (proof = {}) => {
  const submittedAt = proof?.submittedAt ? new Date(proof.submittedAt) : null;
  const hasValidSubmittedAt = submittedAt instanceof Date && !Number.isNaN(submittedAt.getTime());
  return Boolean(
    hasValidSubmittedAt ||
      normalizeText(proof?.photoUrl || '') ||
      normalizeText(proof?.signatureUrl || '') ||
      normalizeText(proof?.note || '')
  );
};

const getManagerRecipients = async (runtime) => {
  const roles = Array.isArray(runtime?.managerRoles) ? runtime.managerRoles : [];
  const query = {
    $or: [{ permissions: 'manage_delivery' }, { canManageDelivery: true }]
  };
  if (roles.length) {
    query.$or.unshift({ role: { $in: roles } });
  }
  const list = await User.find(query).select('_id').lean();
  return list.map((entry) => String(entry._id));
};

const emitNotificationBatch = async ({
  actorId,
  recipients = [],
  type,
  metadata = {},
  priority = 'NORMAL'
}) => {
  const uniqueRecipients = Array.from(
    new Set((Array.isArray(recipients) ? recipients : []).map((entry) => String(entry || '')).filter(Boolean))
  );
  if (!uniqueRecipients.length) return;
  await Promise.all(
    uniqueRecipients.map((userId) =>
      createNotification({
        userId,
        actorId,
        type,
        metadata,
        allowSelf: true,
        priority
      })
    )
  );
};

const mapStageToStatus = (stage = 'ASSIGNED') => STAGE_TO_ORDER_STATUS[String(stage || '').toUpperCase()] || 'IN_PROGRESS';

const STAGE_RANK = Object.freeze({
  ASSIGNED: 1,
  ACCEPTED: 2,
  PICKUP_STARTED: 3,
  PICKED_UP: 4,
  IN_TRANSIT: 5,
  ARRIVED: 6,
  DELIVERED: 7,
  FAILED: 8
});

const toFiniteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const extractLngLatFromGeoPoint = (geoPoint = null) => {
  const coords = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : null;
  if (!coords || coords.length !== 2) return null;
  const lng = toFiniteNumber(coords[0], null);
  const lat = toFiniteNumber(coords[1], null);
  if (lng === null || lat === null) return null;
  return { lng, lat };
};

const haversineMeters = (from, to) => {
  if (!from || !to) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

const shouldLockByStatus = ({ currentStage = '', lockOnStatus = 'DELIVERED' } = {}) => {
  const normalizedStage = normalizeStage(currentStage) || 'ASSIGNED';
  const stageRank = Number(STAGE_RANK[normalizedStage] || 0);
  const lockRank = Number(STAGE_RANK[normalizeStage(lockOnStatus) || 'DELIVERED'] || STAGE_RANK.DELIVERED);
  return stageRank >= lockRank;
};

const updateOrderPlatformDeliveryState = async ({
  orderId,
  requestId,
  stage,
  deliveryGuyId,
  forceMode = 'PLATFORM_DELIVERY'
}) => {
  const platformDeliveryStatus = mapStageToStatus(stage);
  const payload = {
    platformDeliveryMode: forceMode,
    platformDeliveryRequestId: requestId || null,
    platformDeliveryStatus
  };
  if (typeof deliveryGuyId !== 'undefined') {
    payload.deliveryGuy = deliveryGuyId || null;
  }
  await Order.updateOne({ _id: orderId }, { $set: payload });

  const normalizedStage = normalizeStage(stage) || 'ASSIGNED';
  if (normalizedStage === 'DELIVERED') {
    const deliveredAtExpr = {
      $ifNull: ['$deliveredAt', { $ifNull: ['$deliveryDate', '$$NOW'] }]
    };
    await Promise.all([
      // Non-installment orders: surface "delivered" across seller/client order pages.
      Order.updateOne(
        {
          _id: orderId,
          paymentType: { $ne: 'installment' },
          status: { $nin: ['cancelled', 'completed', 'confirmed_by_client', 'picked_up_confirmed'] }
        },
        [
          {
            $set: {
              status: 'delivered',
              outForDeliveryAt: { $ifNull: ['$outForDeliveryAt', '$$NOW'] },
              shippedAt: { $ifNull: ['$shippedAt', '$$NOW'] },
              deliverySubmittedAt: { $ifNull: ['$deliverySubmittedAt', '$$NOW'] },
              deliveryDate: { $ifNull: ['$deliveryDate', '$$NOW'] },
              deliveredAt: deliveredAtExpr,
              deliveryStatus: 'verified',
              clientDeliveryConfirmedAt: { $ifNull: ['$clientDeliveryConfirmedAt', '$$NOW'] }
            }
          }
        ]
      ),
      // Installment orders keep status "completed" and use installmentSaleStatus for delivery state.
      Order.updateOne(
        {
          _id: orderId,
          paymentType: 'installment',
          status: 'completed',
          installmentSaleStatus: { $nin: ['delivered', 'cancelled'] }
        },
        [
          {
            $set: {
              installmentSaleStatus: 'delivered',
              outForDeliveryAt: { $ifNull: ['$outForDeliveryAt', '$$NOW'] },
              shippedAt: { $ifNull: ['$shippedAt', '$$NOW'] },
              deliverySubmittedAt: { $ifNull: ['$deliverySubmittedAt', '$$NOW'] },
              deliveryDate: { $ifNull: ['$deliveryDate', '$$NOW'] },
              deliveredAt: deliveredAtExpr,
              deliveryStatus: 'verified',
              clientDeliveryConfirmedAt: { $ifNull: ['$clientDeliveryConfirmedAt', '$$NOW'] }
            }
          }
        ]
      )
    ]);
    return;
  }

  const shouldMarkSellerOrderInDelivery = ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED'].includes(normalizedStage);
  if (!shouldMarkSellerOrderInDelivery) return;

  // Keep seller-side order status in sync for platform courier flow after pickup proof.
  await Order.updateOne(
    {
      _id: orderId,
      paymentType: { $ne: 'installment' },
      status: {
        $nin: ['cancelled', 'completed', 'delivered', 'delivery_proof_submitted', 'confirmed_by_client', 'picked_up_confirmed']
      }
    },
    [
      {
        $set: {
          status: 'out_for_delivery',
          outForDeliveryAt: { $ifNull: ['$outForDeliveryAt', '$$NOW'] },
          shippedAt: { $ifNull: ['$shippedAt', '$$NOW'] }
        }
      }
    ]
  );
};

const toCourierItems = (requestDoc = {}) => {
  const source =
    (Array.isArray(requestDoc.itemsSnapshot) && requestDoc.itemsSnapshot.length
      ? requestDoc.itemsSnapshot
      : Array.isArray(requestDoc.productSnapshot)
      ? requestDoc.productSnapshot
      : []) || [];
  return source.map((entry) => ({
    productId: entry?.productId || null,
    name: String(entry?.name || entry?.title || 'Produit').trim(),
    imageUrl: String(entry?.imageUrl || '').trim(),
    qty: Math.max(1, Number(entry?.qty || 1))
  }));
};

const safeObjectIdString = (value = '') => {
  const normalized = normalizeText(value);
  return isObjectId(normalized) ? normalized : '';
};

const buildLocationNameMaps = async (entries = []) => {
  const cityIds = new Set();
  const communeIds = new Set();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const raw = entry?.toObject ? entry.toObject() : entry || {};
    const rawOrder = raw.orderId && typeof raw.orderId === 'object' ? raw.orderId : null;
    const shippingSnapshot = rawOrder?.shippingAddressSnapshot || {};

    [raw?.dropoff?.cityId, shippingSnapshot?.cityId].forEach((candidate) => {
      const asId = safeObjectIdString(candidate);
      if (asId) cityIds.add(asId);
    });
    [raw?.dropoff?.communeId, shippingSnapshot?.communeId].forEach((candidate) => {
      const asId = safeObjectIdString(candidate);
      if (asId) communeIds.add(asId);
    });
  }

  const [cities, communes] = await Promise.all([
    cityIds.size
      ? City.find({ _id: { $in: Array.from(cityIds) } }).select('_id name').lean()
      : Promise.resolve([]),
    communeIds.size
      ? Commune.find({ _id: { $in: Array.from(communeIds) } }).select('_id name').lean()
      : Promise.resolve([])
  ]);

  return {
    cityById: new Map((cities || []).map((entry) => [String(entry._id), String(entry.name || '').trim()])),
    communeById: new Map((communes || []).map((entry) => [String(entry._id), String(entry.name || '').trim()]))
  };
};

const toCourierAssignment = (requestDoc = {}, locationMaps = null, options = {}) => {
  const exposeDeliveryPin = options?.exposeDeliveryPin !== false;
  const raw = requestDoc?.toObject ? requestDoc.toObject() : requestDoc;
  const rawOrder = raw.orderId && typeof raw.orderId === 'object' ? raw.orderId : null;
  const rawBuyer = raw.buyerId && typeof raw.buyerId === 'object' ? raw.buyerId : null;
  const shippingSnapshot = rawOrder?.shippingAddressSnapshot || {};
  const cityById = locationMaps?.cityById instanceof Map ? locationMaps.cityById : null;
  const communeById = locationMaps?.communeById instanceof Map ? locationMaps.communeById : null;
  const dropoffCityId = safeObjectIdString(raw?.dropoff?.cityId || shippingSnapshot?.cityId);
  const dropoffCommuneId = safeObjectIdString(raw?.dropoff?.communeId || shippingSnapshot?.communeId);
  const dropoffCityNameById = dropoffCityId ? pickFirstText(cityById?.get(dropoffCityId)) : '';
  const dropoffCommuneNameById = dropoffCommuneId ? pickFirstText(communeById?.get(dropoffCommuneId)) : '';
  const savedPickupCityName = pickFirstText(raw?.pickup?.cityName);
  const savedPickupCommuneName = pickFirstText(raw?.pickup?.communeName);
  const savedPickupAddress = pickFirstText(raw?.pickup?.address);
  const savedDropoffCityName = pickFirstText(raw?.dropoff?.cityName);
  const savedDropoffCommuneName = pickFirstText(raw?.dropoff?.communeName);
  const savedDropoffAddress = pickFirstText(raw?.dropoff?.address);
  const fallbackDropoffCityName = pickFirstText(
    dropoffCityNameById,
    shippingSnapshot?.cityName,
    shippingSnapshot?.city,
    rawOrder?.deliveryCity,
    rawBuyer?.city
  );
  const fallbackDropoffCommuneName = pickFirstText(
    dropoffCommuneNameById,
    shippingSnapshot?.communeName,
    shippingSnapshot?.commune,
    rawBuyer?.commune
  );
  const fallbackDropoffAddress = pickFirstText(
    shippingSnapshot?.addressLine,
    shippingSnapshot?.address,
    shippingSnapshot?.street,
    rawOrder?.deliveryAddress,
    rawBuyer?.address
  );
  const dropoffCityName =
    !savedDropoffCityName ||
    (dropoffCityNameById && savedDropoffCityName !== dropoffCityNameById) ||
    (fallbackDropoffCityName &&
      savedDropoffCityName === savedPickupCityName &&
      savedDropoffCityName !== fallbackDropoffCityName)
      ? fallbackDropoffCityName
      : savedDropoffCityName;
  const dropoffCommuneName =
    !savedDropoffCommuneName ||
    (dropoffCommuneNameById && savedDropoffCommuneName !== dropoffCommuneNameById) ||
    (fallbackDropoffCommuneName &&
      savedDropoffCommuneName === savedPickupCommuneName &&
      savedDropoffCommuneName !== fallbackDropoffCommuneName)
      ? fallbackDropoffCommuneName
      : savedDropoffCommuneName;
  const dropoffAddress =
    !savedDropoffAddress ||
    /^retrait en boutique$/i.test(savedDropoffAddress) ||
    (fallbackDropoffAddress &&
      savedDropoffAddress === savedPickupAddress &&
      savedDropoffAddress !== fallbackDropoffAddress)
      ? fallbackDropoffAddress
      : savedDropoffAddress;
  const dropoff = {
    ...(raw.dropoff || {}),
    cityName: dropoffCityName,
    communeName: dropoffCommuneName,
    address: dropoffAddress
  };
  const pinExpiresAt = raw.deliveryPinCodeExpiresAt ? new Date(raw.deliveryPinCodeExpiresAt) : null;
  const pinExpired = pinExpiresAt ? pinExpiresAt.getTime() <= Date.now() : false;
  const terminalStatus = ['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(
    String(raw.status || '').toUpperCase()
  );
  const visibleDeliveryPin = resolveVisibleDeliveryPin({
    encryptedPin: raw.deliveryPinCodeEncrypted,
    legacyDeliveryCode: rawOrder?.deliveryCode,
    exposeDeliveryPin,
    pinExpired,
    terminalStatus
  });
  return {
    _id: raw._id,
    orderId: raw.orderId?._id || raw.orderId,
    order: rawOrder
      ? {
          _id: rawOrder._id || null,
          status: rawOrder.status || '',
          platformDeliveryStatus: rawOrder.platformDeliveryStatus || '',
          deliveryMode: rawOrder.deliveryMode || '',
          deliveryAddress: rawOrder.deliveryAddress || '',
          deliveryCity: rawOrder.deliveryCity || '',
          deliveryCode: rawOrder.deliveryCode || ''
        }
      : null,
    status: String(raw.status || '').toUpperCase(),
    assignmentStatus: String(raw.assignmentStatus || 'PENDING').toUpperCase(),
    currentStage: normalizeStage(raw.currentStage || 'ASSIGNED') || 'ASSIGNED',
    deliveryPrice: Number(raw.deliveryPrice ?? 0),
    currency: String(raw.currency || 'XAF').trim() || 'XAF',
    pickup: raw.pickup || {},
    dropoff,
    seller: raw.sellerId
      ? {
          _id: raw.sellerId?._id || raw.sellerId,
          name: raw.sellerId?.shopName || raw.sellerId?.name || '',
          phone: raw.sellerId?.phone || ''
        }
      : null,
    buyer: raw.buyerId
      ? {
          _id: raw.buyerId?._id || raw.buyerId,
          name: raw.buyerId?.name || '',
          phone: raw.buyerId?.phone || '',
          city: raw.buyerId?.city || '',
          commune: raw.buyerId?.commune || '',
          address: raw.buyerId?.address || ''
        }
      : null,
    itemsSnapshot: toCourierItems(raw),
    pickupProof: raw.pickupProof || {},
    deliveryProof: raw.deliveryProof || {},
    assignmentAcceptedAt: raw.assignmentAcceptedAt || null,
    assignmentRejectedAt: raw.assignmentRejectedAt || null,
    assignmentRejectReason: raw.assignmentRejectReason || '',
    deliveryPinCode: visibleDeliveryPin || '',
    deliveryPinCodeExpiresAt: pinExpiresAt || null,
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    expiresAt: raw.expiresAt || null
  };
};

const decorateAssignmentForAgentView = (payload = {}, rawRequest = {}, runtime = null, agentCoordinates = null) => {
  const assignment = payload && typeof payload === 'object' ? { ...payload } : {};
  const source = rawRequest?.toObject ? rawRequest.toObject() : rawRequest || {};
  const mapAccess = source?.mapAccess && typeof source.mapAccess === 'object' ? source.mapAccess : {};
  const lockEnabled = Boolean(runtime?.locationLockEnabled);
  const lockOnStatus = String(runtime?.locationLockOnStatus || 'DELIVERED').toUpperCase();
  const lockDistanceMeters = Math.max(0, Number(runtime?.locationLockDistanceMeters || 0));
  const now = Date.now();

  const sellerVisibleUntil = mapAccess?.sellerVisibleUntil ? new Date(mapAccess.sellerVisibleUntil).getTime() : 0;
  const buyerVisibleUntil = mapAccess?.buyerVisibleUntil ? new Date(mapAccess.buyerVisibleUntil).getTime() : 0;
  const statusLocked = lockEnabled && shouldLockByStatus({ currentStage: source?.currentStage, lockOnStatus });
  let sellerVisible =
    !lockEnabled || (!statusLocked && !mapAccess?.sellerLockedAt && (!sellerVisibleUntil || now <= sellerVisibleUntil));
  let buyerVisible =
    !lockEnabled || (!statusLocked && !mapAccess?.buyerLockedAt && (!buyerVisibleUntil || now <= buyerVisibleUntil));

  const pickupCoords = extractLngLatFromGeoPoint(assignment?.pickup?.coordinates);
  const dropoffCoords = extractLngLatFromGeoPoint(assignment?.dropoff?.coordinates);
  const sellerDistanceM = haversineMeters(agentCoordinates, pickupCoords);
  const buyerDistanceM = haversineMeters(agentCoordinates, dropoffCoords);

  if (lockEnabled && lockDistanceMeters > 0) {
    if (sellerVisible && Number.isFinite(sellerDistanceM) && sellerDistanceM <= lockDistanceMeters) {
      sellerVisible = false;
    }
    if (buyerVisible && Number.isFinite(buyerDistanceM) && buyerDistanceM <= lockDistanceMeters) {
      buyerVisible = false;
    }
  }

  assignment.pickup = {
    ...(assignment.pickup || {}),
    coordinates: sellerVisible ? assignment?.pickup?.coordinates || null : null,
    locationVisible: sellerVisible
  };
  assignment.dropoff = {
    ...(assignment.dropoff || {}),
    coordinates: buyerVisible ? assignment?.dropoff?.coordinates || null : null,
    locationVisible: buyerVisible
  };
  assignment.mapAccess = {
    sellerLocationVisible: sellerVisible,
    buyerLocationVisible: buyerVisible,
    lockedAfterDistanceMeters: lockDistanceMeters,
    lockedAfterStatus: lockOnStatus,
    sellerDistanceMeters: Number.isFinite(sellerDistanceM) ? sellerDistanceM : null,
    buyerDistanceMeters: Number.isFinite(buyerDistanceM) ? buyerDistanceM : null
  };

  // Backward/forward compatibility for API consumers expecting delivery-agent naming.
  assignment.agentStatus = String(assignment.assignmentStatus || 'PENDING').toUpperCase();
  assignment.workflowStatus = String(assignment.status || 'PENDING').toUpperCase();
  assignment.deliveryFee = Number(assignment.deliveryPrice || 0);

  return assignment;
};

const toCourierAssignments = async (entries = [], options = {}) => {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return [];
  const locationMaps = await buildLocationNameMaps(list);
  const agentCoordinates = options?.agentCoordinates || null;
  const runtime = options?.runtime || null;
  const exposeDeliveryPin = options?.exposeDeliveryPin !== false;
  return list.map((entry) =>
    decorateAssignmentForAgentView(
      toCourierAssignment(entry, locationMaps, { exposeDeliveryPin }),
      entry,
      runtime,
      agentCoordinates
    )
  );
};

const toCourierAssignmentResolved = async (entry, options = {}) => {
  const list = await toCourierAssignments([entry], options);
  return list[0] || toCourierAssignment(entry, null, { exposeDeliveryPin: options?.exposeDeliveryPin !== false });
};

const canUseCourierMode = (user = {}) => {
  const role = String(user?.role || '').toLowerCase();
  return (
    role === 'delivery_agent' ||
    hasAnyPermission(user, [
      'courier_view_assignments',
      'courier_accept_assignment',
      'courier_update_status',
      'courier_upload_proof'
    ])
  );
};

const isStrictDeliveryPortalRequest = (req = {}) =>
  String(req?.baseUrl || '').toLowerCase().includes('/api/delivery');

const resolveCourierContext = async (req, { requireAgentFlag = true, allowAdminPreview = true } = {}) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (requireAgentFlag && !runtime.enableDeliveryAgents) {
    const err = new Error('Le mode livreur est désactivé.');
    err.statusCode = 403;
    throw err;
  }

  const userId = normalizeText(req.user?.id || req.user?._id || '');
  const userPhone = normalizeText(req.user?.phone || '');
  const requestedDeliveryGuyId = normalizeText(req.query?.deliveryGuyId || req.body?.deliveryGuyId || '');
  const canManageAsAdmin = canManageDeliveryRequests(req.user, runtime);

  let deliveryGuy = null;
  if (isObjectId(userId)) {
    deliveryGuy = await DeliveryGuy.findOne({ userId }).lean();
  }
  if (!deliveryGuy && userPhone) {
    deliveryGuy = await DeliveryGuy.findOne({ phone: userPhone }).lean();
  }
  // Fallback: match by phone digits (e.g. "0612345678" vs "612345678") so the same person's account is linked
  if (!deliveryGuy && userPhone) {
    const userDigits = normalizePhoneToDigits(userPhone);
    if (userDigits.length >= 8) {
      const candidates = await DeliveryGuy.find({ phone: { $exists: true, $ne: '' } })
        .select('_id userId fullName name phone isActive active photoUrl')
        .lean();
      deliveryGuy = candidates.find(
        (dg) => normalizePhoneToDigits(dg?.phone || '') === userDigits
      ) || null;
    }
  }
  if (!deliveryGuy && canManageAsAdmin && isObjectId(requestedDeliveryGuyId)) {
    deliveryGuy = await DeliveryGuy.findById(requestedDeliveryGuyId).lean();
    if (!deliveryGuy) {
      const err = new Error('Livreur introuvable pour la simulation.');
      err.statusCode = 404;
      throw err;
    }
  }

  if (!deliveryGuy) {
    if (canManageAsAdmin && allowAdminPreview) {
      return {
        runtime,
        deliveryGuy: null,
        previewMode: true
      };
    }
    const err = new Error('Aucun profil livreur actif lié à ce compte.');
    err.statusCode = 403;
    throw err;
  }

  const isActive =
    typeof deliveryGuy.isActive === 'boolean'
      ? deliveryGuy.isActive
      : typeof deliveryGuy.active === 'boolean'
      ? deliveryGuy.active
      : true;

  if (!isActive) {
    const err = new Error('Votre profil livreur est inactif.');
    err.statusCode = 403;
    throw err;
  }

  if (!canUseCourierMode(req.user)) {
    // Backward compatibility: linked delivery-guy accounts are allowed even before role migration.
    // This preserves existing accounts while introducing RBAC-friendly permissions.
  }

  if (!deliveryGuy.userId && isObjectId(userId)) {
    await DeliveryGuy.updateOne({ _id: deliveryGuy._id }, { $set: { userId } });
    deliveryGuy.userId = userId;
  }

  return { runtime, deliveryGuy, previewMode: false };
};

const ensureAssignedToCourier = (requestDoc, deliveryGuyId) => {
  const assignedRaw = requestDoc?.assignedDeliveryGuyId;
  const assigned = String(
    (assignedRaw && typeof assignedRaw === 'object' ? assignedRaw?._id : assignedRaw) || ''
  );
  return Boolean(assigned) && assigned === String(deliveryGuyId || '');
};

const loadCourierAssignmentById = async (requestId) =>
  DeliveryRequest.findById(requestId)
    .populate(
      'orderId',
      '_id status deliveryMode deliveryAddress deliveryCity deliveryCode platformDeliveryStatus shippingAddressSnapshot'
    )
    .populate('sellerId', '_id name shopName phone city commune')
    .populate('buyerId', '_id name phone city commune address')
    .populate(DELIVERY_GUY_POPULATE);

export const listCourierAssignments = asyncHandler(async (req, res) => {
  const allowAdminPreview = !isStrictDeliveryPortalRequest(req);
  const { runtime, deliveryGuy, previewMode } = await resolveCourierContext(req, {
    allowAdminPreview
  });
  const {
    status = '',
    date = '',
    pickupCommune = '',
    dropoffCommune = '',
    page = 1,
    limit = 20
  } = req.query || {};

  if (previewMode) {
    return res.json({
      items: [],
      total: 0,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.max(1, Math.min(50, Number(limit) || 20)),
      totalPages: 1,
      previewMode: true,
      message: 'Sélectionnez un livreur pour afficher ses affectations.'
    });
  }

  const filter = { assignedDeliveryGuyId: deliveryGuy._id };
  const normalizedStatus = normalizeText(status).toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    if (['PENDING', 'ACCEPTED', 'REJECTED'].includes(normalizedStatus)) {
      filter.assignmentStatus = normalizedStatus;
    } else {
      filter.status = normalizedStatus;
    }
  }

  if (isObjectId(pickupCommune)) {
    filter['pickup.communeId'] = pickupCommune;
  }
  if (isObjectId(dropoffCommune)) {
    filter['dropoff.communeId'] = dropoffCommune;
  }

  if (String(date || '').toLowerCase() === 'today') {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    filter.updatedAt = { $gte: from, $lte: to };
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    DeliveryRequest.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate(
        'orderId',
        '_id status deliveryMode deliveryAddress deliveryCity deliveryCode platformDeliveryStatus shippingAddressSnapshot'
      )
      .populate('sellerId', '_id name shopName phone city commune')
      .populate('buyerId', '_id name phone city commune address')
      .populate(DELIVERY_GUY_POPULATE)
      .lean(),
    DeliveryRequest.countDocuments(filter)
  ]);

  return res.json({
    items: await toCourierAssignments(items, { runtime, exposeDeliveryPin: !previewMode }),
    total,
    page: pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
});

export const getCourierAssignmentById = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }

  return res.json({ item: await toCourierAssignmentResolved(assignment, { runtime }) });
});

export const acceptCourierAssignment = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(String(assignment.status || '').toUpperCase())) {
    return res.status(409).json({ message: 'Cette demande est déjà clôturée.' });
  }

  if (String(assignment.assignmentStatus || '').toUpperCase() === 'ACCEPTED') {
    return res.json({
      message: 'Affectation déjà acceptée.',
      idempotent: true,
      item: await toCourierAssignmentResolved(assignment, { runtime })
    });
  }

  assignment.assignmentStatus = 'ACCEPTED';
  assignment.assignmentAcceptedAt = new Date();
  assignment.assignmentRejectedAt = null;
  assignment.assignmentRejectReason = '';
  assignment.status = 'ACCEPTED';
  assignment.currentStage = 'ACCEPTED';
  assignment.mapAccess = {
    ...(assignment.mapAccess || {}),
    sellerVisibleUntil: new Date(
      Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
    ),
    buyerVisibleUntil: new Date(
      Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
    ),
    lockedAfterDistanceMeters: Number(runtime.locationLockDistanceMeters || 120),
    lockedAfterStatus: String(runtime.locationLockOnStatus || 'DELIVERED').toUpperCase(),
    sellerLockedAt: null,
    buyerLockedAt: null
  };
  appendTimeline(assignment, {
    type: 'COURIER_ACCEPTED',
    by: req.user.id,
    meta: {
      courierId: String(deliveryGuy._id),
      courierName: deliveryGuy.fullName || deliveryGuy.name || ''
    }
  });

  // Delivery PIN is owned by seller flow. Courier no longer auto-generates it on accept.

  await assignment.save();

  await updateOrderPlatformDeliveryState({
    orderId: assignment.orderId?._id || assignment.orderId,
    requestId: assignment._id,
    stage: 'ACCEPTED',
    deliveryGuyId: deliveryGuy._id
  });

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [
      String(assignment.sellerId?._id || assignment.sellerId),
      String(assignment.buyerId?._id || assignment.buyerId)
    ],
    type: 'delivery_request_accepted',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      status: 'ACCEPTED',
      courierName: deliveryGuy.fullName || deliveryGuy.name || ''
    },
    priority: 'HIGH'
  });

  const managerRecipients = await getManagerRecipients(runtime);
  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: managerRecipients,
    type: 'delivery_request_accepted',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      status: 'ACCEPTED',
      assignmentStatus: 'ACCEPTED',
      courierName: deliveryGuy.fullName || deliveryGuy.name || '',
      forAdmin: true
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.sellerId?._id || assignment.sellerId,
    actionType: 'COURIER_ACCEPTED',
    newValue: {
      deliveryRequestId: String(assignment._id),
      orderId: String(assignment.orderId?._id || assignment.orderId),
      courierId: String(deliveryGuy._id)
    },
    req,
    meta: {
      previousAssignmentStatus: 'PENDING',
      newAssignmentStatus: 'ACCEPTED'
    }
  });

  await Promise.all([
    invalidateSellerCache(assignment.sellerId?._id || assignment.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(assignment.buyerId?._id || assignment.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadCourierAssignmentById(requestId);
  return res.json({
    message: 'Affectation acceptée.',
    item: await toCourierAssignmentResolved(hydrated, { runtime })
  });
});

export const rejectCourierAssignment = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  const reason = normalizeText(req.body?.reason || req.body?.rejectionReason || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }
  if (!reason) {
    return res.status(400).json({ message: 'Veuillez renseigner un motif de refus.' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }
  if (['DELIVERED', 'FAILED', 'CANCELED'].includes(String(assignment.status || '').toUpperCase())) {
    return res.status(409).json({ message: 'Cette demande est déjà clôturée.' });
  }

  assignment.assignmentStatus = 'REJECTED';
  assignment.assignmentRejectedAt = new Date();
  assignment.assignmentRejectReason = reason;
  assignment.assignmentAcceptedAt = null;
  assignment.assignedDeliveryGuyId = null;
  assignment.status = 'PENDING';
  assignment.currentStage = 'ASSIGNED';

  appendTimeline(assignment, {
    type: 'COURIER_REJECTED',
    by: req.user.id,
    meta: {
      reason,
      courierId: String(deliveryGuy._id),
      courierName: deliveryGuy.fullName || deliveryGuy.name || ''
    }
  });
  await assignment.save();

  await updateOrderPlatformDeliveryState({
    orderId: assignment.orderId?._id || assignment.orderId,
    requestId: assignment._id,
    stage: 'ASSIGNED',
    deliveryGuyId: null
  });

  const managerRecipients = await getManagerRecipients(runtime);
  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: managerRecipients,
    type: 'delivery_request_rejected',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      status: 'PENDING',
      assignmentStatus: 'REJECTED',
      rejectionReason: reason,
      rejectedByCourier: true,
      forAdmin: true
    },
    priority: 'HIGH'
  });

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [String(assignment.sellerId?._id || assignment.sellerId)],
    type: 'delivery_request_rejected',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      status: 'PENDING',
      rejectionReason: reason,
      rejectedByCourier: true
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.sellerId?._id || assignment.sellerId,
    actionType: 'COURIER_REJECTED',
    newValue: {
      deliveryRequestId: String(assignment._id),
      orderId: String(assignment.orderId?._id || assignment.orderId),
      reason
    },
    req
  });

  await Promise.all([
    invalidateSellerCache(assignment.sellerId?._id || assignment.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(assignment.buyerId?._id || assignment.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  return res.json({
    message: 'Affectation refusée. La demande retourne en file d’attente.',
    item: await toCourierAssignmentResolved(assignment, { runtime })
  });
});

export const updateCourierAssignmentStage = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  const nextStage = normalizeStage(req.body?.stage || req.body?.nextStage || '');
  const note = normalizeText(req.body?.note || req.body?.reason || '');
  const deliveryPinCode = normalizeText(req.body?.deliveryPinCode || '');

  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }
  if (!nextStage) {
    return res.status(400).json({ message: 'Étape de livraison invalide.' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }

  const currentStage = normalizeStage(assignment.currentStage || 'ASSIGNED') || 'ASSIGNED';
  if (currentStage === nextStage) {
    return res.json({
      message: 'Étape déjà à jour.',
      idempotent: true,
      item: await toCourierAssignmentResolved(assignment, { runtime })
    });
  }

  if (
    runtime.courierMustAcceptAssignment &&
    String(assignment.assignmentStatus || '').toUpperCase() !== 'ACCEPTED' &&
    nextStage !== 'ACCEPTED'
  ) {
    return res.status(409).json({ message: 'Le livreur doit accepter l’affectation avant de progresser.' });
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];
  if (!allowed.includes(nextStage)) {
    return res.status(409).json({
      message: `Transition non autorisée: ${currentStage} -> ${nextStage}.`
    });
  }

  if (nextStage === 'DELIVERED' && runtime.enableDeliveryPinCode) {
    const expectedHash = normalizeText(assignment.deliveryPinCodeHash || '');
    if (expectedHash) {
      if (!deliveryPinCode) {
        return res.status(400).json({ message: 'Code de livraison requis pour valider.' });
      }
      if (hashPinCode(deliveryPinCode) !== expectedHash) {
        return res.status(400).json({ message: 'Code de livraison invalide.' });
      }
      if (assignment.deliveryPinCodeExpiresAt && new Date(assignment.deliveryPinCodeExpiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: 'Code de livraison expiré.' });
      }
      appendTimeline(assignment, {
        type: 'DELIVERY_PIN_VERIFIED',
        by: req.user.id,
        meta: { verified: true }
      });
    }
  }

  assignment.currentStage = nextStage;
  if (nextStage === 'ACCEPTED') {
    assignment.assignmentStatus = 'ACCEPTED';
    assignment.assignmentAcceptedAt = assignment.assignmentAcceptedAt || new Date();
    assignment.status = 'ACCEPTED';
  } else if (nextStage === 'FAILED') {
    assignment.status = 'FAILED';
    assignment.rejectionReason = note || assignment.rejectionReason || '';
  } else if (nextStage === 'DELIVERED') {
    assignment.status = 'DELIVERED';
  } else {
    assignment.status = 'IN_PROGRESS';
  }

  appendTimeline(assignment, {
    type: 'COURIER_STAGE_UPDATED',
    by: req.user.id,
    meta: {
      previousStage: currentStage,
      newStage: nextStage,
      note: note || undefined,
      courierId: String(deliveryGuy._id)
    }
  });

  await assignment.save();

  await updateOrderPlatformDeliveryState({
    orderId: assignment.orderId?._id || assignment.orderId,
    requestId: assignment._id,
    stage: nextStage,
    deliveryGuyId: assignment.assignedDeliveryGuyId || deliveryGuy._id
  });

  let type = 'delivery_request_in_progress';
  if (nextStage === 'DELIVERED') type = 'delivery_request_delivered';
  if (nextStage === 'FAILED') type = 'delivery_request_rejected';

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [
      String(assignment.sellerId?._id || assignment.sellerId),
      String(assignment.buyerId?._id || assignment.buyerId)
    ],
    type,
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      stage: nextStage,
      status: assignment.status,
      note: note || undefined
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.sellerId?._id || assignment.sellerId,
    actionType: 'COURIER_STAGE_UPDATED',
    previousValue: { stage: currentStage },
    newValue: {
      stage: nextStage,
      status: assignment.status,
      deliveryRequestId: String(assignment._id)
    },
    req,
    meta: {
      note: note || ''
    }
  });

  await Promise.all([
    invalidateSellerCache(assignment.sellerId?._id || assignment.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(assignment.buyerId?._id || assignment.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadCourierAssignmentById(requestId);
  return res.json({
    message: 'Étape mise à jour.',
    item: await toCourierAssignmentResolved(hydrated, { runtime })
  });
});

export const uploadCourierProof = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  if (!runtime.enableProofUpload) {
    return res.status(403).json({ message: 'Le dépôt de preuve est désactivé.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  const proofType = String(req.body?.proofType || req.query?.proofType || '').trim().toLowerCase();
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }
  if (!['pickup', 'delivery'].includes(proofType)) {
    return res.status(400).json({ message: 'Type de preuve invalide (pickup/delivery).' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }

  if (proofType === 'delivery' && !hasProofContent(assignment.pickupProof || {})) {
    return res.status(409).json({
      message: 'Soumettez d’abord la preuve de pickup avant la preuve de livraison.'
    });
  }

  const files = req.files || {};
  const photoFile = Array.isArray(files.photos) ? files.photos[0] : null;
  const signatureFile = Array.isArray(files.signatureFile) ? files.signatureFile[0] : null;
  const photoUrl = photoFile?.filename ? `uploads/delivery-proofs/${photoFile.filename}` : '';
  const signatureUrl =
    signatureFile?.filename
      ? `uploads/delivery-proofs/${signatureFile.filename}`
      : normalizeText(req.body?.signatureUrl || '');
  const note = normalizeText(req.body?.note || '');

  if (!photoUrl && !signatureUrl && !note) {
    return res.status(400).json({ message: 'Ajoutez au moins une photo, une signature ou une note.' });
  }

  const targetField = proofType === 'delivery' ? 'deliveryProof' : 'pickupProof';
  const previous = assignment[targetField] || {};
  assignment[targetField] = {
    photoUrl: photoUrl || previous.photoUrl || '',
    signatureUrl: signatureUrl || previous.signatureUrl || '',
    note: note || previous.note || '',
    submittedBy: req.user.id,
    submittedAt: new Date()
  };

  if (proofType === 'pickup') {
    assignment.status = 'IN_PROGRESS';
    if (['ASSIGNED', 'ACCEPTED', 'PICKUP_STARTED'].includes(normalizeStage(assignment.currentStage || 'ASSIGNED'))) {
      assignment.currentStage = 'PICKED_UP';
    }
  }
  if (proofType === 'delivery') {
    assignment.status = 'DELIVERED';
    assignment.currentStage = 'DELIVERED';
  }

  appendTimeline(assignment, {
    type: 'COURIER_PROOF_UPLOADED',
    by: req.user.id,
    meta: {
      proofType,
      hasPhoto: Boolean(photoUrl),
      hasSignature: Boolean(signatureUrl)
    }
  });

  await assignment.save();

  await updateOrderPlatformDeliveryState({
    orderId: assignment.orderId?._id || assignment.orderId,
    requestId: assignment._id,
    stage: assignment.currentStage || (proofType === 'delivery' ? 'DELIVERED' : 'PICKED_UP'),
    deliveryGuyId: assignment.assignedDeliveryGuyId || deliveryGuy._id
  });

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [
      String(assignment.sellerId?._id || assignment.sellerId),
      String(assignment.buyerId?._id || assignment.buyerId)
    ],
    type: proofType === 'delivery' ? 'delivery_request_delivered' : 'delivery_request_in_progress',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      proofType,
      stage: assignment.currentStage,
      status: assignment.status
    },
    priority: 'HIGH'
  });

  const managerRecipients = await getManagerRecipients(runtime);
  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: managerRecipients,
    type: proofType === 'delivery' ? 'delivery_request_delivered' : 'delivery_request_in_progress',
    metadata: {
      orderId: assignment.orderId?._id || assignment.orderId,
      deliveryRequestId: assignment._id,
      proofType,
      stage: assignment.currentStage,
      status: assignment.status,
      proofUploaded: true,
      forAdmin: true
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.sellerId?._id || assignment.sellerId,
    actionType: 'COURIER_PROOF_UPLOADED',
    newValue: {
      deliveryRequestId: String(assignment._id),
      orderId: String(assignment.orderId?._id || assignment.orderId),
      proofType,
      stage: assignment.currentStage
    },
    req
  });

  await Promise.all([
    invalidateSellerCache(assignment.sellerId?._id || assignment.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(assignment.buyerId?._id || assignment.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadCourierAssignmentById(requestId);
  return res.json({
    message: proofType === 'delivery' ? 'Preuve de livraison enregistrée.' : 'Preuve de pickup enregistrée.',
    item: await toCourierAssignmentResolved(hydrated, { runtime })
  });
});

export const getCourierModeBootstrap = asyncHandler(async (req, res) => {
  const allowAdminPreview = !isStrictDeliveryPortalRequest(req);
  const { runtime, deliveryGuy, previewMode } = await resolveCourierContext(req, {
    requireAgentFlag: false,
    allowAdminPreview
  });
  if (previewMode) {
    const availableDeliveryGuys = await DeliveryGuy.find({
      $or: [{ isActive: true }, { active: true }]
    })
      .select('_id userId fullName name phone cityId communes photoUrl')
      .populate('userId', '_id name shopLogo')
      .sort({ fullName: 1, name: 1 })
      .limit(200)
      .lean();
    return res.json({
      enabled: Boolean(runtime.enableDeliveryAgents),
      previewMode: true,
      deliveryGuy: null,
      availableDeliveryGuys: availableDeliveryGuys.map((entry) => {
        const publicEntry = toPublicDeliveryGuy(entry);
        return {
          _id: publicEntry?._id || entry?._id,
          fullName: publicEntry?.fullName || '',
          phone: publicEntry?.phone || '',
          cityId: publicEntry?.cityId || entry?.cityId || null,
          communes: Array.isArray(publicEntry?.communes)
            ? publicEntry.communes
            : Array.isArray(entry?.communes)
            ? entry.communes
            : [],
          photoUrl: publicEntry?.photoUrl || '',
          profileImage: publicEntry?.profileImage || ''
        };
      })
    });
  }
  const publicDeliveryGuy = toPublicDeliveryGuy(deliveryGuy);
  return res.json({
    enabled: Boolean(runtime.enableDeliveryAgents),
    previewMode: false,
    deliveryGuy: {
      _id: publicDeliveryGuy?._id || deliveryGuy._id,
      fullName: publicDeliveryGuy?.fullName || '',
      phone: publicDeliveryGuy?.phone || '',
      cityId: publicDeliveryGuy?.cityId || deliveryGuy.cityId || null,
      communes: Array.isArray(publicDeliveryGuy?.communes)
        ? publicDeliveryGuy.communes
        : Array.isArray(deliveryGuy.communes)
        ? deliveryGuy.communes
        : [],
      photoUrl: publicDeliveryGuy?.photoUrl || '',
      profileImage: publicDeliveryGuy?.profileImage || ''
    }
  });
});

export const getDeliveryAgentMe = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, {
    allowAdminPreview: false,
    requireAgentFlag: true
  });
  const publicDeliveryGuy = toPublicDeliveryGuy(deliveryGuy);
  return res.json({
    role: String(req.user?.role || '').toLowerCase(),
    permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : [],
    runtime: {
      enableDeliveryAgents: Boolean(runtime.enableDeliveryAgents),
      courierMustAcceptAssignment: Boolean(runtime.courierMustAcceptAssignment),
      enableProofUpload: Boolean(runtime.enableProofUpload),
      enableDeliveryPinCode: Boolean(runtime.enableDeliveryPinCode),
      locationLockEnabled: Boolean(runtime.locationLockEnabled),
      locationLockDistanceMeters: Number(runtime.locationLockDistanceMeters || 0),
      locationLockOnStatus: String(runtime.locationLockOnStatus || 'DELIVERED')
    },
    deliveryGuy: {
      _id: publicDeliveryGuy?._id || deliveryGuy._id,
      fullName: publicDeliveryGuy?.fullName || '',
      phone: publicDeliveryGuy?.phone || '',
      cityId: publicDeliveryGuy?.cityId || deliveryGuy.cityId || null,
      communes: Array.isArray(publicDeliveryGuy?.communes)
        ? publicDeliveryGuy.communes
        : Array.isArray(deliveryGuy.communes)
        ? deliveryGuy.communes
        : [],
      photoUrl: publicDeliveryGuy?.photoUrl || '',
      profileImage: publicDeliveryGuy?.profileImage || ''
    }
  });
});

export const getDeliveryAgentStats = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, {
    allowAdminPreview: false,
    requireAgentFlag: true
  });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const assignments = await DeliveryRequest.find({
    assignedDeliveryGuyId: deliveryGuy._id,
    createdAt: { $gte: since }
  })
    .select(
      '_id status assignmentStatus assignmentAcceptedAt pickupProof deliveryProof deliveryPrice assignmentRejectReason createdAt'
    )
    .lean();

  const stats = {
    total: assignments.length,
    assigned: 0,
    accepted: 0,
    inProgress: 0,
    delivered: 0,
    failed: 0,
    rejected: 0,
    completionRate: 0,
    acceptanceRate: 0,
    deliveryFeeRevenue: 0,
    avgAcceptToPickupMinutes: null,
    avgPickupToDeliveredMinutes: null
  };

  let acceptToPickupTotalMs = 0;
  let acceptToPickupCount = 0;
  let pickupToDeliveredTotalMs = 0;
  let pickupToDeliveredCount = 0;

  for (const row of assignments) {
    const status = String(row?.status || '').toUpperCase();
    const assignmentStatus = String(row?.assignmentStatus || '').toUpperCase();
    if (assignmentStatus === 'PENDING') stats.assigned += 1;
    if (assignmentStatus === 'ACCEPTED') stats.accepted += 1;
    if (assignmentStatus === 'REJECTED') stats.rejected += 1;
    if (status === 'IN_PROGRESS' || status === 'ACCEPTED') stats.inProgress += 1;
    if (status === 'DELIVERED') stats.delivered += 1;
    if (status === 'FAILED') stats.failed += 1;
    if (status === 'DELIVERED') {
      stats.deliveryFeeRevenue += Math.max(0, Number(row?.deliveryPrice || 0));
    }

    const acceptedAtMs = row?.assignmentAcceptedAt ? new Date(row.assignmentAcceptedAt).getTime() : 0;
    const pickupAtMs = row?.pickupProof?.submittedAt ? new Date(row.pickupProof.submittedAt).getTime() : 0;
    const deliveredAtMs = row?.deliveryProof?.submittedAt ? new Date(row.deliveryProof.submittedAt).getTime() : 0;
    if (acceptedAtMs && pickupAtMs && pickupAtMs >= acceptedAtMs) {
      acceptToPickupTotalMs += pickupAtMs - acceptedAtMs;
      acceptToPickupCount += 1;
    }
    if (pickupAtMs && deliveredAtMs && deliveredAtMs >= pickupAtMs) {
      pickupToDeliveredTotalMs += deliveredAtMs - pickupAtMs;
      pickupToDeliveredCount += 1;
    }
  }

  stats.completionRate = stats.total ? Number(((stats.delivered / stats.total) * 100).toFixed(1)) : 0;
  stats.acceptanceRate = stats.total ? Number((((stats.accepted + stats.delivered) / stats.total) * 100).toFixed(1)) : 0;
  stats.avgAcceptToPickupMinutes = acceptToPickupCount
    ? Math.round(acceptToPickupTotalMs / acceptToPickupCount / 60000)
    : null;
  stats.avgPickupToDeliveredMinutes = pickupToDeliveredCount
    ? Math.round(pickupToDeliveredTotalMs / pickupToDeliveredCount / 60000)
    : null;

  return res.json({ since, stats });
});

export const pingDeliveryAgentLocation = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, {
    allowAdminPreview: false,
    requireAgentFlag: true
  });
  const requestId = normalizeText(req.body?.jobId || req.body?.assignmentId || req.body?.deliveryRequestId || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande de livraison invalide.' });
  }

  const lat = toFiniteNumber(req.body?.lat, null);
  const lng = toFiniteNumber(req.body?.lng, null);
  if (lat === null || lng === null) {
    return res.status(400).json({ message: 'Coordonnées agent invalides.' });
  }

  const assignment = await loadCourierAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }

  const agentCoordinates = { lat, lng };
  const pickupCoords = extractLngLatFromGeoPoint(assignment?.pickup?.coordinates);
  const dropoffCoords = extractLngLatFromGeoPoint(assignment?.dropoff?.coordinates);
  const distanceToPickupM = haversineMeters(agentCoordinates, pickupCoords);
  const distanceToDropoffM = haversineMeters(agentCoordinates, dropoffCoords);
  const lockThreshold = Math.max(0, Number(runtime.locationLockDistanceMeters || 0));
  const lockEnabled = Boolean(runtime.locationLockEnabled);
  const statusLocked = lockEnabled
    ? shouldLockByStatus({
        currentStage: assignment.currentStage,
        lockOnStatus: String(runtime.locationLockOnStatus || 'DELIVERED').toUpperCase()
      })
    : false;

  const now = new Date();
  const mapAccess = assignment.mapAccess && typeof assignment.mapAccess === 'object' ? assignment.mapAccess : {};
  let lockedChanged = false;
  mapAccess.lastAgentPingAt = now;
  mapAccess.lastAgentDistanceToPickupM = Number.isFinite(distanceToPickupM) ? distanceToPickupM : null;
  mapAccess.lastAgentDistanceToDropoffM = Number.isFinite(distanceToDropoffM) ? distanceToDropoffM : null;

  if (lockEnabled) {
    if (statusLocked) {
      if (!mapAccess.sellerLockedAt) {
        mapAccess.sellerLockedAt = now;
        lockedChanged = true;
      }
      if (!mapAccess.buyerLockedAt) {
        mapAccess.buyerLockedAt = now;
        lockedChanged = true;
      }
    } else if (lockThreshold > 0) {
      if (!mapAccess.sellerLockedAt && Number.isFinite(distanceToPickupM) && distanceToPickupM <= lockThreshold) {
        mapAccess.sellerLockedAt = now;
        lockedChanged = true;
      }
      if (!mapAccess.buyerLockedAt && Number.isFinite(distanceToDropoffM) && distanceToDropoffM <= lockThreshold) {
        mapAccess.buyerLockedAt = now;
        lockedChanged = true;
      }
    }
  }

  assignment.mapAccess = mapAccess;

  if (lockedChanged) {
    appendTimeline(assignment, {
      type: 'DELIVERY_LOCATION_LOCKED',
      by: req.user.id,
      meta: {
        requestId: String(assignment._id),
        lockThreshold,
        statusLocked,
        distanceToPickupM: Number.isFinite(distanceToPickupM) ? distanceToPickupM : null,
        distanceToDropoffM: Number.isFinite(distanceToDropoffM) ? distanceToDropoffM : null
      }
    });
  }

  await assignment.save();

  const payload = await toCourierAssignmentResolved(assignment, { runtime, agentCoordinates });

  return res.json({
    item: payload,
    distanceToPickupM: Number.isFinite(distanceToPickupM) ? distanceToPickupM : null,
    distanceToDropoffM: Number.isFinite(distanceToDropoffM) ? distanceToDropoffM : null,
    sellerLocationVisible: Boolean(payload?.mapAccess?.sellerLocationVisible),
    buyerLocationVisible: Boolean(payload?.mapAccess?.buyerLocationVisible)
  });
});

export const logDeliveryAgentLogout = asyncHandler(async (req, res) => {
  if (!canUseCourierMode(req.user)) {
    return res.status(403).json({ message: 'Accès refusé au mode livreur.' });
  }
  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: req.user.id,
    actionType: 'DELIVERY_AGENT_LOGOUT',
    req,
    newValue: { source: 'delivery_portal' }
  });
  return res.json({ success: true });
});

export const assignCourierFromAdmin = async ({
  requestDoc,
  deliveryGuyId,
  actorId,
  req,
  runtime
}) => {
  if (!requestDoc || !deliveryGuyId) return null;
  const deliveryGuy = await DeliveryGuy.findById(deliveryGuyId).lean();
  if (!deliveryGuy) return null;

  requestDoc.assignedDeliveryGuyId = deliveryGuyId;
  requestDoc.assignmentStatus = runtime?.courierMustAcceptAssignment ? 'PENDING' : 'ACCEPTED';
  requestDoc.assignmentAcceptedAt = runtime?.courierMustAcceptAssignment ? null : new Date();
  requestDoc.assignmentRejectedAt = null;
  requestDoc.assignmentRejectReason = '';
  requestDoc.currentStage = runtime?.courierMustAcceptAssignment ? 'ASSIGNED' : 'ACCEPTED';
  requestDoc.status = runtime?.courierMustAcceptAssignment ? 'ACCEPTED' : 'IN_PROGRESS';
  requestDoc.mapAccess = {
    ...(requestDoc.mapAccess || {}),
    sellerVisibleUntil: new Date(
      Date.now() + Number(runtime?.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
    ),
    buyerVisibleUntil: new Date(
      Date.now() + Number(runtime?.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
    ),
    lockedAfterDistanceMeters: Number(runtime?.locationLockDistanceMeters || 120),
    lockedAfterStatus: String(runtime?.locationLockOnStatus || 'DELIVERED').toUpperCase(),
    sellerLockedAt: null,
    buyerLockedAt: null
  };

  appendTimeline(requestDoc, {
    type: 'COURIER_ASSIGNED',
    by: actorId,
    meta: {
      courierId: String(deliveryGuy._id),
      courierName: deliveryGuy.fullName || deliveryGuy.name || '',
      courierMustAcceptAssignment: Boolean(runtime?.courierMustAcceptAssignment)
    }
  });

  await requestDoc.save();

  await updateOrderPlatformDeliveryState({
    orderId: requestDoc.orderId,
    requestId: requestDoc._id,
    stage: requestDoc.currentStage,
    deliveryGuyId: deliveryGuy._id
  });

  const recipients = [];
  if (deliveryGuy.userId) recipients.push(String(deliveryGuy.userId));
  await emitNotificationBatch({
    actorId,
    recipients,
    type: 'delivery_request_assigned',
    metadata: {
      orderId: requestDoc.orderId,
      deliveryRequestId: requestDoc._id,
      status: requestDoc.status,
      assignmentStatus: requestDoc.assignmentStatus,
      courierId: String(deliveryGuy._id)
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: actorId,
    targetUser: requestDoc.sellerId,
    actionType: 'COURIER_ASSIGNED',
    newValue: {
      deliveryRequestId: String(requestDoc._id),
      orderId: String(requestDoc.orderId),
      courierId: String(deliveryGuy._id)
    },
    req,
    meta: {
      assignmentStatus: requestDoc.assignmentStatus
    }
  });

  return requestDoc;
};

export const canManageCourierAssignments = (user, runtime) =>
  canManageDeliveryRequests(user, runtime);
