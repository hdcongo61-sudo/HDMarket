import React from 'react';

export default function ShopQuickInfo({ openingSummary, trustQuickInfo, t }) {
  return (
    <section className="overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.65)] ring-1 ring-orange-100/80 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
            openingSummary?.isOpen
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
              : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${openingSummary?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {openingSummary?.isOpen
            ? t('shop_profile.open_now', 'Ouvert maintenant')
            : t('shop_profile.closed', 'Fermé')}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-black text-slate-950 dark:text-white sm:text-base">
          {t('shop_profile.trust_badges', 'Confiance & vérification')}
        </h2>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {trustQuickInfo.map((item) => (
          <article
            key={item.id}
            className="rounded-[20px] bg-[#fff8f1] px-3 py-3 ring-1 ring-orange-100/70 dark:bg-neutral-900 dark:ring-neutral-800"
          >
            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className="text-[#FF6A00] dark:text-orange-300">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] font-black leading-tight text-slate-950 dark:text-white">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
