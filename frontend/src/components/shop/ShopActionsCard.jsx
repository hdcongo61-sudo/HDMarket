import React from 'react';
import { ChatBubbleLeftIcon, PaperAirplaneIcon, PencilIcon, PhoneIcon, RocketLaunchIcon, WalletIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export default function ShopActionsCard({
  isOwnShop,
  slug,
  user,
  shopPhone,
  whatsappLink,
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
  const primaryBtn =
    'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#FF5000] px-4 text-sm font-black text-white transition hover:brightness-95 active:scale-95';
  const outlineBtn =
    'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-black text-gray-800 transition hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';
  const iconBtn =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e2dcd2] text-[#44403a] transition hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:text-neutral-200';

  return (
    <section className="bg-white px-4 py-3.5 dark:bg-neutral-950">
      {isOwnShop ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onPrimaryAction} className={primaryBtn}><PencilIcon className="h-[15px] w-[15px]" />{t('shop_profile.edit_profile', 'Modifier profil')}</button>
          <Link to="/seller/boosts" className={outlineBtn}><RocketLaunchIcon className="h-[15px] w-[15px]" />{t('shop_profile.boost_shop', 'Booster')}</Link>
          <Link to="/my/settlements" className={`${outlineBtn} col-span-2`}><WalletIcon className="h-[15px] w-[15px]" />Versements des ventes</Link>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMessage} className={`${primaryBtn} flex-1`}><ChatBubbleLeftIcon className="h-[15px] w-[15px]" />{t('shop_profile.message', 'Message')}</button>
          {user && shopPhone ? <a href={`tel:${shopPhone}`} className={iconBtn} aria-label={t('shop_profile.phone', 'Téléphone')}><PhoneIcon className="h-4 w-4" /></a> : <Link to="/login" state={{ from: `/shop/${slug}` }} className={iconBtn} aria-label={t('shop_profile.phone', 'Téléphone')}><PhoneIcon className="h-4 w-4" /></Link>}
          <button type="button" onClick={onDirections} className={iconBtn} aria-label={t('shop_profile.directions', 'Itinéraire')}><PaperAirplaneIcon className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}
