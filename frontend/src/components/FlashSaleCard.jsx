import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { getProductCardImageUrl } from '../utils/productImageUrl';
import { useAppSettings } from '../context/AppSettingsContext';

/**
 * FlashSaleCard — Product card for flash sales with countdown & discount badge.
 */
export default function FlashSaleCard({ flashSale, onExpired, compact = false }) {
  const { formatPrice, t } = useAppSettings();
  const product = flashSale?.product;
  if (!flashSale || !product) return null;

  const image = product.images?.[0] || '';
  const imgSrc = getProductCardImageUrl(image);
  const discount = flashSale.discountPercent || Math.round(
    ((flashSale.originalPrice - flashSale.flashPrice) / flashSale.originalPrice) * 100
  );

  const productLink = `/product/${product.slug || product._id}`;

  return (
    <Link
      to={productLink}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm transition hover:shadow-md ${
        compact ? '' : 'min-w-[160px] max-w-[180px]'
      }`}
    >
      {/* Discount Badge */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
        <Zap size={10} className="fill-white" />
        -{discount}%
      </div>

      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.title || ''}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <Zap size={24} />
          </div>
        )}
        {/* Countdown overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
          <CountdownTimer
            endDate={flashSale.endDate}
            onExpired={onExpired}
            className="text-[11px]"
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-gray-800">
          {product.title}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-red-600">
            {formatPrice(flashSale.flashPrice)}
          </span>
          <span className="text-[11px] text-gray-400 line-through">
            {formatPrice(flashSale.originalPrice)}
          </span>
        </div>
      </div>
    </Link>
  );
}
