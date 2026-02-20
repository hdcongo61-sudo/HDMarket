import React from 'react';

const variants = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  hidden: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  deleted: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
};

export default function StatusChip({ type = 'active', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[type] || variants.active}`}>
      {children}
    </span>
  );
}
