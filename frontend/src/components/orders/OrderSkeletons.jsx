import React from 'react';

export function OrderListSkeleton({ items = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, idx) => (
        <div
          key={`order-skeleton-${idx}`}
          className="animate-pulse ui-card rounded-2xl p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="ui-skeleton h-4 w-28 rounded" />
            <div className="ui-skeleton h-5 w-24 rounded-full" />
          </div>
          <div className="ui-skeleton h-3 w-3/4 rounded" />
          <div className="ui-skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-6">
      <div className="ui-card ui-skeleton h-16 rounded-2xl" />
      <div className="ui-card ui-skeleton h-52 rounded-2xl" />
      <div className="ui-card ui-skeleton h-40 rounded-2xl" />
    </div>
  );
}
