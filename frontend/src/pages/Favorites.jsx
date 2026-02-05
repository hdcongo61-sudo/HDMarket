import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Tag, DollarSign } from 'lucide-react';
import FavoriteContext from '../context/FavoriteContext';
import ProductCard from '../components/ProductCard';
import { getCategoryMeta } from '../data/categories';

const PAGE_SIZE = 12;

const PRICE_RANGES = [
  { value: 'all', label: 'Tous les prix', min: null, max: null },
  { value: '0-10000', label: '0 - 10 000 FCFA', min: 0, max: 10000 },
  { value: '10000-50000', label: '10 000 - 50 000 FCFA', min: 10000, max: 50000 },
  { value: '50000-100000', label: '50 000 - 100 000 FCFA', min: 50000, max: 100000 },
  { value: '100000-500000', label: '100 000 - 500 000 FCFA', min: 100000, max: 500000 },
  { value: '500000+', label: '500 000+ FCFA', min: 500000, max: null }
];

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, loading } = useContext(FavoriteContext);
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPrice, setFilterPrice] = useState('all');
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );

  const categoriesInFavorites = useMemo(() => {
    const seen = new Set();
    const list = [];
    favorites.forEach((p) => {
      const cat = p?.category;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        const meta = getCategoryMeta(cat);
        list.push({ value: cat, label: meta?.label || cat });
      }
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [favorites]);

  const priceRange = useMemo(
    () => PRICE_RANGES.find((r) => r.value === filterPrice) || PRICE_RANGES[0],
    [filterPrice]
  );

  const filteredFavorites = useMemo(() => {
    return favorites.filter((p) => {
      if (filterCategory && (p?.category || '') !== filterCategory) return false;
      const price = Number(p?.price ?? 0);
      if (priceRange.min != null && price < priceRange.min) return false;
      if (priceRange.max != null && price > priceRange.max) return false;
      return true;
    });
  }, [favorites, filterCategory, priceRange]);

  const hasFavorites = favorites.length > 0;
  const totalPages = Math.max(1, Math.ceil(filteredFavorites.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [favorites.length, filterCategory, filterPrice]);

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
                page === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
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
              page === pageNum ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
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
                page === totalPages ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 space-y-4 sm:space-y-8 pb-12 md:pb-16">
      <header className="text-center sm:text-left">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-4 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">
          Vos favoris
        </p>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mt-1">Articles enregistrés</h1>
        <p className="text-xs sm:text-base text-gray-600 mt-2">
          Retrouvez rapidement les produits que vous avez ajoutés à votre liste de souhaits.
        </p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-gray-600">Chargement de vos favoris…</p>
        </div>
      ) : hasFavorites ? (
        <>
          {/* Filters — Category & Price */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Filter className="w-4 h-4 text-indigo-500" />
              Filtres
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[160px]"
                  aria-label="Filtrer par catégorie"
                >
                  <option value="">Toutes les catégories</option>
                  {categoriesInFavorites.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden />
                <select
                  value={filterPrice}
                  onChange={(e) => setFilterPrice(e.target.value)}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[180px]"
                  aria-label="Filtrer par prix"
                >
                  {PRICE_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
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
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <p className="w-full sm:w-auto text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
              {filteredFavorites.length} article{filteredFavorites.length !== 1 ? 's' : ''}
              {(filterCategory || filterPrice !== 'all') && ` sur ${favorites.length}`}
            </p>
          </div>

          {filteredFavorites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-6 py-10 text-center">
              <p className="text-gray-700 dark:text-gray-300 font-medium">Aucun favori ne correspond aux filtres.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Modifiez les filtres ou réinitialisez.</p>
              <button
                type="button"
                onClick={() => { setFilterCategory(''); setFilterPrice('all'); setPage(1); }}
                className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
                {paginatedFavorites.map((product) => (
                  <ProductCard key={product._id} p={product} />
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-700">Aucun favori pour le moment</p>
          <p className="text-gray-500 mt-2">
            Explorez le catalogue et cliquez sur le coeur d&apos;un produit pour le retrouver ici.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 font-medium text-white mt-6 hover:bg-indigo-700 transition"
          >
            Découvrir les produits
          </Link>
        </div>
      )}
    </div>
  );
}
