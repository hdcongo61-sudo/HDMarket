import React from 'react';
import { Calendar, Clock, MapPin, ShieldCheck, Sparkles, Star, Store, TrendingUp } from 'lucide-react';
import { formatCount, formatDate, formatRatingLabel } from './shopProfileHelpers';

const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const injectTransform = (url = '', transform = '') => {
  if (!isCloudinaryUrl(url) || !transform) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
};

const getDesktopBannerUrl = (url = '') =>
  injectTransform(url, 'c_fill,g_auto,w_1200,h_400,q_auto,f_auto');

const getMobileBannerUrl = (url = '') =>
  injectTransform(url, 'c_fill,g_auto,w_800,h_420,q_auto,f_auto');

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
    <section className="overflow-hidden rounded-none bg-white shadow-[0_18px_60px_-42px_rgba(15,23,42,0.7)] ring-1 ring-orange-100/80 sm:rounded-[28px] dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="relative h-[210px] w-full overflow-hidden bg-[#fff0df] sm:h-[280px] dark:bg-neutral-900">
        {shop?.shopBanner || shop?.shopBannerMobile ? (
          <>
            <img
              src={getDesktopBannerUrl(shop.shopBanner || shop.shopBannerMobile)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shop.shopName}`}
              className="hidden h-full w-full object-cover sm:block"
              loading="eager"
            />
            <img
              src={getMobileBannerUrl(shop.shopBannerMobile || shop.shopBanner)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shop.shopName}`}
              className="h-full w-full object-cover sm:hidden"
              loading="eager"
            />
          </>
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.85),transparent_28%),linear-gradient(135deg,#ff6a00_0%,#ff8a2a_42%,#fff0df_100%)] dark:bg-[linear-gradient(135deg,#2b1405_0%,#7c2d12_52%,#171717_100%)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/12 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {isCertifiedShop && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm ring-1 ring-white/60 backdrop-blur">
              <ShieldCheck size={13} />
              {t('shop_profile.verified', 'Boutique vérifiée')}
            </span>
          )}
          {hasActivePromo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00] px-3 py-1.5 text-[11px] font-black text-white shadow-sm">
              <Sparkles size={13} />
              {formatCount(shop?.activePromoCountNow)} promo(s)
            </span>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <div className="flex items-end gap-3">
            <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[22px] border-[3px] border-white bg-white shadow-xl ring-1 ring-black/5 dark:border-neutral-950 dark:bg-neutral-900 dark:ring-white/10">
              {shop?.shopLogo ? (
                <img src={shop.shopLogo} alt={`Logo ${shop.shopName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white text-2xl font-black text-[#FF6A00] dark:bg-neutral-900">
                  {String(shop?.shopName || 'B').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1 text-white">
              <h1 className="truncate text-[1.65rem] font-black leading-tight tracking-tight sm:text-4xl">
                {shop?.shopName}
              </h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-white/92">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin size={12} />
                  <span className="truncate">{[shop?.commune, shop?.city].filter(Boolean).join(', ') || 'HDMarket'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star size={12} className="fill-amber-300 text-amber-300" />
                  {formatRatingLabel(ratingAverage)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
              openingSummary?.isOpen
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${openingSummary?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {openingSummary?.statusText}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-black text-stone-800 dark:bg-neutral-900 dark:text-neutral-100">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')}
          </span>
          {hasFreeDelivery ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
              Livraison offerte
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-[#FF6A00] ring-1 ring-orange-100">
              <Store size={12} />
              Retrait boutique
            </span>
          )}
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {shop?.shopDescription ||
            t(
              'shop_profile.no_description',
              "Cette boutique n'a pas encore de description publique."
            )}
        </p>

        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-[20px] bg-[#fff7ef] ring-1 ring-orange-100 dark:bg-neutral-900 dark:ring-neutral-800">
          {stats.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 border-r border-orange-100 px-1 py-3 last:border-r-0 dark:border-neutral-800">
              <span className="text-lg font-black text-slate-950 dark:text-white">{item.value}</span>
              <span className="text-center text-[10px] font-semibold leading-tight text-slate-500 dark:text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {yearsActiveLabel && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <Clock size={11} />
              {yearsActiveLabel}
            </span>
          )}
          {customerSatisfaction && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <TrendingUp size={11} />
              {customerSatisfaction}
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <Calendar size={11} />
            {t('shop_profile.member_since', 'Membre depuis')} {formatDate(shop?.createdAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
