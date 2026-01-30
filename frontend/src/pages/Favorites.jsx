import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import FavoriteContext from '../context/FavoriteContext';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 12;

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, loading } = useContext(FavoriteContext);
  const [page, setPage] = useState(1);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );
  const hasFavorites = favorites.length > 0;
  const totalPages = Math.max(1, Math.ceil(favorites.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [favorites.length]);

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
    return favorites.slice(0, end);
  }, [favorites, page]);

  const renderPagination = () => {
    if (isMobileView) return null;
    if (favorites.length <= PAGE_SIZE) return null;

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
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => setPage(1)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
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
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
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
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {paginatedFavorites.map((product) => (
              <ProductCard key={product._id} p={product} />
            ))}
          </div>
          {renderPagination()}
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
