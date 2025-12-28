import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import categoryGroups, { getCategoryMeta } from '../data/categories';
import { ChevronRight, ArrowLeft } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'new', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'discount', label: 'Meilleures remises' }
];

export default function CategoryProducts() {
  const { categoryId } = useParams();
  const categoryMeta = useMemo(() => getCategoryMeta(categoryId), [categoryId]);
  const group = categoryMeta?.group ?? null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [categoryId]);

  useEffect(() => {
    if (!categoryMeta) {
      setItems([]);
      setTotalPages(1);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchProducts = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products/public', {
          params: {
            category: categoryMeta.value,
            sort,
            page,
            limit: 12
          },
          signal: controller.signal
        });

        if (!active) return;
        const fetched = Array.isArray(data) ? data : data?.items ?? [];
        const pagination = Array.isArray(data) ? { pages: 1 } : data?.pagination ?? {};
        setItems(fetched);
        setTotalPages(Math.max(1, Number(pagination.pages) || 1));
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e.response?.data?.message || e.message || 'Impossible de charger les produits de cette catégorie.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      active = false;
      controller.abort();
    };
  }, [categoryMeta, sort, page]);

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
            page === i ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }

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

  if (!categoryMeta) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-8 space-y-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Catégorie introuvable</h1>
          <p className="text-sm text-gray-600">
            Cette catégorie n’existe pas ou n’est plus disponible. Parcourez nos catégories populaires ci-dessous.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryGroups.map((groupItem) => (
              <div key={groupItem.id} className="rounded-2xl border border-gray-100 p-4 bg-white shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{groupItem.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {groupItem.options.map((option) => (
                    <Link
                      key={option.value}
                      to={`/categories/${option.value}`}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6 sm:py-8 sm:space-y-8 pb-24 md:pb-16">
      <header className="space-y-4">
        <nav className="flex items-center gap-1 text-xs text-gray-500">
          <Link to="/" className="hover:text-indigo-600 font-medium">
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{categoryMeta.label}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Produits approuvés récemment ajoutés dans cette sous-catégorie.
            </p>
          </div>

          <div className="w-full md:w-auto flex items-center gap-3">
            <label
              htmlFor="category-sort"
              className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
            >
              Trier
            </label>
            <select
              id="category-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="flex-1 md:flex-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {group && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {group.options.map((option) => {
              const isActive = option.value === categoryMeta.value;
              return (
                <Link
                  key={option.value}
                  to={`/categories/${option.value}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
                >
                  {option.label}
                  {isActive ? null : <ChevronRight className="w-3 h-3" />}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {items.map((product) => (
              <ProductCard key={product._id} p={product} />
            ))}
          </div>
          {renderPagination()}
        </>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
          Aucun produit disponible dans cette catégorie pour le moment. Revenez plus tard ou explorez d’autres
          sous-catégories.
        </div>
      )}
    </div>
  );
}
