import React, { useEffect, useMemo, useState } from 'react';
import LiquidGlassCard from '../ui/liquid-notification';

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
              <LiquidGlassCard
                key={`kpi-skeleton-${index}`}
                draggable={false}
                blurIntensity="md"
                glowIntensity="xs"
                shadowIntensity="xs"
                borderRadius="16px"
                className="h-[76px] min-w-[142px] flex-1 p-4"
              >
                <div className="glass-skeleton h-full w-full animate-pulse rounded-xl" />
              </LiquidGlassCard>
            );
          }

          const toneClass = entry.toneClass || 'bg-gray-100 text-gray-700';
          return (
            <LiquidGlassCard
              key={entry.key || index}
              draggable={false}
              blurIntensity="md"
              glowIntensity="sm"
              shadowIntensity="sm"
              borderRadius="16px"
              className="min-w-[142px] flex-1 p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">{entry.label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                <AnimatedCounter value={entry.value} />
              </p>
              {entry.badge ? (
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
                  {entry.badge}
                </span>
              ) : null}
            </LiquidGlassCard>
          );
        })}
      </div>
    </section>
  );
}
