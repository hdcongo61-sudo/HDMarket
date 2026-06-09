import React from 'react';
import ProductCard from './ProductCard';

export default function ProductMasonryGrid({
  products = [],
  onProductClick,
  className = '',
  cardProps = {}
}) {
  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div
      className={
        className ||
        'columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5'
      }
    >
      {products.map((product) => (
        <div key={product._id || product.slug} className="mb-2 break-inside-avoid sm:mb-3">
          <ProductCard
            p={product}
            commerceFeed
            onProductClick={onProductClick}
            {...cardProps}
          />
        </div>
      ))}
    </div>
  );
}
