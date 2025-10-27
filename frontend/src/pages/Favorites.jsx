import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import FavoriteContext from '../context/FavoriteContext';
import ProductCard from '../components/ProductCard';

export default function Favorites() {
  const { favorites, loading } = useContext(FavoriteContext);
  const hasFavorites = favorites.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 space-y-8">
      <header className="text-center sm:text-left">
        <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">
          Vos favoris
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Articles enregistrés</h1>
        <p className="text-gray-600 mt-2">
          Retrouvez rapidement les produits que vous avez ajoutés à votre liste de souhaits.
        </p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-gray-600">Chargement de vos favoris…</p>
        </div>
      ) : hasFavorites ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((product) => (
            <ProductCard key={product._id} p={product} />
          ))}
        </div>
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
