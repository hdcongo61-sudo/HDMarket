import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

export default function ShopNotFound({ t }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <GlassCard className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Store size={24} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('shop_profile.not_found_title', 'Boutique introuvable')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t('shop_profile.not_found_message', "Cette boutique n'existe pas ou n'est plus disponible.")}
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          {t('shop_profile.back_home', "Retour à l'accueil")}
        </Link>
      </GlassCard>
    </main>
  );
}

