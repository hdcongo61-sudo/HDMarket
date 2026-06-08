import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';
import { buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import useReliableMutation from '../hooks/useReliableMutation';

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

const isLikelyImageUrl = (url = '') => /\.(avif|gif|heic|heif|jpe?g|png|webp)(?:[?#].*)?$/i.test(String(url));

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
  { value: 'disabled_products', label: 'Annonces désactivées' },
  { value: 'wallet_overview', label: 'Statistiques portefeuille' },
  { value: 'wallet_deposits', label: 'Dépôts portefeuille' },
  { value: 'wallet_withdrawals', label: 'Retraits portefeuille' }
];

const walletDepositStatusOptions = [
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Validés' },
  { value: 'failed', label: 'Refusés' }
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
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionPending, setDecisionPending] = useState({ id: '', type: '' });

  // Wallet deposit state
  const [walletDeposits, setWalletDeposits] = useState([]);
  const [walletDepositsLoading, setWalletDepositsLoading] = useState(false);
  const [walletDepositsError, setWalletDepositsError] = useState('');
  const [walletDepositPage, setWalletDepositPage] = useState(1);
  const [walletDepositTotal, setWalletDepositTotal] = useState(0);
  const [walletDepositStatus, setWalletDepositStatus] = useState('pending');
  const [walletDepositingId, setWalletDepositingId] = useState('');
  const [walletWithdrawals, setWalletWithdrawals] = useState([]);
  const [walletWithdrawalsLoading, setWalletWithdrawalsLoading] = useState(false);
  const [walletWithdrawalsError, setWalletWithdrawalsError] = useState('');
  const [walletWithdrawalPage, setWalletWithdrawalPage] = useState(1);
  const [walletWithdrawalTotal, setWalletWithdrawalTotal] = useState(0);
  const [walletWithdrawalActionId, setWalletWithdrawalActionId] = useState('');
  const [walletStats, setWalletStats] = useState(null);
  const [walletStatsLoading, setWalletStatsLoading] = useState(false);
  const [walletStatsError, setWalletStatsError] = useState('');
  const [proofPreviewUrl, setProofPreviewUrl] = useState('');
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

  const getPaymentProofUrl = useCallback(
    (payment) => {
      const url = payment?.proofImage?.url || payment?.metadata?.proofImageUrl || '';
      return url ? normalizeUrl(url) : '';
    },
    [normalizeUrl]
  );

  const getWalletProofUrls = useCallback(
    (transaction) => {
      const rawUrls = [
        ...(Array.isArray(transaction?.metadata?.proofUrls) ? transaction.metadata.proofUrls : []),
        ...(Array.isArray(transaction?.proofUrls) ? transaction.proofUrls : []),
        transaction?.metadata?.proofUrl,
        transaction?.metadata?.proofImageUrl,
        transaction?.proofUrl,
        transaction?.proofImageUrl
      ];
      return Array.from(
        new Set(
          rawUrls
            .map((url) => (typeof url === 'string' ? url.trim() : ''))
            .filter(Boolean)
            .map(normalizeUrl)
        )
      );
    },
    [normalizeUrl]
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
    if (filter === 'wallet_overview' || filter === 'wallet_deposits' || filter === 'wallet_withdrawals') {
      setPayments([]);
      setPaymentsLoading(false);
      return;
    }
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

  // ─── Wallet Deposit Review ─────────────────────────────────
  const loadWalletDeposits = useCallback(async (pageNum = 1) => {
    setWalletDepositsLoading(true);
    setWalletDepositsError('');
    try {
      const { data } = await api.get('/wallet/admin/pending-deposits', {
        params: { page: pageNum, limit: 10, status: walletDepositStatus },
        skipCache: true
      });
      setWalletDeposits(data.items || []);
      setWalletDepositTotal(data.total || 0);
      setWalletDepositPage(pageNum);
    } catch (err) {
      setWalletDepositsError('Impossible de charger les dépôts en attente.');
    } finally {
      setWalletDepositsLoading(false);
    }
  }, [walletDepositStatus]);

  const handleWalletDepositAction = async (walletId, transactionId, approved, note = '') => {
    const transactionKey = String(transactionId);
    setWalletDepositingId(String(transactionId));
    setActionNotice('');
    setActionError('');
    try {
      const endpoint = approved ? '/wallet/admin/approve-deposit' : '/wallet/admin/reject-deposit';
      const { data } = await api.post(endpoint, { walletId, transactionId, note });
      setWalletDeposits((items) => items.filter((item) => String(item._id) !== transactionKey));
      setWalletDepositTotal((total) => Math.max(0, Number(total || 0) - 1));
      setActionNotice(data?.message || (approved ? 'Dépôt validé avec succès.' : 'Dépôt refusé.'));
      window.dispatchEvent(new CustomEvent('walletTransactionChanged', { detail: { transactionId, type: 'deposit' } }));
      Promise.allSettled([loadWalletDeposits(walletDepositPage), loadWalletStats()]);
    } catch (err) {
      setActionError(err?.response?.data?.message || err?.message || 'Erreur lors de l\'opération.');
    } finally {
      setWalletDepositingId('');
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4000);
    }
  };

  useEffect(() => {
    if (filter === 'wallet_deposits') {
      loadWalletDeposits();
    }
  }, [filter, loadWalletDeposits]);

  useEffect(() => {
    if (filter === 'wallet_deposits') {
      setWalletDepositPage(1);
    }
  }, [filter, walletDepositStatus]);

  const walletDepositTotalPages = Math.max(1, Math.ceil(walletDepositTotal / 10));

  // ─── Wallet Withdrawal Review ──────────────────────────────
  const loadWalletWithdrawals = useCallback(async (pageNum = 1) => {
    setWalletWithdrawalsLoading(true);
    setWalletWithdrawalsError('');
    try {
      const { data } = await api.get('/wallet/admin/pending-withdrawals', {
        params: { page: pageNum, limit: 10 },
        skipCache: true
      });
      setWalletWithdrawals(data.items || []);
      setWalletWithdrawalTotal(data.total || 0);
      setWalletWithdrawalPage(pageNum);
    } catch (err) {
      setWalletWithdrawalsError('Impossible de charger les retraits en attente.');
    } finally {
      setWalletWithdrawalsLoading(false);
    }
  }, []);

  const handleWalletWithdrawalAction = async (walletId, transactionId, approved, note = '') => {
    const transactionKey = String(transactionId);
    setWalletWithdrawalActionId(String(transactionId));
    setActionNotice('');
    setActionError('');
    try {
      const { data } = await api.post('/wallet/admin/process-withdrawal', {
        walletId,
        transactionId,
        approved,
        note
      });
      setWalletWithdrawals((items) => items.filter((item) => String(item._id) !== transactionKey));
      setWalletWithdrawalTotal((total) => Math.max(0, Number(total || 0) - 1));
      setActionNotice(data?.message || (approved ? 'Retrait validé.' : 'Retrait refusé et montant retourné au portefeuille.'));
      window.dispatchEvent(new CustomEvent('walletTransactionChanged', { detail: { transactionId, type: 'withdrawal' } }));
      Promise.allSettled([loadWalletWithdrawals(walletWithdrawalPage), loadWalletStats()]);
    } catch (err) {
      setActionError(err?.response?.data?.message || err?.message || 'Erreur lors du traitement du retrait.');
    } finally {
      setWalletWithdrawalActionId('');
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4000);
    }
  };

  useEffect(() => {
    if (filter === 'wallet_withdrawals') {
      loadWalletWithdrawals();
    }
  }, [filter, loadWalletWithdrawals]);

  useEffect(() => {
    if (filter === 'wallet_withdrawals') {
      setWalletWithdrawalPage(1);
    }
  }, [filter]);

  const walletWithdrawalTotalPages = Math.max(1, Math.ceil(walletWithdrawalTotal / 10));
  const isWalletAdminPanel = filter === 'wallet_overview' || filter === 'wallet_deposits' || filter === 'wallet_withdrawals';

  const loadWalletStats = useCallback(async () => {
    setWalletStatsLoading(true);
    setWalletStatsError('');
    try {
      const { data } = await api.get('/wallet/admin/stats', {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      setWalletStats(data || null);
    } catch (err) {
      setWalletStatsError(err?.response?.data?.message || 'Impossible de charger les statistiques portefeuille.');
    } finally {
      setWalletStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isWalletAdminPanel) {
      loadWalletStats();
    }
  }, [isWalletAdminPanel, loadWalletStats]);


  const paymentDecisionMutation = useReliableMutation({
    mutationFn: async ({ paymentId, decisionType, idempotencyKey }) => {
      const route = decisionType === 'verify' ? 'verify' : 'reject';
      const { data } = await api.put(
        `/payments/admin/${paymentId}/${route}`,
        {},
        { silentGlobalError: true, headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    verifyFn: async ({ paymentId, decisionType }) => {
      const targetStatus = decisionType === 'verify' ? 'verified' : 'rejected';
      const { data } = await api.get(`/payments/admin?status=${targetStatus}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      const list = Array.isArray(data) ? data : [];
      return list.some((item) => String(item?._id || item?.id || '') === String(paymentId));
    },
    onMutate: ({ paymentId, decisionType }) => {
      setDecisionPending({ id: String(paymentId || ''), type: String(decisionType || '') });
      setActionMessage('');
      setActionNotice('');
      setActionError('');
    },
    onSuccess: async (result, variables) => {
      await Promise.all([loadPayments(), loadStats()]);
      const isVerify = variables?.decisionType === 'verify';
      const statusValue = isVerify ? 'verified' : 'rejected';
      const successMessage = result?.recovered
        ? isVerify
          ? 'Paiement validé (récupéré après délai réseau).'
          : 'Paiement rejeté (récupéré après délai réseau).'
        : isVerify
          ? 'Paiement validé avec succès.'
          : 'Paiement rejeté.';
      setActionMessage(successMessage);
      window.dispatchEvent(
        new CustomEvent('paymentStatusChanged', {
          detail: {
            paymentId: variables?.paymentId || '',
            status: statusValue
          }
        })
      );
    },
    onError: (error, _variables, context) => {
      if (context?.possiblyCommitted) {
        setActionNotice('Action en cours de confirmation. Le statut sera synchronisé automatiquement.');
        setActionError('');
        return;
      }
      setActionError(error?.response?.data?.message || error?.message || 'Action impossible sur ce paiement.');
    },
    onSettled: (_data, error) => {
      if (!error) {
        setDecisionPending({ id: '', type: '' });
      }
    }
  });

  const handlePaymentDecision = useCallback(
    async (id, type) => {
      if (!id || paymentDecisionMutation.isReliablePending) return;
      try {
        await paymentDecisionMutation.mutateAsync({
          paymentId: id,
          decisionType: type === 'verify' ? 'verify' : 'reject'
        });
      } catch {
        // handled by mutation callbacks
      }
    },
    [paymentDecisionMutation]
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

      {!isWalletAdminPanel && (
        <>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <p className="text-xs font-semibold text-gray-500 uppercase">Rejetés</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatNumber(paymentSummary.rejected)}</p>
          <p className="text-xs text-gray-500 mt-1">Paiements refusés</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Revenus cumulés</p>
          <p className="text-2xl font-bold text-neutral-600 mt-1">{formatCurrency(paymentSummary.revenue)}</p>
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

      {/* Always-visible filter + search bar */}
      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isWalletAdminPanel ? 'Portefeuille HDMarket' : 'Liste des paiements'}
            </h2>
            <p className="text-xs text-gray-500">
              {isWalletAdminPanel
                ? 'Traitez les dépôts et retraits du portefeuille HDMarket.'
                : 'Utilisez les filtres pour trouver rapidement un produit ou une transaction.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 w-full md:w-auto">
            {isMobileView ? (
              <div className="-mx-1 flex flex-wrap gap-2 pb-1">
                {paymentFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      filter === option.value
                        ? 'bg-neutral-600 text-white shadow'
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
                  Vue&nbsp;:
                </label>
                <select
                  id="payments-status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  {paymentFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isWalletAdminPanel && (
              <>
                <div className="w-full sm:w-64">
                  <input
                    type="search"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder="Rechercher un produit…"
                    className="w-full rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="start-date" className="text-sm text-gray-600">Du</label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="end-date" className="text-sm text-gray-600">Au</label>
                    <input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* All payment content: stats + table, hidden when wallet admin views are shown */}
        {paymentsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentsError}</div>
        )}
        {actionMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {actionMessage}
          </div>
        )}
        {actionNotice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {actionNotice}
          </div>
        )}
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {paymentDecisionMutation.uiPhase === 'stillWorking' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Traitement en cours... merci de patienter.
          </div>
        )}
        {paymentDecisionMutation.uiPhase === 'slow' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 space-y-2">
            <p>Synchronisation automatique en cours.</p>
            {decisionPending.id ? (
              <button
                type="button"
                onClick={() => handlePaymentDecision(decisionPending.id, decisionPending.type || 'verify')}
                className="rounded border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
              >
                Réessayer
              </button>
            ) : null}
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
                  {getPaymentProofUrl(payment) ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-600">Preuve de paiement</p>
                      <button
                        type="button"
                        onClick={() => setProofPreviewUrl(getPaymentProofUrl(payment))}
                        className="block cursor-zoom-in"
                      >
                        <img
                          src={getPaymentProofUrl(payment)}
                          alt="Preuve de paiement"
                          className="h-24 w-24 rounded-lg border border-gray-200 object-cover shadow-sm"
                          loading="lazy"
                        />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {payment.product && (
                      <Link
                        to={buildProductPath(payment.product)}
                        {...externalLinkProps}
                        className="flex-1 min-w-[150px] rounded-lg border border-neutral-200 px-3 py-2 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
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
                          disabled={actionLoading || paymentDecisionMutation.isReliablePending}
                        >
                          {paymentDecisionMutation.isReliablePending &&
                          String(decisionPending.id) === String(payment._id || payment.id)
                            ? 'Validation...'
                            : 'Valider'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePaymentDecision(payment._id || payment.id, 'reject')}
                          className="flex-1 min-w-[150px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          disabled={actionLoading || paymentDecisionMutation.isReliablePending}
                        >
                          {paymentDecisionMutation.isReliablePending &&
                          String(decisionPending.id) === String(payment._id || payment.id)
                            ? 'Traitement...'
                            : 'Refuser'}
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
                  <th className="p-2 border text-left">Preuve</th>
                  <th className="p-2 border text-left">Validé par</th>
                  <th className="p-2 border text-left">Statut</th>
                  <th className="p-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
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
                        {getPaymentProofUrl(payment) ? (
                          <button
                            type="button"
                            onClick={() => setProofPreviewUrl(getPaymentProofUrl(payment))}
                            className="cursor-zoom-in"
                          >
                            <img
                              src={getPaymentProofUrl(payment)}
                              alt="Preuve de paiement"
                              className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
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
                              className="rounded border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
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
                                disabled={actionLoading || paymentDecisionMutation.isReliablePending}
                              >
                                {paymentDecisionMutation.isReliablePending &&
                                String(decisionPending.id) === String(payment._id || payment.id)
                                  ? 'Validation...'
                                  : 'Valider'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePaymentDecision(payment._id || payment.id, 'reject')}
                                className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                disabled={actionLoading || paymentDecisionMutation.isReliablePending}
                              >
                                {paymentDecisionMutation.isReliablePending &&
                                String(decisionPending.id) === String(payment._id || payment.id)
                                  ? 'Traitement...'
                                  : 'Refuser'}
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
                    <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
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
        </>
      )}
      {isWalletAdminPanel && (
        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Statistiques Portefeuille HDMarket</h2>
                <p className="text-xs text-gray-500">
                  Vue admin/fondateur sur les soldes, files d’attente et mouvements du portefeuille.
                </p>
              </div>
              <button
                type="button"
                onClick={loadWalletStats}
                disabled={walletStatsLoading}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {walletStatsLoading ? 'Actualisation...' : 'Actualiser'}
              </button>
            </div>

            {walletStatsError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {walletStatsError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Solde disponible</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCurrency(walletStats?.balances?.available || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatNumber(walletStats?.wallets?.withAvailableBalance || 0)} portefeuilles avec solde
                </p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase text-amber-700">En attente</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">
                  {formatCurrency(walletStats?.balances?.pending || 0)}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Dépôts et ventes non confirmés
                </p>
              </div>
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-xs font-semibold uppercase text-orange-700">Dépôts à valider</p>
                <p className="mt-1 text-2xl font-bold text-orange-800">
                  {formatNumber(walletStats?.actionQueue?.pendingDeposits?.count || 0)}
                </p>
                <p className="mt-1 text-xs text-orange-700">
                  {formatCurrency(walletStats?.actionQueue?.pendingDeposits?.amount || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase text-red-700">Retraits à traiter</p>
                <p className="mt-1 text-2xl font-bold text-red-800">
                  {formatNumber(walletStats?.actionQueue?.pendingWithdrawals?.count || 0)}
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {formatCurrency(walletStats?.actionQueue?.pendingWithdrawals?.amount || 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Volume 30 jours</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {formatCurrency(walletStats?.volume?.last30Days?.amount || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatNumber(walletStats?.volume?.last30Days?.count || 0)} mouvements
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Aujourd’hui</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {formatCurrency(walletStats?.volume?.today?.amount || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatNumber(walletStats?.volume?.today?.count || 0)} mouvements
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Dépôts validés</p>
                <p className="mt-1 text-xl font-bold text-green-700">
                  {formatCurrency(walletStats?.completed?.deposits?.amount || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatNumber(walletStats?.completed?.deposits?.count || 0)} dépôts
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Retraits validés</p>
                <p className="mt-1 text-xl font-bold text-red-700">
                  {formatCurrency(walletStats?.completed?.withdrawals?.amount || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatNumber(walletStats?.completed?.withdrawals?.count || 0)} retraits
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Vue</span>
              <button
                type="button"
                onClick={() => setFilter('wallet_overview')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === 'wallet_overview'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Statistiques
              </button>
              <button
                type="button"
                onClick={() => setFilter('wallet_deposits')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === 'wallet_deposits'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Dépôts
              </button>
              <button
                type="button"
                onClick={() => setFilter('wallet_withdrawals')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === 'wallet_withdrawals'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Retraits
              </button>
            </div>
          </div>

          {filter === 'wallet_overview' && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Activité récente</h3>
                  <p className="text-xs text-gray-500">Derniers mouvements enregistrés dans les portefeuilles.</p>
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  {formatNumber(walletStats?.wallets?.total || 0)} portefeuilles
                </p>
              </div>
              {walletStatsLoading && !walletStats ? (
                <div className="py-8 text-center text-sm text-gray-400">Chargement des statistiques...</div>
              ) : !walletStats?.recentTransactions?.length ? (
                <div className="py-8 text-center text-sm text-gray-400">Aucune activité portefeuille à afficher.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {walletStats.recentTransactions.map((txn) => {
                    const isCredit = txn.direction === 'credit' || Number(txn.signedAmount || 0) > 0;
                    const isDebit = txn.direction === 'debit' || Number(txn.signedAmount || 0) < 0;
                    const amountPrefix = isCredit ? '+' : isDebit ? '-' : '';
                    const amountClass = isCredit ? 'text-green-700' : isDebit ? 'text-red-700' : 'text-gray-700';
                    return (
                      <div key={`${txn.walletId}-${txn._id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {txn.userName || 'Utilisateur'} · {txn.type}
                          </p>
                          <p className="text-xs text-gray-500">
                            {txn.userPhone || '—'} · {txn.status} · {formatDateTime(txn.createdAt)}
                          </p>
                        </div>
                        <p className={`text-sm font-bold ${amountClass}`}>
                          {amountPrefix}{formatCurrency(txn.displayAmount || txn.amount || 0)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {/* ─── Wallet Deposit Review Section ─────────────────── */}
      {filter === 'wallet_deposits' && (
        <>
        {/* Wallet stats row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              {walletDepositStatusOptions.find((option) => option.value === walletDepositStatus)?.label || 'Dépôts'}
            </p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{formatNumber(walletDepositTotal)}</p>
            <p className="text-xs text-gray-500 mt-1">Dépôts Portefeuille HDMarket</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Montant total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(walletDeposits.reduce((s, d) => s + Number(d.amount || 0), 0))}
            </p>
            <p className="text-xs text-gray-500 mt-1">FCFA en attente de validation</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-center">
            <Link to="/admin" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              ← Retour au tableau de bord
            </Link>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4 mt-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Portefeuille HDMarket</h2>
            <p className="text-xs text-gray-500">
              Vérifiez les preuves de paiement des dépôts portefeuille.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-gray-500">File</span>
            <button
              type="button"
              onClick={() => setFilter('wallet_overview')}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Stats
            </button>
            <button
              type="button"
              onClick={() => setFilter('wallet_deposits')}
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Dépôts
            </button>
            <button
              type="button"
              onClick={() => setFilter('wallet_withdrawals')}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Retraits
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-gray-500">Statut</span>
            {walletDepositStatusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setWalletDepositStatus(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  walletDepositStatus === option.value
                    ? 'bg-neutral-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {actionNotice && (
            <div className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">{actionNotice}</div>
          )}
          {actionError && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{actionError}</div>
          )}

          {walletDepositsLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">Chargement des dépôts...</div>
          ) : walletDepositsError ? (
            <div className="py-6 text-center text-sm text-red-500">{walletDepositsError}</div>
          ) : walletDeposits.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">Aucun dépôt Portefeuille HDMarket avec ce statut.</div>
          ) : (
            <div className="space-y-4">
              {walletDeposits.map((deposit) => {
                const proofUrls = getWalletProofUrls(deposit);
                const paymentMethod = deposit.metadata?.paymentMethod || 'other';
                const methodLabels = { orange_money: 'Orange Money', mtn_money: 'MTN Money', airtel_money: 'Airtel Money', bank_transfer: 'Virement', other: 'Autre' };

                return (
                  <div key={deposit._id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">
                          {deposit.userName || 'Utilisateur'} — {formatCurrency(deposit.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {deposit.userPhone && <span>Tél: {deposit.userPhone} · </span>}
                          {methodLabels[paymentMethod] || paymentMethod}
                        </p>
                        <p className="text-xs text-gray-500">
                          Réf: <span className="font-mono font-semibold">{deposit.reference || '—'}</span> · {formatDateTime(deposit.createdAt)}
                        </p>
                        {deposit.note && <p className="text-xs text-gray-400 italic">{deposit.note}</p>}
                      </div>
                      {deposit.status === 'pending' ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleWalletDepositAction(deposit.walletId, deposit._id, true)}
                            disabled={walletDepositingId === String(deposit._id)}
                            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {walletDepositingId === String(deposit._id) ? '...' : 'Valider'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWalletDepositAction(deposit.walletId, deposit._id, false, 'Preuve insuffisante')}
                            disabled={walletDepositingId === String(deposit._id)}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {walletDepositingId === String(deposit._id) ? '...' : 'Refuser'}
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {walletDepositStatusOptions.find((option) => option.value === deposit.status)?.label || deposit.status}
                        </span>
                      )}
                    </div>

                    {/* Proof images */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Preuve de paiement :</p>
                      {proofUrls.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {proofUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => {
                                if (!isLikelyImageUrl(url)) return;
                                event.preventDefault();
                                setProofPreviewUrl(url);
                              }}
                              className="group flex-shrink-0"
                            >
                              {isLikelyImageUrl(url) ? (
                                <img
                                  src={url}
                                  alt={`Preuve dépôt ${i + 1}`}
                                  className="h-28 w-28 cursor-zoom-in rounded-lg border border-gray-200 object-cover transition hover:ring-2 hover:ring-orange-400"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-center text-xs font-semibold text-gray-600">
                                  Preuve PDF
                                </div>
                              )}
                              <span className="mt-1 block max-w-28 truncate text-[10px] font-medium text-gray-500 group-hover:text-gray-700">
                                Ouvrir preuve
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-400">
                          Aucune image de preuve ajoutée.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {walletDepositTotal > 10 && (
                <div className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => loadWalletDeposits(walletDepositPage - 1)}
                    disabled={walletDepositPage <= 1}
                    className="rounded border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    ‹ Précédent
                  </button>
                  <span className="text-xs text-gray-500">Page {walletDepositPage} / {walletDepositTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => loadWalletDeposits(walletDepositPage + 1)}
                    disabled={walletDepositPage >= walletDepositTotalPages}
                    className="rounded border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    Suivant ›
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        </>
      )}

      {/* ─── Wallet Withdrawal Review Section ─────────────── */}
      {filter === 'wallet_withdrawals' && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">En attente</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatNumber(walletWithdrawalTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">Demandes de retrait</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Montant affiché</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(walletWithdrawals.reduce((s, item) => s + Number(item.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">Somme de cette page</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Règle</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Numéro du compte uniquement</p>
              <p className="text-xs text-gray-500 mt-1">Le retrait doit être envoyé au téléphone enregistré.</p>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4 mt-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Retraits Portefeuille HDMarket</h2>
              <p className="text-xs text-gray-500">
                Validez uniquement après transfert Mobile Money vers le numéro du compte utilisateur.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500">File</span>
              <button
                type="button"
                onClick={() => setFilter('wallet_overview')}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Stats
              </button>
              <button
                type="button"
                onClick={() => setFilter('wallet_deposits')}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Dépôts
              </button>
              <button
                type="button"
                onClick={() => setFilter('wallet_withdrawals')}
                className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Retraits
              </button>
            </div>

            {actionNotice && (
              <div className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">{actionNotice}</div>
            )}
            {actionError && (
              <div className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{actionError}</div>
            )}

            {walletWithdrawalsLoading ? (
              <div className="py-10 text-center text-sm text-gray-400">Chargement des retraits...</div>
            ) : walletWithdrawalsError ? (
              <div className="py-6 text-center text-sm text-red-500">{walletWithdrawalsError}</div>
            ) : walletWithdrawals.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Aucun retrait portefeuille en attente.</div>
            ) : (
              <div className="space-y-4">
                {walletWithdrawals.map((withdrawal) => {
                  const payoutPhone = withdrawal.metadata?.payoutPhone || withdrawal.reference || withdrawal.userPhone || '';
                  return (
                    <div key={withdrawal._id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900">
                            {withdrawal.userName || 'Utilisateur'} — {formatCurrency(withdrawal.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Compte: <span className="font-semibold">{withdrawal.userPhone || '—'}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Numéro de retrait: <span className="font-mono font-semibold text-gray-800">{payoutPhone || '—'}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Demandé le {formatDateTime(withdrawal.createdAt)}
                          </p>
                          {withdrawal.note && <p className="text-xs text-gray-400 italic">{withdrawal.note}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleWalletWithdrawalAction(withdrawal.walletId, withdrawal._id, true)}
                            disabled={walletWithdrawalActionId === String(withdrawal._id)}
                            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {walletWithdrawalActionId === String(withdrawal._id) ? '...' : 'Valider'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWalletWithdrawalAction(withdrawal.walletId, withdrawal._id, false, 'Retrait refusé par l’administration')}
                            disabled={walletWithdrawalActionId === String(withdrawal._id)}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {walletWithdrawalActionId === String(withdrawal._id) ? '...' : 'Refuser'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {walletWithdrawalTotal > 10 && (
                  <div className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => loadWalletWithdrawals(walletWithdrawalPage - 1)}
                      disabled={walletWithdrawalPage <= 1}
                      className="rounded border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                    >
                      ‹ Précédent
                    </button>
                    <span className="text-xs text-gray-500">Page {walletWithdrawalPage} / {walletWithdrawalTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => loadWalletWithdrawals(walletWithdrawalPage + 1)}
                      disabled={walletWithdrawalPage >= walletWithdrawalTotalPages}
                      className="rounded border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                    >
                      Suivant ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Proof image preview overlay */}
      {proofPreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setProofPreviewUrl('')}
        >
          <button
            type="button"
            onClick={() => setProofPreviewUrl('')}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
          >
            <X size={24} />
          </button>
          <img
            src={proofPreviewUrl}
            alt="Preuve de paiement"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
