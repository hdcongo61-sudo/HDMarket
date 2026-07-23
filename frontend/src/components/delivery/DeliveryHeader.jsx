import React from 'react';
import { Link } from 'react-router-dom';

export default function DeliveryHeader({ title, subtitle, online = true, actions = [] }) {
  return (
    <header className="-mx-3 border-b border-gray-100 bg-white px-3 pb-3 pt-2 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950 sm:-mx-5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">HDMarket Delivery</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <span
          className={`inline-flex min-h-[32px] items-center rounded-full border px-2.5 text-xs font-semibold ${
            online
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
          }`}
        >
          {online ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>

      {actions.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {actions.map((action) => {
            const Icon = action.icon;
            const className =
              action.tone === 'danger'
                ? 'border border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
                : 'border border-gray-100 bg-gray-50 text-gray-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-200';
            const content = (
              <>
                {Icon ? <Icon size={14} /> : null}
                {action.label}
              </>
            );

            if (action.to) {
              return (
                <Link
                  key={action.key}
                  to={action.to}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${className}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${className}`}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
