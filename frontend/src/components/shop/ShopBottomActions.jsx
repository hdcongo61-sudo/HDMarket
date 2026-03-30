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
  const btnBase =
    'inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-sm transition active:scale-95';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onMessage}
          className={`${btnBase} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800`}
        >
          <MessageCircle size={15} />
          <span className="truncate">{t('shop_profile.message', 'Message')}</span>
        </button>

        {user && shopPhone ? (
          <a
            href={`tel:${shopPhone}`}
            className={`${btnBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          >
            <Phone size={15} />
            <span className="truncate">{t('shop_profile.call', 'Appeler')}</span>
          </a>
        ) : (
          <Link
            to="/login"
            state={{ from: `/shop/${slug}` }}
            className={`${btnBase} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
          >
            <Phone size={15} />
            <span className="truncate">{t('shop_profile.call', 'Appeler')}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={onDirections}
          className={`${btnBase} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
        >
          <Navigation size={15} />
          <span className="truncate">GPS</span>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          className={`${btnBase} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
        >
          <Store size={15} />
          <span className="truncate">{t('shop_profile.view_products', 'Produits')}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`${btnBase} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
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
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
          } ${followDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 shadow-none' : ''}`}
        >
          <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
          <span className="truncate">{t('shop_profile.follow', 'Suivre')}</span>
        </button>
      </div>
    </div>
  );
}
