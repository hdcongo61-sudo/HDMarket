import React from 'react';

export function OrderCommandCenter({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  actions = [],
  className = ''
}) {
  return (
    <section className={`${className}`}>
          <div className="grid grid-cols-3 gap-2">
            {metrics.slice(0, 3).map((metric, index) => {
              return (
                <div
                  key={metric.label}
                  className="min-w-0 rounded-[14px] border border-[#eee8e0] bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-3"
                >
                  <span className="block truncate text-[11px] font-bold text-[#8a8378] dark:text-neutral-400">
                    {metric.label}
                  </span>
                  <p className={`mt-0.5 truncate font-black ${index === 2 ? 'text-[15px]' : 'text-[18px]'} ${index === 1 ? 'text-[#c2410c]' : 'text-[#231f1b] dark:text-white'}`}>
                    {metric.value}
                  </p>
                </div>
              );
            })}
          </div>
    </section>
  );
}

export function OrderFilterRail({ tabs = [], activeKey, counts = {}, onChange, mobile = false }) {
  return (
    <section className="bg-white py-1 dark:bg-neutral-950">
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
              className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition active:scale-[0.98] sm:gap-2 sm:text-sm ${
                active
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-gray-200 bg-white text-neutral-600 hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{tab.label}</span>
              {count > 0 ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/18 text-white' : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-300'}`}>
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
