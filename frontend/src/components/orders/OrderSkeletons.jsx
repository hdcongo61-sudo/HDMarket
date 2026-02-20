import React from 'react';

export function OrderListSkeleton({ items = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, idx) => (
        <div
          key={`order-skeleton-${idx}`}
          className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-5 w-24 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-2 h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-6">
      <div className="h-16 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      <div className="h-52 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      <div className="h-40 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
    </div>
  );
}
