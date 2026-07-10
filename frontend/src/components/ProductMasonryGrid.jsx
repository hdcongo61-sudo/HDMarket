import React, { useEffect, useMemo, useState } from 'react';
import ProductCard from './ProductCard';

// Column counts mirror the old `columns-2 sm:columns-3 lg:columns-4 xl:columns-5`.
const getColumnCount = (width) => {
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
};

/**
 * Masonry-style feed WITHOUT CSS multi-column: `columns-*` balances by height,
 * so items hop between columns while images load (visible flicker, and the
 * reading order runs down-then-across). Here each product is pinned to a column
 * (round-robin, left-to-right order) so nothing moves once rendered.
 */
export default function ProductMasonryGrid({
  products = [],
  onProductClick,
  className = '',
  cardProps = {}
}) {
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === 'undefined' ? 2 : getColumnCount(window.innerWidth)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = null;
    const onResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setColumnCount(getColumnCount(window.innerWidth));
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const columns = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const buckets = Array.from({ length: columnCount }, () => []);
    list.forEach((product, index) => {
      buckets[index % columnCount].push(product);
    });
    return buckets;
  }, [products, columnCount]);

  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div className={`flex items-start gap-2 sm:gap-3 ${className}`.trim()}>
      {columns.map((columnProducts, columnIndex) => (
        <div key={columnIndex} className="min-w-0 flex-1">
          {columnProducts.map((product) => (
            <div key={product._id || product.slug} className="mb-2 sm:mb-3">
              <ProductCard
                p={product}
                commerceFeed
                onProductClick={onProductClick}
                {...cardProps}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
