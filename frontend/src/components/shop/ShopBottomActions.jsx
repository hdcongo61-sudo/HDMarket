import React from 'react';
import { BuildingStorefrontIcon, ChatBubbleLeftIcon, PencilIcon, RocketLaunchIcon, StarIcon, WalletIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

/**
 * Mobile fixed bottom bar — Taobao style, one row of 4 slots.
 * Share / directions / follow live in the hero, actions card and about section.
 */
export default function ShopBottomActions({
  user,
  whatsappLink,
  slug,
  isOwnShop,
  onMessage,
  onDirections,
  onShare,
  onPrimaryAction,
  onFollowToggle,
  isFollowing,
  followDisabled,
  followPending = false,
  onGoReviews,
  t
}) {
  const slot =
    'inline-flex min-h-[46px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-bold transition active:scale-95';
  const neutral = 'text-gray-600 hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/96 px-2 py-1.5 [padding-bottom:calc(env(safe-area-inset-bottom)+0.375rem)] dark:border-neutral-800 dark:bg-neutral-950/96">
      <div className="grid grid-cols-4 gap-1">
        {isOwnShop ? (
          <button type="button" onClick={onPrimaryAction} className={`${slot} ${neutral}`}>
            <PencilIcon className="h-[17px] w-[17px]" />
            <span className="truncate">{t('shop_profile.edit_profile', 'Modifier profil')}</span>
          </button>
        ) : (
          <button type="button" onClick={onMessage} className={`${slot} ${neutral}`}>
            <ChatBubbleLeftIcon className="h-[17px] w-[17px]" />
            <span className="truncate">{t('shop_profile.message', 'Message')}</span>
          </button>
        )}

        {isOwnShop ? (
          <Link to="/seller/boosts" className={`${slot} ${neutral}`}>
            <RocketLaunchIcon className="h-[17px] w-[17px]" />
            <span className="truncate">{t('shop_profile.boost_shop', 'Booster')}</span>
          </Link>
        ) : user && whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${slot} text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10`}
          >
            <ChatBubbleLeftIcon className="h-[17px] w-[17px]" />
            <span className="truncate">WhatsApp</span>
          </a>
        ) : (
          <Link to="/login" state={{ from: `/shop/${slug}` }} className={`${slot} ${neutral}`}>
            <ChatBubbleLeftIcon className="h-[17px] w-[17px]" />
            <span className="truncate">WhatsApp</span>
          </Link>
        )}

        {isOwnShop ? (
          <Link to="/my/settlements" className={`${slot} ${neutral}`}>
            <WalletIcon className="h-[17px] w-[17px]" />
            <span className="truncate">Versements</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onPrimaryAction}
            className={`${slot} text-[#FF5000] hover:bg-orange-50 dark:hover:bg-orange-500/10`}
          >
            <BuildingStorefrontIcon className="h-[17px] w-[17px]" />
            <span className="truncate">{t('shop_profile.view_products', 'Produits')}</span>
          </button>
        )}

        <button type="button" onClick={onGoReviews} className={`${slot} ${neutral}`}>
          <StarIcon className="h-[17px] w-[17px]" />
          <span className="truncate">{t('shop_profile.tab_reviews', 'Avis')}</span>
        </button>
      </div>
    </div>
  );
}
