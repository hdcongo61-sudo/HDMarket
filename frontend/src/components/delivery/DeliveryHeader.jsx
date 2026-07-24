import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function DeliveryHeader({ title, subtitle, online = true, actions = [] }) {
  const { pathname } = useLocation();

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
        <nav
          aria-label="Commandes de livraison"
          className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 shadow-inner dark:border-neutral-800 dark:bg-neutral-900 sm:flex sm:flex-wrap sm:gap-2 sm:rounded-xl sm:bg-white sm:p-0 sm:shadow-none dark:sm:bg-neutral-950"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            const danger = action.tone === 'danger';
            const active = Boolean(
              action.to &&
              (pathname === action.to || pathname.startsWith(`${String(action.to).replace(/\/$/, '')}/`))
            );
            const className = danger
              ? 'border-transparent bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/70 dark:text-rose-300 dark:hover:bg-rose-950 sm:border-rose-200 sm:bg-white dark:sm:border-rose-900 dark:sm:bg-rose-950/50'
              : active
                ? 'border-transparent bg-white text-[#d95500] shadow-sm ring-1 ring-orange-200 dark:bg-neutral-800 dark:text-orange-300 dark:ring-orange-900 sm:border-orange-200 sm:bg-orange-50 sm:shadow-none dark:sm:bg-orange-950/50'
                : 'border-transparent bg-transparent text-gray-700 hover:bg-white hover:text-[#d95500] hover:shadow-sm dark:text-gray-200 dark:hover:bg-neutral-800 dark:hover:text-orange-300 sm:border-gray-200 sm:bg-white sm:text-gray-800 sm:hover:border-orange-300 sm:hover:shadow-none dark:sm:border-neutral-700 dark:sm:bg-neutral-900 dark:sm:text-gray-100';
            const content = (
              <>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-auto sm:w-auto sm:rounded-none ${
                    danger
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 sm:bg-transparent dark:sm:bg-transparent'
                      : active
                        ? 'bg-orange-100 text-[#d95500] dark:bg-orange-900/50 dark:text-orange-300 sm:bg-transparent dark:sm:bg-transparent'
                        : 'bg-white text-gray-600 shadow-sm dark:bg-neutral-800 dark:text-gray-300 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent'
                  }`}
                >
                  {Icon ? (
                    <Icon
                      size={17}
                      strokeWidth={2.25}
                      className={action.loading ? 'animate-spin' : ''}
                    />
                  ) : null}
                </span>
                <span className="max-w-full text-center leading-tight sm:text-left">{action.label}</span>
              </>
            );
            const sharedClassName = `group inline-flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] font-extrabold transition duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[42px] sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${danger ? 'sm:ml-auto' : ''} ${className}`;

            if (action.to) {
              return (
                <Link
                  key={action.key}
                  to={action.to}
                  aria-current={active ? 'page' : undefined}
                  className={sharedClassName}
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
                aria-label={action.ariaLabel || action.label}
                className={sharedClassName}
              >
                {content}
              </button>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
