import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';

const PAGE_LIMIT = 12;

export default function TopDeals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const loadMoreSentinelRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);

  const fetchDeals = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products/public', {
        params: {
          sort: 'discount',
          limit: PAGE_LIMIT,
          page
        }
      });
      const fetched = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const filtered = fetched.filter((product) => Number(product.discount) > 0);
      setItems((prev) => (page > 1 ? [...prev, ...filtered] : filtered));
      setTotalPages(data?.pagination?.pages || 1);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Impossible de charger les bonnes affaires."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [page]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;
    if (loading || page >= totalPages) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const now = Date.now();
        if (now - infiniteScrollLockRef.current < 400) return;
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, totalPages));
      },
      { rootMargin: '720px 0px 720px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, page, totalPages]);

  return (
    <div className="hd-products-flow">
    <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 md:px-8 space-y-6">
      <header className="hd-products-hero rounded-[28px] p-5 text-white sm:p-6">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Promotions</p>
        <h1 className="text-2xl md:text-3xl font-black text-white">Bonnes affaires</h1>
        <p className="mt-2 text-sm text-white/86">
          Découvrez les produits au prix le plus bas actuellement approuvés sur la plateforme.
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      {loading && page === 1 ? (
        <ProductCardSkeleton count={10} viewMode="masonry" />
      ) : items.length ? (
        <>
          <ProductMasonryGrid products={items} />
          {loading && page > 1 && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent" />
            </div>
          )}
          <div ref={loadMoreSentinelRef} className="h-8" aria-hidden="true" />
          {!loading && page < totalPages && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black text-[#9A4A00] shadow-sm active:scale-95"
              >
                Charger plus
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Aucune bonne affaire disponible pour le moment. Revenez plus tard !
        </p>
      )}
    </div>
    </div>
  );
}
