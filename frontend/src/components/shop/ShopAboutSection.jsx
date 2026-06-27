import React from 'react';
import { Calendar, ExternalLink, MapPin, Navigation, Phone, ShieldCheck, Store } from 'lucide-react';
import { formatDate } from './shopProfileHelpers';

export default function ShopAboutSection({
  shop,
  isCertifiedShop,
  shopCategoryLabel,
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
    <section className="min-w-0 space-y-3 overflow-hidden rounded-none bg-white px-4 py-3.5 shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 truncate border-l-[3px] border-[var(--shop-color)] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
          {t('shop_profile.about', 'À propos')}
        </h2>
        <span className="inline-flex max-w-full items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-[var(--shop-color)] dark:bg-neutral-800">
          <Store size={12} />
          <span className="truncate">{shopCategoryLabel || 'Marketplace'}</span>
        </span>
      </div>

      <section className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
          {t('shop_profile.description', 'Description')}
        </p>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-gray-700 dark:text-neutral-200">
          {shop?.shopDescription || t('shop_profile.no_description', "Cette boutique n'a pas encore de description détaillée.")}
        </p>
      </section>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <dt className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('shop_profile.location', 'Localisation')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--shop-color)]" />
            {shop?.shopLocationAddress ? (
              <span className="break-words">{shop.shopLocationAddress}</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">
                {t('shop_profile.location_address_unknown', 'Adresse capturée non disponible')}
              </span>
            )}
          </dd>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <dt className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('shop_profile.address', 'Adresse')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--shop-color)]" />
            {shop?.shopAddress ? (
              <span className="break-words">{shop.shopAddress}</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">
                {t('shop_profile.address_unknown', 'Adresse non renseignée')}
              </span>
            )}
          </dd>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <dt className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('shop_profile.phone', 'Téléphone')}
          </dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <Phone size={15} className="mt-0.5 shrink-0 text-[var(--shop-color)]" />
            <span className="break-all">{phoneLabel}</span>
          </dd>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <dt className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('shop_profile.member_since', 'Membre depuis')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <Calendar size={15} className="mt-0.5 shrink-0 text-[var(--shop-color)]" />
            <span>{formatDate(shop?.createdAt)}</span>
          </dd>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <dt className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('shop_profile.profile', 'Profil')}
          </dt>
          <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-200">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--shop-color)]" />
            <span className="break-words">
              {isCertifiedShop
                ? t('shop_profile.verified', 'Boutique vérifiée')
                : t('shop_profile.pending_verification', 'Vérification en attente')}
            </span>
          </dd>
        </div>
      </dl>

      {shopLocation ? (
        <section className="min-w-0 space-y-3 overflow-hidden rounded border border-gray-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="border-l-[3px] border-[var(--shop-color)] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
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

          <div className="overflow-hidden rounded border border-gray-100 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
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
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded bg-[var(--shop-color)] px-3 text-center text-xs font-black leading-tight text-[var(--shop-color-contrast)] sm:w-auto"
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
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded border border-gray-100 bg-gray-50 px-3 text-center text-xs font-black leading-tight text-gray-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 sm:w-auto"
            >
              <MapPin size={14} />
              <span className="truncate">Apple Plans</span>
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={distanceLoading}
              className="inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-1.5 overflow-hidden rounded border border-gray-100 bg-gray-50 px-3 text-center text-xs font-black leading-tight text-gray-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 sm:w-auto"
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
