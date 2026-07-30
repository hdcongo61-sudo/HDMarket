import mongoose from 'mongoose';
import BuyForMeConfig from '../models/buyForMeConfigModel.js';
import BuyForMeDispute from '../models/buyForMeDisputeModel.js';
import BuyForMeOrder from '../models/buyForMeOrderModel.js';
import BuyForMePreference from '../models/buyForMePreferenceModel.js';
import BuyForMeReceipt from '../models/buyForMeReceiptModel.js';
import BuyForMeRefund from '../models/buyForMeRefundModel.js';
import BuyForMeTransaction from '../models/buyForMeTransactionModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import User from '../models/userModel.js';
import { estimateParcelPrice } from './parcelRequestService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateUserCache } from '../utils/cache.js';

const STORE_TYPES = [
  'SUPERMARKET',
  'PHARMACY',
  'RESTAURANT',
  'HARDWARE',
  'ELECTRONICS',
  'CLOTHING',
  'LOCAL_MARKET',
  'OTHER'
];
const BALANCE_PREFERENCES = ['WALLET_REFUND', 'DRIVER_TIP', 'PLATFORM_DONATION'];
const AUTHORIZATION_MODES = ['ITEM_ESTIMATES', 'SHOPPING_BUDGET'];
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'FAILED'];

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const stringValue = (value, max = 500) => String(value || '').trim().slice(0, max);
const asId = (value) => String(value?._id || value || '');
const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const roundCurrency = (value) => Math.round(Math.max(0, asNumber(value)));

const toGeoPoint = (coordinates) => {
  const values = Array.isArray(coordinates?.coordinates) ? coordinates.coordinates : coordinates;
  if (!Array.isArray(values) || values.length !== 2) return null;
  const lng = Number(values[0]);
  const lat = Number(values[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
};

const normalizeLocation = (raw = {}) => ({
  cityId: raw.cityId || null,
  cityName: stringValue(raw.cityName, 100),
  communeId: raw.communeId || null,
  communeName: stringValue(raw.communeName, 100),
  address: stringValue(raw.address, 300),
  coordinates: toGeoPoint(raw.coordinates),
  landmarkId: raw.landmarkId || null,
  contactName: stringValue(raw.contactName, 120),
  contactPhone: stringValue(raw.contactPhone, 60)
});

const normalizeAuthorizationMode = (value) =>
  AUTHORIZATION_MODES.includes(String(value || '').toUpperCase())
    ? String(value).toUpperCase()
    : 'ITEM_ESTIMATES';

const normalizeItems = (items = [], { requireEstimatedPrices = true } = {}) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = Number(item?.quantity);
      const estimatedUnitPrice = roundCurrency(item?.estimatedUnitPrice);
      return {
        name: stringValue(item?.name || item?.productName, 140),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        estimatedUnitPrice,
        estimatedTotal: roundCurrency(quantity * estimatedUnitPrice),
        note: stringValue(item?.note, 300),
        imageUrl: stringValue(item?.imageUrl, 1000)
      };
    })
    .filter((item) => item.name && item.quantity > 0 && (!requireEstimatedPrices || (item.estimatedUnitPrice > 0 && item.estimatedTotal > 0)));
  if (!normalized.length) {
    throw createHttpError(requireEstimatedPrices
      ? 'Ajoutez au moins un article avec sa quantité et son prix estimé.'
      : 'Ajoutez au moins un article avec sa quantité.');
  }
  if (normalized.length > 30) throw createHttpError('Une demande est limitée à 30 articles.');
  return normalized;
};

const getEstimatedShoppingValue = (items = []) =>
  roundCurrency((Array.isArray(items) ? items : []).reduce((total, item) => total + roundCurrency(item?.estimatedTotal), 0));

const getAuthorizedShoppingValue = (order = {}) =>
  roundCurrency(
    order?.estimatedShoppingValue ||
    order?.pricing?.estimatedShoppingValue ||
    order?.pricing?.shoppingBudget ||
    order?.maxShoppingBudget
  );

export const getBuyForMeConfig = async () =>
  BuyForMeConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

export const updateBuyForMeConfig = async (patch = {}) => {
  const current = await getBuyForMeConfig();
  const next = {};
  const booleanKeys = ['enabled'];
  booleanKeys.forEach((key) => {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  });
  const numericKeys = [
    'serviceCommissionPercent',
    'minimumCommission',
    'maximumCommission',
    'cashAdvanceFee',
    'minimumBudget',
    'maximumBudget'
  ];
  numericKeys.forEach((key) => {
    if (patch[key] === undefined || patch[key] === '') return;
    const value = Number(patch[key]);
    if (!Number.isFinite(value) || value < 0) throw createHttpError(`Valeur invalide pour ${key}.`);
    next[key] = Math.round(value);
  });
  if (next.serviceCommissionPercent !== undefined && next.serviceCommissionPercent > 100) {
    throw createHttpError('La commission ne peut pas dépasser 100 %.');
  }
  if (Array.isArray(patch.supportedStoreTypes)) {
    const values = patch.supportedStoreTypes.map((entry) => String(entry || '').trim().toUpperCase()).filter((entry) => STORE_TYPES.includes(entry));
    if (!values.length) throw createHttpError('Sélectionnez au moins un type de magasin.');
    next.supportedStoreTypes = Array.from(new Set(values));
  }
  if (Array.isArray(patch.supportedCities)) {
    next.supportedCities = Array.from(new Set(patch.supportedCities.map((entry) => stringValue(entry, 100)).filter(Boolean)));
  }

  const candidate = { ...current, ...next };
  if (candidate.maximumBudget < candidate.minimumBudget) {
    throw createHttpError('La valeur estimée maximale doit être supérieure à la valeur estimée minimale.');
  }
  if (candidate.maximumCommission > 0 && candidate.maximumCommission < candidate.minimumCommission) {
    throw createHttpError('Le plafond de commission doit être supérieur au minimum.');
  }
  const config = await BuyForMeConfig.findOneAndUpdate(
    { key: 'default' },
    { $set: next, $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();
  return config;
};

const calculateCommission = ({ budget, config }) => {
  const raw = (budget * Number(config.serviceCommissionPercent || 0)) / 100;
  const withMinimum = Math.max(raw, Number(config.minimumCommission || 0));
  const maximum = Number(config.maximumCommission || 0);
  return roundCurrency(maximum > 0 ? Math.min(withMinimum, maximum) : withMinimum);
};

const checkAvailability = ({ config, storeType, pickup, budget }) => {
  if (!config.enabled) throw createHttpError('Le service Acheter Pour Moi est temporairement indisponible.', 403);
  if (!STORE_TYPES.includes(storeType) || !config.supportedStoreTypes.includes(storeType)) {
    throw createHttpError('Ce type de magasin n’est pas encore pris en charge.');
  }
  if (budget < Number(config.minimumBudget || 1) || budget > Number(config.maximumBudget || Number.MAX_SAFE_INTEGER)) {
    throw createHttpError(`La valeur estimée des achats doit être comprise entre ${config.minimumBudget} et ${config.maximumBudget} FCFA.`);
  }
  const supportedCities = Array.isArray(config.supportedCities) ? config.supportedCities : [];
  if (supportedCities.length && !supportedCities.some((city) => city.toLowerCase() === pickup.cityName.toLowerCase())) {
    throw createHttpError('Ce service n’est pas encore disponible dans cette ville.', 403);
  }
};

export const quoteBuyForMe = async ({ storeType, pickup, dropoff, items, authorizationMode, shoppingBudget }) => {
  const normalizedAuthorizationMode = normalizeAuthorizationMode(authorizationMode);
  const normalizedItems = normalizeItems(items, { requireEstimatedPrices: normalizedAuthorizationMode === 'ITEM_ESTIMATES' });
  const normalizedPickup = normalizeLocation(pickup);
  const normalizedDropoff = normalizeLocation(dropoff);
  if (!normalizedDropoff.address) {
    throw createHttpError('L’adresse de livraison est requise.');
  }
  // If the customer has no preferred shop address, price the trip from their
  // delivery area. The courier can then choose a suitable nearby store.
  const pricingPickup = normalizedPickup.address
    || normalizedPickup.cityId
    || normalizedPickup.communeId
    || normalizedPickup.coordinates
    ? normalizedPickup
    : normalizedDropoff;
  const [config, deliveryQuote] = await Promise.all([
    getBuyForMeConfig(),
    estimateParcelPrice({ pickup: pricingPickup, dropoff: normalizedDropoff })
  ]);
  const itemEstimatedValue = getEstimatedShoppingValue(normalizedItems);
  const manualShoppingBudget = roundCurrency(shoppingBudget);
  const estimatedShoppingValue = normalizedAuthorizationMode === 'SHOPPING_BUDGET' ? manualShoppingBudget : itemEstimatedValue;
  if (estimatedShoppingValue <= 0) {
    throw createHttpError(normalizedAuthorizationMode === 'SHOPPING_BUDGET'
      ? 'Indiquez le budget autorisé pour les achats.'
      : 'Ajoutez un prix estimé à chaque article.');
  }
  const normalizedStoreType = stringValue(storeType, 40).toUpperCase();
  checkAvailability({ config, storeType: normalizedStoreType, pickup: pricingPickup, budget: estimatedShoppingValue });

  const deliveryFee = roundCurrency(deliveryQuote?.price);
  const cashAdvanceFee = roundCurrency(config.cashAdvanceFee);
  const serviceCommission = calculateCommission({ budget: estimatedShoppingValue, config });
  const total = estimatedShoppingValue + cashAdvanceFee + deliveryFee + serviceCommission;
  return {
    currency: 'XAF',
    authorizationMode: normalizedAuthorizationMode,
    shoppingBudget: estimatedShoppingValue,
    estimatedShoppingValue,
    cashAdvanceFee,
    deliveryFee,
    serviceCommission,
    serviceCommissionPercent: Number(config.serviceCommissionPercent || 0),
    total,
    driverEarnings: deliveryFee + cashAdvanceFee,
    distanceMeters: roundCurrency(deliveryQuote?.distanceMeters),
    pricingVersion: String(deliveryQuote?.pricingVersion || ''),
    breakdown: [
      { key: 'estimatedShoppingValue', label: normalizedAuthorizationMode === 'SHOPPING_BUDGET' ? 'Budget d’achats autorisé' : 'Valeur estimée des achats', amount: estimatedShoppingValue },
      { key: 'cashAdvanceFee', label: 'Frais d’avance / retrait', amount: cashAdvanceFee },
      { key: 'deliveryFee', label: 'Frais de livraison', amount: deliveryFee },
      { key: 'serviceCommission', label: `Frais de service HDMarket (${Number(config.serviceCommissionPercent || 0)} %)`, amount: serviceCommission }
    ]
  };
};

const appendTimeline = (order, type, by, meta = {}) => {
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({ type, by: by || null, at: new Date(), meta });
};

const notify = async ({ userId, actorId, title, message, orderId, priority = 'HIGH' }) => {
  if (!userId) return;
  try {
    await createNotification({
      userId,
      actorId: actorId || null,
      type: 'shopping_order_updated',
      allowSelf: true,
      priority,
      pushEnabled: true,
      entityType: 'shopping_order',
      entityId: String(orderId || ''),
      deepLink: orderId ? `/buy-for-me/${orderId}` : '/buy-for-me/orders',
      actionLink: orderId ? `/buy-for-me/${orderId}` : '/buy-for-me/orders',
      metadata: { title, message, shoppingOrderId: String(orderId || '') },
      title,
      message
    });
  } catch {
    // Notifications must never prevent an order transition.
  }
};

const hydrateOrder = (query) =>
  query
    .populate('customerId', 'name phone')
    .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone' }, select: 'fullName name phone photoUrl userId' })
    .populate('receiptId');

export const createPaidBuyForMeOrder = async ({ customerId, checkoutId, amountPaid, payload }) => {
  const pickup = normalizeLocation(payload?.pickup);
  const dropoff = normalizeLocation(payload?.dropoff);
  const storeType = stringValue(payload?.storeType, 40).toUpperCase();
  const authorizationMode = normalizeAuthorizationMode(payload?.authorizationMode);
  const items = normalizeItems(payload?.items, { requireEstimatedPrices: authorizationMode === 'ITEM_ESTIMATES' });
  const quote = await quoteBuyForMe({
    storeType,
    pickup,
    dropoff,
    items,
    authorizationMode,
    shoppingBudget: payload?.shoppingBudget
  });
  const estimatedShoppingValue = quote.estimatedShoppingValue;
  if (Math.abs(Number(amountPaid || 0) - quote.total) > 0.01) {
    throw createHttpError('Le montant payé ne correspond plus au devis. Veuillez réessayer.', 409);
  }
  const balancePreference = BALANCE_PREFERENCES.includes(String(payload?.balancePreference || '').toUpperCase())
    ? String(payload.balancePreference).toUpperCase()
    : 'WALLET_REFUND';

  const order = await BuyForMeOrder.create({
    customerId,
    storeType,
    preferredStore: stringValue(payload?.preferredStore, 140),
    pickup,
    dropoff,
    items,
    specialInstructions: stringValue(payload?.specialInstructions, 1000),
    authorizationMode,
    // Keep the former field in sync for historical compatibility. The source
    // of truth is now the item-derived estimatedShoppingValue.
    maxShoppingBudget: estimatedShoppingValue,
    estimatedShoppingValue,
    pricing: quote,
    balancePreference,
    payment: {
      method: 'PAWAPAY',
      status: 'PAID',
      checkoutId: stringValue(checkoutId, 180),
      paidAt: new Date(),
      totalPaid: quote.total
    },
    status: 'SEARCHING_DRIVER',
    currentStage: 'ASSIGNED',
    timeline: [
      { type: 'SHOPPING_ORDER_PAID', by: customerId, at: new Date(), meta: { checkoutId, total: quote.total } },
      { type: 'DRIVER_SEARCH_STARTED', by: customerId, at: new Date() }
    ]
  });
  await Promise.all([
    BuyForMeTransaction.create({
      orderId: order._id,
      userId: customerId,
      type: 'FUNDING',
      amount: quote.total,
      status: 'RESERVED',
      providerReference: stringValue(checkoutId, 180)
    }),
    BuyForMePreference.findOneAndUpdate(
      { userId: customerId },
      { $set: { defaultBalancePreference: balancePreference } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    invalidateUserCache(customerId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);
  await notify({
    userId: customerId,
    actorId: customerId,
    title: 'Demande Acheter Pour Moi créée',
    message: 'Votre paiement est confirmé. Nous recherchons un livreur.',
    orderId: order._id
  });
  return (await hydrateOrder(BuyForMeOrder.findById(order._id))).toObject();
};

export const listMyBuyForMeOrders = async ({ customerId, page = 1, limit = 20 }) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const filter = { customerId };
  const [items, total] = await Promise.all([
    hydrateOrder(BuyForMeOrder.find(filter).sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize)).lean(),
    BuyForMeOrder.countDocuments(filter)
  ]);
  return { items, total, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getBuyForMeOrderForCustomer = async ({ orderId, customerId }) => {
  const order = await hydrateOrder(BuyForMeOrder.findOne({ _id: orderId, customerId })).lean();
  if (!order) throw createHttpError('Demande introuvable.', 404);
  return order;
};

export const cancelBuyForMeOrder = async ({ orderId, customerId, reason = '' }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  const cancellationDuringOverage = order.status === 'WAITING_CUSTOMER_APPROVAL' && order.additionalPayment?.status === 'REQUIRED';
  if (!['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].includes(order.status) && !cancellationDuringOverage) {
    throw createHttpError('Cette demande ne peut plus être annulée à cette étape.', 409);
  }
  order.status = 'CANCELED';
  order.currentStage = 'FAILED';
  order.cancelledAt = new Date();
  order.cancelledBy = customerId;
  if (cancellationDuringOverage) {
    order.additionalPayment.status = 'DECLINED';
    order.additionalPayment.resolvedAt = new Date();
  }
  appendTimeline(order, 'SHOPPING_ORDER_CANCELED', customerId, { reason: stringValue(reason, 300) });
  await order.save();
  if (order.driverId) {
    const driver = await DeliveryGuy.findById(order.driverId).select('userId').lean();
    await notify({ userId: driver?.userId, actorId: customerId, title: 'Course d’achat annulée', message: 'Le client a annulé cette demande.', orderId });
  }
  await Promise.all([invalidateUserCache(customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

const sanitizeForDriverPool = (raw = {}) => ({
  ...raw,
  claimable: true,
  pickup: { ...(raw.pickup || {}), address: '', coordinates: null, contactName: '', contactPhone: '' },
  dropoff: { ...(raw.dropoff || {}), address: '', coordinates: null, contactName: '', contactPhone: '' },
  customerId: raw.customerId ? { _id: raw.customerId?._id || raw.customerId, name: 'Client HDMarket', phone: '' } : null
});

const toDriverJob = (order, driverId) => {
  const raw = order?.toObject ? order.toObject() : order;
  const assigned = asId(raw?.driverId);
  if (!assigned || assigned !== asId(driverId)) return sanitizeForDriverPool(raw);
  return { ...raw, kind: 'BUY_FOR_ME', claimable: false };
};

export const listDriverBuyForMeJobs = async ({ driverId, scope = 'all', page = 1, limit = 30 }) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 30));
  const pool = { driverId: null, status: 'SEARCHING_DRIVER', currentStage: 'ASSIGNED' };
  const normalizedScope = ['assigned', 'pool', 'all'].includes(String(scope).toLowerCase()) ? String(scope).toLowerCase() : 'all';
  const filter = normalizedScope === 'pool' ? pool : normalizedScope === 'assigned' ? { driverId } : { $or: [{ driverId }, pool] };
  const [items, total] = await Promise.all([
    hydrateOrder(BuyForMeOrder.find(filter).sort({ updatedAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize)).lean(),
    BuyForMeOrder.countDocuments(filter)
  ]);
  return {
    items: items.map((item) => toDriverJob(item, driverId)),
    total,
    page: pageNumber,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
};

const getDriverOwnedOrder = async ({ orderId, driverId }) => {
  const order = await BuyForMeOrder.findById(orderId);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (asId(order.driverId) !== asId(driverId)) throw createHttpError('Cette mission ne vous est pas attribuée.', 403);
  return order;
};

const getDriverUserId = async (driverId) => {
  const driver = await DeliveryGuy.findById(driverId).select('userId fullName name').lean();
  if (!driver) throw createHttpError('Profil livreur introuvable.', 404);
  return driver;
};

export const acceptBuyForMeJob = async ({ orderId, driverId, actorId }) => {
  const acceptedAt = new Date();
  const order = await BuyForMeOrder.findOneAndUpdate(
    { _id: orderId, driverId: null, status: 'SEARCHING_DRIVER', currentStage: 'ASSIGNED' },
    {
      $set: { driverId, status: 'DRIVER_ASSIGNED', currentStage: 'ACCEPTED', assignmentAcceptedAt: acceptedAt },
      $push: { timeline: { type: 'DRIVER_ACCEPTED', by: actorId, at: acceptedAt, meta: { driverId: asId(driverId) } } }
    },
    { new: true, runValidators: true }
  );
  if (!order) throw createHttpError('Cette mission vient d’être prise par un autre livreur.', 409);
  const driver = await getDriverUserId(driverId);
  await notify({
    userId: order.customerId,
    actorId,
    title: 'Livreur trouvé',
    message: `${driver.fullName || driver.name || 'Votre livreur'} a accepté votre demande et va commencer les achats.`,
    orderId
  });
  await Promise.all([invalidateUserCache(order.customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const rejectBuyForMeJob = async ({ orderId, driverId, actorId, reason = '' }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (order.status !== 'DRIVER_ASSIGNED') {
    throw createHttpError('Cette mission ne peut plus être refusée à cette étape.', 409);
  }
  order.driverId = null;
  order.status = 'SEARCHING_DRIVER';
  order.currentStage = 'ASSIGNED';
  order.assignmentAcceptedAt = null;
  appendTimeline(order, 'DRIVER_REJECTED', actorId, { reason: stringValue(reason, 300) });
  await order.save();
  await notify({
    userId: order.customerId,
    actorId,
    title: 'Recherche d’un autre livreur',
    message: 'Le livreur était indisponible. Nous cherchons un autre livreur.',
    orderId
  });
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const startBuyForMeShopping = async ({ orderId, driverId, actorId }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (!['DRIVER_ASSIGNED', 'SHOPPING'].includes(order.status)) throw createHttpError('Les achats ne peuvent pas démarrer à cette étape.', 409);
  if (order.status !== 'SHOPPING') {
    order.status = 'SHOPPING';
    order.currentStage = 'SHOPPING';
    appendTimeline(order, 'SHOPPING_STARTED', actorId);
    await order.save();
    await notify({ userId: order.customerId, actorId, title: 'Achats en cours', message: 'Votre livreur commence les achats.', orderId });
  }
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const updateBuyForMeItemAvailability = async ({ orderId, driverId, actorId, itemId, status, replacementNote = '' }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (order.status !== 'SHOPPING') throw createHttpError('Les articles ne peuvent être modifiés que pendant les achats.', 409);
  const item = order.items.id(itemId);
  if (!item) throw createHttpError('Article introuvable.', 404);
  const normalizedStatus = String(status || '').toUpperCase();
  if (!['FOUND', 'UNAVAILABLE'].includes(normalizedStatus)) throw createHttpError('Statut d’article invalide.');
  item.status = normalizedStatus;
  item.replacementNote = stringValue(replacementNote, 300);
  if (normalizedStatus === 'UNAVAILABLE') {
    order.status = 'WAITING_CUSTOMER_APPROVAL';
    order.currentStage = 'WAITING_APPROVAL';
    appendTimeline(order, 'ITEM_UNAVAILABLE', actorId, { itemId: String(item._id), item: item.name, replacementNote: item.replacementNote });
    await notify({
      userId: order.customerId,
      actorId,
      title: 'Article indisponible',
      message: `${item.name} est indisponible. Choisissez un remplacement, annulez l’article ou poursuivez sans lui.`,
      orderId
    });
  } else {
    appendTimeline(order, 'ITEM_FOUND', actorId, { itemId: String(item._id), item: item.name });
  }
  await order.save();
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const respondToBuyForMeItem = async ({ orderId, customerId, itemId, action, replacementNote = '' }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status !== 'WAITING_CUSTOMER_APPROVAL') throw createHttpError('Aucune décision client n’est attendue.', 409);
  const item = order.items.id(itemId);
  if (!item || item.status !== 'UNAVAILABLE') throw createHttpError('Cet article ne nécessite pas de décision.', 409);
  const normalizedAction = String(action || '').toUpperCase();
  if (normalizedAction === 'REPLACE') {
    const note = stringValue(replacementNote, 300);
    if (!note) throw createHttpError('Indiquez le produit de remplacement souhaité.');
    item.status = 'REPLACED';
    item.replacementNote = note;
  } else if (normalizedAction === 'CANCEL') {
    item.status = 'CANCELED';
  } else if (normalizedAction === 'CONTINUE') {
    item.status = 'UNAVAILABLE';
  } else {
    throw createHttpError('Décision invalide.');
  }
  order.status = 'SHOPPING';
  order.currentStage = 'SHOPPING';
  appendTimeline(order, 'CUSTOMER_ITEM_DECISION', customerId, { itemId: String(item._id), action: normalizedAction, replacementNote: item.replacementNote });
  await order.save();
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Décision du client reçue', message: `Le client a répondu pour « ${item.name} ».`, orderId });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const adjustBuyForMeOverage = async ({ orderId, customerId, adjustments = [] }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status !== 'WAITING_CUSTOMER_APPROVAL' || order.additionalPayment?.status !== 'REQUIRED') {
    throw createHttpError('Aucun dépassement à ajuster.', 409);
  }

  const requested = Array.isArray(adjustments) ? adjustments : [];
  const applied = [];
  requested.forEach((adjustment) => {
    const item = order.items.id(adjustment?.itemId);
    const action = String(adjustment?.action || '').toUpperCase();
    if (!item || !['CANCEL', 'REPLACE'].includes(action)) return;
    if (action === 'REPLACE') {
      const replacementNote = stringValue(adjustment?.replacementNote, 300);
      if (!replacementNote) throw createHttpError(`Indiquez une alternative moins chère pour « ${item.name} ».`);
      item.status = 'REPLACED';
      item.replacementNote = replacementNote;
      applied.push({ itemId: String(item._id), action, replacementNote });
      return;
    }
    item.status = 'CANCELED';
    item.replacementNote = '';
    applied.push({ itemId: String(item._id), action });
  });
  if (!applied.length) throw createHttpError('Sélectionnez au moins un article à retirer ou remplacer.');

  order.additionalPayment.status = 'DECLINED';
  order.additionalPayment.resolvedAt = new Date();
  order.receiptId = null;
  order.amountSpent = 0;
  order.remainingBalance = 0;
  order.status = 'SHOPPING';
  order.currentStage = 'SHOPPING';
  appendTimeline(order, 'CUSTOMER_OVERAGE_ADJUSTMENTS', customerId, { adjustments: applied, previousExcess: order.additionalPayment.amount });
  await order.save();
  const driver = await getDriverUserId(order.driverId);
  await notify({
    userId: driver.userId,
    actorId: customerId,
    title: 'Achats à ajuster',
    message: 'Le client a demandé des retraits ou remplacements pour rester dans son montant estimé.',
    orderId
  });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const uploadBuyForMeReceipt = async ({ orderId, driverId, actorId, storeName, amountSpent, receiptImageUrl, productPhotoUrls = [], note = '' }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (order.status !== 'SHOPPING') throw createHttpError('Le reçu peut être ajouté uniquement pendant les achats.', 409);
  const totalSpent = roundCurrency(amountSpent);
  const receiptUrl = stringValue(receiptImageUrl, 500);
  if (!receiptUrl) throw createHttpError('La photo du reçu est requise.');
  if (totalSpent <= 0) throw createHttpError('Le montant du reçu doit être supérieur à zéro.');

  const receipt = await BuyForMeReceipt.findOneAndUpdate(
    { orderId },
    {
      $set: {
        uploadedBy: actorId,
        storeName: stringValue(storeName || order.preferredStore || 'Magasin', 140),
        amountSpent: totalSpent,
        receiptImageUrl: receiptUrl,
        productPhotoUrls: (Array.isArray(productPhotoUrls) ? productPhotoUrls : []).map((url) => stringValue(url, 500)).filter(Boolean).slice(0, 5),
        note: stringValue(note, 1000)
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  order.receiptId = receipt._id;
  order.amountSpent = totalSpent;
  const estimatedShoppingValue = getAuthorizedShoppingValue(order);
  const excess = Math.max(0, totalSpent - estimatedShoppingValue);
  if (excess > 0) {
    order.status = 'WAITING_CUSTOMER_APPROVAL';
    order.currentStage = 'WAITING_APPROVAL';
    order.remainingBalance = 0;
    order.additionalPayment = { required: true, amount: excess, status: 'REQUIRED', requestedAt: new Date(), checkoutId: '', resolvedAt: null };
    appendTimeline(order, 'ADDITIONAL_PAYMENT_REQUIRED', actorId, { amount: excess, amountSpent: totalSpent });
    await notify({ userId: order.customerId, actorId, title: 'Paiement complémentaire requis', message: `Le total des achats dépasse votre montant estimé de ${excess.toLocaleString('fr-FR')} FCFA. Validez le complément avant la livraison.`, orderId });
  } else {
    order.remainingBalance = Math.max(0, estimatedShoppingValue - totalSpent);
    order.status = 'RECEIPT_UPLOADED';
    order.currentStage = 'RECEIPT_UPLOADED';
    appendTimeline(order, 'RECEIPT_UPLOADED', actorId, { amountSpent: totalSpent, remainingBalance: order.remainingBalance });
    await notify({ userId: order.customerId, actorId, title: 'Reçu disponible', message: 'Votre livreur a ajouté le reçu. La livraison peut commencer.', orderId });
  }
  await order.save();
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const completeBuyForMeAdditionalPayment = async ({ orderId, customerId, checkoutId, amountPaid }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  const expected = roundCurrency(order.additionalPayment?.amount);
  if (order.additionalPayment?.status !== 'REQUIRED' || expected <= 0) throw createHttpError('Aucun paiement complémentaire n’est requis.', 409);
  if (Math.abs(roundCurrency(amountPaid) - expected) > 0.01) throw createHttpError('Le montant du complément est invalide.', 409);
  order.payment.totalPaid += expected;
  order.additionalPayment = { required: false, amount: expected, status: 'PAID', checkoutId: stringValue(checkoutId, 180), requestedAt: order.additionalPayment.requestedAt, resolvedAt: new Date() };
  order.remainingBalance = 0;
  order.status = 'RECEIPT_UPLOADED';
  order.currentStage = 'RECEIPT_UPLOADED';
  appendTimeline(order, 'ADDITIONAL_PAYMENT_PAID', customerId, { amount: expected, checkoutId });
  await order.save();
  await BuyForMeTransaction.create({ orderId, userId: customerId, type: 'ADDITIONAL_FUNDING', amount: expected, status: 'RESERVED', providerReference: stringValue(checkoutId, 180) });
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Paiement complémentaire confirmé', message: 'Le client a validé le complément. Vous pouvez livrer la commande.', orderId });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const declineBuyForMeAdditionalPayment = async ({ orderId, customerId }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.additionalPayment?.status !== 'REQUIRED') throw createHttpError('Aucun paiement complémentaire en attente.', 409);
  order.additionalPayment.status = 'DECLINED';
  order.additionalPayment.resolvedAt = new Date();
  order.receiptId = null;
  order.amountSpent = 0;
  order.remainingBalance = 0;
  order.status = 'SHOPPING';
  order.currentStage = 'SHOPPING';
  appendTimeline(order, 'ADDITIONAL_PAYMENT_DECLINED', customerId, { amount: order.additionalPayment.amount });
  await order.save();
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Paiement complémentaire refusé', message: 'Le client a refusé le complément. Ajustez les achats sans avancer la différence.', orderId });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const startBuyForMeDelivery = async ({ orderId, driverId, actorId }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (order.status !== 'RECEIPT_UPLOADED') throw createHttpError('Ajoutez un reçu validé avant de démarrer la livraison.', 409);
  order.status = 'DELIVERING';
  order.currentStage = 'IN_TRANSIT';
  appendTimeline(order, 'DELIVERY_STARTED', actorId);
  await order.save();
  await notify({ userId: order.customerId, actorId, title: 'Livraison en route', message: 'Votre livreur est en route avec vos achats.', orderId });
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const markBuyForMeDelivered = async ({ orderId, driverId, actorId }) => {
  const order = await getDriverOwnedOrder({ orderId, driverId });
  if (order.status !== 'DELIVERING') throw createHttpError('La livraison doit être démarrée avant cette confirmation.', 409);
  order.status = 'DELIVERED';
  order.currentStage = 'DELIVERED';
  appendTimeline(order, 'ORDER_DELIVERED', actorId);
  await order.save();
  await notify({ userId: order.customerId, actorId, title: 'Achats livrés', message: 'Vos achats ont été livrés. Confirmez la bonne réception pour finaliser.', orderId });
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const confirmBuyForMeOrder = async ({ orderId, customerId }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status !== 'DELIVERED') throw createHttpError('La demande doit être livrée avant confirmation.', 409);
  order.status = 'COMPLETED';
  order.currentStage = 'COMPLETED';
  const remaining = Math.max(0, getAuthorizedShoppingValue(order) - roundCurrency(order.amountSpent));
  order.remainingBalance = remaining;
  appendTimeline(order, 'CUSTOMER_CONFIRMED', customerId, { remainingBalance: remaining, preference: order.balancePreference });
  await order.save();

  const transactions = [
    { orderId, userId: customerId, type: 'FUNDING', amount: order.payment.totalPaid, status: 'COMPLETED', metadata: { settled: true } },
    { orderId, userId: null, type: 'DRIVER_EARNING', amount: order.pricing.driverEarnings, status: 'COMPLETED', metadata: { driverId: asId(order.driverId) } }
  ];
  if (remaining > 0) {
    if (order.balancePreference === 'WALLET_REFUND') {
      await BuyForMeRefund.findOneAndUpdate(
        { orderId },
        { $set: { customerId, amount: remaining, destination: 'HDMARKET_WALLET', status: 'COMPLETED', reference: `shopping-${orderId}` } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      transactions.push({ orderId, userId: customerId, type: 'WALLET_REFUND', amount: remaining, status: 'COMPLETED' });
    } else if (order.balancePreference === 'DRIVER_TIP') {
      transactions.push({ orderId, userId: null, type: 'DRIVER_TIP', amount: remaining, status: 'COMPLETED', metadata: { driverId: asId(order.driverId) } });
    } else {
      transactions.push({ orderId, userId: null, type: 'PLATFORM_DONATION', amount: remaining, status: 'COMPLETED' });
    }
  }
  await BuyForMeTransaction.insertMany(transactions);
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Mission finalisée', message: 'Le client a confirmé la réception des achats.', orderId });
  await Promise.all([invalidateUserCache(customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const openBuyForMeDispute = async ({ orderId, customerId, reason }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId }).lean();
  if (!order) throw createHttpError('Demande introuvable.', 404);
  const dispute = await BuyForMeDispute.create({ orderId, customerId, reason: stringValue(reason, 1000) });
  await invalidateAdminCache(['admin', 'dashboard', 'delivery']);
  return dispute.toObject();
};

export const getAdminBuyForMeOrders = async ({ status = '', search = '', page = 1, limit = 30 } = {}) => {
  const filter = {};
  if (status && status !== 'ALL') filter.status = String(status).toUpperCase();
  const phrase = stringValue(search, 120);
  if (phrase) {
    const customers = await User.find({ $or: [{ name: { $regex: phrase, $options: 'i' } }, { phone: { $regex: phrase, $options: 'i' } }] }).select('_id').lean();
    filter.$or = [
      { customerId: { $in: customers.map((entry) => entry._id) } },
      { preferredStore: { $regex: phrase, $options: 'i' } },
      { 'items.name': { $regex: phrase, $options: 'i' } }
    ];
  }
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 30));
  const [items, total] = await Promise.all([
    hydrateOrder(BuyForMeOrder.find(filter).sort({ updatedAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize)).lean(),
    BuyForMeOrder.countDocuments(filter)
  ]);
  return { items, total, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getAdminBuyForMeStats = async () => {
  const [byStatus, totals, topStores, topDrivers, refunds] = await Promise.all([
    BuyForMeOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    BuyForMeOrder.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'COMPLETED'] } } },
      { $group: { _id: null, revenue: { $sum: '$pricing.serviceCommission' }, basket: { $avg: { $ifNull: ['$estimatedShoppingValue', '$maxShoppingBudget'] } }, shoppingValue: { $avg: '$amountSpent' }, deliveryFee: { $avg: '$pricing.deliveryFee' }, commission: { $avg: '$pricing.serviceCommission' }, driverEarnings: { $sum: '$pricing.driverEarnings' } } }
    ]),
    BuyForMeOrder.aggregate([{ $group: { _id: '$preferredStore', count: { $sum: 1 } } }, { $match: { _id: { $ne: '' } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    BuyForMeOrder.aggregate([{ $match: { driverId: { $ne: null } } }, { $group: { _id: '$driverId', count: { $sum: 1 }, earnings: { $sum: '$pricing.driverEarnings' } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    BuyForMeRefund.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((entry) => [entry._id, entry.count]));
  return {
    totalOrders: Object.values(statusCounts).reduce((sum, value) => sum + value, 0),
    byStatus: statusCounts,
    revenue: totals[0]?.revenue || 0,
    averageBasket: totals[0]?.basket || 0,
    averageShoppingValue: totals[0]?.shoppingValue || 0,
    averageDeliveryFee: totals[0]?.deliveryFee || 0,
    averageCommission: totals[0]?.commission || 0,
    driverEarnings: totals[0]?.driverEarnings || 0,
    refundTotal: refunds[0]?.total || 0,
    topStores,
    topDrivers
  };
};

export const assignBuyForMeDriver = async ({ orderId, driverId, actorId }) => {
  if (!mongoose.isValidObjectId(driverId)) throw createHttpError('Livreur invalide.');
  const driver = await DeliveryGuy.findById(driverId).select('_id userId fullName name buyForMeOptIn').lean();
  if (!driver) throw createHttpError('Livreur introuvable.', 404);
  if (driver.buyForMeOptIn !== true) {
    throw createHttpError('Ce livreur n’a pas accepté les missions « Acheter pour moi ».', 409);
  }
  const order = await BuyForMeOrder.findOneAndUpdate(
    { _id: orderId, status: 'SEARCHING_DRIVER', driverId: null },
    { $set: { driverId, status: 'DRIVER_ASSIGNED', currentStage: 'ACCEPTED', assignmentAcceptedAt: new Date() }, $push: { timeline: { type: 'DRIVER_ASSIGNED_BY_ADMIN', by: actorId, at: new Date(), meta: { driverId } } } },
    { new: true, runValidators: true }
  );
  if (!order) throw createHttpError('Cette demande ne peut plus être assignée.', 409);
  await notify({ userId: driver.userId, actorId, title: 'Nouvelle mission d’achat', message: 'Une demande Acheter Pour Moi vous a été assignée.', orderId });
  await notify({ userId: order.customerId, actorId, title: 'Livreur assigné', message: 'Un livreur a été assigné à votre demande.', orderId });
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const adminCancelBuyForMeOrder = async ({ orderId, actorId, reason = '' }) => {
  const order = await BuyForMeOrder.findById(orderId);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (TERMINAL_STATUSES.includes(order.status)) throw createHttpError('Cette demande est déjà clôturée.', 409);
  order.status = 'CANCELED';
  order.currentStage = 'FAILED';
  order.cancelledAt = new Date();
  order.cancelledBy = actorId;
  appendTimeline(order, 'SHOPPING_ORDER_CANCELED_BY_ADMIN', actorId, { reason: stringValue(reason, 300) });
  await order.save();
  await notify({ userId: order.customerId, actorId, title: 'Demande annulée', message: reason ? `Votre demande a été annulée : ${reason}` : 'Votre demande a été annulée.', orderId });
  if (order.driverId) {
    const driver = await getDriverUserId(order.driverId);
    await notify({ userId: driver.userId, actorId, title: 'Mission annulée', message: 'Cette mission d’achat a été annulée par un administrateur.', orderId });
  }
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export { STORE_TYPES, BALANCE_PREFERENCES };
