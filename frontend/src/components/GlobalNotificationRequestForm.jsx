import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, MegaphoneIcon, PhotoIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import PawaPayButton from './PawaPayButton';

const GENDER_OPTIONS = [
  { value: 'all', label: 'Tout le monde' },
  { value: 'homme', label: 'Hommes' },
  { value: 'femme', label: 'Femmes' }
];

export default function GlobalNotificationRequestForm({ products = [], defaultCity = '' }) {
  const { cities, formatPrice } = useAppSettings();
  const cityOptions = useMemo(() => {
    const names = Array.isArray(cities)
      ? cities.map((item) => String(item?.name || '').trim()).filter(Boolean)
      : [];
    return Array.from(new Set(names));
  }, [cities]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [productId, setProductId] = useState('');
  const [audienceCity, setAudienceCity] = useState(String(defaultCity || '').trim());
  const [audienceGender, setAudienceGender] = useState('all');
  const [image, setImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const fileInputRef = useRef(null);

  const availableProducts = useMemo(
    () => (Array.isArray(products) ? products.filter((item) => item?.status === 'approved') : []),
    [products]
  );

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageError('');
    setImageUploading(true);
    try {
      const payload = new FormData();
      payload.append('image', file);
      const { data } = await api.post('/global-notifications/upload-image', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImage(data?.image || null);
    } catch (error) {
      setImage(null);
      setImageError(error.response?.data?.message || 'Impossible d’envoyer cette image.');
    } finally {
      setImageUploading(false);
    }
  };

  useEffect(() => {
    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const { data } = await api.get('/global-notifications/pricing/preview', {
          params: { city: audienceCity || undefined, gender: audienceGender }
        });
        setPreview(data || null);
      } catch (error) {
        setPreview(null);
        setPreviewError(error.response?.data?.message || 'Impossible de charger la tarification.');
      } finally {
        setPreviewLoading(false);
      }
    };
    const timer = setTimeout(loadPreview, 250);
    return () => clearTimeout(timer);
  }, [audienceCity, audienceGender]);

  return (
    <div className="hd-form-card rounded-2xl p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <MegaphoneIcon className="h-5 w-5 text-[#e85d00]" />
        <h3 className="text-base font-black text-slate-900 sm:text-lg">Nouvelle notification globale</h3>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-600">Titre</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Grande promo sur nos sneakers"
            className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-600">Message</span>
          <textarea
            value={message}
            maxLength={500}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre offre en quelques mots..."
            className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
          />
        </label>

        {availableProducts.length > 0 && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Produit concerné (optionnel)</span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Aucun produit spécifique</option>
              {availableProducts.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Ville ciblée</span>
            <select
              value={audienceCity}
              onChange={(e) => setAudienceCity(e.target.value)}
              className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Toutes les villes</option>
              {cityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Public ciblé</span>
            <select
              value={audienceGender}
              onChange={(e) => setAudienceGender(e.target.value)}
              className="ui-input w-full rounded-xl px-3 py-2.5 text-sm"
            >
              {GENDER_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-100/55 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Image de la notification</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
          >
            {imageUploading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : image ? (
              <img src={image.url} alt="Aperçu" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <PhotoIcon className="h-4 w-4" />
            )}
            {imageUploading ? 'Envoi en cours...' : image ? 'Changer l’image' : 'Choisir une image'}
          </button>
          {imageError && <p className="mt-2 text-xs text-red-600">{imageError}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-gray-200 bg-gray-100/45 p-3">
        <div className="rounded-2xl border border-gray-200 bg-white/85 p-3">
          {preview && preview.price === null ? (
            <p className="text-sm font-semibold text-amber-700">
              {preview.message || 'Tarification pas encore configurée par un administrateur.'}
            </p>
          ) : (
            <p className="text-sm font-semibold text-neutral-900">
              Montant à payer: <span className="text-base">{formatPrice(preview?.price || 0)}</span>
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-700">
            <UsersIcon className="h-3.5 w-3.5" />
            {previewLoading
              ? 'Calcul de la portée...'
              : preview
                ? `Portée estimée: ${Number(preview.estimatedReach || 0).toLocaleString('fr-FR')} utilisateur(s)`
                : previewError || 'Choisissez un ciblage pour voir la portée.'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500 bg-emerald-50 p-3 text-left text-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-4 w-4" />
            <p className="text-sm font-black">Paiement sécurisé PawaPay</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Payez avec MTN MoMo ou Airtel Money via PawaPay.</p>
        </div>

        {Number(preview?.price || 0) >= 10 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-xs font-black text-emerald-900">Paiement sécurisé PawaPay</p>
            <PawaPayButton
              amount={Number(preview?.price || 0)}
              purpose="GLOBAL_NOTIFICATION_FUNDING"
              actionContext={{
                kind: 'GLOBAL_NOTIFICATION_REQUEST',
                title: title.trim(),
                message: message.trim(),
                productId,
                audienceCity,
                audienceGender,
                image
              }}
              returnPath={typeof window !== 'undefined' ? window.location.pathname : '/seller/global-notifications'}
              label="Payer avec PawaPay"
              onBeforeStart={() => {
                if (!title.trim()) return 'Ajoutez un titre.';
                if (!message.trim()) return 'Ajoutez un message.';
                if (!image?.url) return 'Ajoutez une image.';
                return true;
              }}
            />
            <p className="mt-2 text-[11px] font-semibold text-emerald-800">
              Après confirmation PawaPay, la demande est envoyée automatiquement à un administrateur pour validation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
