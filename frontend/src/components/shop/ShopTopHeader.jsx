import React from 'react';
import { ArrowLeft, Heart, Loader2, MoreHorizontal, Search, Share2 } from 'lucide-react';

export default function ShopTopHeader({
  title,
  subtitle,
  onBack,
  onShare,
  onFollowToggle,
  isFollowing,
  followDisabled,
  followPending = false,
  t
}) {
  const iconBtn =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white active:scale-95 dark:bg-neutral-900/90 dark:text-white dark:ring-white/10';

  return (
    <div className="sticky top-0 z-30 mx-0 mb-0 flex items-center gap-2 border-b border-orange-100/70 bg-[#fffaf4]/95 px-3 py-2.5 shadow-[0_10px_30px_-26px_rgba(255,106,0,0.75)] backdrop-blur-xl sm:mb-4 sm:rounded-[24px] sm:border dark:border-neutral-800 dark:bg-neutral-950/95">
      <button
        type="button"
        onClick={onBack}
        className={iconBtn}
        aria-label={t('shop_profile.back', 'Retour')}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => {
          const node = document.getElementById('products');
          if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/95 px-3 text-left text-sm text-slate-500 shadow-sm ring-1 ring-orange-100 transition active:scale-[0.99] dark:bg-neutral-900 dark:text-neutral-300 dark:ring-white/10"
        aria-label={t('shop_profile.search_in_shop', 'Rechercher dans la boutique')}
      >
        <Search size={16} className="shrink-0 text-[#FF6A00]" />
        <span className="min-w-0 flex-1 truncate">
          {title || t('shop_profile.public_shop', 'Boutique publique')}
        </span>
        {subtitle && <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{subtitle}</span>}
      </button>
      <button
        type="button"
        onClick={onShare}
        className={iconBtn}
        aria-label={t('shop_profile.share', 'Partager')}
      >
        <Share2 size={15} />
      </button>
      <button
        type="button"
        onClick={onFollowToggle}
        disabled={followDisabled}
        aria-busy={followPending}
        aria-label={
          isFollowing
            ? t('shop_profile.unfollow', 'Ne plus suivre')
            : t('shop_profile.follow', 'Suivre')
        }
        className={`${iconBtn} ${isFollowing ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.16)]' : ''} ${followPending ? 'scale-95 ring-rose-200' : ''} ${followDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 shadow-none' : ''}`}
      >
        {followPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
        )}
      </button>
      <button
        type="button"
        className={`${iconBtn} hidden sm:inline-flex`}
        aria-label={t('shop_profile.more', 'Plus')}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
