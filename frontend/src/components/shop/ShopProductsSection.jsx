import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
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
    ? 'mx-auto grid w-full max-w-[380px] min-w-0 grid-cols-1 gap-2 min-[376px]:grid-cols-2 sm:gap-3'
    : 'grid min-w-0 grid-cols-1 gap-2 min-[376px]:grid-cols-2 sm:grid-cols-3';

  return (
    <GlassCard className="min-w-0 space-y-4 overflow-hidden" id="products">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            {t('shop_profile.all_products', 'Tous les produits')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatCount(displayProducts.length)} {t('shop_profile.products_count', 'produits')}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoReviews}
          className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 sm:w-auto"
        >
          <span className="truncate">{t('shop_profile.go_reviews', 'Aller aux avis')}</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[430px]:mx-0 max-[430px]:overflow-visible max-[430px]:px-0">
        <div className="flex w-max min-w-0 items-center gap-2 max-[430px]:w-full max-[430px]:flex-wrap">
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
                className={`inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                  {formatCount(item.count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('shop_profile.filter_category', 'Filtrer par catégorie')}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('all');
              setPromoOnly(false);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('shop_profile.reset', 'Réinitialiser')}
          </button>
        </div>
        <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[430px]:mx-0 max-[430px]:overflow-visible max-[430px]:px-0">
          <div className="flex w-max min-w-0 items-center gap-2 max-[430px]:w-full max-[430px]:flex-wrap">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <span className="truncate">{t('shop_profile.tab_all', 'Tous')}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeCategory === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {formatCount(products.length)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPromoOnly((prev) => !prev)}
              disabled={!hasPromoProducts}
              className={`inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                promoOnly
                  ? 'bg-amber-500 text-white'
                  : 'border border-amber-200 bg-amber-50 text-amber-700'
              } ${!hasPromoProducts ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Sparkles size={12} />
              <span className="truncate">{t('shop_profile.promos', 'Promos')}</span>
            </button>
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="max-w-[8rem] truncate">{category}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
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
        <div className={productGridClass}>
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
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          {t('shop_profile.no_products', "Cette boutique n'a pas encore de produits")}
        </div>
      )}

      {!loading && topSellingProducts.length > 0 && (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('shop_profile.popular_products', 'Produits populaires')}
          </p>
          <div className={productGridClass}>
            {topSellingProducts.map((product) => (
              <Link
                key={`top-${product._id}`}
                to={buildProductPath(product)}
                className="group min-w-0 rounded-xl border border-slate-200 bg-white p-2 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="relative aspect-[1.2] overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  <PreviewableImage
                    src={product.images?.[0] || product.image || ''}
                    images={Array.isArray(product.images) && product.images.length ? product.images : [product.images?.[0] || product.image || '']}
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                    reportContext={{
                      contextType: 'product',
                      productId: product?._id || '',
                      productSlug: product?.slug || '',
                      productTitle: product?.title || '',
                      shopId: product?.user?._id || (typeof product?.user === 'string' ? product.user : ''),
                      shopSlug: product?.user?.slug || '',
                      shopName: product?.user?.shopName || product?.user?.name || '',
                      deepLink: buildProductPath(product)
                    }}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-100">{product.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
