import React from 'react';

export default function NotificationSkeleton({ count = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`notification-skeleton-${index}`}>
          <div className="w-full rounded-[22px] border border-orange-100 bg-white px-3.5 py-3.5 shadow-[0_10px_26px_rgba(117,75,36,0.06)]">
            <div className="flex items-start gap-3">
              <div className="glass-skeleton h-11 w-11 flex-shrink-0 rounded-[17px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="glass-skeleton h-3.5 w-28 rounded-full" />
                  <div className="glass-skeleton h-5 w-14 rounded-full" />
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
