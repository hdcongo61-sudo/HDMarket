import React, { useEffect, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const PAGE_LIMIT = 12;

export default function TopDiscounts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadDiscounts = async () => {
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
      setItems(filtered);
      setTotalPages(data?.pagination?.pages || 1);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message ||
          "Impossible de charger les produits en promotion."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, [page]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Promotions</h1>
        <p className="text-sm text-gray-500">
          Retrouvez ici les annonces bénéficiant des plus fortes réductions actuellement actives.
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
            {items.map((product) => (
              <ProductCard key={product._id} p={product} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs text-gray-500">
            <span>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Aucune promotion n&apos;est active pour le moment. Revenez prochainement pour profiter de nouvelles offres.
        </p>
      )}
    </div>
  );
}
