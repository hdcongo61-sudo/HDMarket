import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw } from 'lucide-react';

const toneStyles = {
  dark: 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950',
  red: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
};

export function AdminCommandHero({
  eyebrow,
  title,
  subtitle,
  meta,
  metrics = [],
  actions = [],
  className = ''
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5 sm:p-6 lg:p-7">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-neutral-950 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {meta}
            </p>
          ) : null}

          {metrics.length ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                        {metric.label}
                      </span>
                      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> : null}
                    </div>
                    <p className="mt-2 truncate text-lg font-bold text-neutral-950 dark:text-white">
                      {metric.value}
                    </p>
                    {metric.help ? (
                      <p className="mt-1 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        {metric.help}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {actions.length ? (
          <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 lg:border-l lg:border-t-0">
            <div className="space-y-2">
              {actions.map((action) => {
                const Icon = action.icon;
                const content = (
                  <>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${toneStyles[action.tone || 'neutral'] || toneStyles.neutral}`}>
                      {action.loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-neutral-950 dark:text-white">
                        {action.label}
                      </span>
                      {action.description ? (
                        <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {action.description}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </>
                );
                const className =
                  'flex min-h-[56px] items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700';

                return action.to ? (
                  <Link key={action.label} to={action.to} className={className}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    className={`${className} w-full`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AdminSegmentedControl({ options = [], value, onChange, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {options.map((option) => {
          const active = String(option.value || '') === String(value || '');
          const Icon = option.icon;
          return (
            <button
              key={option.value || 'all'}
              type="button"
              onClick={() => onChange?.(option.value)}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-bold transition active:scale-[0.98] ${
                active
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{option.label}</span>
              {Number(option.count || 0) > 0 ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/15 text-white dark:bg-neutral-950/10 dark:text-neutral-950' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                  {Number(option.count) > 99 ? '99+' : Number(option.count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
