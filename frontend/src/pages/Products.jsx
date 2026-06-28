import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import api, { isApiCanceledError } from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import useCategories from '../hooks/useCategories';
import { recordProductView } from '../utils/recentViews';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';

const SORT_OPTIONS = [
  { value: 'new', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'popular', label: 'Tendances' },
  { value: 'discount', label: 'Meilleures remises' }
];

const PAGE_SIZE = 12;

export default function Products() {
const [searchParams, setSearchParams] = useSearchParams();
const { getCategoryMeta } = useCategories();
const categoryParam = (searchParams.get('category') || '').trim();
const sortParam = searchParams.get('sort') || '';
const shopVerifiedParam = searchParams.get('shopVerified') === 'true';
const installmentOnlyParam = searchParams.get('installmentOnly') === 'true';
const [items, setItems] = useState([]);
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [sort, setSort] = useState(() => {
    const s = sortParam || 'new';
    return s === 'newest' ? 'new' : s;
  });
  const [shopVerified, setShopVerified] = useState(shopVerifiedParam);
  const [installmentOnly, setInstallmentOnly] = useState(installmentOnlyParam);
const pageParam = Number(searchParams.get('page'));
const initialPageRef = useRef(Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1);
const infiniteScrollLockRef = useRef(0);
const loadMoreSentinelRef = useRef(null);
const [page, setPage] = useState(initialPageRef.current);
const [isMobileView, setIsMobileView] = useState(() =>
  typeof window === 'undefined' ? false : window.innerWidth <= 767
);
  const {
    rapid3GActive,
    compactProductsPageSize,
    shouldUseOfflineSnapshot,
    offlineBannerText,
    rapid3GBannerText
  } = useNetworkProfile();
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(categoryParam);
  const pageSize = compactProductsPageSize || PAGE_SIZE;
  const snapshotKey = useMemo(
    () =>
      [
        'products',
        isMobileView ? 'mobile' : 'desktop',
        categoryFilter || 'all',
        sort || 'new',
        searchTerm || 'none',
        shopVerified ? 'verified' : 'all',
        installmentOnly ? 'installment' : 'standard'
      ].join(':'),
    [categoryFilter, installmentOnly, isMobileView, searchTerm, shopVerified, sort]
  );

  useEffect(() => {
    setCategoryFilter(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    const s = sortParam || 'new';
    setSort(s === 'newest' ? 'new' : s);
    setShopVerified(shopVerifiedParam);
    setInstallmentOnly(installmentOnlyParam);
  }, [sortParam, shopVerifiedParam, installmentOnlyParam]);

  // Initialize search from URL parameter
  const searchParam = searchParams.get('search') || '';
  useEffect(() => {
    if (searchParam) {
      setSearchInput(searchParam);
      setSearchTerm(searchParam);
    }
  }, [searchParam]);

const fetchProducts = useCallback(async () => {
  setLoading(true);
  if (page <= 1) {
    setError('');
  }
  setLoadMoreError('');
  try {
      const params = {
        sort,
        page,
        limit: pageSize
      };
      if (searchTerm) params.q = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (shopVerified) params.shopVerified = 'true';
      if (installmentOnly) params.installmentOnly = 'true';
      const { data } = await api.get('/products/public', { params });
      const fetchedItems = Array.isArray(data) ? data : data?.items || [];
      const paginationMeta = Array.isArray(data) ? { pages: 1 } : data?.pagination || {};
      setItems((prev) => (page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      setTotalPages(Math.max(1, Number(paginationMeta.pages) || 1));
      setOfflineSnapshotActive(false);
    } catch (e) {
      if (isApiCanceledError(e)) {
        return;
      }
      if (shouldUseOfflineSnapshot) {
        const snapshot = await loadOfflineSnapshot(snapshotKey);
        if (snapshot && typeof snapshot === 'object') {
          setItems(Array.isArray(snapshot.items) ? snapshot.items : []);
          setTotalPages(Math.max(1, Number(snapshot.totalPages) || 1));
          setOfflineSnapshotActive(true);
          setError('');
          setLoadMoreError('');
          return;
        }
      }
      const message = e.response?.data?.message || e.message || 'Impossible de charger les produits.';
      if (page > 1) {
        setLoadMoreError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sort,
    searchTerm,
    categoryFilter,
    shopVerified,
    installmentOnly,
    isMobileView,
    pageSize,
    shouldUseOfflineSnapshot,
    snapshotKey
  ]);

  useEffect(() => {
    initialPageRef.current = 1;
    setPage(1);
    setItems([]);
    setTotalPages(1);
  }, [sort, searchTerm, categoryFilter, shopVerified, installmentOnly]);

  useEffect(() => {
    if (loading) return;
    if (loadMoreError) return;
    if (page >= totalPages) return;
    const handleScroll = () => {
      const now = Date.now();
      if (now - infiniteScrollLockRef.current < 400) return;
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, totalPages));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadMoreError, page, totalPages]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;
    if (loading || loadMoreError || page >= totalPages) return undefined;

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
  }, [loading, loadMoreError, page, totalPages]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileView(window.innerWidth <= 767);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const targetPage = page === 1 ? null : String(page);
    const currentInUrl = searchParams.get('page');
    if (currentInUrl === targetPage) return;

    if (page === initialPageRef.current) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (page === 1) {
          params.delete('page');
        } else {
          params.set('page', String(page));
        }
        return params;
      }, { replace: true });
    } else {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (page === 1) {
          params.delete('page');
        } else {
          params.set('page', String(page));
        }
        return params;
      }, { replace: false });
    }
  }, [page, searchParams, setSearchParams]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!items.length) return;
    if (shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(snapshotKey, {
      items,
      totalPages
    });
  }, [items, shouldUseOfflineSnapshot, snapshotKey, totalPages]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    // Update URL with search parameter
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      } else {
        params.delete('search');
      }
      params.delete('page'); // Reset to page 1 on new search
      return params;
    }, { replace: true });
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    // Remove search parameter from URL
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('search');
      params.delete('page'); // Reset to page 1
      return params;
    }, { replace: true });
  };

  const categoryMeta = useMemo(() => getCategoryMeta(categoryFilter), [categoryFilter]);

  const clearCategoryFilter = useCallback(() => {
    setCategoryFilter('');
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleInstallmentFilterChange = useCallback(
    (enabled) => {
      setInstallmentOnly(enabled);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (enabled) {
            params.set('installmentOnly', 'true');
          } else {
            params.delete('installmentOnly');
          }
          params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return (
    <div className="hd-products-flow">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <header className="hd-products-hero overflow-hidden rounded-2xl p-4 text-white sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Catalogue HDMarket
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-4xl">Tous les produits</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/88">
                Parcourez les annonces disponibles avec une navigation rapide, des filtres lisibles et des cartes pensées pour mobile.
              </p>
            </div>
            <form
              onSubmit={handleSearchSubmit}
              className="w-full lg:max-w-xl"
            >
              <div className="hd-products-search flex items-center gap-2 rounded-full bg-white px-3 py-2">
                <Search className="h-5 w-5 shrink-0 text-[#FF6A00]" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Rechercher un produit..."
                  className="min-h-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:ring-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="hd-primary-button min-h-0 rounded-full px-4 py-2 text-sm font-black"
                >
                  Rechercher
                </button>
              </div>
            </form>
          </div>
        </header>

        {(offlineSnapshotActive || rapid3GActive) && (
          <section
            className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
              offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        )}

        <section className="hd-products-toolbar flex flex-col gap-3 rounded-2xl px-3 py-3 sm:px-4 md:sticky md:top-20 md:z-20 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
            <span>
              {items.length} résultat{items.length > 1 ? 's' : ''} affiché{items.length > 1 ? 's' : ''}
            </span>
            {searchTerm && (
              <span className="hd-products-chip-active rounded-full px-3 py-1 text-xs font-semibold">
                Filtre&nbsp;:&nbsp;{searchTerm}
              </span>
            )}
            {categoryFilter && (
              <button
                type="button"
                onClick={clearCategoryFilter}
                className="hd-products-chip-active inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              >
                Catégorie&nbsp;:&nbsp;{categoryMeta?.label || categoryFilter}
                <span aria-hidden="true">×</span>
              </button>
            )}
            {installmentOnly && (
              <button
                type="button"
                onClick={() => handleInstallmentFilterChange(false)}
                className="hd-products-chip-active inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              >
                Paiement par tranche
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              to="/search"
              className="hd-products-chip inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black sm:text-sm"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#FF6A00]" />
              Recherche avancée
            </Link>
            <label className="hd-products-chip inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black sm:text-sm">
              <input
                type="checkbox"
                checked={installmentOnly}
                onChange={(event) => handleInstallmentFilterChange(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
              />
              <CreditCard className="h-4 w-4 text-[#FF6A00]" />
              Tranche uniquement
            </label>
            <select
              id="sort-options"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 sm:text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <NetworkFallbackCard
            title="Unable to load data."
            message={error}
            onRetry={fetchProducts}
            retryLabel="Retry"
            refreshLabel="Refresh page"
          />
        )}

        {loading && items.length === 0 ? (
          <ProductCardSkeleton count={10} viewMode="masonry" />
        ) : items.length ? (
          <>
            <ProductMasonryGrid products={items} onProductClick={recordProductView} />
            {loading && page > 1 && (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent" />
              </div>
            )}
            {loadMoreError && !loading && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="text-sm text-amber-800">{loadMoreError}</p>
                <button
                  type="button"
                  onClick={fetchProducts}
                  className="mt-2 inline-flex items-center rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 active:scale-95"
                >
                  Retry
                </button>
              </div>
            )}
            <div ref={loadMoreSentinelRef} className="h-8" aria-hidden="true" />
            {!loading && !loadMoreError && page < totalPages && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-500 shadow-sm active:scale-95"
                >
                  Charger plus
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[#FF6A00]" />
            <p className="font-bold text-gray-900">Aucun produit ne correspond à votre recherche pour le moment.</p>
          </div>
        )}

        <section className="rounded-2xl border border-neutral-100 bg-white px-4 py-4 text-sm text-neutral-700 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-neutral-800">
              Besoin d&apos;une catégorie spécifique&nbsp;?
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-500"
            >
              Retour à la page d&apos;accueil
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
