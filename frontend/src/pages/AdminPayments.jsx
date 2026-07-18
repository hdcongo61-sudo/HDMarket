import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileCheck2,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
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

const isWalletListingPayment = (payment = {}) =>
  payment?.paymentMethod === 'wallet' ||
  payment?.operator === 'HDMARKET_WALLET' ||
  Boolean(String(payment?.walletTransactionId || payment?.metadata?.walletTransactionId || '').trim());

const getPaymentChannelLabel = (payment = {}) =>
  isWalletListingPayment(payment) ? 'Portefeuille HDMarket' : 'Mobile Money';

const getPaymentOperatorLabel = (payment = {}) => {
  if (isWalletListingPayment(payment)) return 'Portefeuille HDMarket';
  const value = String(payment?.operator || '').trim();
  const labels = {
    MTN_MONEY: 'MTN Money',
    AIRTEL_MONEY: 'Airtel Money',
    ORANGE_MONEY: 'Orange Money',
    CASH: 'Cash',
    CARD: 'Carte',
    OTHER: 'Autre'
  };
  return labels[value] || value || '—';
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
// Statuts de la file annonces uniquement — les vues portefeuille sont un espace à part,
// accessible via le sélecteur du header (toujours visible).
const paymentFilterOptions = [
  { value: 'waiting', label: 'En attente' },
  { value: 'verified', label: 'Validés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'disabled_products', label: 'Annonces désactivées' }
];

const walletDepositStatusOptions = [
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Validés' },
  { value: 'failed', label: 'Refusés' }
];

const metricToneClasses = {
  neutral: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-sky-50 text-sky-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  orange: 'bg-[#FFF0E4] text-[#e85d00]'
};

const DashboardCard = ({ label, value, hint, icon: Icon, tone = 'neutral' }) => (
  <article className="rounded-2xl border border-gray-100 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-black leading-none tracking-tight text-slate-950">{value}</p>
        {hint ? <p className="mt-1.5 text-xs font-semibold text-gray-500">{hint}</p> : null}
      </div>
      {Icon ? (
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metricToneClasses[tone] || metricToneClasses.neutral}`}>
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
    </div>
  </article>
);

const SectionHeader = ({ eyebrow, title, description, action }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e85d00]">{eyebrow}</p> : null}
      <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-xs font-semibold text-gray-500">{description}</p> : null}
    </div>
    {action}
  </div>
);

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
  const [brokenProofUrls, setBrokenProofUrls] = useState(() => new Set());
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

  const markProofUrlBroken = useCallback((url) => {
    setBrokenProofUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

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
  const paymentChannels = paymentSummary.channels || {};
  const mobileMoneyChannel = paymentChannels.mobileMoney || {};
  const walletChannel = paymentChannels.wallet || {};
  const channelTotal = paymentChannels.total || {};
  const walletShare = Number(channelTotal.amount || 0) > 0
    ? Math.round((Number(walletChannel.amount || 0) / Number(channelTotal.amount || 0)) * 100)
    : 0;

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
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E4] text-[#e85d00]">
              <CreditCard className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center rounded-full bg-[#FFF0E4] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#e85d00]">
                Finances
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                {isManager ? 'Gestionnaire — Paiements' : 'Paiements'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
                Pilotez les validations, le portefeuille HDMarket, les preuves de paiement et les flux ecommerce.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => Promise.allSettled([loadStats(), loadPayments(), isWalletAdminPanel ? loadWalletStats() : Promise.resolve()])}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-gray-50 active:scale-[0.97]"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <Link
              to="/admin"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-gray-50 active:scale-[0.97]"
            >
              <ArrowLeft className="h-4 w-4" />
              Tableau de bord
            </Link>
            <Link
              to="/admin/payment-verification"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#e85d00] px-3 text-xs font-black text-white shadow-sm transition active:scale-[0.97]"
            >
              <ShieldCheck className="h-4 w-4" />
              File de vérification
            </Link>
          </div>
        </div>
        {/* Sélecteur d'espace — toujours visible, y compris en mode portefeuille
            (avant, entrer dans le portefeuille cachait tout retour vers la file annonces) */}
        <div className="flex gap-1.5 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setFilter('waiting')}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition active:scale-[0.98] ${!isWalletAdminPanel
              ? 'bg-[#e85d00] text-white shadow-sm'
              : 'text-slate-600 hover:bg-gray-100'}`}
          >
            <CreditCard className="h-4 w-4" />
            Paiements annonces
          </button>
          <button
            type="button"
            onClick={() => setFilter('wallet_overview')}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition active:scale-[0.98] ${isWalletAdminPanel
              ? 'bg-[#e85d00] text-white shadow-sm'
              : 'text-slate-600 hover:bg-gray-100'}`}
          >
            <Wallet className="h-4 w-4" />
            Portefeuille HDMarket
          </button>
        </div>
      </header>

      {!isWalletAdminPanel && (
        <>
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Vue ecommerce"
            title="Performance des paiements annonce"
            description="Statuts de validation, revenus cumulés et activité récente."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <DashboardCard label="Total" value={formatNumber(paymentSummary.total)} hint="Paiements enregistrés" icon={Layers3} />
            <DashboardCard label="En attente" value={formatNumber(paymentSummary.waiting)} hint="À vérifier" icon={Clock3} tone="amber" />
            <DashboardCard label="Validés" value={formatNumber(paymentSummary.verified)} hint="Mises en ligne confirmées" icon={CheckCircle2} tone="green" />
            <DashboardCard label="Rejetés" value={formatNumber(paymentSummary.rejected)} hint="Paiements refusés" icon={XCircle} tone="red" />
            <DashboardCard label="Revenus cumulés" value={formatCurrency(paymentSummary.revenue)} hint="Toutes commissions" icon={TrendingUp} tone="orange" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard label="24 heures" value={`${formatNumber(dayStats.count)} paiements`} hint={`Montant : ${formatCurrency(dayStats.amount)}`} icon={Gauge} tone="blue" />
            <DashboardCard label="7 jours" value={`${formatNumber(weekStats.count)} paiements`} hint={`Montant : ${formatCurrency(weekStats.amount)}`} icon={TrendingUp} tone="indigo" />
            <DashboardCard label="30 jours" value={`${formatNumber(monthStats.count)} paiements`} hint={`Montant : ${formatCurrency(monthStats.amount)}`} icon={Banknote} tone="green" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Canaux de paiement annonce</p>
                <h3 className="text-base font-black text-slate-950">Mobile Money vs Portefeuille HDMarket</h3>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {formatNumber(channelTotal.count || 0)} paiement{Number(channelTotal.count || 0) > 1 ? 's' : ''} analysé{Number(channelTotal.count || 0) > 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                label="Mobile Money"
                value={formatCurrency(mobileMoneyChannel.amount || 0)}
                hint={`${formatNumber(mobileMoneyChannel.count || 0)} paiements • ${formatNumber(mobileMoneyChannel.verifiedCount || 0)} validés`}
                icon={CreditCard}
                tone="orange"
              />
              <DashboardCard
                label="Portefeuille HDMarket"
                value={formatCurrency(walletChannel.amount || 0)}
                hint={`${formatNumber(walletChannel.count || 0)} paiements • ${formatNumber(walletChannel.verifiedCount || 0)} auto-validés`}
                icon={Wallet}
                tone="green"
              />
              <DashboardCard
                label="En attente Mobile Money"
                value={formatNumber(mobileMoneyChannel.waitingCount || 0)}
                hint={`${formatNumber(mobileMoneyChannel.rejectedCount || 0)} refusés côté Mobile Money`}
                icon={Clock3}
                tone="amber"
              />
              <DashboardCard
                label="Part portefeuille"
                value={`${walletShare}%`}
                hint="Part du volume annonce payé par wallet"
                icon={Gauge}
                tone="indigo"
              />
            </div>
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
            {/* Statuts uniquement — les vues portefeuille ont leur propre espace via le
                sélecteur du header, plus de mélange statut/espace dans un même menu. */}
            <div className="-mx-1 flex flex-wrap gap-2 pb-1">
              {paymentFilterOptions.map((option) => {
                const chipCount =
                  option.value === 'waiting'
                    ? Number(paymentSummary.waiting || 0)
                    : option.value === 'verified'
                      ? Number(paymentSummary.verified || 0)
                      : option.value === 'rejected'
                        ? Number(paymentSummary.rejected || 0)
                        : 0;
                const active = filter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition active:scale-[0.97] ${
                      active
                        ? 'bg-[#e85d00] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                    {chipCount > 0 ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white/25 text-white' : 'bg-[#FFF0E4] text-[#e85d00]'}`}>
                        {chipCount > 99 ? '99+' : chipCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
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
                    <p>Méthode : <span className="font-semibold text-gray-900">{getPaymentChannelLabel(payment)}</span></p>
                    <p>Opérateur : {getPaymentOperatorLabel(payment)}</p>
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
                  <th className="p-2 border text-left">Méthode</th>
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
                      <td className="p-2 border align-top">
                        <p className="font-semibold text-gray-900">{getPaymentChannelLabel(payment)}</p>
                        <p className="text-xs text-gray-500">{getPaymentOperatorLabel(payment)}</p>
                      </td>
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
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Wallet command center"
              title="Portefeuille HDMarket"
              description="Vue admin/fondateur sur les soldes, files d’attente et mouvements ecommerce du portefeuille."
              action={
                <button
                  type="button"
                  onClick={loadWalletStats}
                  disabled={walletStatsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {walletStatsLoading ? 'Actualisation...' : 'Actualiser'}
                </button>
              }
            />
            {walletStatsError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {walletStatsError}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Exposition financière</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardCard label="Solde disponible" value={formatCurrency(walletStats?.balances?.available || 0)} hint={`${formatNumber(walletStats?.wallets?.withAvailableBalance || 0)} portefeuilles avec solde`} icon={Wallet} tone="green" />
                <DashboardCard label="En attente" value={formatCurrency(walletStats?.balances?.pending || 0)} hint="Dépôts et ventes non confirmés" icon={Clock3} tone="amber" />
                <DashboardCard label="Gelé" value={formatCurrency(walletStats?.balances?.frozen || 0)} hint="Solde bloqué ou réservé" icon={ShieldCheck} tone="indigo" />
                <DashboardCard label="Exposition totale" value={formatCurrency(walletStats?.balances?.totalExposure || 0)} hint={`${formatNumber(walletStats?.wallets?.total || 0)} portefeuilles`} icon={Banknote} tone="neutral" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Files de validation</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DashboardCard label="Dépôts à valider" value={formatNumber(walletStats?.actionQueue?.pendingDeposits?.count || 0)} hint={formatCurrency(walletStats?.actionQueue?.pendingDeposits?.amount || 0)} icon={Download} tone="orange" />
                <DashboardCard label="Retraits à traiter" value={formatNumber(walletStats?.actionQueue?.pendingWithdrawals?.count || 0)} hint={formatCurrency(walletStats?.actionQueue?.pendingWithdrawals?.amount || 0)} icon={FileCheck2} tone="red" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Volume portefeuille</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardCard label="Aujourd’hui" value={formatCurrency(walletStats?.volume?.today?.amount || 0)} hint={`${formatNumber(walletStats?.volume?.today?.count || 0)} mouvements`} icon={Gauge} tone="blue" />
                <DashboardCard label="30 jours" value={formatCurrency(walletStats?.volume?.last30Days?.amount || 0)} hint={`${formatNumber(walletStats?.volume?.last30Days?.count || 0)} mouvements`} icon={TrendingUp} tone="indigo" />
                <DashboardCard label="Dépôts validés" value={formatCurrency(walletStats?.completed?.deposits?.amount || 0)} hint={`${formatNumber(walletStats?.completed?.deposits?.count || 0)} dépôts`} icon={CheckCircle2} tone="green" />
                <DashboardCard label="Retraits validés" value={formatCurrency(walletStats?.completed?.withdrawals?.amount || 0)} hint={`${formatNumber(walletStats?.completed?.withdrawals?.count || 0)} retraits`} icon={XCircle} tone="red" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Canaux de paiement wallet</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <DashboardCard label="Achats commandes" value={formatCurrency(walletStats?.walletPayments?.orders?.amount || walletStats?.completed?.orderPurchases?.amount || 0)} hint={`${formatNumber(walletStats?.walletPayments?.orders?.count || walletStats?.completed?.orderPurchases?.count || 0)} paiements wallet`} icon={ShoppingBag} tone="green" />
                <DashboardCard label="Annonces / boosts" value={formatCurrency(walletStats?.walletPayments?.boosts?.amount || walletStats?.completed?.boostPurchases?.amount || 0)} hint={`${formatNumber(walletStats?.walletPayments?.boosts?.count || walletStats?.completed?.boostPurchases?.count || 0)} paiements wallet`} icon={TrendingUp} tone="indigo" />
                <DashboardCard label="Devenir boutique" value={formatCurrency(walletStats?.walletPayments?.shopConversions?.amount || walletStats?.completed?.shopConversionPurchases?.amount || 0)} hint={`${formatNumber(walletStats?.walletPayments?.shopConversions?.count || walletStats?.completed?.shopConversionPurchases?.count || 0)} paiements wallet`} icon={Store} tone="blue" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Vue</span>
              <button
                type="button"
                onClick={() => setFilter('wallet_overview')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === 'wallet_overview'
                    ? 'bg-[#e85d00] text-white shadow-sm'
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
                    ? 'bg-[#e85d00] text-white shadow-sm'
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
                    ? 'bg-[#e85d00] text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Retraits
              </button>
            </div>
          </div>

          {filter === 'wallet_overview' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader
                eyebrow="Ledger"
                title="Activité récente"
                description="Derniers mouvements enregistrés dans les portefeuilles."
                action={
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatNumber(walletStats?.wallets?.total || 0)} portefeuilles
                  </span>
                }
              />
              {walletStatsLoading && !walletStats ? (
                <div className="py-8 text-center text-sm text-gray-400">Chargement des statistiques...</div>
              ) : !walletStats?.recentTransactions?.length ? (
                <div className="py-8 text-center text-sm text-gray-400">Aucune activité portefeuille à afficher.</div>
              ) : (
                <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                  {walletStats.recentTransactions.map((txn) => {
                    const isCredit = txn.direction === 'credit' || Number(txn.signedAmount || 0) > 0;
                    const isDebit = txn.direction === 'debit' || Number(txn.signedAmount || 0) < 0;
                    const amountPrefix = isCredit ? '+' : isDebit ? '-' : '';
                    const amountClass = isCredit ? 'text-green-700' : isDebit ? 'text-red-700' : 'text-gray-700';
                    return (
                      <div key={`${txn.walletId}-${txn._id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="px-3 sm:px-4">
                          <p className="text-sm font-black text-slate-950">
                            {txn.userName || 'Utilisateur'} · {txn.type}
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {txn.userPhone || '—'} · {txn.status} · {formatDateTime(txn.createdAt)}
                          </p>
                        </div>
                        <p className={`px-3 text-sm font-black sm:px-4 ${amountClass}`}>
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
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DashboardCard
            label={walletDepositStatusOptions.find((option) => option.value === walletDepositStatus)?.label || 'Dépôts'}
            value={formatNumber(walletDepositTotal)}
            hint="Dépôts Portefeuille HDMarket"
            icon={Download}
            tone="orange"
          />
          <DashboardCard
            label="Montant total"
            value={formatCurrency(walletDeposits.reduce((s, d) => s + Number(d.amount || 0), 0))}
            hint="Somme affichée dans cette file"
            icon={Banknote}
            tone="green"
          />
          <DashboardCard
            label="Preuves"
            value="Validation admin"
            hint="Contrôlez l’image ou le PDF avant crédit"
            icon={FileCheck2}
            tone="indigo"
          />
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="File de validation"
            title="Dépôts Portefeuille HDMarket"
            description="Vérifiez les preuves de paiement avant de créditer le solde utilisateur."
          />
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
                    ? 'bg-[#e85d00] text-white shadow-sm'
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
                  <div key={deposit._id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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
	                              {isLikelyImageUrl(url) && !brokenProofUrls.has(url) ? (
	                                <img
	                                  src={url}
	                                  alt={`Preuve dépôt ${i + 1}`}
	                                  className="h-28 w-28 cursor-zoom-in rounded-lg border border-gray-200 object-cover transition hover:ring-2 hover:ring-orange-400"
	                                  loading="lazy"
	                                  onError={() => markProofUrlBroken(url)}
	                                />
	                              ) : (
	                                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-2 text-center text-xs font-semibold text-gray-600">
	                                  <span>{isLikelyImageUrl(url) ? 'Image indisponible' : 'Preuve PDF'}</span>
	                                  <span className="mt-1 text-[10px] font-bold text-orange-600">Ouvrir</span>
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
          <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard label="En attente" value={formatNumber(walletWithdrawalTotal)} hint="Demandes de retrait" icon={Clock3} tone="orange" />
            <DashboardCard label="Montant affiché" value={formatCurrency(walletWithdrawals.reduce((s, item) => s + Number(item.amount || 0), 0))} hint="Somme de cette page" icon={Banknote} tone="green" />
            <DashboardCard label="Règle" value="Numéro du compte" hint="Le retrait doit aller au téléphone enregistré" icon={ShieldCheck} tone="indigo" />
          </section>

          <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Payout operations"
              title="Retraits Portefeuille HDMarket"
              description="Validez uniquement après transfert Mobile Money vers le numéro du compte utilisateur."
            />
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
                    <div key={withdrawal._id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setProofPreviewUrl('')}
        >
	          <button
	            type="button"
	            onClick={() => setProofPreviewUrl('')}
	            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
	          >
	            <X size={24} />
	          </button>
	          <a
	            href={proofPreviewUrl}
	            target="_blank"
	            rel="noopener noreferrer"
	            className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-900 transition hover:bg-gray-100"
	          >
	            Ouvrir l'original
	          </a>
	          <img
	            src={proofPreviewUrl}
	            alt="Preuve de paiement"
	            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </div>
    </div>
  );
}
