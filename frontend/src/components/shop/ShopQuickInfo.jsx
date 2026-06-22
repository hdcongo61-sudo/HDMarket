import React from 'react';

export default function ShopQuickInfo({ openingSummary, trustQuickInfo, t }) {
  return (
    <section className="overflow-hidden rounded-none bg-white px-4 py-3.5 shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate border-l-[3px] border-[#FF6A00] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
          {t('shop_profile.trust_badges', 'Confiance & vérification')}
        </h2>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold ${
            openingSummary?.isOpen
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${openingSummary?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {openingSummary?.isOpen
            ? t('shop_profile.open_now', 'Ouvert maintenant')
            : t('shop_profile.closed', 'Fermé')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {trustQuickInfo.map((item) => (
          <article
            key={item.id}
            className="rounded border border-gray-100 bg-gray-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <span className="text-[#FF6A00] dark:text-orange-300">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] font-black leading-tight text-gray-900 dark:text-white">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
