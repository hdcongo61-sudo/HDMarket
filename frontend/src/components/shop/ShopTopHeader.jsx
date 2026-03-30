import React from 'react';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';

export default function ShopTopHeader({
  title,
  subtitle,
  onBack,
  onShare,
  onFollowToggle,
  isFollowing,
  followDisabled,
  t
}) {
  const iconBtn =
    'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-95';

  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_6px_20px_-18px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        className={iconBtn}
        aria-label={t('shop_profile.back', 'Retour')}
      >
        <ArrowLeft size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        {subtitle && (
          <p className="truncate text-[10px] text-gray-500">{subtitle}</p>
        )}
      </div>
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
        aria-label={
          isFollowing
            ? t('shop_profile.unfollow', 'Ne plus suivre')
            : t('shop_profile.follow', 'Suivre')
        }
        className={`${iconBtn} ${isFollowing ? 'border-rose-300 bg-rose-50 text-rose-700' : ''} ${followDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 shadow-none' : ''}`}
      >
        <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
      </button>
    </div>
  );
}
