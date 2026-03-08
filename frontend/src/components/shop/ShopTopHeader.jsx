import React from 'react';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import GlassHeader from '../ui/GlassHeader';

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
  return (
    <GlassHeader
      sticky
      title={title}
      subtitle={subtitle}
      className="mb-3 max-w-full overflow-hidden border border-white/20 bg-white/70 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-black/20 sm:mb-4 sm:px-4 sm:py-3"
      titleClassName="text-[15px] sm:text-lg"
      subtitleClassName="text-[10px] sm:text-sm max-[390px]:hidden"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:min-h-[44px] sm:min-w-[44px]"
        aria-label={t('shop_profile.back', 'Retour')}
      >
        <ArrowLeft size={15} />
      </button>
      <button
        type="button"
        onClick={onShare}
        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:min-h-[44px] sm:min-w-[44px]"
        aria-label={t('shop_profile.share', 'Partager')}
      >
        <Share2 size={15} />
      </button>
      <button
        type="button"
        onClick={onFollowToggle}
        disabled={followDisabled}
        className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition sm:min-h-[44px] sm:min-w-[44px] ${
          isFollowing
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
        } ${followDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50'}`}
        aria-label={
          isFollowing
            ? t('shop_profile.unfollow', 'Ne plus suivre')
            : t('shop_profile.follow', 'Suivre')
        }
      >
        <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
      </button>
    </GlassHeader>
  );
}
