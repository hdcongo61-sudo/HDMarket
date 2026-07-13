import React from 'react';
import { ArrowRight, Sparkles, Tag, Clock, Flame, Grid3x3 } from 'lucide-react';
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
    ? 'grid w-full grid-cols-2 gap-2 sm:gap-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3';

  const activeTab =
    'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-xs font-black text-white transition';
  const inactiveTab =
    'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-600 transition active:scale-95 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300';

  const activeChip =
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-neutral-950 px-4 text-[11px] font-bold text-white transition';
  const inactiveChip =
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-4 text-[11px] font-semibold text-gray-600 transition active:scale-95 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300';

  const FEED_TABS = [
    { id: 'all', label: t('shop_profile.tab_all', 'Tous'), icon: Grid3x3, count: products.length },
    { id: 'featured', label: t('shop_profile.tab_featured', 'Recommandés'), icon: Flame, count: featuredProducts.length },
    { id: 'latest', label: t('shop_profile.tab_latest', 'Nouveautés'), icon: Clock, count: latestProducts.length },
    { id: 'popular', label: t('shop_profile.tab_popular', 'Populaires'), icon: Tag, count: topSellingProducts.length }
  ];

  return (
    <section className="overflow-hidden rounded-none bg-white shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800" id="products">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-[17px] font-black text-gray-900 dark:text-white">
          {t('shop_profile.all_products', 'Produits')}
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:bg-neutral-800 dark:text-neutral-400">
            {formatCount(displayProducts.length)}
          </span>
          <button
            type="button"
            onClick={onGoReviews}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-[13px] font-bold text-[#e85d00] transition dark:text-orange-300"
          >
            {t('shop_profile.go_reviews', 'Avis')}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Product filters ── */}
      <div className="mt-3 border-b border-gray-100 bg-white/96 backdrop-blur-xl md:sticky md:top-[4.55rem] md:z-20 dark:border-neutral-800 dark:bg-neutral-950/96">
        {/* Product Feed Tabs */}
        <div className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1.5">
            {FEED_TABS.map((item) => {
              const isActive = productFeed === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProductFeed(item.id)}
                  className={isActive ? activeTab : inactiveTab}
                >
                  <Icon size={13} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Chips */}
        <div className="overflow-x-auto border-t border-gray-100 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-neutral-800">
          <div className="flex w-max items-center gap-1.5">
            {/* Tous */}
            <button
              type="button"
              onClick={() => { setActiveCategory('all'); }}
              className={activeCategory === 'all' && !promoOnly ? activeChip : inactiveChip}
            >
              <Grid3x3 size={11} />
              <span>{t('shop_profile.tab_all', 'Tous')}</span>
            </button>

            {/* Promos toggle */}
            <button
              type="button"
              onClick={() => { setPromoOnly((prev) => !prev); if (!promoOnly) setActiveCategory('all'); }}
              disabled={!hasPromoProducts}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${
                promoOnly
                  ? 'bg-[var(--shop-color)] text-[var(--shop-color-contrast)] shadow-sm'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300'
              } ${!hasPromoProducts ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <Sparkles size={11} />
              <span>{t('shop_profile.promos', 'Promos')}</span>
            </button>

            {/* Divider */}
            {categories.length > 0 && (
              <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-neutral-700" />
            )}

            {/* Category pills */}
            {categories.map((category) => {
              const isActive = activeCategory === category && !promoOnly;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => { setActiveCategory(category); setPromoOnly(false); }}
                  className={isActive ? activeChip : inactiveChip}
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
          </div>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="px-4 pb-6">

      {loading && <ShimmerSkeleton rows={3} />}

      {!loading && displayProducts.length > 0 && (
        <div className={`mt-3 ${productGridClass}`}>
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
        <div className="mt-4 rounded border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm font-semibold text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
          {t('shop_profile.no_products', "Cette boutique n'a pas encore de produits")}
        </div>
      )}

      {!loading && topSellingProducts.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-neutral-800">
          <p className="mb-3 text-[17px] font-black text-gray-900 dark:text-white">
            {t('shop_profile.popular_products', 'Produits populaires')}
          </p>
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
