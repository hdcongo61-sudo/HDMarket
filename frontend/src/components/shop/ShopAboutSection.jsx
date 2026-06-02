import React from 'react';
import { Calendar, ExternalLink, MapPin, Navigation, Phone, ShieldCheck, Store } from 'lucide-react';
import { formatDate } from './shopProfileHelpers';

export default function ShopAboutSection({
  shop,
  isCertifiedShop,
  shopCategoryLabel,
  shopFullAddress,
  phoneLabel,
  shopLocation,
  activeEmbedUrl,
  activeDirectionsUrl,
  appleDirectionsUrl,
  mapProvider,
  onRequestLocation,
  distanceLoading,
  distanceKm,
  distanceError,
  t
}) {
  return (
    <section className="min-w-0 space-y-3 overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.7)] ring-1 ring-orange-100/80 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#FF6A00]">Détails boutique</p>
          <h2 className="truncate text-lg font-black text-slate-950 dark:text-white sm:text-xl">
            {t('shop_profile.about', 'À propos')}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('shop_profile.about_subtitle', 'Présentation et informations publiques')}
          </p>
        </div>
        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#fff7ef] px-2.5 py-1 text-xs font-black text-[#FF6A00] ring-1 ring-orange-100 dark:bg-neutral-900 dark:text-orange-300 dark:ring-neutral-800">
          <Store size={12} />
          <span className="truncate">{shopCategoryLabel || 'Marketplace'}</span>
        </span>
      </div>

      <section className="rounded-[22px] bg-[#fffaf6] p-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('shop_profile.description', 'Description')}
        </p>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-700 dark:text-neutral-200">
          {shop?.shopDescription || t('shop_profile.no_description', "Cette boutique n'a pas encore de description détaillée.")}
        </p>
      </section>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[20px] bg-[#fffaf6] p-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.location', 'Localisation')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[#FF6A00]" />
            <span className="break-words">
              {shopFullAddress || t('shop_profile.address_unknown', 'Adresse non renseignée')}
            </span>
          </dd>
        </div>
        <div className="rounded-[20px] bg-[#fffaf6] p-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.phone', 'Téléphone')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <Phone size={15} className="mt-0.5 shrink-0 text-[#FF6A00]" />
            <span className="break-all">{phoneLabel}</span>
          </dd>
        </div>
        <div className="rounded-[20px] bg-[#fffaf6] p-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.member_since', 'Membre depuis')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <Calendar size={15} className="mt-0.5 shrink-0 text-[#FF6A00]" />
            <span>{formatDate(shop?.createdAt)}</span>
          </dd>
        </div>
        <div className="rounded-[20px] bg-[#fffaf6] p-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.profile', 'Profil')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#FF6A00]" />
            <span className="break-words">
              {isCertifiedShop
                ? t('shop_profile.verified', 'Boutique vérifiée')
                : t('shop_profile.pending_verification', 'Vérification en attente')}
            </span>
          </dd>
        </div>
      </dl>

      {shopLocation ? (
        <section className="min-w-0 space-y-3 overflow-hidden rounded-[24px] bg-white p-3 ring-1 ring-orange-100/80 dark:bg-neutral-950 dark:ring-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-950 dark:text-white">
              {t('shop_profile.location', 'Localisation')}
            </p>
            <span
              className={`inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                shop?.locationVerified ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
              }`}
            >
              <MapPin size={12} />
              <span className="truncate">
                {shop?.locationVerified
                  ? t('shop_profile.location_verified', 'Position vérifiée')
                  : t('shop_profile.location_declared', 'Position déclarée')}
              </span>
            </span>
          </div>

          <div className="overflow-hidden rounded-[20px] bg-neutral-100 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
            {activeEmbedUrl ? (
              <iframe
                title={`${t('shop_profile.map', 'Carte')} ${shop?.shopName || ''}`}
                src={activeEmbedUrl}
                loading="lazy"
                className="h-52 w-full border-0 sm:h-64"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-neutral-500 dark:text-neutral-300 sm:h-64">
                {t('shop_profile.map_unavailable', 'Carte indisponible')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <a
              href={activeDirectionsUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#FF6A00] px-3 text-center text-xs font-black leading-tight text-white sm:w-auto"
            >
              <Navigation size={14} />
              <span className="truncate">
                {mapProvider === 'google'
                  ? t('shop_profile.open_google_maps', 'Ouvrir Google Maps')
                  : t('shop_profile.open_osm', 'Ouvrir OpenStreetMap')}
              </span>
              <ExternalLink size={13} />
            </a>
            <a
              href={appleDirectionsUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#fff7ef] px-3 text-center text-xs font-black leading-tight text-slate-700 ring-1 ring-orange-100 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800 sm:w-auto"
            >
              <MapPin size={14} />
              <span className="truncate">Apple Plans</span>
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={distanceLoading}
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-stone-100 px-3 text-center text-xs font-black leading-tight text-slate-700 disabled:opacity-60 dark:bg-neutral-900 dark:text-neutral-200 sm:w-auto"
            >
              <Navigation size={14} />
              <span className="truncate">
                {distanceLoading
                  ? t('shop_profile.calculating', 'Calcul…')
                  : t('shop_profile.calc_distance', 'Calculer la distance')}
              </span>
            </button>
          </div>

          {Number.isFinite(distanceKm) && (
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t('shop_profile.distance_estimated', 'Distance estimée')}: {' '}
              <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
              </span>
            </p>
          )}
          {distanceError && <p className="text-xs text-red-600">{distanceError}</p>}
        </section>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('shop_profile.no_geo', "La boutique n'a pas encore partagé sa position GPS précise.")}
        </p>
      )}
    </section>
  );
}
