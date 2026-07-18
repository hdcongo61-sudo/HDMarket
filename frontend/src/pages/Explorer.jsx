import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Sparkles,
  TrendingUp,
  MapPin,
  ShoppingBag,
  Store,
  RefreshCw,
  ChevronRight,
  Package,
  Grid3X3
} from 'lucide-react';
import useRecommendations from '../hooks/useRecommendations';
import AuthContext from '../context/AuthContext';
import FavoriteContext from '../context/FavoriteContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import useCategories from '../hooks/useCategories';

const DiscoveryCard = ({ product, index, onFavoriteToggle, isFavorited }) => {
  const { formatPrice } = useAppSettings();
  const primaryImage = Array.isArray(product?.images) && product.images.length > 0
    ? product.images[0]
    : '/api/placeholder/400/600';
  const shopName = product?.user?.shopName || product?.user?.name || '';
  const isShop = product?.user?.accountType === 'shop';
  const discountPercent = Number(product?.discount || 0);
  const hasVideo = Boolean(product?.video);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min((index % 12) * 0.03, 0.3), ease: 'easeOut' }}
      className="group relative"
    >
      <Link
        to={buildProductPath(product)}
        className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:ring-gray-200"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
          <img
            src={primaryImage}
            alt={product?.title || 'Produit'}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none" />
          {hasVideo && (
            <div className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-extrabold text-white flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>Vidéo
            </div>
          )}
          {discountPercent > 0 && (
            <div className={`absolute top-2 ${hasVideo ? 'left-16' : 'left-2'} rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white shadow-sm`}>
              -{discountPercent}%
            </div>
          )}
          <div className="absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-black text-[#e85d00] shadow-sm">
            {formatPrice(product?.price || 0)}
          </div>
          {product?.boosted && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-amber-900 shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />Boost
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-gray-900 line-clamp-2 leading-snug">
            {product?.title || 'Produit'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isShop ? <Store className="h-3 w-3 flex-shrink-0 text-[#e85d00]" /> : <ShoppingBag className="h-3 w-3 flex-shrink-0 text-gray-400" />}
              <span className="text-[10px] font-semibold text-gray-500 truncate">{shopName}</span>
            </div>
            {product?.city && (
              <span className="text-[9px] font-medium text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                <MapPin className="h-2.5 w-2.5" />{product.city}
              </span>
            )}
          </div>
          {(product?.salesCount > 0 || product?.viewsCount > 0) && (
            <div className="flex items-center gap-2 text-[9px] text-gray-400 pt-0.5 border-t border-orange-50">
              {product?.salesCount > 0 && <span className="font-semibold">{product.salesCount} vendu{product.salesCount > 1 ? 's' : ''}</span>}
              {product?.viewsCount > 0 && <span>{product.viewsCount} vues</span>}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavoriteToggle(product?._id); }}
        className={`absolute bottom-[76px] right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-all duration-200 active:scale-90 ${
          isFavorited ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-white/90 text-gray-600 hover:bg-white hover:text-red-500 ring-1 ring-white/60'
        }`}
        aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <Heart className={`h-4 w-4 transition ${isFavorited ? 'fill-white scale-110' : ''}`} />
      </button>
    </motion.div>
  );
};

const DiscoverySkeleton = () => (
  <div className="grid grid-cols-2 gap-3 p-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={`skel-${i}`} className="rounded-2xl overflow-hidden bg-white ring-1 ring-gray-200">
        <div className={`${['aspect-[3/4]', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[4/5]'][i % 4]} w-full bg-gray-100 animate-pulse`} />
        <div className="p-3 space-y-2">
          <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-2.5 bg-gray-50 rounded animate-pulse w-1/2" />
          <div className="h-2 bg-gray-50 rounded animate-pulse w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export default function Explorer() {
  const { user } = useContext(AuthContext);
  const { favorites, toggleFavorite } = useContext(FavoriteContext);
  const { t } = useAppSettings();
  const { getCategoryMeta } = useCategories();
  const observerRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const favSet = useMemo(() => new Set((favorites || []).map((f) => f?._id || f)), [favorites]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isError
  } = useRecommendations({
    enabled: Boolean(user)
  });

  const products = useMemo(
    () => data?.pages?.flatMap((page) => page?.items || []) || [],
    [data]
  );

  const categoryChips = useMemo(() => {
    const seen = new Map();
    (products || []).forEach((p) => {
      if (p.category && !seen.has(p.category)) {
        const meta = getCategoryMeta(p.category);
        seen.set(p.category, meta?.label || p.category);
      }
    });
    return [...seen.entries()].slice(0, 12);
  }, [products]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const hasContent = !isLoading && !isError && filteredProducts.length > 0;

  return (
    <div className="min-h-screen bg-[#f6f3ee] dark:bg-neutral-950">
      
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-[#e85d00] px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8">
        <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-sm ring-1 ring-white/25">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/78">
                {t('explorer.badge', 'Pour vous')}
              </p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {t('explorer.title', 'Explorer')}
              </h1>
              <p className="mt-1 text-[13px] font-semibold text-white/82">
                {t('explorer.subtitle', 'Des produits sélectionnés selon vos goûts')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 transition hover:bg-white/25 active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Category Chips ── */}
      {categoryChips.length > 0 && (
        <div className="border-b border-gray-200/60 bg-[#f6f3ee]/90 dark:bg-neutral-950/90">
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveCategory('')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                !activeCategory
                  ? 'bg-[#e85d00] text-white shadow-sm'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 hover:text-gray-500'
              }`}
            >
              <Grid3X3 className="inline h-3 w-3 mr-1 -mt-0.5" />
              {t('explorer.all', 'Tout')}
            </button>
            {categoryChips.map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? '' : cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-[#e85d00] text-white shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 hover:text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-3 py-4 pb-28">
        {isLoading && products.length === 0 && <DiscoverySkeleton />}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200">
              <TrendingUp className="h-8 w-8 text-[#e85d00]" />
            </div>
            <h3 className="text-lg font-black text-gray-900">{t('explorer.errorTitle', 'Oups !')}</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">{t('explorer.errorMessage', 'Recommandations momentanément indisponibles.')}</p>
            <button type="button" onClick={handleRefresh} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e85d00] px-6 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-95">
              <RefreshCw className="h-3.5 w-3.5" />{t('explorer.retry', 'Réessayer')}
            </button>
          </div>
        )}

        {hasContent === false && !isLoading && !isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200">
              <Package className="h-8 w-8 text-[#e85d00]" />
            </div>
            <h3 className="text-lg font-black text-gray-900">
              {activeCategory ? t('explorer.emptyCategory', `Aucun produit en "${activeCategory}"`) : t('explorer.emptyTitle', 'Commencez à explorer')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">
              {activeCategory ? t('explorer.emptyCategoryHint', 'Essayez une autre catégorie.') : t('explorer.emptyFeed', 'Parcourez des produits et ajoutez des favoris pour recevoir des recommandations personnalisées.')}
            </p>
            {activeCategory ? (
              <button type="button" onClick={() => setActiveCategory('')} className="mt-5 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-black text-white transition active:scale-95">
                {t('explorer.showAll', 'Voir tout')}
              </button>
            ) : (
              <Link to="/products" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e85d00] px-6 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-95">
                {t('explorer.browseProducts', 'Parcourir les produits')}<ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        {hasContent && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, idx) => (
                  <DiscoveryCard key={product._id} product={product} index={idx} isFavorited={favSet.has(product._id)} onFavoriteToggle={toggleFavorite} />
                ))}
              </AnimatePresence>
            </div>
            <div ref={observerRef} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e85d00] border-t-transparent" />
                  {t('explorer.loading', 'Chargement...')}
                </div>
              )}
              {!hasNextPage && filteredProducts.length > 6 && (
                <p className="text-xs font-semibold text-gray-400">{t('explorer.endOfFeed', '— Fin des recommandations —')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
