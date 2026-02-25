import asyncHandler from 'express-async-handler';
import Currency from '../models/currencyModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import AppSetting from '../models/appSettingModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import { invalidateSettingsCache } from '../utils/cache.js';
import {
  ensureRuntimeConfigBootstrap,
  getPublicRuntimeConfig,
  setRuntimeConfig
} from '../services/configService.js';
import {
  DEFAULT_APP_SETTINGS,
  SETTING_KEYS,
  getActiveCommunes,
  getActiveCities,
  getActiveCurrencies,
  getDefaultCity,
  getDefaultCurrency,
  getLanguagesConfig,
  getSettingValue,
  getSettingsValues,
  invalidateSettingsResolverCache,
  resolvePublicSettings
} from '../utils/settingsResolver.js';

const normalizeText = (value = '') => String(value || '').trim();

const toValueType = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'json';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
};

const invalidateAllSettingsCaches = () => {
  invalidateSettingsResolverCache();
  invalidateSettingsCache();
};

const ensureSingleDefaultCurrency = async (currencyCode, actorId) => {
  await Currency.updateMany(
    { code: { $ne: currencyCode } },
    { $set: { isDefault: false, updatedBy: actorId } }
  );
};

const ensureSingleDefaultCity = async (cityId, actorId) => {
  await City.updateMany(
    { _id: { $ne: cityId } },
    { $set: { isDefault: false, updatedBy: actorId } }
  );
};

const getSafeFeeSettings = async () =>
  getSettingsValues([
    SETTING_KEYS.COMMISSION_RATE,
    SETTING_KEYS.BOOST_ENABLED,
    SETTING_KEYS.INSTALLMENT_MIN_PERCENT,
    SETTING_KEYS.INSTALLMENT_MAX_DURATION,
    SETTING_KEYS.SHOP_CONVERSION_AMOUNT,
    SETTING_KEYS.ANALYTICS_VIEW_WEIGHT,
    SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT,
    SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT,
    SETTING_KEYS.ANALYTICS_REFUND_PENALTY,
    SETTING_KEYS.DISPUTE_WINDOW_HOURS,
    SETTING_KEYS.DELIVERY_OTP_EXPIRATION_MINUTES,
    SETTING_KEYS.MAX_DISPUTES_PER_MONTH,
    SETTING_KEYS.MAX_UPLOAD_IMAGES
  ]);

export const getPublicSettings = asyncHandler(async (req, res) => {
  try {
    const [payload, runtimePayload] = await Promise.all([
      resolvePublicSettings(),
      getPublicRuntimeConfig({
        role: req.user?.role,
        userId: req.user?.id,
        sessionId: req.headers?.['x-session-id'],
        deviceId: req.headers?.['x-device-id']
      })
    ]);
    res.json({
      ...payload,
      runtime: runtimePayload?.values || {},
      featureFlags: runtimePayload?.featureFlags || {},
      ui:
        runtimePayload?.byCategory?.ui ||
        {
          app_name: 'HDMarket',
          ui_primary_color: '#171717',
          ui_banner_message: '',
          ui_announcement_text: '',
          footer_text: 'HDMarket'
        }
    });
  } catch (error) {
    console.error('getPublicSettings fallback used:', error?.message || error);
    res.json({
      app: {
        boostEnabled: true,
        commissionRate: 3,
        installmentMinPercent: 25,
        installmentMaxDuration: 90,
        shopConversionAmount: 50000,
        analyticsViewWeight: 0.1,
        analyticsConversionWeight: 2,
        analyticsRevenueWeight: 0.001,
        analyticsRefundPenalty: 5,
        disputeWindowHours: 72,
        maxUploadImages: 5
      },
      defaultLanguage: 'fr',
      languages: [{ code: 'fr', name: 'Français', isActive: true }],
      defaultCurrency: {
        code: 'XAF',
        symbol: 'FCFA',
        name: 'Franc CFA',
        decimals: 0,
        isDefault: true,
        isActive: true,
        exchangeRateToDefault: 1,
        formatting: {
          symbolPosition: 'suffix',
          thousandSeparator: ' ',
          decimalSeparator: ','
        }
      },
      currencies: [
        {
          code: 'XAF',
          symbol: 'FCFA',
          name: 'Franc CFA',
          decimals: 0,
          isDefault: true,
          isActive: true,
          exchangeRateToDefault: 1,
          formatting: {
            symbolPosition: 'suffix',
            thousandSeparator: ' ',
            decimalSeparator: ','
          }
        }
      ],
      defaultCity: {
        name: 'Brazzaville',
        isActive: true,
        isDefault: true,
        deliveryAvailable: true,
        boostMultiplier: 1
      },
      cities: [
        {
          name: 'Brazzaville',
          isActive: true,
          isDefault: true,
          deliveryAvailable: true,
          boostMultiplier: 1
        }
      ],
      communes: [
        {
          name: 'Centre-ville',
          cityId: null,
          isActive: true,
          deliveryPolicy: 'DEFAULT_RULE',
          fixedFee: 0
        }
      ],
      runtime: {
        app_name: 'HDMarket',
        ui_primary_color: '#171717',
        map_provider: 'osm',
        maintenance_mode: false,
        maintenance_message: 'Maintenance en cours. Merci de réessayer plus tard.'
      },
      featureFlags: {},
      ui: {
        app_name: 'HDMarket',
        ui_primary_color: '#171717',
        ui_banner_message: '',
        ui_announcement_text: '',
        footer_text: 'HDMarket',
        map_provider: 'osm'
      }
    });
  }
});

export const getPublicCities = asyncHandler(async (req, res) => {
  try {
    const cities = await getActiveCities();
    res.json(cities);
  } catch (error) {
    console.error('getPublicCities fallback used:', error?.message || error);
    res.json([
      {
        name: 'Brazzaville',
        isActive: true,
        isDefault: true,
        deliveryAvailable: true,
        boostMultiplier: 1
      }
    ]);
  }
});

export const getPublicCommunes = asyncHandler(async (req, res) => {
  try {
    const cityId = normalizeText(req.query?.cityId || '');
    const communes = await getActiveCommunes({
      cityId: cityId || null
    });
    res.json(communes);
  } catch (error) {
    console.error('getPublicCommunes fallback used:', error?.message || error);
    res.json([]);
  }
});

export const getPublicCurrencies = asyncHandler(async (req, res) => {
  try {
    const currencies = await getActiveCurrencies();
    res.json(currencies);
  } catch (error) {
    console.error('getPublicCurrencies fallback used:', error?.message || error);
    res.json([
      {
        code: 'XAF',
        symbol: 'FCFA',
        name: 'Franc CFA',
        decimals: 0,
        isDefault: true,
        isActive: true,
        exchangeRateToDefault: 1,
        formatting: {
          symbolPosition: 'suffix',
          thousandSeparator: ' ',
          decimalSeparator: ','
        }
      }
    ]);
  }
});

export const updateUserPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  const nextTheme = normalizeText(req.body.theme || user.theme || 'system').toLowerCase();
  const allowedTheme = ['light', 'dark', 'system'].includes(nextTheme) ? nextTheme : 'system';

  const nextLanguageRaw = normalizeText(req.body.preferredLanguage || user.preferredLanguage || 'fr').toLowerCase();
  const { languages, defaultLanguage } = await getLanguagesConfig();
  const activeLanguageSet = new Set(
    languages.filter((item) => item.isActive).map((item) => item.code.toLowerCase())
  );
  const preferredLanguage = activeLanguageSet.has(nextLanguageRaw) ? nextLanguageRaw : defaultLanguage || 'fr';

  const nextCurrencyRaw = normalizeText(
    req.body.preferredCurrency || user.preferredCurrency || 'XAF'
  ).toUpperCase();
  const activeCurrencies = await getActiveCurrencies();
  const activeCurrencySet = new Set(activeCurrencies.map((item) => String(item.code).toUpperCase()));
  const fallbackCurrency = (await getDefaultCurrency())?.code || 'XAF';
  const preferredCurrency = activeCurrencySet.has(nextCurrencyRaw) ? nextCurrencyRaw : fallbackCurrency;

  const nextCityRaw = normalizeText(req.body.preferredCity || user.preferredCity || user.city || '');
  const activeCities = await getActiveCities();
  const activeCitySet = new Set(activeCities.map((item) => item.name));
  const fallbackCity = (await getDefaultCity())?.name || user.city || '';
  const preferredCity = activeCitySet.has(nextCityRaw) ? nextCityRaw : fallbackCity;

  user.preferredLanguage = preferredLanguage;
  user.preferredCurrency = preferredCurrency;
  user.preferredCity = preferredCity;
  user.theme = allowedTheme;

  await user.save();

  res.json({
    message: 'Préférences mises à jour.',
    preferences: {
      preferredLanguage: user.preferredLanguage,
      preferredCurrency: user.preferredCurrency,
      preferredCity: user.preferredCity,
      theme: user.theme
    }
  });
});

export const getAdminSettings = asyncHandler(async (req, res) => {
  const [feeSettings, languagesConfig, currencies, cities, communesRaw, defaultCurrency, defaultCity] =
    await Promise.all([
      getSafeFeeSettings(),
      getLanguagesConfig(),
      getActiveCurrencies({ includeInactive: true }),
      getActiveCities({ includeInactive: true }),
      Commune.find({})
        .populate('cityId', 'name')
        .sort({ order: 1, name: 1 })
        .lean(),
      getDefaultCurrency(),
      getDefaultCity()
    ]);

  const communes = (Array.isArray(communesRaw) ? communesRaw : []).map((commune) => {
    const rawCity = commune?.cityId;
    const resolvedCityId = rawCity?._id || rawCity || null;
    return {
      ...commune,
      cityId: resolvedCityId,
      cityName: rawCity?.name || ''
    };
  });

  res.json({
    feesAndRules: {
      commissionRate: Number(feeSettings[SETTING_KEYS.COMMISSION_RATE] || 0),
      boostEnabled: Boolean(feeSettings[SETTING_KEYS.BOOST_ENABLED]),
      installmentMinPercent: Number(feeSettings[SETTING_KEYS.INSTALLMENT_MIN_PERCENT] || 0),
      installmentMaxDuration: Number(feeSettings[SETTING_KEYS.INSTALLMENT_MAX_DURATION] || 0),
      shopConversionAmount: Number(feeSettings[SETTING_KEYS.SHOP_CONVERSION_AMOUNT] || 0),
      analyticsViewWeight: Number(feeSettings[SETTING_KEYS.ANALYTICS_VIEW_WEIGHT] || 0),
      analyticsConversionWeight: Number(feeSettings[SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT] || 0),
      analyticsRevenueWeight: Number(feeSettings[SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT] || 0),
      analyticsRefundPenalty: Number(feeSettings[SETTING_KEYS.ANALYTICS_REFUND_PENALTY] || 0),
      disputeWindowHours: Number(feeSettings[SETTING_KEYS.DISPUTE_WINDOW_HOURS] || 0),
      deliveryOTPExpirationMinutes: Number(
        feeSettings[SETTING_KEYS.DELIVERY_OTP_EXPIRATION_MINUTES] || 0
      ),
      maxDisputesPerMonth: Number(feeSettings[SETTING_KEYS.MAX_DISPUTES_PER_MONTH] || 0),
      maxUploadImages: Number(feeSettings[SETTING_KEYS.MAX_UPLOAD_IMAGES] || 0)
    },
    languages: languagesConfig,
    currencies,
    defaultCurrency,
    cities,
    communes,
    defaultCity
  });
});

export const updateAdminSetting = asyncHandler(async (req, res) => {
  const key = normalizeText(req.params.key);
  if (!key) {
    return res.status(400).json({ message: 'Clé setting invalide.' });
  }

  const allowedKeys = new Set([
    SETTING_KEYS.COMMISSION_RATE,
    SETTING_KEYS.BOOST_ENABLED,
    SETTING_KEYS.INSTALLMENT_MIN_PERCENT,
    SETTING_KEYS.INSTALLMENT_MAX_DURATION,
    SETTING_KEYS.SHOP_CONVERSION_AMOUNT,
    SETTING_KEYS.ANALYTICS_VIEW_WEIGHT,
    SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT,
    SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT,
    SETTING_KEYS.ANALYTICS_REFUND_PENALTY,
    SETTING_KEYS.DISPUTE_WINDOW_HOURS,
    SETTING_KEYS.DELIVERY_OTP_EXPIRATION_MINUTES,
    SETTING_KEYS.MAX_DISPUTES_PER_MONTH,
    SETTING_KEYS.MAX_UPLOAD_IMAGES
  ]);
  if (!allowedKeys.has(key)) {
    return res.status(400).json({ message: 'Ce paramètre ne peut pas être modifié via cet endpoint.' });
  }

  const value = req.body?.value;
  await AppSetting.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        value,
        valueType: toValueType(value),
        description: normalizeText(req.body?.description),
        updatedBy: req.user.id
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Keep runtime config service in sync for all "Fees & Rules" keys.
  try {
    await setRuntimeConfig(key, value, {
      updatedBy: req.user.id,
      syncLegacyAlias: true
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message || 'Valeur setting invalide.' });
    }
    throw error;
  }

  invalidateAllSettingsCaches();
  res.json({ message: 'Paramètre mis à jour.', key, value });
});

export const listAdminCurrencies = asyncHandler(async (req, res) => {
  const currencies = await Currency.find({}).sort({ isDefault: -1, code: 1 }).lean();
  res.json(currencies);
});

export const createAdminCurrency = asyncHandler(async (req, res) => {
  const code = normalizeText(req.body.code).toUpperCase();
  const symbol = normalizeText(req.body.symbol);
  const name = normalizeText(req.body.name);
  if (!code || !symbol || !name) {
    return res.status(400).json({ message: 'code, symbol et name sont requis.' });
  }

  const existing = await Currency.findOne({ code });
  if (existing) {
    return res.status(409).json({ message: 'Cette devise existe déjà.' });
  }

  const currency = await Currency.create({
    code,
    symbol,
    name,
    decimals: Number.isFinite(Number(req.body.decimals)) ? Number(req.body.decimals) : 0,
    isDefault: Boolean(req.body.isDefault),
    isActive: req.body.isActive !== false,
    exchangeRateToDefault: Number(req.body.exchangeRateToDefault || 1),
    formatting: {
      symbolPosition:
        normalizeText(req.body?.formatting?.symbolPosition || 'suffix') === 'prefix'
          ? 'prefix'
          : 'suffix',
      thousandSeparator: normalizeText(req.body?.formatting?.thousandSeparator || ' '),
      decimalSeparator: normalizeText(req.body?.formatting?.decimalSeparator || ',')
    },
    updatedBy: req.user.id
  });

  if (currency.isDefault) {
    await ensureSingleDefaultCurrency(currency.code, req.user.id);
  }
  if (!currency.isDefault) {
    const defaultExists = await Currency.exists({ isDefault: true });
    if (!defaultExists) {
      currency.isDefault = true;
      await currency.save();
    }
  }

  invalidateAllSettingsCaches();
  res.status(201).json(currency);
});

export const updateAdminCurrency = asyncHandler(async (req, res) => {
  const code = normalizeText(req.params.code).toUpperCase();
  const currency = await Currency.findOne({ code });
  if (!currency) {
    return res.status(404).json({ message: 'Devise introuvable.' });
  }

  if (req.body.symbol !== undefined) currency.symbol = normalizeText(req.body.symbol);
  if (req.body.name !== undefined) currency.name = normalizeText(req.body.name);
  if (req.body.decimals !== undefined) currency.decimals = Math.max(0, Number(req.body.decimals || 0));
  if (req.body.exchangeRateToDefault !== undefined) {
    currency.exchangeRateToDefault = Math.max(0, Number(req.body.exchangeRateToDefault || 0));
  }
  if (req.body.isActive !== undefined) {
    const nextActive = Boolean(req.body.isActive);
    if (currency.isDefault && !nextActive) {
      return res.status(400).json({ message: 'La devise par défaut doit rester active.' });
    }
    currency.isActive = nextActive;
  }
  if (req.body.formatting && typeof req.body.formatting === 'object') {
    currency.formatting = {
      symbolPosition:
        normalizeText(req.body.formatting.symbolPosition || currency.formatting?.symbolPosition) ===
        'prefix'
          ? 'prefix'
          : 'suffix',
      thousandSeparator: normalizeText(
        req.body.formatting.thousandSeparator || currency.formatting?.thousandSeparator || ' '
      ),
      decimalSeparator: normalizeText(
        req.body.formatting.decimalSeparator || currency.formatting?.decimalSeparator || ','
      )
    };
  }
  if (req.body.isDefault !== undefined) {
    currency.isDefault = Boolean(req.body.isDefault);
  }
  currency.updatedBy = req.user.id;
  await currency.save();

  if (currency.isDefault) {
    await ensureSingleDefaultCurrency(currency.code, req.user.id);
  } else {
    const anotherDefault = await Currency.findOne({ isDefault: true, code: { $ne: currency.code } }).lean();
    if (!anotherDefault) {
      currency.isDefault = true;
      await currency.save();
    }
  }

  invalidateAllSettingsCaches();
  res.json(currency);
});

export const getAdminLanguages = asyncHandler(async (req, res) => {
  const payload = await getLanguagesConfig();
  res.json(payload);
});

export const patchAdminLanguages = asyncHandler(async (req, res) => {
  const languagesPayload = Array.isArray(req.body.languages) ? req.body.languages : [];
  if (!languagesPayload.length) {
    return res.status(400).json({ message: 'Au moins une langue est requise.' });
  }
  const normalized = languagesPayload
    .map((item) => ({
      code: normalizeText(item.code).toLowerCase(),
      name: normalizeText(item.name || item.code),
      isActive: item.isActive !== false
    }))
    .filter((item) => item.code);
  if (!normalized.length) {
    return res.status(400).json({ message: 'Liste de langues invalide.' });
  }

  const requestedDefault = normalizeText(req.body.defaultLanguage || '').toLowerCase();
  const activeSet = new Set(normalized.filter((item) => item.isActive).map((item) => item.code));
  const defaultLanguage = activeSet.has(requestedDefault)
    ? requestedDefault
    : normalized.find((item) => item.isActive)?.code || normalized[0].code;

  await Promise.all([
    AppSetting.findOneAndUpdate(
      { key: SETTING_KEYS.LANGUAGES },
      {
        $set: {
          key: SETTING_KEYS.LANGUAGES,
          value: normalized,
          valueType: 'array',
          description: 'Langues activées côté client',
          updatedBy: req.user.id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    AppSetting.findOneAndUpdate(
      { key: SETTING_KEYS.DEFAULT_LANGUAGE },
      {
        $set: {
          key: SETTING_KEYS.DEFAULT_LANGUAGE,
          value: defaultLanguage,
          valueType: 'string',
          description: 'Langue par défaut',
          updatedBy: req.user.id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  ]);

  invalidateAllSettingsCaches();
  res.json({ languages: normalized, defaultLanguage });
});

export const listAdminCities = asyncHandler(async (req, res) => {
  const cities = await City.find({}).sort({ isDefault: -1, order: 1, name: 1 }).lean();
  res.json(cities);
});

export const createAdminCity = asyncHandler(async (req, res) => {
  const name = normalizeText(req.body.name);
  if (!name) {
    return res.status(400).json({ message: 'Nom de ville requis.' });
  }
  const exists = await City.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
  if (exists) {
    return res.status(409).json({ message: 'Cette ville existe déjà.' });
  }

  const city = await City.create({
    name,
    isActive: req.body.isActive !== false,
    isDefault: Boolean(req.body.isDefault),
    order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
    deliveryAvailable: req.body.deliveryAvailable !== false,
    boostMultiplier: Number.isFinite(Number(req.body.boostMultiplier))
      ? Number(req.body.boostMultiplier)
      : 1,
    updatedBy: req.user.id
  });

  if (city.isDefault) {
    await ensureSingleDefaultCity(city._id, req.user.id);
  } else {
    const defaultExists = await City.exists({ isDefault: true });
    if (!defaultExists) {
      city.isDefault = true;
      await city.save();
    }
  }

  invalidateAllSettingsCaches();
  res.status(201).json(city);
});

export const updateAdminCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }
  const previousName = city.name;

  if (req.body.name !== undefined) city.name = normalizeText(req.body.name);
  if (req.body.deliveryAvailable !== undefined) {
    city.deliveryAvailable = Boolean(req.body.deliveryAvailable);
  }
  if (req.body.order !== undefined) {
    city.order = Math.max(0, Number(req.body.order || 0));
  }
  if (req.body.boostMultiplier !== undefined) {
    city.boostMultiplier = Math.max(0, Number(req.body.boostMultiplier || 0));
  }
  if (req.body.isActive !== undefined) {
    const nextActive = Boolean(req.body.isActive);
    if (city.isDefault && !nextActive) {
      return res.status(400).json({ message: 'La ville par défaut doit rester active.' });
    }
    city.isActive = nextActive;
  }
  if (req.body.isDefault !== undefined) {
    city.isDefault = Boolean(req.body.isDefault);
  }
  city.updatedBy = req.user.id;
  await city.save();

  if (city.isDefault) {
    await ensureSingleDefaultCity(city._id, req.user.id);
  } else {
    const anotherDefault = await City.findOne({ isDefault: true, _id: { $ne: city._id } }).lean();
    if (!anotherDefault) {
      city.isDefault = true;
      await city.save();
    }
  }

  // Keep user/product city values consistent when city name is changed.
  if (req.body.name !== undefined) {
    const nextName = city.name;
    if (previousName && previousName !== nextName) {
      await Promise.all([
        User.updateMany({ city: previousName }, { $set: { city: nextName } }),
        User.updateMany({ preferredCity: previousName }, { $set: { preferredCity: nextName } }),
        Product.updateMany({ city: previousName }, { $set: { city: nextName } })
      ]);
    }
  }

  invalidateAllSettingsCaches();
  res.json(city);
});

export const deleteAdminCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }

  const linkedCommunesCount = await Commune.countDocuments({ cityId: city._id });
  if (linkedCommunesCount > 0) {
    return res.status(409).json({
      message: 'Impossible de supprimer cette ville tant que des communes y sont rattachées.'
    });
  }

  const totalCities = await City.countDocuments({});
  if (totalCities <= 1) {
    return res.status(400).json({ message: 'Impossible de supprimer la dernière ville.' });
  }

  let replacementCity = null;
  if (city.isDefault) {
    replacementCity =
      (await City.findOne({ _id: { $ne: city._id }, isActive: true }).sort({ order: 1, name: 1 })) ||
      (await City.findOne({ _id: { $ne: city._id } }).sort({ order: 1, name: 1 }));

    if (!replacementCity) {
      return res.status(400).json({ message: 'Aucune ville de remplacement disponible.' });
    }

    replacementCity.isDefault = true;
    replacementCity.updatedBy = req.user.id;
    await replacementCity.save();
    await ensureSingleDefaultCity(replacementCity._id, req.user.id);
  }

  await city.deleteOne();

  if (replacementCity?.name) {
    await Promise.all([
      User.updateMany(
        { preferredCity: city.name },
        { $set: { preferredCity: replacementCity.name } }
      ),
      User.updateMany({ city: city.name }, { $set: { city: replacementCity.name } }),
      Product.updateMany({ city: city.name }, { $set: { city: replacementCity.name } })
    ]);
  }

  invalidateAllSettingsCaches();
  res.json({
    message: 'Ville supprimée.',
    deletedId: city._id,
    replacementCity: replacementCity
      ? {
          _id: replacementCity._id,
          name: replacementCity.name,
          isDefault: replacementCity.isDefault
        }
      : null
  });
});

export const listAdminCommunes = asyncHandler(async (req, res) => {
  const communes = await Commune.find({})
    .populate('cityId', 'name')
    .sort({ order: 1, name: 1 })
    .lean();
  res.json(communes);
});

export const createAdminCommune = asyncHandler(async (req, res) => {
  const name = normalizeText(req.body.name);
  const cityId = normalizeText(req.body.cityId);
  if (!name || !cityId) {
    return res.status(400).json({ message: 'Nom de commune et ville requis.' });
  }

  const city = await City.findById(cityId).lean();
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }

  const exists = await Commune.findOne({
    cityId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  }).lean();
  if (exists) {
    return res.status(409).json({ message: 'Cette commune existe déjà pour cette ville.' });
  }

  const deliveryPolicy = normalizeText(req.body.deliveryPolicy || 'DEFAULT_RULE').toUpperCase();
  const fixedFee = Number(req.body.fixedFee || 0);
  if (deliveryPolicy === 'FIXED_FEE' && (!Number.isFinite(fixedFee) || fixedFee < 0)) {
    return res.status(400).json({ message: 'fixedFee doit être >= 0 pour FIXED_FEE.' });
  }

  const commune = await Commune.create({
    name,
    cityId,
    isActive: req.body.isActive !== false,
    deliveryPolicy: ['FREE', 'FIXED_FEE', 'DEFAULT_RULE'].includes(deliveryPolicy)
      ? deliveryPolicy
      : 'DEFAULT_RULE',
    fixedFee: Math.max(0, Number.isFinite(fixedFee) ? fixedFee : 0),
    order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
    updatedBy: req.user.id
  });

  invalidateAllSettingsCaches();
  res.status(201).json(commune);
});

export const updateAdminCommune = asyncHandler(async (req, res) => {
  const commune = await Commune.findById(req.params.id);
  if (!commune) {
    return res.status(404).json({ message: 'Commune introuvable.' });
  }

  if (req.body.name !== undefined) {
    commune.name = normalizeText(req.body.name);
  }
  if (req.body.cityId !== undefined) {
    const city = await City.findById(req.body.cityId).lean();
    if (!city) {
      return res.status(404).json({ message: 'Ville introuvable.' });
    }
    commune.cityId = req.body.cityId;
  }
  if (req.body.isActive !== undefined) {
    commune.isActive = Boolean(req.body.isActive);
  }
  if (req.body.deliveryPolicy !== undefined) {
    const nextPolicy = normalizeText(req.body.deliveryPolicy).toUpperCase();
    if (!['FREE', 'FIXED_FEE', 'DEFAULT_RULE'].includes(nextPolicy)) {
      return res.status(400).json({ message: 'deliveryPolicy invalide.' });
    }
    commune.deliveryPolicy = nextPolicy;
  }
  if (req.body.fixedFee !== undefined) {
    const nextFee = Number(req.body.fixedFee || 0);
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      return res.status(400).json({ message: 'fixedFee doit être >= 0.' });
    }
    commune.fixedFee = nextFee;
  }
  if (req.body.order !== undefined) {
    commune.order = Math.max(0, Number(req.body.order || 0));
  }
  if (commune.deliveryPolicy === 'FIXED_FEE' && Number(commune.fixedFee || 0) < 0) {
    return res.status(400).json({ message: 'fixedFee requis pour FIXED_FEE.' });
  }

  commune.updatedBy = req.user.id;
  await commune.save();
  invalidateAllSettingsCaches();
  res.json(commune);
});

export const deleteAdminCommune = asyncHandler(async (req, res) => {
  const commune = await Commune.findById(req.params.id);
  if (!commune) {
    return res.status(404).json({ message: 'Commune introuvable.' });
  }

  await commune.deleteOne();
  invalidateAllSettingsCaches();
  res.json({
    message: 'Commune supprimée.',
    deletedId: commune._id
  });
});

export const ensureDefaultSettingsBootstrap = async () => {
  await ensureRuntimeConfigBootstrap();

  const bootstrapOperations = [];
  Object.entries(DEFAULT_APP_SETTINGS).forEach(([key, value]) => {
    bootstrapOperations.push(
      AppSetting.updateOne(
        { key },
        {
          $setOnInsert: {
            key,
            value,
            valueType: toValueType(value),
            description: key
          }
        },
        { upsert: true }
      )
    );
  });
  await Promise.all(bootstrapOperations);

  const hasCurrency = await Currency.exists({});
  if (!hasCurrency) {
    await Currency.create({
      code: 'XAF',
      symbol: 'FCFA',
      name: 'Franc CFA',
      decimals: 0,
      isDefault: true,
      isActive: true,
      exchangeRateToDefault: 1,
      formatting: {
        symbolPosition: 'suffix',
        thousandSeparator: ' ',
        decimalSeparator: ','
      }
    });
  }

  const hasCity = await City.exists({});
  if (!hasCity) {
    await City.create({
      name: 'Brazzaville',
      isDefault: true,
      isActive: true,
      order: 0,
      deliveryAvailable: true,
      boostMultiplier: 1
    });
  }

  const defaultCity = await City.findOne({ isDefault: true }).lean();
  if (defaultCity) {
    const hasCommune = await Commune.exists({});
    if (!hasCommune) {
      await Commune.create({
        name: 'Centre-ville',
        cityId: defaultCity._id,
        isActive: true,
        deliveryPolicy: 'DEFAULT_RULE',
        fixedFee: 0,
        order: 0
      });
    }
  }
};
