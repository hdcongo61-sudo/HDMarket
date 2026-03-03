import React from 'react';
import { Link } from 'react-router-dom';

export default function DeliveryHeader({ title, subtitle, online = true, actions = [] }) {
  return (
    <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-30 -mx-3 border-b border-gray-100/70 bg-white/80 px-3 pb-3 pt-2 backdrop-blur-xl sm:-mx-5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Delivery mode</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">{title}</h1>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>
        <span
          className={`inline-flex min-h-[32px] items-center rounded-full px-2.5 text-xs font-semibold ${
            online ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-700';
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
                  className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${className}`}
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
                className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${className}`}
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
