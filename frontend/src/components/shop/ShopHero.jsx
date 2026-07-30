import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  PackageCheck,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store
} from 'lucide-react';
import { formatCount, formatDate, formatRatingLabel } from './shopProfileHelpers';

const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const injectTransform = (url = '', transform = '') => {
  if (!isCloudinaryUrl(url) || !transform) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
};

const getDesktopBannerUrl = (url = '') =>
  injectTransform(url, 'c_fill,g_auto,w_1600,h_560,q_auto,f_auto');

const getMobileBannerUrl = (url = '') =>
  injectTransform(url, 'c_fill,g_auto,w_900,h_620,q_auto,f_auto');

const HeroButton = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white shadow-sm backdrop-blur-md transition hover:bg-black/45 active:scale-95"
  >
    {children}
  </button>
);

export default function ShopHero({
  shop,
  isCertifiedShop,
  openingSummary,
  ratingAverage,
  ratingCount,
  stats = [],
  hasActivePromo,
  hasFreeDelivery,
  yearsActiveLabel,
  customerSatisfaction,
  onBack,
  onShare,
  t
}) {
  const banner = shop?.shopBanner || shop?.shopBannerMobile || '';
  const mobileBanner = shop?.shopBannerMobile || shop?.shopBanner || '';
  const shopName = String(shop?.shopName || shop?.name || 'Boutique HDMarket').trim();
  const initial = shopName.charAt(0).toUpperCase();
  const location = [shop?.commune, shop?.city].filter(Boolean).join(', ');
  const isOpen = Boolean(openingSummary?.isOpen);
  const description =
    shop?.shopDescription ||
    t(
      'shop_profile.no_description',
      "Cette boutique n'a pas encore de description publique."
    );

  return (
    <section className="overflow-hidden bg-white shadow-sm ring-1 ring-black/5 sm:rounded-3xl dark:bg-neutral-950 dark:ring-white/10">
      <div className="relative h-[190px] overflow-hidden bg-neutral-900 sm:h-[280px] lg:h-[320px]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--shop-color) 84%, #111827), var(--shop-color))'
          }}
        />

        {banner ? (
          <>
            <img
              src={getDesktopBannerUrl(banner)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shopName}`}
              className="relative hidden h-full w-full object-cover sm:block"
              loading="eager"
            />
            <img
              src={getMobileBannerUrl(mobileBanner)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shopName}`}
              className="relative h-full w-full object-cover sm:hidden"
              loading="eager"
            />
          </>
        ) : (
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-white/10" />
            <div className="absolute -bottom-32 left-[18%] h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/70" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 sm:p-5">
          <HeroButton label={t('common.back', 'Retour')} onClick={onBack}>
            <ArrowLeft size={19} />
          </HeroButton>
          <div className="flex items-center gap-2">
            {hasActivePromo ? (
              <span className="hidden min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 text-xs font-black text-white backdrop-blur-md sm:inline-flex">
                <Sparkles size={14} />
                {formatCount(shop?.activePromoCountNow)} promo(s)
              </span>
            ) : null}
            <HeroButton label={t('shop_profile.share', 'Partager')} onClick={onShare}>
              <Share2 size={18} />
            </HeroButton>
          </div>
        </div>

        <div className="absolute bottom-4 right-3 z-10 flex flex-wrap justify-end gap-2 sm:bottom-5 sm:right-5">
          {isCertifiedShop ? (
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-black text-emerald-700 shadow-lg">
              <ShieldCheck size={14} />
              {t('shop_profile.verified', 'Boutique vérifiée')}
            </span>
          ) : null}
          {hasActivePromo ? (
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--shop-color)] px-3 text-[11px] font-black text-[var(--shop-color-contrast)] shadow-lg sm:hidden">
              <Sparkles size={13} />
              Promotions
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative px-4 pb-5 sm:px-7 sm:pb-7">
        <div className="flex items-start gap-2.5 sm:gap-4">
          <div className="relative z-10 -mt-7 grid h-[68px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-[18px] border-[3px] border-white bg-white shadow-md ring-1 ring-black/5 sm:-mt-9 sm:h-[88px] sm:w-[88px] sm:rounded-[22px] dark:border-neutral-950 dark:bg-neutral-900 dark:ring-white/10">
            {shop?.shopLogo ? (
              <img
                src={shop.shopLogo}
                alt={`Logo ${shopName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-black text-[var(--shop-color)] sm:text-3xl">
                {initial}
              </span>
            )}
          </div>

          <div
            className="z-10 mt-2 min-w-0 flex-1 border-l-[3px] bg-white px-2 py-0.5 sm:mt-3 sm:px-3 sm:py-1 dark:bg-neutral-950"
            style={{ borderLeftColor: 'var(--shop-color)' }}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--shop-color)] sm:text-[9px]">
                  {t('shop_profile.badge_shop', 'Boutique')}
                </p>
                <h1 className="mt-0.5 line-clamp-2 text-[17px] font-black leading-[1.08] tracking-tight text-neutral-950 sm:text-[24px] dark:text-white">
                  {shopName}
                </h1>
              </div>
              {isCertifiedShop ? (
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-1 sm:text-[9px] sm:font-black dark:bg-emerald-500/10 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">
                    {t('shop_profile.verified', 'Vérifiée')}
                  </span>
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] font-bold text-neutral-500 sm:text-xs dark:text-neutral-400">
              <MapPin className="h-3 w-3 shrink-0 text-[var(--shop-color)]" />
              <span className="truncate">{location || 'HDMarket'}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black ${
              isOpen
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {openingSummary?.statusText}
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-black text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Star size={13} className="fill-current" />
            {formatRatingLabel(ratingAverage)}
            <span className="font-semibold opacity-70">
              ({formatCount(ratingCount)})
            </span>
          </span>
          {hasFreeDelivery ? (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-black text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <PackageCheck size={13} />
              Livraison offerte
            </span>
          ) : (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-black text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <Store size={13} />
              Retrait disponible
            </span>
          )}
        </div>

        <p className="mt-4 max-w-4xl text-sm font-medium leading-6 text-neutral-600 sm:text-[15px] dark:text-neutral-300">
          {description}
        </p>

        <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/70">
          {stats.map((item) => (
            <div
              key={item.label}
              className="min-w-0 border-r border-neutral-200 px-1.5 py-3 text-center last:border-r-0 sm:px-4 sm:py-4 dark:border-neutral-800"
            >
              <p className="truncate text-base font-black text-neutral-950 sm:text-xl dark:text-white">
                {item.value}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-bold text-neutral-500 sm:text-xs dark:text-neutral-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ratingCount > 0 && customerSatisfaction ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
              <Star size={12} />
              {customerSatisfaction} satisfaction
            </span>
          ) : null}
          {yearsActiveLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
              <Clock size={12} />
              Ancienneté : {yearsActiveLabel}
            </span>
          ) : null}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            <Calendar size={12} />
            {t('shop_profile.member_since', 'Membre depuis')} {formatDate(shop?.createdAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
