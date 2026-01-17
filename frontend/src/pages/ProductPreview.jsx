import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles, Star } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        {loading ? (
          <div className="space-y-4">
            <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex gap-4">
                <div className="h-24 w-24 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                  <div className="h-8 w-32 rounded bg-gray-200" />
                </div>
              </div>
            </div>
            <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
              <div className="h-4 w-32 rounded bg-gray-200 mb-3" />
              <div className="aspect-square rounded-xl bg-gray-200" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
            {error}
          </div>
        ) : product ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/120x120'}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h1 className="text-base font-semibold text-gray-900 line-clamp-2">
                    {product.title}
                  </h1>
                  <p className="text-sm font-bold text-indigo-600">
                    {formatCurrency(product.price)}
                  </p>
                  {product?.user?.shopName && (
                    <p className="text-xs text-gray-500">{product.user.shopName}</p>
                  )}
                  <Link
                    to={productLink}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Voir le produit
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Inspiration</h2>
                </div>
              </div>

              {relatedPicks.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {relatedPicks.map((pick, index) => {
                    const ratingAverage = Number(pick.product?.ratingAverage || 0).toFixed(1);
                    const ratingCount = formatCount(pick.product?.ratingCount || 0);
                    const commentCount = formatCount(pick.product?.commentCount || 0);
                    return (
                      <Link
                        key={`${pick.product?._id || 'product'}-${pick.image}-${index}`}
                        to={buildPreviewLink(pick.product)}
                        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                      >
                        <div className="aspect-[4/5] w-full bg-gray-100">
                          <img
                            src={pick.image}
                            alt={pick.product?.title || 'Image liée'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="space-y-1 px-2 pb-3 pt-2">
                          <p className="text-xs font-semibold text-gray-900 line-clamp-2">
                            {pick.product?.title}
                          </p>
                          <p className="text-sm font-bold text-orange-600">
                            {formatCurrency(pick.product?.price)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-400" />
                              {ratingAverage} ({ratingCount})
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {commentCount}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                  Aucune image liée pour le moment.
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
