import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  CubeIcon,
  CurrencyDollarIcon,
  HeartIcon,
  ShieldCheckIcon,
  StarIcon,
  TruckIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import FavoriteContext from '../../context/FavoriteContext';
import useRecentlyViewed from '../../hooks/useRecentlyViewed';

const isDeliveryAgent = (user) => String(user?.role || '').toLowerCase() === 'delivery_agent';

/**
 * Taobao "我的淘宝"-style profile header:
 * - Orange gradient identity band with avatar, greeting and account-type badge.
 * - Account-type differentiation: shop vs simple user (different identity,
 *   stats and primary actions).
 * - Overlapping white cards: stats row + order status shortcuts.
 */
export default function TaobaoProfileHeader({
  user,
  profileImagePreview,
  stats,
  formatNumber,
  profileCompletionPercent,
  userShopLink,
  onTab
}) {
  const { favorites } = useContext(FavoriteContext);
  const { items: recentItems } = useRecentlyViewed();

  const isShop = user?.accountType === 'shop';
  const isVerifiedShop = isShop && Boolean(user?.shopVerified);
  const displayName = isShop ? String(user?.shopName || user?.name || 'Ma boutique').trim() : String(user?.name || '').trim();
  const avatarUrl = isShop ? user?.shopLogo || profileImagePreview : profileImagePreview;
  const initial = (displayName || 'U').charAt(0).toUpperCase();

  const orderTiles = [
    { label: 'À payer', icon: CurrencyDollarIcon, value: stats.orders?.purchases?.byStatus?.pending?.count || 0, to: '/orders/payment_due' },
    { label: 'Acceptées', icon: CubeIcon, value: stats.orders?.purchases?.byStatus?.confirmed?.count || 0, to: '/orders/awaiting_seller' },
    { label: 'Livraison', icon: TruckIcon, value: stats.orders?.purchases?.byStatus?.delivering?.count || 0, to: '/orders/delivery' },
    { label: 'Avis', icon: ChatBubbleLeftIcon, value: stats.orders?.purchases?.byStatus?.delivered?.count || 0, to: '/orders/completed' }
  ];

  const statTiles = isShop
    ? [
        { label: 'Annonces', icon: BuildingStorefrontIcon, value: stats.listings?.total || 0, action: () => onTab('shop') },
        { label: 'Commandes', icon: CubeIcon, value: stats.orders?.purchases?.totalCount || 0, action: () => onTab('orders') },
        { label: 'Vues', icon: ClockIcon, value: stats.performance?.views || 0, action: () => onTab('stats') },
        { label: 'Avis', icon: StarIcon, value: stats.reviews?.total || 0, action: () => onTab('stats') }
      ]
    : [
        { label: 'Favoris', icon: HeartIcon, value: favorites.length, action: null, to: '/favorites' },
        { label: 'Commandes', icon: CubeIcon, value: stats.orders?.purchases?.totalCount || 0, action: () => onTab('orders') },
        { label: 'Vus récemment', icon: ClockIcon, value: recentItems.length, action: null, to: '/recent' },
        { label: 'Mes avis', icon: StarIcon, value: stats.reviews?.total || 0, action: () => onTab('stats') }
      ];

  return (
    <section className="mb-5 overflow-hidden rounded-2xl shadow-sm sm:mb-8">
      {/* ── Orange identity band ── */}
      <div className="relative bg-[linear-gradient(160deg,#ff8a1e_0%,#ff5000_55%,#ff3d00_100%)] px-4 pb-16 pt-3 text-white sm:px-6">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[28px] border-white/10" aria-hidden="true" />
        <div className="absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

        <div className="relative flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onTab('notifications')}
            aria-label="Notifications"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition active:scale-95"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onTab('security')}
            aria-label="Paramètres"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition active:scale-95"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-2 flex items-center gap-3.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/80"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/25 ring-2 ring-white/80">
              {isShop ? <BuildingStorefrontIcon className="h-8 w-8" /> : <UserIcon className="h-8 w-8" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-lg font-black leading-tight">
                {displayName ? `Salut, ${displayName}` : 'Compléter votre profil'}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isShop
                    ? 'bg-white text-[#ff5000]'
                    : 'bg-white/20 text-white'
                }`}
              >
                {isShop ? (
                  <>
                    {isVerifiedShop ? <ShieldCheckIcon className="h-3 w-3" /> : <BuildingStorefrontIcon className="h-3 w-3" />}
                    Boutique
                  </>
                ) : (
                  <>
                    <UserIcon className="h-3 w-3" /> Particulier
                  </>
                )}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold text-white/85">
              {isShop
                ? 'Gérez vos annonces, vos commandes et votre boutique.'
                : 'Achetez, vendez et suivez vos commandes.'}
            </p>
          </div>
        </div>

        {/* ── Account-type primary actions ── */}
        <div className="relative mt-4 flex gap-2">
          {isShop ? (
            <>
              <Link
                to="/seller/products"
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-black text-[#ff3d00] shadow-sm active:scale-95"
              >
                <BuildingStorefrontIcon className="h-4 w-4" /> Espace vendeur
              </Link>
              {userShopLink ? (
                <Link
                  to={userShopLink}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/50 px-4 text-xs font-black text-white active:scale-95"
                >
                  <ShieldCheckIcon className="h-4 w-4" /> Ma boutique
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link
                to="/shop-conversion-request"
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-black text-[#ff3d00] shadow-sm active:scale-95"
              >
                <BuildingStorefrontIcon className="h-4 w-4" /> Créer ma boutique
              </Link>
              <Link
                to={isDeliveryAgent(user) ? '/delivery/dashboard' : '/delivery/apply'}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/50 px-4 text-xs font-black text-white active:scale-95"
              >
                <TruckIcon className="h-4 w-4" />
                {isDeliveryAgent(user) ? 'Espace livreur' : 'Devenir livreur'}
              </Link>
            </>
          )}
        </div>

        {profileCompletionPercent < 100 ? (
          <button
            type="button"
            onClick={() => onTab('profile')}
            className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm"
          >
            <ShieldCheckIcon className="h-3 w-3" />
            Profil complété à {profileCompletionPercent}% — compléter
          </button>
        ) : null}
      </div>

      {/* ── Overlapping white cards ── */}
      <div className="relative z-10 -mt-11 space-y-3 px-3 sm:px-5">
        <div className="grid grid-cols-4 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
          {statTiles.map(({ label, icon: Icon, value, action, to }) => {
            const inner = (
              <>
                <Icon className="h-5 w-5 text-[#ff5000]" />
                <span className="truncate text-[10px] font-bold text-neutral-700">{label}</span>
                <span className="text-xs font-black text-[#ff3d00]">{formatNumber(value)}</span>
              </>
            );
            if (to) {
              return (
                <Link key={label} to={to} className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center active:scale-95">
                  {inner}
                </Link>
              );
            }
            return (
              <button key={label} type="button" onClick={action} className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center active:scale-95">
                {inner}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-black text-neutral-900">Mes commandes</p>
            <Link
              to="/orders"
              className="inline-flex items-center text-[11px] font-bold text-neutral-500"
            >
              Tout <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {orderTiles.map(({ label, icon: Icon, value, to }) => (
              <Link
                key={label}
                to={to}
                className="relative flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-center active:scale-95"
              >
                <Icon className="h-5 w-5 text-neutral-800" />
                {value > 0 ? (
                  <span className="absolute right-1.5 top-0 rounded-full bg-[#ff5000] px-1.5 py-0.5 text-[9px] font-black leading-none text-white">
                    {formatNumber(value)}
                  </span>
                ) : null}
                <span className="truncate text-[10px] font-bold text-neutral-700">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
