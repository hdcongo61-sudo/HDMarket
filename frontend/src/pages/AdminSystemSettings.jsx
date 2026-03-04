import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  Globe2,
  Landmark,
  Languages,
  MapPin,
  Plus,
  Save,
  Trash2,
  Truck
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { emitSettingsRefresh } from '../utils/settingsRefresh';
import useIsMobile from '../hooks/useIsMobile';

const FEE_FIELDS = [
  { key: 'commissionRate', label: 'Taux commission (%)', type: 'number', step: 0.1 },
  { key: 'boostEnabled', label: 'Boost active', type: 'boolean' },
  { key: 'installmentMinPercent', label: 'Tranche min (%)', type: 'number', step: 1 },
  { key: 'installmentMaxDuration', label: 'Duree max tranche (jours)', type: 'number', step: 1 },
  { key: 'shopConversionAmount', label: 'Montant devenir boutique', type: 'number', step: 1 },
  {
    key: 'analyticsViewWeight',
    label: 'Importance des vues',
    type: 'number',
    step: 0.01,
    help: 'Plus la valeur est elevee, plus le nombre de vues influence le score produit.'
  },
  {
    key: 'analyticsConversionWeight',
    label: 'Importance de la conversion',
    type: 'number',
    step: 0.01,
    help: 'Poids du taux de conversion (commandes / vues) dans le score produit.'
  },
  {
    key: 'analyticsRevenueWeight',
    label: 'Importance du revenu',
    type: 'number',
    step: 0.001,
    help: 'Poids du revenu genere par le produit dans le score final.'
  },
  { key: 'analyticsRefundPenalty', label: 'Pénalité score litige', type: 'number', step: 0.1 },
  { key: 'disputeWindowHours', label: 'Fenetre litige (heures)', type: 'number', step: 1 },
  { key: 'deliveryOTPExpirationMinutes', label: 'Expiration OTP livraison (min)', type: 'number', step: 1 },
  { key: 'maxDisputesPerMonth', label: 'Max litiges / mois', type: 'number', step: 1 },
  { key: 'maxUploadImages', label: 'Max images upload', type: 'number', step: 1 }
];

const FEE_RUNTIME_KEY_MAP = {
  commissionRate: 'commission_rate',
  boostEnabled: 'enable_boost',
  installmentMinPercent: 'installmentMinPercent',
  installmentMaxDuration: 'installmentMaxDuration',
  shopConversionAmount: 'shopConversionAmount',
  analyticsViewWeight: 'analyticsViewWeight',
  analyticsConversionWeight: 'analyticsConversionWeight',
  analyticsRevenueWeight: 'analyticsRevenueWeight',
  analyticsRefundPenalty: 'analyticsRefundPenalty',
  disputeWindowHours: 'dispute_window_hours',
  deliveryOTPExpirationMinutes: 'otp_expiration_minutes',
  maxDisputesPerMonth: 'dispute_client_monthly_limit',
  maxUploadImages: 'max_image_upload'
};

const RUNTIME_FEE_KEY_MAP = Object.entries(FEE_RUNTIME_KEY_MAP).reduce((acc, [feeKey, runtimeKey]) => {
  acc[runtimeKey] = feeKey;
  return acc;
}, {});

const NOTIFICATION_RUNTIME_FLAGS = [
  {
    key: 'push_enabled',
    label: 'Push notifications globales',
    fallbackDescription: 'Active ou coupe l’envoi push côté plateforme.'
  },
  {
    key: 'push_when_online',
    label: 'Push quand utilisateur en ligne',
    fallbackDescription: 'Envoie aussi un push même si l’utilisateur est connecté dans l’app.'
  },
  {
    key: 'push_for_priority_high_only',
    label: 'Push HIGH/CRITICAL uniquement',
    fallbackDescription: 'Réduit le volume push en limitant aux priorités élevées.'
  }
];

const emptyCurrencyForm = {
  code: '',
  symbol: '',
  name: '',
  decimals: 0,
  exchangeRateToDefault: 1,
  isDefault: false,
  isActive: true
};

const emptyCityForm = {
  name: '',
  isActive: true,
  isDefault: false,
  deliveryAvailable: true,
  boostMultiplier: 1
};

const emptyCommuneForm = {
  name: '',
  cityId: '',
  deliveryPolicy: 'DEFAULT_RULE',
  fixedFee: 0,
  isActive: true,
  order: 0
};

const buildEmptyLanguage = () => ({
  code: '',
  name: '',
  isActive: true
});

const normalizeLabel = (value) => String(value || '').trim().toLowerCase();

const sortCities = (list = []) =>
  [...list].sort((a, b) => {
    const defaultDelta = Number(Boolean(b?.isDefault)) - Number(Boolean(a?.isDefault));
    if (defaultDelta !== 0) return defaultDelta;
    const orderDelta = Number(a?.order || 0) - Number(b?.order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
  });

const sortCommunes = (list = []) =>
  [...list].sort((a, b) => {
    const orderDelta = Number(a?.order || 0) - Number(b?.order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
  });

const parseBooleanSetting = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return false;
};

const parseNumberSetting = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLanguagesPayload = (languages = []) =>
  (languages || []).map((item) => ({
    code: String(item?.code || '').trim().toLowerCase(),
    name: String(item?.name || '').trim(),
    isActive: item?.isActive !== false
  }));

const serializeLanguagesConfig = (languages = [], defaultLanguage = '') =>
  JSON.stringify({
    defaultLanguage: String(defaultLanguage || '').trim().toLowerCase(),
    languages: normalizeLanguagesPayload(languages)
      .sort((a, b) => a.code.localeCompare(b.code, 'fr', { sensitivity: 'base' }))
  });

const normalizeFeesPayload = (payload = {}) =>
  FEE_FIELDS.reduce((acc, field) => {
    const rawValue = payload?.[field.key];
    acc[field.key] = field.type === 'boolean' ? parseBooleanSetting(rawValue) : parseNumberSetting(rawValue);
    return acc;
  }, {});

const resolveFeeValueFromRuntime = (feeKey, runtimeItems = [], fallbackValue = undefined) => {
  const runtimeKey = FEE_RUNTIME_KEY_MAP[feeKey] || feeKey;
  const candidates = [runtimeKey, feeKey];
  const runtimeMatch = (runtimeItems || []).find((item) =>
    candidates.includes(String(item?.key || ''))
  );
  if (!runtimeMatch) return fallbackValue;
  const raw = runtimeMatch?.value;
  const field = FEE_FIELDS.find((entry) => entry.key === feeKey);
  if (!field) return raw;
  return field.type === 'boolean' ? parseBooleanSetting(raw) : parseNumberSetting(raw);
};

const resolveCityName = (cityId, sourceCities = []) => {
  const normalizedId = String(cityId || '').trim();
  if (!normalizedId) return '';
  const match = (sourceCities || []).find((city) => String(city?._id || '') === normalizedId);
  return match?.name || '';
};

const normalizeCommuneWithCities = (commune, sourceCities = []) => {
  const rawCity = commune?.cityId;
  const normalizedCityId = String(rawCity?._id || rawCity || '').trim();
  const cityName = rawCity?.name || commune?.cityName || resolveCityName(normalizedCityId, sourceCities) || '';
  return {
    ...commune,
    cityId: normalizedCityId,
    cityName
  };
};

const CollapsibleBody = ({ open, children }) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
      open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="overflow-hidden">{children}</div>
  </div>
);

export default function AdminSystemSettings() {
  const { showToast } = useToast();
  const { user } = useContext(AuthContext);
  const isMobile = useIsMobile();
  const isFounder = user?.role === 'founder';
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState({});
  const [initialFees, setInitialFees] = useState({});
  const [savingFeeKey, setSavingFeeKey] = useState('');
  const [savingAllFees, setSavingAllFees] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [currencyForm, setCurrencyForm] = useState(emptyCurrencyForm);
  const [creatingCurrency, setCreatingCurrency] = useState(false);
  const [cities, setCities] = useState([]);
  const [cityForm, setCityForm] = useState(emptyCityForm);
  const [creatingCity, setCreatingCity] = useState(false);
  const [communes, setCommunes] = useState([]);
  const [communeForm, setCommuneForm] = useState(emptyCommuneForm);
  const [creatingCommune, setCreatingCommune] = useState(false);
  const [editingCommuneId, setEditingCommuneId] = useState('');
  const [editingCommuneDraft, setEditingCommuneDraft] = useState({
    cityId: '',
    deliveryPolicy: 'DEFAULT_RULE',
    fixedFee: 0
  });
  const [savingCommuneEdit, setSavingCommuneEdit] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState('fr');
  const [initialLanguagesSignature, setInitialLanguagesSignature] = useState('');
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [currencyRateDrafts, setCurrencyRateDrafts] = useState({});
  const [savingCurrencyCode, setSavingCurrencyCode] = useState('');
  const [deletingCityId, setDeletingCityId] = useState('');
  const [deletingCommuneId, setDeletingCommuneId] = useState('');
  const [runtimeSettings, setRuntimeSettings] = useState([]);
  const [runtimeDrafts, setRuntimeDrafts] = useState({});
  const [runtimeSavingKey, setRuntimeSavingKey] = useState('');
  const [runtimeEnvironment, setRuntimeEnvironment] = useState('');
  const [featureFlags, setFeatureFlags] = useState([]);
  const [featureSavingName, setFeatureSavingName] = useState('');
  const [openSections, setOpenSections] = useState({
    fees: true,
    runtime: false,
    flags: false,
    languages: false,
    currencies: false,
    cities: false,
    communes: false
  });

  const toggleSection = useCallback(
    (sectionKey) => {
      if (!isMobile) return;
      setOpenSections((prev) => ({
        ...prev,
        [sectionKey]: !prev[sectionKey]
      }));
    },
    [isMobile]
  );

  const isSectionOpen = useCallback(
    (sectionKey) => (isMobile ? Boolean(openSections[sectionKey]) : true),
    [isMobile, openSections]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResponse, runtimeResponse, featureFlagsResponse] = await Promise.all([
        api.get('/admin/settings'),
        api
          .get('/admin/config/runtime', {
            params: {
              includeHidden: isFounder ? 'true' : 'false'
            }
          })
          .catch(() => ({ data: { items: [] } })),
        api.get('/admin/config/feature-flags').catch(() => ({ data: { items: [] } }))
      ]);
      const data = settingsResponse?.data || {};
      const feeSource = data?.feesAndRules || data?.app || data?.fees || {};
      const runtimeItems = Array.isArray(runtimeResponse?.data?.items) ? runtimeResponse.data.items : [];
      const nextFees = normalizeFeesPayload(feeSource);
      const mergedFees = Object.keys(nextFees).reduce((acc, key) => {
        acc[key] = resolveFeeValueFromRuntime(key, runtimeItems, nextFees[key]);
        return acc;
      }, {});
      setFees(mergedFees);
      setInitialFees(mergedFees);
      setCurrencies(Array.isArray(data?.currencies) ? data.currencies : []);
      const nextCities = sortCities(Array.isArray(data?.cities) ? data.cities : []);
      const nextCommunesRaw = Array.isArray(data?.communes) ? data.communes : [];
      const nextCommunes = sortCommunes(
        nextCommunesRaw.map((commune) => normalizeCommuneWithCities(commune, nextCities))
      );
      setCities(nextCities);
      setCommunes(nextCommunes);
      const langs = Array.isArray(data?.languages?.languages) ? data.languages.languages : [];
      const resolvedDefaultLanguage = data?.languages?.defaultLanguage || langs[0]?.code || 'fr';
      setLanguages(langs);
      setDefaultLanguage(resolvedDefaultLanguage);
      setInitialLanguagesSignature(serializeLanguagesConfig(langs, resolvedDefaultLanguage));

      setRuntimeSettings(runtimeItems);
      setRuntimeEnvironment(String(runtimeResponse?.data?.environment || '').trim().toLowerCase() || 'all');
      setRuntimeDrafts(
        runtimeItems.reduce((acc, item) => {
          if (item?.valueType === 'array' || item?.valueType === 'json') {
            acc[item.key] = JSON.stringify(item.value ?? (item.valueType === 'array' ? [] : {}), null, 2);
          } else {
            acc[item.key] = item.value;
          }
          return acc;
        }, {})
      );

      const featureItems = Array.isArray(featureFlagsResponse?.data?.items)
        ? featureFlagsResponse.data.items
        : [];
      setFeatureFlags(featureItems);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur chargement des parametres.', {
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, isFounder]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const nextDrafts = {};
    currencies.forEach((currency) => {
      nextDrafts[currency.code] = String(currency.exchangeRateToDefault ?? 1);
    });
    setCurrencyRateDrafts(nextDrafts);
  }, [currencies]);

  useEffect(() => {
    const activeCodes = languages
      .filter((item) => item.isActive !== false)
      .map((item) => String(item.code || '').toLowerCase())
      .filter(Boolean);
    if (!activeCodes.length) return;
    const current = String(defaultLanguage || '').toLowerCase();
    if (!activeCodes.includes(current)) {
      setDefaultLanguage(activeCodes[0]);
    }
  }, [languages, defaultLanguage]);

  const saveFee = async (key) => {
    setSavingFeeKey(key);
    try {
      await api.patch(`/admin/settings/${key}`, { value: fees[key] });
      const mappedRuntimeKey = FEE_RUNTIME_KEY_MAP[key] || key;
      const possibleRuntimeKeys = [mappedRuntimeKey, key];
      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          possibleRuntimeKeys.includes(String(entry?.key || ''))
            ? { ...entry, value: fees[key], updatedAt: new Date().toISOString() }
            : entry
        )
      );
      setRuntimeDrafts((prev) => ({
        ...prev,
        ...possibleRuntimeKeys.reduce((acc, runtimeKey) => {
          if (Object.prototype.hasOwnProperty.call(prev, runtimeKey)) {
            acc[runtimeKey] = fees[key];
          }
          return acc;
        }, {})
      }));
      setInitialFees((prev) => ({
        ...prev,
        [key]: fees[key]
      }));
      showToast('Parametre enregistre.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement parametre.', { variant: 'error' });
    } finally {
      setSavingFeeKey('');
    }
  };

  const runtimeSettingsByCategory = useMemo(() => {
    return (runtimeSettings || []).reduce((acc, item) => {
      const category = String(item?.category || 'general');
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});
  }, [runtimeSettings]);
  const notificationRuntimeQuickFlags = useMemo(() => {
    const byKey = new Map((runtimeSettings || []).map((item) => [String(item?.key || ''), item]));
    return NOTIFICATION_RUNTIME_FLAGS.map((entry) => ({
      ...entry,
      setting: byKey.get(entry.key) || null
    }));
  }, [runtimeSettings]);

  const dirtyFeeKeys = useMemo(
    () =>
      FEE_FIELDS.map((field) => field.key).filter((key) => {
        const current = fees[key];
        const initial = initialFees[key];
        return FEE_FIELDS.find((field) => field.key === key)?.type === 'boolean'
          ? Boolean(current) !== Boolean(initial)
          : Number(current ?? 0) !== Number(initial ?? 0);
      }),
    [fees, initialFees]
  );
  const hasDirtyFees = dirtyFeeKeys.length > 0;

  const languagesSignature = useMemo(
    () => serializeLanguagesConfig(languages, defaultLanguage),
    [languages, defaultLanguage]
  );
  const hasDirtyLanguages = Boolean(
    initialLanguagesSignature && languagesSignature !== initialLanguagesSignature
  );

  const saveAllFees = useCallback(async () => {
    if (!dirtyFeeKeys.length) {
      showToast('Aucune modification à enregistrer.', { variant: 'info' });
      return;
    }
    setSavingAllFees(true);
    try {
      for (const key of dirtyFeeKeys) {
        // same endpoint as per-field save, batched for mobile quick action
        // eslint-disable-next-line no-await-in-loop
        await api.patch(`/admin/settings/${key}`, { value: fees[key] });
      }

      const dirtySet = new Set(dirtyFeeKeys);
      const runtimeUpdateMap = dirtyFeeKeys.reduce((acc, feeKey) => {
        const runtimeKey = FEE_RUNTIME_KEY_MAP[feeKey] || feeKey;
        acc[runtimeKey] = fees[feeKey];
        acc[feeKey] = fees[feeKey];
        return acc;
      }, {});

      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          dirtySet.has(String(entry?.key || '')) || Object.prototype.hasOwnProperty.call(runtimeUpdateMap, String(entry?.key || ''))
            ? {
                ...entry,
                value: runtimeUpdateMap[String(entry?.key || '')],
                updatedAt: new Date().toISOString()
              }
            : entry
        )
      );

      setRuntimeDrafts((prev) => {
        const next = { ...prev };
        Object.entries(runtimeUpdateMap).forEach(([runtimeKey, value]) => {
          if (Object.prototype.hasOwnProperty.call(next, runtimeKey)) {
            next[runtimeKey] = value;
          }
        });
        return next;
      });

      setInitialFees((prev) => ({
        ...prev,
        ...dirtyFeeKeys.reduce((acc, key) => {
          acc[key] = fees[key];
          return acc;
        }, {})
      }));

      showToast('Paramètres de frais enregistrés.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement des frais.', {
        variant: 'error'
      });
    } finally {
      setSavingAllFees(false);
    }
  }, [dirtyFeeKeys, fees, showToast]);

  const saveRuntimeSetting = async (setting) => {
    const key = String(setting?.key || '');
    if (!key) return;
    let value = runtimeDrafts[key];
    if (setting?.valueType === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        showToast('Valeur invalide pour ce paramètre numérique.', { variant: 'error' });
        return;
      }
      value = parsed;
    } else if (setting?.valueType === 'boolean') {
      value = Boolean(value);
    } else if (setting?.valueType === 'array' || setting?.valueType === 'json') {
      try {
        const fallbackJson = setting?.valueType === 'array' ? '[]' : '{}';
        const rawJson = String(value ?? fallbackJson);
        value = JSON.parse(rawJson || fallbackJson);
      } catch {
        showToast('JSON invalide pour ce paramètre.', { variant: 'error' });
        return;
      }
    } else {
      value = String(value ?? '');
    }

    setRuntimeSavingKey(key);
    try {
      const payload = { value };
      if (runtimeEnvironment) payload.environment = runtimeEnvironment;
      const { data } = await api.patch(`/admin/config/runtime/${encodeURIComponent(key)}`, payload);
      const updatedValue = data?.item?.value ?? value;
      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          String(entry?.key) === key
            ? {
                ...entry,
                value: updatedValue,
                updatedAt: new Date().toISOString()
              }
            : entry
        )
      );
      setRuntimeDrafts((prev) => ({
        ...prev,
        [key]:
          setting?.valueType === 'array' || setting?.valueType === 'json'
            ? JSON.stringify(updatedValue, null, 2)
            : updatedValue
      }));
      const linkedFeeKey = RUNTIME_FEE_KEY_MAP[key] || (FEE_RUNTIME_KEY_MAP[key] ? key : '');
      if (linkedFeeKey && FEE_FIELDS.some((field) => field.key === linkedFeeKey)) {
        const feeField = FEE_FIELDS.find((field) => field.key === linkedFeeKey);
        const normalizedFeeValue =
          feeField?.type === 'boolean'
            ? parseBooleanSetting(updatedValue)
            : parseNumberSetting(updatedValue);
        setFees((prev) => ({
          ...prev,
          [linkedFeeKey]: normalizedFeeValue
        }));
        setInitialFees((prev) => ({
          ...prev,
          [linkedFeeKey]: normalizedFeeValue
        }));
      }
      showToast('Configuration enregistrée.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise à jour configuration.', {
        variant: 'error'
      });
    } finally {
      setRuntimeSavingKey('');
    }
  };

  const patchFeatureFlag = async (featureName, patch) => {
    const name = String(featureName || '');
    if (!name) return;
    const previous = featureFlags;
    setFeatureFlags((prev) =>
      prev.map((entry) => (String(entry?.featureName) === name ? { ...entry, ...patch } : entry))
    );
    setFeatureSavingName(name);
    try {
      const payload = { ...patch };
      if (runtimeEnvironment) payload.environment = runtimeEnvironment;
      const { data } = await api.patch(`/admin/config/feature-flags/${encodeURIComponent(name)}`, payload);
      const updated = data?.item || {};
      setFeatureFlags((prev) =>
        prev.map((entry) => (String(entry?.featureName) === name ? { ...entry, ...updated } : entry))
      );
      showToast('Feature flag mise à jour.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      setFeatureFlags(previous);
      showToast(error.response?.data?.message || 'Erreur mise à jour feature flag.', {
        variant: 'error'
      });
    } finally {
      setFeatureSavingName('');
    }
  };

  const createCurrency = async (e) => {
    e.preventDefault();
    setCreatingCurrency(true);
    try {
      await api.post('/admin/currencies', currencyForm);
      showToast('Devise creee.', { variant: 'success' });
      setCurrencyForm(emptyCurrencyForm);
      await loadSettings();
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur creation devise.', { variant: 'error' });
    } finally {
      setCreatingCurrency(false);
    }
  };

  const patchCurrency = async (code, patch) => {
    try {
      await api.patch(`/admin/currencies/${code}`, patch);
      await loadSettings();
      emitSettingsRefresh();
      return true;
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise a jour devise.', { variant: 'error' });
      return false;
    }
  };

  const updateCurrencyRateDraft = (code, value) => {
    setCurrencyRateDrafts((prev) => ({
      ...prev,
      [code]: value
    }));
  };

  const saveCurrencyRate = async (code) => {
    const parsedRate = Number(currencyRateDrafts[code]);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      showToast('Le taux doit etre un nombre positif.', { variant: 'error' });
      return;
    }
    setSavingCurrencyCode(code);
    const ok = await patchCurrency(code, { exchangeRateToDefault: parsedRate });
    if (ok) {
      showToast('Taux de change mis a jour.', { variant: 'success' });
    }
    setSavingCurrencyCode('');
  };

  const createCity = async (e) => {
    e.preventDefault();
    const trimmedName = String(cityForm.name || '').trim();
    if (!trimmedName) {
      showToast('Nom de ville requis.', { variant: 'error' });
      return;
    }
    if (cities.some((entry) => normalizeLabel(entry?.name) === normalizeLabel(trimmedName))) {
      showToast('Cette ville existe déjà.', { variant: 'error' });
      return;
    }

    setCreatingCity(true);
    const optimisticId = `tmp-city-${Date.now()}`;
    const optimisticCity = {
      _id: optimisticId,
      name: trimmedName,
      isActive: cityForm.isActive !== false,
      isDefault: Boolean(cityForm.isDefault),
      deliveryAvailable: cityForm.deliveryAvailable !== false,
      boostMultiplier: Number.isFinite(Number(cityForm.boostMultiplier))
        ? Number(cityForm.boostMultiplier)
        : 1,
      order: Number.isFinite(Number(cityForm.order)) ? Number(cityForm.order) : 0
    };
    setCities((prev) => sortCities([...prev, optimisticCity]));
    try {
      const { data } = await api.post('/admin/cities', { ...cityForm, name: trimmedName });
      const persistedCity = data || {};
      setCities((prev) =>
        sortCities(
          prev.map((entry) => {
            if (String(entry?._id) !== String(optimisticId)) return entry;
            return {
              ...entry,
              ...persistedCity
            };
          })
        )
      );
      showToast('Ville creee.', { variant: 'success' });
      setCityForm(emptyCityForm);
      emitSettingsRefresh();
    } catch (error) {
      setCities((prev) => prev.filter((entry) => String(entry?._id) !== String(optimisticId)));
      showToast(error.response?.data?.message || 'Erreur creation ville.', { variant: 'error' });
    } finally {
      setCreatingCity(false);
    }
  };

  const patchCity = async (cityId, patch) => {
    const cityIdStr = String(cityId || '');
    const previousCities = cities;
    setCities((prev) => {
      const next = prev.map((entry) => {
        if (String(entry?._id) !== cityIdStr) return entry;
        return { ...entry, ...patch };
      });
      if (patch?.isDefault === true) {
        return sortCities(
          next.map((entry) => ({ ...entry, isDefault: String(entry?._id) === cityIdStr }))
        );
      }
      return sortCities(next);
    });
    try {
      const { data } = await api.patch(`/admin/cities/${cityId}`, patch);
      setCities((prev) =>
        sortCities(
          prev.map((entry) => {
            if (String(entry?._id) !== cityIdStr) return patch?.isDefault === true ? { ...entry, isDefault: false } : entry;
            return {
              ...entry,
              ...(data || {}),
              ...(patch?.isDefault === true ? { isDefault: true } : {})
            };
          })
        )
      );
      emitSettingsRefresh();
    } catch (error) {
      setCities(previousCities);
      showToast(error.response?.data?.message || 'Erreur mise a jour ville.', { variant: 'error' });
    }
  };

  const deleteCity = async (city) => {
    const cityId = String(city?._id || '');
    if (!cityId) return;
    const linkedCommunes = communes.filter(
      (entry) => String(entry?.cityId || '') === cityId
    ).length;
    if (linkedCommunes > 0) {
      showToast('Supprimez d\'abord les communes rattachées à cette ville.', { variant: 'error' });
      return;
    }
    const accepted = window.confirm(`Supprimer la ville "${city?.name || ''}" ?`);
    if (!accepted) return;

    const previousCities = cities;
    setDeletingCityId(cityId);
    setCities((prev) => prev.filter((entry) => String(entry?._id || '') !== cityId));
    try {
      const { data } = await api.delete(`/admin/cities/${cityId}`);
      const replacementCityId = String(data?.replacementCity?._id || '');
      if (replacementCityId) {
        setCities((prev) =>
          sortCities(
            prev.map((entry) => ({
              ...entry,
              isDefault: String(entry?._id || '') === replacementCityId
            }))
          )
        );
      }
      if (communeForm.cityId === cityId) {
        const fallbackCityId = String(
          cities.find((entry) => String(entry?._id || '') !== cityId)?._id || ''
        );
        setCommuneForm((prev) => ({ ...prev, cityId: fallbackCityId }));
      }
      if (editingCommuneDraft.cityId === cityId) {
        setEditingCommuneDraft((prev) => ({ ...prev, cityId: '' }));
      }
      showToast('Ville supprimée.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      setCities(previousCities);
      showToast(error.response?.data?.message || 'Erreur suppression ville.', { variant: 'error' });
    } finally {
      setDeletingCityId('');
    }
  };

  const createCommune = async (event) => {
    event.preventDefault();
    if (!communeForm.cityId) {
      showToast('Selectionnez une ville pour la commune.', { variant: 'error' });
      return;
    }
    const trimmedName = String(communeForm.name || '').trim();
    if (!trimmedName) {
      showToast('Nom commune requis.', { variant: 'error' });
      return;
    }
    if (communeForm.deliveryPolicy === 'FIXED_FEE' && Number(communeForm.fixedFee || 0) < 0) {
      showToast('Le frais fixe doit etre superieur ou egal a 0.', { variant: 'error' });
      return;
    }
    const selectedCity = cities.find((city) => String(city?._id || '') === String(communeForm.cityId || ''));
    if (!selectedCity) {
      showToast('Ville invalide.', { variant: 'error' });
      return;
    }
    const duplicate = communes.some(
      (entry) =>
        String(entry?.cityId || '') === String(communeForm.cityId || '') &&
        normalizeLabel(entry?.name) === normalizeLabel(trimmedName)
    );
    if (duplicate) {
      showToast('Cette commune existe déjà pour cette ville.', { variant: 'error' });
      return;
    }
    setCreatingCommune(true);
    const optimisticId = `tmp-commune-${Date.now()}`;
    const optimisticCommune = normalizeCommuneWithCities(
      {
        _id: optimisticId,
        name: trimmedName,
        cityId: String(communeForm.cityId || ''),
        cityName: selectedCity.name || '',
        deliveryPolicy: communeForm.deliveryPolicy || 'DEFAULT_RULE',
        fixedFee:
          communeForm.deliveryPolicy === 'FIXED_FEE'
            ? Math.max(0, Number(communeForm.fixedFee || 0))
            : 0,
        isActive: communeForm.isActive !== false,
        order: Number.isFinite(Number(communeForm.order)) ? Number(communeForm.order) : 0
      },
      cities
    );
    setCommunes((prev) => sortCommunes([...prev, optimisticCommune]));
    try {
      const { data } = await api.post('/admin/communes', {
        ...communeForm,
        name: trimmedName,
        fixedFee: Number(communeForm.fixedFee || 0),
        order: Number(communeForm.order || 0)
      });
      setCommunes((prev) =>
        sortCommunes(
          prev.map((entry) => {
            if (String(entry?._id) !== String(optimisticId)) return entry;
            return normalizeCommuneWithCities({ ...entry, ...(data || {}) }, cities);
          })
        )
      );
      showToast('Commune creee.', { variant: 'success' });
      setCommuneForm((prev) => ({ ...emptyCommuneForm, cityId: prev.cityId || '' }));
      emitSettingsRefresh();
    } catch (error) {
      setCommunes((prev) => prev.filter((entry) => String(entry?._id) !== String(optimisticId)));
      showToast(error.response?.data?.message || 'Erreur creation commune.', { variant: 'error' });
    } finally {
      setCreatingCommune(false);
    }
  };

  const patchCommune = async (communeId, patch) => {
    const communeIdStr = String(communeId || '');
    const previousCommunes = communes;
    setCommunes((prev) =>
      sortCommunes(
        prev.map((entry) => {
          if (String(entry?._id) !== communeIdStr) return entry;
          return normalizeCommuneWithCities({ ...entry, ...patch }, cities);
        })
      )
    );
    try {
      const { data } = await api.patch(`/admin/communes/${communeId}`, patch);
      setCommunes((prev) =>
        sortCommunes(
          prev.map((entry) => {
            if (String(entry?._id) !== communeIdStr) return entry;
            return normalizeCommuneWithCities({ ...entry, ...(data || {}) }, cities);
          })
        )
      );
      emitSettingsRefresh();
    } catch (error) {
      setCommunes(previousCommunes);
      showToast(error.response?.data?.message || 'Erreur mise a jour commune.', { variant: 'error' });
    }
  };

  const deleteCommune = async (commune) => {
    const communeId = String(commune?._id || '');
    if (!communeId) return;
    const accepted = window.confirm(`Supprimer la commune "${commune?.name || ''}" ?`);
    if (!accepted) return;

    const previousCommunes = communes;
    setDeletingCommuneId(communeId);
    setCommunes((prev) => prev.filter((entry) => String(entry?._id || '') !== communeId));
    if (editingCommuneId === communeId) {
      cancelCommuneEdit();
    }
    try {
      await api.delete(`/admin/communes/${communeId}`);
      showToast('Commune supprimée.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      setCommunes(previousCommunes);
      showToast(error.response?.data?.message || 'Erreur suppression commune.', { variant: 'error' });
    } finally {
      setDeletingCommuneId('');
    }
  };

  const startCommuneEdit = (commune) => {
    setEditingCommuneId(String(commune?._id || ''));
    setEditingCommuneDraft({
      cityId: String(commune?.cityId?._id || commune?.cityId || ''),
      deliveryPolicy: String(commune?.deliveryPolicy || 'DEFAULT_RULE'),
      fixedFee: Number(commune?.fixedFee || 0)
    });
  };

  const cancelCommuneEdit = () => {
    setEditingCommuneId('');
    setEditingCommuneDraft({
      cityId: '',
      deliveryPolicy: 'DEFAULT_RULE',
      fixedFee: 0
    });
    setSavingCommuneEdit(false);
  };

  const saveCommuneEdit = async () => {
    if (!editingCommuneId) return;
    const nextPolicy = String(editingCommuneDraft.deliveryPolicy || 'DEFAULT_RULE');
    const nextFee = Number(editingCommuneDraft.fixedFee || 0);
    const nextCityId = String(editingCommuneDraft.cityId || '').trim();
    if (!nextCityId) {
      showToast('Selectionnez une ville.', { variant: 'error' });
      return;
    }
    if (nextPolicy === 'FIXED_FEE' && (!Number.isFinite(nextFee) || nextFee < 0)) {
      showToast('Le frais fixe doit etre superieur ou egal a 0.', { variant: 'error' });
      return;
    }
    const previousCommunes = communes;
    setCommunes((prev) =>
      sortCommunes(
        prev.map((entry) => {
          if (String(entry?._id) !== String(editingCommuneId)) return entry;
          return normalizeCommuneWithCities(
            {
              ...entry,
              cityId: nextCityId,
              deliveryPolicy: nextPolicy,
              fixedFee: nextPolicy === 'FIXED_FEE' ? Math.max(0, nextFee) : 0
            },
            cities
          );
        })
      )
    );
    setSavingCommuneEdit(true);
    try {
      const { data } = await api.patch(`/admin/communes/${editingCommuneId}`, {
        cityId: nextCityId,
        deliveryPolicy: nextPolicy,
        fixedFee: nextPolicy === 'FIXED_FEE' ? Math.max(0, nextFee) : 0
      });
      setCommunes((prev) =>
        sortCommunes(
          prev.map((entry) => {
            if (String(entry?._id) !== String(editingCommuneId)) return entry;
            return normalizeCommuneWithCities({ ...entry, ...(data || {}) }, cities);
          })
        )
      );
      showToast('Commune mise a jour.', { variant: 'success' });
      emitSettingsRefresh();
      cancelCommuneEdit();
    } catch (error) {
      setCommunes(previousCommunes);
      showToast(error.response?.data?.message || 'Erreur mise a jour commune.', { variant: 'error' });
    } finally {
      setSavingCommuneEdit(false);
    }
  };

  const saveLanguages = async () => {
    const normalized = languages.map((item) => ({
      code: String(item.code || '').trim().toLowerCase(),
      name: String(item.name || '').trim(),
      isActive: item.isActive !== false
    }));

    const emptyCode = normalized.find((item) => !item.code);
    if (emptyCode) {
      showToast('Chaque langue doit avoir un code.', { variant: 'error' });
      return;
    }

    const emptyName = normalized.find((item) => !item.name);
    if (emptyName) {
      showToast('Chaque langue doit avoir un nom.', { variant: 'error' });
      return;
    }

    const codeSet = new Set();
    for (const lang of normalized) {
      if (codeSet.has(lang.code)) {
        showToast(`Code duplique: ${lang.code}`, { variant: 'error' });
        return;
      }
      codeSet.add(lang.code);
    }

    const activeCodes = normalized.filter((item) => item.isActive).map((item) => item.code);
    if (!activeCodes.length) {
      showToast('Au moins une langue doit rester active.', { variant: 'error' });
      return;
    }

    const safeDefault = activeCodes.includes(defaultLanguage) ? defaultLanguage : activeCodes[0];

    setSavingLanguages(true);
    try {
      await api.patch('/admin/languages', {
        languages: normalized,
        defaultLanguage: safeDefault
      });
      showToast('Langues enregistrees.', { variant: 'success' });
      await loadSettings();
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement langues.', { variant: 'error' });
    } finally {
      setSavingLanguages(false);
    }
  };

  const isQuickSaveBusy = savingAllFees || savingLanguages;
  const canQuickSave = hasDirtyFees || hasDirtyLanguages;

  const handleQuickSave = useCallback(async () => {
    if (isQuickSaveBusy) return;
    if (!canQuickSave) {
      showToast('Aucune modification à enregistrer.', { variant: 'info' });
      return;
    }
    if (hasDirtyFees) {
      await saveAllFees();
    }
    if (hasDirtyLanguages) {
      await saveLanguages();
    }
  }, [
    canQuickSave,
    hasDirtyFees,
    hasDirtyLanguages,
    isQuickSaveBusy,
    saveAllFees,
    saveLanguages,
    showToast
  ]);
  const quickSaveCount = dirtyFeeKeys.length + (hasDirtyLanguages ? 1 : 0);
  const quickSaveLabel = hasDirtyFees && hasDirtyLanguages
    ? 'Enregistrer frais + langues'
    : hasDirtyFees
      ? 'Enregistrer les frais'
      : hasDirtyLanguages
        ? 'Enregistrer les langues'
        : 'Enregistrer';

  const addLanguage = () => {
    setLanguages((prev) => [...prev, buildEmptyLanguage()]);
  };

  const updateLanguage = (index, patch) => {
    setLanguages((prev) =>
      prev.map((lang, langIndex) => {
        if (langIndex !== index) return lang;
        const next = { ...lang, ...patch };
        if (typeof next.code === 'string') {
          next.code = next.code.toLowerCase().replace(/\s+/g, '');
        }
        return next;
      })
    );
  };

  const removeLanguage = (index) => {
    setLanguages((prev) => {
      if (prev.length <= 1) {
        showToast('Vous devez garder au moins une langue.', { variant: 'error' });
        return prev;
      }
      const removed = prev[index];
      const next = prev.filter((_, langIndex) => langIndex !== index);
      const nextActiveCodes = next
        .filter((item) => item.isActive !== false)
        .map((item) => String(item.code || '').toLowerCase());
      if (!nextActiveCodes.length) {
        showToast('Vous devez garder au moins une langue active.', { variant: 'error' });
        return prev;
      }
      if (String(removed?.code || '').toLowerCase() === String(defaultLanguage || '').toLowerCase()) {
        setDefaultLanguage(nextActiveCodes[0]);
      }
      return next;
    });
  };

  useEffect(() => {
    if (communeForm.cityId) return;
    if (!cities.length) return;
    setCommuneForm((prev) => ({ ...prev, cityId: String(cities[0]._id || '') }));
  }, [cities, communeForm.cityId]);

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 dark:bg-neutral-950 dark:text-neutral-50 ${isMobile ? 'pb-24' : ''}`}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
          <Link
            to="/admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">Paramètres système</h1>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
              Configuration dynamique admin
            </p>
          </div>
        </div>
        {isMobile ? (
          <div className="border-t border-slate-100 px-3 py-2 dark:border-neutral-800">
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-2">
                {[
                  ['fees', 'Frais'],
                  ['runtime', 'Runtime'],
                  ['flags', 'Flags'],
                  ['languages', 'Langues'],
                  ['currencies', 'Devises'],
                  ['cities', 'Villes'],
                  ['communes', 'Communes']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSection(key)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${
                      isSectionOpen(key)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6 lg:grid-cols-2">
        <section
          id="fees"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4"
        >
          <button
            type="button"
            onClick={() => toggleSection('fees')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
            <Globe2 size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Fees & Rules</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('fees') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>
          <CollapsibleBody open={isSectionOpen('fees')}>
            {loading ? (
              <p className="text-sm text-gray-500">Chargement...</p>
            ) : (
              <div className="space-y-2.5">
                {FEE_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/40"
                  >
                    <div className="mb-2">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{field.label}</span>
                        {field.help ? (
                          <span
                            title={field.help}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                            aria-label={field.help}
                          >
                            <CircleHelp size={12} />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-neutral-500">
                        source key:{' '}
                        <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-300">
                          {FEE_RUNTIME_KEY_MAP[field.key] || field.key}
                        </code>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {field.type === 'boolean' ? (
                        <select
                          value={fees[field.key] ? 'true' : 'false'}
                          onChange={(e) => setFees((prev) => ({ ...prev, [field.key]: e.target.value === 'true' }))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        >
                          <option value="true">Oui</option>
                          <option value="false">Non</option>
                        </select>
                      ) : (
                        <input
                          type="number"
                          step={field.step || 1}
                          value={fees[field.key] ?? 0}
                          onChange={(e) =>
                            setFees((prev) => ({
                              ...prev,
                              [field.key]: Number(e.target.value || 0)
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => saveFee(field.key)}
                        disabled={savingFeeKey === field.key}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200 sm:min-h-9"
                      >
                        <Save size={14} />
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleBody>
        </section>

        <section
          id="runtime"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4 lg:col-span-2"
        >
          <button
            type="button"
            onClick={() => toggleSection('runtime')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Globe2 size={16} />
              <h2 className="truncate text-sm font-semibold sm:text-base">Configuration Runtime (SaaS)</h2>
            </div>
            <div className="flex items-center gap-2">
              {!isMobile ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  Environnement: {runtimeEnvironment || 'auto'}
                </span>
              ) : null}
              {isMobile ? (
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-300 ${isSectionOpen('runtime') ? 'rotate-180' : ''}`}
                />
              ) : null}
            </div>
          </button>
          <CollapsibleBody open={isSectionOpen('runtime')}>
            {!runtimeSettings.length ? (
              <p className="text-sm text-gray-500">Aucun paramètre runtime trouvé.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    Notifications Push
                  </p>
                  <p className="mb-3 text-xs text-indigo-700/90 dark:text-indigo-200/90">
                    Activation rapide des flags runtime pour l’orchestration socket/push.
                  </p>
                  <div className="space-y-2.5">
                    {notificationRuntimeQuickFlags.map((entry) => {
                      const setting = entry.setting;
                      const key = entry.key;
                      const isSaving = runtimeSavingKey === key;
                      const currentValue = parseBooleanSetting(
                        runtimeDrafts[key] ?? setting?.value ?? false
                      );
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-indigo-100 bg-white/70 p-2.5 dark:border-indigo-900/70 dark:bg-neutral-950/40"
                        >
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-neutral-100">{entry.label}</p>
                            <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                              {setting?.description || entry.fallbackDescription}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400 dark:text-neutral-500">
                              key: <code className="rounded bg-white px-1 py-0.5 dark:bg-neutral-900">{key}</code>
                            </p>
                          </div>
                          {setting ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={currentValue ? 'true' : 'false'}
                                onChange={(event) =>
                                  setRuntimeDrafts((prev) => ({
                                    ...prev,
                                    [key]: event.target.value === 'true'
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                              >
                                <option value="true">Activé</option>
                                <option value="false">Désactivé</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => saveRuntimeSetting(setting)}
                                disabled={isSaving}
                                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200 sm:min-h-9"
                              >
                                <Save size={12} />
                                {isSaving ? '...' : 'Enregistrer'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-red-600 dark:text-red-300">
                              Clé runtime introuvable côté API.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {Object.entries(runtimeSettingsByCategory).map(([category, items]) => (
                  <div key={category} className="rounded-xl border border-gray-200 p-3 dark:border-neutral-700">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      {category.replace(/_/g, ' ')}
                    </p>
                    <div className="space-y-3">
                      {(items || []).map((item) => {
                        const key = String(item?.key || '');
                        const draftValue = runtimeDrafts[key];
                        const isSaving = runtimeSavingKey === key;

                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/40"
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-gray-900 dark:text-neutral-100">{key}</p>
                                <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                  {item?.description || 'Sans description'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {item?.isPublic ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                                    public
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:bg-neutral-800 dark:text-neutral-300">
                                  {item?.valueType || typeof item?.value}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              {item?.valueType === 'boolean' ? (
                                <select
                                  value={draftValue ? 'true' : 'false'}
                                  onChange={(event) =>
                                    setRuntimeDrafts((prev) => ({
                                      ...prev,
                                      [key]: event.target.value === 'true'
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : Array.isArray(item?.allowedValues) && item.allowedValues.length > 0 ? (
                                <select
                                  value={String(draftValue ?? '')}
                                  onChange={(event) =>
                                    setRuntimeDrafts((prev) => ({
                                      ...prev,
                                      [key]: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                >
                                  {item.allowedValues.map((allowedValue) => (
                                    <option key={String(allowedValue)} value={String(allowedValue)}>
                                      {String(allowedValue)}
                                    </option>
                                  ))}
                                </select>
                              ) : item?.valueType === 'number' ? (
                                <input
                                  type="number"
                                  min={Number.isFinite(Number(item?.min)) ? Number(item.min) : undefined}
                                  max={Number.isFinite(Number(item?.max)) ? Number(item.max) : undefined}
                                  value={draftValue ?? 0}
                                  onChange={(event) =>
                                    setRuntimeDrafts((prev) => ({
                                      ...prev,
                                      [key]: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                />
                              ) : item?.valueType === 'array' || item?.valueType === 'json' ? (
                                <textarea
                                  value={String(draftValue || '')}
                                  onChange={(event) =>
                                    setRuntimeDrafts((prev) => ({
                                      ...prev,
                                      [key]: event.target.value
                                    }))
                                  }
                                  rows={3}
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={String(draftValue ?? '')}
                                  onChange={(event) =>
                                    setRuntimeDrafts((prev) => ({
                                      ...prev,
                                      [key]: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => saveRuntimeSetting(item)}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                              >
                                <Save size={12} />
                                {isSaving ? '...' : 'Enregistrer'}
                              </button>
                            </div>
                            {(Array.isArray(item?.allowedValues) && item.allowedValues.length > 0) ||
                            Number.isFinite(Number(item?.min)) ||
                            Number.isFinite(Number(item?.max)) ? (
                              <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                                {Array.isArray(item?.allowedValues) && item.allowedValues.length > 0
                                  ? `Valeurs autorisées: ${item.allowedValues.join(', ')}`
                                  : `Bornes: ${
                                      Number.isFinite(Number(item?.min)) ? `min ${Number(item.min)}` : ''
                                    }${
                                      Number.isFinite(Number(item?.min)) && Number.isFinite(Number(item?.max))
                                        ? ' · '
                                        : ''
                                    }${
                                      Number.isFinite(Number(item?.max)) ? `max ${Number(item.max)}` : ''
                                    }`}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleBody>
        </section>

        <section
          id="flags"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4 lg:col-span-2"
        >
          <button
            type="button"
            onClick={() => toggleSection('flags')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Globe2 size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Feature Flags</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('flags') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>

          <CollapsibleBody open={isSectionOpen('flags')}>
            {!featureFlags.length ? (
              <p className="text-sm text-gray-500">Aucune feature flag configurée.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {featureFlags.map((flag) => {
                  const featureName = String(flag?.featureName || '');
                  const saving = featureSavingName === featureName;
                  const rolesAllowed = Array.isArray(flag?.rolesAllowed) ? flag.rolesAllowed : [];
                  return (
                    <div
                      key={featureName}
                      className="rounded-xl border border-gray-200 p-3 text-sm dark:border-neutral-700"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-semibold">{featureName}</p>
                        <span className="text-xs text-gray-500">{flag?.environment || 'all'}</span>
                      </div>
                      <p className="mb-3 text-xs text-gray-500 dark:text-neutral-400">
                        {flag?.description || 'Sans description'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            patchFeatureFlag(featureName, {
                              enabled: !flag?.enabled,
                              rolloutPercentage: Number(flag?.rolloutPercentage ?? 100),
                              rolesAllowed
                            })
                          }
                          disabled={saving}
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            flag?.enabled
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          {flag?.enabled ? 'Enabled' : 'Disabled'}
                        </button>

                        <label className="text-xs text-gray-600 dark:text-neutral-300">
                          Rollout %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Number(flag?.rolloutPercentage ?? 100)}
                          onChange={(event) =>
                            setFeatureFlags((prev) =>
                              prev.map((entry) =>
                                String(entry?.featureName) === featureName
                                  ? {
                                      ...entry,
                                      rolloutPercentage: Math.max(
                                        0,
                                        Math.min(100, Number(event.target.value || 0))
                                      )
                                    }
                                  : entry
                              )
                            )
                          }
                          className="w-full min-w-[96px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs sm:w-20 dark:border-neutral-700 dark:bg-neutral-950"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            patchFeatureFlag(featureName, {
                              enabled: Boolean(flag?.enabled),
                              rolloutPercentage: Number(flag?.rolloutPercentage ?? 100),
                              rolesAllowed
                            })
                          }
                          disabled={saving}
                          className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                        >
                          {saving ? '...' : 'Sauver'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleBody>
        </section>

        <section
          id="languages"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4"
        >
          <button
            type="button"
            onClick={() => toggleSection('languages')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Languages size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Langues</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('languages') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>
          <CollapsibleBody open={isSectionOpen('languages')}>
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={addLanguage}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              <Plus size={14} />
              Ajouter langue
            </button>
          </div>
          <div className="space-y-2">
            {languages.map((item, index) => (
              <div
                key={`${item.code || 'new'}-${index}`}
                className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[80px_minmax(0,1fr)_auto_auto] sm:items-center dark:border-neutral-800"
              >
                <input
                  value={item.code}
                  onChange={(e) => updateLanguage(index, { code: e.target.value })}
                  placeholder="fr"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm uppercase dark:border-neutral-700 dark:bg-neutral-950"
                />
                <input
                  value={item.name}
                  onChange={(e) => updateLanguage(index, { name: e.target.value })}
                  placeholder="Français"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={item.isActive !== false}
                    onChange={(e) => updateLanguage(index, { isActive: e.target.checked })}
                  />
                  Actif
                </label>
                <button
                  type="button"
                  onClick={() => removeLanguage(index)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                  aria-label="Supprimer langue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                {languages
                  .filter((item) => item.isActive !== false)
                  .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={savingLanguages}
                onClick={saveLanguages}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-900 dark:bg-neutral-900/30 dark:text-neutral-200"
              >
                Enregistrer
              </button>
            </div>
          </div>
          </CollapsibleBody>
        </section>

        <section
          id="currencies"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4"
        >
          <button
            type="button"
            onClick={() => toggleSection('currencies')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Landmark size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Devises</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('currencies') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>
          <CollapsibleBody open={isSectionOpen('currencies')}>
          <form onSubmit={createCurrency} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={currencyForm.code}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="Code"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <input
              value={currencyForm.symbol}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, symbol: e.target.value }))}
              placeholder="Symbole"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <input
              value={currencyForm.name}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <input
              type="number"
              min="0"
              step="1"
              value={currencyForm.decimals}
              onChange={(e) =>
                setCurrencyForm((prev) => ({
                  ...prev,
                  decimals: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0
                }))
              }
              placeholder="Decimales"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={currencyForm.exchangeRateToDefault}
              onChange={(e) =>
                setCurrencyForm((prev) => ({
                  ...prev,
                  exchangeRateToDefault: Number.isFinite(Number(e.target.value))
                    ? Number(e.target.value)
                    : 1
                }))
              }
              placeholder="Facteur conversion (montant de base x taux)"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              disabled={creatingCurrency}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {currencies.map((currency) => (
              <div
                key={currency.code}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium">
                    {currency.code} - {currency.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    {currency.symbol} | facteur base → {currency.code}: {currency.exchangeRateToDefault || 1}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <label className="text-xs text-gray-600 dark:text-neutral-300">
                      Facteur conversion:
                    </label>
                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={currencyRateDrafts[currency.code] ?? String(currency.exchangeRateToDefault || 1)}
                      onChange={(e) => updateCurrencyRateDraft(currency.code, e.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs sm:w-36 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={() => saveCurrencyRate(currency.code)}
                      disabled={savingCurrencyCode === currency.code}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                    >
                      {savingCurrencyCode === currency.code ? 'Enregistrement...' : 'Enregistrer conversion'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    type="button"
                    onClick={() => patchCurrency(currency.code, { isDefault: true })}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      currency.isDefault
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    Defaut
                  </button>
                  <button
                    type="button"
                    onClick={() => patchCurrency(currency.code, { isActive: !currency.isActive })}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      currency.isActive
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                    }`}
                  >
                    {currency.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </CollapsibleBody>
        </section>

        <section
          id="cities"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4"
        >
          <button
            type="button"
            onClick={() => toggleSection('cities')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Villes</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('cities') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>
          <CollapsibleBody open={isSectionOpen('cities')}>
          <form onSubmit={createCity} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={cityForm.name}
              onChange={(e) => setCityForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom ville"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <button
              type="submit"
              disabled={creatingCity}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {cities.map((item) => (
              <div
                key={item._id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Livraison {item.deliveryAvailable ? 'active' : 'off'} | boost x
                    {item.boostMultiplier || 1}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                  <button
                    type="button"
                    onClick={() => patchCity(item._id, { isDefault: true })}
                    disabled={deletingCityId === String(item._id)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      item.isDefault
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    Defaut
                  </button>
                  <button
                    type="button"
                    onClick={() => patchCity(item._id, { isActive: !item.isActive })}
                    disabled={deletingCityId === String(item._id)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      item.isActive
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                    }`}
                  >
                    {item.isActive ? 'Actif' : 'Inactif'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCity(item)}
                    disabled={deletingCityId === String(item._id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200"
                  >
                    <Trash2 size={12} />
                    {deletingCityId === String(item._id) ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </CollapsibleBody>
        </section>

        <section
          id="communes"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4"
        >
          <button
            type="button"
            onClick={() => toggleSection('communes')}
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Truck size={16} />
              <h2 className="text-sm font-semibold sm:text-base">Communes et règles de livraison</h2>
            </div>
            {isMobile ? (
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isSectionOpen('communes') ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>
          <CollapsibleBody open={isSectionOpen('communes')}>
          <form onSubmit={createCommune} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={communeForm.name}
              onChange={(e) => setCommuneForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom commune"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <select
              value={communeForm.cityId}
              onChange={(e) => setCommuneForm((prev) => ({ ...prev, cityId: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            >
              <option value="">Ville</option>
              {cities.map((city) => (
                <option key={city._id} value={city._id}>
                  {city.name}
                </option>
              ))}
            </select>
            <select
              value={communeForm.deliveryPolicy}
              onChange={(e) =>
                setCommuneForm((prev) => ({
                  ...prev,
                  deliveryPolicy: e.target.value
                }))
              }
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="DEFAULT_RULE">DEFAULT_RULE</option>
              <option value="FREE">FREE</option>
              <option value="FIXED_FEE">FIXED_FEE</option>
            </select>
            <input
              type="number"
              min="0"
              step="1"
              value={communeForm.fixedFee}
              onChange={(e) =>
                setCommuneForm((prev) => ({
                  ...prev,
                  fixedFee: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0
                }))
              }
              placeholder="Frais fixe"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              disabled={communeForm.deliveryPolicy !== 'FIXED_FEE'}
            />
            <button
              type="submit"
              disabled={creatingCommune}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {communes.map((item) => (
              <div
                key={item._id}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-neutral-700"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {item.name}
                      <span className="ml-2 text-xs text-gray-500 dark:text-neutral-400">
                        ({item.cityName || 'Ville inconnue'})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      Politique: {item.deliveryPolicy}
                      {item.deliveryPolicy === 'FIXED_FEE'
                        ? ` | Frais: ${Number(item.fixedFee || 0).toLocaleString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                  {editingCommuneId === String(item._id) ? (
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                      <select
                        value={editingCommuneDraft.cityId}
                        onChange={(e) =>
                          setEditingCommuneDraft((prev) => ({
                            ...prev,
                            cityId: e.target.value
                          }))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                      >
                        <option value="">Ville</option>
                        {cities.map((city) => (
                          <option key={city._id} value={city._id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editingCommuneDraft.deliveryPolicy}
                        onChange={(e) =>
                          setEditingCommuneDraft((prev) => ({
                            ...prev,
                            deliveryPolicy: e.target.value
                          }))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                      >
                        <option value="DEFAULT_RULE">DEFAULT_RULE</option>
                        <option value="FREE">FREE</option>
                        <option value="FIXED_FEE">FIXED_FEE</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingCommuneDraft.fixedFee}
                        onChange={(e) =>
                          setEditingCommuneDraft((prev) => ({
                            ...prev,
                            fixedFee: Number.isFinite(Number(e.target.value))
                              ? Number(e.target.value)
                              : 0
                          }))
                        }
                        disabled={editingCommuneDraft.deliveryPolicy !== 'FIXED_FEE'}
                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100 sm:w-28 dark:border-neutral-700 dark:bg-neutral-950 dark:disabled:bg-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={saveCommuneEdit}
                        disabled={savingCommuneEdit}
                        className="inline-flex min-h-9 items-center justify-center rounded-md bg-neutral-100 px-2 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-60 dark:bg-neutral-900/30 dark:text-neutral-200"
                      >
                        {savingCommuneEdit ? '...' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelCommuneEdit}
                        disabled={savingCommuneEdit}
                        className="inline-flex min-h-9 items-center justify-center rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                      <button
                        type="button"
                        onClick={() =>
                          patchCommune(item._id, {
                            isActive: !item.isActive
                          })
                        }
                        disabled={deletingCommuneId === String(item._id)}
                        className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                          item.isActive
                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                        }`}
                      >
                        {item.isActive ? 'Actif' : 'Inactif'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startCommuneEdit(item)}
                        disabled={deletingCommuneId === String(item._id)}
                        className="rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        Changer politique
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCommune(item)}
                        disabled={deletingCommuneId === String(item._id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200"
                      >
                        <Trash2 size={12} />
                        {deletingCommuneId === String(item._id) ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </CollapsibleBody>
        </section>
      </div>
      {isMobile ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">
                Actions rapides
              </p>
              <p className="truncate text-xs text-slate-600 dark:text-neutral-300">
                {canQuickSave
                  ? `${quickSaveCount} modification(s) en attente`
                  : 'Aucune modification en attente'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickSave}
              disabled={!canQuickSave || isQuickSaveBusy}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-semibold transition ${
                !canQuickSave || isQuickSaveBusy
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-neutral-800 dark:text-neutral-500'
                  : 'bg-neutral-900 text-white hover:bg-black'
              }`}
            >
              {isQuickSaveBusy ? 'Enregistrement...' : quickSaveLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
