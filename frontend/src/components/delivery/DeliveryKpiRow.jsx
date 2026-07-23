import React, { useEffect, useMemo, useState } from 'react';

function AnimatedCounter({ value }) {
  const numeric = Number(value);
  const isNumber = Number.isFinite(numeric);
  const [displayValue, setDisplayValue] = useState(isNumber ? 0 : value);

  useEffect(() => {
    if (!isNumber) {
      setDisplayValue(value);
      return;
    }

    const from = 0;
    const to = numeric;
    const duration = 450;
    const start = performance.now();

    let rafId = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isNumber, numeric, value]);

  if (!isNumber) return <span>{String(value ?? '—')}</span>;
  return <span>{Number(displayValue || 0).toLocaleString('fr-FR')}</span>;
}

export default function DeliveryKpiRow({ items = [], loading = false }) {
  const content = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  return (
    <section className="grid grid-cols-2 gap-2">
      {(loading ? new Array(4).fill(0) : content).map((entry, index) => {
        if (loading) {
          return (
            <div
              key={`kpi-skeleton-${index}`}
              className="h-[76px] rounded-xl border border-gray-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="h-full w-full animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-900" />
            </div>
          );
        }

        const toneClass = entry.toneClass || 'bg-gray-100 text-gray-700';
        return (
          <div
            key={entry.key || index}
            className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">{entry.label}</p>
            <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">
              <AnimatedCounter value={entry.value} />
            </p>
            {entry.badge ? (
              <span className={`mt-1.5 inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
                {entry.badge}
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
