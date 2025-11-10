import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CartContext from '../context/CartContext';
import { buildWhatsappLink } from '../utils/whatsapp';
import api from '../services/api';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';

const TrashIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const WhatsAppIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const ShoppingBagIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clickCounts, setClickCounts] = useState({});
  const externalLinkProps = useDesktopExternalLink();

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
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setPending({});
    }
  };

  const disableAll = loading || pending.all;

  // Calculate savings
  const totalSavings = items.reduce((sum, item) => {
    const discount = item.product.discount || 0;
    const originalPrice = item.product.priceBeforeDiscount || item.product.price;
    const savings = discount > 0 ? (originalPrice - item.product.price) * item.quantity : 0;
    return sum + savings;
  }, 0);

  useEffect(() => {
    const map = {};
    items.forEach(({ product }) => {
      map[product._id] = product.whatsappClicks ?? 0;
    });
    setClickCounts(map);
  }, [items]);

  const handleWhatsappClick = async (product, link) => {
    if (!link) return;
    const productId = product._id;
    try {
      await api.post(`/products/public/${productId}/whatsapp-click`);
      setClickCounts((prev) => ({
        ...prev,
        [productId]: (prev?.[productId] ?? product.whatsappClicks ?? 0) + 1
      }));
    } catch (e) {
      console.error('Failed to record WhatsApp click:', e);
    } finally {
      if (typeof window !== 'undefined') {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return ( 
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Mon Panier</h1>
          <p className="text-gray-600">
            {items.length > 0 
              ? `${items.length} article${items.length > 1 ? 's' : ''} dans votre panier`
              : 'Votre panier est vide'
            }
          </p>
        </div>
        
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={disableAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              Vider le panier
            </button>
          </div>
        )}
      </header>

      {/* Clear Cart Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <TrashIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">Vider le panier</h3>
            <p className="text-gray-600 text-center text-sm">
              Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleClear}
                disabled={pending.all}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {pending.all ? 'Suppression...' : 'Vider le panier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Chargement du panier...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Panier vide</h2>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Votre panier est vide. Découvrez nos produits et ajoutez vos articles préférés.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            <ShoppingBagIcon className="w-5 h-5" />
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
          {/* Cart Items */}
          <div className="space-y-4">
            {items.map(({ product, quantity, lineTotal }) => {
              const sellerPhone = product.user?.phone || product?.contactPhone;
              const whatsappLink = buildWhatsappLink(product, sellerPhone);
              const discount = product.discount || 0;
              const originalPrice = product.priceBeforeDiscount || product.price;
              const clickCount = clickCounts[product._id] ?? product.whatsappClicks ?? 0;
              
              return (
                <div
                  key={product._id}
                  className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Product Image */}
                    <div className="w-full md:w-32 lg:w-40">
                      <div className="relative overflow-hidden rounded-xl aspect-[4/3] bg-gray-100 group-hover:shadow-md transition-shadow">
                        <img
                          src={product.images?.[0] || 'https://via.placeholder.com/300'}
                          alt={product.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                        {discount > 0 && (
                          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            -{discount}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="space-y-2 flex-1">
                  <Link
                    to={`/product/${product._id}`}
                    {...externalLinkProps}
                    className="text-xl font-semibold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-2"
                  >
                            {product.title}
                          </Link>
                          <p className="text-sm text-gray-500">Catégorie : {product.category}</p>
                          
                          {/* Price Display */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-2xl font-bold text-indigo-600">
                              {formatPrice(product.price)} FCFA
                            </span>
                            {discount > 0 && (
                              <>
                                <span className="text-lg text-gray-500 line-through">
                                  {formatPrice(originalPrice)} FCFA
                                </span>
                                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                  Économie : {formatPrice((originalPrice - product.price) * quantity)} FCFA
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex flex-col items-end gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="w-10 h-10 border border-gray-300 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              onClick={() => changeQuantity(product._id, quantity - 1)}
                              disabled={disableAll || pending[product._id] || quantity <= 1}
                            >
                              <span className="text-lg font-medium">−</span>
                            </button>
                            
                            <div className="w-16 text-center">
                              <input
                                type="number"
                                min="1"
                                className="w-full border border-gray-300 rounded-xl text-center h-10 font-semibold text-gray-900"
                                value={quantity}
                                onChange={(e) => changeQuantity(product._id, e.target.value)}
                                disabled={disableAll || pending[product._id]}
                              />
                            </div>
                            
                            <button
                              type="button"
                              className="w-10 h-10 border border-gray-300 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              onClick={() => changeQuantity(product._id, quantity + 1)}
                              disabled={disableAll || pending[product._id]}
                            >
                              <span className="text-lg font-medium">+</span>
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="text-right">
                            <span className="text-sm text-gray-600">Sous-total :</span>
                            <div className="text-xl font-bold text-gray-900">
                              {formatPrice(lineTotal)} FCFA
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
                        {whatsappLink && (
                          <button
                            type="button"
                            onClick={() => handleWhatsappClick(product, whatsappLink)}
                            className="inline-flex items-center gap-3 bg-green-50 text-green-700 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors font-medium text-sm text-left"
                          >
                            <WhatsAppIcon className="w-5 h-5" />
                            <div className="flex flex-col items-start leading-tight text-left">
                              <span className="text-sm font-semibold">Commander directement</span>
                              <span className="text-xs text-green-600 line-clamp-1">
                                {product.title}
                              </span>
                              {sellerPhone && (
                                <span className="text-xs text-green-500">
                                  {sellerPhone}
                                </span>
                              )}
                              <span className="text-[11px] text-green-500">
                                {clickCount} clic{clickCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleRemove(product._id)}
                          disabled={disableAll || pending[product._id]}
                          className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 font-medium text-sm"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Résumé de la commande</h2>
              
              <div className="space-y-4">
                {/* Items Count */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Articles ({totals.quantity})</span>
                  <span className="font-medium text-gray-900">{formatPrice(totals.subtotal)} FCFA</span>
                </div>

                {/* Savings */}
                {totalSavings > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">Économies</span>
                    <span className="font-medium text-green-600">-{formatPrice(totalSavings)} FCFA</span>
                  </div>
                )}

                {/* Shipping Estimate */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Livraison estimée</span>
                  <span className="font-medium text-gray-900">Gratuite</span>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span className="text-2xl text-indigo-600">{formatPrice(totals.subtotal)} FCFA</span>
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-blue-700 text-center">
                    💡 Les paiements sont sécurisés et gérés après validation des annonces. 
                    Contactez directement les vendeurs pour finaliser vos achats.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <Link
                    to="/"
                    className="block w-full bg-indigo-600 text-white text-center py-3.5 rounded-xl hover:bg-indigo-700 transition-colors font-semibold"
                  >
                    Continuer mes achats
                  </Link>
                  
                  <button
                    onClick={() => {
                      // Scroll to top and show contact suggestions
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full border-2 border-indigo-600 text-indigo-600 text-center py-3.5 rounded-xl hover:bg-indigo-50 transition-colors font-semibold"
                  >
                    Contacter les vendeurs
                  </button>
                </div>
              </div>
            </div>

            {/* Security Badges */}
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <h3 className="font-semibold text-gray-900 mb-3">Paiement sécurisé</h3>
              <div className="flex justify-center items-center gap-4 text-gray-400">
                <div className="text-xs">🔒 Paiement sécurisé</div>
                <div className="text-xs">🚚 Livraison garantie</div>
                <div className="text-xs">💬 Support 24/7</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
