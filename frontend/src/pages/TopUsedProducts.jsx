import React, { useEffect, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const LIMIT = 60;

export default function TopUsedProducts() {
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
        const used = Array.isArray(data?.usedProducts) ? data.usedProducts : [];
        setItems(used);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e.response?.data?.message ||
          e.message ||
          "Impossible de charger les produits d'occasion."
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
    <div className="hd-products-flow">
      <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 md:px-8 md:pb-16 space-y-6">
        <header className="hd-products-hero rounded-[28px] p-5 text-white shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:p-6">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Occasion</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Produits d&apos;occasion</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/86">
            Les meilleures affaires d&apos;occasion sélectionnées pour vous, avec une lecture plus proche d’un flux Taobao.
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
          Pas encore d&apos;annonces d&apos;occasion disponibles. Revenez plus tard pour dénicher la bonne affaire.
        </p>
      )}
      </div>
    </div>
  );
}
