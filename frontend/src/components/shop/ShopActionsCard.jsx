import React from 'react';
import { Heart, Loader2, MessageCircle, Navigation, Pencil, Phone, Rocket, Share2 } from 'lucide-react';
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
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded bg-[var(--shop-color)] px-4 text-sm font-black text-[var(--shop-color-contrast)] transition hover:brightness-95 active:scale-95';
  const outlineBtn =
    'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded border border-gray-100 bg-gray-50 px-4 text-sm font-black text-gray-800 transition hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

  return (
    <section className="overflow-hidden rounded-none bg-white px-4 py-3.5 shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="border-l-[3px] border-[var(--shop-color)] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
          {t('shop_profile.actions', 'Actions rapides')}
        </h3>
        {isCertifiedShop && (
          <span className="rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            Certifiée
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onMessage} className={primaryBtn}>
            <MessageCircle size={15} />
            <span>{t('shop_profile.message', 'Message')}</span>
          </button>
          {user && whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${outlineBtn} bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
            >
              <MessageCircle size={15} />
              <span>WhatsApp</span>
            </a>
          ) : (
            <Link to="/login" state={{ from: `/shop/${slug}` }} className={outlineBtn}>
              <MessageCircle size={15} />
              <span>WhatsApp</span>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {user && shopPhone ? (
            <button
              type="button"
              className={`${outlineBtn} cursor-default bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
              aria-label={t('shop_profile.phone', 'Téléphone')}
              title={shopPhone}
            >
              <Phone size={15} />
              <span>{t('shop_profile.phone', 'Téléphone')}</span>
            </button>
          ) : (
            <Link to="/login" state={{ from: `/shop/${slug}` }} className={outlineBtn}>
              <Phone size={15} />
              <span>{t('shop_profile.phone', 'Téléphone')}</span>
            </Link>
          )}
          <button type="button" onClick={onDirections} className={`${outlineBtn}`}>
            <Navigation size={15} />
            <span>{t('shop_profile.directions', 'Itinéraire')}</span>
          </button>
        </div>

        {/* Row 2: Boost (own) or Follow (visitor) */}
        {isOwnShop ? (
          <Link
            to="/seller/boosts"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded bg-amber-50 px-4 text-sm font-black text-amber-700 transition hover:bg-amber-100 active:scale-95 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <Rocket size={15} />
            <span>{t('shop_profile.boost_shop', 'Booster ma boutique')}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followDisabled}
            aria-busy={followPending}
            className={`${outlineBtn} ${isFollowing ? 'bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100' : ''} ${followPending ? 'scale-[0.99] ring-gray-200' : ''} ${followDisabled ? 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none ring-gray-200' : ''}`}
          >
            {followPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
            )}
            <span>
              {followPending
                ? isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')
                : isFollowing
                  ? t('shop_profile.following', 'Suivie')
                  : t('shop_profile.follow', 'Suivre')}
            </span>
          </button>
        )}

        {/* Row 3: Modifier profil / Partager */}
        <div className="grid grid-cols-1 gap-2">
          {isOwnShop ? (
            <button type="button" onClick={onPrimaryAction} className={outlineBtn}>
              <Pencil size={15} />
              <span>{t('shop_profile.edit_profile', 'Modifier profil')}</span>
            </button>
          ) : (
            <button type="button" onClick={onShare} className={outlineBtn}>
              <Share2 size={15} />
              <span>{t('shop_profile.share', 'Partager')}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
