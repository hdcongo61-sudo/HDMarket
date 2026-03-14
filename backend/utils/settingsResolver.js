import Currency from '../models/currencyModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import { getManyRuntimeConfigs, getRuntimeConfig } from '../services/configService.js';

const CACHE_TTL_MS = 60 * 1000;
const resolverCache = new Map();

export const SETTING_KEYS = Object.freeze({
  COMMISSION_RATE: 'commissionRate',
  BOOST_ENABLED: 'boostEnabled',
  INSTALLMENT_MIN_PERCENT: 'installmentMinPercent',
  INSTALLMENT_MAX_DURATION: 'installmentMaxDuration',
  SHOP_CONVERSION_AMOUNT: 'shopConversionAmount',
  ANALYTICS_VIEW_WEIGHT: 'analyticsViewWeight',
  ANALYTICS_CONVERSION_WEIGHT: 'analyticsConversionWeight',
  ANALYTICS_REVENUE_WEIGHT: 'analyticsRevenueWeight',
  ANALYTICS_REFUND_PENALTY: 'analyticsRefundPenalty',
  DISPUTE_WINDOW_HOURS: 'disputeWindowHours',
  DELIVERY_OTP_EXPIRATION_MINUTES: 'deliveryOTPExpirationMinutes',
  MAX_DISPUTES_PER_MONTH: 'maxDisputesPerMonth',
  MAX_UPLOAD_IMAGES: 'maxUploadImages',
  ENABLE_FULL_PAYMENT_FREE_DELIVERY: 'enable_full_payment_free_delivery',
  SHOW_FULL_PAYMENT_HOME_BANNER: 'show_full_payment_home_banner',
  FULL_PAYMENT_BANNER_TEXT: 'full_payment_banner_text',
  FULL_PAYMENT_LABEL_TEXT: 'full_payment_label_text',
  FULL_PAYMENT_PROMOTION_ENABLED: 'full_payment_promotion_enabled',
  LANGUAGES: 'languages',
  DEFAULT_LANGUAGE: 'defaultLanguage'
});

export const DEFAULT_APP_SETTINGS = Object.freeze({
  [SETTING_KEYS.COMMISSION_RATE]: 3,
  [SETTING_KEYS.BOOST_ENABLED]: true,
  [SETTING_KEYS.INSTALLMENT_MIN_PERCENT]: 25,
  [SETTING_KEYS.INSTALLMENT_MAX_DURATION]: 90,
  [SETTING_KEYS.SHOP_CONVERSION_AMOUNT]: 50000,
  [SETTING_KEYS.ANALYTICS_VIEW_WEIGHT]: 0.1,
  [SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT]: 2,
  [SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT]: 0.001,
  [SETTING_KEYS.ANALYTICS_REFUND_PENALTY]: 5,
  [SETTING_KEYS.DISPUTE_WINDOW_HOURS]: 72,
  [SETTING_KEYS.DELIVERY_OTP_EXPIRATION_MINUTES]: 15,
  [SETTING_KEYS.MAX_DISPUTES_PER_MONTH]: 5,
  [SETTING_KEYS.MAX_UPLOAD_IMAGES]: 5,
  [SETTING_KEYS.ENABLE_FULL_PAYMENT_FREE_DELIVERY]: true,
  [SETTING_KEYS.SHOW_FULL_PAYMENT_HOME_BANNER]: true,
  [SETTING_KEYS.FULL_PAYMENT_BANNER_TEXT]: 'Payez le montant total au checkout et profitez de la livraison offerte.',
  [SETTING_KEYS.FULL_PAYMENT_LABEL_TEXT]: 'BEST VALUE',
  [SETTING_KEYS.FULL_PAYMENT_PROMOTION_ENABLED]: true,
  [SETTING_KEYS.DEFAULT_LANGUAGE]: 'fr',
  [SETTING_KEYS.LANGUAGES]: [
    { code: 'fr', name: 'Français', isActive: true },
    { code: 'en', name: 'English', isActive: true }
  ]
});

const normalizeSettingValue = (key, value) => {
  if (value === null || value === undefined) return DEFAULT_APP_SETTINGS[key];
  return value;
};

const getCachedValue = (key) => {
  const item = resolverCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    resolverCache.delete(key);
    return null;
  }
  return item.value;
};

const setCachedValue = (key, value, ttlMs = CACHE_TTL_MS) => {
  resolverCache.set(key, {
    value,
    expiry: Date.now() + ttlMs
  });
  return value;
};

export const invalidateSettingsResolverCache = (prefix = '') => {
  const keys = Array.from(resolverCache.keys());
  keys.forEach((key) => {
    if (!prefix || key.startsWith(prefix)) {
      resolverCache.delete(key);
    }
  });
};

export const getSettingValue = async (key, fallback = undefined) => {
  const cacheKey = `setting:${key}`;
  const cached = getCachedValue(cacheKey);
  if (cached !== null) return cached;

  const fallbackValue = fallback !== undefined ? fallback : DEFAULT_APP_SETTINGS[key];
  const resolved = await getRuntimeConfig(key, { fallback: fallbackValue });
  return setCachedValue(cacheKey, normalizeSettingValue(key, resolved));
};

export const getSettingsValues = async (keys = []) => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (!uniqueKeys.length) return {};

  const result = {};
  const toFetch = [];

  uniqueKeys.forEach((key) => {
    const cached = getCachedValue(`setting:${key}`);
    if (cached !== null) {
      result[key] = cached;
    } else {
      toFetch.push(key);
    }
  });

  if (toFetch.length) {
    const fetched = await getManyRuntimeConfigs(toFetch);
    toFetch.forEach((key) => {
      const raw = Object.prototype.hasOwnProperty.call(fetched, key)
        ? fetched[key]
        : DEFAULT_APP_SETTINGS[key];
      const resolved = normalizeSettingValue(key, raw);
      result[key] = setCachedValue(`setting:${key}`, resolved);
    });
  }

  return result;
};

export const getActiveCurrencies = async ({ includeInactive = false } = {}) => {
  const cacheKey = `currencies:${includeInactive ? 'all' : 'active'}`;
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  const filter = includeInactive ? {} : { isActive: true };
  const list = await Currency.find(filter).sort({ isDefault: -1, code: 1 }).lean();
  return setCachedValue(cacheKey, list);
};

export const getDefaultCurrency = async () => {
  const cacheKey = 'currency:default';
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  let currency = await Currency.findOne({ isDefault: true, isActive: true }).lean();
  if (!currency) {
    currency = await Currency.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
  }
  return setCachedValue(cacheKey, currency || null);
};

export const getActiveCities = async ({ includeInactive = false } = {}) => {
  const cacheKey = `cities:${includeInactive ? 'all' : 'active'}`;
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  const filter = includeInactive ? {} : { isActive: true };
  const list = await City.find(filter).sort({ isDefault: -1, order: 1, name: 1 }).lean();
  return setCachedValue(cacheKey, list);
};

export const getDefaultCity = async () => {
  const cacheKey = 'city:default';
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  let city = await City.findOne({ isDefault: true, isActive: true }).lean();
  if (!city) {
    city = await City.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
  }
  return setCachedValue(cacheKey, city || null);
};

export const getActiveCommunes = async ({ includeInactive = false, cityId = null } = {}) => {
  const cityScope = cityId ? String(cityId) : 'all';
  const cacheKey = `communes:${includeInactive ? 'all' : 'active'}:${cityScope}`;
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  const filter = includeInactive ? {} : { isActive: true };
  if (cityId) {
    filter.cityId = cityId;
  }
  const list = await Commune.find(filter).sort({ order: 1, name: 1 }).lean();
  return setCachedValue(cacheKey, list);
};

export const getLanguagesConfig = async () => {
  const settings = await getSettingsValues([SETTING_KEYS.LANGUAGES, SETTING_KEYS.DEFAULT_LANGUAGE]);
  const languages = Array.isArray(settings[SETTING_KEYS.LANGUAGES])
    ? settings[SETTING_KEYS.LANGUAGES]
    : DEFAULT_APP_SETTINGS[SETTING_KEYS.LANGUAGES];
  const normalizedLanguages = languages
    .map((item) => ({
      code: String(item?.code || '').trim().toLowerCase(),
      name: String(item?.name || item?.code || '').trim(),
      isActive: item?.isActive !== false
    }))
    .filter((item) => item.code);
  const defaultLanguage = String(settings[SETTING_KEYS.DEFAULT_LANGUAGE] || 'fr')
    .trim()
    .toLowerCase();
  return {
    languages: normalizedLanguages,
    defaultLanguage
  };
};

export const resolvePublicSettings = async () => {
  const cacheKey = 'settings:public';
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  const settings = await getSettingsValues([
    SETTING_KEYS.BOOST_ENABLED,
    SETTING_KEYS.COMMISSION_RATE,
    SETTING_KEYS.INSTALLMENT_MIN_PERCENT,
    SETTING_KEYS.INSTALLMENT_MAX_DURATION,
    SETTING_KEYS.SHOP_CONVERSION_AMOUNT,
    SETTING_KEYS.ANALYTICS_VIEW_WEIGHT,
    SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT,
    SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT,
    SETTING_KEYS.ANALYTICS_REFUND_PENALTY,
    SETTING_KEYS.DISPUTE_WINDOW_HOURS,
    SETTING_KEYS.MAX_UPLOAD_IMAGES,
    SETTING_KEYS.ENABLE_FULL_PAYMENT_FREE_DELIVERY,
    SETTING_KEYS.SHOW_FULL_PAYMENT_HOME_BANNER,
    SETTING_KEYS.FULL_PAYMENT_BANNER_TEXT,
    SETTING_KEYS.FULL_PAYMENT_LABEL_TEXT,
    SETTING_KEYS.FULL_PAYMENT_PROMOTION_ENABLED,
    SETTING_KEYS.LANGUAGES,
    SETTING_KEYS.DEFAULT_LANGUAGE
  ]);
  const [defaultCurrency, defaultCity, currencies, cities, communes, languagesConfig] = await Promise.all([
    getDefaultCurrency(),
    getDefaultCity(),
    getActiveCurrencies(),
    getActiveCities(),
    getActiveCommunes(),
    getLanguagesConfig()
  ]);

  const payload = {
    app: {
      boostEnabled: Boolean(settings[SETTING_KEYS.BOOST_ENABLED]),
      commissionRate: Number(settings[SETTING_KEYS.COMMISSION_RATE] || 0),
      installmentMinPercent: Number(settings[SETTING_KEYS.INSTALLMENT_MIN_PERCENT] || 0),
      installmentMaxDuration: Number(settings[SETTING_KEYS.INSTALLMENT_MAX_DURATION] || 0),
      shopConversionAmount: Number(settings[SETTING_KEYS.SHOP_CONVERSION_AMOUNT] || 0),
      analyticsViewWeight: Number(settings[SETTING_KEYS.ANALYTICS_VIEW_WEIGHT] || 0),
      analyticsConversionWeight: Number(settings[SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT] || 0),
      analyticsRevenueWeight: Number(settings[SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT] || 0),
      analyticsRefundPenalty: Number(settings[SETTING_KEYS.ANALYTICS_REFUND_PENALTY] || 0),
      disputeWindowHours: Number(settings[SETTING_KEYS.DISPUTE_WINDOW_HOURS] || 0),
      maxUploadImages: Number(settings[SETTING_KEYS.MAX_UPLOAD_IMAGES] || 0),
      enableFullPaymentFreeDelivery: Boolean(settings[SETTING_KEYS.ENABLE_FULL_PAYMENT_FREE_DELIVERY]),
      showFullPaymentHomeBanner: Boolean(settings[SETTING_KEYS.SHOW_FULL_PAYMENT_HOME_BANNER]),
      fullPaymentBannerText: String(settings[SETTING_KEYS.FULL_PAYMENT_BANNER_TEXT] || ''),
      fullPaymentLabelText: String(settings[SETTING_KEYS.FULL_PAYMENT_LABEL_TEXT] || ''),
      fullPaymentPromotionEnabled: Boolean(settings[SETTING_KEYS.FULL_PAYMENT_PROMOTION_ENABLED])
    },
    defaultLanguage: languagesConfig.defaultLanguage,
    languages: languagesConfig.languages.filter((item) => item.isActive),
    defaultCurrency: defaultCurrency || null,
    currencies,
    defaultCity: defaultCity || null,
    cities,
    communes
  };

  return setCachedValue(cacheKey, payload);
};
