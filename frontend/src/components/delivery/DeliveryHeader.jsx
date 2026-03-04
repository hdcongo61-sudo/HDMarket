import React from 'react';
import { Link } from 'react-router-dom';

export default function DeliveryHeader({ title, subtitle, online = true, actions = [] }) {
  return (
    <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-30 -mx-3 border-b border-white/40 glass-header px-3 pb-3 pt-2 sm:-mx-5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">Delivery mode</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{subtitle}</p>
        </div>
        <span
          className={`inline-flex min-h-[32px] items-center rounded-full px-2.5 text-xs font-semibold soft-card ${
            online ? 'soft-card-green text-emerald-700 dark:text-emerald-100' : 'soft-card-red text-red-700 dark:text-red-100'
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
                ? 'soft-card soft-card-red text-red-700 dark:text-red-100'
                : 'glass-card text-slate-700 dark:text-slate-100';
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
