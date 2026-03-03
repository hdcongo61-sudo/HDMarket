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
    <section className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-full gap-2">
        {(loading ? new Array(5).fill(0) : content).map((entry, index) => {
          if (loading) {
            return (
              <div
                key={`kpi-skeleton-${index}`}
                className="h-[76px] min-w-[142px] flex-1 animate-pulse rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 p-4"
              />
            );
          }

          const toneClass = entry.toneClass || 'bg-gray-100 text-gray-700';
          return (
            <article
              key={entry.key || index}
              className="min-w-[142px] flex-1 rounded-2xl bg-gray-50 p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{entry.label}</p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                <AnimatedCounter value={entry.value} />
              </p>
              {entry.badge ? (
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
                  {entry.badge}
                </span>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
