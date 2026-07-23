import React from 'react';
import { STAGE_LABELS, STAGE_ORDER } from '../../utils/deliveryUi';

export default function DeliveryDetailTimeline({ currentStage = 'ASSIGNED' }) {
  const normalizedCurrent = String(currentStage || 'ASSIGNED').toUpperCase();
  const currentIndex = Math.max(0, STAGE_ORDER.indexOf(normalizedCurrent));

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Étapes</p>
      <div className="mt-3 space-y-3">
        {STAGE_ORDER.map((stage, index) => {
          const done = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={stage} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 transition ${
                    done
                      ? 'border-emerald-500 bg-emerald-500'
                      : isCurrent
                        ? 'border-[#FF6A00] bg-[#FF6A00] shadow-[0_0_0_4px_rgba(255,106,0,0.15)]'
                        : 'border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                  }`}
                />
                {index < STAGE_ORDER.length - 1 ? (
                  <span className={`mt-1 h-6 w-px ${done ? 'bg-emerald-300' : 'bg-gray-200 dark:bg-neutral-800'}`} />
                ) : null}
              </div>
              <p
                className={`text-sm ${
                  done
                    ? 'font-black text-gray-900 dark:text-white'
                    : isCurrent
                      ? 'font-black text-[#FF6A00]'
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {STAGE_LABELS[stage] || stage}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
