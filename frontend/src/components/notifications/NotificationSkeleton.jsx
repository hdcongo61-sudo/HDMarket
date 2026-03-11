import React from 'react';

export default function NotificationSkeleton({ count = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`notification-skeleton-${index}`} className="py-1">
          <div className="glass-card w-full rounded-2xl px-3.5 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="glass-skeleton h-10 w-10 flex-shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="glass-skeleton h-3 w-24 rounded" />
                  <div className="glass-skeleton h-2 w-12 rounded" />
                </div>
                <div className="glass-skeleton h-3 w-3/4 rounded" />
                <div className="glass-skeleton h-3 w-1/2 rounded" />
                <div className="mt-2 flex items-center gap-2">
                  <div className="glass-skeleton h-6 w-24 rounded-full" />
                  <div className="glass-skeleton h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
