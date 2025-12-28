import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import { getCategoryMeta } from '../data/categories';

const SORT_OPTIONS = [
  { value: 'new', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'discount', label: 'Meilleures remises' }
];

const PAGE_SIZE = 12;

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = (searchParams.get('category') || '').trim();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(categoryParam);

  useEffect(() => {
    setCategoryFilter(categoryParam);
  }, [categoryParam]);

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
      const { data } = await api.get('/products/public', { params });
      const fetchedItems = Array.isArray(data) ? data : data?.items || [];
      const paginationMeta = Array.isArray(data) ? { pages: 1 } : data?.pagination || {};
      setItems(fetchedItems);
      setTotalPages(Math.max(1, Number(paginationMeta.pages) || 1));
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [page, sort, searchTerm, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [sort, searchTerm, categoryFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tous les produits</h1>
            <p className="text-sm text-gray-500">
              Parcourez les annonces disponibles sur HDMarket et découvrez les nouveautés.
            </p>
          </div>
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
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
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort-options" className="text-sm text-gray-600">
              Trier par
            </label>
            <select
              id="sort-options"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 h-48 rounded-xl bg-gray-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 rounded bg-gray-100 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <ProductCard key={product._id} p={product} />
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
