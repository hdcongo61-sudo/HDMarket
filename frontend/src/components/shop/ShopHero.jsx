import React from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Share2, ShieldCheck, Sparkles, Star, Store } from 'lucide-react';
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
  onBack,
  onShare,
  t
}) {
  return (
    <section className="overflow-hidden rounded-none bg-white shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="relative h-[150px] w-full overflow-hidden bg-[#fff0df] dark:bg-neutral-900">
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
          <div
            className="h-full w-full dark:opacity-80"
            style={{
              background: 'var(--shop-color)'
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/12 to-transparent" />
        <button type="button" onClick={onBack} className="absolute left-2.5 top-2.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white" aria-label={t('common.back', 'Retour')}><ArrowLeft size={18} /></button>
        <button type="button" onClick={onShare} className="absolute right-2.5 top-2.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white" aria-label={t('shop_profile.share', 'Partager')}><Share2 size={17} /></button>
        <div className="hidden">
          {isCertifiedShop && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm ring-1 ring-white/60">
              <ShieldCheck size={13} />
              {t('shop_profile.verified', 'Boutique vérifiée')}
            </span>
          )}
          {hasActivePromo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--shop-color)] px-3 py-1.5 text-[11px] font-black text-[var(--shop-color-contrast)] shadow-sm">
              <Sparkles size={13} />
              {formatCount(shop?.activePromoCountNow)} promo(s)
            </span>
          )}
        </div>
        <div className="hidden">
          <div className="flex items-end gap-3">
            <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-2xl border-[3px] border-white bg-white shadow-sm ring-1 ring-black/5 dark:border-neutral-950 dark:bg-neutral-900 dark:ring-white/10">
              {shop?.shopLogo ? (
                <img src={shop.shopLogo} alt={`Logo ${shop.shopName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white text-2xl font-black text-[var(--shop-color)] dark:bg-neutral-900">
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

      <div className="relative px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <div className="flex items-end gap-3 -mt-8">
          <div className="z-[1] h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-[3px] border-white bg-white shadow-sm dark:border-neutral-950 dark:bg-neutral-900">
            {shop?.shopLogo ? <img src={shop.shopLogo} alt={`Logo ${shop.shopName}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[var(--shop-color)]">{String(shop?.shopName || 'B').charAt(0).toUpperCase()}</div>}
          </div>
          <div className="z-[1] min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-1.5"><h1 className="truncate text-[19px] font-black text-[#231f1b] dark:text-white">{shop?.shopName}</h1>{isCertifiedShop ? <ShieldCheck size={16} className="shrink-0 text-[#e85d00]" /> : null}</div>
            <p className="mt-0.5 truncate text-xs text-[#8a8378]">{[shop?.commune, shop?.city].filter(Boolean).join(', ') || 'HDMarket'}</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#6b6459]">
          <span className="inline-flex items-center gap-1"><Star size={13} className="fill-[#e85d00] text-[#e85d00]" /><strong className="text-[#44403a]">{formatRatingLabel(ratingAverage)}</strong> · {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')}</span>
          {stats?.slice(0, 2).map((item) => <span key={`inline-${item.label}`}>{item.value} {String(item.label || '').toLowerCase()}</span>)}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#047857]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{openingSummary?.statusText}</div>
        <div className="hidden">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-800 dark:bg-neutral-900 dark:text-neutral-100">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')}
          </span>
          {hasFreeDelivery ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
              Livraison offerte
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-[var(--shop-color)] ring-1 ring-gray-200">
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

        <div className="hidden">
          {stats.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 border-r border-gray-100 px-1 py-3 last:border-r-0 dark:border-neutral-800">
              <span className="text-lg font-black text-[var(--shop-color)]">{item.value}</span>
              <span className="text-center text-[10px] font-semibold leading-tight text-gray-500 dark:text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {hasFreeDelivery ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f5f2ee] px-2.5 py-1 text-[11px] font-semibold text-[#44403a]"><Store size={11} className="text-[#047857]" />Livraison offerte</span> : null}
          {yearsActiveLabel && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <Clock size={11} />
              {yearsActiveLabel}
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <Calendar size={11} />
            {t('shop_profile.member_since', 'Membre depuis')} {formatDate(shop?.createdAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
