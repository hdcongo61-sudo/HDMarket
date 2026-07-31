import React from 'react';
import GlassCard from '../ui/GlassCard';
import { ShimmerBlock } from '../ui/ShimmerSkeleton';

export default function ShopLoadingSkeleton() {
  return (
    <main className="mx-auto max-w-7xl bg-[#F6F6F6] pb-24 dark:bg-neutral-950">
      {/* Orange gradient header block */}
      <div className="bg-gradient-to-br from-[#FF5000] to-[#FF3D00] px-4 pb-14 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-10 w-10 rounded-full bg-white/25" />
          <ShimmerBlock className="h-10 flex-1 rounded-full bg-white/25" />
          <ShimmerBlock className="h-10 w-10 rounded-full bg-white/25" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ShimmerBlock className="h-14 w-14 rounded-2xl bg-white/25" />
          <div className="min-w-0 flex-1">
            <ShimmerBlock className="h-5 w-2/5 bg-white/25" />
            <ShimmerBlock className="mt-2 h-3 w-3/5 bg-white/25" />
          </div>
          <ShimmerBlock className="h-9 w-20 rounded-full bg-white/25" />
        </div>
      </div>

      {/* Overlapping stats card */}
      <div className="px-3 sm:px-6">
        <GlassCard className="-mt-9 grid grid-cols-4 gap-2 p-3">
          {[1, 2, 3, 4].map((item) => (
            <ShimmerBlock key={item} className="h-12 w-full" />
          ))}
        </GlassCard>

        {/* Tabs + grid shimmer */}
        <GlassCard className="mt-3">
          <ShimmerBlock className="h-9 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <ShimmerBlock key={item} className="h-40 w-full" />
            ))}
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
