import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, ShieldCheck } from 'lucide-react';

export default function ShopOpeningHoursCard({ openingSummary, isCertifiedShop, t }) {
  const [expanded, setExpanded] = useState(false);
  const hours = openingSummary?.normalizedHours || [];

  return (
    <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {t('shop_profile.opening_hours', "Horaires d'ouverture")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-neutral-950 dark:text-white">
            {openingSummary?.statusText}
          </p>
        </div>
        {isCertifiedShop && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 max-[360px]:text-[10px] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck size={12} />
            {t('shop_profile.verified', 'Vérifiée')}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="inline-flex min-w-0 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <Clock size={13} />
            <span className="truncate">{t('shop_profile.current_day', "Aujourd'hui")}</span>
          </p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-600 transition hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-800 max-[360px]:px-1.5 max-[360px]:text-[11px]"
          >
            {expanded ? t('shop_profile.hide', 'Masquer') : t('shop_profile.show', 'Afficher')}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {expanded && (
          <ul className="mt-2 space-y-1.5 text-xs">
            {hours.map((entry) => {
              const isToday = entry.day === openingSummary?.todayKey;
              return (
                <li
                  key={entry.day}
                  className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                    isToday
                      ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{entry.dayLabel}</span>
                  <span className="shrink-0 whitespace-nowrap">
                    {entry.closed
                      ? t('shop_profile.closed', 'Fermé')
                      : entry.open && entry.close
                        ? `${entry.open} - ${entry.close}`
                        : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
