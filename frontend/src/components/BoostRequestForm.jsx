import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CreditCard, Hash, Loader2, Receipt, Sparkles, Upload } from 'lucide-react';
import api from '../services/api';
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
  const cityOptions = useMemo(
    () =>
      Array.isArray(cities) && cities.length
        ? cities.map((item) => item.name).filter(Boolean)
        : ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
    [cities]
  );
  const [boostType, setBoostType] = useState('PRODUCT_BOOST');
  const [duration, setDuration] = useState(7);
  const [city, setCity] = useState(defaultCity || cityOptions[0] || 'Brazzaville');
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
      setCity(defaultCity && cityOptions.includes(defaultCity) ? defaultCity : cityOptions[0]);
    }
  }, [city, cityOptions, defaultCity]);

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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h3 className="text-base font-bold text-gray-900">Nouvelle demande de boost</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-gray-600 uppercase">Type</span>
          <select
            value={boostType}
            onChange={(e) => setBoostType(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {BOOST_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-gray-600 uppercase">Durée (jours)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value || 1)))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        {requiresCity && (
          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-600 uppercase">Ville</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {cityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {requiresProducts && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase">
            Produits concernés ({selectedProductIds.length})
          </p>
          {!availableProducts.length ? (
            <p className="text-sm text-gray-500">Aucun produit approuvé disponible.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {availableProducts.map((product) => (
                <label key={product._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product._id)}
                    onChange={() => toggleProduct(product._id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex-1 truncate text-gray-700">{product.title}</span>
                  <span className="font-semibold text-gray-900">{formatPrice(product.price)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-semibold text-blue-900">
            Montant à payer: <span className="text-base">{formatPrice(preview?.totalPrice || 0)}</span>
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Après paiement Mobile Money, renseignez le nom de l’expéditeur et l’ID de transaction.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Opérateur Mobile Money</p>
          {networksLoading ? (
            <p className="text-sm text-gray-500">Chargement des réseaux...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeNetworks.map((network) => (
                <button
                  key={network.name}
                  type="button"
                  onClick={() => setPaymentOperator(network.name)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    paymentOperator === network.name
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold">{network.name}</p>
                  {network.phoneNumber ? (
                    <p className="text-xs text-gray-500">{network.phoneNumber}</p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-sm font-semibold text-gray-800 mb-1">
            Exemple: où trouver l’ID de transaction
          </p>
          <p className="text-xs text-gray-600 mb-3">
            L’ID de transaction est le numéro à 10 chiffres indiqué dans le SMS de confirmation.
          </p>
          <img
            src="/images/transaction-sms-example-shop-conversion.png"
            alt="Exemple de SMS avec ID transaction"
            className="max-w-full rounded-lg border border-gray-200 shadow-sm max-h-60 object-contain mx-auto"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-600 uppercase">Nom de l’expéditeur</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={paymentSenderName}
                onChange={(e) => setPaymentSenderName(e.target.value)}
                placeholder="Ex: Jean K."
                className="w-full border-none p-0 text-sm text-gray-800 focus:outline-none"
                required
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-600 uppercase">ID transaction (10 chiffres)</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <Hash className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={paymentTransactionId}
                onChange={(e) => setPaymentTransactionId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1234567890"
                className="w-full border-none p-0 text-sm font-mono text-gray-800 focus:outline-none"
                required
              />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="h-4 w-4 text-indigo-700" />
          <p className="text-xs font-semibold uppercase text-indigo-700">Prévisualisation du prix</p>
        </div>
        {previewLoading ? (
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calcul en cours...
          </div>
        ) : preview ? (
          <div className="space-y-1 text-sm text-gray-800">
            <p>Prix unitaire: <span className="font-semibold">{formatPrice(preview.unitPrice)}</span></p>
            <p>Sous-total: <span className="font-semibold">{formatPrice(preview.subtotal)}</span></p>
            <p>Multiplicateur saisonnier: <span className="font-semibold">x{Number(preview.seasonalMultiplier || 1).toFixed(2)}</span></p>
            <p className="text-base font-bold text-indigo-800">Total: {formatPrice(preview.totalPrice)}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Complétez le formulaire pour voir le calcul automatique.
          </p>
        )}
        {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {submitting ? 'Envoi...' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
