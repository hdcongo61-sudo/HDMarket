import React from 'react';
import GlassCard from '../ui/GlassCard';

export default function ShopQuickInfo({ openingSummary, trustQuickInfo, t }) {
  return (
    <GlassCard className="min-w-0 space-y-3 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('shop_profile.trust_badges', 'Confiance & vérification')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t('shop_profile.quick_info_subtitle', 'Informations en direct de la boutique')}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            openingSummary?.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              openingSummary?.isOpen ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="truncate">
            {openingSummary?.isOpen
              ? t('shop_profile.open_now', 'Ouvert maintenant')
              : t('shop_profile.closed', 'Fermé')}
          </span>
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 max-[340px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        {trustQuickInfo.map((item) => (
          <article
            key={item.id}
            className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2.5 dark:bg-slate-800/70 sm:px-3"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </p>
            <p className="mt-1 break-words text-[13px] font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
              {item.value}
            </p>
          </article>
        ))}
      </div>
    </GlassCard>
  );
}
