import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { buildWhatsappLink } from '../utils/whatsapp';
import api from '../services/api';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';

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

const formatPrice = (value) => formatPriceWithStoredSettings(value);

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
  const getCartItemKey = (item) =>
    String(item?.cartItemId || item?.selectionKey || item?.product?._id || '');

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

  const changeQuantity = async (item, quantity) => {
    const productId = item?.product?._id;
    const cartItemKey = getCartItemKey(item);
    const parsedQuantity = Number.parseInt(String(quantity), 10);
    if (!productId || !cartItemKey || !Number.isFinite(parsedQuantity)) return;
    const value = Math.max(1, parsedQuantity);
    if (value === Number(item?.quantity || 0)) return;
    setPending((prev) => ({ ...prev, [cartItemKey]: true }));
    try {
      await updateItem(productId, value, item?.selectedAttributes || [], item?.selectionKey || '');
    } catch (e) {
      console.error(e);
    } finally {
      setPending((prev) => ({ ...prev, [cartItemKey]: false }));
    }
  };

  const handleRemove = async (item) => {
    const productId = item?.product?._id;
    const cartItemKey = getCartItemKey(item);
    setPending((prev) => ({ ...prev, [cartItemKey]: true }));
    try {
      await removeItem(productId, item?.selectedAttributes || [], item?.selectionKey || '');
    } catch (e) {
      console.error(e);
    } finally {
      setPending((prev) => ({ ...prev, [cartItemKey]: false }));
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

  const disableAll = Boolean(pending.all);

  // Calculate savings
  const totalSavings = items.reduce((sum, item) => {
    const discount = item.product.discount || 0;
    const originalPrice = item.product.priceBeforeDiscount || item.product.price;
    const savings = discount > 0 ? (originalPrice - item.product.price) * item.quantity : 0;
    return sum + savings;
  }, 0);

  useEffect(() => {
    const map = {};
    items.forEach((item) => {
      const product = item?.product;
      if (!product?._id) return;
      map[getCartItemKey(item)] = product.whatsappClicks ?? 0;
    });
    setClickCounts(map);
  }, [items]);

  const handleWhatsappClick = async (item, link) => {
    const product = item?.product;
    if (!link) return;
    const productId = product._id;
    const cartItemKey = getCartItemKey(item);
    try {
      await api.post(`/products/public/${productId}/whatsapp-click`);
      setClickCounts((prev) => ({
        ...prev,
        [cartItemKey]: (prev?.[cartItemKey] ?? product.whatsappClicks ?? 0) + 1
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
    <main className="hd-products-flow min-h-screen">
      <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 lg:px-8 space-y-5 sm:space-y-7">
      <header className="hd-products-hero rounded-[28px] p-5 text-white shadow-[0_18px_46px_rgba(255,106,0,0.14)] sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-white/76">Commande</p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">Mon panier</h1>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-white/86">
              {items.length > 0 
                ? `${items.length} article${items.length > 1 ? 's' : ''} dans votre panier`
                : 'Votre panier est vide, explorez les sélections HDMarket.'
              }
            </p>
          </div>
          
          {items.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={disableAll}
                className="inline-flex items-center gap-2 rounded-full border border-white/28 bg-white/16 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all hover:bg-white/24 disabled:opacity-60"
              >
                <TrashIcon className="w-4 h-4" />
                Vider le panier
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Clear Cart Confirmation Modal Enhanced */}
      <BaseModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="md"
        mobileSheet
        ariaLabel="Vider le panier"
      >
        <ModalHeader
          title="Vider le panier"
          subtitle="Action irréversible"
          onClose={() => setShowClearConfirm(false)}
        />
        <ModalBody className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100">
            <TrashIcon className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ? Cette action est irréversible.
          </p>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 rounded-xl bg-[rgba(120,120,128,0.12)] px-5 py-3 text-sm font-semibold text-[#8E8E93] transition-all hover:bg-[rgba(120,120,128,0.18)]"
            >
              Annuler
            </button>
            <button
              onClick={handleClear}
              disabled={pending.all}
              className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 active:scale-95 disabled:opacity-60"
            >
              {pending.all ? 'Suppression...' : 'Vider le panier'}
            </button>
          </div>
        </ModalFooter>
      </BaseModal>

      {/* Distance Warning Modal */}
      <BaseModal
        isOpen={showDistanceWarning}
        onClose={handleCancelCheckout}
        size="lg"
        mobileSheet
        ariaLabel="Attention à la distance"
      >
        <ModalHeader
          title="Attention à la distance"
          subtitle="Vérifiez les villes des vendeurs avant de confirmer"
          onClose={handleCancelCheckout}
        />
        <ModalBody className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Certains vendeurs sont dans une autre ville que la vôtre. Votre commande peut subir
            des retards liés à la distance ou à la logistique. Les articles peuvent aussi être
            endommagés pendant le transport et le vendeur ne pourra pas en être tenu responsable.
          </p>
          {sellerCityData.mismatchedCities.length > 0 ? (
            <p className="text-xs text-gray-600">
              Vendeurs : <span className="font-semibold text-gray-900">{sellerCityData.mismatchedCities.join(', ')}</span>
            </p>
          ) : null}
          {sellerCityData.buyerDisplay ? (
            <p className="text-xs text-gray-600">
              Votre ville : <span className="font-semibold text-gray-900">{sellerCityData.buyerDisplay}</span>
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCancelCheckout}
              disabled={pending.all}
              className="flex-1 rounded-xl bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200 disabled:opacity-60"
            >
              {pending.all ? 'Annulation…' : 'Annuler'}
            </button>
            <button
              type="button"
              onClick={handleProceedCheckout}
              disabled={pending.all}
              className="flex-1 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-amber-700 active:scale-95 disabled:opacity-60"
            >
              Continuer quand même
            </button>
          </div>
        </ModalFooter>
      </BaseModal>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 shadow-sm sm:p-5">
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center rounded-[28px] border border-orange-100 bg-white/86 py-16 shadow-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Chargement du panier...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-orange-100 bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(117,75,36,0.08)] sm:py-16">
          <div className="w-24 h-24 bg-orange-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 ring-1 ring-orange-100">
            <ShoppingBagIcon className="w-12 h-12 text-[#FF6A00]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-950 mb-3">Panier vide</h2>
          <p className="text-stone-600 mb-8 max-w-sm mx-auto font-medium">
            Votre panier est vide. Découvrez nos produits et ajoutez vos articles préférés.
          </p>
          <Link
            to="/products"
            className="hd-primary-button inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3.5 font-black"
          >
            <ShoppingBagIcon className="w-5 h-5" />
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px] xl:gap-7">
          {/* Cart Items Enhanced */}
          <div className="space-y-3 sm:space-y-4">
            {items.map((item) => {
              const { product, quantity, lineTotal } = item;
              const sellerPhone = product.user?.phone || product?.contactPhone;
              const whatsappLink = buildWhatsappLink(product, sellerPhone);
              const discount = product.discount || 0;
              const originalPrice = product.priceBeforeDiscount || product.price;
              const cartItemKey = getCartItemKey(item);
              const clickCount = clickCounts[cartItemKey] ?? product.whatsappClicks ?? 0;
              
              return (
                <div
                  key={cartItemKey}
                  className="group rounded-[24px] border border-orange-100 bg-white p-3 shadow-[0_12px_32px_rgba(117,75,36,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(117,75,36,0.11)] sm:p-5"
                >
                  <div className="flex gap-3 sm:gap-5">
                    {/* Product Image Enhanced - Much Smaller on Mobile */}
                    <div className="w-24 shrink-0 sm:w-36 lg:w-40">
                      <Link
                        to={buildProductPath(product)}
                        {...externalLinkProps}
                        className="block relative overflow-hidden rounded-[18px] aspect-square bg-orange-50 transition-all duration-300"
                      >
                        <img
                          src={product.images?.[0] || 'https://via.placeholder.com/300'}
                          alt={product.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        {discount > 0 && (
                          <div className="absolute left-2 top-2 rounded-full bg-[#FF4D1C] px-2 py-1 text-[10px] font-black text-white shadow-sm">
                            -{discount}%
                          </div>
                        )}
                      </Link>
                    </div>

                    {/* Product Details Enhanced - Much Smaller on Mobile */}
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1.5 sm:space-y-3 flex-1 min-w-0">
                  <Link
                    to={buildProductPath(product)}
                    {...externalLinkProps}
                    className="line-clamp-2 text-sm font-black text-stone-950 transition-colors hover:text-[#FF6A00] sm:text-lg"
                  >
                            {product.title}
                          </Link>
                          <p className="text-[11px] sm:text-sm text-stone-500 font-semibold">Catégorie : <span className="text-stone-800">{product.category}</span></p>
                          <SelectedAttributesList
                            selectedAttributes={item.selectedAttributes}
                            compact
                            className="pt-1"
                          />
                          
                          {/* Price Display Enhanced - Much Smaller on Mobile */}
                          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                            <span className="text-lg font-black text-[#FF6A00] sm:text-2xl">
                              {formatPrice(product.price)}
                            </span>
                            {discount > 0 && (
                              <>
                                <span className="text-xs sm:text-lg text-gray-400 line-through font-bold">
                                  {formatPrice(originalPrice)}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100 sm:text-xs">
                                  Éco: {formatPrice((originalPrice - product.price) * quantity)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2 lg:flex-col lg:items-end">
                          <div className="rounded-[20px] border border-orange-100 bg-[#fff7ed] p-1.5 shadow-[0_8px_20px_rgba(255,106,0,0.08)]">
                            <div className="mb-1 flex items-center justify-center gap-1 px-2 text-[10px] font-black uppercase tracking-wide text-[#9A4A00]">
                              Qté
                              {pending[cartItemKey] ? (
                                <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF6A00]" />
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="flex h-10 min-h-[40px] w-10 min-w-[40px] items-center justify-center rounded-full bg-white text-stone-800 shadow-sm ring-1 ring-orange-100 transition hover:text-[#FF6A00] active:scale-95 disabled:opacity-40"
                              onClick={() => changeQuantity(item, quantity - 1)}
                              disabled={disableAll || quantity <= 1}
                              aria-label="Diminuer la quantité"
                            >
                              <span className="text-lg font-black">−</span>
                            </button>
                            
                            <div className="relative w-12 sm:w-16">
                              <input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                aria-label="Quantité"
                                className="h-10 w-full rounded-full border border-orange-200 bg-white text-center text-base font-black text-slate-950 shadow-inner outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100 disabled:bg-stone-50 disabled:text-stone-400"
                                value={quantity}
                                onChange={(e) => changeQuantity(item, e.target.value)}
                                disabled={disableAll}
                              />
                            </div>
                            
                            <button
                              type="button"
                              className="flex h-10 min-h-[40px] w-10 min-w-[40px] items-center justify-center rounded-full bg-white text-stone-800 shadow-sm ring-1 ring-orange-100 transition hover:text-[#FF6A00] active:scale-95 disabled:opacity-40"
                              onClick={() => changeQuantity(item, quantity + 1)}
                              disabled={disableAll}
                              aria-label="Augmenter la quantité"
                            >
                              <span className="text-lg font-black">+</span>
                            </button>
                            </div>
                          </div>

                          {/* Line Total Enhanced - Much Smaller on Mobile */}
                          <div className="rounded-2xl border border-orange-100 bg-white px-3 py-2 text-right">
                            <span className="block text-[10px] font-bold text-stone-500">Sous-total</span>
                            <div className="text-sm font-black text-stone-950 sm:text-lg">
                              {formatPrice(lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions Enhanced - Compact Design for Mobile */}
                      <div className="flex items-center gap-2 border-t border-orange-100 pt-3 w-full">
                        {whatsappLink && (
                          <button
                            type="button"
                            onClick={() => handleWhatsappClick(item, whatsappLink)}
                            className="inline-flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-3 py-2.5 text-xs font-black text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.10)] transition-all hover:bg-emerald-100 active:scale-95 sm:text-sm"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                              <WhatsAppIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </span>
                            <div className="flex flex-col items-start leading-tight text-left min-w-0 flex-1 overflow-hidden">
                              <span className="w-full truncate text-xs font-black sm:text-sm">Contacter</span>
                              {sellerPhone && (
                                <span className="w-full truncate text-[10px] font-bold text-emerald-600 sm:text-xs">
                                  {sellerPhone}
                                </span>
                              )}
                              <span className="whitespace-nowrap text-[10px] font-bold text-emerald-500">
                                {clickCount} clic{clickCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          disabled={disableAll || pending[cartItemKey]}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-600 shadow-sm transition-all hover:bg-red-50 active:scale-95 disabled:opacity-60 sm:text-sm"
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
          <div className="space-y-4">
            <div className="sticky top-6 rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_18px_45px_rgba(117,75,36,0.09)] sm:p-6">
              <h2 className="mb-5 text-xl font-black text-stone-950">Résumé</h2>
              
              <div className="space-y-4">
                {/* Items Count Enhanced */}
                <div className="flex justify-between items-center rounded-2xl bg-orange-50/70 px-4 py-3">
                  <span className="text-stone-700 font-semibold">Articles ({totals.quantity})</span>
                  <span className="font-black text-stone-950 text-lg">{formatPrice(totals.subtotal)}</span>
                </div>

                {/* Savings Enhanced */}
                {totalSavings > 0 && (
                  <div className="flex justify-between items-center rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                    <span className="text-green-700 font-semibold">Économies</span>
                    <span className="font-black text-green-600 text-lg">-{formatPrice(totalSavings)}</span>
                  </div>
                )}

                {/* Shipping Estimate Enhanced */}
                <div className="flex justify-between items-center rounded-2xl border border-orange-100 bg-white px-4 py-3">
                  <span className="text-stone-700 font-semibold">Livraison estimée</span>
                  <span className="font-black text-[#FF6A00]">À confirmer</span>
                </div>

                {/* Divider Enhanced */}
                <div className="border-t border-orange-100 pt-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-stone-950">Total</span>
                    <span className="text-3xl font-black text-[#FF6A00]">{formatPrice(totals.subtotal)}</span>
                  </div>
                </div>

                {/* Info Note Enhanced */}
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-center text-xs font-semibold leading-relaxed text-stone-700">
                    Les paiements sont sécurisés et gérés après validation des annonces.
                    Contactez directement les vendeurs pour finaliser vos achats.
                  </p>
                </div>

                {/* Action Buttons Enhanced */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCheckoutClick}
                    className="hd-primary-button block min-h-[52px] w-full rounded-full py-4 text-center font-black"
                  >
                    Passer la commande
                  </button>
                </div>
              </div>
            </div>

            {/* Security Badges Enhanced */}
            <div className="rounded-[24px] border border-orange-100 bg-white p-5 text-center shadow-sm">
              <h3 className="font-black text-stone-950 mb-4">Achat protégé</h3>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-3 text-stone-600">
                <div className="text-xs font-semibold">Paiement vérifié</div>
                <div className="text-xs font-semibold">Livraison suivie</div>
                <div className="text-xs font-semibold">Support HDMarket</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
