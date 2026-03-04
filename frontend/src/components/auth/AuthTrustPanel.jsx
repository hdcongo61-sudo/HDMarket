import React from 'react';
import { BadgeCheck, CreditCard, Lock, ShieldCheck } from 'lucide-react';

const TRUST_ITEMS = [
  {
    key: 'secure-auth',
    title: 'Authentification sécurisée',
    description: 'Protection active de vos sessions et connexions.',
    icon: ShieldCheck
  },
  {
    key: 'encrypted',
    title: 'Données chiffrées',
    description: 'Les informations sensibles sont protégées.',
    icon: Lock
  },
  {
    key: 'verified-users',
    title: 'Utilisateurs vérifiés',
    description: 'Vendeurs et acheteurs validés sur la plateforme.',
    icon: BadgeCheck
  },
  {
    key: 'secure-payments',
    title: 'Paiements sécurisés',
    description: 'Flux de paiement surveillés et renforcés.',
    icon: CreditCard
  }
];

export default function AuthTrustPanel({ compact = false }) {
  if (compact) {
    return (
      <section className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TRUST_ITEMS.map((item) => {
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
        Your account is secure
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
        Connexion fiable pour HDMarket
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Une expérience d’authentification simple, rapide et protégée.
      </p>

      <div className="mt-6 space-y-3">
        {TRUST_ITEMS.map((item) => {
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
        <span className="glass-card rounded-xl px-2 py-1.5 text-center">Data Safe</span>
        <span className="glass-card rounded-xl px-2 py-1.5 text-center">Verified</span>
      </div>
    </aside>
  );
}
