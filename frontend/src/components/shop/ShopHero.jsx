import React from 'react';
import { Calendar, Clock, MapPin, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import VerifiedBadge from '../VerifiedBadge';
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
    <GlassCard className="min-w-0 overflow-hidden bg-slate-900 p-0 text-white dark:bg-slate-900">
      <div className="relative h-40 w-full max-[360px]:h-36 sm:h-60">
        {shop?.shopBanner ? (
          <img
            src={shop.shopBanner}
            alt={`${t('shop_profile.banner', 'Bannière')} ${shop.shopName}`}
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent" />
      </div>

      <div className="relative -mt-10 bg-slate-900 p-3.5 max-[360px]:-mt-9 max-[360px]:p-2.5 sm:-mt-14 sm:p-5">
        <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="h-[4.6rem] w-[4.6rem] shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm max-[360px]:h-16 max-[360px]:w-16 sm:h-20 sm:w-20">
            {shop?.shopLogo ? (
              <img
                src={shop.shopLogo}
                alt={`${t('shop_profile.logo', 'Logo')} ${shop.shopName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-bold text-slate-600">
                {String(shop?.shopName || 'B').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-white">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="max-w-full truncate text-[15px] font-bold sm:text-2xl">{shop?.shopName}</h1>
              <VerifiedBadge verified={isCertifiedShop} />
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
              <span
                className={`inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:text-[11px] ${
                  openingSummary?.isOpen
                    ? 'bg-emerald-300/20 text-emerald-100'
                    : 'bg-rose-300/20 text-rose-100'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    openingSummary?.isOpen ? 'bg-emerald-300' : 'bg-rose-300'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{openingSummary?.statusText}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 sm:text-[11px]">
                <Star size={12} className={ratingAverage > 0 ? 'fill-current' : ''} />
                <span className="truncate whitespace-nowrap">
                  {formatRatingLabel(ratingAverage)} · {formatCount(ratingCount)}{' '}
                  {t('shop_profile.reviews_count', 'avis')}
                </span>
              </span>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center justify-center gap-2 text-[11px] text-white/85 sm:justify-start sm:text-xs">
              <span className="truncate">{shop?.ownerName}</span>
              {(shop?.city || shop?.commune) && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <MapPin size={12} />
                  <span className="truncate">{[shop?.commune, shop?.city].filter(Boolean).join(', ')}</span>
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 break-words text-xs text-white/80 sm:line-clamp-3 sm:text-sm">
              {shop?.shopDescription || t('shop_profile.no_description', "Cette boutique n'a pas encore de description publique.")}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-4 sm:gap-2 sm:grid-cols-4">
          {stats.map((item) => (
            <article
              key={item.label}
              className="min-w-0 rounded-xl border border-white/20 bg-white/15 px-2 py-1.5 text-white backdrop-blur sm:px-2.5 sm:py-2"
            >
              <p className="flex min-w-0 items-center gap-1 text-[10px] text-white/80">
                {item.icon}
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </p>
              <p className="mt-1 truncate text-sm font-semibold leading-none sm:text-base">{item.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-white/90 sm:gap-2 sm:text-[11px]">
          {isCertifiedShop && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-300/20 px-2 py-1">
              <ShieldCheck size={13} />
              <span className="truncate">{t('shop_profile.verified', 'Boutique vérifiée')}</span>
            </span>
          )}
          {hasActivePromo && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-300/70 bg-amber-300/20 px-2 py-1">
              <Sparkles size={13} />
              <span className="truncate">{formatCount(shop?.activePromoCountNow)} promo(s)</span>
            </span>
          )}
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1">
            <Clock size={13} />
            <span className="truncate">{yearsActiveLabel}</span>
          </span>
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 max-[360px]:hidden">
            <Calendar size={13} />
            <span className="truncate">
              {t('shop_profile.member_since', 'Membre depuis')} {formatDate(shop?.createdAt)}
            </span>
          </span>
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 max-[360px]:hidden">
            <TrendingUp size={13} />
            <span className="truncate">{customerSatisfaction}</span>
          </span>
          <span
            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 ${
              hasFreeDelivery
                ? 'border border-emerald-300/70 bg-emerald-300/20 text-emerald-100'
                : 'border border-sky-300/70 bg-sky-300/20 text-sky-100'
            }`}
          >
            <MapPin size={13} />
            <span className="truncate">
              {hasFreeDelivery
                ? t('shop_profile.free_delivery', 'Livraison gratuite')
                : t('shop_profile.pickup_available', 'Retrait en boutique')}
            </span>
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
