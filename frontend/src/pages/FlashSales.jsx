import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, BoltIcon, FireIcon } from '@heroicons/react/24/outline';
import FlashSaleCard from '../components/FlashSaleCard';
import { useFlashSales } from '../hooks/useFlashSales';
import { useAppSettings } from '../context/AppSettingsContext';

export default function FlashSales() {
  const { t } = useAppSettings();
  const { data, isLoading, isError } = useFlashSales({ limit: 50 });

  const flashSales = data?.items || [];

  return (
    <div className="hd-products-flow hd-commerce-shell min-h-screen">
      {/* Header */}
      <header className="border-b border-[#eee8e0] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center"
            aria-label={t('flashSales.back', 'Retour')}
          >
            <ArrowLeftIcon className="h-[18px] w-[18px]" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e85d00]">
              <BoltIcon className="text-white fill-white h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {t('flashSales.title', 'Bons Plans Flash')}
              </h1>
              <p className="text-xs text-[#e85d00] font-medium">
                {t('flashSales.subtitle', 'Offres limitées dans le temps')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-${i}`} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FireIcon className="mb-4 text-gray-300 h-12 w-12" />
            <p className="text-sm text-gray-500">
              {t('flashSales.error', 'Impossible de charger les ventes flash. Réessayez.')}
            </p>
          </div>
        ) : flashSales.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <BoltIcon className="mb-4 text-gray-300 h-12 w-12" />
            <p className="text-sm font-medium text-gray-600">
              {t('flashSales.empty', 'Aucune vente flash en ce moment')}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t('flashSales.emptySub', 'Revenez bientôt pour des offres éclair !')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {flashSales.map((fs) => (
              <FlashSaleCard key={fs._id} flashSale={fs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
