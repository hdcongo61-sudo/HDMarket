import asyncHandler from 'express-async-handler';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import { createNotification } from '../utils/notificationService.js';
import {
  assertPlatformDeliveryEnabled,
  canManageDeliveryRequests,
  resolvePlatformDeliveryPrice
} from '../services/platformDeliveryService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import {
  invalidateAdminCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';

const ACTIVE_DELIVERY_REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];
const TERMINAL_DELIVERY_REQUEST_STATUSES = ['REJECTED', 'CANCELED', 'DELIVERED'];
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const isObjectId = (value = '') => OBJECT_ID_REGEX.test(String(value || '').trim());

const escapeRegex = (value = '') =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value = '') => String(value || '').trim();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const buildDeliveryRequestFilter = (query = {}, { forAnalytics = false } = {}) => {
  const {
    status = '',
    pickupCommune = '',
    dropoffCommune = '',
    city = '',
    dateFrom = '',
    dateTo = '',
    shop = '',
    priceMin = '',
    priceMax = ''
  } = query || {};

  const filter = {};
  const normalizedStatus = String(status || '').trim().toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    filter.status = normalizedStatus;
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
  if (cityText) {
    if (isObjectId(cityText)) {
      filter.$or = [{ 'pickup.cityId': cityText }, { 'dropoff.cityId': cityText }];
    } else {
      const cityRegex = new RegExp(escapeRegex(cityText), 'i');
      filter.$or = [{ 'pickup.cityName': cityRegex }, { 'dropoff.cityName': cityRegex }];
    }
  }

  const min = Number(priceMin);
  const max = Number(priceMax);
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
  return {
    ...raw,
    orderId: raw.orderId?._id || raw.orderId,
    sellerId: raw.sellerId?._id || raw.sellerId,
    buyerId: raw.buyerId?._id || raw.buyerId,
    shopId: raw.shopId?._id || raw.shopId
  };
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
    .populate('orderId', '_id status deliveryMode deliveryAddress deliveryCity totalAmount')
    .populate('sellerId', '_id name shopName phone city commune shopAddress')
    .populate('buyerId', '_id name phone city commune address')
    .populate('shopId', '_id name shopName phone city commune')
    .populate('assignedDeliveryGuyId', '_id fullName name phone isActive active cityId communes');
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
  priority = 'HIGH'
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
        priority
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
    User.findById(sellerId).select('_id name shopName phone city commune shopAddress freeDeliveryEnabled').lean(),
    User.findById(order.customer).select('_id name phone city commune address').lean()
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
    req.body?.pickup?.address || seller.shopAddress || firstItem?.snapshot?.shopAddress || ''
  );

  const dropoffCityName = normalizeText(
    order?.shippingAddressSnapshot?.cityName || order.deliveryCity || buyer.city || ''
  );
  const dropoffCommuneName = normalizeText(
    order?.shippingAddressSnapshot?.communeName || buyer.commune || ''
  );
  const dropoffAddress = normalizeText(
    order?.shippingAddressSnapshot?.addressLine || order.deliveryAddress || buyer.address || ''
  );

  const pickupCityById = isObjectId(req.body?.pickup?.cityId || '')
    ? await City.findById(req.body.pickup.cityId).lean()
    : null;
  const pickupCity = pickupCityById || (await findCityByName(pickupCityName));
  const pickupCommuneById = isObjectId(req.body?.pickup?.communeId || '')
    ? await Commune.findById(req.body.pickup.communeId).lean()
    : null;
  const pickupCommune = pickupCommuneById || (await findCommuneByName(pickupCommuneName, pickupCity?._id));

  const dropoffCityById = isObjectId(order?.shippingAddressSnapshot?.cityId || '')
    ? await City.findById(order.shippingAddressSnapshot.cityId).lean()
    : null;
  const dropoffCommuneById = isObjectId(order?.shippingAddressSnapshot?.communeId || '')
    ? await Commune.findById(order.shippingAddressSnapshot.communeId).lean()
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
      address: pickupAddress
    },
    dropoff: {
      cityId: dropoffCity?._id || null,
      cityName: dropoffCity?.name || dropoffCityName,
      communeId: dropoffCommune?._id || null,
      communeName: dropoffCommune?.name || dropoffCommuneName,
      address: dropoffAddress
    },
    deliveryPrice: Number(pricing.deliveryPrice || 0),
    deliveryPriceSource: pricing.deliveryPriceSource || 'UNKNOWN',
    currency: 'XAF',
    productSnapshot: (Array.isArray(sellerItems) ? sellerItems : []).map((item) => ({
      productId: item?.product || null,
      title: item?.snapshot?.title || 'Produit',
      imageUrl: item?.snapshot?.image || '',
      qty: Math.max(1, Number(item?.quantity || 1))
    })),
    invoiceUrl,
    note,
    pickupInstructions,
    status: 'PENDING',
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
    priority: 'HIGH'
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

  const [items, total] = await Promise.all([
    DeliveryRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('orderId', '_id status totalAmount deliveryMode deliveryAddress deliveryCity createdAt')
      .populate('sellerId', '_id name shopName phone city commune')
      .populate('buyerId', '_id name phone city commune')
      .populate('shopId', '_id name shopName phone city commune')
      .populate('assignedDeliveryGuyId', '_id fullName name phone isActive active cityId communes')
      .lean(),
    DeliveryRequest.countDocuments(filter)
  ]);

  return res.json({
    items: items.map((item) => toPublicDeliveryRequest(item)),
    total,
    page: pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filtersEnabled: Boolean(runtime.communeFiltersEnabled)
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
  if (['REJECTED', 'CANCELED', 'DELIVERED'].includes(deliveryRequest.status)) {
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

  deliveryRequest.status = 'ACCEPTED';
  deliveryRequest.acceptedBy = req.user.id;
  deliveryRequest.acceptedAt = new Date();
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
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'ACCEPTED',
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
  if (['REJECTED', 'CANCELED', 'DELIVERED'].includes(deliveryRequest.status)) {
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
  if (['REJECTED', 'CANCELED', 'DELIVERED'].includes(deliveryRequest.status)) {
    return res.status(409).json({ message: 'Impossible d’assigner un livreur à une demande clôturée.' });
  }

  const previousStatus = String(deliveryRequest.status || 'PENDING');
  deliveryRequest.assignedDeliveryGuyId = deliveryGuyId;
  if (deliveryRequest.status === 'PENDING' || deliveryRequest.status === 'ACCEPTED') {
    deliveryRequest.status = 'IN_PROGRESS';
  }
  appendTimeline(deliveryRequest, {
    type: 'DELIVERY_REQUEST_ASSIGNED',
    by: req.user.id,
    meta: {
      deliveryGuyId
    }
  });
  await deliveryRequest.save();

  await updateOrderPlatformDeliveryState({
    orderId: deliveryRequest.orderId,
    requestId: deliveryRequest._id,
    platformDeliveryStatus: 'IN_PROGRESS',
    platformDeliveryMode: 'PLATFORM_DELIVERY',
    deliveryGuyId
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
      deliveryGuyId
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
  if (['REJECTED', 'CANCELED', 'DELIVERED'].includes(String(deliveryRequest.status || ''))) {
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
