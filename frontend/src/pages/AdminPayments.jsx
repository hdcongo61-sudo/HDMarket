import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';
import { buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatCurrency = (value) => formatPriceWithStoredSettings(value);
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

const paymentStatusLabels = {
  waiting: 'En attente',
  verified: 'Validé',
  rejected: 'Rejeté'
};

const paymentStatusStyles = {
  waiting: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const PAYMENTS_PER_PAGE = 12;
const getPaymentSortTimestamp = (payment) => {
  const candidates = [
    payment?.updatedAt,
    payment?.createdAt,
    payment?.product?.updatedAt,
    payment?.product?.createdAt
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return 0;
};
const paymentFilterOptions = [
  { value: 'waiting', label: 'En attente' },
  { value: 'verified', label: 'Validés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'disabled_products', label: 'Annonces désactivées' }
];

export default function AdminPayments() {
  const { user } = useContext(AuthContext);
  const isManager = user?.role === 'manager';

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [filter, setFilter] = useState('waiting');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const externalLinkProps = useDesktopExternalLink();
  const isMobileView = useIsMobile(1023);

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return url;
      const cleaned = url.replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
      setStatsError('');
    } catch (e) {
      setStatsError(e.response?.data?.message || e.message || 'Impossible de charger les statistiques.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams();
      if (['waiting', 'verified', 'rejected'].includes(filter)) {
        params.append('status', filter);
      }
      if (searchValue) {
        params.append('search', searchValue);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }
      const { data } = await api.get(params.toString() ? `/payments/admin?${params}` : '/payments/admin');

      let normalized = Array.isArray(data)
        ? data.map((payment) => ({
            ...payment,
            product: payment.product
              ? {
                  ...payment.product,
                  images: Array.isArray(payment.product.images)
                    ? payment.product.images.map(normalizeUrl)
                    : undefined
                }
              : payment.product
          }))
        : [];

      if (filter === 'disabled_products') {
        normalized = normalized.filter((item) => item.product?.status === 'disabled');
      }

      normalized = normalized
        .slice()
        .sort((a, b) => getPaymentSortTimestamp(b) - getPaymentSortTimestamp(a));

      setPayments(normalized);
      setPage((prev) => {
        const totalPages = Math.max(1, Math.ceil(normalized.length / PAYMENTS_PER_PAGE));
        return Math.min(prev, totalPages);
      });
    } catch (e) {
      setPaymentsError(e.response?.data?.message || e.message || 'Impossible de charger les paiements.');
    } finally {
      setPaymentsLoading(false);
    }
  }, [filter, normalizeUrl, searchValue, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Listen for payment status changes from other pages
  useEffect(() => {
    const handlePaymentStatusChange = () => {
      loadPayments();
      loadStats();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPayments();
        loadStats();
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
  }, [loadPayments, loadStats]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchValue(searchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [filter, searchValue, startDate, endDate]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAYMENTS_PER_PAGE;
    return payments.slice(start, start + PAYMENTS_PER_PAGE);
  }, [payments, page]);

  const totalPages = Math.max(1, Math.ceil(payments.length / PAYMENTS_PER_PAGE));


  const handlePaymentDecision = useCallback(
    async (id, type) => {
      if (!id) return;
      setActionLoading(true);
      setActionMessage('');
      setActionError('');
      try {
        await api.put(`/payments/admin/${id}/${type === 'verify' ? 'verify' : 'reject'}`);
        await Promise.all([loadPayments(), loadStats()]);
        setActionMessage(type === 'verify' ? 'Paiement validé avec succès.' : 'Paiement rejeté.');
        
        // Emit custom event to notify other pages
        window.dispatchEvent(new CustomEvent('paymentStatusChanged', {
          detail: { paymentId: id, status: type === 'verify' ? 'verified' : 'rejected' }
        }));
      } catch (e) {
        setActionError(e.response?.data?.message || e.message || 'Action impossible sur ce paiement.');
      } finally {
        setActionLoading(false);
      }
    },
    [loadPayments, loadStats]
  );

  const handleDisableListing = useCallback(
    async (productIdentifier) => {
      if (!productIdentifier) return;
      setActionLoading(true);
      setActionMessage('');
      setActionError('');
      try {
        await api.patch(`/products/${productIdentifier}/disable`);
        await loadPayments();
        setActionMessage("Annonce désactivée avec succès.");
      } catch (e) {
        setActionError(e.response?.data?.message || e.message || "Impossible de désactiver l'annonce.");
      } finally {
        setActionLoading(false);
      }
    },
    [loadPayments]
  );

  const handleEnableListing = useCallback(
    async (productIdentifier) => {
      if (!productIdentifier) return;
      setActionLoading(true);
      setActionMessage('');
      setActionError('');
      try {
        await api.patch(`/products/${productIdentifier}/enable`);
        await loadPayments();
        setActionMessage('Annonce réactivée avec succès.');
      } catch (e) {
        setActionError(e.response?.data?.message || e.message || "Impossible de réactiver l'annonce.");
      } finally {
        setActionLoading(false);
      }
    },
    [loadPayments]
  );

  const handleCopyReference = useCallback(async (reference) => {
    if (!reference) return;
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API indisponible.');
      }
      await navigator.clipboard.writeText(reference);
      setActionMessage('Référence copiée dans le presse-papiers.');
      setActionError('');
    } catch (e) {
      setActionError("Impossible de copier la référence.");
      setActionMessage('');
    }
  }, []);

  useEffect(() => {
    if (!actionMessage && !actionError) return;
    const timer = setTimeout(() => {
      setActionMessage('');
      setActionError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [actionMessage, actionError]);

  const paymentSummary = stats?.payments || {};

  const computeWindowStats = useCallback(
    (days) => {
      const now = Date.now();
      const windowStart = now - days * 24 * 60 * 60 * 1000;
      let count = 0;
      let amount = 0;
      payments.forEach((payment) => {
        const created = Date.parse(payment.createdAt);
        if (!Number.isNaN(created) && created >= windowStart) {
          count += 1;
          amount += Number(payment.amount || 0);
        }
      });
      return { count, amount };
    },
    [payments]
  );

  const dayStats = useMemo(() => computeWindowStats(1), [computeWindowStats]);
  const weekStats = useMemo(() => computeWindowStats(7), [computeWindowStats]);
  const monthStats = useMemo(() => computeWindowStats(30), [computeWindowStats]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isManager ? 'Gestionnaire — Paiements' : 'Administration — Paiements'}
          </h1>
          <p className="text-sm text-gray-600">
            Suivez l’état des transactions et traitez les preuves de paiement.
          </p>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Retour au tableau de bord
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(paymentSummary.total)}</p>
          <p className="text-xs text-gray-500 mt-1">Paiements enregistrés</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">En attente</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatNumber(paymentSummary.waiting)}</p>
          <p className="text-xs text-gray-500 mt-1">À vérifier</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Validés</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatNumber(paymentSummary.verified)}</p>
          <p className="text-xs text-gray-500 mt-1">Mises en ligne confirmées</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Revenus cumulés</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(paymentSummary.revenue)}</p>
          <p className="text-xs text-gray-500 mt-1">Toutes commissions</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">24 heures</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(dayStats.count)} paiements</p>
          <p className="text-xs text-gray-500 mt-1">Montant : {formatCurrency(dayStats.amount)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">7 jours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(weekStats.count)} paiements</p>
          <p className="text-xs text-gray-500 mt-1">Montant : {formatCurrency(weekStats.amount)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">30 jours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(monthStats.count)} paiements</p>
          <p className="text-xs text-gray-500 mt-1">Montant : {formatCurrency(monthStats.amount)}</p>
        </div>
      </section>

      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statsError}</div>
      )}
      {statsLoading && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Chargement des statistiques…
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Liste des paiements</h2>
            <p className="text-xs text-gray-500">
              Utilisez les filtres pour trouver rapidement un produit ou une transaction.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 w-full md:w-auto">
            {isMobileView ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {paymentFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      filter === option.value
                        ? 'bg-indigo-600 text-white shadow'
                        : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label htmlFor="payments-status-filter" className="text-sm text-gray-600">
                  Statut&nbsp;:
                </label>
                <select
                  id="payments-status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {paymentFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-full sm:w-64">
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Rechercher un produit…"
                className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor="start-date" className="text-sm text-gray-600">
                  Du
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="end-date" className="text-sm text-gray-600">
                  Au
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {paymentsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentsError}</div>
        )}
        {actionMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {isMobileView ? (
          <div className="space-y-4">
            {paymentsLoading ? (
              <p className="text-sm text-gray-500">Chargement des paiements…</p>
            ) : paginatedPayments.length ? (
              paginatedPayments.map((payment) => (
                <article
                  key={payment._id || payment.id}
                  className="space-y-3 rounded-2xl border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{payment.product?.title || 'Produit inconnu'}</p>
                      <p className="text-xs text-gray-500">#{payment.product?._id || '—'}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        paymentStatusStyles[payment.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {paymentStatusLabels[payment.status] || payment.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Prix de l’annonce : {payment.product?.price ? formatCurrency(payment.product.price) : '—'}</p>
                    <p>
                      Payeur : <span className="font-semibold text-gray-900">{payment.payerName || '—'}</span>
                    </p>
                    <p>Email : {payment.user?.email || '—'}</p>
                    <p>Opérateur : {payment.operator || '—'}</p>
                    {payment.promoCodeValue ? (
                      <p className="text-emerald-700">Code promo : {payment.promoCodeValue}</p>
                    ) : null}
                    <p className="font-semibold text-gray-900">
                      Montant reçu : {formatCurrency(payment.amount)}
                    </p>
                    <p>Commission due : {formatCurrency(payment.commissionDueAmount ?? payment.amount)}</p>
                    {payment.status === 'verified' && payment.validatedBy ? (
                      <p className="text-xs text-green-600">
                        Validé par {payment.validatedBy.name}
                        {payment.validatedAt ? ` · ${formatDateTime(payment.validatedAt)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  {payment.product?.images?.length ? (
                    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-100 p-2">
                      {payment.product.images.slice(0, 4).map((src, idx) => (
                        <a key={src || idx} href={src} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img
                            src={src}
                            alt={`${payment.product?.title || 'Produit'} ${idx + 1}`}
                            className="h-16 w-20 rounded-lg border object-cover shadow-sm"
                            loading="lazy"
                          />
                        </a>
                      ))}
                      {payment.product.images.length > 4 && (
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          +{payment.product.images.length - 4} autres
                        </span>
                      )}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {payment.product && (
                      <Link
                        to={buildProductPath(payment.product)}
                        {...externalLinkProps}
                        className="flex-1 min-w-[150px] rounded-lg border border-indigo-200 px-3 py-2 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Voir l&apos;annonce
                      </Link>
                    )}
                    {payment.transactionNumber ? (
                      <button
                        type="button"
                        onClick={() => handleCopyReference(payment.transactionNumber)}
                        className="flex-1 min-w-[150px] rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Copier la référence
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payment.product?._id && payment.product?.status !== 'disabled' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDisableListing(payment.product?.slug || payment.product?._id)
                        }
                        className="flex-1 min-w-[150px] rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        disabled={actionLoading}
                      >
                        Désactiver l&apos;annonce
                      </button>
                    )}
                    {payment.product?._id && payment.product?.status === 'disabled' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleEnableListing(payment.product?.slug || payment.product?._id)
                        }
                        className="flex-1 min-w-[150px] rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
                        disabled={actionLoading}
                      >
                        Activer l&apos;annonce
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payment.status === 'waiting' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePaymentDecision(payment._id || payment.id, 'verify')}
                          className="flex-1 min-w-[150px] rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          disabled={actionLoading}
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePaymentDecision(payment._id || payment.id, 'reject')}
                          className="flex-1 min-w-[150px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          disabled={actionLoading}
                        >
                          Refuser
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">Action non disponible pour ce paiement.</span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-gray-500">Aucun paiement à afficher avec ces critères.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border text-left">Annonce</th>
                  <th className="p-2 border text-left">Prix</th>
                  <th className="p-2 border text-left">Payeur</th>
                  <th className="p-2 border text-left">Opérateur</th>
                  <th className="p-2 border text-left">Montant</th>
                  <th className="p-2 border text-left">Validé par</th>
                  <th className="p-2 border text-left">Statut</th>
                  <th className="p-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-sm text-gray-500">
                      Chargement des paiements…
                    </td>
                  </tr>
                ) : paginatedPayments.length ? (
                  paginatedPayments.map((payment) => (
                    <tr key={payment._id || payment.id}>
                      <td className="p-2 border align-top">
                        <p className="font-semibold text-gray-900">{payment.product?.title || 'Produit inconnu'}</p>
                        <p className="text-xs text-gray-500">#{payment.product?._id || '—'}</p>
                      </td>
                      <td className="p-2 border align-top">
                        {payment.product?.price ? formatCurrency(payment.product.price) : '—'}
                      </td>
                      <td className="p-2 border align-top">
                        <p className="font-medium text-gray-900">{payment.payerName || '—'}</p>
                        <p className="text-xs text-gray-500">{payment.user?.email}</p>
                        {payment.promoCodeValue ? (
                          <p className="text-xs text-emerald-700 font-semibold">{payment.promoCodeValue}</p>
                        ) : null}
                      </td>
                      <td className="p-2 border align-top">{payment.operator || '—'}</td>
                      <td className="p-2 border align-top">
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-gray-500">
                          Due: {formatCurrency(payment.commissionDueAmount ?? payment.amount)}
                        </p>
                      </td>
                      <td className="p-2 border align-top">
                        {payment.status === 'verified' && payment.validatedBy ? (
                          <div>
                            <p className="font-medium text-gray-900">{payment.validatedBy.name}</p>
                            {payment.validatedAt && (
                              <p className="text-xs text-gray-500">{formatDateTime(payment.validatedAt)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-2 border align-top">
                        <span
                          className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${
                            paymentStatusStyles[payment.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {paymentStatusLabels[payment.status] || payment.status}
                        </span>
                      </td>
                      <td className="p-2 border align-top">
                        <div className="flex flex-wrap gap-2">
                          {payment.product && (
                            <Link
                              to={buildProductPath(payment.product)}
                              {...externalLinkProps}
                              className="rounded border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                            >
                              Voir l&apos;annonce
                            </Link>
                          )}
                          {payment.transactionNumber ? (
                            <button
                              type="button"
                              onClick={() => handleCopyReference(payment.transactionNumber)}
                              className="rounded border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Copier la référence
                            </button>
                          ) : null}
                          {payment.product?.status !== 'disabled' && payment.product && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDisableListing(payment.product?.slug || payment.product?._id)
                              }
                              className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              disabled={actionLoading}
                            >
                              Désactiver
                            </button>
                          )}
                          {payment.product?.status === 'disabled' && payment.product && (
                            <button
                              type="button"
                              onClick={() =>
                                handleEnableListing(payment.product?.slug || payment.product?._id)
                              }
                              className="rounded border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
                              disabled={actionLoading}
                            >
                              Activer
                            </button>
                          )}
                          {payment.status === 'waiting' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePaymentDecision(payment._id || payment.id, 'verify')}
                                className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                disabled={actionLoading}
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePaymentDecision(payment._id || payment.id, 'reject')}
                                className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                disabled={actionLoading}
                              >
                                Refuser
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 self-center">Action indisponible</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-sm text-gray-500">
                      Aucun paiement à afficher avec ces critères.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {payments.length > PAYMENTS_PER_PAGE && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Affichage {(page - 1) * PAYMENTS_PER_PAGE + 1}-
              {Math.min(page * PAYMENTS_PER_PAGE, payments.length)} sur {payments.length} paiements
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="font-medium text-gray-700">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
