import React from 'react';

const tones = {
  neutral: 'bg-[var(--v2-surface-soft)] text-[var(--v2-text-soft)] border-[var(--v2-line)]',
  accent: 'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:border-neutral-900',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  danger: 'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:border-neutral-900'
};

export default function V2Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
}
