import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bike, ClipboardList, History, UserRound } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'missions', label: 'Missions', to: '/delivery/dashboard', icon: ClipboardList },
  { key: 'history', label: 'Historique', to: '/delivery/history', icon: History },
  { key: 'profile', label: 'Profil', to: '/delivery/profile', icon: UserRound }
];

const isNavItemActive = (pathname, item) => {
  if (item.key === 'missions') {
    return pathname === '/delivery' ||
      pathname.startsWith('/delivery/dashboard') ||
      pathname.startsWith('/delivery/assignment/');
  }
  return pathname.startsWith(item.to);
};

export default function DeliveryAppShell() {
  const { pathname } = useLocation();
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#f4f6f8] text-slate-950 dark:bg-[#090d12] dark:text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-[#0b1f33] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ff6a00] shadow-lg shadow-orange-950/30">
            <Bike className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-black tracking-tight">HDMarket Delivery</p>
            <p className="text-[11px] font-semibold text-slate-300">Centre opérationnel</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <p className="text-xs font-black">{online ? 'Connecté au réseau' : 'Mode hors connexion'}</p>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">
            {online ? 'Missions et positions synchronisées.' : 'Les données seront resynchronisées au retour du réseau.'}
          </p>
        </div>

        <nav className="mt-6 space-y-2" aria-label="Navigation livraison">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black transition ${
                  active ? 'bg-white text-[#0b1f33] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-[#ff6a00]' : ''}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-[#102d49] p-4">
          <p className="text-xs font-black">Sécurité de livraison</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">
            Le suivi GPS fonctionne uniquement pendant une mission active et s’arrête automatiquement après la livraison.
          </p>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <Outlet />
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[max(8px,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-[#0b1119]/95 lg:hidden"
        aria-label="Navigation livraison mobile"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);
            return (
              <NavLink
                key={item.key}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition active:scale-95 ${
                  active
                    ? 'bg-orange-50 text-[#d95200] dark:bg-orange-950/40 dark:text-orange-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
