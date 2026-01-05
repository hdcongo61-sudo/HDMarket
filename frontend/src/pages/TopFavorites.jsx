import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const LIMIT = 60;
const PAGE_SIZE = 12;

export default function TopFavorites() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );

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
        const favorites = Array.isArray(data?.favorites) ? data.favorites : [];
        setItems(favorites);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e.response?.data?.message || e.message || "Impossible de charger les produits favoris."
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
    if (!isMobileView) return;
    if (page >= Math.max(1, Math.ceil(items.length / PAGE_SIZE))) return;
    const handleScroll = () => {
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        setPage((prev) => Math.min(prev + 1, Math.max(1, Math.ceil(items.length / PAGE_SIZE))));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileView, items.length, page]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileView(window.innerWidth <= 767);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const renderPagination = () => {
    if (isMobileView) return null;
    if (items.length <= PAGE_SIZE) return null;

    const visiblePages = Math.min(5, totalPages);
    const half = Math.floor(visiblePages / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + visiblePages - 1);
    start = Math.max(1, end - visiblePages + 1);
    const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

    return (
      <div className="flex justify-center items-center space-x-2 mt-8 pb-[88px] md:pb-0">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        {start > 1 && (
          <>
            <button
              onClick={() => setPage(1)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                page === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-gray-500">...</span>}
          </>
        )}
        {pages.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setPage(pageNum)}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
              page === pageNum ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {pageNum}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-gray-500">...</span>}
            <button
              onClick={() => setPage(totalPages)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                page === totalPages ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 space-y-8 pb-12 md:pb-16">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Favoris de la communauté</h1>
        <p className="text-sm text-gray-500">
          Les annonces les plus sauvegardées par les acheteurs sur HDMarket.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
              <div className="mt-3 space-y-2">
                <div className="h-3 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedItems.map((product) => (
              <ProductCard key={product._id} p={product} />
            ))}
          </div>
          {renderPagination()}
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Aucun favori pour le moment. Ajoutez des produits à vos favoris pour les voir ici !
        </p>
      )}
    </div>
  );
}
