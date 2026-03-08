import React from 'react';
import { Calendar, ExternalLink, MapPin, Navigation, Phone, ShieldCheck, Store } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
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
    <GlassCard className="min-w-0 space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            {t('shop_profile.about', 'À propos')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('shop_profile.about_subtitle', 'Présentation et informations publiques')}
          </p>
        </div>
        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Store size={12} />
          <span className="truncate">{shopCategoryLabel || 'Marketplace'}</span>
        </span>
      </div>

      <section className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('shop_profile.description', 'Description')}
        </p>
        <p className="mt-1.5 break-words text-sm text-slate-700 dark:text-slate-200">
          {shop?.shopDescription || t('shop_profile.no_description', "Cette boutique n'a pas encore de description détaillée.")}
        </p>
      </section>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.location', 'Localisation')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <MapPin size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="break-words">
              {shopFullAddress || t('shop_profile.address_unknown', 'Adresse non renseignée')}
            </span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.phone', 'Téléphone')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <Phone size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="break-all">{phoneLabel}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.member_since', 'Membre depuis')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <Calendar size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span>{formatDate(shop?.createdAt)}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.profile', 'Profil')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="break-words">
              {isCertifiedShop
                ? t('shop_profile.verified', 'Boutique vérifiée')
                : t('shop_profile.pending_verification', 'Vérification en attente')}
            </span>
          </dd>
        </div>
      </dl>

      {shopLocation ? (
        <section className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('shop_profile.location', 'Localisation')}
            </p>
            <span
              className={`inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                shop?.locationVerified ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
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

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            {activeEmbedUrl ? (
              <iframe
                title={`${t('shop_profile.map', 'Carte')} ${shop?.shopName || ''}`}
                src={activeEmbedUrl}
                loading="lazy"
                className="h-52 w-full border-0"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                {t('shop_profile.map_unavailable', 'Carte indisponible')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <a
              href={activeDirectionsUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-slate-900 px-3 text-center text-xs font-semibold leading-tight text-white sm:w-auto"
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
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-semibold leading-tight text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
            >
              <MapPin size={14} />
              <span className="truncate">Apple Plans</span>
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={distanceLoading}
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-sky-200 bg-sky-50 px-3 text-center text-xs font-semibold leading-tight text-sky-700 disabled:opacity-60 sm:w-auto"
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
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('shop_profile.distance_estimated', 'Distance estimée')}: {' '}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
              </span>
            </p>
          )}
          {distanceError && <p className="text-xs text-red-600">{distanceError}</p>}
        </section>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('shop_profile.no_geo', "La boutique n'a pas encore partagé sa position GPS précise.")}
        </p>
      )}
    </GlassCard>
  );
}
