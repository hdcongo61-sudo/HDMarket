import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export function OrderCommandCenter({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  actions = [],
  className = ''
}) {
  return (
    <section className={`relative overflow-hidden rounded-[28px] bg-[#171411] text-white shadow-[0_16px_45px_rgba(35,31,27,0.16)] ${className}`}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#e85d00]/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300 sm:text-[11px]">
                {eyebrow}
              </p>
            ) : null}
            {title ? <h2 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">{title}</h2> : null}
            {subtitle ? <p className="mt-1.5 max-w-xl text-xs font-semibold leading-5 text-white/62 sm:text-sm">{subtitle}</p> : null}
          </div>

          {actions.length ? (
            <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
              {actions.map((action) => {
                const Icon = action.icon;
                const toneClass = action.tone === 'dark'
                  ? 'bg-[#e85d00] text-white ring-[#e85d00]'
                  : action.tone === 'soft'
                    ? 'bg-white/10 text-white ring-white/12 hover:bg-white/16'
                    : 'bg-white text-[#231f1b] ring-white';
                const content = (
                  <>
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    <span className="whitespace-nowrap">{action.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                  </>
                );
                const classNames = `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-black ring-1 transition active:scale-[0.98] ${toneClass}`;
                return action.to ? (
                  <Link key={action.label} to={action.to} className={classNames} title={action.description}>
                    {content}
                  </Link>
                ) : (
                  <button key={action.label} type="button" onClick={action.onClick} className={classNames} title={action.description}>
                    {content}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={`mt-5 grid gap-2 ${metrics.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} sm:gap-3`}>
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="min-w-0 rounded-2xl bg-white/[0.075] p-3 ring-1 ring-white/10 backdrop-blur-sm sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-[10px] font-black uppercase tracking-wide text-white/48 sm:text-[11px]">
                      {metric.label}
                    </span>
                    <p className={`mt-1 truncate font-black tracking-tight ${index === metrics.length - 1 && String(metric.value).length > 8 ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'} ${index === 1 ? 'text-orange-300' : 'text-white'}`}>
                      {metric.value}
                    </p>
                    {metric.help ? <span className="mt-1 block truncate text-[10px] font-semibold text-white/42">{metric.help}</span> : null}
                  </div>
                  {Icon ? (
                    <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-orange-300 sm:grid">
                      <Icon className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function OrderFilterRail({ tabs = [], activeKey, counts = {}, onChange, mobile = false }) {
  return (
    <section className="rounded-2xl border border-[#e8e1d8] bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
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
              aria-pressed={active}
              className={`flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-black transition active:scale-[0.98] sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm ${
                active
                  ? 'border-[#e85d00] bg-[#e85d00] text-white shadow-sm'
                  : 'border-transparent bg-white text-neutral-600 hover:bg-[#f7f3ee] dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{tab.label}</span>
              {count > 0 ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-[#f5f2ee] text-gray-500 dark:bg-neutral-800 dark:text-neutral-300'}`}>
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
