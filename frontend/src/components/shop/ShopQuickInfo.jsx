import React from 'react';

export default function ShopQuickInfo({ openingSummary, trustQuickInfo, t }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900 sm:text-lg">
          {t('shop_profile.trust_badges', 'Confiance & vérification')}
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            openingSummary?.isOpen
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
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

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {trustQuickInfo.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
          >
            <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              <span className="text-gray-700">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </p>
            <p className="mt-2 text-[13px] font-semibold text-gray-900">{item.value}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
