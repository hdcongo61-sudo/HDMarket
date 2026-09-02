import React, { useMemo } from 'react';
import { ClockIcon, FireIcon, SparklesIcon, Squares2X2Icon, StarIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import ShimmerSkeleton from '../ui/ShimmerSkeleton';
import ProductCard from '../ProductCard';
import { buildProductPath } from '../../utils/links';
import { formatCount } from './shopProfileHelpers';
import PreviewableImage from '../media/PreviewableImage';

export default function ShopProductsSection({
  products,
  categories,
  categoryCounts,
  activeCategory,
  setActiveCategory,
  promoOnly,
  setPromoOnly,
  hasPromoProducts,
  displayProducts,
  productFeed,
  setProductFeed,
  featuredProducts,
  latestProducts,
  topSellingProducts,
  loading,
  useCompactCards,
  productSearch = '',
  onClearProductSearch,
  t,
  onGoReviews
}) {
  const productGridClass = useCompactCards
    ? 'grid w-full grid-cols-2 gap-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3';

  const promoCount = useMemo(
    () => products.filter((product) => Boolean(product?.hasActivePromo)).length,
    [products]
  );

  const activeTabId = promoOnly
    ? 'promos'
    : productFeed === 'latest'
      ? 'latest'
      : productFeed === 'featured'
        ? 'featured'
        : productFeed === 'popular'
          ? 'popular'
          : 'products';

  const goAll = () => {
    setPromoOnly(false);
    setProductFeed('all');
  };

  const TABS = [
    {
      id: 'products',
      label: t('shop_profile.tab_products', 'Produits'),
      icon: Squares2X2Icon,
      count: products.length,
      onSelect: goAll
    },
    {
      id: 'latest',
      label: t('shop_profile.tab_new', 'Nouveautés'),
      icon: ClockIcon,
      count: latestProducts.length,
      onSelect: () => {
        setPromoOnly(false);
        setProductFeed('latest');
      }
    },
    {
      id: 'promos',
      label: t('shop_profile.tab_promos', 'Promos'),
      icon: SparklesIcon,
      count: promoCount,
      disabled: !hasPromoProducts,
      onSelect: () => {
        setProductFeed('all');
        setActiveCategory('all');
        setPromoOnly(true);
      }
    },
    { id: 'reviews', label: t('shop_profile.tab_reviews', 'Avis'), icon: StarIcon, onSelect: onGoReviews }
  ];

  const activeChip =
    'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-[#FF5000] px-3.5 text-[11px] font-bold text-white transition';
  const inactiveChip =
    'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3.5 text-[11px] font-semibold text-gray-600 transition active:scale-95 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300';

  const searchQuery = String(productSearch || '').trim();
  const showPopularStrip = activeTabId === 'products' && !searchQuery;

  return (
    <section className="overflow-hidden rounded-none bg-white shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800" id="products">
      {/* ── Taobao tab row ── */}
      <div className="border-b border-gray-100 px-2 pt-2 dark:border-neutral-800">
        <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1">
            {TABS.map((tab) => {
              const isActive = activeTabId === tab.id && tab.id !== 'reviews';
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={tab.disabled}
                  onClick={tab.onSelect}
                  className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[13px] transition ${
                    isActive
                      ? 'font-black text-[#FF5000] dark:text-[#FF6A00]'
                      : 'font-semibold text-gray-500 active:scale-95 dark:text-neutral-400'
                  } ${tab.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <Icon className="h-[13px] w-[13px]" />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-[#FF5000]' : 'text-gray-400'}`}>
                      {formatCount(tab.count)}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#FF5000]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Category chips ── */}
      <div className="overflow-x-auto border-b border-gray-100 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-neutral-800">
        <div className="flex w-max items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveCategory('all'); setPromoOnly(false); setProductFeed('all'); }}
            className={activeCategory === 'all' && !promoOnly && productFeed === 'all' ? activeChip : inactiveChip}
          >
            <Squares2X2Icon className="h-[11px] w-[11px]" />
            <span>{t('shop_profile.tab_all', 'Tous')}</span>
          </button>

          {categories.length > 0 && (
            <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-neutral-700" />
          )}

          {categories.map((category) => {
            const isActive = activeCategory === category && !promoOnly;
            return (
              <button
                key={category}
                type="button"
                onClick={() => { setActiveCategory(category); setPromoOnly(false); setProductFeed('all'); }}
                className={isActive && productFeed === 'all' ? activeChip : inactiveChip}
              >
                <span className="max-w-[7rem] truncate">{category}</span>
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
                }`}>
                  {formatCount(categoryCounts[category] || 0)}
                </span>
              </button>
            );
          })}

          {(featuredProducts.length > 0 || topSellingProducts.length > 0) && (
            <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-neutral-700" />
          )}
          {featuredProducts.length > 0 && (
            <button
              type="button"
              onClick={() => { setActiveCategory('all'); setPromoOnly(false); setProductFeed('featured'); }}
              className={productFeed === 'featured' ? activeChip : inactiveChip}
            >
              <FireIcon className="h-[11px] w-[11px]" />
              <span>{t('shop_profile.tab_featured', 'Recommandés')}</span>
            </button>
          )}
          {topSellingProducts.length > 0 && (
            <button
              type="button"
              onClick={() => { setActiveCategory('all'); setPromoOnly(false); setProductFeed('popular'); }}
              className={productFeed === 'popular' ? activeChip : inactiveChip}
            >
              <TagIcon className="h-[11px] w-[11px]" />
              <span>{t('shop_profile.tab_popular', 'Populaires')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="px-3 pb-6 sm:px-4">

      {searchQuery && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-[#FF3D00] dark:bg-orange-500/10">
          <span className="min-w-0 truncate">
            {t('shop_profile.search_results', 'Résultats pour')} «{searchQuery}» ({formatCount(displayProducts.length)})
          </span>
          <button
            type="button"
            onClick={onClearProductSearch}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-500 ring-1 ring-gray-200 transition active:scale-95 dark:bg-neutral-900 dark:ring-neutral-700 dark:text-neutral-300"
          >
            <XMarkIcon className="h-[11px] w-[11px]" />
            {t('shop_profile.search_clear', 'Effacer')}
          </button>
        </div>
      )}

      {loading && <ShimmerSkeleton rows={3} />}

      {!loading && displayProducts.length > 0 && (
        <div className={`mt-3 ${productGridClass}`}>
          {displayProducts.map((product) => (
            <div key={`${product._id}-${useCompactCards ? 'compact' : 'regular'}`} className="min-w-0">
              {/* Same card style as the home page's product grid (ProductCard
                  homeFeed) — the old shopProfileCompact variant hid badges
                  and the favorite button just to save space in a way that
                  made the shop's own catalog look different from the rest
                  of the app. */}
              <ProductCard p={product} homeFeed={useCompactCards} taobaoStyle />
            </div>
          ))}
        </div>
      )}

      {!loading && displayProducts.length === 0 && (
        <div className="mt-4 rounded border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm font-semibold text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
          {searchQuery
            ? t('shop_profile.no_search_results', 'Aucun produit ne correspond à cette recherche')
            : t('shop_profile.no_products', "Cette boutique n'a pas encore de produits")}
        </div>
      )}

      {!loading && showPopularStrip && topSellingProducts.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-neutral-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[17px] font-black text-gray-900 dark:text-white">
              {t('shop_profile.popular_products', 'Produits populaires')}
            </p>
            <button
              type="button"
              onClick={() => {
                setPromoOnly(false);
                setProductFeed('popular');
              }}
              className="text-xs font-bold text-[#FF5000]"
            >
              {t('shop_profile.see_all', 'Voir tout')} ›
            </button>
          </div>
          <div className={productGridClass}>
            {topSellingProducts.map((product) => (
              <Link
                key={`top-${product._id}`}
                to={buildProductPath(product)}
                className="group min-w-0 rounded border border-gray-100 bg-white p-2 transition hover:border-gray-200 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="relative aspect-square overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                  <PreviewableImage
                    product={product}
                    src={product.images?.[0] || product.image || ''}
                    images={
                      Array.isArray(product.images) && product.images.length
                        ? product.images
                        : [product.images?.[0] || product.image || '']
                    }
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                    reportContext={{
                      contextType: 'product',
                      productId: product?._id || '',
                      productSlug: product?.slug || '',
                      productTitle: product?.title || '',
                      shopId:
                        product?.user?._id ||
                        (typeof product?.user === 'string' ? product.user : ''),
                      shopSlug: product?.user?.slug || '',
                      shopName: product?.user?.shopName || product?.user?.name || '',
                      deepLink: buildProductPath(product)
                    }}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-black text-slate-900 dark:text-neutral-100">
                  {product.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
