import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const PAGE_LIMIT = 12;

export default function CertifiedProducts() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCertified = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products/public', {
        params: {
          certified: true,
          sort: 'new',
          limit: PAGE_LIMIT,
          page
        }
      });
      const fetched = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const onlyCertified = fetched.filter((product) => product?.certified);
      setItems(onlyCertified);
      setTotalPages(data?.pagination?.pages || 1);
    } catch (e) {
      console.error('Erreur chargement certifiés', e);
      setError(
        e.response?.data?.message || e.message || 'Impossible de charger les produits certifiés.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertified();
  }, [page]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 space-y-4 sm:space-y-8 pb-8">
      <header className="space-y-2">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-4 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Produits certifiés</h1>
        <p className="text-xs sm:text-sm text-gray-500">
          Toutes les annonces approuvées par nos équipes certifiées HDMarket.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-2 sm:p-4 shadow-sm">
              <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
              <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
                <div className="h-3 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
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
          Aucun produit certifié n’est disponible pour le moment. Revenez plus tard.
        </p>
      )}
    </div>
  );
}
