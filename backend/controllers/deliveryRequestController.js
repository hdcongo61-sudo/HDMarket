import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import {
  assertPlatformDeliveryEnabled,
  canManageDeliveryRequests,
  getAdminRuleDeliveryPrice,
  resolvePlatformDeliveryPrice
} from '../services/platformDeliveryService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import {
  invalidateAdminCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';
import { assignCourierFromAdmin } from './courierDeliveryController.js';

const ACTIVE_DELIVERY_REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];
const TERMINAL_DELIVERY_REQUEST_STATUSES = ['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'];
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const isObjectId = (value = '') => OBJECT_ID_REGEX.test(String(value || '').trim());

const escapeRegex = (value = '') =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value = '') => String(value || '').trim();
const pickFirstText = (...values) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
};
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const resolveDeliveryGuyProfileImage = (deliveryGuy = {}) =>
  pickFirstText(
    deliveryGuy?.photoUrl,
    deliveryGuy?.profileImage,
    deliveryGuy?.userId?.shopLogo
  );
const toPublicAssignedDeliveryGuy = (value) => {
  if (!value || typeof value !== 'object') return value;
  const raw = value?.toObject ? value.toObject() : value;
  const userObject = raw?.userId && typeof raw.userId === 'object' ? raw.userId : null;
  const profileImage = resolveDeliveryGuyProfileImage(raw);
  const isActive =
    typeof raw?.isActive === 'boolean'
      ? raw.isActive
      : typeof raw?.active === 'boolean'
      ? raw.active
      : true;
  return {
    ...raw,
    userId: userObject?._id || raw?.userId || null,
    fullName: pickFirstText(raw?.fullName, raw?.name),
    name: pickFirstText(raw?.name, raw?.fullName),
    photoUrl: profileImage,
    profileImage,
    isActive,
    active: isActive
  };
};

const DELIVERY_PIN_SECRET = normalizeText(
  process.env.DELIVERY_PIN_SECRET || process.env.JWT_SECRET || process.env.SECRET_KEY || ''
);
const DELIVERY_PIN_KEY = DELIVERY_PIN_SECRET
  ? crypto.createHash('sha256').update(DELIVERY_PIN_SECRET).digest()
  : null;

const hashDeliveryPin = (value = '') =>
  crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');

const encryptDeliveryPin = (value = '') => {
  const pin = normalizeText(value);
  if (!pin) return '';
  // If no encryption key is configured, store the pin in clear text so couriers can still see it.
  if (!DELIVERY_PIN_KEY) return pin;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DELIVERY_PIN_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const toUploadedProofUrl = (file) => {
  if (!file?.filename) return '';
  return `uploads/delivery-proofs/${file.filename}`;
};

const firstFileFromFields = (fields = {}, name = '') => {
  const list = Array.isArray(fields?.[name]) ? fields[name] : [];
  return list[0] || null;
};

const getTimelineEventAt = (timeline = [], types = []) => {
  const typeSet = new Set((Array.isArray(types) ? types : [types]).map((item) => String(item)));
  const list = Array.isArray(timeline) ? timeline : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entry = list[index];
    if (typeSet.has(String(entry?.type || '')) && entry?.at) {
      const date = new Date(entry.at);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
};

const isEmptyParam = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return !s || s === 'undefined' || s === 'null';
};

const buildDeliveryRequestFilter = (query = {}, { forAnalytics = false } = {}) => {
  const raw = query || {};
  const status = isEmptyParam(raw.status) ? '' : String(raw.status || '').trim();
  const pickupCommune = isEmptyParam(raw.pickupCommune) ? '' : String(raw.pickupCommune || '').trim();
  const dropoffCommune = isEmptyParam(raw.dropoffCommune) ? '' : String(raw.dropoffCommune || '').trim();
  const city = isEmptyParam(raw.city) ? '' : String(raw.city || '').trim();
  const dateFrom = isEmptyParam(raw.dateFrom) ? '' : String(raw.dateFrom || '').trim();
  const dateTo = isEmptyParam(raw.dateTo) ? '' : String(raw.dateTo || '').trim();
  const shop = isEmptyParam(raw.shop) ? '' : String(raw.shop || '').trim();
  const priceMin = isEmptyParam(raw.priceMin) ? '' : String(raw.priceMin || '').trim();
  const priceMax = isEmptyParam(raw.priceMax) ? '' : String(raw.priceMax || '').trim();

  const filter = {};
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    // Match status case-insensitively so DB values like "pending" or "PENDING" both match
    filter.status = new RegExp(`^${escapeRegex(normalizedStatus)}$`, 'i');
  }

  if (isObjectId(pickupCommune)) {
    filter['pickup.communeId'] = pickupCommune;
  }
  if (isObjectId(dropoffCommune)) {
    filter['dropoff.communeId'] = dropoffCommune;
  }
  if (isObjectId(shop)) {
    filter.shopId = shop;
  }

  const cityText = normalizeText(city);
  if (cityText && cityText !== 'undefined' && cityText !== 'null') {
    if (isObjectId(cityText)) {
      filter.$or = [{ 'pickup.cityId': cityText }, { 'dropoff.cityId': cityText }];
    } else {
      const cityRegex = new RegExp(escapeRegex(cityText), 'i');
      filter.$or = [{ 'pickup.cityName': cityRegex }, { 'dropoff.cityName': cityRegex }];
    }
  }

  // Only apply price filter when user actually provided a value (empty string parses to 0 and would wrongly require deliveryPrice === 0)
  const hasPriceMin = priceMin !== '' && priceMin !== undefined;
  const hasPriceMax = priceMax !== '' && priceMax !== undefined;
  const min = hasPriceMin ? Number(priceMin) : NaN;
  const max = hasPriceMax ? Number(priceMax) : NaN;
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.deliveryPrice = {};
    if (Number.isFinite(min)) filter.deliveryPrice.$gte = Math.max(0, min);
    if (Number.isFinite(max)) filter.deliveryPrice.$lte = Math.max(0, max);
  }

  const defaultFrom = forAnalytics ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : defaultFrom;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : null;
  if (from || to) {
    filter.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
    if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
  }

  return filter;
};

const resolveOrderSellerIdSet = (order) => {
  const set = new Set();
  const items = Array.isArray(order?.items) ? order.items : [];
  items.forEach((item) => {
    const shopId = item?.snapshot?.shopId || item?.product?.user || item?.product?.user?._id || null;
    if (!shopId) return;
    set.add(String(shopId));
  });
  return set;
};

const getOrderItemsForSeller = (order, sellerId) => {
  const sellerKey = String(sellerId || '');
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter((item) => {
    const shopId = item?.snapshot?.shopId || item?.product?.user || item?.product?.user?._id || null;
    return shopId && String(shopId) === sellerKey;
  });
};

const getDeliveryManagerRecipients = async (runtime) => {
  const roles = Array.isArray(runtime?.managerRoles) ? runtime.managerRoles : [];
  const query = {
    $or: [
      { permissions: 'manage_delivery' },
      { canManageDelivery: true }
    ]
  };
  if (roles.length) {
    query.$or.unshift({ role: { $in: roles } });
  }
  const users = await User.find(query).select('_id').lean();
  return users.map((entry) => String(entry._id));
};

const appendTimeline = (requestDoc, event) => {
  const timeline = Array.isArray(requestDoc.timeline) ? requestDoc.timeline : [];
  timeline.push({
    type: event.type,
    by: event.by || null,
    at: event.at || new Date(),
    meta: event.meta && typeof event.meta === 'object' ? event.meta : {}
  });
  requestDoc.timeline = timeline;
};

const toPublicDeliveryRequest = (requestDoc) => {
  if (!requestDoc) return null;
  const raw = requestDoc.toObject ? requestDoc.toObject() : requestDoc;
  const {
    deliveryPinCodeHash: _deliveryPinCodeHash,
    deliveryPinCodeEncrypted: _deliveryPinCodeEncrypted,
    ...safeRaw
  } = raw;
  const productSnapshot = Array.isArray(raw.productSnapshot) ? raw.productSnapshot : [];
  const itemsSnapshot = Array.isArray(raw.itemsSnapshot) ? raw.itemsSnapshot : [];
  const rawOrder = raw.orderId && typeof raw.orderId === 'object' ? raw.orderId : null;
  const rawBuyer = raw.buyerId && typeof raw.buyerId === 'object' ? raw.buyerId : null;
  const rawSeller = raw.sellerId && typeof raw.sellerId === 'object' ? raw.sellerId : null;
  const rawShop = raw.shopId && typeof raw.shopId === 'object' ? raw.shopId : null;
  const snapshot = rawOrder?.shippingAddressSnapshot || {};
  const savedDropoffAddress = pickFirstText(raw?.dropoff?.address);
  const savedPickupAddress = pickFirstText(raw?.pickup?.address);
  const fallbackPickupAddress = pickFirstText(rawSeller?.shopAddress, rawSeller?.address);
  const fallbackDropoffAddress = pickFirstText(
    snapshot?.addressLine,
    snapshot?.address,
    snapshot?.street,
    rawOrder?.deliveryAddress,
    rawBuyer?.address
  );
  const shouldOverrideDropoffAddress =
    !savedDropoffAddress ||
    /^retrait en boutique$/i.test(savedDropoffAddress) ||
    (savedPickupAddress &&
      fallbackDropoffAddress &&
      savedDropoffAddress === savedPickupAddress &&
      savedDropoffAddress !== fallbackDropoffAddress);
  const dropoffAddress = shouldOverrideDropoffAddress ? fallbackDropoffAddress : savedDropoffAddress;
  const pickupAddress = savedPickupAddress || fallbackPickupAddress || '—';
  const dropoff = {
    ...(raw.dropoff || {}),
    cityId: raw?.dropoff?.cityId || snapshot?.cityId || null,
    cityName: pickFirstText(raw?.dropoff?.cityName, snapshot?.cityName, rawOrder?.deliveryCity, rawBuyer?.city),
    communeId: raw?.dropoff?.communeId || snapshot?.communeId || null,
    communeName: pickFirstText(raw?.dropoff?.communeName, snapshot?.communeName, rawBuyer?.commune),
    address: dropoffAddress || '—'
  };
  const pickup = {
    ...(raw.pickup || {}),
    cityId: raw?.pickup?.cityId || null,
    cityName: pickFirstText(raw?.pickup?.cityName),
    communeId: raw?.pickup?.communeId || null,
    communeName: pickFirstText(raw?.pickup?.communeName),
    address: pickupAddress
  };

  return {
    ...safeRaw,
    itemsSnapshot: itemsSnapshot.length ? itemsSnapshot : productSnapshot,
    productSnapshot: productSnapshot.length ? productSnapshot : itemsSnapshot,
    pickup,
    dropoff,
    pickupProof: raw.pickupProof && typeof raw.pickupProof === 'object' ? raw.pickupProof : {},
    deliveryProof: raw.deliveryProof && typeof raw.deliveryProof === 'object' ? raw.deliveryProof : {},
    assignedDeliveryGuyId: toPublicAssignedDeliveryGuy(raw.assignedDeliveryGuyId ?? safeRaw.assignedDeliveryGuyId),
    order: rawOrder
      ? {
          _id: rawOrder._id || null,
          status: rawOrder.status || '',
          totalAmount: rawOrder.totalAmount ?? 0,
          deliveryMode: rawOrder.deliveryMode || '',
          deliveryAddress: rawOrder.deliveryAddress || '',
          deliveryCity: rawOrder.deliveryCity || '',
          createdAt: rawOrder.createdAt || null,
          shippingAddressSnapshot: rawOrder.shippingAddressSnapshot || {}
        }
      : null,
    seller: rawSeller
      ? {
          _id: rawSeller._id || null,
          name: rawSeller.shopName || rawSeller.name || '',
          phone: rawSeller.phone || '',
          city: rawSeller.city || '',
          commune: rawSeller.commune || '',
          address: rawSeller.address || '',
          shopAddress: rawSeller.shopAddress || ''
        }
      : null,
    buyer: rawBuyer
      ? {
          _id: rawBuyer._id || null,
          name: rawBuyer.name || '',
          phone: rawBuyer.phone || snapshot?.phone || '',
          city: rawBuyer.city || '',
          commune: rawBuyer.commune || '',
          address: rawBuyer.address || ''
        }
      : snapshot?.phone
      ? {
          _id: raw.buyerId?._id || raw.buyerId || null,
          name: '',
          phone: snapshot.phone,
          city: '',
          commune: '',
          address: ''
        }
      : null,
    shop: rawShop
      ? {
          _id: rawShop._id || null,
          name: rawShop.shopName || rawShop.name || '',
          phone: rawShop.phone || ''
        }
      : null,
    orderId: raw.orderId?._id || raw.orderId,
    sellerId: raw.sellerId?._id || raw.sellerId,
    buyerId: raw.buyerId?._id || raw.buyerId,
    shopId: raw.shopId?._id || raw.shopId
  };
};

const DELIVERY_GUY_PUBLIC_POPULATE = {
  path: 'assignedDeliveryGuyId',
  select: '_id userId fullName name phone isActive active cityId communes photoUrl',
  populate: { path: 'userId', select: '_id name shopLogo' }
};

const findCityByName = async (name = '') => {
  const clean = normalizeText(name);
  if (!clean) return null;
  return City.findOne({ name: new RegExp(`^${escapeRegex(clean)}$`, 'i') }).lean();
};

const findCommuneByName = async (name = '', cityId = null) => {
  const clean = normalizeText(name);
  if (!clean) return null;
  const query = { name: new RegExp(`^${escapeRegex(clean)}$`, 'i') };
  if (cityId && isObjectId(cityId)) query.cityId = cityId;
  return Commune.findOne(query).lean();
};

const loadDeliveryRequestById = async (id) => {
  return DeliveryRequest.findById(id)
    .populate(
      'orderId',
      '_id status deliveryMode deliveryAddress deliveryCity totalAmount createdAt shippingAddressSnapshot'
    )
    .populate('sellerId', '_id name shopName phone city commune shopAddress address')
    .populate('buyerId', '_id name phone city commune address location')
    .populate('shopId', '_id name shopName phone city commune')
    .populate(DELIVERY_GUY_PUBLIC_POPULATE);
};

const updateOrderPlatformDeliveryState = async ({
  orderId,
  requestId = null,
  platformDeliveryStatus = 'REQUESTED',
  platformDeliveryMode = 'PLATFORM_DELIVERY',
  platformDeliveryPriceSource = null,
  deliveryGuyId = undefined
}) => {
  const payload = {
    platformDeliveryMode,
    platformDeliveryStatus,
    platformDeliveryRequestId: requestId
  };
  if (platformDeliveryPriceSource) {
    payload.platformDeliveryPriceSource = platformDeliveryPriceSource;
  }
  if (deliveryGuyId !== undefined) {
    payload.deliveryGuy = deliveryGuyId || null;
  }
  await Order.updateOne({ _id: orderId }, { $set: payload });
};

const emitDeliveryNotifications = async ({
  actorId,
  orderId,
  deliveryRequestId,
  pickupCommuneId = null,
  dropoffCommuneId = null,
  recipients = [],
  type = 'delivery_request_created',
  extraMetadata = {},
  priority = 'HIGH',
  audience = 'USER',
  targetRole = [],
  actionRequired = false,
  actionType = 'NONE',
  actionStatus = 'DONE',
  deepLink = '',
  validationType = 'other'
}) => {
  const uniqueRecipients = Array.from(
    new Set((Array.isArray(recipients) ? recipients : []).map((item) => String(item || '')).filter(Boolean))
  );
  if (!uniqueRecipients.length) return;
  await Promise.all(
    uniqueRecipients.map((userId) =>
      createNotification({
        userId,
        actorId,
        type,
        metadata: {
          orderId,
          deliveryRequestId,
          pickupCommuneId,
          dropoffCommuneId,
          ...extraMetadata
        },
        allowSelf: true,
        priority,
        audience,
        targetRole,
        actionRequired,
        actionType,
        actionStatus,
        deepLink,
        actionLink: deepLink,
        entityType: deliveryRequestId ? 'deliveryRequest' : '',
        entityId: deliveryRequestId ? String(deliveryRequestId) : '',
        validationType
      })
    )
  );
};

export const requestPlatformDeliveryForOrder = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  const orderId = normalizeText(req.params?.id || req.params?.orderId || '');
  if (!isObjectId(orderId)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }

  const order = await Order.findById(orderId).select(
    '_id customer items status deliveryMode deliveryAddress deliveryCity shippingAddressSnapshot totalAmount deliveryFeeTotal'
  );
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (String(order.deliveryMode || '').toUpperCase() !== 'DELIVERY') {
    return res.status(400).json({ message: 'La commande doit être en mode livraison pour demander la plateforme.' });
  }

  const sellerId = String(req.user?.id || req.user?._id || '');
  const sellerIds = resolveOrderSellerIdSet(order);
  if (!sellerIds.has(sellerId)) {
    return res.status(403).json({ message: 'Vous ne pouvez demander la livraison que pour vos commandes.' });
  }

  const activeRequestsCount = await DeliveryRequest.countDocuments({
    sellerId,
    status: { $in: ACTIVE_DELIVERY_REQUEST_STATUSES }
  });
  if (activeRequestsCount >= Number(runtime.maxActiveRequestsPerShop || 20)) {
    return res.status(409).json({
      message: 'Limite de demandes actives atteinte pour cette boutique.'
    });
  }

  const existingRequest = await DeliveryRequest.findOne({ orderId: order._id });
  const invoiceUrl = normalizeText(req.body?.invoiceUrl || '');
  const note = normalizeText(req.body?.note || '');
  const pickupInstructions = normalizeText(req.body?.pickupInstructions || '');
  const buyerSuggestedPrice = Number(req.body?.deliveryPrice ?? 0);

  if (runtime.requireInvoiceAttachment && !invoiceUrl) {
    return res.status(400).json({
      message: 'Une facture (URL) est requise pour cette demande de livraison.'
    });
  }

  if (existingRequest && !TERMINAL_DELIVERY_REQUEST_STATUSES.includes(String(existingRequest.status || ''))) {
    const hydrated = await loadDeliveryRequestById(existingRequest._id);
    return res.status(200).json({
      message: 'Une demande de livraison existe déjà pour cette commande.',
      idempotent: true,
      item: toPublicDeliveryRequest(hydrated)
    });
  }

  const [seller, buyer] = await Promise.all([
    User.findById(sellerId).select('_id name shopName phone city commune shopAddress address shopLocation freeDeliveryEnabled').lean(),
    User.findById(order.customer).select('_id name phone city commune address location').lean()
  ]);
  if (!seller || !buyer) {
    return res.status(404).json({ message: 'Impossible de récupérer les participants de la commande.' });
  }

  const sellerItems = getOrderItemsForSeller(order, sellerId);
  const firstItem = sellerItems[0] || order.items?.[0] || {};

  const pickupCityName = normalizeText(
    req.body?.pickup?.cityName || seller.city || firstItem?.snapshot?.shopCity || ''
  );
  const pickupCommuneName = normalizeText(
    req.body?.pickup?.communeName || seller.commune || firstItem?.snapshot?.shopCommune || ''
  );
  const pickupAddress = normalizeText(
    req.body?.pickup?.address || seller.shopAddress || seller.address || firstItem?.snapshot?.shopAddress || ''
  );

  const dropoffCityName = pickFirstText(
    req.body?.dropoff?.cityName,
    order?.shippingAddressSnapshot?.cityName,
    order?.shippingAddressSnapshot?.city,
    order?.deliveryCity,
    buyer.city
  );
  const dropoffCommuneName = pickFirstText(
    req.body?.dropoff?.communeName,
    order?.shippingAddressSnapshot?.communeName,
    order?.shippingAddressSnapshot?.commune,
    buyer.commune
  );
  const dropoffAddress = pickFirstText(
    req.body?.dropoff?.address,
    order?.shippingAddressSnapshot?.addressLine,
    order?.shippingAddressSnapshot?.address,
    order?.shippingAddressSnapshot?.street,
    order?.deliveryAddress,
    buyer.address
  );

  const pickupCityById = isObjectId(req.body?.pickup?.cityId || '')
    ? await City.findById(req.body.pickup.cityId).lean()
    : null;
  const pickupCity = pickupCityById || (await findCityByName(pickupCityName));
  const pickupCommuneById = isObjectId(req.body?.pickup?.communeId || '')
    ? await Commune.findById(req.body.pickup.communeId).lean()
    : null;
  const pickupCommune = pickupCommuneById || (await findCommuneByName(pickupCommuneName, pickupCity?._id));

  const dropoffCityInputId = req.body?.dropoff?.cityId || order?.shippingAddressSnapshot?.cityId || '';
  const dropoffCityById = isObjectId(dropoffCityInputId)
    ? await City.findById(dropoffCityInputId).lean()
    : null;
  const dropoffCommuneInputId = req.body?.dropoff?.communeId || order?.shippingAddressSnapshot?.communeId || '';
  const dropoffCommuneById = isObjectId(dropoffCommuneInputId)
    ? await Commune.findById(dropoffCommuneInputId).lean()
    : null;
  const dropoffCity = dropoffCityById || (await findCityByName(dropoffCityName));
  const dropoffCommune = dropoffCommuneById || (await findCommuneByName(dropoffCommuneName, dropoffCity?._id));

  const pricing = resolvePlatformDeliveryPrice({
    runtime,
    seller,
    order,
    pickupCommuneId: pickupCommune?._id || '',
    dropoffCommuneId: dropoffCommune?._id || '',
    pickupCommuneName: pickupCommune?.name || pickupCommuneName,
    dropoffCommuneName: dropoffCommune?.name || dropoffCommuneName,
    buyerSuggestedPrice
  });

  const itemSnapshots = (Array.isArray(sellerItems) ? sellerItems : []).map((item) => ({
    productId: item?.product || null,
    title: item?.snapshot?.title || 'Produit',
    name: item?.snapshot?.title || 'Produit',
    imageUrl: item?.snapshot?.image || '',
    qty: Math.max(1, Number(item?.quantity || 1))
  }));

  const pickupCoords =
    Array.isArray(seller?.shopLocation?.coordinates) && seller.shopLocation.coordinates.length === 2
      ? { type: 'Point', coordinates: seller.shopLocation.coordinates }
      : null;
  const dropoffCoords =
    Array.isArray(buyer?.location?.coordinates) && buyer.location.coordinates.length === 2
      ? { type: 'Point', coordinates: buyer.location.coordinates }
      : null;

  const payload = {
    orderId: order._id,
    sellerId,
    buyerId: buyer._id,
    shopId: seller._id,
    pickup: {
      cityId: pickupCity?._id || null,
      cityName: pickupCity?.name || pickupCityName,
      communeId: pickupCommune?._id || null,
      communeName: pickupCommune?.name || pickupCommuneName,
      address: pickupAddress,
      coordinates: pickupCoords
    },
    dropoff: {
      cityId: dropoffCity?._id || null,
      cityName: dropoffCity?.name || dropoffCityName,
      communeId: dropoffCommune?._id || null,
      communeName: dropoffCommune?.name || dropoffCommuneName,
      address: dropoffAddress,
      coordinates: dropoffCoords
    },
    deliveryPrice: Number(pricing.deliveryPrice || 0),
    deliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN',
    currency: 'XAF',
    productSnapshot: itemSnapshots,
    itemsSnapshot: itemSnapshots,
    invoiceUrl,
    note,
    pickupInstructions,
    status: 'PENDING',
    currentStage: 'ASSIGNED',
    assignmentStatus: 'PENDING',
    mapAccess: {
      sellerVisibleUntil: new Date(
        Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
      ),
      buyerVisibleUntil: new Date(
        Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
      ),
      lockedAfterDistanceMeters: Number(runtime.locationLockDistanceMeters || 120),
      lockedAfterStatus: String(runtime.locationLockOnStatus || 'DELIVERED').toUpperCase()
    },
    expiresAt: new Date(Date.now() + Number(runtime.requestExpireHours || 24) * 60 * 60 * 1000),
    timeline: [
      {
        type: 'DELIVERY_REQUEST_CREATED',
        by: req.user.id,
        at: new Date(),
        meta: {
          orderId: String(order._id),
          deliveryPrice: Number(pricing.deliveryPrice || 0),
          deliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN'
        }
      }
    ]
  };

  const deliveryRequest = existingRequest && TERMINAL_DELIVERY_REQUEST_STATUSES.includes(String(existingRequest.status || ''))
    ? await DeliveryRequest.findByIdAndUpdate(
        existingRequest._id,
        {
          $set: {
            ...payload,
            rejectionReason: '',
            rejectedBy: null,
            rejectedAt: null,
            acceptedBy: null,
            acceptedAt: null,
            assignedDeliveryGuyId: null,
            assignmentStatus: 'PENDING',
            assignmentAcceptedAt: null,
            assignmentRejectedAt: null,
            assignmentRejectReason: '',
            currentStage: 'ASSIGNED',
            updatedAt: new Date()
          }
        },
        { new: true }
      )
    : await DeliveryRequest.create(payload);

  await updateOrderPlatformDeliveryState({
    orderId: order._id,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'REQUESTED',
    platformDeliveryMode: 'PLATFORM_DELIVERY',
    platformDeliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN'
  });

  const managerRecipients = await getDeliveryManagerRecipients(runtime);
  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: order._id,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: payload.pickup.communeId,
    dropoffCommuneId: payload.dropoff.communeId,
    recipients: managerRecipients,
    type: 'delivery_request_created',
    extraMetadata: {
      sellerId,
      buyerId: String(buyer._id),
      status: 'PENDING'
    },
    priority: 'HIGH',
    audience: 'ROLE_GROUP',
    targetRole: ['ADMIN', 'FOUNDER', 'DELIVERY_MANAGER'],
    actionRequired: true,
    actionType: 'REVIEW',
    actionStatus: 'PENDING',
    deepLink: `/admin/delivery-requests?status=PENDING&requestId=${deliveryRequest._id}`,
    validationType: 'deliveryOps'
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: order._id,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: payload.pickup.communeId,
    dropoffCommuneId: payload.dropoff.communeId,
    recipients: [String(buyer._id)],
    type: 'delivery_request_created',
    extraMetadata: {
      sellerId,
      status: 'PENDING'
    },
    priority: 'NORMAL'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: buyer._id,
    actionType: 'DELIVERY_REQUEST_CREATED',
    newValue: {
      orderId: String(order._id),
      deliveryRequestId: String(deliveryRequest._id),
      status: 'PENDING'
    },
    req,
    meta: {
      sellerId,
      buyerId: String(buyer._id)
    }
  });

  await Promise.all([
    invalidateSellerCache(sellerId, ['orders', 'dashboard']),
    invalidateUserCache(buyer._id, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.status(201).json({
    message: 'Demande de livraison envoyée.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const sellerUpdateDeliveryPinForOrder = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!runtime.enableDeliveryPinCode) {
    return res.status(403).json({
      message: 'Le code de livraison est désactivé dans la configuration runtime.'
    });
  }

  const orderId = normalizeText(req.params?.id || req.params?.orderId || '');
  if (!isObjectId(orderId)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }

  const sellerId = String(req.user?.id || req.user?._id || '');
  const order = await Order.findById(orderId).select(
    '_id customer items deliveryMode platformDeliveryRequestId platformDeliveryStatus'
  );
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (String(order.deliveryMode || '').toUpperCase() !== 'DELIVERY') {
    return res.status(400).json({ message: 'Cette commande n’est pas en mode livraison.' });
  }
  const sellerIds = resolveOrderSellerIdSet(order);
  if (!sellerIds.has(sellerId)) {
    return res.status(403).json({ message: 'Vous ne pouvez modifier le code que pour vos commandes.' });
  }

  const deliveryRequest = isObjectId(String(order.platformDeliveryRequestId || ''))
    ? await DeliveryRequest.findById(order.platformDeliveryRequestId)
    : await DeliveryRequest.findOne({ orderId: order._id });
  if (!deliveryRequest) {
    return res.status(404).json({
      message: 'Aucune demande plateforme trouvée pour cette commande.'
    });
  }
  if (String(deliveryRequest.sellerId || '') !== sellerId) {
    return res.status(403).json({ message: 'Accès refusé à cette demande.' });
  }
  if (TERMINAL_DELIVERY_REQUEST_STATUSES.includes(String(deliveryRequest.status || '').toUpperCase())) {
    return res.status(409).json({ message: 'La demande est clôturée, code non modifiable.' });
  }

  const action = normalizeText(req.body?.action || '').toLowerCase();
  const explicitCode = normalizeText(req.body?.deliveryPinCode || req.body?.code || '');
  const enabledFlag =
    typeof req.body?.enabled === 'boolean'
      ? req.body.enabled
      : ['true', '1', 'yes', 'on'].includes(String(req.body?.enabled || '').toLowerCase());
  const shouldClear = action === 'clear' || (req.body?.enabled === false);
  const shouldGenerate =
    action === 'generate' || (!explicitCode && req.body?.generate === true) || (!explicitCode && !shouldClear);

  if (shouldClear) {
    deliveryRequest.deliveryPinCodeHash = '';
    deliveryRequest.deliveryPinCodeEncrypted = '';
    deliveryRequest.deliveryPinCodeExpiresAt = null;
    appendTimeline(deliveryRequest, {
      type: 'DELIVERY_PIN_CLEARED_BY_SELLER',
      by: req.user.id,
      meta: { orderId: String(order._id) }
    });
    await deliveryRequest.save();

    const courier = isObjectId(String(deliveryRequest.assignedDeliveryGuyId || ''))
      ? await DeliveryGuy.findById(deliveryRequest.assignedDeliveryGuyId).select('_id userId').lean()
      : null;
    const recipients = [String(deliveryRequest.buyerId)];
    if (isObjectId(String(courier?.userId || ''))) recipients.push(String(courier.userId));

    await emitDeliveryNotifications({
      actorId: req.user.id,
      orderId: order._id,
      deliveryRequestId: deliveryRequest._id,
      pickupCommuneId: deliveryRequest.pickup?.communeId || null,
      dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
      recipients,
      type: 'delivery_request_accepted',
      extraMetadata: {
        status: deliveryRequest.status,
        deliveryPinCleared: true
      },
      priority: 'HIGH'
    });

    await createAuditLogEntry({
      performedBy: req.user.id,
      targetUser: deliveryRequest.buyerId,
      actionType: 'DELIVERY_PIN_CLEARED_BY_SELLER',
      previousValue: { hadDeliveryPin: true },
      newValue: { hadDeliveryPin: false },
      req,
      meta: {
        orderId: String(order._id),
        deliveryRequestId: String(deliveryRequest._id)
      }
    });

    await Promise.all([
      invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
      invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
      invalidateAdminCache(['admin', 'dashboard', 'delivery'])
    ]);

    const hydratedCleared = await loadDeliveryRequestById(deliveryRequest._id);
    return res.json({
      message: 'Code livraison supprimé.',
      item: toPublicDeliveryRequest(hydratedCleared),
      deliveryPinCode: '',
      deliveryPinCodeExpiresAt: null
    });
  }

  let pinCode = explicitCode;
  if (!pinCode && shouldGenerate) {
    pinCode = String(Math.floor(1000 + Math.random() * 9000));
  }
  if (!pinCode) {
    return res.status(400).json({
      message: 'Saisissez un code ou activez la génération automatique.'
    });
  }
  if (!/^\d{4,8}$/.test(pinCode)) {
    return res.status(400).json({
      message: 'Le code doit contenir entre 4 et 8 chiffres.'
    });
  }

  const expiresHoursRaw = Number(req.body?.expiresHours);
  const expiresHours = Number.isFinite(expiresHoursRaw)
    ? Math.max(1, Math.min(168, Math.round(expiresHoursRaw)))
    : 24;
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

  deliveryRequest.deliveryPinCodeHash = hashDeliveryPin(pinCode);
  deliveryRequest.deliveryPinCodeEncrypted = encryptDeliveryPin(pinCode);
  deliveryRequest.deliveryPinCodeExpiresAt = expiresAt;
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_PIN_ISSUED_BY_SELLER',
    by: req.user.id,
    meta: {
      orderId: String(order._id),
      expiresAt,
      generated: shouldGenerate && !explicitCode,
      enabled: enabledFlag !== false
    }
  });
  await deliveryRequest.save();

  const courier = isObjectId(String(deliveryRequest.assignedDeliveryGuyId || ''))
    ? await DeliveryGuy.findById(deliveryRequest.assignedDeliveryGuyId).select('_id userId').lean()
    : null;
  const recipients = [String(deliveryRequest.buyerId)];
  if (isObjectId(String(courier?.userId || ''))) recipients.push(String(courier.userId));

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: order._id,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients,
    type: 'delivery_request_accepted',
    extraMetadata: {
      status: deliveryRequest.status,
      deliveryPinCode: pinCode,
      deliveryPinCodeExpiresAt: expiresAt,
      deliveryPinUpdated: true
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.buyerId,
    actionType: 'DELIVERY_PIN_ISSUED_BY_SELLER',
    previousValue: { hadDeliveryPin: false },
    newValue: {
      hadDeliveryPin: true,
      expiresAt
    },
    req,
    meta: {
      orderId: String(order._id),
      deliveryRequestId: String(deliveryRequest._id),
      sharedWithCourier: isObjectId(String(courier?.userId || ''))
    }
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: shouldGenerate && !explicitCode ? 'Code livraison généré et partagé.' : 'Code livraison mis à jour.',
    item: toPublicDeliveryRequest(hydrated),
    deliveryPinCode: pinCode,
    deliveryPinCodeExpiresAt: expiresAt
  });
});

export const listAdminDeliveryRequests = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const { page = 1, limit = 20 } = req.query || {};
  const filter = buildDeliveryRequestFilter(req.query, { forAnalytics: false });

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNumber - 1) * pageSize;

  // DEBUG: delivery requests list
  const totalUnfiltered = await DeliveryRequest.countDocuments({});
  console.log('[delivery-requests] DEBUG listAdminDeliveryRequests', {
    query: req.query,
    filter: JSON.stringify(filter, (_, v) => (v instanceof RegExp ? v.toString() : v)),
    page: pageNumber,
    pageSize,
    skip,
    totalInDb: totalUnfiltered
  });

  const [items, total, orphanOrders] = await Promise.all([
    DeliveryRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate(
        'orderId',
        '_id status totalAmount deliveryMode deliveryAddress deliveryCity createdAt shippingAddressSnapshot platformDeliveryStatus'
      )
      .populate('sellerId', '_id name shopName phone city commune shopAddress address shopLocation')
      .populate('buyerId', '_id name phone city commune address location')
      .populate('shopId', '_id name shopName phone city commune')
      .populate(DELIVERY_GUY_PUBLIC_POPULATE)
      .lean(),
    DeliveryRequest.countDocuments(filter),
    (async () => {
      const requested = await Order.find({
        platformDeliveryStatus: 'REQUESTED',
        deliveryMode: 'DELIVERY'
      })
        .select('_id platformDeliveryRequestId customer deliveryAddress deliveryCity shippingAddressSnapshot createdAt items')
        .populate('customer', 'name phone city commune address')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
      const orphans = [];
      for (const order of requested || []) {
        const requestId = order.platformDeliveryRequestId;
        const hasRequest =
          isObjectId(requestId) && (await DeliveryRequest.findById(requestId).select('_id').lean());
        if (!hasRequest) {
          orphans.push({
            _id: order._id,
            orderId: order._id,
            deliveryAddress: order.deliveryAddress,
            deliveryCity: order.deliveryCity,
            createdAt: order.createdAt,
            customer: order.customer,
            shippingAddressSnapshot: order.shippingAddressSnapshot
          });
        }
      }
      return orphans;
    })()
  ]);

  const list = Array.isArray(items) ? items : [];
  // DEBUG: what we're returning
  console.log('[delivery-requests] DEBUG list result', {
    totalMatchingFilter: total,
    itemsReturned: list.length,
    itemSummaries: list.map((i) => ({ _id: i._id?.toString(), status: i.status, orderId: i.orderId?.toString?.() }))
  });

  return res.json({
    items: list.map((item) => {
      const publicItem = toPublicDeliveryRequest(item);
      const adminRulePrice = getAdminRuleDeliveryPrice(
        runtime,
        publicItem.pickup?.communeId || item.pickup?.communeId,
        publicItem.dropoff?.communeId || item.dropoff?.communeId,
        publicItem.pickup?.communeName || item.pickup?.communeName,
        publicItem.dropoff?.communeName || item.dropoff?.communeName
      );
      return { ...publicItem, adminRuleDeliveryPrice: adminRulePrice };
    }),
    total,
    page: pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filtersEnabled: Boolean(runtime.communeFiltersEnabled),
    orphanOrders: orphanOrders || []
  });
});

/**
 * Admin: create a DeliveryRequest for an order that has platformDeliveryStatus REQUESTED
 * but no DeliveryRequest record (e.g. orphan after partial failure or legacy data).
 */
export const createDeliveryRequestForOrderAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const orderId = normalizeText(req.params?.orderId || req.params?.id || '');
  if (!isObjectId(orderId)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }

  const order = await Order.findById(orderId).select(
    '_id customer items status deliveryMode deliveryAddress deliveryCity shippingAddressSnapshot totalAmount deliveryFeeTotal platformDeliveryStatus platformDeliveryRequestId'
  );
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (String(order.deliveryMode || '').toUpperCase() !== 'DELIVERY') {
    return res.status(400).json({ message: 'La commande n\'est pas en mode livraison.' });
  }
  if (String(order.platformDeliveryStatus || '').toUpperCase() !== 'REQUESTED') {
    return res.status(400).json({
      message: 'La commande n\'a pas le statut REQUESTED. Créez la demande depuis la fiche commande vendeur.'
    });
  }
  const existingRequest = await DeliveryRequest.findOne({ orderId: order._id });
  if (existingRequest) {
    const hydrated = await loadDeliveryRequestById(existingRequest._id);
    return res.status(200).json({
      message: 'Une demande de livraison existe déjà pour cette commande.',
      item: toPublicDeliveryRequest(hydrated)
    });
  }

  const sellerIds = resolveOrderSellerIdSet(order);
  const sellerId = Array.from(sellerIds)[0] || null;
  if (!sellerId) {
    return res.status(400).json({ message: 'Impossible d\'identifier le vendeur de la commande.' });
  }

  const [seller, buyer] = await Promise.all([
    User.findById(sellerId).select('_id name shopName phone city commune shopAddress address shopLocation freeDeliveryEnabled').lean(),
    User.findById(order.customer).select('_id name phone city commune address location').lean()
  ]);
  if (!seller || !buyer) {
    return res.status(404).json({ message: 'Impossible de récupérer vendeur ou acheteur.' });
  }

  const sellerItems = getOrderItemsForSeller(order, sellerId);
  const firstItem = sellerItems[0] || order.items?.[0] || {};

  const pickupCityName = normalizeText(seller.city || firstItem?.snapshot?.shopCity || '');
  const pickupCommuneName = normalizeText(seller.commune || firstItem?.snapshot?.shopCommune || '');
  const pickupAddress = normalizeText(seller.shopAddress || seller.address || firstItem?.snapshot?.shopAddress || '');

  const dropoffCityName = pickFirstText(
    order?.shippingAddressSnapshot?.cityName,
    order?.shippingAddressSnapshot?.city,
    order?.deliveryCity,
    buyer.city
  );
  const dropoffCommuneName = pickFirstText(
    order?.shippingAddressSnapshot?.communeName,
    order?.shippingAddressSnapshot?.commune,
    buyer.commune
  );
  const dropoffAddress = pickFirstText(
    order?.shippingAddressSnapshot?.addressLine,
    order?.shippingAddressSnapshot?.address,
    order?.shippingAddressSnapshot?.street,
    order?.deliveryAddress,
    buyer.address
  );

  const pickupCity = await findCityByName(pickupCityName);
  const pickupCommune = await findCommuneByName(pickupCommuneName, pickupCity?._id);
  const dropoffCity = await findCityByName(dropoffCityName);
  const dropoffCommune = await findCommuneByName(dropoffCommuneName, dropoffCity?._id);

  const pricing = resolvePlatformDeliveryPrice({
    runtime,
    seller,
    order,
    pickupCommuneId: pickupCommune?._id || '',
    dropoffCommuneId: dropoffCommune?._id || '',
    pickupCommuneName: pickupCommune?.name || pickupCommuneName,
    dropoffCommuneName: dropoffCommune?.name || dropoffCommuneName,
    buyerSuggestedPrice: 0
  });

  const itemSnapshots = (Array.isArray(sellerItems) ? sellerItems : []).map((item) => ({
    productId: item?.product || null,
    title: item?.snapshot?.title || 'Produit',
    name: item?.snapshot?.title || 'Produit',
    imageUrl: item?.snapshot?.image || '',
    qty: Math.max(1, Number(item?.quantity || 1))
  }));

  const pickupCoords =
    Array.isArray(seller?.shopLocation?.coordinates) && seller.shopLocation.coordinates.length === 2
      ? { type: 'Point', coordinates: seller.shopLocation.coordinates }
      : null;
  const dropoffCoords =
    Array.isArray(buyer?.location?.coordinates) && buyer.location.coordinates.length === 2
      ? { type: 'Point', coordinates: buyer.location.coordinates }
      : null;

  const payload = {
    orderId: order._id,
    sellerId,
    buyerId: buyer._id,
    shopId: seller._id,
    pickup: {
      cityId: pickupCity?._id || null,
      cityName: pickupCity?.name || pickupCityName,
      communeId: pickupCommune?._id || null,
      communeName: pickupCommune?.name || pickupCommuneName,
      address: pickupAddress,
      coordinates: pickupCoords
    },
    dropoff: {
      cityId: dropoffCity?._id || null,
      cityName: dropoffCity?.name || dropoffCityName,
      communeId: dropoffCommune?._id || null,
      communeName: dropoffCommune?.name || dropoffCommuneName,
      address: dropoffAddress,
      coordinates: dropoffCoords
    },
    deliveryPrice: Number(pricing.deliveryPrice || 0),
    deliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN',
    currency: 'XAF',
    productSnapshot: itemSnapshots,
    itemsSnapshot: itemSnapshots,
    invoiceUrl: '',
    note: '',
    pickupInstructions: '',
    status: 'PENDING',
    currentStage: 'ASSIGNED',
    assignmentStatus: 'PENDING',
    mapAccess: {
      sellerVisibleUntil: new Date(
        Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
      ),
      buyerVisibleUntil: new Date(
        Date.now() + Number(runtime.locationVisibilityMinutesAfterAccept || 90) * 60 * 1000
      ),
      lockedAfterDistanceMeters: Number(runtime.locationLockDistanceMeters || 120),
      lockedAfterStatus: String(runtime.locationLockOnStatus || 'DELIVERED').toUpperCase()
    },
    expiresAt: new Date(Date.now() + Number(runtime.requestExpireHours || 24) * 60 * 60 * 1000),
    timeline: [
      {
        type: 'DELIVERY_REQUEST_CREATED',
        by: req.user.id,
        at: new Date(),
        meta: { orderId: String(order._id), createdByAdmin: true }
      }
    ]
  };

  const deliveryRequest = await DeliveryRequest.create(payload);

  await updateOrderPlatformDeliveryState({
    orderId: order._id,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'REQUESTED',
    platformDeliveryMode: 'PLATFORM_DELIVERY',
    platformDeliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN'
  });

  await Promise.all([
    invalidateSellerCache(sellerId, ['orders', 'dashboard']),
    invalidateUserCache(buyer._id, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.status(201).json({
    message: 'Demande de livraison créée pour cette commande.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const acceptAdminDeliveryRequest = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(deliveryRequest.status)) {
    return res.status(409).json({ message: 'Impossible d’accepter une demande déjà clôturée.' });
  }

  const deliveryGuyId = normalizeText(req.body?.deliveryGuyId || '');
  let deliveryGuy = null;
  if (deliveryGuyId) {
    if (!isObjectId(deliveryGuyId)) {
      return res.status(400).json({ message: 'Livreur invalide.' });
    }
    deliveryGuy = await DeliveryGuy.findById(deliveryGuyId).lean();
    if (!deliveryGuy) {
      return res.status(404).json({ message: 'Livreur introuvable.' });
    }
  }

  deliveryRequest.status = deliveryGuyId && !runtime.courierMustAcceptAssignment ? 'IN_PROGRESS' : 'ACCEPTED';
  deliveryRequest.acceptedBy = req.user.id;
  deliveryRequest.acceptedAt = new Date();
  deliveryRequest.currentStage = deliveryGuyId
    ? runtime.courierMustAcceptAssignment
      ? 'ASSIGNED'
      : 'ACCEPTED'
    : 'ASSIGNED';
  deliveryRequest.assignmentStatus = deliveryGuyId
    ? runtime.courierMustAcceptAssignment
      ? 'PENDING'
      : 'ACCEPTED'
    : 'PENDING';
  deliveryRequest.assignmentAcceptedAt = deliveryGuyId && !runtime.courierMustAcceptAssignment ? new Date() : null;
  deliveryRequest.assignmentRejectedAt = null;
  deliveryRequest.assignmentRejectReason = '';
  if (deliveryGuyId) {
    deliveryRequest.assignedDeliveryGuyId = deliveryGuyId;
  }
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_ACCEPTED',
    by: req.user.id,
    meta: {
      deliveryGuyId: deliveryGuyId || null
    }
  });
  if (deliveryGuyId) {
    appendTimeline(deliveryRequest, {
      type: 'COURIER_ASSIGNED',
      by: req.user.id,
      meta: {
        deliveryGuyId: deliveryGuyId || null,
        courierMustAcceptAssignment: Boolean(runtime.courierMustAcceptAssignment)
      }
    });
  }
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: runtime.courierMustAcceptAssignment ? 'ACCEPTED' : deliveryGuyId ? 'IN_PROGRESS' : 'ACCEPTED',
    platformDeliveryMode: 'PLATFORM_DELIVERY',
    deliveryGuyId: deliveryGuyId || undefined
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_accepted',
    extraMetadata: {
      status: 'ACCEPTED',
      deliveryGuyId: deliveryGuyId || null
    },
    priority: 'HIGH'
  });

  await resolveValidationTaskNotifications({
    entityType: 'deliveryRequest',
    entityId: String(deliveryRequest._id),
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: 'deliveryOps'
  }).catch(() => {});

  if (deliveryGuy?.userId) {
    await emitDeliveryNotifications({
      actorId: req.user.id,
      orderId: deliveryRequest.orderId,
      deliveryRequestId: deliveryRequest._id,
      pickupCommuneId: deliveryRequest.pickup?.communeId || null,
      dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
      recipients: [String(deliveryGuy.userId)],
      type: 'delivery_request_assigned',
      extraMetadata: {
        status: deliveryRequest.status,
        assignmentStatus: deliveryRequest.assignmentStatus,
        deliveryGuyId: deliveryGuyId || null
      },
      priority: 'HIGH'
    });
  }

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_ACCEPTED',
    previousValue: { status: 'PENDING' },
    newValue: { status: 'ACCEPTED', deliveryGuyId: deliveryGuyId || null },
    req,
    meta: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id)
    }
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Demande de livraison acceptée.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const rejectAdminDeliveryRequest = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const reason = normalizeText(req.body?.reason || req.body?.rejectionReason || '');
  if (!reason) {
    return res.status(400).json({ message: 'La raison de rejet est requise.' });
  }

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(deliveryRequest.status)) {
    return res.status(409).json({ message: 'Cette demande est déjà clôturée.' });
  }

  const previousStatus = String(deliveryRequest.status || 'PENDING');
  deliveryRequest.status = 'REJECTED';
  deliveryRequest.rejectionReason = reason;
  deliveryRequest.rejectedBy = req.user.id;
  deliveryRequest.rejectedAt = new Date();
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_REJECTED',
    by: req.user.id,
    meta: { reason }
  });
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'REJECTED',
    platformDeliveryMode: 'SELLER_DELIVERY'
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_rejected',
    extraMetadata: {
      status: 'REJECTED',
      reason
    },
    priority: 'HIGH'
  });

  await resolveValidationTaskNotifications({
    entityType: 'deliveryRequest',
    entityId: String(deliveryRequest._id),
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: 'deliveryOps'
  }).catch(() => {});

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_REJECTED',
    previousValue: { status: previousStatus },
    newValue: { status: 'REJECTED', reason },
    req,
    meta: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id)
    }
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Demande de livraison rejetée.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const assignAdminDeliveryRequest = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const deliveryGuyId = normalizeText(req.body?.deliveryGuyId || '');
  if (!isObjectId(deliveryGuyId)) {
    return res.status(400).json({ message: 'Livreur invalide.' });
  }

  const [deliveryRequest, deliveryGuy] = await Promise.all([
    DeliveryRequest.findById(requestId),
    DeliveryGuy.findById(deliveryGuyId).lean()
  ]);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (!deliveryGuy) {
    return res.status(404).json({ message: 'Livreur introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(deliveryRequest.status)) {
    return res.status(409).json({ message: 'Impossible d’assigner un livreur à une demande clôturée.' });
  }

  const previousStatus = String(deliveryRequest.status || 'PENDING');
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_ASSIGNED',
    by: req.user.id,
    meta: {
      deliveryGuyId
    }
  });
  await assignCourierFromAdmin({
    requestDoc: deliveryRequest,
    deliveryGuyId,
    actorId: req.user.id,
    req,
    runtime
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_assigned',
    extraMetadata: {
      status: deliveryRequest.status,
      deliveryGuyId,
      assignmentStatus: deliveryRequest.assignmentStatus
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_ASSIGNED',
    previousValue: { status: previousStatus, deliveryGuyId: null },
    newValue: { status: deliveryRequest.status, deliveryGuyId },
    req,
    meta: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id)
    }
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Livreur assigné avec succès.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const unassignAdminDeliveryRequest = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  const reason = normalizeText(req.body?.reason || '');

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(String(deliveryRequest.status || ''))) {
    return res.status(409).json({ message: 'Impossible de retirer un livreur d’une demande clôturée.' });
  }

  if (String(deliveryRequest.assignmentStatus || '').toUpperCase() === 'ACCEPTED') {
    return res.status(403).json({
      message: 'Impossible de désassigner : le livreur a déjà accepté cette livraison.'
    });
  }

  const previousDeliveryGuyId = String(deliveryRequest.assignedDeliveryGuyId || '');
  if (!previousDeliveryGuyId) {
    const hydratedNoop = await loadDeliveryRequestById(deliveryRequest._id);
    return res.json({
      message: 'Aucun livreur n’était assigné.',
      idempotent: true,
      item: toPublicDeliveryRequest(hydratedNoop)
    });
  }

  deliveryRequest.assignedDeliveryGuyId = null;
  deliveryRequest.assignmentStatus = 'PENDING';
  deliveryRequest.assignmentAcceptedAt = null;
  deliveryRequest.assignmentRejectedAt = null;
  deliveryRequest.assignmentRejectReason = '';
  deliveryRequest.currentStage = 'ASSIGNED';
  if (String(deliveryRequest.status || '').toUpperCase() === 'IN_PROGRESS') {
    deliveryRequest.status = 'ACCEPTED';
  }
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_UNASSIGNED',
    by: req.user.id,
    meta: {
      previousDeliveryGuyId,
      reason: reason || undefined
    }
  });
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'ACCEPTED',
    platformDeliveryMode: 'PLATFORM_DELIVERY',
    deliveryGuyId: null
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_created',
    extraMetadata: {
      status: deliveryRequest.status,
      unassigned: true,
      reason: reason || undefined
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_UNASSIGNED',
    previousValue: { deliveryGuyId: previousDeliveryGuyId },
    newValue: { deliveryGuyId: null, reason: reason || '' },
    req,
    meta: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id)
    }
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Livreur retiré de la demande.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const updateAdminDeliveryRequestPrice = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const nextPrice = Math.max(0, Number(req.body?.deliveryPrice || 0));
  const reason = normalizeText(req.body?.reason || '');

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(String(deliveryRequest.status || ''))) {
    return res.status(409).json({ message: 'Impossible de modifier le prix sur une demande clôturée.' });
  }
  if (String(deliveryRequest.assignmentStatus || '').toUpperCase() === 'ACCEPTED') {
    return res.status(403).json({
      message: 'Impossible de modifier le prix : le livreur a déjà accepté cette livraison.'
    });
  }

  const previousPrice = Math.max(0, Number(deliveryRequest.deliveryPrice || 0));
  const previousSource = String(deliveryRequest.deliveryPriceSource || 'UNKNOWN');
  if (Number(previousPrice) === Number(nextPrice)) {
    const hydratedNoop = await loadDeliveryRequestById(deliveryRequest._id);
    return res.json({
      message: 'Le prix est déjà à cette valeur.',
      idempotent: true,
      item: toPublicDeliveryRequest(hydratedNoop)
    });
  }

  deliveryRequest.deliveryPrice = nextPrice;
  deliveryRequest.deliveryPriceSource = 'ADMIN_RULE';
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_PRICE_UPDATED',
    by: req.user.id,
    meta: {
      previousPrice,
      nextPrice,
      reason: reason || undefined
    }
  });
  await deliveryRequest.save();

  const orderDoc = await Order.findById(deliveryRequest.orderId).select('itemsSubtotal discountTotal paidAmount totalAmount remainingAmount').lean();
  const itemsSubtotal = Number(orderDoc?.itemsSubtotal ?? 0);
  const discountTotal = Number(orderDoc?.discountTotal ?? 0);
  const paidAmount = Number(orderDoc?.paidAmount ?? 0);
  const newTotalAmount = Math.max(0, Number((itemsSubtotal - discountTotal + nextPrice).toFixed(2)));
  const newRemainingAmount = Math.max(0, Number((newTotalAmount - paidAmount).toFixed(2)));

  await Order.updateOne(
    { _id: deliveryRequest.orderId },
    {
      $set: {
        deliveryFeeTotal: nextPrice,
        platformDeliveryPriceSource: 'ADMIN_RULE',
        totalAmount: newTotalAmount,
        remainingAmount: newRemainingAmount
      }
    }
  );

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_PRICE_UPDATED',
    previousValue: { deliveryPrice: previousPrice, deliveryPriceSource: previousSource },
    newValue: { deliveryPrice: nextPrice, deliveryPriceSource: 'ADMIN_RULE', reason: reason || '' },
    req,
    meta: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id)
    }
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_accepted',
    extraMetadata: {
      status: deliveryRequest.status,
      deliveryPrice: nextPrice,
      deliveryPriceSource: 'ADMIN_RULE',
      priceUpdated: true
    },
    priority: 'HIGH'
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Prix de livraison mis à jour.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

/**
 * Admin: set pickup and/or dropoff coordinates (geolocation) for a delivery request.
 * Body: { pickup?: { latitude, longitude }, dropoff?: { latitude, longitude } }
 * GeoJSON stores [longitude, latitude].
 */
export const updateAdminDeliveryRequestCoordinates = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }

  const { pickup: pickupCoords, dropoff: dropoffCoords } = req.body || {};

  if (pickupCoords && typeof pickupCoords.latitude === 'number' && typeof pickupCoords.longitude === 'number') {
    deliveryRequest.pickup = deliveryRequest.pickup || {};
    deliveryRequest.pickup.coordinates = {
      type: 'Point',
      coordinates: [Number(pickupCoords.longitude), Number(pickupCoords.latitude)]
    };
  }
  if (dropoffCoords && typeof dropoffCoords.latitude === 'number' && typeof dropoffCoords.longitude === 'number') {
    deliveryRequest.dropoff = deliveryRequest.dropoff || {};
    deliveryRequest.dropoff.coordinates = {
      type: 'Point',
      coordinates: [Number(dropoffCoords.longitude), Number(dropoffCoords.latitude)]
    };
  }

  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_COORDINATES_UPDATED',
    by: req.user.id,
    meta: {
      pickupSet: Boolean(pickupCoords?.latitude != null),
      dropoffSet: Boolean(dropoffCoords?.latitude != null)
    }
  });
  await deliveryRequest.save();

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Position(s) GPS enregistrée(s).',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const submitPickupProofAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(String(deliveryRequest.status || ''))) {
    return res.status(409).json({ message: 'Impossible de déposer une preuve pour une demande clôturée.' });
  }

  const photoFile = firstFileFromFields(req.files, 'photos');
  const signatureFile = firstFileFromFields(req.files, 'signatureFile');
  const photoUrl = toUploadedProofUrl(photoFile);
  const signatureUrl = toUploadedProofUrl(signatureFile) || normalizeText(req.body?.signatureUrl || '');
  const note = normalizeText(req.body?.note || '');

  if (!photoUrl && !signatureUrl && !note) {
    return res.status(400).json({ message: 'Ajoutez au moins une photo, une signature ou une note.' });
  }

  deliveryRequest.pickupProof = {
    photoUrl: photoUrl || deliveryRequest.pickupProof?.photoUrl || '',
    signatureUrl: signatureUrl || deliveryRequest.pickupProof?.signatureUrl || '',
    note,
    submittedBy: req.user.id,
    submittedAt: new Date()
  };
  if (['PENDING', 'ACCEPTED'].includes(String(deliveryRequest.status || ''))) {
    deliveryRequest.status = 'IN_PROGRESS';
  }
  if (String(deliveryRequest.assignmentStatus || '').toUpperCase() !== 'ACCEPTED') {
    deliveryRequest.assignmentStatus = 'ACCEPTED';
    deliveryRequest.assignmentAcceptedAt = deliveryRequest.assignmentAcceptedAt || new Date();
  }
  deliveryRequest.currentStage = 'PICKED_UP';
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_PICKUP_PROOF_SUBMITTED',
    by: req.user.id,
    meta: {
      hasPhoto: Boolean(photoUrl),
      hasSignature: Boolean(signatureUrl)
    }
  });
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'IN_PROGRESS',
    platformDeliveryMode: 'PLATFORM_DELIVERY'
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_in_progress',
    extraMetadata: {
      status: 'IN_PROGRESS',
      proofType: 'pickup'
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_PICKUP_PROOF_SUBMITTED',
    newValue: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id),
      status: deliveryRequest.status
    },
    req
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'analytics'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Preuve de pickup enregistrée.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const submitDeliveryProofAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des demandes de livraison.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }

  const deliveryRequest = await DeliveryRequest.findById(requestId);
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'Demande de livraison introuvable.' });
  }
  if (['REJECTED', 'CANCELED'].includes(String(deliveryRequest.status || ''))) {
    return res.status(409).json({ message: 'Impossible de déposer une preuve pour une demande clôturée.' });
  }

  const photoFile = firstFileFromFields(req.files, 'photos');
  const signatureFile = firstFileFromFields(req.files, 'signatureFile');
  const photoUrl = toUploadedProofUrl(photoFile);
  const signatureUrl = toUploadedProofUrl(signatureFile) || normalizeText(req.body?.signatureUrl || '');
  const note = normalizeText(req.body?.note || '');

  if (!photoUrl && !signatureUrl && !note && String(deliveryRequest.status || '') !== 'DELIVERED') {
    return res.status(400).json({ message: 'Ajoutez au moins une photo, une signature ou une note.' });
  }

  deliveryRequest.deliveryProof = {
    photoUrl: photoUrl || deliveryRequest.deliveryProof?.photoUrl || '',
    signatureUrl: signatureUrl || deliveryRequest.deliveryProof?.signatureUrl || '',
    note,
    submittedBy: req.user.id,
    submittedAt: new Date()
  };
  deliveryRequest.status = 'DELIVERED';
  deliveryRequest.currentStage = 'DELIVERED';
  deliveryRequest.assignmentStatus = 'ACCEPTED';
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_DELIVERY_PROOF_SUBMITTED',
    by: req.user.id,
    meta: {
      hasPhoto: Boolean(photoUrl),
      hasSignature: Boolean(signatureUrl)
    }
  });
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_DELIVERED',
    by: req.user.id,
    meta: {
      proofSubmitted: true
    }
  });
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'DELIVERED',
    platformDeliveryMode: 'PLATFORM_DELIVERY'
  });

  await emitDeliveryNotifications({
    actorId: req.user.id,
    orderId: deliveryRequest.orderId,
    deliveryRequestId: deliveryRequest._id,
    pickupCommuneId: deliveryRequest.pickup?.communeId || null,
    dropoffCommuneId: deliveryRequest.dropoff?.communeId || null,
    recipients: [String(deliveryRequest.sellerId), String(deliveryRequest.buyerId)],
    type: 'delivery_request_delivered',
    extraMetadata: {
      status: 'DELIVERED',
      proofType: 'delivery'
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: deliveryRequest.sellerId,
    actionType: 'DELIVERY_REQUEST_DELIVERED',
    previousValue: { status: 'IN_PROGRESS' },
    newValue: {
      orderId: String(deliveryRequest.orderId),
      deliveryRequestId: String(deliveryRequest._id),
      status: 'DELIVERED'
    },
    req
  });

  await Promise.all([
    invalidateSellerCache(deliveryRequest.sellerId, ['orders', 'dashboard']),
    invalidateUserCache(deliveryRequest.buyerId, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'analytics'])
  ]);

  const hydrated = await loadDeliveryRequestById(deliveryRequest._id);
  return res.json({
    message: 'Preuve de livraison enregistrée.',
    item: toPublicDeliveryRequest(hydrated)
  });
});

export const getAdminDeliveryAnalytics = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé aux analytics livraison.' });
  }

  const filter = buildDeliveryRequestFilter(req.query, { forAnalytics: true });
  const slaThresholdDays = Math.max(
    1,
    toNumber(await getRuntimeConfig('delivery_delay_threshold_days', { fallback: 2 }), 2)
  );
  const now = Date.now();
  const thresholdMs = slaThresholdDays * 24 * 60 * 60 * 1000;

  const requests = await DeliveryRequest.find(filter)
    .select(
      '_id status createdAt acceptedAt deliveryPrice pickup dropoff timeline currency assignedDeliveryGuyId sellerId buyerId'
    )
    .lean();

  const kpis = {
    totalRequests: requests.length,
    pending: 0,
    accepted: 0,
    inProgress: 0,
    delivered: 0,
    rejected: 0,
    canceled: 0,
    failed: 0,
    deliveredRevenue: 0,
    totalRevenueAllStates: 0,
    avgDeliveryPrice: 0,
    acceptanceRate: 0,
    completionRate: 0,
    avgAcceptanceMinutes: 0,
    avgDeliveryMinutes: 0,
    slaBreachOpen: 0,
    slaBreachDelivered: 0
  };

  let totalPriceAccumulator = 0;
  let acceptanceAccumulator = 0;
  let acceptanceCount = 0;
  let deliveryAccumulator = 0;
  let deliveryCount = 0;

  const communeMap = new Map();

  for (const request of requests) {
    const status = String(request?.status || '').toUpperCase();
    const createdAt = request?.createdAt ? new Date(request.createdAt) : null;
    const acceptedAt =
      (request?.acceptedAt ? new Date(request.acceptedAt) : null) ||
      getTimelineEventAt(request?.timeline, ['DELIVERY_REQUEST_ACCEPTED']);
    const deliveredAt = getTimelineEventAt(request?.timeline, [
      'DELIVERY_REQUEST_DELIVERED',
      'DELIVERY_DELIVERY_PROOF_SUBMITTED'
    ]);

    const price = Math.max(0, toNumber(request?.deliveryPrice, 0));
    totalPriceAccumulator += price;
    kpis.totalRevenueAllStates += price;

    if (status === 'PENDING') kpis.pending += 1;
    if (status === 'ACCEPTED') kpis.accepted += 1;
    if (status === 'IN_PROGRESS') kpis.inProgress += 1;
    if (status === 'DELIVERED') {
      kpis.delivered += 1;
      kpis.deliveredRevenue += price;
    }
    if (status === 'REJECTED') kpis.rejected += 1;
    if (status === 'CANCELED') kpis.canceled += 1;
    if (status === 'FAILED') kpis.failed += 1;

    if (createdAt && acceptedAt && !Number.isNaN(createdAt.getTime()) && !Number.isNaN(acceptedAt.getTime())) {
      const delta = acceptedAt.getTime() - createdAt.getTime();
      if (delta >= 0) {
        acceptanceAccumulator += delta / 60000;
        acceptanceCount += 1;
      }
    }

    const deliveryReferenceStart = acceptedAt || createdAt;
    if (
      deliveryReferenceStart &&
      deliveredAt &&
      !Number.isNaN(deliveryReferenceStart.getTime()) &&
      !Number.isNaN(deliveredAt.getTime())
    ) {
      const delta = deliveredAt.getTime() - deliveryReferenceStart.getTime();
      if (delta >= 0) {
        const minutes = delta / 60000;
        deliveryAccumulator += minutes;
        deliveryCount += 1;
        if (delta > thresholdMs) {
          kpis.slaBreachDelivered += 1;
        }
      }
    } else if (
      status !== 'DELIVERED' &&
      createdAt &&
      !Number.isNaN(createdAt.getTime()) &&
      now - createdAt.getTime() > thresholdMs
    ) {
      kpis.slaBreachOpen += 1;
    }

    const communeId = String(request?.dropoff?.communeId || '');
    const communeName = normalizeText(request?.dropoff?.communeName || 'Commune inconnue') || 'Commune inconnue';
    const cityName = normalizeText(request?.dropoff?.cityName || request?.pickup?.cityName || '') || '—';
    const key = communeId || `${communeName}:${cityName}`;
    if (!communeMap.has(key)) {
      communeMap.set(key, {
        communeId: communeId || null,
        communeName,
        cityName,
        requests: 0,
        delivered: 0,
        rejected: 0,
        inProgress: 0,
        revenueDelivered: 0,
        avgPrice: 0,
        totalPrice: 0,
        slaBreaches: 0,
        avgDeliveryMinutes: 0,
        _deliveryAccumulator: 0,
        _deliveryCount: 0
      });
    }
    const communeEntry = communeMap.get(key);
    communeEntry.requests += 1;
    communeEntry.totalPrice += price;
    if (status === 'DELIVERED') {
      communeEntry.delivered += 1;
      communeEntry.revenueDelivered += price;
    }
    if (status === 'REJECTED') communeEntry.rejected += 1;
    if (status === 'IN_PROGRESS') communeEntry.inProgress += 1;

    if (
      deliveryReferenceStart &&
      deliveredAt &&
      !Number.isNaN(deliveryReferenceStart.getTime()) &&
      !Number.isNaN(deliveredAt.getTime())
    ) {
      const delta = deliveredAt.getTime() - deliveryReferenceStart.getTime();
      if (delta >= 0) {
        const minutes = delta / 60000;
        communeEntry._deliveryAccumulator += minutes;
        communeEntry._deliveryCount += 1;
        if (delta > thresholdMs) communeEntry.slaBreaches += 1;
      }
    } else if (
      status !== 'DELIVERED' &&
      createdAt &&
      !Number.isNaN(createdAt.getTime()) &&
      now - createdAt.getTime() > thresholdMs
    ) {
      communeEntry.slaBreaches += 1;
    }
  }

  const completedOrClosed = kpis.delivered + kpis.rejected + kpis.canceled;
  kpis.avgDeliveryPrice = requests.length ? Number((totalPriceAccumulator / requests.length).toFixed(2)) : 0;
  kpis.acceptanceRate =
    requests.length ? Number((((kpis.accepted + kpis.inProgress + kpis.delivered) / requests.length) * 100).toFixed(2)) : 0;
  kpis.completionRate = requests.length ? Number(((kpis.delivered / requests.length) * 100).toFixed(2)) : 0;
  kpis.avgAcceptanceMinutes = acceptanceCount ? Number((acceptanceAccumulator / acceptanceCount).toFixed(2)) : 0;
  kpis.avgDeliveryMinutes = deliveryCount ? Number((deliveryAccumulator / deliveryCount).toFixed(2)) : 0;
  kpis.closedRequests = completedOrClosed;
  kpis.slaThresholdDays = slaThresholdDays;

  const communes = Array.from(communeMap.values())
    .map((entry) => ({
      communeId: entry.communeId,
      communeName: entry.communeName,
      cityName: entry.cityName,
      requests: entry.requests,
      delivered: entry.delivered,
      rejected: entry.rejected,
      inProgress: entry.inProgress,
      revenueDelivered: Number(entry.revenueDelivered.toFixed(2)),
      avgPrice: entry.requests ? Number((entry.totalPrice / entry.requests).toFixed(2)) : 0,
      slaBreaches: entry.slaBreaches,
      avgDeliveryMinutes: entry._deliveryCount
        ? Number((entry._deliveryAccumulator / entry._deliveryCount).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 20);

  return res.json({
    kpis,
    communes,
    generatedAt: new Date().toISOString()
  });
});
