import React from 'react';
import {
  BadgeCheck,
  CreditCard,
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

  return (
    <aside className="relative hidden min-h-[640px] overflow-hidden rounded-2xl bg-[#e85d00] p-9 text-white shadow-sm lg:block">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#e85d00_0%,#c2410c_100%)]" />
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full border border-white/20" />
      <div className="absolute -bottom-10 right-24 h-32 w-32 rounded-full border border-white/15" />

      <div className="relative flex h-full flex-col">
        <div className="my-auto">
          <h2 className="max-w-md text-[34px] font-black leading-[1.1] tracking-normal">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-md text-[15px] font-medium leading-6 text-white/84">
            {copy.subtitle}
          </p>
        <div className="mt-8 flex flex-col gap-4">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <div key={chip.label} className="flex items-center gap-3 text-sm font-bold">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/16"><Icon size={18} /></span>
                <p>{chip.label}</p>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </aside>
  );
}
