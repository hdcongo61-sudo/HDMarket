import React from 'react';
import { Calendar, Clock, MapPin, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react';
import { formatCount, formatDate, formatRatingLabel } from './shopProfileHelpers';

export default function ShopHero({
  shop,
  isCertifiedShop,
  openingSummary,
  ratingAverage,
  ratingCount,
  stats,
  hasActivePromo,
  hasFreeDelivery,
  yearsActiveLabel,
  customerSatisfaction,
  t
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Banner */}
      <div className="relative h-[220px] w-full overflow-hidden bg-gray-100">
        {shop?.shopBanner ? (
          <img
            src={shop.shopBanner}
            alt={`${t('shop_profile.banner', 'Bannière')} ${shop.shopName}`}
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200" />
        )}
      </div>

      {/* Content below banner */}
      <div className="relative -mt-9 flex flex-col items-center px-4 pb-5 text-center">
        {/* Logo overlapping banner */}
        <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg ring-1 ring-gray-200">
          {shop?.shopLogo ? (
            <img
              src={shop.shopLogo}
              alt={`Logo ${shop.shopName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-2xl font-bold text-gray-800">
              {String(shop?.shopName || 'B').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Shop name */}
        <h1 className="mt-3 max-w-full truncate text-[1.5rem] font-extrabold tracking-tight text-gray-900">
          {shop?.shopName}
        </h1>

        {/* Verified badge */}
        {isCertifiedShop && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck size={12} />
            {t('shop_profile.verified', 'Boutique vérifiée')}
          </span>
        )}

        {/* Status + Rating pills */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              openingSummary?.isOpen
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${openingSummary?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            {openingSummary?.statusText}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {formatRatingLabel(ratingAverage)} · {formatCount(ratingCount)}{' '}
            {t('shop_profile.reviews_count', 'avis')}
          </span>
        </div>

        {/* Location */}
        {(shop?.city || shop?.commune) && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={11} />
            {[shop?.commune, shop?.city].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Bio */}
        <p className="mt-3 line-clamp-3 max-w-xs text-sm leading-relaxed text-gray-600">
          {shop?.shopDescription ||
            t(
              'shop_profile.no_description',
              "Cette boutique n'a pas encore de description publique."
            )}
        </p>

        {/* Stats row */}
        <div className="mt-5 grid w-full grid-cols-4 divide-x divide-gray-200 border-y border-gray-200 py-3">
          {stats.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 px-1">
              <span className="text-lg font-extrabold text-gray-900">{item.value}</span>
              <span className="text-center text-[10px] leading-tight text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Tag chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {yearsActiveLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
              <Clock size={11} />
              {yearsActiveLabel}
            </span>
          )}
          {hasFreeDelivery ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Livraison disponible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              Retrait en boutique
            </span>
          )}
          {customerSatisfaction && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
              <TrendingUp size={11} />
              {customerSatisfaction}
            </span>
          )}
          {hasActivePromo && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              <Sparkles size={11} />
              {formatCount(shop?.activePromoCountNow)} promo(s)
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            <Calendar size={11} />
            {t('shop_profile.member_since', 'Membre depuis')} {formatDate(shop?.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
