import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { abortPendingRequests, clearCache } from '../services/api';
import storage from '../utils/storage';
import AuthContext from './AuthContext';
import { queryClient } from '../lib/queryClient';

const CountryContext = createContext(null);
const COUNTRY_ID_KEY = 'hd_selected_country_id';
const COUNTRY_CODE_KEY = 'hd_selected_country_code';
const COUNTRY_CONFIRMED_KEY = 'hd_country_confirmed';

export const CountryProvider = ({ children }) => {
  const { user, updateUser } = useContext(AuthContext);
  const [country, setCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const loadCountries = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    try {
      const { data } = await api.get('/countries', force ? { skipCache: true, headers: { 'x-skip-cache': '1' } } : {});
      const items = Array.isArray(data?.countries) ? data.countries : [];
      const storedId = String(await storage.get(COUNTRY_ID_KEY) || '');
      const confirmed = Boolean(await storage.get(COUNTRY_CONFIRMED_KEY));
      setNeedsConfirmation(!confirmed);
      const userId = String(user?.selectedCountryId || '');
      const selected = items.find((item) => String(item.id || item._id) === (userId || storedId)) || data?.currentCountry || items.find((item) => item.isDefault) || items[0] || null;
      let detailedSelected = selected;
      if (selected?.id || selected?._id) {
        try {
          const detail = await api.get(`/countries/${selected.id || selected._id}`, { silentGlobalError: true });
          detailedSelected = { ...selected, ...(detail?.data || {}) };
        } catch {}
      }
      setCountries(items);
      setCountry(detailedSelected);
      setError('');
      if (detailedSelected) {
        await Promise.all([
          storage.set(COUNTRY_ID_KEY, detailedSelected.id || detailedSelected._id),
          storage.set(COUNTRY_CODE_KEY, detailedSelected.code)
        ]);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Impossible de charger les pays disponibles.");
    } finally {
      setLoading(false);
    }
  }, [user?.selectedCountryId]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  const changeCountry = useCallback(async (nextCountryOrId) => {
    const next = typeof nextCountryOrId === 'object'
      ? nextCountryOrId
      : countries.find((item) => String(item.id || item._id) === String(nextCountryOrId) || item.code === nextCountryOrId);
    if (!next || String(next.id || next._id) === String(country?.id || country?._id)) return country;
    abortPendingRequests('COUNTRY_CHANGED');
    await Promise.all([
      storage.set(COUNTRY_ID_KEY, next.id || next._id),
      storage.set(COUNTRY_CODE_KEY, next.code),
      storage.set(COUNTRY_CONFIRMED_KEY, true)
    ]);
    setNeedsConfirmation(false);
    if (user) {
      const { data } = await api.patch('/countries/selection', { countryId: next.id || next._id }, { skipCache: true });
      await updateUser({
        selectedCountryId: data?.selectedCountryId || next.id || next._id,
        preferredCurrency: next.currency?.code || user.preferredCurrency
      });
    }
    let detailedNext = next;
    try {
      const detail = await api.get(`/countries/${next.id || next._id}`, { skipCache: true, silentGlobalError: true });
      detailedNext = { ...next, ...(detail?.data || {}) };
    } catch {}
    setCountry(detailedNext);
    queryClient.invalidateQueries();
    await Promise.allSettled([
      clearCache('/home'),
      clearCache('/products'),
      clearCache('/search'),
      clearCache('/shops'),
      clearCache('/cities'),
      clearCache('/cart')
    ]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hdmarket:country-changed', { detail: { country: detailedNext } }));
    }
    return detailedNext;
  }, [countries, country, updateUser, user]);

  const confirmCountry = useCallback(async () => {
    await storage.set(COUNTRY_CONFIRMED_KEY, true);
    setNeedsConfirmation(false);
  }, []);

  const isCountryFeatureEnabled = useCallback((featureKey, fallback = true) => {
    const value = country?.featureOverrides?.[featureKey];
    return typeof value === 'boolean' ? value : fallback;
  }, [country]);

  const value = useMemo(() => ({
    country,
    countries,
    currency: country?.currency || null,
    loading,
    error,
    needsConfirmation,
    confirmCountry,
    changeCountry,
    reloadCountries: loadCountries,
    isCountryFeatureEnabled
  }), [changeCountry, confirmCountry, countries, country, error, isCountryFeatureEnabled, loadCountries, loading, needsConfirmation]);

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
};

export const useCountry = () => {
  const context = useContext(CountryContext);
  if (!context) throw new Error('useCountry must be used inside CountryProvider');
  return context;
};

export default CountryContext;
