import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';

const LIMIT = 60;
const PAGE_SIZE = 12;

export default function TopRanking() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const loadMoreSentinelRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products/public/highlights', {
          params: { limit: LIMIT },
          signal: controller.signal
        });
        if (!active) return;
        const ranked = Array.isArray(data?.topRated) ? data.topRated : [];
        setItems(ranked);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e.response?.data?.message || e.message || "Impossible de charger les produits mieux notés."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  useEffect(() => {
    if (page >= Math.max(1, Math.ceil(items.length / PAGE_SIZE))) return;
    const handleScroll = () => {
      const now = Date.now();
      if (now - infiniteScrollLockRef.current < 400) return;
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, Math.max(1, Math.ceil(items.length / PAGE_SIZE))));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items.length, page]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;
    if (page >= Math.max(1, Math.ceil(items.length / PAGE_SIZE))) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const now = Date.now();
        if (now - infiniteScrollLockRef.current < 400) return;
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, Math.max(1, Math.ceil(items.length / PAGE_SIZE))));
      },
      { rootMargin: '720px 0px 720px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, page]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const end = page * PAGE_SIZE;
    return items.slice(0, end);
  }, [items, page]);

  return (
    <div className="hd-products-flow">
      <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 md:px-8 md:pb-16 space-y-6">
        <header className="hd-products-hero rounded-[28px] p-5 text-white shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:p-6">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Classement</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Top des évaluations</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/86">
            Les produits les mieux notés par la communauté, classés pour une découverte rapide sur mobile.
          </p>
        </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <ProductCardSkeleton count={10} viewMode="masonry" />
      ) : items.length ? (
        <>
          <ProductMasonryGrid products={paginatedItems} />
          <div ref={loadMoreSentinelRef} className="h-8" aria-hidden="true" />
          {page < totalPages && (
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
          Aucun produit n&apos;a encore reçu d&apos;évaluations suffisantes. Revenez un peu plus tard !
        </p>
      )}
      </div>
    </div>
  );
}
