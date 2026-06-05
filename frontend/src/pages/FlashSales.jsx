import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Flame } from 'lucide-react';
import FlashSaleCard from '../components/FlashSaleCard';
import { useFlashSales } from '../hooks/useFlashSales';
import { useAppSettings } from '../context/AppSettingsContext';

export default function FlashSales() {
  const { t } = useAppSettings();
  const { data, isLoading, isError } = useFlashSales({ limit: 50 });

  const flashSales = data?.items || [];

  return (
    <div className="hd-profile-flow hd-commerce-shell min-h-screen">
      {/* Header */}
      <header className="ui-glass-header sticky top-20 z-20 border-b border-red-100">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center"
            aria-label={t('flashSales.back', 'Retour')}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
              <Zap size={16} className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {t('flashSales.title', 'Bons Plans Flash')}
              </h1>
              <p className="text-xs text-red-500 font-medium">
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
            <Flame size={48} className="mb-4 text-gray-300" />
            <p className="text-sm text-gray-500">
              {t('flashSales.error', 'Impossible de charger les ventes flash. Réessayez.')}
            </p>
          </div>
        ) : flashSales.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Zap size={48} className="mb-4 text-gray-300" />
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
