import React, { useEffect, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const LIMIT = 60;

export default function TopDiscounts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        const discounts = Array.isArray(data?.topDiscounts) ? data.topDiscounts : [];
        setItems(discounts);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e.response?.data?.message ||
            e.message ||
            "Impossible de charger les produits en promotion."
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((product) => (
            <ProductCard key={product._id} p={product} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Aucune promotion n&apos;est active pour le moment. Revenez prochainement pour profiter de nouvelles offres.
        </p>
      )}
    </div>
  );
}

