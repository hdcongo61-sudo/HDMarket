import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, Search, DollarSign, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const operatorColors = {
  MTN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Airtel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Moov: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export default function PaymentVerification() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionId, setActionId] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'waiting');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const { data } = await api.get(`/payments/admin?${params.toString()}`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load payments error:', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Listen for payment status changes from other pages
  useEffect(() => {
    const handlePaymentStatusChange = () => {
      loadPayments();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPayments();
      }
    };

    window.addEventListener('paymentStatusChanged', handlePaymentStatusChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handlePaymentStatusChange);
    
    return () => {
      window.removeEventListener('paymentStatusChanged', handlePaymentStatusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handlePaymentStatusChange);
    };
  }, [loadPayments]);

  const handleVerify = async (paymentId) => {
    if (!confirm('Voulez-vous vérifier ce paiement ? Le produit sera approuvé.')) return;

    setActionId(paymentId);
    try {
      await api.put(`/payments/admin/${paymentId}/verify`);
      alert('Paiement vérifié avec succès');
      await loadPayments();
      
      // Emit custom event to notify other pages
      window.dispatchEvent(new CustomEvent('paymentStatusChanged', {
        detail: { paymentId, status: 'verified' }
      }));
    } catch (err) {
      console.error('Verify payment error:', err);
      alert(err.response?.data?.message || 'Erreur lors de la vérification');
    } finally {
      setActionId('');
    }
  };

  const handleReject = async (paymentId) => {
    if (!confirm('Voulez-vous rejeter ce paiement ? Le produit sera rejeté.')) return;

    setActionId(paymentId);
    try {
      await api.put(`/payments/admin/${paymentId}/reject`);
      alert('Paiement rejeté');
      await loadPayments();
      
      // Emit custom event to notify other pages
      window.dispatchEvent(new CustomEvent('paymentStatusChanged', {
        detail: { paymentId, status: 'rejected' }
      }));
    } catch (err) {
      console.error('Reject payment error:', err);
      alert(err.response?.data?.message || 'Erreur lors du rejet');
    } finally {
      setActionId('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Vérification des paiements
            </h1>
            {payments.length > 0 && (
              <div className="relative">
                <div className="absolute -top-2 -right-2 flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg border-2 border-white dark:border-gray-800 animate-pulse">
                  {payments.length > 99 ? '99+' : payments.length}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-gray-600 dark:text-gray-400">
              {payments.length} paiement{payments.length !== 1 ? 's' : ''} en attente de vérification
            </p>
            {payments.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Action requise
              </span>
            )}
          </div>
        </header>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Payments list */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4">
                <div className="h-4 w-2/3 rounded bg-gray-200 mb-3" />
                <div className="h-3 w-full rounded bg-gray-200 mb-2" />
                <div className="h-3 w-4/5 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucun paiement en attente de vérification.
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <article
                key={payment._id}
                className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Product image */}
                  {payment.product?.images?.[0] && (
                    <div className="w-full lg:w-32 h-32 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                      <img
                        src={payment.product.images[0]}
                        alt={payment.product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Payment info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {payment.product?.title || 'Produit supprimé'}
                          </h3>
                          {payment.product?.slug && (
                            <Link
                              to={`/product/${payment.product.slug}`}
                              target="_blank"
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Voir le produit"
                            >
                              <ExternalLink size={16} />
                            </Link>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Payeur:</span>{' '}
                            <span className="font-semibold text-gray-900 dark:text-white">{payment.payerName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Vendeur:</span>{' '}
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {payment.user?.name || 'Utilisateur inconnu'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Transaction:</span>{' '}
                            <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                              {payment.transactionNumber}
                            </span>
                          </div>
                          {payment.promoCodeValue && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Code promo:</span>{' '}
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                {payment.promoCodeValue}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Opérateur:</span>{' '}
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${operatorColors[payment.operator] || operatorColors.Other}`}>
                              {payment.operator}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Montant payé:</span>{' '}
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Commission due:</span>{' '}
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(payment.commissionDueAmount ?? payment.amount)}
                            </span>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Prix produit:</span>{' '}
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(payment.product?.price)}
                            </span>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Soumis le {formatDateTime(payment.submittedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleVerify(payment._id)}
                        disabled={actionId === payment._id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {actionId === payment._id ? 'Vérification...' : 'Vérifier'}
                      </button>
                      <button
                        onClick={() => handleReject(payment._id)}
                        disabled={actionId === payment._id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-95 transition-all disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" />
                        {actionId === payment._id ? 'Rejet...' : 'Rejeter'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
