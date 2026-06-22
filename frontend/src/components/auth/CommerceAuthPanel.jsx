import React from 'react';
import {
  BadgeCheck,
  CreditCard,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck
} from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function CommerceAuthPanel({ mode = 'login', logoSrc = '' }) {
  const { language } = useAppSettings();
  const isFrench = String(language || 'fr').toLowerCase().startsWith('fr');
  const isRegister = mode === 'register';

  const copy = {
    eyebrow: isFrench ? 'Marketplace HDMarket' : 'HDMarket Marketplace',
    title: isRegister
      ? isFrench
        ? 'Ouvrez votre compte et entrez dans le marché.'
        : 'Open your account and enter the market.'
      : isFrench
        ? 'Reprenez vos achats, commandes et messages.'
        : 'Resume your shopping, orders, and messages.',
    subtitle: isFrench
      ? 'Un espace commerce rapide, clair et sécurisé pour acheter, vendre et suivre chaque étape.'
      : 'A fast, clear, secure commerce space for buying, selling, and tracking every step.',
    search: isFrench ? 'Rechercher produits, boutiques, commandes' : 'Search products, shops, orders',
    verified: isFrench ? 'Boutiques vérifiées' : 'Verified shops',
    payment: isFrench ? 'Paiements suivis' : 'Tracked payments',
    delivery: isFrench ? 'Livraison locale' : 'Local delivery',
    order: isFrench ? 'Commande protégée' : 'Protected order',
    seller: isFrench ? 'Vendeur actif' : 'Active seller',
    ready: isFrench ? 'Compte prêt' : 'Account ready',
    statOrders: isFrench ? 'Commandes' : 'Orders',
    statShops: isFrench ? 'Boutiques' : 'Shops',
    statSupport: isFrench ? 'Support' : 'Support'
  };

  const chips = [
    { label: copy.verified, icon: BadgeCheck },
    { label: copy.payment, icon: CreditCard },
    { label: copy.delivery, icon: Truck }
  ];

  const activity = [
    { label: copy.order, value: isFrench ? 'Suivi en direct' : 'Live tracking', icon: PackageCheck },
    { label: copy.seller, value: isFrench ? 'Réponse rapide' : 'Fast response', icon: Store },
    { label: copy.ready, value: isFrench ? 'Session protégée' : 'Protected session', icon: ShieldCheck }
  ];

  return (
    <aside className="relative hidden min-h-[640px] overflow-hidden rounded-2xl bg-[#FF6A00] p-6 text-white shadow-sm lg:block">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.20),transparent_34%),radial-gradient(circle_at_88%_14%,rgba(255,255,255,0.26),transparent_28%),linear-gradient(180deg,#ff7a00_0%,#f45100_52%,#d83b00_100%)]" />
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full border border-white/20" />
      <div className="absolute -bottom-10 right-24 h-32 w-32 rounded-full border border-white/15" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-2 text-xs font-black uppercase tracking-wide ring-1 ring-white/18">
            <ShoppingBag size={14} />
            {copy.eyebrow}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg">
            <img src={logoSrc} alt="HDMarket" className="h-8 w-8 object-contain" />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="max-w-md text-5xl font-black leading-[0.98] tracking-normal">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-md text-[15px] font-medium leading-6 text-white/84">
            {copy.subtitle}
          </p>
        </div>

        <div className="mt-8 rounded-xl bg-white p-2 text-slate-900 shadow-sm">
          <div className="flex items-center gap-2 rounded border border-[#FF6A00] bg-orange-50 px-3 py-3">
            <Search size={18} className="text-[#FF6A00]" />
            <span className="text-sm font-bold text-slate-700">{copy.search}</span>
            <span className="ml-auto rounded-full bg-[#FF6A00] px-3 py-1.5 text-xs font-black text-white">
              HD
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <div key={chip.label} className="rounded-xl bg-white/14 p-3 ring-1 ring-white/16">
                <Icon size={18} />
                <p className="mt-2 text-xs font-black leading-4">{chip.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-auto rounded-2xl bg-white p-4 text-slate-950 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-orange-600">HDMarket Live</p>
              <p className="mt-1 text-lg font-black">{isFrench ? 'Tableau commerce' : 'Commerce board'}</p>
            </div>
            <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]" />
          </div>

          <div className="space-y-2">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#FF6A00] shadow-sm">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{item.label}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['24/7', copy.statSupport],
              ['+1K', copy.statShops],
              ['Live', copy.statOrders]
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-slate-950 px-2 py-2 text-white">
                <p className="text-sm font-black">{value}</p>
                <p className="text-[10px] font-bold text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
