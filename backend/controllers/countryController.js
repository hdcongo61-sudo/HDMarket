import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import CountryConfig from '../models/countryConfigModel.js';
import CountryPaymentMethod from '../models/countryPaymentMethodModel.js';
import City from '../models/cityModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import {
  canAccessCountry,
  canAdminCountry,
  ensureDefaultCountry,
  findCountry,
  getCountryReadiness,
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
  if (String(req.user?.role || '').toLowerCase() !== 'founder' && String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ message: 'Seul un administrateur global peut créer un pays.' });
  }
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
  const [config, cities, paymentMethods, readiness] = await Promise.all([
    CountryConfig.findOne({ countryId: country._id }).lean(),
    City.find({ countryId: country._id }).sort({ order: 1, name: 1 }).lean(),
    CountryPaymentMethod.find({ countryId: country._id }).sort({ sortOrder: 1, displayName: 1 }).lean(),
    getCountryReadiness(country)
  ]);
  res.json({ item: sanitizeAdminCountry(country), config: config || {}, cities, paymentMethods, readiness });
});

export const updateCountryAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.', code: 'COUNTRY_NOT_FOUND' });
  assertCountryAdmin(country, req);
  const before = sanitizeAdminCountry(country);
  const payload = req.body || {};
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
        return res.status(409).json({
          message: "Le pays n'est pas prêt à être activé.",
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

export const deleteCountryAdmin = asyncHandler(async (req, res) => {
  const country = await findCountry(req.params.id);
  if (!country) return res.status(404).json({ message: 'Pays introuvable.' });
  assertCountryAdmin(country, req);
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
