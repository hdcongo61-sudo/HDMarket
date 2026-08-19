import React, { useEffect, useLayoutEffect, useState } from 'react';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';

const LIMIT = 60;
const CACHE_KEY = 'top:used';

export default function TopUsedProducts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const cached = readRouteViewCache(CACHE_KEY);
    if (!cached) return;
    setItems(Array.isArray(cached.items) ? cached.items : []);
    setError('');
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      const cachedView = readRouteViewCache(CACHE_KEY);
      if (cachedView && Array.isArray(cachedView.items) && cachedView.items.length) return;
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
        writeRouteViewCache(CACHE_KEY, { items: used });
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
        <header className="hd-products-hero rounded-2xl p-5 text-white shadow-sm sm:p-6">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Occasion</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Produits d&apos;occasion</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/86">
            Les meilleures affaires d&apos;occasion sélectionnées pour vous, avec une lecture fluide et rapide.
          </p>
        </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <ProductCardSkeleton count={10} viewMode="masonry" homeFeed />
      ) : items.length ? (
        <ProductMasonryGrid products={items} />
      ) : (
        <p className="text-sm text-gray-500">
          Pas encore d&apos;annonces d&apos;occasion disponibles. Revenez plus tard pour dénicher la bonne affaire.
        </p>
      )}
      </div>
    </div>
  );
}
