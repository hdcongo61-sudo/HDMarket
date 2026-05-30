import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
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
  t,
  onGoReviews
}) {
  const productGridClass = useCompactCards
    ? 'mx-auto grid w-full max-w-[380px] grid-cols-1 gap-2 min-[376px]:grid-cols-2 sm:gap-3'
    : 'grid grid-cols-2 gap-2 sm:grid-cols-3';

  const activeChip =
    'inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-neutral-950 px-3 text-xs font-semibold text-white transition dark:bg-white dark:text-neutral-950';
  const inactiveChip =
    'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200';

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" id="products">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-950 dark:text-white sm:text-xl">
            {t('shop_profile.all_products', 'Tous les produits')}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {formatCount(displayProducts.length)} {t('shop_profile.products_count', 'produits')}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoReviews}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
        >
          <span>{t('shop_profile.go_reviews', 'Avis')}</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Feed tabs */}
      <div className="mt-4 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-center gap-2">
          {[
            { id: 'all', label: t('shop_profile.tab_all', 'Tous'), count: products.length },
            { id: 'featured', label: t('shop_profile.tab_featured', 'En vedette'), count: featuredProducts.length },
            { id: 'latest', label: t('shop_profile.tab_latest', 'Nouveautés'), count: latestProducts.length },
            { id: 'popular', label: t('shop_profile.tab_popular', 'Populaires'), count: topSellingProducts.length }
          ].map((item) => {
            const isActive = productFeed === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setProductFeed(item.id)}
                className={isActive ? activeChip : inactiveChip}
              >
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? 'bg-white/20' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  {formatCount(item.count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category filters */}
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('shop_profile.filter_category', 'Catégorie')}
          </p>
          <button
            type="button"
            onClick={() => { setActiveCategory('all'); setPromoOnly(false); }}
            className="text-xs font-semibold text-neutral-500 transition hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            {t('shop_profile.reset', 'Tout')}
          </button>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={activeCategory === 'all' ? activeChip : inactiveChip}
            >
              <span>{t('shop_profile.tab_all', 'Tous')}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeCategory === 'all' ? 'bg-white/20' : 'bg-white text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400'
                }`}
              >
                {formatCount(products.length)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPromoOnly((prev) => !prev)}
              disabled={!hasPromoProducts}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                promoOnly
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                  : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
              } ${!hasPromoProducts ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Sparkles size={11} />
              <span>{t('shop_profile.promos', 'Promos')}</span>
            </button>
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={isActive ? activeChip : inactiveChip}
                >
                  <span className="max-w-[8rem] truncate">{category}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive ? 'bg-white/20' : 'bg-white text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400'
                    }`}
                  >
                    {formatCount(categoryCounts[category] || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading && <ShimmerSkeleton rows={3} />}

      {!loading && displayProducts.length > 0 && (
        <div className={`mt-4 ${productGridClass}`}>
          {displayProducts.map((product) => (
            <div key={`${product._id}-${useCompactCards ? 'compact' : 'regular'}`} className="min-w-0">
              <ProductCard
                p={product}
                hideMobileDiscountBadge
                compactMobile={useCompactCards}
                shopProfileCompact={useCompactCards}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && displayProducts.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {t('shop_profile.no_products', "Cette boutique n'a pas encore de produits")}
        </div>
      )}

      {!loading && topSellingProducts.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="mb-3 text-sm font-semibold text-neutral-950 dark:text-white">
            {t('shop_profile.popular_products', 'Produits populaires')}
          </p>
          <div className={productGridClass}>
            {topSellingProducts.map((product) => (
              <Link
                key={`top-${product._id}`}
                to={buildProductPath(product)}
                className="group min-w-0 rounded-xl border border-neutral-200 bg-white p-2 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="relative aspect-[1.2] overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
                  <PreviewableImage
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
                <p className="mt-2 line-clamp-2 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  {product.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
