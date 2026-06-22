import React from 'react';
import { Heart, Loader2, MessageCircle, Navigation, Share2, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShopBottomActions({
  user,
  whatsappLink,
  slug,
  onMessage,
  onDirections,
  onShare,
  onPrimaryAction,
  onFollowToggle,
  isFollowing,
  followDisabled,
  followPending = false,
  t
}) {
  const btnBase =
    'inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded px-3 text-xs font-black transition active:scale-95';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/96 px-3 py-2 backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)] dark:border-neutral-800 dark:bg-neutral-950/96">
      <div className="grid grid-cols-[1fr_1fr_1.45fr] gap-2">
        <button
          type="button"
          onClick={onMessage}
          className={`${btnBase} bg-gray-100 text-[#FF6A00] hover:bg-gray-200 dark:bg-neutral-800`}
        >
          <MessageCircle size={15} />
          <span className="truncate">{t('shop_profile.message', 'Message')}</span>
        </button>

        {user && whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnBase} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
          >
            <MessageCircle size={15} />
            <span className="truncate">WhatsApp</span>
          </a>
        ) : (
          <Link
            to="/login"
            state={{ from: `/shop/${slug}` }}
            className={`${btnBase} bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-100`}
          >
            <MessageCircle size={15} />
            <span className="truncate">WhatsApp</span>
          </Link>
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
          className={`${btnBase} bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-100`}
        >
          <Navigation size={15} />
          <span className="truncate">GPS</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`${btnBase} bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-100`}
        >
          <Share2 size={15} />
          <span className="truncate">{t('shop_profile.share', 'Partager')}</span>
        </button>
        <button
          type="button"
          onClick={onFollowToggle}
          disabled={followDisabled}
          aria-busy={followPending}
          className={`${btnBase} ${
            isFollowing
              ? 'bg-rose-50 text-rose-700'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-100'
          } ${followPending ? 'scale-[0.99]' : ''} ${followDisabled ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 shadow-none dark:bg-neutral-900' : ''}`}
        >
          {followPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
          )}
          <span className="truncate">
            {isFollowing
              ? t('shop_profile.following', 'Suivie')
              : t('shop_profile.follow', 'Suivre')}
          </span>
        </button>
      </div>
    </div>
  );
}
