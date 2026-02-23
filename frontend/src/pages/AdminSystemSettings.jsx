import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleHelp, Globe2, Landmark, Languages, MapPin, Plus, Save, Trash2, Truck } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

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

export default function AdminSystemSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState({});
  const [savingFeeKey, setSavingFeeKey] = useState('');
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
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [currencyRateDrafts, setCurrencyRateDrafts] = useState({});
  const [savingCurrencyCode, setSavingCurrencyCode] = useState('');

  const emitSettingsRefresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('hdmarket:settings-refresh'));
  }, []);

  const resolveCityName = useCallback((cityId, sourceCities = cities) => {
    const normalizedId = String(cityId || '').trim();
    if (!normalizedId) return '';
    const match = (sourceCities || []).find((city) => String(city?._id || '') === normalizedId);
    return match?.name || '';
  }, [cities]);

  const normalizeCommuneWithCities = useCallback(
    (commune, sourceCities = cities) => {
      const rawCity = commune?.cityId;
      const normalizedCityId = String(rawCity?._id || rawCity || '').trim();
      const cityName =
        rawCity?.name ||
        commune?.cityName ||
        resolveCityName(normalizedCityId, sourceCities) ||
        '';
      return {
        ...commune,
        cityId: normalizedCityId,
        cityName
      };
    },
    [cities, resolveCityName]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      setFees(data?.feesAndRules || {});
      setCurrencies(Array.isArray(data?.currencies) ? data.currencies : []);
      const nextCities = sortCities(Array.isArray(data?.cities) ? data.cities : []);
      const nextCommunesRaw = Array.isArray(data?.communes) ? data.communes : [];
      const nextCommunes = sortCommunes(
        nextCommunesRaw.map((commune) => normalizeCommuneWithCities(commune, nextCities))
      );
      setCities(nextCities);
      setCommunes(nextCommunes);
      const langs = Array.isArray(data?.languages?.languages) ? data.languages.languages : [];
      setLanguages(langs);
      setDefaultLanguage(data?.languages?.defaultLanguage || langs[0]?.code || 'fr');
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur chargement des parametres.', {
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [normalizeCommuneWithCities, showToast]);

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
      showToast('Parametre enregistre.', { variant: 'success' });
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement parametre.', { variant: 'error' });
    } finally {
      setSavingFeeKey('');
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
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement langues.', { variant: 'error' });
    } finally {
      setSavingLanguages(false);
    }
  };

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
    <div className="min-h-screen bg-gray-50/60 text-gray-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/75 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/75">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to="/admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold">Parametres systeme</h1>
            <p className="text-xs text-gray-500 dark:text-neutral-400">Configuration dynamique admin</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <Globe2 size={16} />
            <h2 className="text-sm font-semibold">Fees & Rules</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : (
            <div className="space-y-3">
              {FEE_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <div className="w-1/2">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-neutral-300">{field.label}</span>
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
                  </div>
                  {field.type === 'boolean' ? (
                    <select
                      value={fees[field.key] ? 'true' : 'false'}
                      onChange={(e) => setFees((prev) => ({ ...prev, [field.key]: e.target.value === 'true' }))}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => saveFee(field.key)}
                    disabled={savingFeeKey === field.key}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                  >
                    <Save size={14} />
                    OK
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <Languages size={16} />
            <h2 className="text-sm font-semibold">Langues</h2>
          </div>
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
              <div key={`${item.code || 'new'}-${index}`} className="flex items-center gap-2">
                <input
                  value={item.code}
                  onChange={(e) => updateLanguage(index, { code: e.target.value })}
                  placeholder="fr"
                  className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm uppercase dark:border-neutral-700 dark:bg-neutral-950"
                />
                <input
                  value={item.name}
                  onChange={(e) => updateLanguage(index, { name: e.target.value })}
                  placeholder="Français"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                  aria-label="Supprimer langue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
                className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:border-neutral-900 dark:bg-neutral-900/30 dark:text-neutral-200"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <Landmark size={16} />
            <h2 className="text-sm font-semibold">Devises</h2>
          </div>
          <form onSubmit={createCurrency} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={currencyForm.code}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="Code"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <input
              value={currencyForm.symbol}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, symbol: e.target.value }))}
              placeholder="Symbole"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <input
              value={currencyForm.name}
              onChange={(e) => setCurrencyForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              disabled={creatingCurrency}
              className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {currencies.map((currency) => (
              <div
                key={currency.code}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium">
                    {currency.code} - {currency.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    {currency.symbol} | facteur base → {currency.code}: {currency.exchangeRateToDefault || 1}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-neutral-300">
                      Facteur conversion:
                    </label>
                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={currencyRateDrafts[currency.code] ?? String(currency.exchangeRateToDefault || 1)}
                      onChange={(e) => updateCurrencyRateDraft(currency.code, e.target.value)}
                      className="w-36 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={() => saveCurrencyRate(currency.code)}
                      disabled={savingCurrencyCode === currency.code}
                      className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                    >
                      {savingCurrencyCode === currency.code ? 'Enregistrement...' : 'Enregistrer conversion'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <MapPin size={16} />
            <h2 className="text-sm font-semibold">Villes</h2>
          </div>
          <form onSubmit={createCity} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={cityForm.name}
              onChange={(e) => setCityForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom ville"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <button
              type="submit"
              disabled={creatingCity}
              className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {cities.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Livraison {item.deliveryAvailable ? 'active' : 'off'} | boost x
                    {item.boostMultiplier || 1}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => patchCity(item._id, { isDefault: true })}
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
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      item.isActive
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                    }`}
                  >
                    {item.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <Truck size={16} />
            <h2 className="text-sm font-semibold">Communes et regles de livraison</h2>
          </div>
          <form onSubmit={createCommune} className="mb-4 grid gap-2 sm:grid-cols-2">
            <input
              value={communeForm.name}
              onChange={(e) => setCommuneForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom commune"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              required
            />
            <select
              value={communeForm.cityId}
              onChange={(e) => setCommuneForm((prev) => ({ ...prev, cityId: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              disabled={communeForm.deliveryPolicy !== 'FIXED_FEE'}
            />
            <button
              type="submit"
              disabled={creatingCommune}
              className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
            >
              Ajouter
            </button>
          </form>
          <div className="space-y-2">
            {communes.map((item) => (
              <div
                key={item._id}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <div className="flex items-center justify-between gap-2">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editingCommuneDraft.cityId}
                        onChange={(e) =>
                          setEditingCommuneDraft((prev) => ({
                            ...prev,
                            cityId: e.target.value
                          }))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
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
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
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
                        className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs disabled:bg-gray-100 dark:border-neutral-700 dark:bg-neutral-950 dark:disabled:bg-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={saveCommuneEdit}
                        disabled={savingCommuneEdit}
                        className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 disabled:opacity-60 dark:bg-neutral-900/30 dark:text-neutral-200"
                      >
                        {savingCommuneEdit ? '...' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelCommuneEdit}
                        disabled={savingCommuneEdit}
                        className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          patchCommune(item._id, {
                            isActive: !item.isActive
                          })
                        }
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
                        onClick={() => startCommuneEdit(item)}
                        className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        Changer politique
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
