import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Tag, DollarSign, HeartOff, X } from 'lucide-react';
import FavoriteContext from '../context/FavoriteContext';
import ProductCard from '../components/ProductCard';
import useCategories from '../hooks/useCategories';

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
  const { favorites, loading, removeFavorite } = useContext(FavoriteContext);
  const { getCategoryMeta } = useCategories();
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPrice, setFilterPrice] = useState('all');
  const [unfavingId, setUnfavingId] = useState('');
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );

  const handleUnfavorite = async (productId) => {
    setUnfavingId(productId);
    try {
      await removeFavorite(productId);
    } catch (err) {
      console.warn('[Favorites] Unfavorite failed:', err?.message || err);
      // silently handled by context
    } finally {
      setUnfavingId('');
    }
  };

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
                page === 1 ? 'bg-neutral-600 text-white border-neutral-600' : 'border-gray-300 hover:bg-gray-50'
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
              page === pageNum ? 'bg-neutral-600 text-white border-neutral-600' : 'border-gray-300 hover:bg-gray-50'
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
                page === totalPages ? 'bg-neutral-600 text-white border-neutral-600' : 'border-gray-300 hover:bg-gray-50'
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
    <div className="hd-products-flow min-h-screen">
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 pb-24 sm:space-y-7 sm:px-6 sm:py-8 lg:px-8 md:pb-16">
      <header className="hd-products-hero rounded-[28px] p-5 text-white shadow-[0_18px_46px_rgba(255,106,0,0.14)] sm:p-7">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/14 px-3 py-2 text-sm font-black text-white/90 transition hover:bg-white/22 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <p className="text-xs uppercase tracking-wide text-white/76 font-black">
          Vos favoris
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">Articles enregistrés</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86 sm:text-base">
          Retrouvez rapidement les produits que vous avez ajoutés à votre liste de souhaits.
        </p>
      </header>

      {loading ? (
        <div className="rounded-[28px] border border-orange-100 bg-white/88 px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-[#FF6A00] border-t-transparent" />
          <p className="font-semibold text-stone-600">Chargement de vos favoris…</p>
        </div>
      ) : hasFavorites ? (
        <>
          {/* Filters — Category & Price */}
          <div className="hd-products-toolbar sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-[24px] p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 text-sm font-black text-stone-800">
              <Filter className="w-4 h-4 text-[#FF6A00]" />
              Filtres
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#FF6A00]" aria-hidden />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="min-h-[42px] min-w-[160px] rounded-full border border-orange-100 bg-white py-2 pl-3 pr-8 text-sm font-bold text-stone-900 focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
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
                <DollarSign className="w-4 h-4 text-[#FF6A00]" aria-hidden />
                <select
                  value={filterPrice}
                  onChange={(e) => setFilterPrice(e.target.value)}
                  className="min-h-[42px] min-w-[180px] rounded-full border border-orange-100 bg-white py-2 pl-3 pr-8 text-sm font-bold text-stone-900 focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
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
                  className="hd-products-chip-active rounded-full px-3 py-2 text-sm font-black"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <p className="w-full text-xs font-bold text-stone-500 sm:mt-0 sm:w-auto">
              {filteredFavorites.length} article{filteredFavorites.length !== 1 ? 's' : ''}
              {(filterCategory || filterPrice !== 'all') && ` sur ${favorites.length}`}
            </p>
          </div>

          {filteredFavorites.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-orange-200 bg-white px-6 py-10 text-center shadow-sm">
              <p className="font-black text-stone-900">Aucun favori ne correspond aux filtres.</p>
              <p className="mt-1 text-sm text-stone-500">Modifiez les filtres ou réinitialisez.</p>
              <button
                type="button"
                onClick={() => { setFilterCategory(''); setFilterPrice('all'); setPage(1); }}
                className="hd-primary-button mt-4 rounded-full px-5 py-2.5 text-sm font-black"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {paginatedFavorites.map((product) => (
                  <div key={product._id} className="group/fav relative">
                    <ProductCard p={product} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnfavorite(product._id);
                      }}
                      disabled={unfavingId === product._id}
                      className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-md ring-1 ring-red-200 transition-all duration-200 hover:bg-red-500 hover:text-white hover:ring-red-500 active:scale-90 sm:h-8 sm:w-8"
                      aria-label="Retirer des favoris"
                      title="Retirer des favoris"
                    >
                      {unfavingId === product._id ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <HeartOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      ) : (
        <div className="rounded-[28px] border border-orange-100 bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(117,75,36,0.08)]">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] bg-orange-50 text-[#FF6A00] ring-1 ring-orange-100">
            <Tag className="h-9 w-9" />
          </div>
          <p className="text-lg font-black text-stone-950">Aucun favori pour le moment</p>
          <p className="mt-2 text-stone-500">
            Explorez le catalogue et cliquez sur le coeur d&apos;un produit pour le retrouver ici.
          </p>
          <Link
            to="/products"
            className="hd-primary-button mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 font-black"
          >
            Découvrir les produits
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
