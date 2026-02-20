import React from 'react';

export default function NotificationSkeleton({ count = 6 }) {
  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`notification-skeleton-${index}`} className="animate-pulse py-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-2 w-12 rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
