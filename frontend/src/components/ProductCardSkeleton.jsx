import React from 'react';
import { ShimmerBlock } from './ui/ShimmerSkeleton';

export default function ProductCardSkeleton({
  count = 8,
  viewMode = 'grid',
  compact = false,
  homeFeed = false,
  className = ''
}) {
  const isList = viewMode === 'list';
  const isMasonry = viewMode === 'masonry';

  return (
    <div
      className={
        className ||
        (isList
          ? 'space-y-3'
          : isMasonry
          ? 'columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5'
          : 'grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4')
      }
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`product-card-skeleton-${index}`}
          className={`overflow-hidden bg-white dark:bg-neutral-950 ${homeFeed ? 'rounded-[18px] ring-1 ring-inset ring-[#ece5db] dark:ring-neutral-800' : 'border border-neutral-100 shadow-sm dark:border-neutral-800'} ${
            isList ? 'flex rounded-2xl' : `${homeFeed ? '' : 'rounded-[14px]'} ${isMasonry ? 'mb-2 break-inside-avoid sm:mb-3' : ''}`
          }`}
        >
          <ShimmerBlock
            className={
              isList
                ? 'h-auto min-h-[132px] w-[38%] shrink-0 rounded-none'
                : isMasonry
                ? `${index % 5 === 1 || index % 5 === 4 ? 'aspect-[4/5]' : 'aspect-square'} rounded-none`
                : `${compact ? 'aspect-square' : 'aspect-[4/5]'} rounded-none ${homeFeed ? 'bg-[#f1ece4]' : ''}`
            }
          />
          <div className={`${isList ? 'flex-1 p-3' : homeFeed ? 'space-y-1.5 px-2.5 pb-3 pt-2.5' : 'space-y-2.5 p-3'}`}>
            <ShimmerBlock className="h-3 w-4/5 rounded-full" />
            <ShimmerBlock className="h-3 w-3/5 rounded-full" />
            <ShimmerBlock className={`${homeFeed ? 'h-[17px] w-3/5' : 'h-5 w-2/5'} rounded-full`} />
            <div className="flex items-center gap-2 pt-1">
              <ShimmerBlock className={`${homeFeed ? 'h-3' : 'h-8 rounded-xl'} flex-1`} />
              <ShimmerBlock className={`${homeFeed ? 'h-9 w-9 rounded-full' : 'h-8 w-8 rounded-xl'}`} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
