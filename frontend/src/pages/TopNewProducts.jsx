import React, { useEffect, useLayoutEffect, useState } from 'react';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';

const LIMIT = 60;
const CACHE_KEY = 'top:new';

export default function TopNewProducts() {
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
        const fresh = Array.isArray(data?.newProducts) ? data.newProducts : [];
        setItems(fresh);
        writeRouteViewCache(CACHE_KEY, { items: fresh });
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e.response?.data?.message ||
          e.message ||
          "Impossible de charger les produits neufs."
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
    <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 md:px-8 space-y-6">
      <header className="hd-products-hero rounded-2xl p-5 text-white sm:p-6">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Nouveautés</p>
        <h1 className="text-2xl md:text-3xl font-black text-white">Produits Neufs</h1>
        <p className="mt-2 text-sm text-white/86">
          Retrouvez toutes les nouveautés récemment ajoutées sur HDMarket.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <ProductCardSkeleton count={10} viewMode="masonry" />
      ) : items.length ? (
        <ProductMasonryGrid products={items} />
      ) : (
        <p className="text-sm text-gray-500">
          Aucun produit neuf n&apos;est disponible pour le moment. Revenez bientôt pour découvrir les nouveautés.
        </p>
      )}
    </div>
    </div>
  );
}
