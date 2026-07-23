import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Receipt, Sparkles, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import PawaPayButton from './PawaPayButton';

const BOOST_TYPES = [
  { value: 'PRODUCT_BOOST', label: 'Boost produit' },
  { value: 'LOCAL_PRODUCT_BOOST', label: 'Boost produit local' },
  { value: 'SHOP_BOOST', label: 'Boost boutique' },
  { value: 'HOMEPAGE_FEATURED', label: 'Homepage featured' }
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
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const availableProducts = useMemo(
    () => (Array.isArray(products) ? products.filter((item) => item?.status === 'approved') : []),
    [products]
  );
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

  return (
    <div className="hd-form-card rounded-2xl p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#e85d00]" />
        <h3 className="text-base font-black text-slate-900 sm:text-lg">Nouvelle demande de boost</h3>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-gray-100/55 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Type de boost</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden">
            {BOOST_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setBoostType(item.value)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  boostType === item.value
                    ? 'border-[#e85d00] bg-[#e85d00] text-white shadow-sm'
                    : 'border-gray-200 bg-white text-slate-700'
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
              className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
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
              className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </label>
          {requiresCity && (
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-600">Ville</span>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
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

      <div className="mt-4 space-y-3 rounded-2xl border border-gray-200 bg-gray-100/45 p-3">
        <div className="rounded-2xl border border-gray-200 bg-white/85 p-3">
          <p className="text-sm font-semibold text-neutral-900">
            Montant à payer: <span className="text-base">{formatPrice(preview?.totalPrice || 0)}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-700">
            Payez directement par MTN MoMo ou Airtel Money avec PawaPay.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-2xl border border-emerald-500 bg-emerald-50 p-3 text-left text-emerald-800 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-sm font-black">Paiement sécurisé PawaPay</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Payez avec MTN MoMo ou Airtel Money via PawaPay.
            </p>
          </div>
        </div>

        {Number(preview?.totalPrice || 0) >= 10 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-xs font-black text-emerald-900">Paiement sécurisé PawaPay</p>
            <PawaPayButton
              amount={Number(preview?.totalPrice || 0)}
              purpose="BOOST_FUNDING"
              actionContext={{
                kind: 'BOOST_REQUEST',
                boostType,
                duration,
                city: requiresCity ? city : '',
                productIds: selectedProductIds
              }}
              returnPath={typeof window !== 'undefined' ? window.location.pathname : '/seller/boosts'}
              label="Payer avec PawaPay"
              onBeforeStart={() => {
                if (!boostType) return 'Choisissez un type de boost.';
                if (requiresProducts && selectedProductIds.length === 0) {
                  return 'Sélectionnez au moins un produit.';
                }
                if (requiresCity && !String(city || '').trim()) {
                  return 'Aucune ville active n’est configurée pour ce boost local.';
                }
                return true;
              }}
            />
            <p className="mt-2 text-[11px] font-semibold text-emerald-800">
              Après confirmation PawaPay, la demande est envoyée automatiquement. Aucun ID ni preuve n’est nécessaire.
            </p>
          </div>
        )}

      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white/85 p-3">
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

    </div>
  );
}
