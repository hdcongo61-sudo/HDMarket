import React from 'react';
import { ShimmerBlock } from './ui/ShimmerSkeleton';
import ProductCardSkeleton from './ProductCardSkeleton';

/**
 * Generic marketplace-style skeleton shown while a lazy-loaded page chunk is
 * being fetched. Pure placeholder, no spinner and no text — the real page
 * replaces it as soon as its code is ready.
 */
export default function RoutePageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chargement du contenu"
    >
      {/* Hero banner */}
      <ShimmerBlock className="h-32 w-full rounded-2xl sm:h-40 lg:h-44" />

      {/* Category / filter chips */}
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <ShimmerBlock
            key={`route-chip-skeleton-${index}`}
            className={`${index % 2 === 0 ? 'w-20' : 'w-14'} h-8 shrink-0 rounded-full`}
          />
        ))}
      </div>

      {/* Section header */}
      <div className="mt-6 space-y-2">
        <ShimmerBlock className="h-5 w-40 rounded-full" />
        <ShimmerBlock className="h-3 w-56 max-w-full rounded-full" />
      </div>

      {/* Product grid */}
      <div className="mt-4">
        <ProductCardSkeleton count={8} viewMode="masonry" homeFeed />
      </div>
    </div>
  );
}
