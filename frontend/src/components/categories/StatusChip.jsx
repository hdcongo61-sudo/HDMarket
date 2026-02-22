import React from 'react';

const variants = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  hidden: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  deleted: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-300'
};

export default function StatusChip({ type = 'active', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[type] || variants.active}`}>
      {children}
    </span>
  );
}
