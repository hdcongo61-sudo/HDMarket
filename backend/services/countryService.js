import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import CountryPaymentMethod from '../models/countryPaymentMethodModel.js';

export const LEGACY_COUNTRY = Object.freeze({
  name: 'Congo',
  officialName: 'République du Congo',
  code: 'CG',
  iso3: 'COG',
  phoneCode: '+242',
  flagEmoji: '🇨🇬',
  defaultLanguage: 'fr',
  supportedLanguages: ['fr'],
  timezone: 'Africa/Brazzaville',
  currency: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA', decimals: 0 },
  status: 'ACTIVE',
  isDefault: true,
  sortOrder: 1,
  settings: {
    crossBorder: { enabled: false },
    locationLabels: {
      region: 'Département',
      city: 'Ville',
      district: 'Commune / Arrondissement',
      neighborhood: 'Quartier'
    },
    delivery: { enabled: true, configured: true }
  }
});

const normalizeId = (value) => String(value?._id || value || '').trim();
const isPrivileged = (user) => ['founder', 'admin'].includes(String(user?.role || '').toLowerCase());

export const ensureDefaultCountry = async () => {
  let country = await Country.findOne({ isDefault: true });
  if (country) return country;
  country = await Country.findOne({ $or: [{ code: 'CG' }, { iso3: 'COG' }] });
  if (country) {
    country.isDefault = true;
    if (country.status === 'DRAFT') country.status = 'ACTIVE';
    await country.save();
    return country;
  }
  try {
    return await Country.create(LEGACY_COUNTRY);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Country.findOne({ $or: [{ isDefault: true }, { code: 'CG' }] });
  }
};

export const findCountry = async (identifier, { lean = false } = {}) => {
  const raw = normalizeId(identifier);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const filter = mongoose.isValidObjectId(raw)
    ? { $or: [{ _id: raw }, { code: upper }, { iso3: upper }] }
    : { $or: [{ code: upper }, { iso3: upper }] };
  const query = Country.findOne(filter);
  return lean ? query.lean() : query;
};

export const canAccessCountry = (country, user, { historical = false } = {}) => {
  if (!country) return false;
  const status = String(country.status || '').toUpperCase();
  if (status === 'ACTIVE') return true;
  if (historical && status === 'DISABLED') return true;
  if (isPrivileged(user)) return true;
  const userId = normalizeId(user?.id || user?._id);
  if (!userId) return false;
  const testerIds = (country.testerUserIds || []).map(normalizeId);
  const adminIds = (country.countryAdminUserIds || []).map(normalizeId);
  return status === 'TEST' && (Boolean(user?.betaTester) || testerIds.includes(userId) || adminIds.includes(userId));
};

export const canAdminCountry = (country, user) => {
  if (!country || !user) return false;
  // Only the founder stays global. Admins are embedded in the countries they
  // are registered at (adminCountryIds / countryAdminUserIds).
  if (String(user.role || '').toLowerCase() === 'founder') return true;
  const userId = normalizeId(user.id || user._id);
  const scopedIds = (user.adminCountryIds || []).map(normalizeId);
  const countryAdminIds = (country.countryAdminUserIds || []).map(normalizeId);
  return scopedIds.includes(normalizeId(country)) || countryAdminIds.includes(userId);
};

// Founder-only global access. Country admins are never global, even with an
// empty adminCountryIds list (migration guarantees every admin has a country).
export const isGlobalCountryAdmin = (user) => String(user?.role || '').toLowerCase() === 'founder';

// Returns null for global admins, otherwise the list of country ids the
// scoped admin is allowed to manage.
export const getScopedAdminCountryIds = (user) => {
  if (!user) return [];
  if (isGlobalCountryAdmin(user)) return null;
  return (user.adminCountryIds || []).map(normalizeId).filter(Boolean);
};

// Resolves the country scope for an admin request (shared by every admin
// controller that manages country-owned data).
// - Founder: explicit countryId (query/body/header), otherwise either the
//   default country (create time) or '' = "all countries" (list time).
// - Scoped admins: locked to their assigned countries; the first one is used
//   when none is requested. An admin with no assigned country is denied.
export const resolveAdminCountryScope = async (req, { defaultToDefaultCountry = false } = {}) => {
  const raw = String(
    req.query?.countryId || req.body?.countryId || req.headers?.['x-admin-country-id'] || ''
  ).trim();
  const scopedIds = getScopedAdminCountryIds(req.user); // null for founder
  let countryId = raw;
  if (!countryId && scopedIds && scopedIds.length) countryId = scopedIds[0];
  if (!countryId) {
    if (scopedIds && !scopedIds.length) {
      const error = new Error('Aucun pays assigné à cet admin.');
      error.status = 403;
      error.code = 'NO_COUNTRY_ASSIGNED';
      throw error;
    }
    if (defaultToDefaultCountry) {
      const country = await ensureDefaultCountry();
      return { countryId: String(country._id), country };
    }
    return { countryId: '', country: null };
  }

  const country = await findCountry(countryId);
  if (!country) {
    const error = new Error('Pays introuvable.');
    error.status = 400;
    error.code = 'COUNTRY_NOT_FOUND';
    throw error;
  }
  if (!canAdminCountry(country, req.user)) {
    const error = new Error('Accès pays refusé.');
    error.status = 403;
    error.code = 'COUNTRY_ACCESS_DENIED';
    throw error;
  }
  return { countryId: String(country._id), country };
};

// Builds a country filter for admin listings. Pure (unit-testable).
// - Founder without countryId: null → no filter (global view).
// - Founder with countryId / scoped admin: { [field]: id | { $in: [...] } }.
// - Other roles (managers) keep their legacy global view (null).
export const getAdminCountryFilter = (user, { countryId = null, field = 'countryId' } = {}) => {
  const role = String(user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'founder') return null;
  if (isGlobalCountryAdmin(user)) {
    const raw = String(countryId || '').trim();
    if (!raw) return null;
    return mongoose.isValidObjectId(raw) ? { [field]: raw } : null;
  }
  const scopedIds = getScopedAdminCountryIds(user) || [];
  if (!scopedIds.length) {
    const error = new Error('Aucun pays assigné à cet admin.');
    error.status = 403;
    error.code = 'NO_COUNTRY_ASSIGNED';
    throw error;
  }
  const requested = String(countryId || '').trim();
  if (requested && scopedIds.includes(requested)) return { [field]: requested };
  return scopedIds.length === 1 ? { [field]: scopedIds[0] } : { [field]: { $in: scopedIds } };
};

// Asserts that a record belongs to the requesting admin's country before
// read/write. Founder passes; scoped admins are denied for foreign records.
export const assertCountryRecordAccess = (record, req, { field = 'countryId' } = {}) => {
  const user = req?.user;
  if (!user || isGlobalCountryAdmin(user)) return;
  if (String(user?.role || '').toLowerCase() !== 'admin') return;
  const scopedIds = getScopedAdminCountryIds(user) || [];
  const recordCountry = String(record?.[field] || '').trim();
  if (!scopedIds.length || !recordCountry || !scopedIds.includes(recordCountry)) {
    const error = new Error('Ce contenu appartient à un autre pays.');
    error.status = 403;
    error.code = 'COUNTRY_ACCESS_DENIED';
    throw error;
  }
};

export const serializePublicCountry = (country, { includeSettings = true } = {}) => {
  const raw = country?.toObject ? country.toObject() : country || {};
  const result = {
    id: normalizeId(raw),
    _id: normalizeId(raw),
    name: raw.name,
    officialName: raw.officialName,
    code: raw.code,
    iso3: raw.iso3,
    phoneCode: raw.phoneCode,
    flagEmoji: raw.flagEmoji,
    defaultLanguage: raw.defaultLanguage,
    supportedLanguages: raw.supportedLanguages || [],
    timezone: raw.timezone,
    currency: raw.currency,
    supportedCurrencies: raw.supportedCurrencies || [],
    status: raw.status,
    isDefault: Boolean(raw.isDefault),
    sortOrder: Number(raw.sortOrder || 0)
  };
  if (includeSettings) {
    result.settings = {
      crossBorder: { enabled: Boolean(raw.settings?.crossBorder?.enabled) },
      locationLabels: raw.settings?.locationLabels || {},
      delivery: {
        enabled: raw.settings?.delivery?.enabled !== false,
        configured: Boolean(raw.settings?.delivery?.configured)
      }
    };
    result.featureOverrides = raw.featureOverrides || {};
  }
  return result;
};

export const listAccessibleCountries = async (user = null) => {
  const statusFilter = isPrivileged(user) ? {} : { status: { $in: ['ACTIVE', 'TEST'] } };
  const countries = await Country.find(statusFilter).sort({ sortOrder: 1, name: 1 }).lean();
  return countries.filter((country) => canAccessCountry(country, user)).map(serializePublicCountry);
};

export const resolveCountryContext = async ({
  resourceCountryId = null,
  requestedCountry = null,
  user = null,
  historical = false
} = {}) => {
  const candidates = [
    resourceCountryId,
    requestedCountry,
    user?.selectedCountryId,
    user?.countryId
  ].filter(Boolean);
  let country = null;
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    country = await findCountry(candidate);
    if (country) break;
  }
  // Guests resolve to the default country. Registered users NEVER fall back
  // silently: a user whose country cannot be resolved would otherwise see
  // another market's data, which violates per-country isolation.
  if (!country) {
    const userHasCountry = Boolean(user && (user.selectedCountryId || user.countryId));
    if (userHasCountry) {
      const error = new Error("Votre compte n'est rattaché à aucun pays actif.");
      error.status = 403;
      error.code = 'COUNTRY_UNRESOLVED';
      throw error;
    }
    country = await ensureDefaultCountry();
  }
  if (!canAccessCountry(country, user, { historical })) {
    const error = new Error(
      country?.status === 'DISABLED'
        ? "HDMarket n'accepte plus de nouvelles opérations dans ce pays."
        : "Ce pays n'est pas disponible pour votre compte."
    );
    error.status = 403;
    error.code = country?.status === 'DISABLED' ? 'COUNTRY_DISABLED' : 'COUNTRY_ACCESS_DENIED';
    throw error;
  }
  // Strict per-country isolation: a registered user operates only within
  // their own market. Cross-border content is allowed only when their own
  // country's settings explicitly enable it (founder stays global).
  if (user && (user.selectedCountryId || user.countryId) && !isGlobalCountryAdmin(user)) {
    const ownCountryId = normalizeId(user.selectedCountryId || user.countryId);
    const resolvedId = normalizeId(country);
    if (ownCountryId && ownCountryId !== resolvedId) {
      const ownCountry = await findCountry(ownCountryId);
      const crossBorderEnabled = Boolean(ownCountry?.settings?.crossBorder?.enabled);
      if (!crossBorderEnabled) {
        const error = new Error('Ce contenu appartient à un autre pays.');
        error.status = 403;
        error.code = 'COUNTRY_ACCESS_DENIED';
        throw error;
      }
    }
  }
  return {
    country,
    countryId: country._id,
    code: country.code,
    iso3: country.iso3,
    currency: country.currency,
    accountCountryId: user?.countryId || null,
    selectedCountryId: country._id,
    resourceCountryId: resourceCountryId || null
  };
};

export const assertCurrencySupported = (country, currency) => {
  const code = String(currency || '').trim().toUpperCase();
  const allowed = new Set(
    [country?.currency, ...(country?.supportedCurrencies || [])]
      .map((item) => String(item?.code || '').toUpperCase())
      .filter(Boolean)
  );
  if (!code || !allowed.has(code)) {
    const error = new Error(`La devise ${code || 'demandée'} n'est pas disponible dans ce pays.`);
    error.status = 400;
    error.code = 'CURRENCY_NOT_SUPPORTED';
    throw error;
  }
  return code;
};

export const getCountryReadiness = async (country) => {
  const countryId = country?._id || country;
  const { default: City } = await import('../models/cityModel.js');
  const [cityCount, paymentCount] = await Promise.all([
    City.countDocuments({ countryId, isActive: true }),
    CountryPaymentMethod.countDocuments({ countryId, enabled: true })
  ]);
  const checks = {
    identity: Boolean(country?.name && country?.code && country?.iso3 && country?.phoneCode),
    currency: Boolean(country?.currency?.code && country?.currency?.symbol),
    languages: Boolean(country?.defaultLanguage && country?.supportedLanguages?.length),
    locations: cityCount > 0,
    payments: paymentCount > 0,
    delivery: country?.settings?.delivery?.enabled === false || Boolean(country?.settings?.delivery?.configured),
    features: country?.featureOverrides && typeof country.featureOverrides === 'object',
    legal: Boolean(country?.settings?.legal && Object.keys(country.settings.legal).length)
  };
  const values = Object.values(checks);
  return {
    score: Math.round((values.filter(Boolean).length / values.length) * 100),
    checks,
    cityCount,
    paymentMethodCount: paymentCount,
    canActivate: checks.identity && checks.currency && checks.languages && checks.locations && checks.payments && checks.delivery
  };
};

export const buildCountryFinancialSnapshot = (country, values = {}) => ({
  amount: Number(values.amount ?? values.total ?? 0),
  currency: String(values.currency || country?.currency?.code || 'XAF').toUpperCase(),
  countryId: country?._id || country || null,
  productPrice: Number(values.productPrice || 0),
  discount: Number(values.discount || 0),
  deliveryFee: Number(values.deliveryFee || 0),
  platformFee: Number(values.platformFee || 0),
  taxes: Number(values.taxes || 0),
  total: Number(values.total ?? values.amount ?? 0),
  configVersion: Number(values.configVersion || 1),
  capturedAt: new Date()
});

export const buildCountryDataFilter = (countryContext, field = 'countryId') => {
  const countryId = countryContext?.countryId || countryContext?.country?._id || null;
  if (!countryId) return { [field]: null };
  if (String(countryContext?.code || countryContext?.country?.code || '').toUpperCase() === 'CG') {
    return {
      $and: [{
        $or: [
          { [field]: countryId },
          { [field]: null },
          { [field]: { $exists: false } }
        ]
      }]
    };
  }
  return { [field]: countryId };
};

export default {
  ensureDefaultCountry,
  findCountry,
  canAccessCountry,
  canAdminCountry,
  isGlobalCountryAdmin,
  getScopedAdminCountryIds,
  listAccessibleCountries,
  resolveCountryContext,
  assertCurrencySupported,
  serializePublicCountry,
  getCountryReadiness,
  buildCountryFinancialSnapshot
  ,buildCountryDataFilter
  ,resolveAdminCountryScope
  ,getAdminCountryFilter
  ,assertCountryRecordAccess
};
