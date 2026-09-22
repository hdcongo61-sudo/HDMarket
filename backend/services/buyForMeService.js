import mongoose from 'mongoose';
import BuyForMeConfig from '../models/buyForMeConfigModel.js';
import BuyForMeDispute from '../models/buyForMeDisputeModel.js';
import BuyForMeOrder from '../models/buyForMeOrderModel.js';
import BuyForMePreference from '../models/buyForMePreferenceModel.js';
import BuyForMeReceipt from '../models/buyForMeReceiptModel.js';
import BuyForMeTransaction from '../models/buyForMeTransactionModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import User from '../models/userModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Transfer from '../models/buyForMeTransferModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { eligibleShoppingDriver, shoppingAdminFilter, shoppingId, shoppingError } from './buyForMeAccessService.js';
import { reserveShoppingRefund, reserveShoppingPayout, processShoppingTransfers } from './buyForMeTransferService.js';
import { resolveCanonicalLocation } from './locationSelectionService.js';
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
const BALANCE_PREFERENCES = ['ORIGINAL_PAYMENT', 'DRIVER_TIP', 'PLATFORM_DONATION'];
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
  if (normalized.length !== items.length) throw createHttpError('Complétez chaque article avant de payer.');
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

export const getBuyForMeConfig = async (countryId = null) => {
  if (countryId) {
    const scoped = await BuyForMeConfig.findOne({ key: `country:${countryId}` }).lean();
    if (scoped) return scoped;
  }
  return BuyForMeConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

export const updateBuyForMeConfig = async (patch = {}, countryId = null) => {
  const current = await getBuyForMeConfig(countryId);
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
  if (candidate.minimumBudget < 1 || candidate.maximumBudget < 1) throw createHttpError('Le budget doit être supérieur à zéro.');
  if (candidate.maximumBudget < candidate.minimumBudget) {
    throw createHttpError('La valeur estimée maximale doit être supérieure à la valeur estimée minimale.');
  }
  if (candidate.maximumCommission > 0 && candidate.maximumCommission < candidate.minimumCommission) {
    throw createHttpError('Le plafond de commission doit être supérieur au minimum.');
  }
  const config = await BuyForMeConfig.findOneAndUpdate(
    { key: countryId ? `country:${countryId}` : 'default' },
    { $set: Object.fromEntries(['enabled', ...numericKeys, 'supportedStoreTypes', 'supportedCities'].map(key => [key, candidate[key]])) },
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

export const quoteBuyForMe = async ({ storeType, pickup, dropoff, items, authorizationMode, shoppingBudget, countryId }) => {
  const normalizedAuthorizationMode = normalizeAuthorizationMode(authorizationMode);
  const normalizedItems = normalizeItems(items, { requireEstimatedPrices: normalizedAuthorizationMode === 'ITEM_ESTIMATES' });
  const normalizedPickup = normalizeLocation(pickup);
  const normalizedDropoff = normalizeLocation(dropoff);
  if (!normalizedDropoff.address) {
    throw createHttpError('L’adresse de livraison est requise.');
  }
  if (countryId) {
    for (const location of [normalizedPickup, normalizedDropoff]) {
      if (location.cityId || location.cityName || location.communeId) Object.assign(location, await resolveCanonicalLocation({
        ...location, countryId, requireCommuneWhenConfigured: false
      }));
    }
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
    getBuyForMeConfig(countryId),
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

const notify = async ({ userId, actorId, title, message, orderId, priority = 'HIGH', audience = 'customer' }) => {
  if (!userId) return;
  try {
    const link = audience === 'courier' ? `/delivery/buy-for-me?orderId=${orderId}` : audience === 'admin' ? `/admin/buy-for-me?orderId=${orderId}` : orderId ? `/buy-for-me/${orderId}` : '/buy-for-me/orders';
    await createNotification({
      userId,
      actorId: actorId || null,
      type: 'shopping_order_updated',
      allowSelf: true,
      priority,
      pushEnabled: true,
      entityType: 'shopping_order',
      entityId: String(orderId || ''),
      deepLink: link,
      actionLink: link,
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
  const orderId = await withCommerceOperation(`shopping-create:${checkoutId}`, async session => {
  const checkout = await Checkout.findOne({ checkoutId, user: customerId, paymentState: 'CONFIRMED' }).session(session).lean();
  if (!checkout || checkout.amount !== amountPaid) throw createHttpError('Paiement confirmé introuvable.', 409);
  const existing = await BuyForMeOrder.find({ 'payment.checkoutId': checkoutId }).session(session);
  if (existing.length) {
    if (existing.length !== 1 || asId(existing[0].customerId) !== asId(customerId) || !await BuyForMeTransaction.exists({
      orderId: existing[0]._id, type: 'FUNDING', providerReference: checkoutId, amount: amountPaid
    }).session(session)) throw createHttpError('Ce paiement historique nécessite un rapprochement.', 409);
    return existing[0]._id;
  }
  const snapshot = checkout.buyForMeSnapshot;
  if (!snapshot?.quote || !snapshot?.payload || !checkout.countryId || snapshot.quote.total !== amountPaid) {
    throw createHttpError('Ce paiement nécessite un rapprochement du prix accepté. Ne payez pas à nouveau.', 409);
  }
  payload = snapshot.payload;
  const pickup = normalizeLocation(payload?.pickup);
  const dropoff = normalizeLocation(payload?.dropoff);
  const storeType = stringValue(payload?.storeType, 40).toUpperCase();
  const authorizationMode = normalizeAuthorizationMode(payload?.authorizationMode);
  const items = normalizeItems(payload?.items, { requireEstimatedPrices: authorizationMode === 'ITEM_ESTIMATES' });
  const quote = snapshot.quote;
  const estimatedShoppingValue = quote.estimatedShoppingValue;
  if (Math.abs(Number(amountPaid || 0) - quote.total) > 0.01) {
    throw createHttpError('Le montant payé ne correspond plus au prix à débattre. Veuillez réessayer.', 409);
  }
  const balancePreference = BALANCE_PREFERENCES.includes(String(payload?.balancePreference || '').toUpperCase())
    ? String(payload.balancePreference).toUpperCase()
    : 'ORIGINAL_PAYMENT';

  const [order] = await BuyForMeOrder.create([{
    customerId,
    countryId: checkout.countryId,
    currency: checkout.currency,
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
  }], { session });
    await BuyForMeTransaction.create([{
      orderId: order._id,
      userId: customerId,
      type: 'FUNDING',
      amount: quote.total,
      status: 'RESERVED',
      providerReference: stringValue(checkoutId, 180)
    }], { session });
    await BuyForMePreference.findOneAndUpdate(
      { userId: customerId },
      { $set: { defaultBalancePreference: balancePreference } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
    return order._id;
  });
  await notify({
    userId: customerId,
    actorId: customerId,
    title: 'Demande Acheter Pour Moi créée',
    message: 'Votre paiement est confirmé. Nous recherchons un livreur.',
    orderId
  });
  await Promise.allSettled([invalidateUserCache(customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const listMyBuyForMeOrders = async ({ customerId, page = 1, limit = 20, scope = 'all' }) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const filter = { customerId };
  const terminal = ['COMPLETED', 'CANCELED', 'FAILED'];
  if (scope === 'active') filter.status = { $nin: terminal };
  if (scope === 'history') filter.status = { $in: terminal };
  const [items, total, activeCount, historyCount] = await Promise.all([
    hydrateOrder(BuyForMeOrder.find(filter).sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize)).lean(),
    BuyForMeOrder.countDocuments(filter),
    BuyForMeOrder.countDocuments({ customerId, status: { $nin: terminal } }),
    BuyForMeOrder.countDocuments({ customerId, status: { $in: terminal } })
  ]);
  return { items, total, counts: { active: activeCount, history: historyCount }, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getBuyForMeOrderForCustomer = async ({ orderId, customerId }) => {
  const order = await hydrateOrder(BuyForMeOrder.findOne({ _id: orderId, customerId })).lean();
  if (!order) throw createHttpError('Demande introuvable.', 404);
  order.transfers = await Transfer.find({ orderId }).select('type amount currency status failureReason completedAt reason').lean();
  order.disputes = await BuyForMeDispute.find({ orderId, customerId }).sort({ createdAt: -1 }).lean();
  return order;
};

export const cancelBuyForMeOrder = async ({ orderId, customerId, reason = '' }) => {
  const order = await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId }).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status === 'CANCELED') return order;
  if (order.disputeOpen) throw createHttpError('Le litige doit être examiné avant toute annulation.', 409);
  if (order.additionalPayment?.status === 'PENDING') throw createHttpError('Un paiement est en cours de vérification.', 409);
  if (!['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].includes(order.status)) {
    throw createHttpError('Les achats ont commencé. Signalez un problème pour une annulation avec remboursement adapté.', 409);
  }
  order.status = 'CANCELED';
  order.currentStage = 'FAILED';
  order.cancelledAt = new Date();
  order.cancelledBy = customerId;
  order.additionalPayment.status = 'DECLINED';
  await reserveShoppingRefund({ order, amount: order.payment.totalPaid - Number(order.refundDue || 0), reason: 'CANCELLATION', session });
  appendTimeline(order, 'SHOPPING_ORDER_CANCELED', customerId, { reason: stringValue(reason, 300) });
  await order.save({ session });
  return order;
  });
  if (order.driverId) {
    const driver = await DeliveryGuy.findById(order.driverId).select('userId').lean();
    await notify({ userId: driver?.userId, actorId: customerId, title: 'Course d’achat annulée', message: 'Le client a annulé cette demande.', orderId, audience: 'courier' });
  }
  await processShoppingTransfers({ orderId });
  await Promise.allSettled([invalidateUserCache(customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
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

export const listDriverBuyForMeJobs = async ({ driverId, scope = 'all', page = 1, limit = 30, orderId = '' }) => {
  const driver = await eligibleShoppingDriver(driverId);
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 30));
  const pool = { countryId: driver.countryId, driverId: null, status: 'SEARCHING_DRIVER', currentStage: 'ASSIGNED', disputeOpen: { $ne: true } };
  const normalizedScope = ['assigned', 'pool', 'all'].includes(String(scope).toLowerCase()) ? String(scope).toLowerCase() : 'all';
  const filter = normalizedScope === 'pool' ? pool : normalizedScope === 'assigned' ? { driverId, countryId: driver.countryId } : { countryId: driver.countryId, $or: [{ driverId }, pool] };
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw createHttpError('Mission invalide.');
    filter._id = orderId;
    filter.driverId = driverId;
  }
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

const getDriverOwnedOrder = async ({ orderId, driverId, session = null }) => {
  const driver = await eligibleShoppingDriver(driverId);
  const order = await BuyForMeOrder.findById(orderId).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (asId(order.driverId) !== asId(driverId)) throw createHttpError('Cette mission ne vous est pas attribuée.', 403);
  if (asId(order.countryId) !== asId(driver.countryId)) throw createHttpError('Cette mission appartient à un autre pays.', 403);
  if (order.disputeOpen) throw createHttpError('Cette mission est suspendue pendant l’examen du litige.', 409);
  return order;
};

const getDriverUserId = async (driverId) => {
  const driver = await DeliveryGuy.findById(driverId).select('userId fullName name').lean();
  if (!driver) throw createHttpError('Profil livreur introuvable.', 404);
  return driver;
};

export const acceptBuyForMeJob = async ({ orderId, driverId, actorId }) => {
  const eligible = await eligibleShoppingDriver(driverId);
  const acceptedAt = new Date();
  const order = await BuyForMeOrder.findOneAndUpdate(
    { _id: orderId, countryId: eligible.countryId, driverId: null, status: 'SEARCHING_DRIVER', currentStage: 'ASSIGNED', disputeOpen: { $ne: true } },
    {
      $inc: { __v: 1 },
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
  if (order.disputeOpen || ['REQUIRED', 'PENDING'].includes(order.additionalPayment?.status)) throw createHttpError('Un complément ou un litige doit être traité avant de reprendre.', 409);
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
    item.status = 'CANCELED';
  } else {
    throw createHttpError('Décision invalide.');
  }
  order.status = 'SHOPPING';
  order.currentStage = 'SHOPPING';
  appendTimeline(order, 'CUSTOMER_ITEM_DECISION', customerId, { itemId: String(item._id), action: normalizedAction, replacementNote: item.replacementNote });
  await order.save();
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Décision du client reçue', message: `Le client a répondu pour « ${item.name} ».`, orderId, audience: 'courier' });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const adjustBuyForMeOverage = async ({ orderId, customerId, adjustments = [] }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.disputeOpen) throw createHttpError('Un litige est en cours.', 409);
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
    orderId, audience: 'courier'
  });
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const uploadBuyForMeReceipt = async ({ orderId, driverId, actorId, storeName, amountSpent, receiptImageUrl, productPhotoUrls = [], note = '' }) => {
  const order = await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await getDriverOwnedOrder({ orderId, driverId, session });
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
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session }
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
  } else {
    order.remainingBalance = Math.max(0, estimatedShoppingValue - totalSpent);
    order.status = 'RECEIPT_UPLOADED';
    order.currentStage = 'RECEIPT_UPLOADED';
    appendTimeline(order, 'RECEIPT_UPLOADED', actorId, { amountSpent: totalSpent, remainingBalance: order.remainingBalance });
  }
  await order.save({ session });
  return order;
  });
  if (order.additionalPayment?.status === 'REQUIRED') {
    await notify({ userId: order.customerId, actorId, title: 'Paiement complémentaire requis', message: `Le total des achats dépasse votre montant estimé de ${order.additionalPayment.amount.toLocaleString('fr-FR')} FCFA. Validez le complément avant la livraison.`, orderId });
  } else {
    await notify({ userId: order.customerId, actorId, title: 'Reçu disponible', message: 'Votre livreur a ajouté le reçu. La livraison peut commencer.', orderId });
  }
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const completeBuyForMeAdditionalPayment = async ({ orderId, customerId, checkoutId, amountPaid }) => {
  await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId }).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  const checkout = await Checkout.findOne({ checkoutId, user: customerId, paymentState: 'CONFIRMED' }).session(session).lean();
  if (!checkout || checkout.amount !== amountPaid || checkout.currency !== order.currency || asId(checkout.countryId) !== asId(order.countryId)) throw createHttpError('Paiement confirmé invalide.', 409);
  if (await BuyForMeTransaction.exists({ orderId, type: 'ADDITIONAL_FUNDING', providerReference: checkoutId }).session(session)) return;
  const expected = roundCurrency(order.additionalPayment?.amount);
  await BuyForMeTransaction.create([{ orderId, userId: customerId, type: 'ADDITIONAL_FUNDING', amount: amountPaid, status: 'RESERVED', providerReference: checkoutId }], { session });
  const matching = order.status === 'WAITING_CUSTOMER_APPROVAL' && !order.disputeOpen &&
    ['PENDING', 'REQUIRED'].includes(order.additionalPayment?.status) && order.additionalPayment.checkoutId === checkoutId && expected === amountPaid;
  if (!matching) {
    // Money really arrived after a cancellation/change. Return it to the same
    // payer instead of reviving the order or losing a confirmed payment.
    order.payment.totalPaid += amountPaid;
    await reserveShoppingRefund({ order, amount: amountPaid, reason: `LATE_PAYMENT_${checkoutId}`, checkoutId, session });
    appendTimeline(order, 'LATE_PAYMENT_REFUND_REQUESTED', customerId, { checkoutId, amount: amountPaid });
    await order.save({ session });
    return;
  }
  order.payment.totalPaid += expected;
  order.additionalPayment = { required: false, amount: expected, status: 'PAID', checkoutId: stringValue(checkoutId, 180), requestedAt: order.additionalPayment.requestedAt, resolvedAt: new Date() };
  order.remainingBalance = 0;
  order.status = 'RECEIPT_UPLOADED';
  order.currentStage = 'RECEIPT_UPLOADED';
  appendTimeline(order, 'ADDITIONAL_PAYMENT_PAID', customerId, { amount: expected, checkoutId });
  await order.save({ session });
  });
  const order = await BuyForMeOrder.findById(orderId);
  await processShoppingTransfers({ orderId });
  if (order.status === 'RECEIPT_UPLOADED' && order.driverId) {
    const driver = await DeliveryGuy.findById(order.driverId).select('userId').lean();
    await notify({ userId: driver?.userId, actorId: customerId, title: 'Paiement complémentaire confirmé', message: 'Le client a validé le complément. Vous pouvez livrer la commande.', orderId, audience: 'courier' });
  }
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const declineBuyForMeAdditionalPayment = async ({ orderId, customerId }) => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId });
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.additionalPayment?.status !== 'REQUIRED') throw createHttpError('Aucun paiement complémentaire en attente.', 409);
  if (order.status !== 'WAITING_CUSTOMER_APPROVAL' || order.disputeOpen) throw createHttpError('Cette demande ne peut pas être modifiée.', 409);
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
  await notify({ userId: driver.userId, actorId: customerId, title: 'Paiement complémentaire refusé', message: 'Le client a refusé le complément. Ajustez les achats sans avancer la différence.', orderId, audience: 'courier' });
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
  await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId }).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status === 'COMPLETED') {
    if (order.settlementVersion !== 1) throw createHttpError('Cette ancienne demande doit être rapprochée avant tout versement.', 409);
    return;
  }
  if (order.disputeOpen || await BuyForMeDispute.exists({ orderId, status: { $in: ['OPEN', 'IN_REVIEW'] } }).session(session)) throw createHttpError('Le litige doit être résolu avant de finaliser.', 409);
  if (order.status !== 'DELIVERED') throw createHttpError('La demande doit être livrée avant confirmation.', 409);
  order.status = 'COMPLETED';
  order.currentStage = 'COMPLETED';
  const available = order.payment.totalPaid - Number(order.refundDue || 0);
  const costs = roundCurrency(order.amountSpent) + order.pricing.driverEarnings + order.pricing.serviceCommission;
  if (costs > available) throw createHttpError('Le total des achats doit être rapproché avant la confirmation.', 409);
  const remaining = available - costs;
  order.remainingBalance = remaining;
  order.settlementVersion = 1;
  appendTimeline(order, 'CUSTOMER_CONFIRMED', customerId, { remainingBalance: remaining, preference: order.balancePreference });
  const driver = await DeliveryGuy.findById(order.driverId).session(session).lean();
  if (!driver?.userId) throw createHttpError('Profil livreur à rapprocher.', 409);
  const transactions = [
    { orderId, userId: driver.userId, type: 'DRIVER_EARNING', amount: order.pricing.driverEarnings, status: 'PENDING', metadata: { driverId: asId(order.driverId) } },
    { orderId, userId: driver.userId, type: 'DRIVER_REIMBURSEMENT', amount: order.amountSpent, status: 'PENDING', metadata: { driverId: asId(order.driverId) } }
  ];
  if (remaining > 0) {
    if (['WALLET_REFUND', 'ORIGINAL_PAYMENT'].includes(order.balancePreference)) {
      order.balancePreference = 'ORIGINAL_PAYMENT';
      await reserveShoppingRefund({ order, amount: remaining, reason: 'UNSPENT_BALANCE', session });
    } else if (order.balancePreference === 'DRIVER_TIP') {
      transactions.push({ orderId, userId: driver.userId, type: 'DRIVER_TIP', amount: remaining, status: 'PENDING', metadata: { driverId: asId(order.driverId) } });
    } else {
      transactions.push({ orderId, userId: null, type: 'PLATFORM_DONATION', amount: remaining, status: 'COMPLETED' });
    }
  }
  await BuyForMeTransaction.insertMany(transactions, { session });
  await reserveShoppingPayout({ order, userId: driver.userId, amount: order.amountSpent + order.pricing.driverEarnings + (order.balancePreference === 'DRIVER_TIP' ? remaining : 0), session });
  await BuyForMeTransaction.updateMany({ orderId, type: { $in: ['FUNDING', 'ADDITIONAL_FUNDING'] } }, { $set: { status: 'COMPLETED' } }, { session });
  await order.save({ session });
  });
  const order = await BuyForMeOrder.findById(orderId);
  const driver = await getDriverUserId(order.driverId);
  await notify({ userId: driver.userId, actorId: customerId, title: 'Mission finalisée', message: 'Le client a confirmé la réception des achats. Votre versement est en cours de traitement.', orderId, audience: 'courier' });
  await processShoppingTransfers({ orderId });
  await Promise.allSettled([invalidateUserCache(customerId, ['notifications']), invalidateAdminCache(['admin', 'dashboard', 'delivery'])]);
  return getBuyForMeOrderForCustomer({ orderId, customerId });
};

export const openBuyForMeDispute = async ({ orderId, customerId, reason }) => {
  const result = await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, customerId }).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  const existing = await BuyForMeDispute.findOne({ orderId, status: { $in: ['OPEN', 'IN_REVIEW'] } }).session(session);
  if (existing) return { dispute: existing, order };
  if (TERMINAL_STATUSES.includes(order.status) || order.status === 'PENDING_PAYMENT') throw createHttpError('Cette demande est clôturée. Contactez l’assistance pour ce paiement historique.', 409);
  if (!stringValue(reason, 1000)) throw createHttpError('Décrivez le problème.');
  const [dispute] = await BuyForMeDispute.create([{ orderId, customerId, countryId: order.countryId, reason: stringValue(reason, 1000) }], { session });
  order.disputeOpen = true;
  appendTimeline(order, 'DISPUTE_OPENED', customerId, { disputeId: dispute._id });
  await order.save({ session });
  return { dispute, order };
  });
  const staff = await User.find({ $or: [{ role: 'founder' }, { role: 'admin', adminCountryIds: result.order.countryId }] }).select('_id').lean();
  await Promise.all(staff.map(user => notify({ userId: user._id, actorId: customerId, title: 'Litige Acheter pour moi', message: 'Une demande nécessite votre examen.', orderId, audience: 'admin' })));
  if (result.order.driverId) {
    const driver = await getDriverUserId(result.order.driverId);
    await notify({ userId: driver.userId, actorId: customerId, title: 'Mission suspendue', message: 'Un litige est en cours d’examen. Attendez la décision avant de poursuivre.', orderId, audience: 'courier' });
  }
  return result.dispute.toObject();
};

export const getAdminBuyForMeOrders = async ({ status = '', search = '', page = 1, limit = 30, user, countryId } = {}) => {
  const filter = await shoppingAdminFilter(user, countryId);
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

export const getAdminBuyForMeStats = async ({ user, countryId } = {}) => {
  const filter = await shoppingAdminFilter(user, countryId);
  const match = { $match: filter };
  const [byStatus, totals, topStores, topDrivers, refunds] = await Promise.all([
    BuyForMeOrder.aggregate([match, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    BuyForMeOrder.aggregate([
      match, { $match: { status: 'COMPLETED', settlementVersion: 1 } },
      { $group: { _id: null, revenue: { $sum: '$pricing.serviceCommission' }, basket: { $avg: { $ifNull: ['$estimatedShoppingValue', '$maxShoppingBudget'] } }, shoppingValue: { $avg: '$amountSpent' }, deliveryFee: { $avg: '$pricing.deliveryFee' }, commission: { $avg: '$pricing.serviceCommission' }, driverEarnings: { $sum: '$pricing.driverEarnings' } } }
    ]),
    BuyForMeOrder.aggregate([match, { $group: { _id: '$preferredStore', count: { $sum: 1 } } }, { $match: { _id: { $ne: '' } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    BuyForMeOrder.aggregate([match, { $match: { driverId: { $ne: null }, status: 'COMPLETED', settlementVersion: 1 } }, { $group: { _id: '$driverId', count: { $sum: 1 }, earnings: { $sum: '$pricing.driverEarnings' } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    Transfer.aggregate([{ $match: { ...filter, type: 'REFUND', status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
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

export const assignBuyForMeDriver = async ({ orderId, driverId, actorId, user }) => {
  if (!mongoose.isValidObjectId(driverId)) throw createHttpError('Livreur invalide.');
  const filter = await shoppingAdminFilter(user);
  const target = await BuyForMeOrder.findOne({ _id: orderId, ...filter }).lean();
  if (!target) throw createHttpError('Demande introuvable.', 404);
  const driver = await eligibleShoppingDriver(driverId);
  if (shoppingId(target.countryId) !== shoppingId(driver.countryId)) throw createHttpError('Ce livreur appartient à un autre pays.', 403);
  const order = await BuyForMeOrder.findOneAndUpdate(
    { _id: orderId, ...filter, status: 'SEARCHING_DRIVER', driverId: null, disputeOpen: { $ne: true } },
    { $inc: { __v: 1 }, $set: { driverId, status: 'DRIVER_ASSIGNED', currentStage: 'ACCEPTED', assignmentAcceptedAt: new Date() }, $push: { timeline: { type: 'DRIVER_ASSIGNED_BY_ADMIN', by: actorId, at: new Date(), meta: { driverId } } } },
    { new: true, runValidators: true }
  );
  if (!order) throw createHttpError('Cette demande ne peut plus être assignée.', 409);
  await notify({ userId: driver.userId, actorId, title: 'Nouvelle mission d’achat', message: 'Une demande Acheter Pour Moi vous a été assignée.', orderId, audience: 'courier' });
  await notify({ userId: order.customerId, actorId, title: 'Livreur assigné', message: 'Un livreur a été assigné à votre demande.', orderId });
  return (await hydrateOrder(BuyForMeOrder.findById(orderId))).toObject();
};

export const adminCancelBuyForMeOrder = async ({ orderId, actorId, user, reason = '' }) => {
  const filter = await shoppingAdminFilter(user);
  const order = await withCommerceOperation(`shopping:${orderId}`, async session => {
  const order = await BuyForMeOrder.findOne({ _id: orderId, ...filter }).session(session);
  if (!order) throw createHttpError('Demande introuvable.', 404);
  if (order.status === 'CANCELED') return order;
  if (TERMINAL_STATUSES.includes(order.status)) throw createHttpError('Cette demande est déjà clôturée.', 409);
  if (order.additionalPayment?.status === 'PENDING') throw createHttpError('Vérifiez le paiement en cours avant d’annuler.', 409);
  if (!stringValue(reason, 300)) throw createHttpError('Indiquez le motif de l’annulation et du remboursement intégral.');
  order.status = 'CANCELED';
  order.currentStage = 'FAILED';
  order.cancelledAt = new Date();
  order.cancelledBy = actorId;
  order.additionalPayment.status = 'DECLINED';
  order.additionalPayment.required = false;
  order.disputeOpen = false;
  await reserveShoppingRefund({ order, amount: order.payment.totalPaid - Number(order.refundDue || 0), reason: 'CANCELLATION', session });
  await BuyForMeDispute.updateMany({ orderId, status: { $in: ['OPEN', 'IN_REVIEW'] } }, { $set: {
    status: 'RESOLVED', resolution: stringValue(reason, 1000), refundAmount: order.refundDue, resolvedBy: actorId, resolvedAt: new Date()
  } }, { session });
  appendTimeline(order, 'SHOPPING_ORDER_CANCELED_BY_ADMIN', actorId, { reason: stringValue(reason, 300) });
  await order.save({ session });
  return order;
  });
  await notify({ userId: order.customerId, actorId, title: 'Demande annulée', message: reason ? `Votre demande a été annulée : ${reason}` : 'Votre demande a été annulée.', orderId });
  if (order.driverId) {
    const driver = await getDriverUserId(order.driverId);
    await notify({ userId: driver.userId, actorId, title: 'Mission annulée', message: 'Cette mission d’achat a été annulée par un administrateur.', orderId, audience: 'courier' });
  }
  await processShoppingTransfers({ orderId });
  return getBuyForMeOrderForCustomer({ orderId, customerId: order.customerId });
};

export const listShoppingDisputes = async ({ user, countryId }) => {
  const filter = await shoppingAdminFilter(user, countryId);
  return BuyForMeDispute.find({ ...filter, status: { $in: ['OPEN', 'IN_REVIEW'] } }).populate('customerId', 'name').populate('orderId', 'status payment refundDue').sort({ createdAt: 1 }).limit(100).lean();
};

export const resolveShoppingDispute = async ({ disputeId, user, status, resolution }) => {
  const filter = await shoppingAdminFilter(user);
  const dispute = await BuyForMeDispute.findOne({ _id: disputeId, ...filter }).lean();
  if (!dispute) throw shoppingError('Litige introuvable.', 404);
  if (!['IN_REVIEW', 'RESOLVED', 'REJECTED'].includes(status)) throw shoppingError('Décision invalide.');
  if (status !== 'IN_REVIEW' && !stringValue(resolution, 1000)) throw shoppingError('Expliquez la décision.');
  await withCommerceOperation(`shopping:${dispute.orderId}`, async session => {
    const current = await BuyForMeDispute.findById(disputeId).session(session);
    if (!['OPEN', 'IN_REVIEW'].includes(current.status)) throw shoppingError('Ce litige est déjà clôturé.', 409);
    const order = await BuyForMeOrder.findOne({ _id: current.orderId, ...filter }).session(session);
    if (!order) throw shoppingError('Demande introuvable.', 404);
    current.status = status; current.resolution = stringValue(resolution, 1000);
    if (status !== 'IN_REVIEW') {
      current.resolvedBy = user._id || user.id; current.resolvedAt = new Date(); order.disputeOpen = false;
    }
    appendTimeline(order, 'DISPUTE_UPDATED', user._id || user.id, { status, resolution: current.resolution });
    await current.save({ session }); await order.save({ session });
  });
  await notify({ userId: dispute.customerId, actorId: user._id || user.id, title: 'Litige mis à jour', message: status === 'IN_REVIEW' ? 'Votre demande est en cours d’examen.' : resolution, orderId: dispute.orderId });
  const order = await BuyForMeOrder.findById(dispute.orderId).lean();
  if (order.driverId) {
    const driver = await getDriverUserId(order.driverId);
    await notify({ userId: driver.userId, title: 'Litige mis à jour', message: status === 'IN_REVIEW' ? 'La mission reste suspendue.' : 'Le litige est clôturé. Consultez la mission.', orderId: order._id, audience: 'courier' });
  }
  return BuyForMeDispute.findById(disputeId).lean();
};

export { STORE_TYPES, BALANCE_PREFERENCES };
