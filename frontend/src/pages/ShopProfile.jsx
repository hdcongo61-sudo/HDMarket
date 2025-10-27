import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import AuthContext from '../context/AuthContext';

export default function ShopProfile() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchShop = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/shops/${id}`);
        if (!active) return;
        setShop(data.shop);
        setProducts(Array.isArray(data.products) ? data.products : []);
        setError('');
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Boutique introuvable.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchShop();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">Chargement de la boutique…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-3">
        <p className="text-red-600 font-semibold">{error}</p>
        <Link to="/" className="text-indigo-600 underline">
          Retourner à l&apos;accueil
        </Link>
      </main>
    );
  }

  if (!shop) return null;

  const phoneContent = shop.phone
    ? user
      ? shop.phone
      : (
        <Link to="/login" className="text-indigo-600 underline" state={{ from: `/shop/${id}` }}>
          Connectez-vous pour voir ce numéro
        </Link>
      )
    : 'Non renseigné';

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-8 space-y-8">
      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
        {shop.shopLogo && (
          <img
            src={shop.shopLogo}
            alt={`Logo ${shop.shopName}`}
            className="h-24 w-24 rounded-full object-cover border"
          />
        )}
        <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Boutique</p>
        <h1 className="text-3xl font-bold text-gray-900">{shop.shopName}</h1>
        <p className="text-gray-600">Gérée par {shop.ownerName}</p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>{shop.productCount} produit{shop.productCount > 1 ? 's' : ''}</span>
          <span>
            Créée le {new Date(shop.createdAt).toLocaleDateString()}
          </span>
          <span>
            Téléphone : {phoneContent}
          </span>
          <span>
            Adresse : {shop.shopAddress || 'Non renseignée'}
          </span>
        </div>
      </section>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <ProductCard key={product._id} p={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-700">Aucun produit publié pour le moment.</p>
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 font-medium text-white mt-6 hover:bg-indigo-700 transition">
            Voir les autres produits
          </Link>
        </div>
      )}
    </main>
  );
}
