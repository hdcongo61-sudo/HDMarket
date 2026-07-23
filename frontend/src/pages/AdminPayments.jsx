import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const STATUS_OPTIONS = [
  { value: 'waiting', label: 'En attente' },
  { value: 'verified', label: 'Validés' },
  { value: 'rejected', label: 'Rejetés' }
];

const statusClasses = {
  waiting: 'bg-amber-50 text-amber-800',
  verified: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800'
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

export default function AdminPayments() {
  const [status, setStatus] = useState('waiting');
  const [query, setQuery] = useState('');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set('search', query.trim());
      const { data } = await api.get(`/payments/admin?${params}`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de charger les paiements.');
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timer = setTimeout(loadPayments, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPayments, query]);

  const totals = useMemo(
    () => ({
      count: payments.length,
      amount: payments.reduce(
        (sum, payment) => sum + Number(payment.amountPaid ?? payment.amount ?? 0),
        0
      )
    }),
    [payments]
  );

  const decide = async (paymentId, action) => {
    setPendingId(String(paymentId));
    setError('');
    try {
      await api.put(`/payments/admin/${paymentId}/${action}`, {});
      await loadPayments();
      window.dispatchEvent(new CustomEvent('paymentStatusChanged'));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de traiter ce paiement.');
    } finally {
      setPendingId('');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/admin"
              className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Administration
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Vérification des paiements</h1>
            <p className="mt-1 text-sm text-gray-500">
              Paiements Mobile Money et confirmations PawaPay des annonces.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <article className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-400">Paiements affichés</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{totals.count}</p>
          </article>
          <article className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-400">Montant</p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {formatPriceWithStoredSettings(totals.amount)}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${
                    status === option.value
                      ? 'bg-[#e85d00] text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher…"
                className="min-w-0 border-0 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          <div className="mt-4 divide-y divide-gray-100">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-500">Chargement…</p>
            ) : payments.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Aucun paiement dans cette file.</p>
            ) : (
              payments.map((payment) => {
                const id = payment._id || payment.id;
                const paymentStatus = String(payment.status || status).toLowerCase();
                return (
                  <article key={id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black text-slate-950">
                          {payment.product?.title || 'Frais d’annonce'}
                        </p>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClasses[paymentStatus] || statusClasses.waiting}`}>
                          {STATUS_OPTIONS.find((item) => item.value === paymentStatus)?.label || paymentStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {payment.payerName || 'Payeur'} · {payment.paymentMethod === 'pawapay' ? 'PawaPay' : payment.operator || 'Mobile Money'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{formatDate(payment.createdAt)}</p>
                    </div>
                    <p className="text-lg font-black text-slate-950">
                      {formatPriceWithStoredSettings(payment.amountPaid ?? payment.amount ?? 0)}
                    </p>
                    {paymentStatus === 'waiting' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pendingId === String(id)}
                          onClick={() => decide(id, 'verify')}
                          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Valider
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === String(id)}
                          onClick={() => decide(id, 'reject')}
                          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Refuser
                        </button>
                      </div>
                    ) : (
                      <Clock3 className="h-5 w-5 text-gray-300" />
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
