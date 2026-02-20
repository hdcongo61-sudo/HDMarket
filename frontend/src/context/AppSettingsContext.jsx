import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import storage from '../utils/storage';
import AuthContext from './AuthContext';
import { formatPriceWithCurrency } from '../utils/priceFormatter';
import { I18N_NAMESPACES, getNestedTranslation, loadLanguageResources } from '../i18n';

const STORAGE_KEYS = {
  language: 'hd_pref_language',
  currency: 'hd_pref_currency',
  city: 'hd_pref_city',
  theme: 'hd_pref_theme'
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

const AppSettingsContext = createContext(null);

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
    defaultLanguage: 'fr',
    languages: [{ code: 'fr', name: 'Français', isActive: true }],
    defaultCurrency: null,
    currencies: [],
    defaultCity: null,
    cities: []
  });
  const [language, setLanguageState] = useState('fr');
  const [currencyCode, setCurrencyCodeState] = useState('XAF');
  const [city, setCityState] = useState('');
  const [theme, setThemeState] = useState('system');
  const [resources, setResources] = useState({});

  const normalizePublicPayload = useCallback((payload = {}) => {
    const normalizedCurrencies = Array.isArray(payload.currencies) ? payload.currencies : [];
    const normalizedCities = Array.isArray(payload.cities) ? payload.cities : [];
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
      defaultLanguage: payload.defaultLanguage || 'fr',
      languages:
        normalizedLanguages.length > 0
          ? normalizedLanguages
          : [{ code: 'fr', name: 'Français', isActive: true }],
      defaultCurrency,
      currencies,
      defaultCity,
      cities
    };
    setPublicSettings(safe);
    return safe;
  }, []);

  const loadPublicSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/public', { skipCache: true });
      return normalizePublicPayload(data || {});
    } catch {
      const [currenciesResult, citiesResult] = await Promise.allSettled([
        api.get('/settings/currencies', { skipCache: true }),
        api.get('/settings/cities', { skipCache: true })
      ]);

      const fallbackPayload = {
        app: {},
        defaultLanguage: 'fr',
        languages: [{ code: 'fr', name: 'Français', isActive: true }],
        currencies:
          currenciesResult.status === 'fulfilled' && Array.isArray(currenciesResult.value?.data)
            ? currenciesResult.value.data
            : [FALLBACK_CURRENCY],
        cities:
          citiesResult.status === 'fulfilled' && Array.isArray(citiesResult.value?.data)
            ? citiesResult.value.data
            : [FALLBACK_CITY]
      };
      return normalizePublicPayload(fallbackPayload);
    }
  }, [normalizePublicPayload]);

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
          payload?.defaultLanguage ||
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

  const contextValue = useMemo(
    () => ({
      loading,
      savingPreferences,
      app: publicSettings.app || {},
      languages: activeLanguages,
      currencies: activeCurrencies,
      cities: activeCities,
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
      refreshSettings: loadPublicSettings,
      setLanguage: (value) => persistPreferences({ preferredLanguage: value }),
      setCurrency: (value) => persistPreferences({ preferredCurrency: value }),
      setCity: (value) => persistPreferences({ preferredCity: value }),
      setTheme: (value) => persistPreferences({ theme: value }),
      updatePreferences: persistPreferences
    }),
    [
      loading,
      savingPreferences,
      publicSettings.app,
      publicSettings.defaultLanguage,
      publicSettings.defaultCurrency,
      publicSettings.defaultCity,
      activeLanguages,
      activeCurrencies,
      activeCities,
      language,
      currencyCode,
      city,
      theme,
      selectedCurrency,
      t,
      formatPrice,
      loadPublicSettings,
      persistPreferences
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
