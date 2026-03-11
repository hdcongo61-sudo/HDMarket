import React from 'react';
import LiquidGlassCard from '../ui/liquid-notification';

export default function DeliverySkeleton({ count = 3, compact = false }) {
  return (
    <div className={`space-y-3 ${compact ? '' : 'pt-1'}`}>
      {new Array(Math.max(1, Number(count) || 1)).fill(0).map((_, index) => (
        <LiquidGlassCard
          key={`delivery-skeleton-${index}`}
          draggable={false}
          blurIntensity="md"
          glowIntensity="xs"
          shadowIntensity="xs"
          borderRadius="16px"
          className="overflow-hidden p-4 shadow-sm"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 grid grid-cols-[48px_1fr] gap-3">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
            <div className="space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </LiquidGlassCard>
      ))}
    </div>
  );
}
