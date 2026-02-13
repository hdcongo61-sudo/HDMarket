import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { buildWhatsappLink } from '../utils/whatsapp';
import api from '../services/api';
import { buildProductPath } from '../utils/links';
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
  const navigate = useNavigate();
  const { cart, loading, error, updateItem, removeItem, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const [pending, setPending] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDistanceWarning, setShowDistanceWarning] = useState(false);
  const [clickCounts, setClickCounts] = useState({});
  const externalLinkProps = useDesktopExternalLink();

  const items = cart.items || [];
  const totals = cart.totals || { quantity: 0, subtotal: 0 };
  const buyerCity = useMemo(() => (user?.city || '').trim(), [user?.city]);

  const sellerCityData = useMemo(() => {
    const normalize = (value) => value?.toString().trim().toLowerCase();
    const buyer = normalize(buyerCity);
    const cityMap = new Map();
    const mismatched = new Set();

    items.forEach(({ product }) => {
      const rawCity = (product?.user?.city || product?.city || '').toString().trim();
      if (!rawCity) return;
      const normalized = normalize(rawCity);
      if (!cityMap.has(normalized)) {
        cityMap.set(normalized, rawCity);
      }
      if (buyer && normalized !== buyer) {
        mismatched.add(normalized);
      }
    });

    return {
      buyer,
      buyerDisplay: buyerCity?.toString().trim() || '',
      uniqueCities: Array.from(cityMap.values()),
      mismatchedCities: Array.from(mismatched).map((key) => cityMap.get(key) || key)
    };
  }, [items, buyerCity]);

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

  const handleCheckoutClick = () => {
    if (sellerCityData.buyer && sellerCityData.mismatchedCities.length > 0) {
      setShowDistanceWarning(true);
      return;
    }
    navigate('/orders/checkout');
  };

  const handleProceedCheckout = () => {
    setShowDistanceWarning(false);
    navigate('/orders/checkout');
  };

  const handleCancelCheckout = async () => {
    setPending({ all: true });
    try {
      await clearCart();
    } catch (e) {
      console.error(e);
    } finally {
      setPending({});
      setShowDistanceWarning(false);
      navigate('/products');
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
    <main className="min-h-screen bg-[#F2F2F7] dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Enhanced */}
      <header className="apple-card rounded-[16px] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900">Mon Panier</h1>
            <p className="text-gray-600 font-medium">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#FF3B30] bg-white border border-[#FF3B30]/30 rounded-full hover:bg-[#FF3B30]/8 tap-feedback transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-60"
              >
                <TrashIcon className="w-4 h-4" />
                Vider le panier
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Clear Cart Confirmation Modal Enhanced */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border-2 border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto">
              <TrashIcon className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900">Vider le panier</h3>
              <p className="text-gray-600 text-sm font-medium">
                Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ? Cette action est irréversible.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-5 py-3 text-sm font-semibold text-[#8E8E93] bg-[rgba(120,120,128,0.12)] rounded-full hover:bg-[rgba(120,120,128,0.18)] tap-feedback transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleClear}
                disabled={pending.all}
                className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-red-600 rounded-3xl hover:bg-red-700 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
              >
                {pending.all ? 'Suppression...' : 'Vider le panier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distance Warning Modal */}
      {showDistanceWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl border-2 border-amber-200">
            <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900">Attention à la distance</h3>
              <p className="text-sm text-gray-700 font-medium">
                Certains vendeurs sont dans une autre ville que la vôtre. Votre commande peut subir
                des retards liés à la distance ou à la logistique. Les articles peuvent aussi être
                endommagés pendant le transport et le vendeur ne pourra pas en être tenu responsable.
              </p>
              {sellerCityData.mismatchedCities.length > 0 && (
                <p className="text-xs text-gray-600">
                  Vendeurs :{' '}
                  <span className="font-semibold text-gray-900">
                    {sellerCityData.mismatchedCities.join(', ')}
                  </span>
                </p>
              )}
              {sellerCityData.buyerDisplay && (
                <p className="text-xs text-gray-600">
                  Votre ville :{' '}
                  <span className="font-semibold text-gray-900">{sellerCityData.buyerDisplay}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelCheckout}
                disabled={pending.all}
                className="flex-1 px-5 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-all disabled:opacity-60"
              >
                {pending.all ? 'Annulation…' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleProceedCheckout}
                disabled={pending.all}
                className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-amber-600 rounded-3xl hover:bg-amber-700 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
              >
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-4 sm:p-6 shadow-sm">
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Chargement du panier...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 sm:py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ShoppingBagIcon className="w-16 h-16 text-gray-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Panier vide</h2>
          <p className="text-gray-600 mb-8 max-w-sm mx-auto font-medium">
            Votre panier est vide. Découvrez nos produits et ajoutez vos articles préférés.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 min-h-[48px] rounded-3xl hover:bg-blue-700 transition-all duration-200 tap-feedback font-semibold shadow-sm"
          >
            <ShoppingBagIcon className="w-5 h-5" />
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 sm:gap-8">
          {/* Cart Items Enhanced */}
          <div className="space-y-4 sm:space-y-5">
            {items.map(({ product, quantity, lineTotal }) => {
              const sellerPhone = product.user?.phone || product?.contactPhone;
              const whatsappLink = buildWhatsappLink(product, sellerPhone);
              const discount = product.discount || 0;
              const originalPrice = product.priceBeforeDiscount || product.price;
              const clickCount = clickCounts[product._id] ?? product.whatsappClicks ?? 0;
              
              return (
                <div
                  key={product._id}
                  className="group bg-white rounded-xl sm:rounded-3xl border-2 border-gray-200 p-2 sm:p-5 lg:p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-200"
                >
                  <div className="flex flex-col md:flex-row gap-2 sm:gap-5 lg:gap-6">
                    {/* Product Image Enhanced - Much Smaller on Mobile */}
                    <div className="w-20 sm:w-full md:w-36 lg:w-44 flex-shrink-0">
                      <Link
                        to={buildProductPath(product)}
                        {...externalLinkProps}
                        className="block relative overflow-hidden rounded-lg sm:rounded-2xl aspect-square bg-gradient-to-br from-gray-100 to-gray-200 group-hover:shadow-lg transition-all duration-300"
                      >
                        <img
                          src={product.images?.[0] || 'https://via.placeholder.com/300'}
                          alt={product.title}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        {discount > 0 && (
                          <div className="absolute top-1 left-1 sm:top-3 sm:left-3 bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white text-[9px] sm:text-xs font-black px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-full shadow-lg ring-1 sm:ring-2 ring-white">
                            -{discount}%
                          </div>
                        )}
                      </Link>
                    </div>

                    {/* Product Details Enhanced - Much Smaller on Mobile */}
                    <div className="flex-1 space-y-1.5 sm:space-y-4 min-w-0">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 sm:gap-4">
                        <div className="space-y-1.5 sm:space-y-3 flex-1 min-w-0">
                  <Link
                    to={buildProductPath(product)}
                    {...externalLinkProps}
                    className="text-sm sm:text-xl lg:text-2xl font-black text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                  >
                            {product.title}
                          </Link>
                          <p className="text-[10px] sm:text-sm text-gray-600 font-medium">Catégorie : <span className="text-gray-900">{product.category}</span></p>
                          
                          {/* Price Display Enhanced - Much Smaller on Mobile */}
                          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                            <span className="text-sm sm:text-2xl lg:text-3xl font-black text-blue-600">
                              {formatPrice(product.price)} FCFA
                            </span>
                            {discount > 0 && (
                              <>
                                <span className="text-xs sm:text-lg text-gray-400 line-through font-bold">
                                  {formatPrice(originalPrice)} FCFA
                                </span>
                                <span className="text-[9px] sm:text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-full font-black shadow-sm">
                                  Éco: {formatPrice((originalPrice - product.price) * quantity)} FCFA
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls Enhanced - Apple Style - Much Smaller on Mobile */}
                        <div className="flex flex-col items-end gap-1.5 sm:gap-4">
                          <div className="flex items-center gap-1 sm:gap-2 bg-gray-50 rounded-xl sm:rounded-3xl p-0.5 sm:p-1 border border-gray-200">
                            <button
                              type="button"
                              className="min-w-[44px] min-h-[44px] w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-40 transition-all duration-200 tap-feedback shadow-sm"
                              onClick={() => changeQuantity(product._id, quantity - 1)}
                              disabled={disableAll || pending[product._id] || quantity <= 1}
                            >
                              <span className="text-base sm:text-xl font-semibold">−</span>
                            </button>
                            
                            <div className="w-10 sm:w-14 text-center">
                              <input
                                type="number"
                                min="1"
                                className="w-full bg-transparent border-0 text-center h-7 sm:h-10 font-black text-gray-900 text-xs sm:text-base focus:outline-none"
                                value={quantity}
                                onChange={(e) => changeQuantity(product._id, e.target.value)}
                                disabled={disableAll || pending[product._id]}
                              />
                            </div>
                            
                            <button
                              type="button"
                              className="min-w-[44px] min-h-[44px] w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-40 transition-all duration-200 tap-feedback shadow-sm"
                              onClick={() => changeQuantity(product._id, quantity + 1)}
                              disabled={disableAll || pending[product._id]}
                            >
                              <span className="text-base sm:text-xl font-semibold">+</span>
                            </button>
                          </div>

                          {/* Line Total Enhanced - Much Smaller on Mobile */}
                          <div className="text-right bg-blue-50 px-2 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-2xl border border-blue-100">
                            <span className="text-[9px] sm:text-xs text-gray-600 font-medium block mb-0.5 sm:mb-1">Sous-total</span>
                            <div className="text-sm sm:text-xl lg:text-2xl font-black text-blue-600">
                              {formatPrice(lineTotal)} FCFA
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions Enhanced - Compact Design for Mobile */}
                      <div className="flex items-center gap-2 sm:gap-3 pt-2 sm:pt-4 border-t-2 border-gray-100 w-full">
                        {whatsappLink && (
                          <button
                            type="button"
                            onClick={() => handleWhatsappClick(product, whatsappLink)}
                            className="flex-1 min-w-0 inline-flex items-center gap-1.5 sm:gap-2 bg-green-50 border border-green-200 text-green-700 px-2.5 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-3xl hover:bg-green-100 transition-all duration-200 active:scale-95 font-semibold text-xs sm:text-sm shadow-sm overflow-hidden"
                          >
                            <WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            <div className="flex flex-col items-start leading-tight text-left min-w-0 flex-1 overflow-hidden">
                              <span className="text-xs sm:text-sm font-bold truncate w-full">Commander</span>
                              {sellerPhone && (
                                <span className="text-[10px] sm:text-xs text-green-600 font-medium truncate w-full">
                                  {sellerPhone}
                                </span>
                              )}
                              <span className="text-[10px] text-green-500 whitespace-nowrap">
                                {clickCount} clic{clickCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleRemove(product._id)}
                          disabled={disableAll || pending[product._id]}
                          className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 text-red-600 bg-white border border-red-300 px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-3xl hover:bg-red-50 transition-all duration-200 active:scale-95 disabled:opacity-60 font-semibold text-xs sm:text-sm shadow-sm"
                        >
                          <TrashIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="hidden sm:inline">Supprimer</span>
                          <span className="sm:hidden">Suppr.</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary Enhanced */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 sm:p-8 sticky top-6 shadow-xl">
              <h2 className="text-2xl font-black text-gray-900 mb-6">Résumé de la commande</h2>
              
              <div className="space-y-4">
                {/* Items Count Enhanced */}
                <div className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-2xl">
                  <span className="text-gray-700 font-semibold">Articles ({totals.quantity})</span>
                  <span className="font-black text-gray-900 text-lg">{formatPrice(totals.subtotal)} FCFA</span>
                </div>

                {/* Savings Enhanced */}
                {totalSavings > 0 && (
                  <div className="flex justify-between items-center py-3 px-4 bg-green-50 rounded-2xl border border-green-200">
                    <span className="text-green-700 font-semibold">Économies</span>
                    <span className="font-black text-green-600 text-lg">-{formatPrice(totalSavings)} FCFA</span>
                  </div>
                )}

                {/* Shipping Estimate Enhanced */}
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-2xl border border-blue-200">
                  <span className="text-gray-700 font-semibold">Livraison estimée</span>
                  <span className="font-black text-blue-600">Gratuite</span>
                </div>

                {/* Divider Enhanced */}
                <div className="border-t-2 border-gray-200 pt-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-gray-900">Total</span>
                    <span className="text-3xl font-black text-blue-600">{formatPrice(totals.subtotal)} FCFA</span>
                  </div>
                </div>

                {/* Info Note Enhanced */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4">
                  <p className="text-xs text-blue-800 text-center font-medium leading-relaxed">
                    💡 Les paiements sont sécurisés et gérés après validation des annonces. 
                    Contactez directement les vendeurs pour finaliser vos achats.
                  </p>
                </div>

                {/* Action Buttons Enhanced */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCheckoutClick}
                    className="apple-btn-primary block w-full text-center py-4 min-h-[52px]"
                  >
                    Continuer mes achats
                  </button>
                </div>
              </div>
            </div>

            {/* Security Badges Enhanced */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-6 text-center border-2 border-gray-200">
              <h3 className="font-black text-gray-900 mb-4">Paiement sécurisé</h3>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-gray-600">
                <div className="text-xs font-semibold">🔒 Paiement sécurisé</div>
                <div className="text-xs font-semibold">🚚 Livraison garantie</div>
                <div className="text-xs font-semibold">💬 Support 24/7</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
