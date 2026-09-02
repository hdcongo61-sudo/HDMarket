import React from 'react';
import { CheckBadgeIcon, TruckIcon } from '@heroicons/react/24/outline';

/**
 * Taobao-style trust services strip ("Paiements suivis · Livraison locale · Retrait disponible").
 * Pure display — surfaces the shop's trust facts in one compact scrollable row.
 */
export default function ShopQuickInfo({ openingSummary, trustQuickInfo, hasFreeDelivery, t }) {
  const items = Array.isArray(trustQuickInfo) ? trustQuickInfo : [];

  return (
    <section className="overflow-hidden rounded-none bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-center gap-4">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold ${
              openingSummary?.isOpen ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${openingSummary?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            {openingSummary?.isOpen
              ? t('shop_profile.open_now', 'Ouvert maintenant')
              : t('shop_profile.closed', 'Fermé')}
          </span>

          {hasFreeDelivery && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#FF5000]">
              <TruckIcon className="h-[13px] w-[13px]" />
              {t('shop_profile.free_delivery', 'Livraison gratuite')}
            </span>
          )}

          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-neutral-300">
            <CheckBadgeIcon className="text-[#FF5000] h-[13px] w-[13px]" />
            {t('shop_profile.tracked_payments', 'Paiements suivis')}
          </span>

          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-neutral-300"
              title={`${item.label} : ${item.value}`}
            >
              {item.icon}
              <span className="truncate">{item.value}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
