import React from 'react';
import GlassCard from '../ui/GlassCard';
import { ShimmerBlock } from '../ui/ShimmerSkeleton';

export default function ShopLoadingSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-6">
      <GlassCard className="mb-4">
        <ShimmerBlock className="h-5 w-1/3" />
        <ShimmerBlock className="mt-2 h-4 w-1/2" />
      </GlassCard>

      <GlassCard className="overflow-hidden p-0">
        <ShimmerBlock className="h-44 w-full sm:h-60" />
        <div className="p-4">
          <ShimmerBlock className="h-6 w-2/5" />
          <ShimmerBlock className="mt-2 h-4 w-3/4" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <ShimmerBlock key={item} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </GlassCard>
    </main>
  );
}

