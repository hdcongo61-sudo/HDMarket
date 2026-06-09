import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { TrendingUp, Award, ShoppingCart, ArrowLeft } from 'lucide-react';
import { buildProductPath } from '../utils/links';

const PAGE_LIMIT = 12;

export default function TopSales() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const loadMoreSentinelRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);

  useEffect(() => {
    if (Number.isInteger(pageParam) && pageParam > 0) {
      setPage(pageParam);
    }
  }, [pageParam]);

  const fetchTopSales = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products/public/top-sales', {
        params: {
          limit: PAGE_LIMIT,
          page
        }
      });
      const fetched = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems((prev) => (page > 1 ? [...prev, ...fetched] : fetched));
      setTotalPages(data?.pagination?.pages || 1);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Impossible de charger les produits les plus vendus."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopSales();
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

  useEffect(() => {
    const targetPage = page === 1 ? null : String(page);
    const currentInUrl = searchParams.get('page');
    if (currentInUrl === targetPage) return;

    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      return params;
    }, { replace: true });
  }, [page, searchParams, setSearchParams]);

  const formatCount = (value) => Number(value || 0).toLocaleString('fr-FR');

  return (
    <div className="hd-products-flow">
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <header className="hd-products-hero rounded-3xl p-4 text-white sm:p-6 lg:p-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 mb-4 text-sm font-semibold text-white/86 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white">
                Produits les plus vendus
              </h1>
              <p className="text-xs sm:text-sm text-white/86 mt-1">
                Les best-sellers de HDMarket basés sur les ventes réelles
              </p>
            </div>
          </div>
        </header>

        {loading && page === 1 ? (
          <ProductCardSkeleton count={10} viewMode="masonry" />
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-sm sm:text-base text-red-700 font-semibold">{error}</p>
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5">
              {items.map((product, index) => (
                <div key={product._id} className="relative mb-2 break-inside-avoid sm:mb-3">
                  {/* Ranking Badge */}
                  {index < 3 && (
                    <div className="absolute -top-2 -left-2 z-30">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        'bg-gradient-to-br from-amber-600 to-amber-800'
                      }`}>
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                        <span className="text-xs font-black text-gray-900">#{index + 1}</span>
                      </div>
                    </div>
                  )}
                  <ProductCard
                    p={product}
                    productLink={buildProductPath(product)}
                    commerceFeed
                  />
                </div>
              ))}
            </div>

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
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun produit vendu</h3>
            <p className="text-gray-600 text-sm">
              Les produits les plus vendus apparaîtront ici une fois que des commandes seront confirmées.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
