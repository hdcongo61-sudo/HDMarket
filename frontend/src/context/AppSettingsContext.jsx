import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearCache } from '../services/api';
import storage from '../utils/storage';
import AuthContext from './AuthContext';
import { formatPriceWithCurrency } from '../utils/priceFormatter';
import { I18N_NAMESPACES, getNestedTranslation, loadLanguageResources } from '../i18n';
import { subscribeToSettingsRefresh } from '../utils/settingsRefresh';

const STORAGE_KEYS = {
  language: 'hd_pref_language',
  currency: 'hd_pref_currency',
  city: 'hd_pref_city',
  theme: 'hd_pref_theme',
  publicRuntime: 'hd_public_runtime_settings'
};

const FALLBACK_CURRENCY = {
  code: 'XAF',
  symbol: 'FCFA',
  name: 'Franc CFA',
  decimals: 0,
  isActive: true,
  isDefault: true,
  exchangeRateToDefault: 1,
  formatting: {
    symbolPosition: 'suffix',
    thousandSeparator: ' ',
    decimalSeparator: ','
  }
};

const FALLBACK_CITY = {
  _id: 'fallback-city-brazzaville',
  name: 'Brazzaville',
  isActive: true,
  isDefault: true,
  deliveryAvailable: true,
  boostMultiplier: 1
};
const FALLBACK_COMMUNE = {
  _id: 'fallback-commune-centre',
  name: 'Centre-ville',
  cityId: FALLBACK_CITY._id,
  isActive: true,
  deliveryPolicy: 'DEFAULT_RULE',
  fixedFee: 0
};

const AppSettingsContext = createContext(null);

const FEATURE_RUNTIME_KEYS = Object.freeze({
  enable_boost: ['enable_boost', 'boost_enabled'],
  enable_chat: ['enable_chat'],
  enable_wholesale: ['enable_wholesale'],
  enable_founder_mode: ['enable_founder_mode'],
  enable_seller_analytics: ['enable_seller_analytics'],
  enable_advanced_chat: ['enable_advanced_chat'],
  enable_ai_recommendations: ['enable_ai_recommendations']
});

const FEATURE_APP_KEYS = Object.freeze({
  enable_boost: ['boostEnabled']
});

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeTheme = (value) => (['light', 'dark', 'system'].includes(value) ? value : 'system');

const applyThemeClass = (themeValue) => {
  if (typeof document === 'undefined') return;
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = themeValue === 'system' ? (systemDark ? 'dark' : 'light') : themeValue;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const AppSettingsProvider = ({ children }) => {
  const { user, updateUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [publicSettings, setPublicSettings] = useState({
    app: {},
    runtime: {},
    featureFlags: {},
    ui: {},
    defaultLanguage: 'fr',
    languages: [{ code: 'fr', name: 'Français', isActive: true }],
    defaultCurrency: null,
    currencies: [],
    defaultCity: null,
    cities: [],
    communes: []
  });
  const [language, setLanguageState] = useState('fr');
  const [currencyCode, setCurrencyCodeState] = useState('XAF');
  const [city, setCityState] = useState('');
  const [theme, setThemeState] = useState('system');
  const [resources, setResources] = useState({});

  const normalizePublicPayload = useCallback((payload = {}) => {
    const normalizedCurrencies = Array.isArray(payload.currencies) ? payload.currencies : [];
    const normalizedCities = Array.isArray(payload.cities) ? payload.cities : [];
    const normalizedCommunes = Array.isArray(payload.communes) ? payload.communes : [];
    const normalizedLanguages = Array.isArray(payload.languages) ? payload.languages : [];

    const currencies =
      normalizedCurrencies.length > 0 ? normalizedCurrencies : [FALLBACK_CURRENCY];
    const cities = normalizedCities.length > 0 ? normalizedCities : [FALLBACK_CITY];
    const defaultCurrency =
      payload.defaultCurrency ||
      currencies.find((item) => item?.isDefault) ||
      currencies[0] ||
      FALLBACK_CURRENCY;
    const defaultCity =
      payload.defaultCity || cities.find((item) => item?.isDefault) || cities[0] || FALLBACK_CITY;

    const safe = {
      app: payload.app || {},
      runtime: payload.runtime || {},
      featureFlags: payload.featureFlags || {},
      ui: payload.ui || {},
      defaultLanguage: payload.defaultLanguage || 'fr',
      languages:
        normalizedLanguages.length > 0
          ? normalizedLanguages
          : [{ code: 'fr', name: 'Français', isActive: true }],
      defaultCurrency,
      currencies,
      defaultCity,
      cities,
      communes: normalizedCommunes.length > 0 ? normalizedCommunes : [FALLBACK_COMMUNE]
    };
    setPublicSettings(safe);
    return safe;
  }, []);

  const loadPublicSettings = useCallback(async () => {
    const refreshToken = Date.now();
    try {
      const { data } = await api.get('/settings/public', {
        skipCache: true,
        headers: { 'x-skip-cache': '1' },
        params: { refresh: refreshToken }
      });
      return normalizePublicPayload(data || {});
    } catch {
      const [currenciesResult, citiesResult, communesResult, runtimeResult] = await Promise.allSettled([
        api.get('/settings/currencies', { skipCache: true, headers: { 'x-skip-cache': '1' }, params: { refresh: refreshToken } }),
        api.get('/settings/cities', { skipCache: true, headers: { 'x-skip-cache': '1' }, params: { refresh: refreshToken } }),
        api.get('/settings/communes', { skipCache: true, headers: { 'x-skip-cache': '1' }, params: { refresh: refreshToken } }),
        api.get('/settings/runtime', { skipCache: true, headers: { 'x-skip-cache': '1' }, params: { refresh: refreshToken } })
      ]);

      const fallbackPayload = {
        app: {},
        runtime: {},
        featureFlags: {},
        ui: {},
        defaultLanguage: 'fr',
        languages: [{ code: 'fr', name: 'Français', isActive: true }],
        currencies:
          currenciesResult.status === 'fulfilled' && Array.isArray(currenciesResult.value?.data)
            ? currenciesResult.value.data
            : [FALLBACK_CURRENCY],
        cities:
          citiesResult.status === 'fulfilled' && Array.isArray(citiesResult.value?.data)
            ? citiesResult.value.data
            : [FALLBACK_CITY],
        communes:
          communesResult.status === 'fulfilled' && Array.isArray(communesResult.value?.data)
            ? communesResult.value.data
            : [FALLBACK_COMMUNE]
      };
      if (runtimeResult.status === 'fulfilled' && runtimeResult.value?.data) {
        const runtimeResponse = runtimeResult.value.data;
        fallbackPayload.runtime = runtimeResponse?.values || {};
        fallbackPayload.featureFlags = runtimeResponse?.featureFlags || {};
        fallbackPayload.ui = runtimeResponse?.byCategory?.ui || {};
      }
      return normalizePublicPayload(fallbackPayload);
    }
  }, [normalizePublicPayload]);

  useEffect(() => {
    let refreshing = false;
    const handleRefresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        await clearCache('/settings');
        await loadPublicSettings();
      } finally {
        refreshing = false;
      }
    };
    return subscribeToSettingsRefresh(handleRefresh);
  }, [loadPublicSettings]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      try {
        const payload = await loadPublicSettings();
        if (!mounted) return;

        const storedLanguage = (await storage.get(STORAGE_KEYS.language)) || '';
        const storedCurrency = (await storage.get(STORAGE_KEYS.currency)) || '';
        const storedCity = (await storage.get(STORAGE_KEYS.city)) || '';
        const storedTheme = (await storage.get(STORAGE_KEYS.theme)) || '';

        const nextLanguage =
          user?.preferredLanguage ||
          storedLanguage ||
          'fr';
        const nextCurrency =
          user?.preferredCurrency ||
          storedCurrency ||
          payload?.defaultCurrency?.code ||
          'XAF';
        const nextCity =
          user?.preferredCity ||
          user?.city ||
          storedCity ||
          payload?.defaultCity?.name ||
          '';
        const nextTheme = normalizeTheme(user?.theme || storedTheme || 'system');

        setLanguageState(String(nextLanguage).toLowerCase());
        setCurrencyCodeState(String(nextCurrency).toUpperCase());
        setCityState(String(nextCity));
        setThemeState(nextTheme);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadPublicSettings, user?.preferredLanguage, user?.preferredCurrency, user?.preferredCity, user?.city, user?.theme]);

  useEffect(() => {
    applyThemeClass(theme);
    storage.set(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.language, language);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', String(language || 'fr').toLowerCase());
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hdmarket:language-changed', {
          detail: { language: String(language || 'fr').toLowerCase() }
        })
      );
    }
  }, [language]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.currency, currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.city, city);
  }, [city]);

  useEffect(() => {
    storage.set('hd_public_currency_settings', {
      currencies: publicSettings.currencies || [],
      defaultCurrency: publicSettings.defaultCurrency || null
    });
  }, [publicSettings.currencies, publicSettings.defaultCurrency]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.publicRuntime, publicSettings.runtime || {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hdmarket:runtime-settings-updated'));
    }
  }, [publicSettings.runtime]);

  useEffect(() => {
    let mounted = true;
    const loadResources = async () => {
      const desiredLanguage = language || publicSettings.defaultLanguage || 'fr';
      let bundles = await loadLanguageResources(desiredLanguage, I18N_NAMESPACES);
      if (!Object.keys(bundles || {}).length && desiredLanguage !== 'fr') {
        bundles = await loadLanguageResources('fr', I18N_NAMESPACES);
      }
      if (mounted) setResources(bundles || {});
    };
    loadResources();
    return () => {
      mounted = false;
    };
  }, [language, publicSettings.defaultLanguage]);

  const activeLanguages = useMemo(
    () => (publicSettings.languages || []).filter((item) => item?.isActive !== false),
    [publicSettings.languages]
  );
  const activeCurrencies = useMemo(
    () => (publicSettings.currencies || []).filter((item) => item?.isActive !== false),
    [publicSettings.currencies]
  );
  const activeCities = useMemo(
    () => (publicSettings.cities || []).filter((item) => item?.isActive !== false),
    [publicSettings.cities]
  );
  const activeCommunes = useMemo(
    () => (publicSettings.communes || []).filter((item) => item?.isActive !== false),
    [publicSettings.communes]
  );

  const selectedCurrency =
    activeCurrencies.find((item) => String(item.code).toUpperCase() === String(currencyCode).toUpperCase()) ||
    publicSettings.defaultCurrency ||
    activeCurrencies[0] ||
    null;

  const persistPreferences = useCallback(
    async (patch = {}) => {
      const normalizeLanguage = (value) => String(value || '').trim().toLowerCase();
      const nextPreferences = {
        preferredLanguage: patch.preferredLanguage ?? language,
        preferredCurrency: patch.preferredCurrency ?? currencyCode,
        preferredCity: patch.preferredCity ?? city,
        theme: normalizeTheme(patch.theme ?? theme)
      };
      if (patch.preferredLanguage !== undefined) {
        nextPreferences.preferredLanguage = normalizeLanguage(nextPreferences.preferredLanguage);
      }

      if (patch.preferredLanguage !== undefined) setLanguageState(normalizeLanguage(nextPreferences.preferredLanguage));
      if (patch.preferredCurrency !== undefined) setCurrencyCodeState(String(nextPreferences.preferredCurrency).toUpperCase());
      if (patch.preferredCity !== undefined) setCityState(String(nextPreferences.preferredCity));
      if (patch.theme !== undefined) setThemeState(nextPreferences.theme);

      if (!user?.token) return nextPreferences;

      setSavingPreferences(true);
      try {
        const { data } = await api.patch('/user/preferences', nextPreferences);
        const serverPreferences = data?.preferences || nextPreferences;
        updateUser(serverPreferences);
        return serverPreferences;
      } finally {
        setSavingPreferences(false);
      }
    },
    [city, currencyCode, language, theme, updateUser, user?.token]
  );

  const t = useCallback(
    (key, fallback = '') => {
      const merged = {
        ...(resources.common || {}),
        ...(resources.orders || {})
      };
      return getNestedTranslation(merged, key, fallback || key);
    },
    [resources]
  );

  const formatPrice = useCallback(
    (value) => formatPriceWithCurrency(value, selectedCurrency, publicSettings.defaultCurrency),
    [publicSettings.defaultCurrency, selectedCurrency]
  );

  const getRuntimeValue = useCallback(
    (key, fallback = null) => {
      const normalized = String(key || '').trim();
      if (!normalized) return fallback;
      if (Object.prototype.hasOwnProperty.call(publicSettings.runtime || {}, normalized)) {
        return publicSettings.runtime[normalized];
      }
      return fallback;
    },
    [publicSettings.runtime]
  );

  const isFeatureEnabled = useCallback(
    (featureName, options = {}) => {
      const normalized = String(featureName || '').trim();
      if (!normalized) return false;
      const defaultValue = Object.prototype.hasOwnProperty.call(options, 'defaultValue')
        ? Boolean(options.defaultValue)
        : true;

      const featureEntry = publicSettings.featureFlags?.[normalized];
      if (typeof featureEntry === 'boolean') return featureEntry;
      if (featureEntry && typeof featureEntry === 'object' && typeof featureEntry.enabled === 'boolean') {
        return featureEntry.enabled;
      }

      const runtimeKeys = FEATURE_RUNTIME_KEYS[normalized] || [normalized];
      for (const key of runtimeKeys) {
        if (Object.prototype.hasOwnProperty.call(publicSettings.runtime || {}, key)) {
          return toBoolean(publicSettings.runtime[key], defaultValue);
        }
      }

      const appKeys = FEATURE_APP_KEYS[normalized] || [];
      for (const key of appKeys) {
        if (Object.prototype.hasOwnProperty.call(publicSettings.app || {}, key)) {
          return toBoolean(publicSettings.app[key], defaultValue);
        }
      }

      return defaultValue;
    },
    [publicSettings.featureFlags, publicSettings.runtime, publicSettings.app]
  );

  const contextValue = useMemo(
    () => ({
      loading,
      savingPreferences,
      app: publicSettings.app || {},
      runtime: publicSettings.runtime || {},
      featureFlags: publicSettings.featureFlags || {},
      ui: publicSettings.ui || {},
      languages: activeLanguages,
      currencies: activeCurrencies,
      cities: activeCities,
      communes: activeCommunes,
      defaultLanguage: publicSettings.defaultLanguage || 'fr',
      defaultCurrency: publicSettings.defaultCurrency || null,
      defaultCity: publicSettings.defaultCity || null,
      language,
      currencyCode,
      city,
      theme,
      selectedCurrency,
      t,
      formatPrice,
      getRuntimeValue,
      refreshSettings: loadPublicSettings,
      setLanguage: (value) => persistPreferences({ preferredLanguage: value }),
      setCurrency: (value) => persistPreferences({ preferredCurrency: value }),
      setCity: (value) => persistPreferences({ preferredCity: value }),
      setTheme: (value) => persistPreferences({ theme: value }),
      updatePreferences: persistPreferences,
      isFeatureEnabled
    }),
    [
      loading,
      savingPreferences,
      publicSettings.app,
      publicSettings.runtime,
      publicSettings.featureFlags,
      publicSettings.ui,
      publicSettings.defaultLanguage,
      publicSettings.defaultCurrency,
      publicSettings.defaultCity,
      activeLanguages,
      activeCurrencies,
      activeCities,
      activeCommunes,
      language,
      currencyCode,
      city,
      theme,
      selectedCurrency,
      t,
      formatPrice,
      getRuntimeValue,
      loadPublicSettings,
      persistPreferences,
      isFeatureEnabled
    ]
  );

  return <AppSettingsContext.Provider value={contextValue}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }
  return context;
};

export default AppSettingsContext;
