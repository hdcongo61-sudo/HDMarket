import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import { getCategoryMeta } from '../data/categories';
import { recordProductView } from '../utils/recentViews';

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
const categoryParam = (searchParams.get('category') || '').trim();
const sortParam = searchParams.get('sort') || '';
const shopVerifiedParam = searchParams.get('shopVerified') === 'true';
const installmentOnlyParam = searchParams.get('installmentOnly') === 'true';
const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState(() => {
    const s = sortParam || 'new';
    return s === 'newest' ? 'new' : s;
  });
  const [shopVerified, setShopVerified] = useState(shopVerifiedParam);
  const [installmentOnly, setInstallmentOnly] = useState(installmentOnlyParam);
const pageParam = Number(searchParams.get('page'));
const initialPageRef = useRef(Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1);
const [page, setPage] = useState(initialPageRef.current);
const [isMobileView, setIsMobileView] = useState(() =>
  typeof window === 'undefined' ? false : window.innerWidth <= 767
);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(categoryParam);

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
  setError('');
  try {
      const params = {
        sort,
        page,
        limit: PAGE_SIZE
      };
      if (searchTerm) params.q = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (shopVerified) params.shopVerified = 'true';
      if (installmentOnly) params.installmentOnly = 'true';
      const { data } = await api.get('/products/public', { params });
      const fetchedItems = Array.isArray(data) ? data : data?.items || [];
      const paginationMeta = Array.isArray(data) ? { pages: 1 } : data?.pagination || {};
      setItems((prev) => (isMobileView && page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      setTotalPages(Math.max(1, Number(paginationMeta.pages) || 1));
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [page, sort, searchTerm, categoryFilter, shopVerified, installmentOnly]);

  useEffect(() => {
    initialPageRef.current = 1;
    setPage(1);
    setItems([]);
    setTotalPages(1);
  }, [sort, searchTerm, categoryFilter, shopVerified, installmentOnly]);

  useEffect(() => {
    if (!isMobileView) return;
    if (loading) return;
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
  }, [isMobileView, loading, page, totalPages]);

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
  }, [page, setSearchParams]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

const paginationButtons = useMemo(() => {
  const buttons = [];
  const visiblePages = Math.min(5, totalPages);
  for (let i = 1; i <= visiblePages; i += 1) {
    buttons.push(
        <button
          key={i}
          type="button"
          onClick={() => setPage(i)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-colors ${
            page === i
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }
  return buttons;
}, [page, totalPages]);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Tous les produits</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Parcourez les annonces disponibles sur HDMarket et découvrez les nouveautés.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Recherche avancée
          </Link>
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:w-auto flex flex-col sm:flex-row gap-2 sm:items-center"
          >
            <div className="relative flex-1 sm:min-w-[280px]">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Rechercher
              </button>
              {searchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Effacer
                </button>
              )}
            </div>
          </form>
        </header>

        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
            <span>
              {items.length} résultat{items.length > 1 ? 's' : ''} affiché{items.length > 1 ? 's' : ''}
            </span>
            {searchTerm && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                Filtre&nbsp;:&nbsp;{searchTerm}
              </span>
            )}
            {categoryFilter && (
              <button
                type="button"
                onClick={clearCategoryFilter}
                className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 transition-colors"
              >
                Catégorie&nbsp;:&nbsp;{categoryMeta?.label || categoryFilter}
                <span aria-hidden="true">×</span>
              </button>
            )}
            {installmentOnly && (
              <button
                type="button"
                onClick={() => handleInstallmentFilterChange(false)}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
              >
                Paiement par tranche
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <input
                type="checkbox"
                checked={installmentOnly}
                onChange={(event) => handleInstallmentFilterChange(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Tranche uniquement
            </label>
            <label htmlFor="sort-options" className="text-xs sm:text-sm text-gray-600">
              Trier par
            </label>
            <select
              id="sort-options"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-lg sm:rounded-xl border border-gray-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-gray-200 bg-white p-2 sm:p-4 shadow-sm">
                <div className="mb-2 sm:mb-3 aspect-square rounded-lg bg-gray-100 animate-pulse" />
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="h-3 sm:h-4 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 sm:h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 sm:h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <ProductCard
                key={product._id}
                p={product}
                onProductClick={recordProductView}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Aucun produit ne correspond à votre recherche pour le moment.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            {paginationButtons}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}

        <section className="rounded-xl border border-indigo-100 bg-white px-4 py-4 text-sm text-indigo-700 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-indigo-800">
              Besoin d&apos;une catégorie spécifique&nbsp;?
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Retour à la page d&apos;accueil
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
