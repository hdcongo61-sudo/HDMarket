import React from 'react';
import { STAGE_LABELS, STAGE_ORDER } from '../../utils/deliveryUi';

export default function DeliveryDetailTimeline({ currentStage = 'ASSIGNED' }) {
  const normalizedCurrent = String(currentStage || 'ASSIGNED').toUpperCase();
  const currentIndex = Math.max(0, STAGE_ORDER.indexOf(normalizedCurrent));

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Timeline</p>
      <div className="mt-3 space-y-3">
        {STAGE_ORDER.map((stage, index) => {
          const done = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={stage} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 rounded-full border-2 transition ${
                    done ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300 bg-white'
                  } ${isCurrent ? 'shadow-[0_0_0_4px_rgba(16,185,129,0.12)]' : ''}`}
                />
                {index < STAGE_ORDER.length - 1 ? (
                  <span className={`mt-1 h-6 w-px ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                ) : null}
              </div>
              <p className={`text-sm ${done ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                {STAGE_LABELS[stage] || stage}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
