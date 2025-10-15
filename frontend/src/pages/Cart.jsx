import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import CartContext from '../context/CartContext';

const TrashIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const formatPrice = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export default function Cart() {
  const { cart, loading, error, updateItem, removeItem, clearCart } = useContext(CartContext);
  const [pending, setPending] = useState({});

  const items = cart.items || [];
  const totals = cart.totals || { quantity: 0, subtotal: 0 };

  const changeQuantity = async (productId, quantity) => {
    const value = Math.max(0, Number.isNaN(Number(quantity)) ? 0 : Number(quantity));
    setPending((prev) => ({ ...prev, [productId]: true }));
    try {
      await updateItem(productId, value);
    } catch (e) {
      console.error(e);
    } finally {
      setPending((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleRemove = async (productId) => {
    setPending((prev) => ({ ...prev, [productId]: true }));
    try {
      await removeItem(productId);
    } catch (e) {
      console.error(e);
    } finally {
      setPending((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleClear = async () => {
    setPending({ all: true });
    try {
      await clearCart();
    } catch (e) {
      console.error(e);
    } finally {
      setPending({});
    }
  };

  const disableAll = loading || pending.all;

  return ( 
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Panier</h1>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            disabled={disableAll}
            className="text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            Vider le panier
          </button>
        )}
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && items.length === 0 ? (
        <p className="text-sm text-gray-500">Chargement du panier…</p>
      ) : items.length === 0 ? (
        <div className="border rounded p-6 text-center space-y-3">
          <p className="text-gray-600">Votre panier est vide.</p>
          <Link to="/" className="text-indigo-600 hover:underline">Continuer vos achats</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <ul className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => (
              <li key={product._id} className="border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="w-full md:w-32">
                  <div className="relative overflow-hidden rounded aspect-[4/3] bg-gray-100">
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/300'}
                      alt={product.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Link to={`/product/${product._id}`} className="text-lg font-semibold text-gray-900 hover:underline">
                    {product.title}
                  </Link>
                  <p className="text-sm text-gray-500">Catégorie : {product.category}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-indigo-600">{formatPrice(product.price)} FCFA</span>
                    {product.discount ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">-{product.discount}%</span>
                    ) : null}
                    {product.priceBeforeDiscount ? (
                      <span className="text-xs text-gray-500 line-through">
                        {formatPrice(product.priceBeforeDiscount)} FCFA
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 border rounded text-sm"
                      onClick={() => changeQuantity(product._id, quantity - 1)}
                      disabled={disableAll || pending[product._id]}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      className="w-16 border rounded text-center h-8"
                      value={quantity}
                      onChange={(e) => changeQuantity(product._id, e.target.value)}
                      disabled={disableAll || pending[product._id]}
                    />
                    <button
                      type="button"
                      className="h-8 w-8 border rounded text-sm"
                      onClick={() => changeQuantity(product._id, quantity + 1)}
                      disabled={disableAll || pending[product._id]}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm text-gray-600">Sous-total</span>
                  <span className="text-lg font-semibold text-gray-900">{formatPrice(lineTotal)} FCFA</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(product._id)}
                    disabled={disableAll || pending[product._id]}
                    className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="border rounded-lg p-4 space-y-4 bg-slate-50">
            <h2 className="text-lg font-semibold text-gray-900">Résumé</h2>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Articles</span>
              <span>{totals.quantity}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatPrice(totals.subtotal)} FCFA</span>
            </div>
            <p className="text-xs text-gray-500">
              Les paiements sont gérés après validation des annonces. Ce panier ne déclenche pas encore de commande.
            </p>
            <Link
              to="/"
              className="block text-center bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Continuer vos achats
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
