import React, { useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Clapperboard,
  FileText,
  Megaphone,
  Package,
  Rocket,
  ShoppingBag,
  Store,
  Tag,
  Users2,
  WalletCards
} from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

const groups = [
  {
    label: 'Activité',
    items: [
      { to: '/seller/products', label: 'Mes annonces', short: 'Annonces', icon: Package },
      { to: '/seller/orders', label: 'Commandes', short: 'Commandes', icon: ShoppingBag },
      { to: '/seller/quotations', label: 'Demandes de devis', short: 'Devis', icon: FileText },
      { to: '/seller/analytics', label: 'Statistiques', short: 'Stats', icon: BarChart3 }
    ]
  },
  {
    label: 'Croissance',
    items: [
      { to: '/seller/boosts', label: 'Boosts', short: 'Boosts', icon: Rocket },
      { to: '/seller/promo-codes', label: 'Codes promo', short: 'Promos', icon: Tag },
      { to: '/seller/global-notifications', label: 'Campagnes', short: 'Campagnes', icon: Megaphone }
    ]
  },
  {
    label: 'Gestion',
    items: [
      { to: '/seller/assistant', label: 'Assistant', short: 'Assistant', icon: Users2 },
      { to: '/seller/videos', label: 'Vidéos', short: 'Vidéos', icon: Clapperboard, feature: 'product_videos' },
      { to: '/seller/settlements', label: 'Versements', short: 'Versements', icon: WalletCards }
    ]
  }
];

const isItemActive = (pathname, to) => {
  if (to === '/seller/products') return pathname === '/seller/products' || pathname.startsWith('/seller/products/');
  if (to === '/seller/orders') {
    return pathname.startsWith('/seller/orders') || pathname.startsWith('/seller/order/');
  }
  if (to === '/seller/assistant') return pathname.startsWith('/seller/assistant');
  return pathname === to || pathname.startsWith(`${to}/`);
};

export default function SellerLayout() {
  const { pathname } = useLocation();
  const { isFeatureEnabled } = useAppSettings();
  const visibleGroups = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.feature || isFeatureEnabled(item.feature, { defaultValue: false }))
    })).filter((group) => group.items.length),
    [isFeatureEnabled]
  );
  const mobileItems = visibleGroups.flatMap((group) => group.items);

  const renderLink = (item) => {
    const Icon = item.icon;
    const active = isItemActive(pathname, item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
          active
            ? 'bg-[#231f1b] text-white'
            : 'text-[#6b6459] hover:bg-[#f5f2ee] hover:text-[#231f1b] dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  // Mobile rail: uniform fixed-width cells, icon over a one-line short label,
  // active state as a soft orange pill instead of the heavy black block.
  const renderMobileLink = (item) => {
    const Icon = item.icon;
    const active = isItemActive(pathname, item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={`flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition ${
          active
            ? 'bg-[#fff0e4] text-[#e85d00] dark:bg-[#e85d00]/15 dark:text-[#ff9a55]'
            : 'text-[#6b6459] active:bg-[#f5f2ee] dark:text-neutral-300 dark:active:bg-neutral-900'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
        <span className="w-full truncate text-[10px] font-bold leading-tight">{item.short || item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#f5f2ee] text-[#231f1b] dark:bg-neutral-950 dark:text-white lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden min-h-[100dvh] border-r border-[#e2dcd2] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-black text-[#231f1b] dark:text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e85d00] text-xs text-white">HD</span>
          <span>HDMarket Vendeur</span>
        </Link>
        <nav className="mt-6 flex-1 space-y-5" aria-label="Navigation vendeur">
          {visibleGroups.map((group) => (
            <section key={group.label} aria-labelledby={`seller-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <h2 id={`seller-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`} className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8a8378]">
                {group.label}
              </h2>
              <div className="mt-1 space-y-1">{group.items.map((item) => renderLink(item))}</div>
            </section>
          ))}
        </nav>
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e2dcd2] px-3 text-sm font-bold text-[#6b6459] dark:border-neutral-800 dark:text-neutral-300">
          <ArrowLeft className="h-4 w-4" /> Marketplace
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#e2dcd2] bg-white/95 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden">
          <div className="flex items-center justify-between gap-3 pb-2">
            <Link to="/" aria-label="Retour à la marketplace" className="grid h-10 w-10 place-items-center rounded-full border border-[#e2dcd2] dark:border-neutral-800">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-black">Espace vendeur</p>
              <p className="text-[10px] font-bold text-[#8a8378]">Gérez votre activité</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0e4] text-[#e85d00]">
              <Store className="h-4 w-4" />
            </span>
          </div>
          <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Navigation vendeur mobile">
            {mobileItems.map((item) => renderMobileLink(item))}
          </nav>
        </header>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
