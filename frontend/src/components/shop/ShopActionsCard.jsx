import React from 'react';
import { Heart, Loader2, MessageCircle, Navigation, Pencil, Phone, Rocket, Share2, WalletCards } from 'lucide-react';
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
    'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-black text-white transition active:scale-95';
  const outlineBtn =
    'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-black text-gray-800 transition hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

  return (
    <section className="bg-white px-4 py-3.5 dark:bg-neutral-950">
      {isOwnShop ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onPrimaryAction} className={primaryBtn}><Pencil size={15} />{t('shop_profile.edit_profile', 'Modifier profil')}</button>
          <Link to="/seller/boosts" className={outlineBtn}><Rocket size={15} />{t('shop_profile.boost_shop', 'Booster')}</Link>
          <Link to="/my/settlements" className={`${outlineBtn} col-span-2`}><WalletCards size={15} />Versements des ventes</Link>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMessage} className={`${primaryBtn} flex-1`}><MessageCircle size={15} />{t('shop_profile.message', 'Message')}</button>
          <button type="button" onClick={onFollowToggle} disabled={followDisabled} aria-busy={followPending} className={`${outlineBtn} flex-1 ${followDisabled ? 'opacity-50' : ''}`}>
            {followPending ? <Loader2 size={15} className="animate-spin" /> : <Heart size={15} className={isFollowing ? 'fill-current' : ''} />}{isFollowing ? t('shop_profile.following', 'Suivie') : t('shop_profile.follow', 'Suivre')}
          </button>
          {user && shopPhone ? <a href={`tel:${shopPhone}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e2dcd2] text-[#44403a]" aria-label={t('shop_profile.phone', 'Téléphone')}><Phone size={16} /></a> : <Link to="/login" state={{ from: `/shop/${slug}` }} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e2dcd2] text-[#44403a]"><Phone size={16} /></Link>}
          <button type="button" onClick={onDirections} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e2dcd2] text-[#44403a]" aria-label={t('shop_profile.directions', 'Itinéraire')}><Navigation size={16} /></button>
        </div>
      )}
    </section>
  );
}
