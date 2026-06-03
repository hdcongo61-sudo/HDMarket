import React from 'react';
import { Heart, Loader2, MessageCircle, Navigation, Pencil, Phone, Rocket, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShopActionsCard({
  isOwnShop,
  slug,
  user,
  shopPhone,
  isCertifiedShop,
  isFollowing,
  followDisabled,
  followPending,
  onPrimaryAction,
  onShare,
  onMessage,
  onDirections,
  onFollowToggle,
  t
}) {
  const primaryBtn =
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-4 text-sm font-black text-white shadow-[0_14px_28px_-18px_rgba(255,106,0,0.9)] transition hover:bg-[#f45f00] active:scale-95';
  const outlineBtn =
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#fff7ef] px-4 text-sm font-black text-slate-800 ring-1 ring-orange-100 transition hover:bg-orange-50 active:scale-95 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-800';

  return (
    <section className="overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.65)] ring-1 ring-orange-100/80 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-base font-black text-slate-950 dark:text-white sm:text-lg">
          {t('shop_profile.actions', 'Actions rapides')}
        </h3>
        {isCertifiedShop && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
            Certifiée
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onMessage} className={primaryBtn}>
            <MessageCircle size={15} />
            <span>{t('shop_profile.message', 'Message')}</span>
          </button>
          {user && shopPhone ? (
            <button
              type="button"
              className={`${outlineBtn} cursor-default bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
              aria-label={t('shop_profile.phone', 'Téléphone')}
              title={shopPhone}
            >
              <Phone size={15} />
              <span>{t('shop_profile.phone', 'Téléphone')}</span>
            </button>
          ) : (
            <Link to="/login" state={{ from: `/shop/${slug}` }} className={outlineBtn}>
              <Phone size={15} />
              <span>{t('shop_profile.phone', 'Téléphone')}</span>
            </Link>
          )}
        </div>

        {/* Row 2: Boost (own) or Follow (visitor) */}
        {isOwnShop ? (
          <Link
            to="/seller/boosts"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-amber-50 px-4 text-sm font-black text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100 active:scale-95 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          >
            <Rocket size={15} />
            <span>{t('shop_profile.boost_shop', 'Booster ma boutique')}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followDisabled}
            aria-busy={followPending}
            className={`${outlineBtn} ${isFollowing ? 'bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100' : ''} ${followPending ? 'scale-[0.99] ring-orange-200' : ''} ${followDisabled ? 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none ring-gray-200' : ''}`}
          >
            {followPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
            )}
            <span>
              {followPending
                ? isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')
                : isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')}
            </span>
          </button>
        )}

        {/* Row 3: Itinéraire + Modifier profil / Partager */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onDirections} className={`${outlineBtn}`}>
            <Navigation size={15} />
            <span>{t('shop_profile.directions', 'Itinéraire')}</span>
          </button>
          {isOwnShop ? (
            <button type="button" onClick={onPrimaryAction} className={outlineBtn}>
              <Pencil size={15} />
              <span>{t('shop_profile.edit_profile', 'Modifier profil')}</span>
            </button>
          ) : (
            <button type="button" onClick={onShare} className={outlineBtn}>
              <Share2 size={15} />
              <span>{t('shop_profile.share', 'Partager')}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
