import React from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';

/**
 * Taobao-style shop announcement strip (公告): a scrolling marquee of shop
 * facts (opening status, delivery, certification, promos) under the hero.
 */
export default function ShopAnnouncementBar({ items = [], t }) {
  const facts = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!facts.length) return null;

  const chunk = facts.map((fact) => (
    <span key={fact} className="mx-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5000]" />
      {fact}
    </span>
  ));

  return (
    <section className="overflow-hidden border-y border-[#f3ede6] bg-white py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center">
        <span className="flex shrink-0 items-center gap-1.5 border-r border-[#f3ede6] px-3 text-[11px] font-black text-[#FF5000] dark:border-neutral-800">
          <MegaphoneIcon className="h-4 w-4" />
          {t('shop_profile.announcement', 'Annonces')}
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="shop-marquee-track">
            <div className="inline-flex items-center">{chunk}</div>
            <div className="inline-flex items-center" aria-hidden="true">{chunk}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
