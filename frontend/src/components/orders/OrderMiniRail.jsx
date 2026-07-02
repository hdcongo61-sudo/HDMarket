import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Compact version of the order-detail hero rail for list cards: an animated
// fill with lifecycle stop dots, so a list scan answers "where is each order?".
// `progress` is 0–100 (from getOrderUiState); `stops` is the number of
// lifecycle stops (5 classic, 4 installment).
export default function OrderMiniRail({
  progress = 0,
  stops = 5,
  urgent = false,
  label = '',
  className = ''
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className={className}>
      {label ? (
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-bold text-gray-500">{label}</p>
          <span className={`shrink-0 text-[11px] font-black ${urgent ? 'text-red-600' : 'text-[#FF6A00]'}`}>
            {pct}%
          </span>
        </div>
      ) : null}
      <div className="relative mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            urgent ? 'bg-red-500' : 'bg-gradient-to-r from-[#FFB000] to-[#FF6A00]'
          }`}
          initial={reduceMotion ? { width: `${pct}%` } : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut', delay: reduceMotion ? 0 : 0.15 }}
        />
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
          {Array.from({ length: stops }).map((_, index) => {
            const stopPct = stops > 1 ? (index / (stops - 1)) * 100 : 100;
            const reached = pct >= stopPct - 1;
            return (
              <span
                key={index}
                className={`h-2 w-2 rounded-full border-2 border-white dark:border-neutral-950 ${
                  reached
                    ? urgent
                      ? 'bg-red-500'
                      : 'bg-[#FF6A00]'
                    : 'bg-gray-200 dark:bg-neutral-700'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
