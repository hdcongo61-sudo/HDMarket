import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles, Star, Heart, ShoppingCart, Store, TrendingUp, Zap, ChevronRight, Eye } from 'lucide-react';
import api from '../services/api';
import { buildProductPath } from '../utils/links';
import useIsMobile from '../hooks/useIsMobile';
import { recordProductView } from '../utils/recentViews';

const pickRandomItem = (items = []) => {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] || null;
};

const pickRandomImage = (images = []) => {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  const chosen = pickRandomItem(list);
  return chosen || null;
};

const getProductKey = (item) => item?.slug || item?._id || '';

const filterUniqueProducts = (items = [], existingKeys = new Set()) => {
  const unique = [];
  items.forEach((item) => {
    const key = getProductKey(item);
    if (!key || existingKeys.has(key)) return;
    existingKeys.add(key);
    unique.push(item);
  });
  return unique;
};

const shuffleItems = (items = []) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

const buildRelatedPicks = (items = [], limit = 6) => {
  const picks = items
    .map((item) => {
      const image = pickRandomImage(item?.images);
      return image ? { image, product: item } : null;
    })
    .filter(Boolean);
  return shuffleItems(picks).slice(0, limit);
};

const buildFallbackPicks = (product, limit = 6) => {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  return shuffleItems(images)
    .slice(0, limit)
    .map((image) => ({ image, product }));
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const formatCount = (value) => Number(value || 0).toLocaleString('fr-FR');

export default function ProductPreview() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isMobileView = useIsMobile();
  const [product, setProduct] = useState(null);
  const [relatedPicks, setRelatedPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isMobileView) return;
    const target = slug ? buildProductPath({ slug }) : '/';
    navigate(target, { replace: true });
  }, [isMobileView, navigate, slug]);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError('');
        setRelatedPicks([]);
        const seenKeys = new Set();

        const { data } = await api.get(`/products/public/${slug}`);
        if (!active) return;
        setProduct(data);
        const currentKey = getProductKey(data);
        if (currentKey) seenKeys.add(currentKey);

        let picks = [];
        if (data?.category) {
          try {
            const { data: relatedData } = await api.get('/products/public', {
              params: { category: data.category, limit: 12 }
            });
            const items = Array.isArray(relatedData?.items) ? relatedData.items : [];
            const filtered = items.filter((item) => {
              if (!item) return false;
              if (data?._id && item._id && item._id === data._id) return false;
              if (data?.slug && item.slug && item.slug === data.slug) return false;
              return true;
            });
            const candidates = filtered.filter(
              (item) => Array.isArray(item.images) && item.images.length > 0
            );
            const uniqueItems = filterUniqueProducts(
              candidates.length ? candidates : filtered,
              seenKeys
            );
            picks = buildRelatedPicks(uniqueItems, 6);
          } catch {
            // ignore related fetch errors
          }
        }

        if (!picks.length) {
          picks = buildFallbackPicks(data, 6);
        }

        picks.forEach((pick) => {
          const key = getProductKey(pick?.product);
          if (key) seenKeys.add(key);
        });

        try {
          const { data: boostedData } = await api.get('/products/public', {
            params: { boosted: true, limit: 8 }
          });
          const boostedItems = Array.isArray(boostedData?.items) ? boostedData.items : [];
          const boostedCandidates = boostedItems.filter(
            (item) => Array.isArray(item?.images) && item.images.length > 0
          );
          const uniqueBoosted = filterUniqueProducts(boostedCandidates, seenKeys);
          const boostedSource = uniqueBoosted.length ? uniqueBoosted : boostedCandidates;
          const boostedPicks = buildRelatedPicks(boostedSource, 3);
          if (boostedPicks.length) {
            picks = [...picks, ...boostedPicks];
          }
        } catch {
          // ignore boosted fetch errors
        }

        if (active) {
          setRelatedPicks(picks);
        }
      } catch (err) {
        if (!active) return;
        setProduct(null);
        setRelatedPicks([]);
        setError(err.response?.data?.message || 'Produit indisponible.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (slug) {
      loadPreview();
    } else {
      setLoading(false);
      setError('Produit indisponible.');
    }

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product?._id) return;
    recordProductView(product);
  }, [product?._id, product?.category]);

  const productLink = useMemo(() => {
    if (product?.slug) return buildProductPath(product);
    if (slug) return buildProductPath({ slug });
    return '/';
  }, [product, slug]);
  const buildPreviewLink = (item) => {
    return buildProductPath(item);
  };

  // Filter out current product from related picks
  const filteredRelatedPicks = useMemo(() => {
    if (!product) return relatedPicks;
    const currentKey = getProductKey(product);
    return relatedPicks.filter((pick) => {
      const pickKey = getProductKey(pick?.product);
      return pickKey && pickKey !== currentKey;
    });
  }, [relatedPicks, product]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-indigo-50/30">
      <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 pb-20 pt-4 sm:pt-6 space-y-5 sm:space-y-6">
        {/* Back Button - Enhanced */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-3xl bg-white border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200 active:scale-95 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
          Retour
        </button>

        {loading ? (
          <div className="space-y-6">
            {/* Product Card Skeleton */}
            <div className="animate-pulse rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
              <div className="flex gap-5">
                <div className="h-32 w-32 rounded-2xl bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-4">
                  <div className="h-5 w-3/4 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-6 w-1/2 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-2/3 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-10 w-40 rounded-xl bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
            {/* Inspiration Skeleton */}
            <div className="animate-pulse rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
              <div className="h-5 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[4/5] rounded-2xl bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-700 dark:text-red-400 font-semibold text-base">{error}</p>
          </div>
        ) : product ? (
          <div className="space-y-6">
            {/* Product Card - Enhanced */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-indigo-50/40 to-purple-50/40 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/20 border-2 border-indigo-300/60 dark:border-indigo-800/50 shadow-2xl">
              {/* Decorative gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="p-6 sm:p-8">
                <div className="flex gap-5 sm:gap-6">
                  {/* Product Image Enhanced */}
                  <div className="relative flex-shrink-0">
                    <div className="h-32 w-32 sm:h-40 sm:w-40 overflow-hidden rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 shadow-2xl ring-4 ring-white dark:ring-gray-700">
                      <img
                        src={product.images?.[0] || 'https://via.placeholder.com/128x128'}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {product.discount > 0 && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-2xl ring-2 ring-white">
                        -{product.discount}%
                      </div>
                    )}
                  </div>

                  {/* Product Info Enhanced */}
                  <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
                    <div>
                      <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white line-clamp-2 leading-tight mb-3">
                        {product.title}
                      </h1>
                      <div className="flex items-baseline gap-3">
                        <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(product.price)}
                        </p>
                        {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 line-through font-bold">
                            {formatCurrency(product.priceBeforeDiscount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {product?.user?.shopName && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Store className="w-3.5 h-3.5 text-white" />
                        </div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                          {product.user.shopName}
                        </p>
                      </div>
                    )}

                    {/* Rating & Stats */}
                    {(product.ratingAverage || product.commentCount) && (
                      <div className="flex items-center gap-3 text-xs">
                        {product.ratingAverage > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {Number(product.ratingAverage).toFixed(1)}
                            </span>
                            {product.ratingCount > 0 && (
                              <span className="text-gray-500 dark:text-gray-400">
                                ({formatCount(product.ratingCount)})
                              </span>
                            )}
                          </div>
                        )}
                        {product.commentCount > 0 && (
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>{formatCount(product.commentCount)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CTA Button Enhanced */}
                    <Link
                      to={productLink}
                      className="inline-flex items-center justify-center gap-2 w-full rounded-3xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                      <Eye className="w-5 h-5" />
                      Voir le produit
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Inspiration Section - Enhanced */}
            <section className="rounded-3xl border-2 border-gray-200/60 dark:border-gray-700/50 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
              {/* Section Header Enhanced */}
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/20 dark:to-orange-900/20 px-6 py-5 border-b-2 border-amber-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Inspiration</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Produits similaires pour vous</p>
                  </div>
                </div>
              </div>

              {/* Products Grid Enhanced */}
              <div className="p-5 sm:p-6">
                {filteredRelatedPicks.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {filteredRelatedPicks.map((pick, index) => {
                      const ratingAverage = Number(pick.product?.ratingAverage || 0).toFixed(1);
                      const ratingCount = formatCount(pick.product?.ratingCount || 0);
                      const commentCount = formatCount(pick.product?.commentCount || 0);
                      const hasDiscount = pick.product?.discount > 0 && pick.product?.priceBeforeDiscount > pick.product?.price;
                      
                      return (
                        <Link
                          key={`${pick.product?._id || 'product'}-${pick.image}-${index}`}
                          to={buildPreviewLink(pick.product)}
                          className="group relative overflow-hidden rounded-3xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] active:scale-95"
                        >
                          {/* Image Container Enhanced */}
                          <div className="relative aspect-[4/5] w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                            <img
                              src={pick.image}
                              alt={pick.product?.title || 'Produit'}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Discount Badge Enhanced */}
                            {hasDiscount && (
                              <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white text-[11px] font-black px-2.5 py-1.5 rounded-full shadow-2xl ring-2 ring-white">
                                -{pick.product.discount}%
                              </div>
                            )}
                            {/* Hover Overlay Enhanced */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>

                          {/* Product Info Enhanced */}
                          <div className="p-3 sm:p-4 space-y-2.5">
                            <p className="text-xs sm:text-sm font-black text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {pick.product?.title}
                            </p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(pick.product?.price)}
                              </p>
                              {hasDiscount && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-through font-bold">
                                  {formatCurrency(pick.product.priceBeforeDiscount)}
                                </p>
                              )}
                            </div>
                            {/* Stats Enhanced */}
                            <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px]">
                              {ratingAverage > 0 && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                  <span className="font-black text-gray-700 dark:text-gray-300">{ratingAverage}</span>
                                  {ratingCount > 0 && <span className="text-gray-500">({ratingCount})</span>}
                                </span>
                              )}
                              {commentCount > 0 && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                                  <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="font-semibold text-gray-700">{commentCount}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Aucune inspiration pour le moment
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      D'autres produits similaires apparaîtront ici
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
