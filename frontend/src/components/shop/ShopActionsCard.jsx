import React from 'react';
import { Heart, MessageCircle, Navigation, Pencil, Phone, Rocket, Share2 } from 'lucide-react';
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
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-95';
  const outlineBtn =
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-95';

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-gray-900 sm:text-lg">
        {t('shop_profile.actions', 'Actions rapides')}
      </h3>

      <div className="mt-4 space-y-2">
        {/* Row 1: Message + Appeler */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onMessage} className={primaryBtn}>
            <MessageCircle size={15} />
            <span>{t('shop_profile.message', 'Message')}</span>
          </button>
          {user && shopPhone ? (
            <a href={`tel:${shopPhone}`} className={`${outlineBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
              <Phone size={15} />
              <span>{t('shop_profile.call', 'Appeler')}</span>
            </a>
          ) : (
            <Link to="/login" state={{ from: `/shop/${slug}` }} className={outlineBtn}>
              <Phone size={15} />
              <span>{t('shop_profile.call', 'Appeler')}</span>
            </Link>
          )}
        </div>

        {/* Row 2: Boost (own) or Follow (visitor) */}
        {isOwnShop ? (
          <Link
            to="/seller/boosts"
            className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 active:scale-95"
          >
            <Rocket size={15} />
            <span>{t('shop_profile.boost_shop', 'Booster ma boutique')}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followDisabled}
            className={`${outlineBtn} ${isFollowing ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : ''} ${followDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 shadow-none' : ''}`}
          >
            <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
            <span>
              {followPending
                ? '...'
                : isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')}
            </span>
          </button>
        )}

        {/* Row 3: Itinéraire + Modifier profil / Partager */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onDirections} className={`${outlineBtn} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}>
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
    </div>
  );
}
