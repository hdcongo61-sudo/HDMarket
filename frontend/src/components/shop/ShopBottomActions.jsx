import React from 'react';
import { Heart, MessageCircle, Navigation, Phone, Share2, Store } from 'lucide-react';

export default function ShopBottomActions({
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
  const btnBase =
    'inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition active:scale-95';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100/80 bg-white/96 px-3 py-2 shadow-[0_-18px_42px_-30px_rgba(255,106,0,0.85)] backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)] dark:border-neutral-800 dark:bg-neutral-950/96">
      <div className="grid grid-cols-[1fr_1fr_1.45fr] gap-2">
        <button
          type="button"
          onClick={onMessage}
          className={`${btnBase} bg-[#fff7ef] text-[#FF6A00] ring-1 ring-orange-100 hover:bg-orange-50 dark:bg-neutral-900 dark:ring-neutral-800`}
        >
          <MessageCircle size={15} />
          <span className="truncate">{t('shop_profile.message', 'Message')}</span>
        </button>

        {user && shopPhone ? (
          <button
            type="button"
            className={`${btnBase} cursor-default bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
            aria-label={t('shop_profile.phone', 'Téléphone')}
            title={shopPhone}
          >
            <Phone size={15} />
            <span className="truncate">{t('shop_profile.phone', 'Téléphone')}</span>
          </button>
        ) : (
          <button
            type="button"
            className={`${btnBase} bg-[#fff7ef] text-slate-800 ring-1 ring-orange-100 hover:bg-orange-50 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-800`}
          >
            <Phone size={15} />
            <span className="truncate">{t('shop_profile.phone', 'Téléphone')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPrimaryAction}
          className={`${btnBase} bg-gradient-to-r from-[#FFB000] to-[#FF6A00] text-white shadow-[0_16px_28px_-18px_rgba(255,106,0,0.9)]`}
        >
          <Store size={15} />
          <span className="truncate">{t('shop_profile.view_products', 'Produits')}</span>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onDirections}
          className={`${btnBase} bg-white text-slate-800 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-800`}
        >
          <Navigation size={15} />
          <span className="truncate">GPS</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`${btnBase} bg-white text-slate-800 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-800`}
        >
          <Share2 size={15} />
          <span className="truncate">{t('shop_profile.share', 'Partager')}</span>
        </button>
        <button
          type="button"
          onClick={onFollowToggle}
          disabled={followDisabled}
          className={`${btnBase} ${
            isFollowing
              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
              : 'bg-white text-slate-800 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-800'
          } ${followDisabled ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 shadow-none ring-neutral-200 dark:bg-neutral-900' : ''}`}
        >
          <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
          <span className="truncate">{t('shop_profile.follow', 'Suivre')}</span>
        </button>
      </div>
    </div>
  );
}
