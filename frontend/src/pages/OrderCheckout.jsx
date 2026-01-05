import React, { useContext, useMemo, useState } from 'react';
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
  const [payerName, setPayerName] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totals = cart.totals || { subtotal: 0, quantity: 0 };
  const depositAmount = useMemo(() => Math.round((totals.subtotal || 0) * 0.25), [totals.subtotal]);
  const remainingAmount = Math.max(0, Number(totals.subtotal || 0) - depositAmount);

  const items = cart.items || [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!payerName.trim() || !transactionCode.trim()) {
      setError('Veuillez renseigner le nom et le code de transaction.');
      return;
    }
    if (!items.length) {
      setError('Votre panier est vide.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/orders/checkout', {
        payerName: payerName.trim(),
        transactionCode: transactionCode.trim()
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
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Nom du payeur</label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={user?.name || 'Ex: Jean K.'}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Code transaction</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-indigo-500">
                <CreditCard size={14} className="text-gray-400" />
                <input
                  type="text"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                  className="w-full border-none p-0 text-sm focus:outline-none"
                  placeholder="Ex: TRX123456"
                />
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
              <CheckCircle size={14} />
              Merci de payer exactement {formatCurrency(depositAmount)} FCFA avant validation.
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
