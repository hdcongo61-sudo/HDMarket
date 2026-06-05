import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, ShoppingCart } from 'lucide-react';
import { getProductCardImageUrl } from '../utils/productImageUrl';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';

/**
 * BundleDeal — "Frequently Bought Together" section for product pages.
 * Shows main product + 2-3 complementary products with a bundle discount.
 */
export default function BundleDeal({ bundleData, onAddAll }) {
  const { formatPrice, t } = useAppSettings();
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);

  if (!bundleData || !bundleData.bundle || bundleData.bundle.length === 0) return null;

  const { product, bundle, totalPrice, bundlePrice, savings, discountPercent } = bundleData;
  const allItems = [product, ...bundle].filter(Boolean);

  const handleAddAll = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await onAddAll?.(allItems);
      showToast(t('bundle.added', 'Ensemble ajouté au panier !'), { variant: 'success' });
    } catch {
      showToast(t('bundle.error', 'Erreur lors de l\'ajout au panier.'), { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50/40 to-emerald-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Package size={16} className="text-green-600" />
        <h3 className="text-sm font-bold text-gray-900">
          {t('bundle.title', 'Souvent achetés ensemble')}
        </h3>
      </div>

      {/* Product chain */}
      <div className="flex flex-wrap items-center gap-2">
        {allItems.map((item, idx) => (
          <React.Fragment key={item._id}>
            {idx > 0 && (
              <Plus size={16} className="shrink-0 text-gray-400" />
            )}
            <Link
              to={item.slug ? `/product/${item.slug}` : '#'}
              className={`flex flex-col items-center rounded-xl border bg-white p-2 shadow-sm transition hover:shadow-md ${
                idx === 0 ? 'border-orange-200 ring-1 ring-orange-100' : 'border-gray-100'
              }`}
              style={{ width: '80px' }}
            >
              <div className="mb-1 h-14 w-14 overflow-hidden rounded-lg bg-gray-50">
                {item.image ? (
                  <img
                    src={getProductCardImageUrl(item.image)}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <Package size={16} />
                  </div>
                )}
              </div>
              <p className="line-clamp-1 text-center text-[10px] font-medium text-gray-700">
                {item.title}
              </p>
              <span className="mt-0.5 text-[11px] font-bold text-gray-900">
                {formatPrice(item.price)}
              </span>
            </Link>
          </React.Fragment>
        ))}
      </div>

      {/* Price summary */}
      <div className="mt-4 rounded-xl bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('bundle.total', 'Prix total')}</span>
          <span className="font-semibold">{formatPrice(totalPrice)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm font-bold text-green-700">
            🎁 {t('bundle.bundlePrice', 'Ensemble')} (-{discountPercent}%)
          </span>
          <span className="text-lg font-black text-green-700">{formatPrice(bundlePrice)}</span>
        </div>
        {savings > 0 && (
          <p className="mt-0.5 text-right text-xs text-green-600">
            {t('bundle.savings', 'Économisez')} {formatPrice(savings)}
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={handleAddAll}
        disabled={adding}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        <ShoppingCart size={16} />
        {adding
          ? t('bundle.adding', 'Ajout...')
          : t('bundle.addAll', 'Ajouter l\'ensemble au panier')}
      </button>
    </div>
  );
}
