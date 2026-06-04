import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Sparkles,
  TrendingUp,
  MapPin,
  ShoppingBag,
  Percent,
  Store,
  Truck,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import useRecommendations from '../hooks/useRecommendations';
import AuthContext from '../context/AuthContext';
import FavoriteContext from '../context/FavoriteContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import ShimmerSkeleton from '../components/ui/ShimmerSkeleton';
import api from '../services/api';
import categoryGroups from '../data/categories';

const getRandomHeight = (index, productId = '') => {
  // Deterministic pseudo-random from product ID + index for stable layout
  const seed = String(productId || index).charCodeAt(0) + index;
  const heights = ['h-52', 'h-64', 'h-72', 'h-56', 'h-80', 'h-60', 'h-68', 'h-48'];
  return heights[seed % heights.length];
};

const ProductDiscoveryCard = ({ product, index, onFavoriteToggle, isFavorited }) => {
  const { formatPrice } = useAppSettings();
  const heightClass = getRandomHeight(index, product?._id);
  const primaryImage = Array.isArray(product?.images) && product.images.length > 0
    ? product.images[0]
    : '/api/placeholder/400/600';
  const shopName = product?.user?.shopName || product?.user?.name || '';
  const isShop = product?.user?.accountType === 'shop';
  const discountPercent = Number(product?.discount || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: (index % 10) * 0.04 }}
      className="group relative"
    >
      <Link
        to={buildProductPath(product)}
        className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-lg hover:ring-gray-200"
      >
        {/* Image */}
        <div className={`relative w-full overflow-hidden ${heightClass}`}>
          <img
            src={primaryImage}
            alt={product?.title || 'Produit'}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          {/* Overlay gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Price badge */}
          <div className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-sm font-black text-[#FF6A00] shadow-lg backdrop-blur-sm">
            {formatPrice(product?.price || 0)}
          </div>

          {/* Discount badge */}
          {discountPercent > 0 && (
            <div className="absolute top-2 left-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">
              -{discountPercent}%
            </div>
          )}

          {/* Boosted badge */}
          {product?.boosted && (
            <div className="absolute top-2 right-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-black text-amber-900 shadow-lg backdrop-blur-sm">
              <Sparkles className="inline h-3 w-3 mr-0.5" />Boost
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">
            {product?.title || 'Produit'}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            {isShop ? (
              <Store className="h-3 w-3 text-[#FF6A00]" />
            ) : (
              <ShoppingBag className="h-3 w-3" />
            )}
            <span className="truncate">{shopName}</span>
          </div>
          {product?.city && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{product.city}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Favorite button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onFavoriteToggle(product?._id);
        }}
        className={`absolute top-10 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-lg backdrop-blur-sm transition ${
          isFavorited
            ? 'bg-red-500 text-white'
            : 'bg-white/90 text-gray-500 hover:bg-white hover:text-red-500'
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorited ? 'fill-white' : ''}`} />
      </button>
    </motion.div>
  );
};

const DiscoverySkeleton = () => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="rounded-2xl overflow-hidden bg-white ring-1 ring-gray-100">
        <div className={`${['h-52', 'h-64', 'h-72', 'h-56'][i % 4]} w-full bg-gray-200 animate-pulse`} />
        <div className="p-3 space-y-2">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-2 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export default function Explorer() {
  const { user } = useContext(AuthContext);
  const { favorites, toggleFavorite } = useContext(FavoriteContext);
  const { t } = useAppSettings();
  const observerRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCategoryChips, setShowCategoryChips] = useState(true);

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

  const categoryList = useMemo(() => {
    // Extract unique categories from product results
    const cats = new Map();
    (products || []).forEach((p) => {
      if (p.category && !cats.has(p.category)) {
        cats.set(p.category, true);
      }
    });
    return [...cats.keys()].slice(0, 10);
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

  return (
    <div className="min-h-screen bg-[#f6f3ee] dark:bg-neutral-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#f6f3ee]/90 backdrop-blur-xl dark:bg-neutral-950/90">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#ff3d13] shadow-lg shadow-orange-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-gray-900 dark:text-white">
                  {t('explorer.title', 'Explorer')}
                </h1>
                <p className="text-[10px] font-medium text-gray-500">
                  {t('explorer.subtitle', 'Découvrez des produits faits pour vous')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200 transition ${
                isRefreshing ? 'animate-spin' : 'hover:bg-gray-50'
              }`}
            >
              <RefreshCw className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category chips */}
        {showCategoryChips && categoryList.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveCategory('')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                !activeCategory
                  ? 'bg-[#FF6A00] text-white shadow-md shadow-orange-500/20'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {t('explorer.all', 'Tout')}
            </button>
            {categoryList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? '' : cat)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === cat
                    ? 'bg-[#FF6A00] text-white shadow-md shadow-orange-500/20'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCategoryChips(false)}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-3 pb-24">
        {isLoading && products.length === 0 ? (
          <DiscoverySkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
              <TrendingUp className="h-8 w-8 text-[#FF6A00]" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {t('explorer.errorTitle', 'Oups !')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">
              {t('explorer.errorMessage', "Impossible de charger les recommandations. Vérifiez votre connexion et réessayez.")}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-4 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-95"
            >
              {t('explorer.retry', 'Réessayer')}
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <ShoppingBag className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {t('explorer.emptyTitle', 'Rien pour le moment')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">
              {activeCategory
                ? t('explorer.emptyCategory', `Aucun produit dans "${activeCategory}". Essayez une autre catégorie.`)
                : t('explorer.emptyFeed', 'Parcourez plus de produits et revenez pour des recommandations personnalisées.')}
            </p>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setActiveCategory('')}
                className="mt-4 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition active:scale-95"
              >
                {t('explorer.showAll', 'Voir tout')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="columns-2 gap-3 space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, idx) => (
                  <ProductDiscoveryCard
                    key={product._id}
                    product={product}
                    index={idx}
                    isFavorited={favSet.has(product._id)}
                    onFavoriteToggle={toggleFavorite}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerRef} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF6A00] border-t-transparent" />
                  {t('explorer.loading', 'Chargement...')}
                </div>
              )}
              {!hasNextPage && filteredProducts.length > 0 && (
                <p className="text-xs text-gray-400 font-medium">
                  {t('explorer.endOfFeed', '— Vous avez tout vu —')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
