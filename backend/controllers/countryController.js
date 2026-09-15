import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import CountryConfig from '../models/countryConfigModel.js';
import CountryPaymentMethod from '../models/countryPaymentMethodModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import DeliveryGuyApplication from '../models/deliveryGuyApplicationModel.js';
import ParcelRequest from '../models/parcelRequestModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import QuotationRequest from '../models/quotationRequestModel.js';
import BuyForMeOrder from '../models/buyForMeOrderModel.js';
import GlobalNotificationRequest from '../models/globalNotificationRequestModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import {
  canAccessCountry,
  canAdminCountry,
  ensureDefaultCountry,
  findCountry,
  getCountryReadiness,
  getScopedAdminCountryIds,
  isGlobalCountryAdmin,
  listAccessibleCountries,
  resolveCountryContext,
  serializePublicCountry
} from '../services/countryService.js';

const clean = (value = '') => String(value || '').trim();
const cleanUpper = (value = '') => clean(value).toUpperCase();
const actorId = (req) => req.user?.id || req.user?._id || null;

const sanitizeAdminCountry = (country) => {
  const raw = country?.toObject ? country.toObject() : country || {};
  return {
    ...raw,
    id: String(raw._id || ''),
    testerUserIds: (raw.testerUserIds || []).map(String),
    countryAdminUserIds: (raw.countryAdminUserIds || []).map(String)
  };
};

const assertCountryAdmin = (country, req) => {
  if (canAdminCountry(country, req.user)) return;
  const error = new Error("Vous n'avez pas la permission d'administrer ce pays.");
  error.status = 403;
  error.code = 'COUNTRY_ACCESS_DENIED';
  throw error;
};

const assertGlobalCountryAdmin = (req, action = 'cette action') => {
  if (isGlobalCountryAdmin(req.user)) return;
  const error = new Error(`Réservé aux administrateurs globaux : ${action}.`);
  error.status = 403;
  error.code = 'GLOBAL_ADMIN_ONLY';
  throw error;
};

const auditCountryChange = (req, actionType, country, before = null, after = null) =>
  createAuditLogEntry({
    performedBy: actorId(req),
    actionType,
    previousValue: before,
    newValue: after,
    req,
    meta: { scope: 'country', countryId: String(country?._id || country || ''), countryCode: country?.code || '' }
  });

export const listPublicCountries = asyncHandler(async (req, res) => {
  await ensureDefaultCountry();
  const countries = await listAccessibleCountries(req.user || null);
  const current = await resolveCountryContext({
    requestedCountry: req.headers?.['x-country-id'] || req.headers?.['x-country-code'] || req.query?.country,
    user: req.user || null
  }).catch(() => null);
  res.json({
    countries,
    currentCountry: current ? serializePublicCountry(current.country) : countries.find((item) => item.isDefault) || countries[0] || null
  });
});

export const getPublicCountry = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.', code: 'COUNTRY_NOT_FOUND' });
  if (!canAccessCountry(country, req.user || null)) {
    return res.status(403).json({ message: "Ce pays n'est pas disponible.", code: 'COUNTRY_ACCESS_DENIED' });
  }
  const [cities, paymentMethods] = await Promise.all([
    City.find({ countryId: country._id, isActive: true }).sort({ order: 1, name: 1 }).lean(),
    CountryPaymentMethod.find({ countryId: country._id, enabled: true })
      .select('-configurationReference -updatedBy')
      .sort({ sortOrder: 1, displayName: 1 })
      .lean()
  ]);
  res.json({ ...serializePublicCountry(country), cities, paymentMethods });
});

export const selectCountry = asyncHandler(async (req, res) => {
  const country = await findCountry(req.body?.countryId || req.body?.countryCode);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.', code: 'COUNTRY_NOT_FOUND' });
  if (!canAccessCountry(country, req.user)) {
    return res.status(403).json({ message: "Ce pays n'est pas disponible pour votre compte.", code: 'COUNTRY_ACCESS_DENIED' });
  }
  const user = await User.findById(actorId(req));
  user.selectedCountryId = country._id;
  if (!user.countryId) user.countryId = (await ensureDefaultCountry())._id;
  user.preferredCurrency = country.currency.code;
  await user.save();
  res.json({ message: 'Pays sélectionné.', country: serializePublicCountry(country), selectedCountryId: String(country._id) });
});

export const listCountriesAdmin = asyncHandler(async (req, res) => {
  const all = await Country.find().sort({ sortOrder: 1, name: 1 }).lean();
  const visible = all.filter((country) => canAdminCountry(country, req.user));
  const items = await Promise.all(visible.map(async (country) => ({
    ...sanitizeAdminCountry(country),
    readiness: await getCountryReadiness(country)
  })));
  res.json({ items, total: items.length });
});

export const createCountryAdmin = asyncHandler(async (req, res) => {
  assertGlobalCountryAdmin(req, 'créer un pays');
  const payload = req.body || {};
  const currency = payload.currency || {};
  const country = await Country.create({
    name: clean(payload.name),
    officialName: clean(payload.officialName || payload.name),
    code: cleanUpper(payload.code),
    iso3: cleanUpper(payload.iso3),
    phoneCode: clean(payload.phoneCode),
    flagEmoji: clean(payload.flagEmoji) || '🌍',
    defaultLanguage: clean(payload.defaultLanguage || 'fr').toLowerCase(),
    supportedLanguages: payload.supportedLanguages || [payload.defaultLanguage || 'fr'],
    timezone: clean(payload.timezone || 'UTC'),
    currency: {
      code: cleanUpper(currency.code),
      symbol: clean(currency.symbol || currency.code),
      name: clean(currency.name || currency.code),
      decimals: Number(currency.decimals || 0)
    },
    supportedCurrencies: payload.supportedCurrencies || [],
    status: payload.status === 'TEST' ? 'TEST' : 'DRAFT',
    isDefault: false,
    sortOrder: Number(payload.sortOrder || 0),
    settings: payload.settings || {},
    featureOverrides: payload.featureOverrides || {},
    testerUserIds: payload.testerUserIds || [],
    countryAdminUserIds: payload.countryAdminUserIds || [],
    createdBy: actorId(req),
    updatedBy: actorId(req)
  });

  const source = payload.copyFromCountryId ? await findCountry(payload.copyFromCountryId) : null;
  if (source) {
    const sourceConfig = await CountryConfig.findOne({ countryId: source._id }).lean();
    if (sourceConfig) {
      await CountryConfig.create({
        countryId: country._id,
        version: 1,
        effectiveFrom: new Date(),
        locations: sourceConfig.locations || {},
        delivery: sourceConfig.delivery || {},
        fees: sourceConfig.fees || {},
        features: sourceConfig.features || {},
        boosts: sourceConfig.boosts || {},
        ads: sourceConfig.ads || {},
        legal: sourceConfig.legal || {},
        payments: {},
        updatedBy: actorId(req)
      });
    }
    const methods = await CountryPaymentMethod.find({ countryId: source._id }).lean();
    if (methods.length) {
      await CountryPaymentMethod.insertMany(methods.map((method) => ({
        countryId: country._id,
        provider: method.provider,
        type: method.type,
        displayName: method.displayName,
        enabled: false,
        currencies: (method.currencies || []).filter((code) => country.supportedCurrencies.some((entry) => entry.code === code)),
        configurationReference: '',
        publicConfiguration: method.publicConfiguration || {},
        sortOrder: method.sortOrder || 0,
        updatedBy: actorId(req)
      })));
    }
  } else {
    await CountryConfig.create({ countryId: country._id, updatedBy: actorId(req) });
  }

  await auditCountryChange(req, 'COUNTRY_CREATED', country, null, sanitizeAdminCountry(country));
  res.status(201).json({ item: sanitizeAdminCountry(country), readiness: await getCountryReadiness(country) });
});

export const getCountryAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.', code: 'COUNTRY_NOT_FOUND' });
  assertCountryAdmin(country, req);
  const [config, cities, communes, paymentMethods, readiness] = await Promise.all([
    CountryConfig.findOne({ countryId: country._id }).lean(),
    City.find({ countryId: country._id }).sort({ order: 1, name: 1 }).lean(),
    Commune.find({ countryId: country._id }).sort({ order: 1, name: 1 }).lean(),
    CountryPaymentMethod.find({ countryId: country._id }).sort({ sortOrder: 1, displayName: 1 }).lean(),
    getCountryReadiness(country)
  ]);
  res.json({ item: sanitizeAdminCountry(country), config: config || {}, cities, communes, paymentMethods, readiness });
});

export const updateCountryAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.', code: 'COUNTRY_NOT_FOUND' });
  assertCountryAdmin(country, req);
  const before = sanitizeAdminCountry(country);
  const payload = req.body || {};
  const lifecycleKeys = ['status', 'isDefault', 'countryAdminUserIds'];
  if (lifecycleKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
    assertGlobalCountryAdmin(req, 'changer le statut ou les administrateurs du pays');
  }
  const mutable = ['name', 'officialName', 'phoneCode', 'flagEmoji', 'defaultLanguage', 'supportedLanguages', 'timezone', 'currency', 'supportedCurrencies', 'sortOrder', 'settings', 'featureOverrides', 'countryAdminUserIds'];
  mutable.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) country.set(key, payload[key]);
  });
  if (payload.isDefault === true && !country.isDefault) {
    await Country.updateMany({ _id: { $ne: country._id }, isDefault: true }, { $set: { isDefault: false } });
    country.isDefault = true;
  }
  if (payload.status && payload.status !== country.status) {
    const nextStatus = cleanUpper(payload.status);
    if (!['DRAFT', 'TEST', 'ACTIVE', 'DISABLED'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Statut pays invalide.' });
    }
    if (nextStatus === 'ACTIVE') {
      const readiness = await getCountryReadiness(country);
      if (!readiness.canActivate) {
        const requirements = {
          identity: 'les informations du pays',
          currency: 'la devise',
          languages: 'les langues',
          locations: 'au moins une ville active',
          payments: 'au moins un moyen de paiement activé',
          delivery: 'la configuration de livraison'
        };
        const missing = Object.keys(requirements).filter((key) => !readiness.checks[key]);
        const missingLabels = missing.map((key) => requirements[key]);
        const formatted = missingLabels.length > 1
          ? `${missingLabels.slice(0, -1).join(', ')} et ${missingLabels[missingLabels.length - 1]}`
          : missingLabels.join('');
        return res.status(409).json({
          message: `Activation impossible : configurez ${formatted}.`,
          code: 'COUNTRY_LAUNCH_INCOMPLETE',
          readiness
        });
      }
      country.activatedAt = new Date();
    }
    country.disabledAt = nextStatus === 'DISABLED' ? new Date() : null;
    country.status = nextStatus;
  }
  country.updatedBy = actorId(req);
  await country.save();
  const action = country.status === 'ACTIVE' && before.status !== 'ACTIVE'
    ? 'COUNTRY_ENABLED'
    : country.status === 'DISABLED' && before.status !== 'DISABLED'
    ? 'COUNTRY_DISABLED'
    : 'COUNTRY_UPDATED';
  await auditCountryChange(req, action, country, before, sanitizeAdminCountry(country));
  res.json({ item: sanitizeAdminCountry(country), readiness: await getCountryReadiness(country) });
});

export const updateCountryConfigAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const current = await CountryConfig.findOne({ countryId: country._id }).lean();
  const allowed = ['locations', 'payments', 'delivery', 'fees', 'features', 'boosts', 'ads', 'legal'];
  const changes = {};
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) changes[key] = req.body[key];
  });
  const config = current
    ? await CountryConfig.findOneAndUpdate(
        { countryId: country._id },
        {
          $set: { ...changes, effectiveFrom: new Date(), updatedBy: actorId(req) },
          $inc: { version: 1 }
        },
        { new: true }
      )
    : await CountryConfig.create({
        countryId: country._id,
        ...changes,
        version: 1,
        effectiveFrom: new Date(),
        updatedBy: actorId(req)
      });
  if (Object.prototype.hasOwnProperty.call(changes, 'delivery')) {
    country.settings.delivery = {
      enabled: changes.delivery?.enabled !== false,
      configured: Boolean(changes.delivery?.configured)
    };
    await country.save();
  }
  await auditCountryChange(req, 'COUNTRY_CONFIG_UPDATED', country, current, config.toObject());
  res.json({ config });
});

export const upsertCountryPaymentMethodAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const provider = cleanUpper(req.body?.provider);
  if (!provider) return res.status(400).json({ message: 'Provider requis.' });
  const allowedCurrencies = new Set(country.supportedCurrencies.map((item) => item.code));
  const currencies = (req.body?.currencies || [country.currency.code]).map(cleanUpper);
  if (currencies.some((code) => !allowedCurrencies.has(code))) {
    return res.status(400).json({ message: 'Une devise du moyen de paiement est incompatible avec le pays.', code: 'CURRENCY_NOT_SUPPORTED' });
  }
  const previous = await CountryPaymentMethod.findOne({ countryId: country._id, provider }).lean();
  const item = await CountryPaymentMethod.findOneAndUpdate(
    { countryId: country._id, provider },
    {
      $set: {
        type: req.body?.type || 'MOBILE_MONEY',
        displayName: clean(req.body?.displayName || provider),
        enabled: Boolean(req.body?.enabled),
        currencies,
        configurationReference: clean(req.body?.configurationReference),
        publicConfiguration: req.body?.publicConfiguration || {},
        sortOrder: Number(req.body?.sortOrder || 0),
        updatedBy: actorId(req)
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await auditCountryChange(req, 'PAYMENT_CONFIG_CHANGED', country, previous, {
    ...item.toObject(),
    configurationReference: item.configurationReference ? '[CONFIGURED]' : ''
  });
  res.json({ item });
});

export const addCountryTesterAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const userId = req.body?.userId;
  if (!mongoose.isValidObjectId(userId) || !(await User.exists({ _id: userId }))) {
    return res.status(400).json({ message: 'Utilisateur test invalide.' });
  }
  await Country.updateOne({ _id: country._id }, { $addToSet: { testerUserIds: userId }, $set: { updatedBy: actorId(req) } });
  await auditCountryChange(req, 'COUNTRY_TESTER_ADDED', country, null, { userId });
  res.json({ message: 'Testeur ajouté.' });
});

export const removeCountryTesterAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  await Country.updateOne({ _id: country._id }, { $pull: { testerUserIds: req.params.userId }, $set: { updatedBy: actorId(req) } });
  await auditCountryChange(req, 'COUNTRY_TESTER_REMOVED', country, { userId: req.params.userId }, null);
  res.json({ message: 'Testeur retiré.' });
});

// ── Country-embedded admins ────────────────────────────────────────────────
// Each market owns its admin list: admins are attached to the country in BOTH
// directions (user.adminCountryIds and country.countryAdminUserIds). Adding
// someone promotes them to role 'admin' scoped to this country only; removing
// their last country demotes them back to a standard user.

const ADMIN_USER_PROJECTION = 'name phone email role isActive accountType createdAt';

const serializeCountryAdmin = (user) => ({
  _id: String(user._id),
  name: user.name || '',
  phone: user.phone || '',
  email: user.email || '',
  role: user.role,
  isActive: user.isActive !== false,
  accountType: user.accountType || 'person',
  createdAt: user.createdAt || null
});

export const getCountryAdminsAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const admins = await User.find({
    $or: [
      { adminCountryIds: country._id },
      { _id: { $in: country.countryAdminUserIds || [] } }
    ]
  })
    .select(ADMIN_USER_PROJECTION)
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    countryId: String(country._id),
    admins: admins.map(serializeCountryAdmin),
    total: admins.length
  });
});

export const addCountryAdminUser = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const userId = clean(req.body?.userId);
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  const target = await User.findById(userId);
  if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  if (String(target.role || '').toLowerCase() === 'founder') {
    return res.status(400).json({ message: 'Impossible de restreindre un fondateur à un pays.' });
  }
  const scopedIds = (target.adminCountryIds || []).map(String);
  if (String(target.role || '').toLowerCase() === 'admin' && scopedIds.length === 0) {
    return res.status(400).json({
      message: 'Cet admin a un accès global. Retirez-lui l’accès global (Utilisateurs → Pays assignés) avant de l’attacher à un pays.',
      code: 'GLOBAL_ADMIN_ALREADY'
    });
  }
  const countryIdStr = String(country._id);
  if (scopedIds.includes(countryIdStr)) {
    return res.json({ message: 'Cet utilisateur est déjà admin de ce pays.' });
  }
  const wasRole = target.role;
  target.role = 'admin';
  target.adminCountryIds = [...scopedIds, country._id];
  target.sessionsInvalidatedAt = new Date();
  await target.save();
  await Country.updateOne(
    { _id: country._id },
    { $addToSet: { countryAdminUserIds: target._id }, $set: { updatedBy: actorId(req) } }
  );
  await auditCountryChange(req, 'COUNTRY_ADMIN_ADDED', country, { userId, wasRole }, { userId, role: 'admin' });
  res.status(201).json({
    message: `${target.name || 'Utilisateur'} est maintenant admin de ${country.name}.`,
    admin: serializeCountryAdmin(target)
  });
});

export const removeCountryAdminUser = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const userId = clean(req.params.userId);
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  if (userId === String(actorId(req) || '')) {
    return res.status(400).json({ message: 'Vous ne pouvez pas retirer votre propre accès à ce pays.' });
  }
  const target = await User.findById(userId);
  if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  if (String(target.role || '').toLowerCase() === 'founder') {
    return res.status(400).json({ message: 'Impossible de modifier un fondateur.' });
  }
  const countryIdStr = String(country._id);
  const attachedViaUser = (target.adminCountryIds || []).map(String).includes(countryIdStr);
  const attachedViaCountry = (country.countryAdminUserIds || []).map(String).includes(userId);
  if (!attachedViaUser && !attachedViaCountry) {
    return res.status(400).json({ message: 'Cet utilisateur n’est pas admin de ce pays.' });
  }
  const remaining = (target.adminCountryIds || [])
    .map(String)
    .filter((entry) => entry !== countryIdStr);
  target.adminCountryIds = remaining.map((entry) => new mongoose.Types.ObjectId(entry));
  const demoted = String(target.role || '').toLowerCase() === 'admin' && remaining.length === 0;
  if (demoted) target.role = 'user';
  target.sessionsInvalidatedAt = new Date();
  await target.save();
  await Country.updateOne(
    { _id: country._id },
    { $pull: { countryAdminUserIds: target._id }, $set: { updatedBy: actorId(req) } }
  );
  await auditCountryChange(req, 'COUNTRY_ADMIN_REMOVED', country, { userId }, { demoted });
  res.json({
    message: demoted
      ? 'Admin retiré. Le compte est repassé en utilisateur standard.'
      : 'Admin retiré de ce pays.'
  });
});

export const getCountryAnalyticsAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const countryId = country._id;
  const [users, shops, products, orders, payments, deliveries, revenue] = await Promise.all([
    User.countDocuments({ countryId }),
    User.countDocuments({ countryId, accountType: 'shop' }),
    Product.countDocuments({ countryId }),
    Order.countDocuments({ countryId }),
    Payment.countDocuments({ countryId }),
    DeliveryRequest.countDocuments({ countryId }),
    Order.aggregate([
      { $match: { countryId, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);
  res.json({ country: serializePublicCountry(country), users, shops, products, orders, payments, deliveries, gmv: Number(revenue[0]?.total || 0), currency: country.currency.code });
});

// Per-country Commerce console: orders, products, payments, boosts, quotes.
export const getCountryCommerceAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const countryId = country._id;

  const [
    ordersTotal,
    ordersByStatus,
    recentOrders,
    productsTotal,
    recentProducts,
    paymentsTotal,
    paymentsVolume,
    recentPayments,
    boostRequests,
    quotations,
    buyForMe
  ] = await Promise.all([
    Order.countDocuments({ countryId }),
    Order.aggregate([{ $match: { countryId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.find({ countryId }).sort({ createdAt: -1 }).limit(10)
      .select('status paymentStatus totalAmount createdAt').lean(),
    Product.countDocuments({ countryId }),
    Product.find({ countryId }).sort({ createdAt: -1 }).limit(10)
      .select('title price currency status createdAt').lean(),
    Payment.countDocuments({ countryId }),
    Payment.aggregate([{ $match: { countryId } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
    Payment.find({ countryId }).sort({ createdAt: -1 }).limit(10)
      .select('amountPaid amount status paymentMethod createdAt').lean(),
    BoostRequest.countDocuments({ countryId }),
    QuotationRequest.countDocuments({ countryId }),
    BuyForMeOrder.countDocuments({ countryId })
  ]);

  res.json({
    country: serializePublicCountry(country),
    orders: {
      total: ordersTotal,
      byStatus: Object.fromEntries(ordersByStatus.map((entry) => [entry._id || 'unknown', entry.count])),
      recent: recentOrders
    },
    products: { total: productsTotal, recent: recentProducts },
    payments: {
      total: paymentsTotal,
      volume: Number(paymentsVolume[0]?.total || 0),
      recent: recentPayments
    },
    boosts: { total: boostRequests },
    quotations: quotations,
    buyForMe: buyForMe,
    currency: country.currency.code
  });
});

// Per-country Operations console: users, shops, couriers, delivery flows.
export const getCountryOperationsAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  const countryId = country._id;

  const [
    usersTotal,
    shopsTotal,
    recentUsers,
    deliveryGuys,
    pendingDeliveryGuyApplications,
    deliveryRequests,
    deliveryRequestsByStatus,
    parcelRequests,
    globalNotifications
  ] = await Promise.all([
    User.countDocuments({ countryId }),
    User.countDocuments({ countryId, accountType: 'shop' }),
    User.find({ countryId }).sort({ createdAt: -1 }).limit(10)
      .select('name phone accountType role isActive createdAt').lean(),
    DeliveryGuy.countDocuments({ countryId }),
    DeliveryGuyApplication.countDocuments({ countryId, status: 'pending' }),
    DeliveryRequest.countDocuments({ countryId }),
    DeliveryRequest.aggregate([{ $match: { countryId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ParcelRequest.countDocuments({ countryId }),
    GlobalNotificationRequest.countDocuments({ countryId })
  ]);

  res.json({
    country: serializePublicCountry(country),
    users: { total: usersTotal, shops: shopsTotal, recent: recentUsers },
    delivery: {
      couriers: deliveryGuys,
      pendingApplications: pendingDeliveryGuyApplications,
      requests: deliveryRequests,
      byStatus: Object.fromEntries(deliveryRequestsByStatus.map((entry) => [entry._id || 'unknown', entry.count]))
    },
    parcels: parcelRequests,
    globalNotifications
  });
});

export const deleteCountryAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
  assertGlobalCountryAdmin(req, 'supprimer un pays');
  if (country.isDefault) return res.status(409).json({ message: 'Le pays par défaut ne peut pas être supprimé.' });
  const [users, products, orders, payments, deliveries] = await Promise.all([
    User.countDocuments({ countryId: country._id }),
    Product.countDocuments({ countryId: country._id }),
    Order.countDocuments({ countryId: country._id }),
    Payment.countDocuments({ countryId: country._id }),
    DeliveryRequest.countDocuments({ countryId: country._id })
  ]);
  if (users + products + orders + payments + deliveries > 0) {
    return res.status(409).json({
      message: 'Ce pays est déjà utilisé. Désactivez-le pour préserver les historiques.',
      code: 'COUNTRY_IN_USE',
      usage: { users, products, orders, payments, deliveries }
    });
  }
  await Promise.all([
    CountryConfig.deleteOne({ countryId: country._id }),
    CountryPaymentMethod.deleteMany({ countryId: country._id }),
    country.deleteOne()
  ]);
  await auditCountryChange(req, 'COUNTRY_DELETED', country, sanitizeAdminCountry(country), null);
  res.json({ message: 'Pays supprimé.' });
});

// Aggregated view across every market — the "global admin UI" for the whole app.
// Reserved to the founder and platform-wide admins (route-level requireGlobalAdmin).
export const getGlobalCountriesOverviewAdmin = asyncHandler(async (req, res) => {
  assertGlobalCountryAdmin(req, 'voir la vue globale');
  const countries = await Country.find().sort({ sortOrder: 1, name: 1 }).lean();
  const countryIds = countries.map((country) => country._id);

  const [users, shops, products, orders, payments, deliveries, revenue] = await Promise.all([
    User.aggregate([{ $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    User.aggregate([{ $match: { accountType: 'shop' } }, { $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    Product.aggregate([{ $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    DeliveryRequest.aggregate([{ $group: { _id: '$countryId', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $nin: ['cancelled'] } } },
      { $group: { _id: '$countryId', total: { $sum: '$totalAmount' } } }
    ])
  ]);

  const toMap = (rows) =>
    new Map(rows.map((row) => [String(row._id || ''), Number(row.count ?? row.total ?? 0)]));

  const [usersMap, shopsMap, productsMap, ordersMap, paymentsMap, deliveriesMap, revenueMap] = [
    toMap(users), toMap(shops), toMap(products), toMap(orders), toMap(payments), toMap(deliveries), toMap(revenue)
  ];

  const items = await Promise.all(countries.map(async (country) => {
    const id = String(country._id);
    return {
      ...sanitizeAdminCountry(country),
      readiness: await getCountryReadiness(country),
      stats: {
        users: usersMap.get(id) || 0,
        shops: shopsMap.get(id) || 0,
        products: productsMap.get(id) || 0,
        orders: ordersMap.get(id) || 0,
        payments: paymentsMap.get(id) || 0,
        deliveries: deliveriesMap.get(id) || 0,
        gmv: revenueMap.get(id) || 0
      }
    };
  }));

  const totals = items.reduce((acc, item) => {
    acc.countries += 1;
    if (item.status === 'ACTIVE') acc.activeCountries += 1;
    acc.users += item.stats.users;
    acc.shops += item.stats.shops;
    acc.products += item.stats.products;
    acc.orders += item.stats.orders;
    acc.gmv += item.stats.gmv;
    return acc;
  }, { countries: 0, activeCountries: 0, users: 0, shops: 0, products: 0, orders: 0, gmv: 0 });

  res.json({
    items,
    totals,
    accessibleCountryIds: countryIds.map(String),
    // Scoped admins never reach this endpoint, but keep the scope hint for
    // clients that render the same payload.
    scope: getScopedAdminCountryIds(req.user) || 'global'
  });
});
