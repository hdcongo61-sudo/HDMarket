import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import { useAppSettings } from '../context/AppSettingsContext';

const TrashIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const ShoppingBagIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const UndoIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
  </svg>
);

const formatPrice = (value) => formatPriceWithStoredSettings(value);

export default function Cart() {
  const navigate = useNavigate();
  const { cart, loading, error, addItem, updateItem, removeItem, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { t } = useAppSettings();
  const [pending, setPending] = useState({});
  const [qtyPending, setQtyPending] = useState({});
  const [qtyDrafts, setQtyDrafts] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDistanceWarning, setShowDistanceWarning] = useState(false);
  const [lastRemoved, setLastRemoved] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const undoTimerRef = useRef(null);
  const externalLinkProps = useDesktopExternalLink();

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

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
    // Qty syncs are tracked separately from removals so the card never dims/locks
    // while stepping; the stepper shows the target value instantly instead.
    setQtyPending((prev) => ({ ...prev, [cartItemKey]: value }));
    try {
      await updateItem(productId, value, item?.selectedAttributes || [], item?.selectionKey || '');
    } catch (e) {
      showToast(e?.response?.data?.message || t('cartPage.updateError', 'Impossible de modifier la quantité.'), { variant: 'error' });
    } finally {
      setQtyPending((prev) => {
        const next = { ...prev };
        delete next[cartItemKey];
        return next;
      });
    }
  };

  // Direct typing edits a local draft; the server call happens once, on blur/Enter.
  const commitQtyDraft = (item) => {
    const cartItemKey = getCartItemKey(item);
    const raw = qtyDrafts[cartItemKey];
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[cartItemKey];
      return next;
    });
    if (raw === undefined || String(raw).trim() === '') return;
    changeQuantity(item, raw);
  };

  const handleRemove = async (item) => {
    const productId = item?.product?._id || item?.product;
    if (!productId) {
      showToast('Impossible de supprimer cet article : produit introuvable.', { variant: 'error' });
      return;
    }
    const cartItemKey = getCartItemKey(item);
    setPending((prev) => ({ ...prev, [cartItemKey]: true }));
    try {
      await removeItem(productId, item?.selectedAttributes || [], item?.selectionKey || '');
      // Offer a one-tap undo instead of an irreversible confirmation prompt.
      const snapshot = {
        productId,
        quantity: Number(item?.quantity || 1),
        selectedAttributes: item?.selectedAttributes || [],
        title: item?.product?.title || 'Article'
      };
      setLastRemoved(snapshot);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastRemoved(null), 7000);
    } catch (e) {
      showToast(e?.response?.data?.message || t('cartPage.removeError', 'Impossible de retirer l\'article.'), { variant: 'error' });
    } finally {
      setPending((prev) => ({ ...prev, [cartItemKey]: false }));
    }
  };

  const handleUndoRemove = async () => {
    if (!lastRemoved || restoring) return;
    const snapshot = lastRemoved;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRestoring(true);
    try {
      await addItem(snapshot.productId, snapshot.quantity, snapshot.selectedAttributes);
      setLastRemoved(null);
    } catch (e) {
      showToast(e?.response?.data?.message || t('cartPage.restoreError', 'Impossible de restaurer l\'article.'), { variant: 'error' });
    } finally {
      setRestoring(false);
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
    if (item.variantPriceApplied) return sum;
    const discount = item.product.discount || 0;
    const originalPrice = item.product.priceBeforeDiscount || item.product.price;
    const savings = discount > 0 ? (originalPrice - item.product.price) * item.quantity : 0;
    return sum + savings;
  }, 0);

  return ( 
    <main className="hd-products-flow min-h-screen">
      <div className="max-w-7xl mx-auto px-3 py-5 pb-24 sm:px-6 sm:py-8 lg:px-8 space-y-5 sm:space-y-7">
      <header className="flex min-h-[60px] items-center border-b border-[#f5f2ee] bg-white px-2 sm:rounded-2xl sm:border">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex h-11 w-11 items-center justify-center text-[#231f1b]" aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h1 className="min-w-0 flex-1 text-[17px] font-black text-[#231f1b]">
          {t('cartPage.title', 'Mon panier')} <span className="font-semibold text-[#8a8378]">({items.length})</span>
        </h1>
          {items.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)} disabled={disableAll} className="inline-flex min-h-11 items-center px-3 text-[13px] font-bold text-[#8a8378] disabled:opacity-60">
              {t('cartPage.clear', 'Vider')}
            </button>
          )}
      </header>

      {/* Clear Cart Confirmation Modal Enhanced */}
      <BaseModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="md"
        mobileSheet
        ariaLabel={t('cartPage.clearTitle', 'Vider le panier')}
      >
        <ModalHeader
          title={t('cartPage.clearTitle', 'Vider le panier')}
          subtitle={t('cartPage.irreversible', 'Action irréversible')}
          onClose={() => setShowClearConfirm(false)}
        />
        <ModalBody className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100">
            <TrashIcon className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            {t('cartPage.clearConfirm', 'Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ?')}
          </p>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 rounded-xl bg-[rgba(120,120,128,0.12)] px-5 py-3 text-sm font-semibold text-[#8E8E93] transition-all hover:bg-[rgba(120,120,128,0.18)]"
            >
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              onClick={handleClear}
              disabled={pending.all}
              className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 active:scale-95 disabled:opacity-60"
            >
              {pending.all ? t('cartPage.clearing', 'Suppression...') : t('cartPage.clearTitle', 'Vider le panier')}
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
        ariaLabel={t('cartPage.distanceTitle', 'Attention à la distance')}
      >
        <ModalHeader
          title={t('cartPage.distanceTitle', 'Attention à la distance')}
          subtitle={t('cartPage.distanceSubtitle', 'Vérifiez les villes des vendeurs avant de confirmer')}
          onClose={handleCancelCheckout}
        />
        <ModalBody className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {t('cartPage.distanceWarning', 'Certains vendeurs sont dans une autre ville. La livraison peut prendre plus de temps.')}
          </p>
          {sellerCityData.mismatchedCities.length > 0 ? (
            <p className="text-xs text-gray-600">
              {t('cartPage.sellers', 'Vendeurs')} : <span className="font-semibold text-gray-900">{sellerCityData.mismatchedCities.join(', ')}</span>
            </p>
          ) : null}
          {sellerCityData.buyerDisplay ? (
            <p className="text-xs text-gray-600">
              {t('cartPage.yourCity', 'Votre ville')} : <span className="font-semibold text-gray-900">{sellerCityData.buyerDisplay}</span>
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
              {pending.all ? t('cartPage.cancelling', 'Annulation…') : t('common.cancel', 'Annuler')}
            </button>
            <button
              type="button"
              onClick={handleProceedCheckout}
              disabled={pending.all}
              className="flex-1 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-amber-700 active:scale-95 disabled:opacity-60"
            >
              {t('cartPage.continueAnyway', 'Continuer quand même')}
            </button>
          </div>
        </ModalFooter>
      </BaseModal>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm sm:p-5">
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 shadow-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-[#e85d00] border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">{t('cartPage.loading', 'Chargement du panier...')}</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(117,75,36,0.08)] sm:py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-gray-200">
            <ShoppingBagIcon className="w-12 h-12 text-[#e85d00]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">{t('cartPage.emptyTitle', 'Panier vide')}</h2>
          <p className="text-gray-600 mb-8 max-w-sm mx-auto font-medium">
            {t('cartPage.emptySubtitle', 'Découvrez nos produits et ajoutez vos articles préférés.')}
          </p>
          <Link
            to="/products"
            className="hd-primary-button inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3.5 font-black"
          >
            <ShoppingBagIcon className="w-5 h-5" />
            {t('cartPage.discover', 'Découvrir les produits')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px] xl:gap-7">
          {/* Cart Items Enhanced */}
          <div className="space-y-3 sm:space-y-4">
            {/* Undo banner — one-tap restore after a removal */}
            {lastRemoved && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <TrashIcon className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-gray-700">
                    « {lastRemoved.title} » {t('cartPage.removed', 'retiré du panier')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUndoRemove}
                  disabled={restoring}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e85d00] px-4 py-2 text-xs font-black text-white transition hover:bg-[#f45f00] active:scale-95 disabled:opacity-60"
                >
                  <UndoIcon className="h-3.5 w-3.5" />
                  {restoring ? '…' : t('cartPage.undo', 'Annuler')}
                </button>
              </div>
            )}
            {items.map((item) => {
              const { product, quantity, lineTotal, unitPrice } = item;
              const discount = product.discount || 0;
              const cartItemKey = getCartItemKey(item);
              
              const isRemoving = Boolean(pending[cartItemKey]);
              return (
                <div
                  key={cartItemKey}
                  className={`group relative rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_12px_32px_rgba(117,75,36,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(117,75,36,0.11)] sm:p-5 ${isRemoving ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {/* One-tap remove — always visible in the corner */}
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={disableAll || isRemoving}
                    aria-label={t('cartPage.remove', 'Retirer du panier')}
                    title={t('cartPage.remove', 'Retirer du panier')}
                    className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-400 shadow-sm ring-1 ring-gray-200 backdrop-blur transition hover:bg-red-50 hover:text-red-600 hover:ring-red-200 active:scale-90 disabled:opacity-50"
                  >
                    {isRemoving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    ) : (
                      <CloseIcon className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex gap-3 pr-8 sm:gap-5 sm:pr-9">
                    {/* Product Image Enhanced - Much Smaller on Mobile */}
                    <div className="w-24 shrink-0 sm:w-36 lg:w-40">
                      <Link
                        to={buildProductPath(product)}
                        {...externalLinkProps}
                        className="block relative overflow-hidden rounded-xl aspect-square bg-gray-100 transition-all duration-300"
                      >
                        <img
                          src={item.variantImage || product.images?.[0] || 'https://via.placeholder.com/300'}
                          alt={product.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        {discount > 0 && !item.variantPriceApplied && (
                          <div className="absolute left-2 top-2 rounded-full bg-[#e85d00] px-2 py-1 text-[10px] font-black text-white shadow-sm">
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
                    className="line-clamp-2 text-sm font-black text-gray-900 transition-colors hover:text-[#e85d00] sm:text-lg"
                  >
                            {product.title}
                          </Link>
                          <p className="text-[11px] sm:text-sm text-gray-500 font-semibold">{t('cartPage.category', 'Catégorie')} : <span className="text-gray-800">{product.category}</span></p>
                          <SelectedAttributesList
                            selectedAttributes={item.selectedAttributes}
                            compact
                            className="pt-1"
                          />
                          
                          {/* Price Display Enhanced - Much Smaller on Mobile */}
                          <p className="text-xs font-semibold text-[#8a8378]">{formatPrice(unitPrice)} / {t('cartPage.unit', 'unité')}</p>
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2 lg:flex-col lg:items-end">
                          {/* Stepper compact (style Taobao) : − | qté | + , saisie directe validée au blur */}
                          {(() => {
                            const qtySyncing = qtyPending[cartItemKey] !== undefined;
                            const qtyDisplayed = qtyDrafts[cartItemKey] ?? qtyPending[cartItemKey] ?? quantity;
                            return (
                              <div className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => (quantity <= 1 ? handleRemove(item) : changeQuantity(item, quantity - 1))}
                                  disabled={disableAll || isRemoving || qtySyncing}
                                  aria-label={quantity <= 1 ? t('cartPage.remove', 'Retirer du panier') : t('cartPage.decrease', 'Diminuer la quantité')}
                                  title={quantity <= 1 ? t('cartPage.remove', 'Retirer du panier') : t('cartPage.decrease', 'Diminuer la quantité')}
                                  className={`flex h-11 w-11 items-center justify-center transition active:bg-gray-100 disabled:opacity-40 ${quantity <= 1
                                    ? 'text-red-500 hover:bg-red-50'
                                    : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                  {quantity <= 1 ? <TrashIcon className="h-[18px] w-[18px]" /> : <span className="text-xl font-black leading-none">−</span>}
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  aria-label={t('cartPage.quantity', 'Quantité')}
                                  value={qtyDisplayed}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                    setQtyDrafts((prev) => ({ ...prev, [cartItemKey]: digits }));
                                  }}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onBlur={() => commitQtyDraft(item)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  disabled={disableAll || isRemoving}
                                  className={`h-11 w-12 border-x border-gray-100 bg-transparent text-center text-base font-black outline-none transition focus:bg-[#FFF7F0] disabled:text-gray-400 ${qtySyncing ? 'animate-pulse text-[#e85d00]' : 'text-gray-900'}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item, quantity + 1)}
                                  disabled={disableAll || isRemoving || qtySyncing}
                                  aria-label={t('cartPage.increase', 'Augmenter la quantité')}
                                  className="flex h-11 w-11 items-center justify-center text-gray-700 transition hover:bg-gray-50 hover:text-[#e85d00] active:bg-gray-100 disabled:opacity-40"
                                >
                                  <span className="text-xl font-black leading-none">+</span>
                                </button>
                              </div>
                            );
                          })()}

                          {/* Line Total Enhanced - Much Smaller on Mobile */}
                          <div className="text-right">
                            <div className="text-[17px] font-black text-neutral-950">
                              {formatPrice(lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary Enhanced */}
          <div className="space-y-4">
            <div className="sticky top-6 rounded-2xl border border-[#e2dcd2] bg-white p-5 shadow-[0_18px_45px_rgba(117,75,36,0.09)] sm:p-6">
              <h2 className="mb-5 text-xl font-black text-[#231f1b]">{t('cartPage.summary', 'Résumé')}</h2>
              
              <div className="space-y-4">
                {/* Items Count Enhanced */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#6b6459]">{t('cartPage.subtotal', 'Sous-total')} ({totals.quantity} {t(totals.quantity > 1 ? 'cartPage.items' : 'cartPage.item', totals.quantity > 1 ? 'articles' : 'article')})</span>
                  <span className="text-lg font-black text-[#231f1b]">{formatPrice(totals.subtotal)}</span>
                </div>

                {/* Savings Enhanced */}
                {totalSavings > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-[#6b6459]">{t('cartPage.savings', 'Économies')}</span>
                    <span className="text-lg font-black text-emerald-700">-{formatPrice(totalSavings)}</span>
                  </div>
                )}

                {/* Shipping Estimate Enhanced */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#6b6459]">{t('cartPage.delivery', 'Livraison')}</span>
                  <span className="text-right text-sm font-semibold text-[#6b6459]">{t('cartPage.deliveryNext', 'calculée à l’étape suivante')}</span>
                </div>

                {/* Divider Enhanced */}
                <div className="border-t border-[#e2dcd2] pt-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-gray-900">{t('cartPage.total', 'Total')}</span>
                    <span className="text-3xl font-black text-neutral-950">{formatPrice(totals.subtotal)}</span>
                  </div>
                </div>

                {/* Info Note Enhanced */}
                <div className="border-t border-[#f0ebe4] pt-4">
                  <p className="text-center text-xs font-semibold leading-relaxed text-[#6b6459]">
                    {t('cartPage.trust', 'Paiement sécurisé · Livraison suivie · Support HDMarket')}
                  </p>
                </div>

                {/* Action Buttons Enhanced */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCheckoutClick}
                    className="hd-primary-button block min-h-[52px] w-full rounded-full py-4 text-center font-black"
                  >
                    {t('cartPage.checkout', 'Passer la commande')}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      </div>
    </main>
  );
}
