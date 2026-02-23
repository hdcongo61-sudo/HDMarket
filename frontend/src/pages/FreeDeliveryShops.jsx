import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, MapPin, Store, Truck, Users } from 'lucide-react';
import api from '../services/api';
import { buildShopPath } from '../utils/links';
import VerifiedBadge from '../components/VerifiedBadge';

export default function FreeDeliveryShops() {
  const [searchParams] = useSearchParams();
  const city = String(searchParams.get('city') || '').trim();
  const communeId = String(searchParams.get('communeId') || '').trim();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPage = useCallback(
    async (nextPage, { append = false } = {}) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError('');
        const { data } = await api.get('/shops/free-delivery', {
          params: {
            page: nextPage,
            limit: 24,
            city: city || undefined,
            communeId: communeId || undefined
          }
        });
        const incoming = Array.isArray(data?.items) ? data.items : [];
        setShops((prev) => {
          if (!append) return incoming;
          const next = [...prev];
          incoming.forEach((item) => {
            if (!next.some((entry) => String(entry?._id) === String(item?._id))) {
              next.push(item);
            }
          });
          return next;
        });
        setPage(Number(data?.page || nextPage || 1));
        setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger les boutiques.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [city, communeId]
  );

  useEffect(() => {
    fetchPage(1, { append: false });
  }, [fetchPage]);

  const canLoadMore = useMemo(() => page < totalPages, [page, totalPages]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Truck className="h-3.5 w-3.5" />
              Livraison gratuite
            </div>
            <h1 className="text-xl font-bold text-gray-900">Boutiques avec livraison gratuite</h1>
            {city ? <p className="text-sm text-gray-500">Ville: {city}</p> : null}
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Retour accueil <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={`free-delivery-shop-skeleton-${idx}`} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : shops.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Aucune boutique avec livraison gratuite pour le moment.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <Link
                  key={shop._id}
                  to={buildShopPath(shop)}
                  className="ui-card ui-card-interactive ui-card-fade-in p-4 transition hover:bg-emerald-50/40"
                >
                  <div className="flex items-start gap-3">
                    {shop.shopLogo ? (
                      <div className="ui-media-frame ui-media-frame-square h-12 w-12">
                        <img
                          src={shop.shopLogo}
                          alt={shop.shopName}
                          className="ui-media-img ui-media-img-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div className="ui-media-frame ui-media-frame-square flex h-12 w-12 items-center justify-center text-emerald-700">
                        <Store className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{shop.shopName}</p>
                        <VerifiedBadge verified={Boolean(shop.shopVerified)} showLabel={false} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">Livraison gratuite</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {shop.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {shop.city}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {Number(shop.followersCount || 0).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      {shop.freeDeliveryNote ? (
                        <p className="mt-2 line-clamp-2 text-xs text-gray-600">{shop.freeDeliveryNote}</p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {canLoadMore ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchPage(page + 1, { append: true })}
                  disabled={loadingMore}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {loadingMore ? 'Chargement...' : 'Voir plus'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
