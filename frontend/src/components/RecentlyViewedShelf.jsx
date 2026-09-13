import React from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import useRecentlyViewed from '../hooks/useRecentlyViewed';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { buildProductPath } from '../utils/links';

/**
 * Horizontal "Vus récemment" shelf (Taobao 浏览足迹) — device-local footprint,
 * works for logged-out browsers too. Renders nothing when empty.
 */
export default function RecentlyViewedShelf({ max = 10 }) {
  const { items, clear } = useRecentlyViewed();

  if (!items.length) return null;

  return (
    <section aria-label="Vus récemment" className="rounded-[22px] border border-[#eeeff3] bg-white p-[14px_12px] shadow-none">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="flex items-center gap-1.5 text-[13px] font-black text-[#231f1b]">
          <ClockIcon className="h-4 w-4 text-[#e85d00]" /> Vus récemment
        </p>
        <div className="flex items-center gap-1">
          <Link
            to="/recent"
            className="rounded-full px-2 py-1 text-[11px] font-black text-[#e85d00]"
          >
            Tout voir
          </Link>
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer l'historique"
            className="grid h-6 w-6 place-items-center rounded-full text-neutral-400 hover:text-neutral-700"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {items.slice(0, max).map((item) => (
          <Link
            key={item.slug || item.id}
            to={buildProductPath({ _id: item.id, slug: item.slug })}
            className="w-[110px] shrink-0 overflow-hidden rounded-2xl border border-[#eeeef2] bg-white active:scale-[0.98]"
          >
            <div className="aspect-square w-full overflow-hidden bg-[#f1ece4]">
              {item.image ? (
                <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-1.5">
              <p className="line-clamp-2 min-h-[30px] text-[10.5px] font-semibold leading-[14px] text-[#231f1b]">
                {item.title}
              </p>
              <p className="mt-1 text-[11px] font-black text-[#e85d00]">
                {formatPriceWithStoredSettings(item.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
