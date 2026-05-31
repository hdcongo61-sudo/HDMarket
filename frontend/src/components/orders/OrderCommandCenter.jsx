import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const toneClasses = {
  dark: 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950',
  light: 'bg-white text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50',
  soft: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
};

export function OrderCommandCenter({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  actions = [],
  className = ''
}) {
  return (
    <section className={`overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 sm:p-6 lg:p-7">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-normal text-neutral-950 dark:text-white sm:text-3xl">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
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
        </div>

        <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 lg:border-l lg:border-t-0">
          <div className="space-y-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const content = (
                <>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${toneClasses[action.tone || 'soft'] || toneClasses.soft}`}>
                    {Icon ? <Icon className="h-4 w-4" /> : null}
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
                'flex min-h-[56px] items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700';

              return action.to ? (
                <Link key={action.label} to={action.to} className={className}>
                  {content}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`${className} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OrderFilterRail({ tabs = [], activeKey, counts = {}, onChange, mobile = false }) {
  return (
    <section className="rounded-[22px] border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div
        className={`flex gap-1.5 ${mobile ? 'hide-scrollbar -mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory' : 'flex-wrap'}`}
        style={mobile ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeKey;
          const count = Number(counts[tab.key] || 0);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange?.(tab.key)}
              className={`flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-bold transition active:scale-[0.98] ${
                active
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{tab.label}</span>
              {count > 0 ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/15 text-white dark:bg-neutral-950/10 dark:text-neutral-950' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
