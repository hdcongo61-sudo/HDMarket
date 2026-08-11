import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  WalletCards
} from 'lucide-react';
import api from '../services/api';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { buildProductPath } from '../utils/links';

const STATUS_LABELS = {
  CREATED: 'Créé',
  WAITING_PAYMENT: 'En attente de paiement',
  PROCESSING: 'En traitement',
  COMPLETED: 'Payé',
  FAILED: 'Refusé / échoué',
  EXPIRED: 'Expiré',
  CANCELLED: 'Annulé'
};

const STATUS_TONES = {
  CREATED: 'bg-gray-100 text-gray-600',
  WAITING_PAYMENT: 'bg-amber-50 text-amber-700',
  PROCESSING: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500'
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

export const getCheckoutAdminPath = (checkout) => {
  const orderId = checkout?.completionResult?.orderIds?.[0];
  if (orderId) return `/admin/orders?orderId=${encodeURIComponent(String(orderId))}`;
  if (String(checkout?.purpose || '').toUpperCase() === 'LISTING_FEE_FUNDING') {
    const product = checkout?.product || checkout?.completionResult?.entityId;
    if (product) return buildProductPath(product);
  }
  const kind = String(checkout?.actionContext?.kind || checkout?.completionResult?.actionKind || '');
  if (kind.includes('BOOST')) return '/admin/product-boosts';
  if (kind.includes('SHOP_CONVERSION')) return '/admin/users';
  if (kind.includes('GLOBAL_NOTIFICATION')) return '/admin/global-notifications';
  if (kind.includes('PARCEL')) return '/admin/parcel-requests';
  if (kind.includes('BUY_FOR_ME')) return '/admin/buy-for-me';
  if (kind.includes('ORDER') || kind.includes('INSTALLMENT') || kind.includes('SPONSORSHIP')) return '/admin/orders';
  return checkout?.completionResult?.successPath || '';
};

export default function AdminPawaPayCenter() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionPending, setActionPending] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/payments/pawapay/admin/overview');
      setOverview(data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de charger le centre PawaPay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runCheckoutAction = async (checkout, action) => {
    const checkoutId = String(checkout?.checkoutId || '');
    if (!checkoutId || actionPending) return;
    const pendingKey = `${checkoutId}:${action}`;
    setActionPending(pendingKey);
    setActionMessage(null);
    try {
      const suffix = action === 'retry' ? 'retry-completion' : 'refresh';
      const { data } = await api.post(
        `/payments/pawapay/admin/checkouts/${encodeURIComponent(checkoutId)}/${suffix}`
      );
      setActionMessage({ tone: 'success', text: data?.message || 'Action terminée.' });
      await load();
    } catch (requestError) {
      setActionMessage({
        tone: 'error',
        text: requestError?.response?.data?.message || 'Impossible d’exécuter cette action.'
      });
    } finally {
      setActionPending('');
    }
  };

  const renderCheckoutActions = (checkout) => {
    const checkoutId = String(checkout?.checkoutId || '');
    const isProviderPending = ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'].includes(checkout?.status);
    const canRetryCompletion =
      checkout?.status === 'COMPLETED' && checkout?.autoValidationState === 'FAILED';
    const destination = getCheckoutAdminPath(checkout);
    const destinationLabel = destination.startsWith('/product/') ? 'Voir produit' : 'Voir le résultat';
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
        {isProviderPending && (
          <button
            type="button"
            onClick={() => runCheckoutAction(checkout, 'refresh')}
            disabled={Boolean(actionPending)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${actionPending === `${checkoutId}:refresh` ? 'animate-spin' : ''}`} />
            Vérifier PawaPay
          </button>
        )}
        {canRetryCompletion && (
          <button
            type="button"
            onClick={() => runCheckoutAction(checkout, 'retry')}
            disabled={Boolean(actionPending)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-black text-white disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${actionPending === `${checkoutId}:retry` ? 'animate-spin' : ''}`} />
            Relancer la finalisation
          </button>
        )}
        {destination && checkout?.autoValidationState === 'COMPLETED' && (
          <Link to={destination} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">
            <ExternalLink className="h-3.5 w-3.5" /> {destinationLabel}
          </Link>
        )}
        {checkout?.status === 'COMPLETED' && checkout?.autoValidationState !== 'FAILED' && (
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paiement confirmé
          </span>
        )}
        {checkout?.status === 'FAILED' && (
          <span className="inline-flex min-h-9 items-center rounded-lg bg-red-50 px-3 text-xs font-black text-red-700">
            Refusé ou échoué par PawaPay
          </span>
        )}
      </div>
    );
  };

  const statusCounts = overview?.statusCounts || {};
  const statusOrder = ['WAITING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'CREATED'];

  return (
    <main className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/admin/payment-verification"
              className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Vérification des paiements
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Centre PawaPay</h1>
            <p className="mt-1 text-sm text-gray-500">
              Vue admin/fondateur sur les encaissements, files d’attente et mouvements PawaPay.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/complaints" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700">
              <RotateCcw className="h-4 w-4" /> Remboursements
            </Link>
            <Link to="/admin/seller-payouts" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700">
              <WalletCards className="h-4 w-4" /> Versements
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
        ) : null}
        {actionMessage ? (
          <p className={`rounded-2xl border p-4 text-sm font-semibold ${actionMessage.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
            {actionMessage.text}
          </p>
        ) : null}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <article className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-400">Total encaissé</p>
            <p className="mt-2 text-xl font-black text-slate-950">
              {formatCurrency(overview?.completed?.total || 0)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{overview?.completed?.count || 0} paiements</p>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Solde à collecter (COD)</p>
            <p className="mt-2 text-xl font-black text-amber-900">
              {formatCurrency(overview?.outstandingBalance?.total || 0)}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">{overview?.outstandingBalance?.count || 0} commandes partielles</p>
          </article>
          <article className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-bold uppercase text-red-700">Échecs de finalisation</p>
            <p className="mt-2 text-xl font-black text-red-900">{overview?.failedCompletions?.length || 0}</p>
            <p className="mt-0.5 text-xs text-red-700">Payé, commande non créée</p>
          </article>
          <article className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-400">En file d’attente</p>
            <p className="mt-2 text-xl font-black text-slate-950">{overview?.stuckCheckouts?.length || 0}</p>
            <p className="mt-0.5 text-xs text-gray-400">Bloqués depuis &gt; 15 min</p>
          </article>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase text-gray-400">Répartition par statut</p>
          <div className="flex flex-wrap gap-2">
            {statusOrder
              .filter((status) => statusCounts[status])
              .map((status) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_TONES[status] || 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUS_LABELS[status] || status} · {statusCounts[status].count}
                  {statusCounts[status].amount > 0 ? ` (${formatCurrency(statusCounts[status].amount)})` : ''}
                </span>
              ))}
            {statusOrder.every((status) => !statusCounts[status]) && !loading && (
              <p className="text-sm text-gray-400">Aucune donnée.</p>
            )}
          </div>
        </section>

        {overview?.failedCompletions?.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <p className="text-sm font-black text-red-700">
                Échecs de finalisation — paiement confirmé mais commande/action non créée
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {overview.failedCompletions.map((checkout) => (
                <div key={checkout._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {checkout.user?.name || 'Client'} · {checkout.user?.phone || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {checkout.actionContext?.kind || checkout.purpose} · {checkout.checkoutId}
                    </p>
                    {checkout.autoValidationError && (
                      <p className="mt-0.5 text-xs font-semibold text-red-600">{checkout.autoValidationError}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-950">{formatCurrency(checkout.amount)}</span>
                      <span className="text-xs text-gray-400">{formatDate(checkout.updatedAt)}</span>
                    </div>
                    {renderCheckoutActions(checkout)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {overview?.stuckCheckouts?.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-black text-amber-800">Paiements en attente depuis plus de 15 minutes</p>
            </div>
            <div className="divide-y divide-gray-100">
              {overview.stuckCheckouts.map((checkout) => (
                <div key={checkout._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {checkout.user?.name || 'Client'} · {checkout.user?.phone || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {checkout.actionContext?.kind || checkout.purpose} · {checkout.checkoutId}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_TONES[checkout.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABELS[checkout.status] || checkout.status}
                      </span>
                      <span className="text-sm font-black text-slate-950">{formatCurrency(checkout.amount)}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock3 className="h-3 w-3" /> {formatDate(checkout.createdAt)}
                      </span>
                    </div>
                    {renderCheckoutActions(checkout)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase text-gray-400">Mouvements récents</p>
          {loading ? (
            <p className="py-10 text-center text-sm text-gray-500">Chargement…</p>
          ) : (overview?.recentCheckouts?.length || 0) === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Aucun mouvement récent.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {overview.recentCheckouts.map((checkout) => (
                <div key={checkout._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {checkout.user?.name || 'Client'} · {checkout.user?.phone || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {checkout.actionContext?.kind || checkout.purpose} · {checkout.checkoutId}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_TONES[checkout.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABELS[checkout.status] || checkout.status}
                      </span>
                      <span className="text-sm font-black text-slate-950">{formatCurrency(checkout.amount)}</span>
                      <span className="text-xs text-gray-400">{formatDate(checkout.createdAt)}</span>
                    </div>
                    {renderCheckoutActions(checkout)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
