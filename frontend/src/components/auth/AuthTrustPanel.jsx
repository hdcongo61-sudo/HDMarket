import React from 'react';
import { BadgeCheck, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function AuthTrustPanel({ compact = false }) {
  const { language } = useAppSettings();
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');

  const trustItems = [
    {
      key: 'secure-auth',
      title: isFrench ? 'Authentification sécurisée' : 'Secure authentication',
      description: isFrench
        ? 'Protection active de vos sessions et connexions.'
        : 'Active protection for your sessions and sign-ins.',
      icon: ShieldCheck
    },
    {
      key: 'encrypted',
      title: isFrench ? 'Données chiffrées' : 'Encrypted data',
      description: isFrench
        ? 'Les informations sensibles sont protégées.'
        : 'Sensitive information stays protected.',
      icon: Lock
    },
    {
      key: 'verified-users',
      title: isFrench ? 'Utilisateurs vérifiés' : 'Verified users',
      description: isFrench
        ? 'Vendeurs et acheteurs validés sur la plateforme.'
        : 'Sellers and buyers are verified on the platform.',
      icon: BadgeCheck
    },
    {
      key: 'secure-payments',
      title: isFrench ? 'Paiements sécurisés' : 'Secure payments',
      description: isFrench
        ? 'Flux de paiement surveillés et renforcés.'
        : 'Payment flows are monitored and reinforced.',
      icon: CreditCard
    }
  ];

  if (compact) {
    return (
      <section className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.key} className="glass-card rounded-2xl p-3">
              <div className="flex items-start gap-2.5">
                <span className="soft-card soft-card-blue inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-800 dark:text-blue-100">
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{item.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <aside className="glass-card hidden rounded-3xl p-6 lg:block">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
        {isFrench ? 'Votre compte est sécurisé' : 'Your account is secure'}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
        {isFrench ? 'Connexion fiable sur HDMarket' : 'Reliable sign-in on HDMarket'}
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {isFrench
          ? 'Une expérience d’authentification simple, rapide et protégée.'
          : 'A simple, fast and protected authentication experience.'}
      </p>

      <div className="mt-6 space-y-3">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.key} className="soft-card soft-card-blue rounded-2xl p-3.5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/50 text-blue-800 dark:bg-black/20 dark:text-blue-100">
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">{item.title}</p>
                  <p className="mt-1 text-xs text-blue-900/85 dark:text-blue-100/90">
                    {item.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="glass-card rounded-xl px-2 py-1.5 text-center">SSL</span>
        <span className="glass-card rounded-xl px-2 py-1.5 text-center">
          {isFrench ? 'Données sûres' : 'Data Safe'}
        </span>
        <span className="glass-card rounded-xl px-2 py-1.5 text-center">
          {isFrench ? 'Vérifié' : 'Verified'}
        </span>
      </div>
    </aside>
  );
}
