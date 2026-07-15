import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles, Star, Store, Zap, ChevronRight, Eye, MapPin, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { buildProductPath } from '../utils/links';
import useIsMobile from '../hooks/useIsMobile';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';
import { recordProductView } from '../utils/recentViews';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import AuthContext from '../context/AuthContext';

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

const buildRelatedPicks = (items = [], limit = 9) => {
  const picks = items
    .map((item) => {
      const image = pickRandomImage(item?.images);
      return image ? { image, product: item } : null;
    })
    .filter(Boolean);
  return shuffleItems(picks).slice(0, limit);
};

const buildFallbackPicks = (product, limit = 9) => {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  return shuffleItems(images)
    .slice(0, limit)
    .map((image) => ({ image, product }));
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);
const formatCount = (value) => Number(value || 0).toLocaleString('fr-FR');
const PREVIEW_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 15;

export default function ProductPreview() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isMobileView = useIsMobile();
  const { rapid3GActive } = useNetworkProfile();
  const authContextValue = useContext(AuthContext);
  const user = authContextValue?.user;
  const authLoading = Boolean(authContextValue?.loading);
  const [product, setProduct] = useState(null);
  const [relatedPicks, setRelatedPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState('');
  const previewSnapshotKey = useMemo(() => `product-preview:${slug || 'unknown'}`, [slug]);

  useEffect(() => {
    if (isMobileView) return;
    const target = slug ? buildProductPath({ slug }) : '/';
    navigate(target, { replace: true });
  }, [isMobileView, navigate, slug]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let networkSettled = false;
    let snapshotHydrated = false;
    let snapshotHadRelatedPicks = false;

    const hydrateSnapshot = async () => {
      const snapshot = await loadOfflineSnapshot(previewSnapshotKey, {
        maxAgeMs: PREVIEW_SNAPSHOT_MAX_AGE_MS
      });
      if (!active || networkSettled || !snapshot || typeof snapshot !== 'object') return;
      if (!snapshot.product || typeof snapshot.product !== 'object') return;

      const cachedRelatedPicks = Array.isArray(snapshot.relatedPicks)
        ? snapshot.relatedPicks.filter(Boolean)
        : [];

      snapshotHydrated = true;
      snapshotHadRelatedPicks = cachedRelatedPicks.length > 0;
      setProduct(snapshot.product);
      setRelatedPicks(cachedRelatedPicks);
      setError('');
      setLoading(false);
      setRelatedLoading(!snapshotHadRelatedPicks);
    };

    const loadPreview = async () => {
      try {
        setLoading(true);
        setRelatedLoading(false);
        setError('');
        setRelatedPicks([]);

        let data;
        try {
          const response = await api.get(`/products/public/${slug}`);
          data = response?.data;
        } catch (publicError) {
          const status = publicError?.response?.status;
          if (status === 404 && user) {
            const privateResponse = await api.get(`/products/${slug}`);
            data = privateResponse?.data;
          } else {
            throw publicError;
          }
        }
        if (!data) {
          throw new Error('Produit indisponible.');
        }

        networkSettled = true;
        if (!active) return;
        setProduct(data);
        setLoading(false);
        setRelatedLoading(!snapshotHadRelatedPicks);
        void saveOfflineSnapshot(previewSnapshotKey, { product: data, relatedPicks: [] });

        const loadRecommendations = async () => {
          try {
            const seenKeys = new Set();
            const currentKey = getProductKey(data);
            if (currentKey) seenKeys.add(currentKey);

            let picks = [];
            const [relatedResult, boostedResult] = await Promise.allSettled([
              data?.category
                ? api.get('/products/public', {
                    params: { category: data.category, limit: rapid3GActive ? 8 : 12 }
                  })
                : Promise.resolve(null),
              api.get('/products/public', {
                params: { boosted: true, limit: rapid3GActive ? 4 : 8 }
              })
            ]);

            if (relatedResult.status === 'fulfilled') {
              const items = Array.isArray(relatedResult.value?.data?.items)
                ? relatedResult.value.data.items
                : [];
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
              picks = buildRelatedPicks(uniqueItems, rapid3GActive ? 6 : 9);
            }

            if (!picks.length) {
              picks = buildFallbackPicks(data, rapid3GActive ? 6 : 9);
            }

            picks.forEach((pick) => {
              const key = getProductKey(pick?.product);
              if (key) seenKeys.add(key);
            });

            if (boostedResult.status === 'fulfilled') {
              const boostedItems = Array.isArray(boostedResult.value?.data?.items)
                ? boostedResult.value.data.items
                : [];
              const boostedCandidates = boostedItems.filter(
                (item) => Array.isArray(item?.images) && item.images.length > 0
              );
              const uniqueBoosted = filterUniqueProducts(boostedCandidates, seenKeys);
              const boostedSource = uniqueBoosted.length ? uniqueBoosted : boostedCandidates;
              const boostedPicks = buildRelatedPicks(boostedSource, rapid3GActive ? 3 : 6);
              if (boostedPicks.length) {
                picks = [...picks, ...boostedPicks];
              }
            }

            if (!active) return;
            setRelatedPicks(picks);
            void saveOfflineSnapshot(previewSnapshotKey, { product: data, relatedPicks: picks });
          } finally {
            if (active) {
              setRelatedLoading(false);
            }
          }
        };

        void loadRecommendations();
      } catch (err) {
        networkSettled = true;
        if (!active) return;
        if (snapshotHydrated && err?.response?.status !== 404) {
          setLoading(false);
          setRelatedLoading(false);
          return;
        }
        setProduct(null);
        setRelatedPicks([]);
        setRelatedLoading(false);
        setError(err.response?.data?.message || 'Produit indisponible.');
        setLoading(false);
      }
    };

    if (slug) {
      void hydrateSnapshot();
      loadPreview();
    } else {
      setLoading(false);
      setError('Produit indisponible.');
    }

    return () => {
      active = false;
    };
  }, [authLoading, previewSnapshotKey, rapid3GActive, slug, user]);

  useEffect(() => {
    if (!product?._id) return;
    recordProductView(product);
  }, [product?._id, product?.category]);

  useEffect(() => {
    const canonicalSlug = String(product?.slug || '').trim();
    const routeSlug = String(slug || '').trim();
    const looksLikeObjectId = /^[a-f0-9]{24}$/i.test(routeSlug);
    if (!looksLikeObjectId || !canonicalSlug || canonicalSlug === routeSlug) return;
    navigate(`/product-preview/${canonicalSlug}`, { replace: true });
  }, [navigate, product?.slug, slug]);

  const productLink = useMemo(() => {
    if (product?.slug) return buildProductPath(product);
    if (slug) return buildProductPath({ slug });
    return '/';
  }, [product, slug]);
  const previewBackPath = useMemo(
    () => {
      const previewSlug = String(product?.slug || slug || '').trim();
      return previewSlug ? `/product-preview/${previewSlug}` : '/';
    },
    [product?.slug, slug]
  );
  const buildPreviewLink = (item) => {
    return buildProductPath(item);
  };

  const filteredRelatedPicks = useMemo(() => {
    if (!product) return relatedPicks;
    const currentKey = getProductKey(product);
    return relatedPicks.filter((pick) => {
      const pickKey = getProductKey(pick?.product);
      return pickKey && pickKey !== currentKey;
    });
  }, [relatedPicks, product]);

  const primaryImage = product?.images?.[0] || 'https://via.placeholder.com/640x640';
  const hasProductDiscount = product?.discount > 0 && product?.priceBeforeDiscount > product?.price;
  const shopName = product?.user?.shopName || product?.shop?.name || '';
  const cityLabel = [product?.commune, product?.city].filter(Boolean).join(' - ');
  const productRatingAverage = Number(product?.ratingAverage || 0);

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-slate-950">
      <div className="mx-auto w-full max-w-7xl pb-24">
        <header className="border-b border-gray-200/80 bg-gray-50/95 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Retour"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_8px_20px_rgba(117,75,36,0.08)] ring-1 ring-gray-200 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link
              to="/products"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 py-2.5 text-sm font-black text-slate-500 shadow-[0_8px_20px_rgba(117,75,36,0.08)] ring-1 ring-gray-200"
            >
              <Eye className="h-4 w-4 text-[#e85d00]" />
              <span className="truncate">Explorer HDMarket</span>
            </Link>
          </div>
        </header>

        <main className="space-y-3 px-2.5 pt-3">
        {loading ? (
          <div className="space-y-3">
            <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-[0_16px_36px_rgba(117,75,36,0.08)]">
              <div className="aspect-[4/3] bg-orange-100/70" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 rounded-full bg-stone-200" />
                <div className="h-7 w-1/2 rounded-full bg-stone-200" />
                <div className="h-10 rounded-full bg-stone-200" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white p-1.5">
                  <div className="aspect-square rounded-xl bg-stone-200" />
                  <div className="mt-2 h-3 rounded-full bg-stone-200" />
                  <div className="mt-1.5 h-3 w-2/3 rounded-full bg-stone-200" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-[0_16px_36px_rgba(117,75,36,0.08)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <Zap className="h-7 w-7 text-red-500" />
            </div>
            <p className="text-sm font-black text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white active:scale-95"
            >
              Retour
            </button>
          </div>
        ) : product ? (
          <div className="space-y-3">
            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_rgba(117,75,36,0.10)]">
              <Link to={productLink} state={{ previewBackPath }} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src={primaryImage}
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-700 group-active:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
                  {hasProductDiscount ? (
                    <span className="absolute left-3 top-3 rounded-full bg-[#e85d00] px-2.5 py-1 text-xs font-black text-white shadow-lg">
                      -{product.discount}%
                    </span>
                  ) : null}
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
                    Aperçu
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[28px] font-black leading-none text-[#e85d00]">
                          {formatCurrency(product.price)}
                        </p>
                        {hasProductDiscount ? (
                          <p className="text-sm font-bold text-gray-400 line-through">
                            {formatCurrency(product.priceBeforeDiscount)}
                          </p>
                        ) : null}
                      </div>
                      <h1 className="mt-2 line-clamp-2 text-base font-black leading-6 text-slate-950">
                        {product.title}
                      </h1>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-500 ring-1 ring-gray-200">
                      Voir
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-gray-600">
                    {productRatingAverage > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {productRatingAverage.toFixed(1)}
                      </span>
                    ) : null}
                    {product?.commentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {formatCount(product.commentCount)}
                      </span>
                    ) : null}
                    {cityLabel ? (
                      <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                        <MapPin className="h-3.5 w-3.5 text-[#e85d00]" />
                        <span className="max-w-[160px] truncate">{cityLabel}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              {shopName ? (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff2e6] text-[#e85d00] ring-1 ring-gray-200">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{shopName}</p>
                      <p className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Boutique reliée au produit
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-[1fr_1.45fr] gap-2 border-t border-gray-100 p-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="min-h-[48px] rounded-full bg-gray-100 text-sm font-black text-slate-800 active:scale-[0.98]"
                >
                  Retour
                </button>
                <Link
                  to={productLink}
                  state={{ previewBackPath }}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ffb000] to-[#ff4d16] text-sm font-black text-white shadow-[0_12px_24px_rgba(255,106,0,0.22)] active:scale-[0.98]"
                >
                  Voir le produit
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-3 shadow-[0_16px_36px_rgba(117,75,36,0.08)]">
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Produits à découvrir</h2>
                  <p className="text-xs font-semibold text-gray-500">Sélection rapide en 3 colonnes</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1.5 text-[11px] font-black text-gray-500 ring-1 ring-gray-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Découverte
                </span>
              </div>

              {relatedLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
                    <div
                      key={`preview-related-skeleton-${item}`}
                      className="animate-pulse overflow-hidden rounded-2xl bg-gray-50 p-1.5"
                    >
                      <div className="aspect-square w-full rounded-xl bg-stone-200" />
                      <div className="mt-2 h-3 w-4/5 rounded bg-stone-200" />
                      <div className="mt-1.5 h-3 w-2/5 rounded bg-stone-200" />
                    </div>
                  ))}
                </div>
              ) : filteredRelatedPicks.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {filteredRelatedPicks.map((pick, index) => {
                    const pickRatingAverage = Number(pick.product?.ratingAverage || 0);
                    const pickHasDiscount = pick.product?.discount > 0 && pick.product?.priceBeforeDiscount > pick.product?.price;
                    const soldCount = pick.product?.salesCount || pick.product?.soldCount || pick.product?.ordersCount || 0;

                    return (
                      <Link
                        key={`${pick.product?._id || 'product'}-${pick.image}-${index}`}
                        to={buildPreviewLink(pick.product)}
                        state={{ previewBackPath }}
                        className="group overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_8px_18px_rgba(117,75,36,0.07)] ring-1 ring-gray-100 transition active:scale-[0.97]"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                          <img
                            src={pick.image}
                            alt={pick.product?.title || 'Produit'}
                            className="h-full w-full object-cover transition duration-500 group-active:scale-105"
                            loading="lazy"
                          />
                          {pickHasDiscount ? (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-[#e85d00] px-1.5 py-0.5 text-[9px] font-black leading-none text-white">
                              -{pick.product.discount}%
                            </span>
                          ) : null}
                        </div>
                        <div className="pt-2">
                          <p className="line-clamp-2 min-h-[32px] text-[11px] font-black leading-4 text-slate-950">
                            {pick.product?.title}
                          </p>
                          <p className="mt-1 truncate text-sm font-black leading-none text-[#e85d00]">
                            {formatCurrency(pick.product?.price)}
                          </p>
                          <div className="mt-1 flex min-h-[16px] items-center gap-1 text-[9px] font-bold text-gray-500">
                            {pickRatingAverage > 0 ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                {pickRatingAverage.toFixed(1)}
                              </span>
                            ) : null}
                            {soldCount > 0 ? <span>{formatCount(soldCount)} vendus</span> : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#e85d00] shadow-sm">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-black text-slate-800">Aucune inspiration pour le moment</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    D'autres produits similaires apparaîtront ici.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : null}
        </main>
      </div>
    </div>
  );
}
