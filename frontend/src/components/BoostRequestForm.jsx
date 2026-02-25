import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CreditCard, Hash, Loader2, Receipt, Sparkles, Upload } from 'lucide-react';
import api, { verifyTransactionCodeAvailability } from '../services/api';
import { useNetworks } from '../hooks/useNetworks';
import { useAppSettings } from '../context/AppSettingsContext';

const BOOST_TYPES = [
  { value: 'PRODUCT_BOOST', label: 'Boost produit' },
  { value: 'LOCAL_PRODUCT_BOOST', label: 'Boost produit local' },
  { value: 'SHOP_BOOST', label: 'Boost boutique' },
  { value: 'HOMEPAGE_FEATURED', label: 'Homepage featured' }
];

const FALLBACK_NETWORKS = [
  { name: 'MTN', phoneNumber: '', order: 0, isActive: true },
  { name: 'Airtel', phoneNumber: '', order: 1, isActive: true }
];

export default function BoostRequestForm({ products = [], defaultCity = '', onSubmitted }) {
  const { cities, formatPrice } = useAppSettings();
  const normalizedDefaultCity = String(defaultCity || '').trim();
  const cityOptions = useMemo(
    () => {
      const names = Array.isArray(cities)
        ? cities
            .map((item) => String(item?.name || '').trim())
            .filter(Boolean)
        : [];
      if (normalizedDefaultCity && !names.includes(normalizedDefaultCity)) {
        names.unshift(normalizedDefaultCity);
      }
      return Array.from(new Set(names));
    },
    [cities, normalizedDefaultCity]
  );
  const [boostType, setBoostType] = useState('PRODUCT_BOOST');
  const [duration, setDuration] = useState(7);
  const [city, setCity] = useState(normalizedDefaultCity || cityOptions[0] || '');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [paymentOperator, setPaymentOperator] = useState('');
  const [paymentSenderName, setPaymentSenderName] = useState('');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { networks, loading: networksLoading } = useNetworks();

  const availableProducts = useMemo(
    () => (Array.isArray(products) ? products.filter((item) => item?.status === 'approved') : []),
    [products]
  );
  const activeNetworks = useMemo(() => {
    const list = Array.isArray(networks)
      ? networks.filter((network) => network?.isActive).sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];
    return list.length ? list : FALLBACK_NETWORKS;
  }, [networks]);

  const requiresProducts = ['PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'HOMEPAGE_FEATURED'].includes(boostType);
  const requiresCity = boostType === 'LOCAL_PRODUCT_BOOST';
  const canPreview = boostType && (!requiresProducts || selectedProductIds.length > 0);

  const toggleProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!requiresProducts) {
      setSelectedProductIds([]);
    }
  }, [requiresProducts]);

  useEffect(() => {
    if (!cityOptions.length) return;
    if (!city || !cityOptions.includes(city)) {
      setCity(normalizedDefaultCity && cityOptions.includes(normalizedDefaultCity) ? normalizedDefaultCity : cityOptions[0]);
    }
  }, [city, cityOptions, normalizedDefaultCity]);

  useEffect(() => {
    if (!paymentOperator && activeNetworks.length > 0) {
      setPaymentOperator(activeNetworks[0].name);
    }
  }, [activeNetworks, paymentOperator]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!canPreview) {
        setPreview(null);
        setPreviewError('');
        return;
      }
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const { data } = await api.get('/boosts/pricing/preview', {
          params: {
            boostType,
            duration,
            city: requiresCity ? city : undefined,
            productIds: selectedProductIds.join(',')
          }
        });
        setPreview(data?.breakdown || null);
      } catch (error) {
        setPreview(null);
        setPreviewError(error.response?.data?.message || 'Impossible de charger la prévisualisation.');
      } finally {
        setPreviewLoading(false);
      }
    };
    const timer = setTimeout(loadPreview, 250);
    return () => clearTimeout(timer);
  }, [boostType, canPreview, city, duration, requiresCity, selectedProductIds]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!boostType) {
      setSubmitError('Choisissez un type de boost.');
      return;
    }
    if (requiresProducts && selectedProductIds.length === 0) {
      setSubmitError('Sélectionnez au moins un produit.');
      return;
    }
    if (requiresCity && !String(city || '').trim()) {
      setSubmitError('Aucune ville active n’est configurée pour ce boost local.');
      return;
    }
    if (!String(paymentOperator || '').trim()) {
      setSubmitError('Choisissez un opérateur Mobile Money.');
      return;
    }
    const cleanSenderName = paymentSenderName.trim();
    const cleanTransactionId = String(paymentTransactionId || '').replace(/\D/g, '');
    if (!cleanSenderName) {
      setSubmitError('Le nom de l’expéditeur est requis.');
      return;
    }
    if (cleanTransactionId.length !== 10) {
      setSubmitError('L’ID de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    try {
      const verification = await verifyTransactionCodeAvailability(cleanTransactionId);
      if (!verification.available) {
        setSubmitError(verification.message || 'Ce code de transaction est déjà utilisé.');
        return;
      }
    } catch (error) {
      setSubmitError(error?.response?.data?.message || 'Impossible de vérifier l’ID de transaction.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('boostType', boostType);
      payload.append('duration', String(duration));
      if (requiresCity) payload.append('city', city);
      if (selectedProductIds.length) payload.append('productIds', JSON.stringify(selectedProductIds));
      payload.append('paymentOperator', String(paymentOperator || '').trim());
      payload.append('paymentSenderName', cleanSenderName);
      payload.append('paymentTransactionId', cleanTransactionId);
      const { data } = await api.post('/boosts/requests', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPaymentSenderName('');
      setPaymentTransactionId('');
      setPaymentOperator(activeNetworks[0]?.name || '');
      setSelectedProductIds([]);
      setPreview(null);
      onSubmitted?.(data);
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Impossible d’envoyer la demande de boost.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-neutral-600" />
        <h3 className="text-base font-black text-slate-900 sm:text-lg">Nouvelle demande de boost</h3>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Type de boost</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden">
            {BOOST_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setBoostType(item.value)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  boostType === item.value
                    ? 'border-neutral-600 bg-neutral-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="hidden space-y-1 sm:block">
            <span className="text-xs font-semibold uppercase text-slate-600">Type</span>
            <select
              value={boostType}
              onChange={(e) => setBoostType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            >
              {BOOST_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Durée (jours)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value || 1)))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>
          {requiresCity && (
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-600">Ville</span>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
              >
                {cityOptions.length === 0 && <option value="">Aucune ville configurée</option>}
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {requiresProducts && (
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Produits concernés ({selectedProductIds.length})
          </p>
          {!availableProducts.length ? (
            <p className="text-sm text-slate-500">Aucun produit approuvé disponible.</p>
          ) : (
            <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {availableProducts.map((product) => (
                <label key={product._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product._id)}
                    onChange={() => toggleProduct(product._id)}
                    className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{product.title}</span>
                  <span className="shrink-0 font-semibold text-slate-900">{formatPrice(product.price)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-semibold text-neutral-900">
            Montant à payer: <span className="text-base">{formatPrice(preview?.totalPrice || 0)}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-700">
            Après paiement Mobile Money, renseignez le nom de l’expéditeur et l’ID de transaction.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Opérateur Mobile Money</p>
          {networksLoading ? (
            <p className="text-sm text-slate-500">Chargement des réseaux...</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeNetworks.map((network) => (
                <button
                  key={network.name}
                  type="button"
                  onClick={() => setPaymentOperator(network.name)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    paymentOperator === network.name
                      ? 'border-neutral-500 bg-neutral-50 text-neutral-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold">{network.name}</p>
                  {network.phoneNumber ? (
                    <p className="text-xs text-slate-500">{network.phoneNumber}</p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-1 text-sm font-semibold text-slate-800">
            Exemple: où trouver l’ID de transaction
          </p>
          <p className="mb-3 text-xs text-slate-600">
            L’ID de transaction est le numéro à 10 chiffres indiqué dans le SMS de confirmation.
          </p>
          <img
            src="/images/transaction-sms-example-shop-conversion.png"
            alt="Exemple de SMS avec ID transaction"
            className="mx-auto max-h-60 max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Nom de l’expéditeur</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-neutral-500 focus-within:ring-2 focus-within:ring-neutral-100">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={paymentSenderName}
                onChange={(e) => setPaymentSenderName(e.target.value)}
                placeholder="Ex: Jean K."
                className="w-full border-none p-0 text-sm text-slate-800 focus:outline-none"
                required
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">ID transaction (10 chiffres)</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-neutral-500 focus-within:ring-2 focus-within:ring-neutral-100">
              <Hash className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={paymentTransactionId}
                onChange={(e) => setPaymentTransactionId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1234567890"
                className="w-full border-none p-0 text-sm font-mono text-slate-800 focus:outline-none"
                required
              />
            </div>
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-neutral-700" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">Prévisualisation du prix</p>
        </div>
        {previewLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calcul en cours...
          </div>
        ) : preview ? (
          <div className="space-y-1 text-sm text-slate-800">
            <p>Prix unitaire: <span className="font-semibold">{formatPrice(preview.unitPrice)}</span></p>
            <p>Sous-total: <span className="font-semibold">{formatPrice(preview.subtotal)}</span></p>
            <p>Multiplicateur saisonnier: <span className="font-semibold">x{Number(preview.seasonalMultiplier || 1).toFixed(2)}</span></p>
            <p className="text-base font-bold text-neutral-800">Total: {formatPrice(preview.totalPrice)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Complétez le formulaire pour voir le calcul automatique.
          </p>
        )}
        {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
      </div>

      {submitError && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="sticky bottom-0 z-[2] -mx-3 mt-4 border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:p-0">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-neutral-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {submitting ? 'Envoi...' : 'Envoyer la demande'}
        </button>
      </div>
    </form>
  );
}
