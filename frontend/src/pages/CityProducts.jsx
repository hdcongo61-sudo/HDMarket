import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { useAppSettings } from '../context/AppSettingsContext';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';

const PAGE_LIMIT = 12;

export default function CityProducts() {
  const { cities } = useAppSettings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCity = String(searchParams.get('city') || '').trim();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cityHighlights, setCityHighlights] = useState({});
  const cacheRef = useRef(new Map());
  const externalLinkProps = useDesktopExternalLink();
  const [selectedCity, setSelectedCity] = useState(() => searchParams.get('city') || '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const loadMoreSentinelRef = useRef(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const infiniteScrollLockRef = useRef(0);
  const prevCityRef = useRef(selectedCity);
  const snapshotKey = useMemo(
    () => `city-products:/products/public:${selectedCity || 'none'}`,
    [selectedCity]
  );
  const cityOptions = useMemo(() => {
    const dynamicCities = Array.isArray(cities)
      ? cities
          .map((item) => String(typeof item === 'string' ? item : item?.name || '').trim())
          .filter(Boolean)
      : [];
    const merged = [...dynamicCities];
    if (queryCity) merged.push(queryCity);
    if (selectedCity) merged.push(selectedCity);
    return Array.from(new Set(merged));
  }, [cities, queryCity, selectedCity]);

  useEffect(() => {
    if (!cityOptions.length) return;
    if (!selectedCity || !cityOptions.includes(selectedCity)) {
      if (queryCity && cityOptions.includes(queryCity)) {
        setSelectedCity(queryCity);
      } else {
        setSelectedCity(cityOptions[0]);
      }
    }
  }, [cityOptions, queryCity, selectedCity]);

  useEffect(() => {
    const controller = new AbortController();
    const loadHighlights = async () => {
      try {
        const { data } = await api.get('/products/public/highlights', {
          params: { limit: 12 },
          signal: controller.signal
        });
        if (data?.cityHighlights && typeof data.cityHighlights === 'object') {
          setCityHighlights(data.cityHighlights);
        }
      } catch (e) {
        // ignore highlight fetch errors
      }
    };
    loadHighlights();
    return () => controller.abort();
  }, []);

  // Restore the previous view synchronously so back navigation paints instantly
  useLayoutEffect(() => {
    if (!selectedCity) return;
    const cached = readRouteViewCache(snapshotKey);
    if (!cached) return;
    setItems(Array.isArray(cached.items) ? cached.items : []);
    setPage(Math.max(1, Number(cached.page) || 1));
    setTotalPages(Math.max(1, Number(cached.totalPages) || 1));
    setError('');
    setLoading(false);
  }, [selectedCity, snapshotKey]);

  useEffect(() => {
    if (!selectedCity) return;

    const cachedView = readRouteViewCache(snapshotKey);
    if (cachedView && Number(cachedView.page || 1) >= page) {
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(selectedCity);
    if (cached) {
      setItems(cached.items);
      setError(cached.error || '');
      setLoading(false);
      if (cached.nextRetry && Date.now() < cached.nextRetry) {
        return;
      }
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products/public', {
          params: { city: selectedCity, page, limit: PAGE_LIMIT },
          signal: controller.signal
        });
        const list = Array.isArray(data) ? data : data?.items || [];
        const pages = data?.pagination?.pages || 1;
        setItems((prev) => {
          const nextItems = page > 1 ? [...prev, ...list] : list;
          writeRouteViewCache(snapshotKey, {
            items: nextItems,
            page,
            totalPages: pages
          });
          return nextItems;
        });
        setTotalPages(pages);
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e.response?.data?.message || e.message || 'Impossible de charger les produits.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [selectedCity, page, snapshotKey]);

  // Reset pagination when city changes (skip when a cached view was restored)
  useEffect(() => {
    if (prevCityRef.current === selectedCity) return;
    prevCityRef.current = selectedCity;
    if (readRouteViewCache(snapshotKey)) return;
    setPage(1);
    setItems([]);
  }, [selectedCity, snapshotKey]);

  useEffect(() => {
    if (!selectedCity) return;
    if (selectedCity === queryCity) return;
    setSearchParams({ city: selectedCity }, { replace: true });
  }, [selectedCity, queryCity, setSearchParams]);

  const title = useMemo(() => {
    if (!selectedCity) return 'Produits par ville';
    return `Produits disponibles à ${selectedCity}`;
  }, [selectedCity]);

  // Infinite scroll via scroll event
  useEffect(() => {
    if (loading) return;
    if (page >= totalPages) return;
    const handleScroll = () => {
      const now = Date.now();
      if (now - infiniteScrollLockRef.current < 300) return;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400) {
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, totalPages));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, page, totalPages]);

  // Infinite scroll via IntersectionObserver (fallback)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;
    if (loading || page >= totalPages) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      const now = Date.now();
      if (now - infiniteScrollLockRef.current < 300) return;
      infiniteScrollLockRef.current = now;
      setPage((prev) => Math.min(prev + 1, totalPages));
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, page, totalPages]);

  // Back-to-top visibility
  useEffect(() => {
    const t = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', t, { passive: true });
    t();
    return () => window.removeEventListener('scroll', t);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="hd-products-flow">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <header className="hd-products-hero flex flex-col gap-3 rounded-2xl p-5 text-white sm:gap-4 sm:p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 mb-3 sm:mb-4 text-sm font-semibold text-white/86 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Retour
            </button>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Ville</p>
            <h1 className="text-xl sm:text-3xl font-black text-white">{title}</h1>
            <p className="mt-2 text-xs sm:text-sm text-white/86">
              Consultez les annonces publiées depuis nos principales villes de la République du Congo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="city-select" className="text-sm font-bold text-white/86">
              Choisir une ville
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className="rounded-full border border-white/30 bg-white px-3 py-2 text-sm font-black text-gray-800 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="mb-2 break-inside-avoid rounded-[14px] border border-gray-200 bg-white p-2 shadow-sm sm:mb-3">
                <div className={`${index % 3 === 1 ? 'aspect-[4/5]' : 'aspect-square'} mb-2 rounded-xl bg-gray-100 animate-pulse`} />
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="h-3 sm:h-4 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 sm:h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 sm:h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <>
            <ProductMasonryGrid products={items} />
            <div ref={loadMoreSentinelRef} className="h-px" />
            {loading && page > 1 && (
              <div className="flex justify-center py-4">
                <ArrowPathIcon className="w-6 h-6 animate-spin text-[#e85d00]" />
              </div>
            )}
            {!loading && page < totalPages && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-[0.97]"
                >
                  Afficher plus
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Aucune annonce disponible pour cette ville pour le moment.
          </div>
        )}

        <section className="rounded-xl border border-neutral-100 bg-white px-4 py-4 text-sm text-neutral-700 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="font-semibold text-neutral-800">
              Besoin d&apos;accéder aux annonces d&apos;une catégorie spécifique&nbsp;?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Parcourir tous les produits
              </Link>
              <Link
                to="/#categories"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-gray-50"
              >
                Voir les catégories
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Back-to-Top FAB */}
      {showBackToTop && (
        <button type="button" onClick={scrollToTop} className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg shadow-black/20 active:scale-90 transition-transform" aria-label="Retour en haut">
          <svg className="h-5 w-5 -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  );
}
