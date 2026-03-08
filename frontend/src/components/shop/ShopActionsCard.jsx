import React from 'react';
import { Heart, MessageCircle, Navigation, Pencil, Phone, Rocket, Share2, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';

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
  const actionButtonClass =
    'inline-flex w-full max-w-full min-h-[48px] min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-2.5 text-xs font-semibold transition active:scale-95 sm:gap-2 sm:px-3 sm:text-sm';

  return (
    <GlassCard className="min-w-0 space-y-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">
            {t('shop_profile.actions', 'Actions rapides')}
          </h3>
          <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
            {t('shop_profile.actions_subtitle', 'Contacter et naviguer rapidement')}
          </p>
        </div>
        {isCertifiedShop && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
            {t('shop_profile.verified', 'Vérifiée')}
          </span>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 max-[430px]:grid-cols-1 sm:grid-cols-3">
        <button
          type="button"
          onClick={onPrimaryAction}
          className={`${actionButtonClass} bg-slate-900 text-white hover:bg-black`}
        >
          {isOwnShop ? <Pencil size={16} /> : <Store size={16} />}
          <span className="truncate">
            {isOwnShop ? t('shop_profile.edit_profile', 'Modifier profil') : t('shop_profile.view_products', 'Voir produits')}
          </span>
        </button>

        <button
          type="button"
          onClick={onShare}
          className={`${actionButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
        >
          <Share2 size={16} />
          <span className="truncate">{t('shop_profile.share', 'Partager')}</span>
        </button>

        {isOwnShop && (
          <Link
            to="/seller/boosts"
            className={`${actionButtonClass} col-span-2 max-[430px]:col-span-1 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 sm:col-span-1`}
          >
            <Rocket size={16} />
            <span className="truncate">{t('shop_profile.boost_shop', 'Booster ma boutique')}</span>
          </Link>
        )}

        {user && shopPhone ? (
          <a
            href={`tel:${shopPhone}`}
            className={`${actionButtonClass} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
            aria-label={t('shop_profile.call', 'Appeler')}
          >
            <Phone size={16} />
            <span className="truncate">{t('shop_profile.call', 'Appeler')}</span>
          </a>
        ) : (
          <Link
            to="/login"
            state={{ from: `/shop/${slug}` }}
            className={`${actionButtonClass} border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
          >
            <Phone size={16} />
            <span className="truncate">{t('shop_profile.call', 'Appeler')}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={onMessage}
          className={`${actionButtonClass} bg-slate-700 text-white hover:bg-slate-800`}
        >
          <MessageCircle size={16} />
          <span className="truncate">{t('shop_profile.message', 'Message')}</span>
        </button>

        <button
          type="button"
          onClick={onDirections}
          className={`${actionButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
        >
          <Navigation size={16} />
          <span className="truncate">{t('shop_profile.directions', 'Itinéraire')}</span>
        </button>

        <button
          type="button"
          onClick={onFollowToggle}
          disabled={followDisabled}
          className={`${actionButtonClass} col-span-2 max-[430px]:col-span-1 border ${
            isFollowing
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          } ${followDisabled ? 'cursor-not-allowed opacity-60' : ''} sm:col-span-1`}
        >
          <Heart size={16} className={isFollowing ? 'fill-current' : ''} />
          <span className="truncate">
            {followPending
              ? '...'
              : isOwnShop
                ? t('shop_profile.my_shop', 'Ma boutique')
                : isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')}
          </span>
        </button>
      </div>
    </GlassCard>
  );
}
