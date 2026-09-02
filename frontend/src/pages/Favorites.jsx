import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, FunnelIcon, HeartIcon } from '@heroicons/react/24/outline';
import AuthContext from '../context/AuthContext';
import FavoriteContext from '../context/FavoriteContext';
import ProductCard from '../components/ProductCard';
import useCategories from '../hooks/useCategories';
import { useAppSettings } from '../context/AppSettingsContext';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';

const PAGE_SIZE = 12;

const PRICE_RANGES = [
  { value: 'all', label: 'Tous les prix', min: null, max: null },
  { value: '0-10000', label: '0 - 10 000', min: 0, max: 10000 },
  { value: '10000-50000', label: '10 000 - 50 000', min: 10000, max: 50000 },
  { value: '50000-100000', label: '50 000 - 100 000', min: 50000, max: 100000 },
  { value: '100000-500000', label: '100 000 - 500 000', min: 100000, max: 500000 },
  { value: '500000+', label: '500 000+', min: 500000, max: null }
];

export default function Favorites() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { favorites, loading } = useContext(FavoriteContext);
  const { getCategoryMeta } = useCategories();
  const { t } = useAppSettings();
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPrice, setFilterPrice] = useState('all');
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );
  const [cachedFavorites, setCachedFavorites] = useState([]);

  // Favorites are user-specific: scope the snapshot key to the account so
  // users never see each other's cached view.
  const snapshotKey = useMemo(
    () =>
      [
        'favorites',
        user?._id || user?.id || 'guest',
        isMobileView ? 'mobile' : 'desktop'
      ].join(':'),
    [user?._id, user?.id, isMobileView]
  );

  // While the context is (re)loading, fall back to the cached list so the
  // first paint after back-navigation already shows the previous content.
  const effectiveFavorites =
    loading && favorites.length === 0 ? cachedFavorites : favorites;

  const lastViewRef = useRef({
    count: favorites.length,
    filterCategory,
    filterPrice
  });

  const categoriesInFavorites = useMemo(() => {
    const seen = new Set();
    const list = [];
    effectiveFavorites.forEach((p) => {
      const cat = p?.category;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        const meta = getCategoryMeta(cat);
        list.push({ value: cat, label: meta?.label || cat });
      }
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [effectiveFavorites]);

  const priceRange = useMemo(
    () => PRICE_RANGES.find((r) => r.value === filterPrice) || PRICE_RANGES[0],
    [filterPrice]
  );

  const filteredFavorites = useMemo(() => {
    return effectiveFavorites.filter((p) => {
      if (filterCategory && (p?.category || '') !== filterCategory) return false;
      const price = Number(p?.price ?? 0);
      if (priceRange.min != null && price < priceRange.min) return false;
      if (priceRange.max != null && price > priceRange.max) return false;
      return true;
    });
  }, [effectiveFavorites, filterCategory, priceRange]);

  const hasFavorites = effectiveFavorites.length > 0;
  const totalPages = Math.max(1, Math.ceil(filteredFavorites.length / PAGE_SIZE));

  // Restore the last viewed list/page/filters for this exact view before the
  // first paint (layout effect) so coming back shows the previous content
  // instantly and browser scroll restoration lands at the right position.
  useLayoutEffect(() => {
    const cached = readRouteViewCache(snapshotKey);
    const restoredItems = Array.isArray(cached?.items) ? cached.items : [];
    const restoredFilterCategory =
      typeof cached?.filterCategory === 'string' ? cached.filterCategory : filterCategory;
    const restoredFilterPrice =
      typeof cached?.filterPrice === 'string' ? cached.filterPrice : filterPrice;
    setCachedFavorites(restoredItems);
    if (cached) {
      setPage(Math.max(1, Number(cached.page) || 1));
      setFilterCategory(restoredFilterCategory);
      setFilterPrice(restoredFilterPrice);
    }
    lastViewRef.current = {
      count: loading && favorites.length === 0 ? restoredItems.length : favorites.length,
      filterCategory: restoredFilterCategory,
      filterPrice: restoredFilterPrice
    };
  }, [snapshotKey]);

  useEffect(() => {
    const prev = lastViewRef.current;
    lastViewRef.current = {
      count: effectiveFavorites.length,
      filterCategory,
      filterPrice
    };
    if (
      prev.count === effectiveFavorites.length &&
      prev.filterCategory === filterCategory &&
      prev.filterPrice === filterPrice
    ) {
      return;
    }
    // The favorites list landing asynchronously after mount must not wipe a
    // restored page.
    if (prev.count === 0 && effectiveFavorites.length > 0) return;
    setPage(1);
  }, [effectiveFavorites.length, filterCategory, filterPrice]);

  // Keep the snapshot fresh so back-navigation can restore this exact view.
  useEffect(() => {
    if (loading) return;
    writeRouteViewCache(snapshotKey, {
      items: favorites,
      page,
      filterCategory,
      filterPrice
    });
  }, [snapshotKey, favorites, loading, page, filterCategory, filterPrice]);

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
    if (!isMobileView) return;
    if (page >= totalPages) return;
    const handleScroll = () => {
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        setPage((prev) => Math.min(prev + 1, totalPages));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileView, page, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedFavorites = useMemo(() => {
    const end = page * PAGE_SIZE;
    return filteredFavorites.slice(0, end);
  }, [filteredFavorites, page]);

  const renderPagination = () => {
    if (isMobileView) return null;
    if (filteredFavorites.length <= PAGE_SIZE) return null;

    const visiblePages = Math.min(5, totalPages);
    const half = Math.floor(visiblePages / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + visiblePages - 1);
    start = Math.max(1, end - visiblePages + 1);
    const pageNumbers = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

    return (
      <div className="flex justify-center items-center space-x-2 mt-8 mb-4 pb-[88px] md:pb-0">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors tap-feedback"
        >
          ‹
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => setPage(1)}
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border transition-colors tap-feedback ${
            page === 1 ? 'border-black bg-black text-white' : 'border-[#e2dcd2] bg-white hover:bg-[#f5f2ee]'
              }`}
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-gray-500">...</span>}
          </>
        )}

        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setPage(pageNum)}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
              page === pageNum ? 'border-black bg-black text-white' : 'border-[#e2dcd2] bg-white hover:bg-[#f5f2ee]'
            }`}
          >
            {pageNum}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-gray-500">...</span>}
            <button
              onClick={() => setPage(totalPages)}
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border transition-colors tap-feedback ${
                page === totalPages ? 'border-black bg-black text-white' : 'border-[#e2dcd2] bg-white hover:bg-[#f5f2ee]'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page >= totalPages}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors tap-feedback"
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f2ee] text-[#231f1b]">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 pb-24 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8 md:pb-16">
      <header className="rounded-2xl border border-[#e2dcd2] bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] bg-white text-[#231f1b] transition active:scale-95"
            aria-label={t('market.back', 'Retour')}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-black tracking-tight text-[#231f1b] sm:text-2xl">{t('market.favoritesTitle', 'Mes favoris')}</h1>
              {!loading ? <span className="text-sm font-black text-[#8a8378]">({favorites.length})</span> : null}
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#8a8378] sm:text-sm">{t('market.favoritesSubtitle', 'Les produits que vous souhaitez retrouver rapidement')}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0e4] text-[#e85d00]">
            <HeartIcon className="h-5 w-5" fill="currentColor" />
          </span>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-[#e2dcd2] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-[#e85d00] border-t-transparent" />
          <p className="font-semibold text-gray-600">{t('market.loadingFavorites', 'Chargement de vos favoris…')}</p>
        </div>
      ) : hasFavorites ? (
        <>
          {/* Filters — Category & Price */}
          <div className="rounded-2xl border border-[#e2dcd2] bg-white p-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-black text-[#231f1b]">
              <FunnelIcon className="w-4 h-4 text-[#e85d00]" />
              {t('market.filters', 'Filtres')}
              </div>
              <p className="text-xs font-bold text-[#8a8378]">
                {filteredFavorites.length} {t(filteredFavorites.length === 1 ? 'market.item' : 'market.items', filteredFavorites.length === 1 ? 'article' : 'articles')}
                {(filterCategory || filterPrice !== 'all') && ` ${t('market.of', 'sur')} ${favorites.length}`}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="shrink-0">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="min-h-11 min-w-[170px] rounded-full border border-[#e2dcd2] bg-white py-2 pl-4 pr-9 text-sm font-bold text-[#231f1b] outline-none focus:border-[#e85d00] focus:ring-2 focus:ring-[#fff0e4]"
                  aria-label={t('market.filterCategory', 'Filtrer par catégorie')}
                >
                  <option value="">{t('market.allCategories', 'Toutes les catégories')}</option>
                  {categoriesInFavorites.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="shrink-0">
                <select
                  value={filterPrice}
                  onChange={(e) => setFilterPrice(e.target.value)}
                  className="min-h-11 min-w-[180px] rounded-full border border-[#e2dcd2] bg-white py-2 pl-4 pr-9 text-sm font-bold text-[#231f1b] outline-none focus:border-[#e85d00] focus:ring-2 focus:ring-[#fff0e4]"
                  aria-label={t('market.filterPrice', 'Filtrer par prix')}
                >
                  {PRICE_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value === 'all' ? t('market.allPrices', 'Tous les prix') : r.label}
                    </option>
                  ))}
                </select>
              </div>
              {(filterCategory || filterPrice !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('');
                    setFilterPrice('all');
                    setPage(1);
                  }}
                  className="min-h-11 shrink-0 rounded-full bg-black px-4 text-sm font-black text-white"
                >
                  {t('market.reset', 'Réinitialiser')}
                </button>
              )}
            </div>
          </div>

          {filteredFavorites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e2dcd2] bg-white px-6 py-10 text-center">
              <p className="font-black text-[#231f1b]">{t('market.favoritesEmptyFiltered', 'Aucun favori ne correspond aux filtres.')}</p>
              <p className="mt-1 text-sm text-[#8a8378]">{t('market.changeFilters', 'Modifiez les filtres ou réinitialisez.')}</p>
              <button
                type="button"
                onClick={() => { setFilterCategory(''); setFilterPrice('all'); setPage(1); }}
                className="mt-4 min-h-11 rounded-full bg-black px-5 text-sm font-black text-white"
              >
                {t('market.resetFilters', 'Réinitialiser les filtres')}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {paginatedFavorites.map((product) => (
                  <ProductCard key={product._id} p={product} compactMobile commerceFeed />
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-[#e2dcd2] bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0e4] text-[#e85d00]">
            <HeartIcon className="h-7 w-7" />
          </div>
          <p className="text-lg font-black text-[#231f1b]">{t('market.favoritesEmpty', 'Aucun favori pour le moment')}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a8378]">
            {t('market.favoritesEmptySubtitle', 'Explorez le catalogue et cliquez sur le cœur d’un produit pour le retrouver ici.')}
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 font-black text-white"
          >
            {t('market.discoverProducts', 'Découvrir les produits')}
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
