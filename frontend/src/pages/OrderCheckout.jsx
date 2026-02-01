import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { CreditCard, ShieldCheck, CheckCircle, ClipboardList, ArrowLeft, ShoppingBag, Lock, AlertCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const totals = cart.totals || { subtotal: 0, quantity: 0 };
  const depositAmount = useMemo(() => Math.round((totals.subtotal || 0) * 0.25), [totals.subtotal]);
  const remainingAmount = Math.max(0, Number(totals.subtotal || 0) - depositAmount);

  const items = cart.items || [];
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

  useEffect(() => {
    setPayments((prev) => {
      const next = {};
      sellerGroups.forEach((group) => {
        const key = group.sellerId;
        const existing = prev[key] || {};
        next[key] = {
          payerName: existing.payerName ?? user?.name ?? '',
          transactionCode: existing.transactionCode ?? ''
        };
      });
      return next;
    });
  }, [sellerGroups, user?.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!items.length) {
      setError('Votre panier est vide.');
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
    setLoading(true);
    setError('');
    try {
      await api.post('/orders/checkout', {
        payments: sellerGroups.map((group) => {
          const entry = payments[group.sellerId] || {};
          return {
            sellerId: group.sellerId,
            payerName: entry.payerName.trim(),
            transactionCode: entry.transactionCode.trim()
          };
        })
      });
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
    setPayments((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] || {}),
        [field]: value
      }
    }));
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
                  draftPayments[String(payment.sellerId)] = {
                    payerName: payment.payerName || '',
                    transactionCode: payment.transactionCode || ''
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
    if (!user || !items.length || loading || orderConfirmed) return;

    const saveDraft = async () => {
      try {
        const paymentsArray = sellerGroups.map((group) => {
          const entry = payments[group.sellerId] || {};
          return {
            sellerId: group.sellerId,
            payerName: entry.payerName?.trim() || '',
            transactionCode: entry.transactionCode?.trim() || ''
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
  }, [user, items.length, sellerGroups, payments, loading, orderConfirmed]);

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
            Un acompte de 25% est requis pour confirmer votre commande.
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
                {formatCurrency(totals.subtotal)} FCFA
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="text-blue-700 font-semibold">Acompte (25%)</span>
              <span className="font-black text-blue-600 text-lg">
                {formatCurrency(depositAmount)} FCFA
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-semibold">Reste à payer</span>
              <span className="font-black text-gray-900 text-lg">
                {formatCurrency(remainingAmount)} FCFA
              </span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-xs sm:text-sm text-blue-800 flex items-start gap-3">
            <ShieldCheck size={16} />
            <span>
              Le paiement de l’acompte confirme la commande. Le solde sera réglé à la livraison.
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
            {sellerGroups.map((group) => {
              const payment = payments[group.sellerId] || {};
              const groupDeposit = Math.round(Number(group.subtotal || 0) * 0.25);
              const groupRemaining = Math.max(0, Number(group.subtotal || 0) - groupDeposit);
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
                      <p className="text-xs text-gray-600 font-medium">Acompte (25%)</p>
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
                    
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                        Code transaction
                      </label>
                      <div className="flex items-center gap-3 rounded-3xl border-2 border-gray-300 px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                        <CreditCard size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={payment.transactionCode || ''}
                          onChange={(e) =>
                            handlePaymentChange(group.sellerId, 'transactionCode', e.target.value)
                          }
                          className="w-full border-none p-0 text-sm font-medium focus:outline-none"
                          placeholder="ID de votre transaction Mobile Money"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold">Sous-total vendeur</span>
                      <span className="font-black text-gray-900">
                        {formatCurrency(group.subtotal)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 font-semibold">Acompte (25%)</span>
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
              {sellerGroups.length > 1
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
