import React, { useEffect, useState } from 'react';
import { ArrowLeftIcon, HeartIcon, ShieldCheckIcon, ShareIcon } from '@heroicons/react/24/outline';
import { formatCount } from './shopProfileHelpers';

const SHOW_AFTER_PX = 150;

/**
 * Taobao-style collapsing shop bar (mobile only): once the user scrolls past
 * the hero, a slim fixed header with logo + name + follow takes over the top.
 */
export default function ShopStickyHeader({
  shop,
  isCertifiedShop,
  followersCount,
  isOwnShop,
  isFollowing,
  followDisabled,
  followPending,
  onFollowToggle,
  onBack,
  onShare,
  t
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setVisible(window.scrollY > SHOW_AFTER_PX);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const shopName = String(shop?.shopName || shop?.name || 'Boutique').trim();

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 sm:hidden ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2 border-b border-[#eee7e0] bg-white/95 px-3 py-2 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back', 'Retour')}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-700 active:bg-neutral-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#fff2e6] text-[#FF5000]">
          {shop?.shopLogo ? (
            <img src={shop.shopLogo} alt={shopName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-black">{shopName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[13px] font-black text-neutral-900">
            <span className="truncate">{shopName}</span>
            {isCertifiedShop ? <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
          </p>
          <p className="truncate text-[10px] font-medium text-neutral-500">
            {formatCount(followersCount)} {t('shop_profile.followers', 'Abonnés')}
          </p>
        </div>

        <button
          type="button"
          onClick={onShare}
          aria-label={t('shop_profile.share', 'Partager')}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-500 active:bg-neutral-100"
        >
          <ShareIcon className="h-[18px] w-[18px]" />
        </button>

        {!isOwnShop ? (
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followDisabled || followPending}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-black transition active:scale-95 disabled:opacity-60 ${
              isFollowing
                ? 'border border-[#FF5000] bg-white text-[#FF5000]'
                : 'bg-[#FF5000] text-white shadow-sm'
            }`}
          >
            <HeartIcon className={`h-3.5 w-3.5 ${isFollowing ? 'fill-current' : ''}`} />
            {followPending
              ? '…'
              : isFollowing
                ? t('shop_profile.following', 'Suivi')
                : t('shop_profile.follow', 'Suivre')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
