import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Heart,
  Loader2,
  MapPin,
  PackageCheck,
  Search,
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

const getLogoUrl = (url = '') =>
  injectTransform(url, 'c_fill,g_auto,w_256,h_256,q_auto,f_auto');

const HeroButton = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white shadow-sm backdrop-blur-md transition hover:bg-black/45 active:scale-95"
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
  followersCount,
  completedOrders,
  isOwnShop,
  isFollowing,
  followDisabled,
  followPending,
  onFollowToggle,
  productSearch,
  onProductSearchChange,
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

  const proofParts = [
    `${formatCount(followersCount)} ${t('shop_profile.followers', 'Abonnés')}`,
    `${formatCount(completedOrders)} ${t('shop_profile.orders', 'Commandes')}`
  ];
  if (location) proofParts.push(location);

  return (
    <section className="sm:rounded-3xl">
      {/* ── En-tête orange façon Taobao ─────────────────────────────── */}
      <div className="relative overflow-hidden sm:rounded-t-3xl">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #FF5000 0%, #FF3D00 100%)' }}
          aria-hidden="true"
        />

        {banner ? (
          <>
            <img
              src={getDesktopBannerUrl(banner)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shopName}`}
              className="absolute inset-0 hidden h-full w-full object-cover sm:block"
              loading="eager"
            />
            <img
              src={getMobileBannerUrl(mobileBanner)}
              alt={`${t('shop_profile.banner', 'Bannière')} ${shopName}`}
              className="absolute inset-0 h-full w-full object-cover sm:hidden"
              loading="eager"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,80,0,0.88) 0%, rgba(255,61,0,0.88) 100%)'
              }}
              aria-hidden="true"
            />
          </>
        ) : (
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-white/10" />
            <div className="absolute -bottom-32 left-[18%] h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          </div>
        )}

        <div className="relative z-10 px-3 pb-14 pt-3 sm:px-5 sm:pb-16 sm:pt-4">
          {/* Rangée haute : retour, recherche en boutique, partage */}
          <div className="flex items-center gap-2">
            <HeroButton label={t('common.back', 'Retour')} onClick={onBack}>
              <ArrowLeft size={19} />
            </HeroButton>
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => onProductSearchChange(e.target.value)}
                placeholder={t('shop_profile.search_in_shop', 'Rechercher dans la boutique')}
                aria-label={t('shop_profile.search_in_shop', 'Rechercher dans la boutique')}
                className="h-10 w-full rounded-full border-0 bg-white pl-10 pr-4 text-sm font-medium text-neutral-900 shadow-sm outline-none ring-0 transition placeholder:text-neutral-400 focus:ring-2 focus:ring-white/70 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>
            <HeroButton label={t('shop_profile.share', 'Partager')} onClick={onShare}>
              <Share2 size={18} />
            </HeroButton>
          </div>

          {/* Identité de la boutique */}
          <div className="mt-4 flex items-center gap-3 sm:mt-5 sm:gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-white/80 bg-white shadow-md sm:h-20 sm:w-20 dark:bg-neutral-900">
              {shop?.shopLogo ? (
                <img
                  src={getLogoUrl(shop.shopLogo)}
                  alt={`Logo ${shopName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-[var(--shop-color)] sm:text-3xl">
                  {initial}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="line-clamp-2 text-lg font-black leading-tight tracking-tight text-white sm:text-2xl">
                  {shopName}
                </h1>
                {isCertifiedShop ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700 shadow-sm">
                    <ShieldCheck size={12} />
                    {t('shop_profile.verified', 'Boutique vérifiée')}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold text-white/85 sm:text-xs">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{proofParts.join(' · ')}</span>
              </p>
            </div>

            {!isOwnShop ? (
              <button
                type="button"
                onClick={onFollowToggle}
                disabled={followDisabled || followPending}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-black text-[#FF3D00] shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {followPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Heart size={14} className={isFollowing ? 'fill-current' : ''} />
                )}
                {isFollowing
                  ? t('shop_profile.following', 'Suivi')
                  : t('shop_profile.follow', 'Suivre')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Carte stats blanche chevauchant l'en-tête ───────────────── */}
      <div className="relative z-20 -mt-9 px-3 sm:-mt-10 sm:px-5">
        <div className="grid grid-cols-4 rounded-2xl bg-white px-1 py-3 shadow-lg ring-1 ring-black/5 sm:py-4 dark:bg-neutral-900 dark:ring-white/10">
          {stats.map((item) => (
            <div key={item.label} className="min-w-0 px-1 text-center sm:px-2">
              <p className="truncate text-base font-black text-[#FF3D00] sm:text-xl">
                {item.value}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-neutral-500 sm:text-xs dark:text-neutral-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Informations détaillées ─────────────────────────────────── */}
      <div className="mt-3 px-3 pb-4 sm:px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5 dark:bg-neutral-900 dark:ring-white/10">
          <div className="flex flex-wrap items-center gap-2">
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
            {hasActivePromo ? (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--shop-color)] px-3 text-xs font-black text-[var(--shop-color-contrast)]">
                <Sparkles size={13} />
                {formatCount(shop?.activePromoCountNow)} promo(s)
              </span>
            ) : null}
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

          <p className="mt-3 text-sm font-medium leading-6 text-neutral-600 sm:text-[15px] dark:text-neutral-300">
            {description}
          </p>

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
      </div>
    </section>
  );
}
