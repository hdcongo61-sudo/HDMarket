import React from 'react';

const join = (...classes) => classes.filter(Boolean).join(' ');

export function ShimmerBlock({ className = '' }) {
  return (
    <div
      className={join(
        'relative overflow-hidden rounded-xl bg-slate-200/70 dark:bg-slate-700/60',
        className
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-[shimmer_1.4s_infinite]" />
    </div>
  );
}

export default function ShimmerSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={join('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`shimmer-row-${index}`} className="glass-card rounded-2xl p-3">
          <ShimmerBlock className="h-4 w-2/5" />
          <ShimmerBlock className="mt-3 h-20 w-full rounded-2xl" />
          <div className="mt-3 flex gap-2">
            <ShimmerBlock className="h-9 w-20 rounded-lg" />
            <ShimmerBlock className="h-9 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

