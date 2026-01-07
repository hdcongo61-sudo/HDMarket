import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { CreditCard, ShieldCheck, CheckCircle, ClipboardList } from 'lucide-react';

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
      showToast('Commande confirmée. Merci pour votre acompte.', { variant: 'success' });
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

  if (!items.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <ClipboardList size={20} />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Votre panier est vide</h1>
        <p className="mt-2 text-sm text-gray-500">
          Ajoutez des produits avant de confirmer une commande.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Explorer le marché
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Confirmer votre commande</h1>
        <p className="text-sm text-gray-500">
          Un acompte de 25% est requis pour confirmer votre commande.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Résumé</h2>
          <div className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => (
              <div key={product._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{product.title}</p>
                  <p className="text-xs text-gray-500">x{quantity}</p>
                  <p className="text-xs text-gray-500">
                    Téléphone vendeur:{' '}
                    {product.user?.phone || product.contactPhone || '—'}
                  </p>
                </div>
                <span className="font-semibold text-gray-700">
                  {formatCurrency(lineTotal)} FCFA
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Total commande</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(totals.subtotal)} FCFA
              </span>
            </div>
            <div className="flex justify-between">
              <span>Acompte (25%)</span>
              <span className="font-semibold text-indigo-600">
                {formatCurrency(depositAmount)} FCFA
              </span>
            </div>
            <div className="flex justify-between">
              <span>Reste à payer</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(remainingAmount)} FCFA
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-700 flex items-start gap-2">
            <ShieldCheck size={16} />
            <span>
              Le paiement de l’acompte confirme la commande. Le solde sera réglé à la livraison.
            </span>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Paiement</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {sellerGroups.map((group) => {
              const payment = payments[group.sellerId] || {};
              const groupDeposit = Math.round(Number(group.subtotal || 0) * 0.25);
              const groupRemaining = Math.max(0, Number(group.subtotal || 0) - groupDeposit);
              return (
                <div
                  key={group.sellerId}
                  className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-gray-500">Paiement vendeur</p>
                      <p className="text-sm font-semibold text-gray-900">{group.sellerName}</p>
                      {group.sellerPhone && (
                        <p className="text-xs text-gray-500">Téléphone : {group.sellerPhone}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="text-sm font-semibold text-indigo-600">
                        {formatCurrency(groupDeposit)} FCFA
                      </p>
                      <p>Acompte (25%)</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Nom du payeur
                    </label>
                    <input
                      type="text"
                      value={payment.payerName || ''}
                      onChange={(e) =>
                        handlePaymentChange(group.sellerId, 'payerName', e.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder={user?.name || 'Ex: Jean K.'}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Code transaction
                    </label>
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-indigo-500">
                      <CreditCard size={14} className="text-gray-400" />
                      <input
                        type="text"
                        value={payment.transactionCode || ''}
                        onChange={(e) =>
                          handlePaymentChange(group.sellerId, 'transactionCode', e.target.value)
                        }
                        className="w-full border-none p-0 text-sm focus:outline-none"
                        placeholder="Ex: TRX123456"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Sous-total vendeur</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(group.subtotal)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Acompte (25%)</span>
                      <span className="font-semibold text-indigo-700">
                        {formatCurrency(groupDeposit)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reste à payer</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(groupRemaining)} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
              <CheckCircle size={14} />
              {sellerGroups.length > 1
                ? 'Merci de payer l’acompte indiqué pour chaque vendeur avant validation.'
                : `Merci de payer exactement ${formatCurrency(depositAmount)} FCFA avant validation.`}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Confirmation...' : 'Confirmer la commande'}
            </button>
            <Link to="/cart" className="block text-center text-sm text-gray-500 hover:text-gray-700">
              Retour au panier
            </Link>
          </form>
        </section>
      </div>
    </div>
  );
}
