import React from 'react';
import {
  BadgeCheck,
  CreditCard,
  Truck
} from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function CommerceAuthPanel({ mode = 'login' }) {
  const { language } = useAppSettings();
  const isFrench = String(language || 'fr').toLowerCase().startsWith('fr');
  const isRegister = mode === 'register';

  const copy = {
    title: isRegister
      ? isFrench
        ? 'Vos commandes, vos vendeurs, vos livraisons — au même endroit.'
        : 'Your orders, sellers and deliveries — all in one place.'
      : isFrench
        ? 'Vos commandes, vos vendeurs, vos livraisons — au même endroit.'
        : 'Your orders, sellers and deliveries — all in one place.',
    verified: isFrench ? 'Boutiques vérifiées' : 'Verified shops',
    payment: isFrench ? 'Paiements suivis' : 'Tracked payments',
    delivery: isFrench ? 'Livraison locale' : 'Local delivery',
    verifiedNote: isFrench ? 'Vendeurs contrôlés avant mise en ligne' : 'Sellers reviewed before going live',
    paymentNote: isFrench ? 'Chaque étape est tracée sur votre compte' : 'Every step is tracked in your account',
    deliveryNote: isFrench ? "Suivi du coursier jusqu'à votre adresse" : 'Courier tracking all the way to your address'
  };

  const chips = [
    { label: copy.verified, note: copy.verifiedNote, icon: BadgeCheck },
    { label: copy.payment, note: copy.paymentNote, icon: CreditCard },
    { label: copy.delivery, note: copy.deliveryNote, icon: Truck }
  ];

  return (
    <aside className="hidden h-full min-h-[640px] bg-[#e85d00] px-16 py-14 text-white lg:flex lg:flex-col lg:justify-center">
        <div>
          <h2 className="max-w-[360px] text-[30px] font-black leading-[1.2] tracking-[-0.02em]">
            {copy.title}
          </h2>
        <div className="mt-8 flex flex-col">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <div key={chip.label} className="flex items-center gap-3.5 border-t border-white/20 py-4">
                <Icon size={20} className="shrink-0" />
                <div>
                  <p className="text-[15px] font-extrabold">{chip.label}</p>
                  <p className="mt-0.5 text-[13.5px] font-medium text-white/80">{chip.note}</p>
                </div>
              </div>
            );
          })}
        </div>
        </div>
    </aside>
  );
}
