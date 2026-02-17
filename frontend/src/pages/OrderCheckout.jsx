import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle,
  ClipboardList,
  ArrowLeft,
  ShoppingBag,
  Lock,
  AlertCircle,
  Tag
} from 'lucide-react';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export default function OrderCheckout() {
  const { cart, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [payments, setPayments] = useState({});
  const [promoStates, setPromoStates] = useState({});
  const [promoLoadingBySeller, setPromoLoadingBySeller] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [paymentMode, setPaymentMode] = useState('full');
  const [guarantor, setGuarantor] = useState({
    fullName: '',
    phone: '',
    relation: '',
    nationalId: '',
    address: ''
  });
  const [installmentEligibility, setInstallmentEligibility] = useState({
    score: null,
    riskLevel: ''
  });

  const totals = cart.totals || { subtotal: 0, quantity: 0 };

  const items = cart.items || [];
  const isInstallmentProductEligible = useMemo(() => {
    if (items.length !== 1) return false;
    const product = items[0]?.product;
    if (!product?.installmentEnabled) return false;
    const start = product.installmentStartDate ? new Date(product.installmentStartDate) : null;
    const end = product.installmentEndDate ? new Date(product.installmentEndDate) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now >= start && now <= end;
  }, [items]);
  const installmentProduct = isInstallmentProductEligible ? items[0]?.product : null;
  const installmentMinAmount = Number(installmentProduct?.installmentMinAmount || 0);
  const installmentDuration = Number(installmentProduct?.installmentDuration || 0);
  const installmentRequiresGuarantor = Boolean(installmentProduct?.installmentRequireGuarantor);
  const installmentFirstPaymentAmount = useMemo(() => {
    if (!isInstallmentProductEligible) return 0;
    const subtotal = Number(totals.subtotal || 0);
    const minAmount = Math.max(0, Number(installmentMinAmount || 0));
    if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
    return Math.min(subtotal, minAmount);
  }, [isInstallmentProductEligible, totals.subtotal, installmentMinAmount]);
  const installmentRemainingAmount = Math.max(
    0,
    Number(totals.subtotal || 0) - installmentFirstPaymentAmount
  );
  const sellerGroups = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const seller = item?.product?.user || null;
      const rawSellerId = seller?._id;
      const sellerId = rawSellerId ? String(rawSellerId) : 'unknown';
      const sellerName = seller?.shopName || seller?.name || 'Vendeur';
      const sellerPhone = seller?.phone || item?.product?.contactPhone || '';
      if (!groups.has(sellerId)) {
        groups.set(sellerId, {
          sellerId,
          sellerName,
          sellerPhone,
          items: [],
          subtotal: 0
        });
      }
      const group = groups.get(sellerId);
      group.items.push(item);
      group.subtotal += Number(item?.lineTotal || 0);
    });
    return Array.from(groups.values());
  }, [items]);

  const getSellerPromoState = (sellerId) =>
    promoStates[sellerId] || { status: 'idle', message: '', code: '', pricing: null, promo: null };

  const isPromoAppliedForSeller = (sellerId) => {
    const state = getSellerPromoState(sellerId);
    const typedCode = String(payments[sellerId]?.promoCode || '').trim().toUpperCase();
    return state.status === 'valid' && Boolean(typedCode) && typedCode === state.code;
  };

  const getSellerEffectiveSubtotal = (group) => {
    if (paymentMode !== 'full') return Number(group.subtotal || 0);
    if (!isPromoAppliedForSeller(group.sellerId)) return Number(group.subtotal || 0);
    const finalAmount = Number(getSellerPromoState(group.sellerId)?.pricing?.finalAmount);
    return Number.isFinite(finalAmount) ? finalAmount : Number(group.subtotal || 0);
  };

  const checkoutSubtotal = useMemo(() => {
    if (paymentMode !== 'full') return Number(totals.subtotal || 0);
    return sellerGroups.reduce((sum, group) => sum + getSellerEffectiveSubtotal(group), 0);
  }, [paymentMode, totals.subtotal, sellerGroups, promoStates, payments]);

  const checkoutSavings = useMemo(() => {
    if (paymentMode !== 'full') return 0;
    return sellerGroups.reduce((sum, group) => {
      const original = Number(group.subtotal || 0);
      const effective = getSellerEffectiveSubtotal(group);
      return sum + Math.max(0, original - effective);
    }, 0);
  }, [paymentMode, sellerGroups, promoStates, payments]);

  const depositAmount = useMemo(() => Math.round(checkoutSubtotal * 0.25), [checkoutSubtotal]);
  const remainingAmount = Math.max(0, Number(checkoutSubtotal || 0) - depositAmount);
  const summaryPaidAmount = paymentMode === 'installment' ? installmentFirstPaymentAmount : depositAmount;
  const summaryRemainingAmount =
    paymentMode === 'installment'
      ? Math.max(0, Number(totals.subtotal || 0) - installmentFirstPaymentAmount)
      : remainingAmount;

  useEffect(() => {
    if (!isInstallmentProductEligible && paymentMode === 'installment') {
      setPaymentMode('full');
    }
  }, [isInstallmentProductEligible, paymentMode]);

  useEffect(() => {
    setPayments((prev) => {
      const next = {};
      sellerGroups.forEach((group) => {
        const key = group.sellerId;
        const existing = prev[key] || {};
        next[key] = {
          payerName: existing.payerName ?? user?.name ?? '',
          transactionCode: existing.transactionCode ?? '',
          promoCode: existing.promoCode ?? ''
        };
      });
      return next;
    });
    setPromoStates((prev) => {
      const next = {};
      sellerGroups.forEach((group) => {
        const key = group.sellerId;
        next[key] = prev[key] || { status: 'idle', message: '', code: '', pricing: null, promo: null };
      });
      return next;
    });
  }, [sellerGroups, user?.name]);

  useEffect(() => {
    if (!isInstallmentProductEligible) {
      setInstallmentEligibility({ score: null, riskLevel: '' });
      return;
    }
    let active = true;
    api
      .get('/orders/installment/eligibility')
      .then(({ data }) => {
        if (!active) return;
        setInstallmentEligibility({
          score: Number(data?.score ?? 0),
          riskLevel: data?.riskLevel || 'medium'
        });
      })
      .catch(() => {
        if (!active) return;
        setInstallmentEligibility({ score: null, riskLevel: '' });
      });
    return () => {
      active = false;
    };
  }, [isInstallmentProductEligible]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!items.length) {
      setError('Votre panier est vide.');
      return;
    }
    if (paymentMode === 'installment') {
      if (!isInstallmentProductEligible || !installmentProduct) {
        setError('Le paiement par tranche n’est pas disponible pour cette commande.');
        return;
      }
      const installmentSeller = sellerGroups[0];
      const paymentEntry = installmentSeller ? payments[installmentSeller.sellerId] || {} : {};
      const firstAmount = Number(installmentFirstPaymentAmount || 0);
      if (!Number.isFinite(firstAmount) || firstAmount < installmentMinAmount) {
        setError(`Le premier paiement minimum est de ${formatCurrency(installmentMinAmount)} FCFA.`);
        return;
      }
      if (firstAmount > Number(totals.subtotal || 0)) {
        setError('Le premier paiement ne peut pas dépasser le total de la commande.');
        return;
      }
      if (!paymentEntry?.payerName?.trim() || !paymentEntry?.transactionCode?.trim()) {
        setError('Le nom du payeur et le code de transaction sont requis.');
        return;
      }
      const cleanTransactionCode = String(paymentEntry.transactionCode).replace(/\D/g, '');
      if (cleanTransactionCode.length !== 10) {
        setError('Le code de transaction doit contenir exactement 10 chiffres.');
        return;
      }
      if (
        installmentRequiresGuarantor &&
        (!guarantor.fullName || !guarantor.phone || !guarantor.relation || !guarantor.address)
      ) {
        setError('Les informations du garant sont requises pour ce produit.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        await api.post('/orders/installment/checkout', {
          productId: installmentProduct._id,
          quantity: Number(items[0]?.quantity || 1),
          firstPaymentAmount: Number(firstAmount),
          payerName: paymentEntry.payerName.trim(),
          transactionCode: cleanTransactionCode,
          guarantor
        });
        setOrderConfirmed(true);
        await clearCart();
        showToast('Commande en tranche créée. En attente de validation vendeur.', { variant: 'success' });
        navigate('/orders');
      } catch (err) {
        const message = err.response?.data?.message || 'Impossible de créer la commande en tranche.';
        setError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setLoading(false);
      }
      return;
    }

    const invalidSeller = sellerGroups.some(
      (group) => !group.sellerId || group.sellerId === 'unknown'
    );
    if (invalidSeller) {
      setError('Impossible de déterminer le vendeur pour certains articles.');
      return;
    }
    const missingPayment = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      return !entry.payerName?.trim() || !entry.transactionCode?.trim();
    });
    if (missingPayment) {
      setError(
        sellerGroups.length > 1
          ? 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.'
          : 'Veuillez renseigner le nom et le code de transaction.'
      );
      return;
    }
    const invalidTransactionCode = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      const code = (entry.transactionCode || '').trim().replace(/\D/g, '');
      return code.length !== 10;
    });
    if (invalidTransactionCode) {
      setError('Le code de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    const hasUnvalidatedPromo = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      const typedCode = String(entry.promoCode || '').trim().toUpperCase();
      if (!typedCode) return false;
      return !isPromoAppliedForSeller(group.sellerId);
    });
    if (hasUnvalidatedPromo) {
      setError('Veuillez appliquer/valider chaque code promo saisi avant de confirmer.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/orders/checkout', {
        payments: sellerGroups.map((group) => {
          const entry = payments[group.sellerId] || {};
          const normalizedPromoCode = String(entry.promoCode || '').trim().toUpperCase();
          const promoCode = isPromoAppliedForSeller(group.sellerId) ? normalizedPromoCode : '';
          return {
            sellerId: group.sellerId,
            payerName: entry.payerName.trim(),
            transactionCode: entry.transactionCode.trim().replace(/\D/g, ''),
            promoCode
          };
        })
      });
      setOrderConfirmed(true);
      await clearCart();
      showToast('Commande enregistrée. Elle est en attente de validation.', { variant: 'success' });
      navigate('/orders');
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de confirmer la commande.';
      setError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentChange = (sellerId, field, value) => {
    if (field === 'transactionCode') {
      value = String(value).replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'promoCode') {
      value = String(value || '').toUpperCase();
    }
    setPayments((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] || {}),
        [field]: value
      }
    }));
    if (field === 'promoCode') {
      const normalized = String(value || '').trim().toUpperCase();
      setPromoStates((prev) => {
        const current = prev[sellerId] || { status: 'idle', message: '', code: '', pricing: null, promo: null };
        if (!normalized) {
          return {
            ...prev,
            [sellerId]: { status: 'idle', message: '', code: '', pricing: null, promo: null }
          };
        }
        if (current.code && current.code !== normalized) {
          return {
            ...prev,
            [sellerId]: {
              status: 'idle',
              message: 'Code modifié, cliquez sur "Appliquer".',
              code: '',
              pricing: null,
              promo: null
            }
          };
        }
        return prev;
      });
    }
  };

  const applyPromoCodeForSeller = async (group) => {
    const sellerId = group?.sellerId;
    if (!sellerId || sellerId === 'unknown') return;
    const entry = payments[sellerId] || {};
    const code = String(entry.promoCode || '').trim().toUpperCase();
    if (!code) {
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message: 'Veuillez saisir un code promo.',
          code: '',
          pricing: null,
          promo: null
        }
      }));
      return;
    }

    const previewItems = (group.items || [])
      .map((item) => ({
        productId: item?.product?._id,
        quantity: Number(item?.quantity || 1)
      }))
      .filter((item) => Boolean(item.productId));

    if (!previewItems.length) {
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message: 'Aucun produit valide pour ce vendeur.',
          code: '',
          pricing: null,
          promo: null
        }
      }));
      return;
    }

    setPromoLoadingBySeller((prev) => ({ ...prev, [sellerId]: true }));
    try {
      const { data } = await api.post('/marketplace-promo-codes/preview', {
        code,
        items: previewItems
      });
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'valid',
          message: data?.message || 'Code promo appliqué.',
          code,
          pricing: data?.pricing || null,
          promo: data?.promo || null
        }
      }));
      showToast('Code promo appliqué.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Code promo invalide ou expiré.';
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message,
          code: '',
          pricing: null,
          promo: null
        }
      }));
      showToast(message, { variant: 'error' });
    } finally {
      setPromoLoadingBySeller((prev) => ({ ...prev, [sellerId]: false }));
    }
  };

  // Load draft payments if available
  useEffect(() => {
    if (!user || !items.length) return;

    const loadDraftPayments = async () => {
      try {
        const { data } = await api.get('/orders/draft');
        if (data.items && data.items.length > 0) {
          // Restore payments from draft
          const draftPayments = {};
          data.items.forEach((draft) => {
            if (draft.draftPayments && draft.draftPayments.length > 0) {
              draft.draftPayments.forEach((payment) => {
                if (payment.sellerId) {
                  const code = (payment.transactionCode || '').replace(/\D/g, '').slice(0, 10);
                  draftPayments[String(payment.sellerId)] = {
                    payerName: payment.payerName || '',
                    transactionCode: code,
                    promoCode: String(payment.promoCode || '').toUpperCase()
                  };
                }
              });
            }
          });
          if (Object.keys(draftPayments).length > 0) {
            setPayments((prev) => ({ ...prev, ...draftPayments }));
          }
        }
      } catch (error) {
        // Silently fail - draft loading is optional
        console.error('Failed to load draft payments:', error);
      }
    };

    loadDraftPayments();
  }, [user, items.length]);

  // Save draft order when user leaves without confirming
  useEffect(() => {
    if (!user || !items.length || loading || orderConfirmed || paymentMode === 'installment') return;

    const saveDraft = async () => {
      try {
        const paymentsArray = sellerGroups.map((group) => {
          const entry = payments[group.sellerId] || {};
          return {
            sellerId: group.sellerId,
            payerName: entry.payerName?.trim() || '',
            transactionCode: entry.transactionCode?.trim() || '',
            promoCode: entry.promoCode?.trim()?.toUpperCase() || ''
          };
        });

        await api.post('/orders/draft', { payments: paymentsArray });
      } catch (error) {
        // Silently fail - don't interrupt user navigation
        console.error('Failed to save draft order:', error);
      }
    };

    // Save draft on component unmount (when user leaves)
    return () => {
      if (!orderConfirmed) {
        saveDraft();
      }
    };
  }, [user, items.length, sellerGroups, payments, loading, orderConfirmed, paymentMode]);

  if (!items.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-6 shadow-lg border-2 border-blue-100">
            <ClipboardList size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Votre panier est vide</h1>
          <p className="text-gray-600 font-medium mb-8">
            Ajoutez des produits avant de confirmer une commande.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <ShoppingBag size={18} />
            Explorer le marché
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Enhanced */}
      <header className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-6 sm:p-8 border-2 border-blue-100 shadow-lg">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="font-medium text-sm">Retour au panier</span>
        </Link>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900">Confirmer votre commande</h1>
          <p className="text-gray-600 font-medium">
            {paymentMode === 'installment'
              ? 'Cette commande sera traitée en paiement par tranche après validation du vendeur.'
              : 'Un acompte de 25% est requis pour confirmer votre commande.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-8">
        {/* Order Summary Enhanced */}
        <section className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Résumé de la commande</h2>
          </div>
          <div className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => (
              <div key={product._id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-200">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/80'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm sm:text-base line-clamp-2 mb-1">{product.title}</p>
                  <p className="text-xs text-gray-600 font-medium mb-1">Quantité: x{quantity}</p>
                  <p className="text-xs text-gray-500">
                    Vendeur: {product.user?.phone || product.contactPhone || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-blue-600 text-base sm:text-lg">
                    {formatCurrency(lineTotal)} FCFA
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-semibold">Total commande</span>
              <span className="font-black text-gray-900 text-lg">
                {formatCurrency(paymentMode === 'full' ? checkoutSubtotal : totals.subtotal)} FCFA
              </span>
            </div>
            {paymentMode === 'full' && checkoutSavings > 0 && (
              <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 font-semibold">Économie via promo</span>
                <span className="font-black text-emerald-600 text-lg">
                  -{formatCurrency(checkoutSavings)} FCFA
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="text-blue-700 font-semibold">
                {paymentMode === 'installment' ? 'Premier paiement' : 'Acompte (25%)'}
              </span>
              <span className="font-black text-blue-600 text-lg">
                {formatCurrency(summaryPaidAmount)} FCFA
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-semibold">Reste à payer</span>
              <span className="font-black text-gray-900 text-lg">
                {formatCurrency(summaryRemainingAmount)} FCFA
              </span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-xs sm:text-sm text-blue-800 flex items-start gap-3">
            <ShieldCheck size={16} />
            <span>
              {paymentMode === 'installment'
                ? 'Le vendeur doit confirmer la vente puis valider chaque tranche.'
                : 'Le paiement de l’acompte confirme la commande. Le solde sera réglé à la livraison.'}
            </span>
          </div>
        </section>

        {/* Payment Form Enhanced */}
        <section className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <CreditCard size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Informations de paiement</h2>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {isInstallmentProductEligible && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <p className="text-xs font-bold uppercase text-indigo-700">Mode de paiement</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('full')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      paymentMode === 'full'
                        ? 'border-indigo-500 bg-white text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    Paiement classique (acompte 25%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('installment')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      paymentMode === 'installment'
                        ? 'border-indigo-500 bg-white text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    Paiement par tranche ({installmentDuration} jours)
                  </button>
                </div>
                <p className="text-xs text-indigo-700">
                  Paiement en plusieurs fois disponible
                </p>
                {installmentEligibility.score !== null && (
                  <p className="text-xs text-indigo-700">
                    Score d'éligibilité: <span className="font-semibold">{installmentEligibility.score}/100</span>{' '}
                    ({installmentEligibility.riskLevel || 'medium'})
                  </p>
                )}
              </div>
            )}

            {sellerGroups.map((group) => {
              const payment = payments[group.sellerId] || {};
              const promoState = getSellerPromoState(group.sellerId);
              const groupEffectiveSubtotal = getSellerEffectiveSubtotal(group);
              const groupDeposit = paymentMode === 'installment'
                ? installmentFirstPaymentAmount
                : Math.round(Number(groupEffectiveSubtotal || 0) * 0.25);
              const groupRemaining = Math.max(0, Number(groupEffectiveSubtotal || 0) - groupDeposit);
              return (
                <div
                  key={group.sellerId}
                  className="rounded-3xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 p-5 sm:p-6 space-y-4 shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-gray-200">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase text-gray-500 tracking-wide">Paiement vendeur</p>
                      <p className="text-base sm:text-lg font-black text-gray-900">{group.sellerName}</p>
                      {group.sellerPhone && (
                        <p className="text-xs text-gray-600 font-medium">📞 {group.sellerPhone}</p>
                      )}
                    </div>
                    <div className="text-right bg-blue-100 px-3 py-2 rounded-xl border border-blue-200">
                      <p className="text-base sm:text-lg font-black text-blue-600">
                        {formatCurrency(groupDeposit)} FCFA
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        {paymentMode === 'installment' ? 'Premier paiement' : 'Acompte (25%)'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                        Nom du payeur
                      </label>
                      <input
                        type="text"
                        value={payment.payerName || ''}
                        onChange={(e) =>
                          handlePaymentChange(group.sellerId, 'payerName', e.target.value)
                        }
                        className="w-full rounded-3xl border-2 border-gray-300 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                        placeholder={user?.name || 'Ex: Jean K.'}
                      />
                    </div>

                    <div className="rounded-xl border-2 border-blue-100 bg-blue-50/50 p-3 overflow-hidden">
                      <p className="text-xs font-bold uppercase text-blue-800 mb-2">Exemple : où trouver l'ID dans le SMS</p>
                      <img
                        src="/images/transaction-id-sms-example-checkout.png"
                        alt="Exemple de SMS Mobile Money montrant l'ID de la transaction (ex: 7232173826)"
                        className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-white shadow-sm object-contain"
                      />
                      <p className="text-xs text-blue-700 mt-2 text-center">
                        Saisissez le numéro indiqué à côté de «&nbsp;ID&nbsp;» ou «&nbsp;ID de la transaction&nbsp;» dans le SMS de confirmation.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                        Code transaction
                      </label>
                      <div className="flex items-center gap-3 rounded-3xl border-2 border-gray-300 px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                        <CreditCard size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={payment.transactionCode || ''}
                          onChange={(e) =>
                            handlePaymentChange(group.sellerId, 'transactionCode', e.target.value)
                          }
                          className="w-full border-none p-0 text-sm font-medium focus:outline-none"
                          placeholder="10 chiffres (ex: 7232173826)"
                          title="ID de la transaction : 10 chiffres reçus par SMS"
                        />
                      </div>
                    </div>

                    {paymentMode === 'full' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-gray-700">
                          Code promo vendeur
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-2xl border-2 border-gray-300 px-3 py-2.5 bg-white flex-1">
                            <Tag size={16} className="text-gray-400 flex-shrink-0" />
                            <input
                              type="text"
                              value={payment.promoCode || ''}
                              onChange={(e) =>
                                handlePaymentChange(group.sellerId, 'promoCode', e.target.value)
                              }
                              className="w-full border-none p-0 text-sm font-medium focus:outline-none uppercase"
                              placeholder="Ex: WELCOME20"
                              maxLength={40}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => applyPromoCodeForSeller(group)}
                            disabled={Boolean(promoLoadingBySeller[group.sellerId]) || !String(payment.promoCode || '').trim()}
                            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {promoLoadingBySeller[group.sellerId] ? 'Validation...' : 'Appliquer'}
                          </button>
                        </div>
                        {(promoState.message || promoState.status === 'valid') && (
                          <div
                            className={`rounded-xl border px-3 py-2 text-xs ${
                              promoState.status === 'valid'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : promoState.status === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}
                          >
                            <p className="font-semibold">{promoState.message || 'Code prêt à être appliqué.'}</p>
                            {promoState.status === 'valid' && promoState.pricing && (
                              <p className="mt-1">
                                Nouveau total vendeur: {formatCurrency(promoState.pricing.finalAmount)} FCFA
                                {' · '}Économie: {formatCurrency(promoState.pricing.discountAmount)} FCFA
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMode === 'installment' && (
                      <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-indigo-700 mb-2">
                            Premier paiement fixe ({formatCurrency(installmentMinAmount)} FCFA)
                          </label>
                          <input
                            type="number"
                            min={installmentMinAmount || 1}
                            max={Number(group.subtotal || 0)}
                            value={installmentFirstPaymentAmount}
                            readOnly
                            disabled
                            className="w-full rounded-2xl border border-indigo-200 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <p className="mt-1 text-xs text-indigo-700">
                            Reste estimé: {formatCurrency(installmentRemainingAmount)} FCFA
                          </p>
                        </div>

                        {installmentRequiresGuarantor && (
                          <div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase text-indigo-700">Informations garant</p>
                            <input
                              type="text"
                              placeholder="Nom complet"
                              value={guarantor.fullName}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, fullName: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Téléphone"
                              value={guarantor.phone}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, phone: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Relation avec le client"
                              value={guarantor.relation}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, relation: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Pièce d'identité (optionnel)"
                              value={guarantor.nationalId}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, nationalId: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Adresse"
                              value={guarantor.address}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, address: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold">Sous-total vendeur</span>
                      <span className="font-black text-gray-900">
                        {formatCurrency(groupEffectiveSubtotal)} FCFA
                      </span>
                    </div>
                    {paymentMode === 'full' && groupEffectiveSubtotal < Number(group.subtotal || 0) && (
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-700 font-semibold">Économie promo</span>
                        <span className="font-black text-emerald-600">
                          -{formatCurrency(Number(group.subtotal || 0) - groupEffectiveSubtotal)} FCFA
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 font-semibold">
                        {paymentMode === 'installment' ? 'Premier paiement' : 'Acompte (25%)'}
                      </span>
                      <span className="font-black text-blue-600">
                        {formatCurrency(groupDeposit)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                      <span className="text-gray-700 font-semibold">Reste à payer</span>
                      <span className="font-black text-gray-900">
                        {formatCurrency(groupRemaining)} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3 text-xs sm:text-sm text-amber-800 flex items-start gap-3">
              <CheckCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              {paymentMode === 'installment'
                ? `Merci de payer le premier montant de ${formatCurrency(summaryPaidAmount)} FCFA puis de suivre l’échéancier.`
                : sellerGroups.length > 1
                ? 'Merci de payer l’acompte indiqué pour chaque vendeur avant validation.'
                : `Merci de payer exactement ${formatCurrency(depositAmount)} FCFA avant validation.`}
            </div>
            {error && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-6 py-4 text-sm sm:text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirmation...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Confirmer la commande
                </>
              )}
            </button>
          </form>
        </section>
      </div>
      </div>
    </div>
  );
}
