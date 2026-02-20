import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe2, Landmark, Languages, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const FEE_FIELDS = [
  { key: 'commissionRate', label: 'Taux commission (%)', type: 'number', step: 0.1 },
  { key: 'boostEnabled', label: 'Boost active', type: 'boolean' },
  { key: 'installmentMinPercent', label: 'Tranche min (%)', type: 'number', step: 1 },
  { key: 'installmentMaxDuration', label: 'Duree max tranche (jours)', type: 'number', step: 1 },
  { key: 'shopConversionAmount', label: 'Montant devenir boutique', type: 'number', step: 1 },
  { key: 'analyticsViewWeight', label: 'Poids score vues', type: 'number', step: 0.01 },
  { key: 'analyticsConversionWeight', label: 'Poids score conversion', type: 'number', step: 0.01 },
  { key: 'analyticsRevenueWeight', label: 'Poids score revenu', type: 'number', step: 0.001 },
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

const buildEmptyLanguage = () => ({
  code: '',
  name: '',
  isActive: true
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
  const [languages, setLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState('fr');
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [currencyRateDrafts, setCurrencyRateDrafts] = useState({});
  const [savingCurrencyCode, setSavingCurrencyCode] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      setFees(data?.feesAndRules || {});
      setCurrencies(Array.isArray(data?.currencies) ? data.currencies : []);
      setCities(Array.isArray(data?.cities) ? data.cities : []);
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
  }, [showToast]);

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
    setCreatingCity(true);
    try {
      await api.post('/admin/cities', cityForm);
      showToast('Ville creee.', { variant: 'success' });
      setCityForm(emptyCityForm);
      await loadSettings();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur creation ville.', { variant: 'error' });
    } finally {
      setCreatingCity(false);
    }
  };

  const patchCity = async (cityId, patch) => {
    try {
      await api.patch(`/admin/cities/${cityId}`, patch);
      await loadSettings();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise a jour ville.', { variant: 'error' });
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
                  <label className="w-1/2 text-xs text-gray-600 dark:text-neutral-300">{field.label}</label>
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
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
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
              className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
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
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
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
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
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
                      className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
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
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
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
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
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
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
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
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
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
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
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
      </div>
    </div>
  );
}
