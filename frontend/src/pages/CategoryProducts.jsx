import React, { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { isApiCanceledError } from '../services/api';
import ProductCard from '../components/ProductCard';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import useCategories from '../hooks/useCategories';
import { ChevronRight, ArrowLeft, SlidersHorizontal, Grid2X2, List } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';

const SORT_OPTIONS = [
  { value: 'new', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'discount', label: 'Meilleures remises' }
];

const VIEW_MODE_STORAGE_KEY = 'hdmarket:category-product-view-mode';

export default function CategoryProducts() {
  const { categoryId } = useParams();
  const { getCategoryMeta, categoryGroups, loading: categoriesLoading } = useCategories();
  const categoryMeta = useMemo(() => getCategoryMeta(categoryId), [categoryId, getCategoryMeta]);
  const group = categoryMeta?.group ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const initialPageRef = useRef(Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1);
  const infiniteScrollLockRef = useRef(0);
  const loadMoreSentinelRef = useRef(null);

  const [items, setItems] = useState([]);
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [loadMoreRetryTick, setLoadMoreRetryTick] = useState(0);
  const [sort, setSort] = useState('new');
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved === 'list' ? 'list' : 'grid';
  });
  const [page, setPage] = useState(initialPageRef.current);
  const [totalPages, setTotalPages] = useState(1);
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
  const pageSize = compactProductsPageSize || 12;
  const snapshotKey = useMemo(
    () =>
      [
        'category-products',
        categoryMeta?.value || categoryId || 'unknown',
        isMobileView ? 'mobile' : 'desktop',
        sort || 'new'
      ].join(':'),
    [categoryId, categoryMeta?.value, isMobileView, sort]
  );
  const [activeSnapshotKey, setActiveSnapshotKey] = useState(snapshotKey);

  useLayoutEffect(() => {
    const cached = readRouteViewCache(snapshotKey);
    const nextPage = Math.max(1, Number(cached?.page || 1));
    initialPageRef.current = nextPage;
    setItems(Array.isArray(cached?.items) ? cached.items : []);
    setPage(nextPage);
    setTotalPages(Math.max(1, Number(cached?.totalPages || 1)));
    setOfflineSnapshotActive(Boolean(cached?.offlineSnapshotActive));
    setError('');
    setLoadMoreError('');
    setLoading(false);
    setActiveSnapshotKey(snapshotKey);
  }, [snapshotKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

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
      return;
    }
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
    if (!categoryMeta) {
      setItems([]);
      setTotalPages(1);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchProducts = async () => {
      if (activeSnapshotKey !== snapshotKey) return;
      const cachedView = readRouteViewCache(snapshotKey);
      if (cachedView && Number(cachedView.page || 1) >= page) {
        setLoading(false);
        return;
      }
      setLoading(true);
      if (page <= 1) {
        setError('');
      }
      setLoadMoreError('');
      try {
        const { data } = await api.get('/products/public', {
          params: {
            category: categoryMeta.value,
            sort,
            page,
            limit: pageSize
          },
          signal: controller.signal
        });

        if (!active) return;
        const fetched = Array.isArray(data) ? data : data?.items ?? [];
        const pagination = Array.isArray(data) ? { pages: 1 } : data?.pagination ?? {};
        const nextTotalPages = Math.max(1, Number(pagination.pages) || 1);
        setItems((prev) => {
          const nextItems = page > 1 ? [...prev, ...fetched] : fetched;
          writeRouteViewCache(snapshotKey, {
            items: nextItems,
            page,
            totalPages: nextTotalPages,
            offlineSnapshotActive: false
          });
          return nextItems;
        });
        setTotalPages(nextTotalPages);
        setOfflineSnapshotActive(false);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (isApiCanceledError(e)) return;
        if (shouldUseOfflineSnapshot) {
          const snapshot = await loadOfflineSnapshot(snapshotKey);
          if (snapshot && typeof snapshot === 'object') {
            const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];
            const snapshotTotalPages = Math.max(1, Number(snapshot.totalPages) || 1);
            setItems(snapshotItems);
            setTotalPages(snapshotTotalPages);
            setOfflineSnapshotActive(true);
            writeRouteViewCache(snapshotKey, {
              items: snapshotItems,
              page,
              totalPages: snapshotTotalPages,
              offlineSnapshotActive: true
            });
            setError('');
            setLoadMoreError('');
            return;
          }
        }
        const message =
          e.response?.data?.message || e.message || 'Impossible de charger les produits de cette catégorie.';
        if (page > 1) {
          setLoadMoreError(message);
        } else {
          setError(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeSnapshotKey, categoryMeta, sort, page, isMobileView, loadMoreRetryTick, pageSize, shouldUseOfflineSnapshot, snapshotKey]);

  useEffect(() => {
    if (activeSnapshotKey !== snapshotKey) return;
    if (!items.length) return;
    if (shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(snapshotKey, {
      items,
      totalPages
    });
  }, [activeSnapshotKey, items, shouldUseOfflineSnapshot, snapshotKey, totalPages]);

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
    if (viewMode === 'list') return undefined;
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
  }, [loading, loadMoreError, page, totalPages, viewMode]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pagesToRender = Math.min(5, totalPages);
    const buttons = [];
    for (let i = 1; i <= pagesToRender; i += 1) {
      buttons.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-colors ${
            page === i ? 'border-neutral-600 bg-neutral-600 text-white' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }

    if (isMobileView) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-6 pb-[88px] md:pb-0">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        {buttons}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
    );
  };

  if (categoriesLoading && !categoryMeta) {
    return (
      <div className="hd-products-flow">
        <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 pb-24 sm:space-y-7 sm:px-6 sm:py-8 md:px-8 md:pb-16">
          <div className="hd-products-hero rounded-2xl border border-neutral-200 p-4 text-white shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-white/78">Catégories</p>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Chargement de la catégorie…</h1>
            <p className="mt-1 text-sm text-white/82">Nous préparons les produits disponibles.</p>
          </div>
          <ProductCardSkeleton count={10} viewMode="masonry" />
        </div>
      </div>
    );
  }

  if (!categoryMeta) {
    return (
      <div className="hd-products-flow">
      <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 md:px-8 space-y-6">
        <div className="hd-products-hero rounded-2xl p-5 text-white sm:p-7">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/78">Catégories</p>
          <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Catégorie introuvable</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86">
            Cette catégorie n’existe pas ou n’est plus disponible. Parcourez nos univers populaires ci-dessous.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_18px_45px_rgba(117,75,36,0.08)] sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGroups.map((groupItem) => (
              <div key={groupItem.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-black text-gray-900 mb-3">{groupItem.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {groupItem.options.map((option) => (
                    <Link
                      key={option.value}
                      to={`/categories/${option.value}`}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      {option.label}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              to="/"
              className="hd-primary-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="hd-products-flow">
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 pb-24 sm:space-y-7 sm:px-6 sm:py-8 md:px-8 md:pb-16">
      <header className="space-y-4">
        {(offlineSnapshotActive || rapid3GActive) && (
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
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
        <nav className="flex items-center gap-1 text-xs text-gray-500">
          <Link to="/" className="hover:text-neutral-600 font-medium">
            Accueil
          </Link>
          <ChevronRight className="w-3 h-3" />
          {group ? (
            <>
              <span>{group.label}</span>
              <ChevronRight className="w-3 h-3" />
            </>
          ) : null}
          <span className="text-gray-900 font-semibold">{categoryMeta.label}</span>
        </nav>

        <div className="hd-products-hero rounded-2xl border border-neutral-200 p-4 text-white shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-white/78">
                {group?.label || 'Catégorie'}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{categoryMeta.label}</h1>
              <p className="mt-1 text-sm text-white/82">
                {items.length} produit{items.length > 1 ? 's' : ''} affiché{items.length > 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
              <div className="w-full md:w-auto">
                <label
                  htmlFor="category-sort"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/80"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Trier
                </label>
                <select
                  id="category-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="w-full rounded-full border border-white/30 bg-white px-3 py-3 text-sm font-black text-neutral-800 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/30 md:w-56"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-grid h-11 w-full grid-cols-2 rounded-full border border-white/30 bg-white/20 p-1 md:w-40">
                {[
                  { value: 'grid', label: 'Grille', icon: Grid2X2 },
                  { value: 'list', label: 'Liste', icon: List }
                ].map((option) => {
                  const Icon = option.icon;
                  const active = viewMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setViewMode(option.value)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
                        active
                          ? 'bg-white text-neutral-950 shadow-sm'
                          : 'text-white/78 hover:text-white'
                      }`}
                      aria-pressed={active}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {group && (
          <div className="hd-products-toolbar overflow-x-auto rounded-2xl p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              {group.options.map((option) => {
                const isActive = option.value === categoryMeta.value;
                return (
                  <Link
                    key={option.value}
                    to={`/categories/${option.value}`}
                    className={`inline-flex items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? 'hd-products-chip-active shadow-sm'
                        : 'hd-products-chip hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                    {isActive ? null : <ChevronRight className="w-3 h-3 opacity-50" />}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {error && (
        <NetworkFallbackCard
          title="Unable to load data."
          message={error}
          onRetry={() => setLoadMoreRetryTick((tick) => tick + 1)}
          retryLabel="Retry"
          refreshLabel="Refresh page"
        />
      )}

      {loading && page === 1 ? (
        <ProductCardSkeleton count={10} viewMode={viewMode === 'list' ? 'list' : 'masonry'} />
      ) : items.length ? (
        <>
          {viewMode === 'list' ? (
            <div className="space-y-3">
              {items.map((product) => (
                <ProductCard key={product._id} p={product} categoryListing viewMode="list" />
              ))}
            </div>
          ) : (
            <ProductMasonryGrid products={items} cardProps={{ categoryListing: true }} />
          )}
          {loading && page > 1 && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent" />
            </div>
          )}
          {loadMoreError && !loading && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-sm text-amber-800">{loadMoreError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadMoreError('');
                  setLoadMoreRetryTick((tick) => tick + 1);
                }}
                className="mt-2 inline-flex items-center rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 active:scale-95"
              >
                Retry
              </button>
            </div>
          )}
          {viewMode !== 'list' && <div ref={loadMoreSentinelRef} className="h-8" aria-hidden="true" />}
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
          {viewMode === 'list' ? renderPagination() : null}
        </>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
          Aucun produit disponible dans cette catégorie pour le moment. Revenez plus tard ou explorez d’autres
          sous-catégories.
        </div>
      )}
    </div>
    </div>
  );
}
