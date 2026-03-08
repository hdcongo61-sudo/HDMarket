import React from 'react';
import { Heart, MessageCircle, Navigation, Phone, Share2, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShopBottomActions({
  slug,
  user,
  shopPhone,
  onMessage,
  onDirections,
  onShare,
  onPrimaryAction,
  onFollowToggle,
  isFollowing,
  followDisabled,
  t
}) {
  const buttonClass =
    'inline-flex min-h-[48px] min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-semibold sm:gap-1.5 sm:px-2 sm:text-xs';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/90 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-3">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onMessage} className={`${buttonClass} bg-slate-700 text-white`}>
          <MessageCircle size={15} />
          <span className="truncate max-[360px]:hidden">{t('shop_profile.message', 'Message')}</span>
          <span className="hidden max-[360px]:inline">Msg</span>
        </button>

        {user && shopPhone ? (
          <a href={`tel:${shopPhone}`} className={`${buttonClass} border border-emerald-200 bg-emerald-50 text-emerald-700`}>
            <Phone size={15} />
            <span className="truncate max-[360px]:hidden">{t('shop_profile.call', 'Appeler')}</span>
            <span className="hidden max-[360px]:inline">Appel</span>
          </a>
        ) : (
          <Link
            to="/login"
            state={{ from: `/shop/${slug}` }}
            className={`${buttonClass} border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
          >
            <Phone size={15} />
            <span className="truncate max-[360px]:hidden">{t('shop_profile.call', 'Appeler')}</span>
            <span className="hidden max-[360px]:inline">Appel</span>
          </Link>
        )}

        <button
          type="button"
          onClick={onDirections}
          className={`${buttonClass} border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
        >
          <Navigation size={15} />
          <span className="truncate max-[360px]:hidden">GPS</span>
          <span className="hidden max-[360px]:inline">Nav</span>
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={onPrimaryAction} className={`${buttonClass} bg-slate-900 text-white`}>
          <Store size={15} />
          <span className="truncate max-[360px]:hidden">{t('shop_profile.view_products', 'Produits')}</span>
          <span className="hidden max-[360px]:inline">Prod</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`${buttonClass} border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
        >
          <Share2 size={15} />
          <span className="truncate max-[360px]:hidden">{t('shop_profile.share', 'Partager')}</span>
          <span className="hidden max-[360px]:inline">Part.</span>
        </button>
        <button
          type="button"
          onClick={onFollowToggle}
          disabled={followDisabled}
          className={`${buttonClass} border ${
            isFollowing
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          } ${followDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
          <span className="truncate max-[360px]:hidden">{t('shop_profile.follow', 'Suivre')}</span>
          <span className="hidden max-[360px]:inline">Suiv.</span>
        </button>
      </div>
    </div>
  );
}
