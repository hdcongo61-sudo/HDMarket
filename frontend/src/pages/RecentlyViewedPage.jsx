import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import GlassHeader from '../components/categories/GlassHeader';
import useRecentlyViewed from '../hooks/useRecentlyViewed';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { buildProductPath } from '../utils/links';

export default function RecentlyViewedPage() {
  const { items, clear } = useRecentlyViewed();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <GlassHeader
        title="Vus récemment"
        subtitle={`${items.length} produit(s) consulté(s) sur cet appareil`}
        actions={
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Accueil
            </Link>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Tout effacer
              </button>
            ) : null}
          </>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <Link
                key={item.slug || item.id}
                to={buildProductPath({ _id: item.id, slug: item.slug })}
                className="ui-card ui-card-interactive overflow-hidden"
              >
                <div className="aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                  {item.image ? (
                    <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 min-h-[36px] text-xs font-semibold leading-4 text-neutral-900 dark:text-neutral-100">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm font-black text-[#e85d00]">
                    {formatPriceWithStoredSettings(item.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ui-card ui-card-lg p-10 text-center">
            <ClockIcon className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Aucun produit consulté récemment.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Les produits que vous consultez apparaîtront ici pour y revenir facilement.
            </p>
            <Link
              to="/products"
              className="mt-4 inline-flex rounded-full bg-[#e85d00] px-5 py-2.5 text-xs font-black text-white"
            >
              Découvrir des produits
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
