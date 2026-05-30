import React from 'react';
import { ShimmerBlock } from './ui/ShimmerSkeleton';

export default function ProductCardSkeleton({
  count = 8,
  viewMode = 'grid',
  compact = false,
  className = ''
}) {
  const isList = viewMode === 'list';

  return (
    <div
      className={
        className ||
        (isList
          ? 'space-y-3'
          : 'grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4')
      }
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`product-card-skeleton-${index}`}
          className={`overflow-hidden border border-neutral-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 ${
            isList ? 'flex rounded-[22px]' : 'rounded-[22px]'
          }`}
        >
          <ShimmerBlock
            className={
              isList
                ? 'h-auto min-h-[132px] w-[38%] shrink-0 rounded-none'
                : `${compact ? 'aspect-square' : 'aspect-[4/5]'} rounded-none`
            }
          />
          <div className={`${isList ? 'flex-1 p-3' : 'p-3'} space-y-2.5`}>
            <ShimmerBlock className="h-3 w-4/5 rounded-full" />
            <ShimmerBlock className="h-3 w-3/5 rounded-full" />
            <ShimmerBlock className="h-5 w-2/5 rounded-full" />
            <div className="flex items-center gap-2 pt-1">
              <ShimmerBlock className="h-8 flex-1 rounded-xl" />
              <ShimmerBlock className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
