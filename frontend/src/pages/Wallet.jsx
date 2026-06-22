import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Wallet,
  ArrowDownUp,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  Clock,
  Ban,
  Upload,
  X,
  Plus,
  Send,
  ShieldCheck,
  ReceiptText,
  LockKeyhole,
  CheckCircle2,
  Search
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const TXN_ICONS = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  purchase: ArrowUpRight,
  refund: ArrowDownLeft,
  commission: ArrowUpRight,
  sale: ArrowDownLeft,
  sale_pending: Clock,
  sale_release: ArrowDownLeft,
  sale_reversal: ArrowUpRight
};

const TXN_COLORS = {
  deposit: 'text-green-600',
  withdrawal: 'text-red-600',
  purchase: 'text-red-600',
  refund: 'text-green-600',
  commission: 'text-orange-600',
  sale: 'text-green-600',
  sale_pending: 'text-amber-600',
  sale_release: 'text-green-600',
  sale_reversal: 'text-red-600'
};

const TXN_LABELS = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  purchase: 'Achat',
  refund: 'Remboursement',
  commission: 'Commission',
  sale: 'Vente',
  sale_pending: 'Vente en attente',
  sale_release: 'Fonds libérés',
  sale_reversal: 'Annulation vente'
};

const TRANSACTIONS_PAGE_SIZE = 20;

const PAYMENT_METHOD_LABELS = {
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Virement bancaire',
  other: 'Autre'
};

const TRANSACTION_CATEGORY_FILTERS = [
  { id: 'all', label: 'Tout', params: {} },
  { id: 'credit', label: 'Entrées', params: { direction: 'credit' } },
  { id: 'debit', label: 'Sorties', params: { direction: 'debit' } },
  { id: 'deposit', label: 'Dépôts', params: { type: 'deposit' } },
  { id: 'withdrawal', label: 'Retraits', params: { type: 'withdrawal' } },
  { id: 'purchase', label: 'Achats', params: { type: 'purchase' } },
  { id: 'sales', label: 'Ventes', params: { type: 'sale,sale_pending,sale_release,sale_reversal' } },
  { id: 'sale_pending', label: 'Ventes en attente', params: { type: 'sale_pending' } },
  { id: 'refund', label: 'Remboursements', params: { type: 'refund' } },
  { id: 'commission', label: 'Commissions', params: { type: 'commission' } },
  { id: 'neutral', label: 'Autres', params: { direction: 'neutral' } }
];

const TRANSACTION_STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'pending', label: 'En attente' },
  { id: 'completed', label: 'Validées' },
  { id: 'failed', label: 'Échouées' },
  { id: 'reversed', label: 'Annulées' }
];

const getTransactionOrderId = (txn = {}) =>
  String(txn?.metadata?.orderId || txn?.reference || '').trim();

const getPendingTransactionContext = (txn = {}) => {
  if (txn?.status !== 'pending') return null;
  const metadata = txn?.metadata || {};
  const orderId = getTransactionOrderId(txn);

  if (txn.type === 'sale_pending') {
    return {
      title: 'En attente de confirmation de livraison',
      text: orderId
        ? `Commande #${orderId.slice(-6)}: les fonds seront disponibles quand le client confirme la livraison.`
        : 'Les fonds seront disponibles quand le client confirme la livraison.',
      link: orderId ? `/seller/orders/detail/${orderId}` : ''
    };
  }

  if (txn.type === 'deposit') {
    const method = PAYMENT_METHOD_LABELS[metadata.paymentMethod] || metadata.paymentMethod || 'Mobile Money';
    const reference = String(metadata.reference || txn.reference || '').trim();
    return {
      title: 'En attente de validation admin',
      text: `${method}${reference ? ` · Réf. ${reference}` : ''}: votre solde sera crédité après vérification.`
    };
  }

  if (txn.type === 'withdrawal') {
    const phone = String(metadata.payoutPhone || metadata.accountPhone || txn.reference || '').trim();
    return {
      title: 'En attente de traitement admin',
      text: `${phone ? `Retrait vers ${phone}. ` : ''}Le montant a été réservé jusqu’à validation du retrait.`
    };
  }

  return {
    title: 'Transaction en attente',
    text: 'Cette opération est en cours de traitement.'
  };
};

export default function WalletPage() {
  const { user } = useContext(AuthContext);
  const { formatPrice, t } = useAppSettings();
  const { showToast } = useToast();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnCategoryFilter, setTxnCategoryFilter] = useState('all');
  const [txnStatusFilter, setTxnStatusFilter] = useState('all');
  const [txnSearch, setTxnSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(false);
  const [error, setError] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRef, setWithdrawRef] = useState(user?.phone || '');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

  const [depositModal, setDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [depositMethod, setDepositMethod] = useState('orange_money');
  const [depositProof, setDepositProof] = useState([]);
  const [depositPreview, setDepositPreview] = useState([]);
  const [depositing, setDepositing] = useState(false);
  const [contactNetworks, setContactNetworks] = useState([]);
  const proofInputRef = useRef(null);
  const transactionSentinelRef = useRef(null);

  useEffect(() => {
    setWithdrawRef(user?.phone || '');
  }, [user?.phone]);

  const loadContactNetworks = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/networks');
      setContactNetworks(Array.isArray(data) ? data.filter((n) => n.isActive !== false) : []);
    } catch {
      setContactNetworks([]);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/wallet');
      setWallet(data);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError('wallet_disabled');
      } else {
        setError('load_failed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (page = 1, { append = false } = {}) => {
    setTxnLoading(true);
    try {
      const categoryParams =
        TRANSACTION_CATEGORY_FILTERS.find((filter) => filter.id === txnCategoryFilter)?.params || {};
      const status = txnStatusFilter === 'all' ? '' : txnStatusFilter;
      const search = txnSearch.trim();
      const { data } = await api.get('/wallet/transactions', {
        params: {
          page,
          limit: TRANSACTIONS_PAGE_SIZE,
          ...categoryParams,
          ...(status ? { status } : {}),
          ...(search ? { search } : {})
        },
        skipCache: true
      });
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setTransactions((prev) => {
        if (!append) return nextItems;
        const seen = new Set(prev.map((txn) => String(txn?._id || '')));
        const merged = [...prev];
        nextItems.forEach((txn) => {
          const id = String(txn?._id || '');
          if (!id || seen.has(id)) return;
          seen.add(id);
          merged.push(txn);
        });
        return merged;
      });
      setTxnTotal(data.total || 0);
      setTxnPage(page);
    } catch {
      // ignore
    } finally {
      setTxnLoading(false);
    }
  }, [txnCategoryFilter, txnSearch, txnStatusFilter]);

  useEffect(() => {
    loadWallet();
    loadContactNetworks();
  }, [loadWallet, loadContactNetworks]);

  // Auto-refresh wallet when user returns to this tab/page
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadWallet();
        loadTransactions(1);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadWallet, loadTransactions]);

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  const txnTotalPages = Math.max(1, Math.ceil(Number(txnTotal || 0) / TRANSACTIONS_PAGE_SIZE));
  const txnHasMore = transactions.length < Number(txnTotal || 0) && txnPage < txnTotalPages;

  useEffect(() => {
    const sentinel = transactionSentinelRef.current;
    if (!sentinel || !txnHasMore || txnLoading) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadTransactions(txnPage + 1, { append: true });
        }
      },
      { rootMargin: '360px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadTransactions, txnHasMore, txnLoading, txnPage]);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return showToast('Montant invalide.', { variant: 'error' });
    if (!user?.phone) return showToast('Aucun numéro de téléphone n’est associé à votre compte.', { variant: 'error' });
    if (amount > availableBalance) {
      return showToast(`Solde disponible insuffisant. Disponible: ${formatPrice(availableBalance)}.`, { variant: 'error' });
    }
    setWithdrawing(true);
    try {
      const { data } = await api.post('/wallet/withdraw', { amount, reference: withdrawRef || user.phone });
      showToast('Demande de retrait envoyée. En attente de validation.', { variant: 'success' });
      if (data?.transaction) {
        setTransactions((prev) => {
          const exists = prev.some((txn) => String(txn._id) === String(data.transaction._id));
          return exists ? prev : [data.transaction, ...prev].slice(0, TRANSACTIONS_PAGE_SIZE);
        });
        setTxnTotal((prev) => Number(prev || 0) + 1);
      }
      setWallet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: data?.balance ?? prev.balance,
          availableBalance: data?.availableBalance ?? prev.availableBalance,
          pendingBalance: data?.pendingBalance ?? prev.pendingBalance,
          totalBalance: data?.totalBalance ?? prev.totalBalance
        };
      });
      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawRef(user.phone || '');
      await Promise.all([loadWallet(), loadTransactions(1)]);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur lors du retrait.', { variant: 'error' });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return showToast('Montant invalide.', { variant: 'error' });

    // Validate reference: must be exactly 10 digits
    const cleanRef = String(depositRef || '').replace(/\D/g, '');
    if (!cleanRef || cleanRef.length !== 10) {
      return showToast('La référence de transaction doit contenir exactement 10 chiffres.', { variant: 'error' });
    }

    if (!depositProof.length) return showToast('Veuillez ajouter une preuve de paiement (capture d\'écran).', { variant: 'error' });
    setDepositing(true);
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('reference', cleanRef);
      formData.append('paymentMethod', depositMethod);
      depositProof.forEach((file) => formData.append('proof', file));

      const { data } = await api.post('/wallet/deposit-request', formData, {
        skipCache: true,
        timeout: 60000
      });
      showToast('Demande de dépôt envoyée. En attente de vérification par un administrateur.', { variant: 'success' });
      if (data?.transaction) {
        setTransactions((prev) => {
          const exists = prev.some((txn) => String(txn._id) === String(data.transaction._id));
          return exists ? prev : [data.transaction, ...prev].slice(0, 20);
        });
        setTxnTotal((prev) => Number(prev || 0) + 1);
      }
      setWallet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: data?.balance ?? prev.balance,
          availableBalance: data?.availableBalance ?? prev.availableBalance,
          pendingBalance: data?.pendingBalance ?? prev.pendingBalance,
          totalBalance: data?.totalBalance ?? prev.totalBalance
        };
      });
      setDepositModal(false);
      setDepositAmount('');
      setDepositRef('');
      setDepositMethod('orange_money');
      setDepositProof([]);
      setDepositPreview([]);
      await Promise.all([loadWallet(), loadTransactions(1)]);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur lors de la demande de dépôt.', { variant: 'error' });
    } finally {
      setDepositing(false);
    }
  };

  const handleProofChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setDepositProof((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setDepositPreview((prev) => [...prev, ...previews]);
    e.target.value = '';
  };

  const removeProof = (index) => {
    setDepositProof((prev) => prev.filter((_, i) => i !== index));
    setDepositPreview((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (prev[index]?.startsWith('blob:')) URL.revokeObjectURL(prev[index]);
      return next;
    });
  };

  const formatDate = (d) => new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const availableBalance = Number(wallet?.availableBalance || 0);
  const pendingBalance = Number(wallet?.pendingBalance || 0);
  const frozenBalance = Number(wallet?.frozenBalance || 0);
  const totalBalance = Number(wallet?.totalBalance || wallet?.balance || availableBalance || 0);
  const recentPendingCount = transactions.filter((txn) => txn.status === 'pending').length;
  const withdrawAmountValue = Number(withdrawAmount || 0);
  const withdrawAmountInvalid = withdrawAmountValue > 0 && withdrawAmountValue > availableBalance;
  const hasActiveTransactionFilters =
    txnCategoryFilter !== 'all' || txnStatusFilter !== 'all' || txnSearch.trim().length > 0;

  const resetTransactionFilters = () => {
    setTxnCategoryFilter('all');
    setTxnStatusFilter('all');
    setTxnSearch('');
  };

  if (error === 'wallet_disabled') {
    return (
      <div className="hd-profile-flow hd-commerce-shell min-h-screen">
        <header className="ui-glass-header sticky top-20 z-20">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Link to="/profile" className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-base font-semibold">{t('wallet.title', 'Portefeuille')}</h1>
          </div>
        </header>
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <Ban size={48} className="mb-4 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">{t('wallet.disabled', 'Le portefeuille numérique est désactivé.')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('wallet.disabledSub', 'Contactez le support pour plus d\'informations.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-profile-flow hd-commerce-shell min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-16 z-20 border-b border-slate-200/70 bg-white/92 backdrop-blur-xl sm:top-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/profile" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] sm:h-10 sm:w-10">
              <ArrowLeft size={17} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black sm:text-lg">{t('wallet.title', 'Portefeuille HDMarket')}</h1>
              <p className="hidden truncate text-[11px] font-semibold text-slate-500 min-[390px]:block">Paiements, remboursements et retraits centralisés.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { loadWallet(); loadTransactions(1); }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] sm:h-10 sm:w-10"
            aria-label="Actualiser"
          >
            <RefreshCcw size={16} className={loading || txnLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-3 px-3 pb-24 pt-3 sm:gap-4 sm:px-6 sm:pt-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <section className="space-y-3 sm:space-y-4 lg:sticky lg:top-40">
          {loading ? (
            <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
              <Ban size={36} className="mx-auto mb-3 text-red-300" />
              <p className="text-sm font-bold text-red-600">{t('wallet.error', 'Impossible de charger le portefeuille.')}</p>
              <button onClick={loadWallet} className="mt-3 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700">
                {t('wallet.retry', 'Réessayer')}
              </button>
            </div>
          ) : wallet ? (
            <div className="overflow-hidden rounded-2xl bg-[#ff6a00] text-white shadow-[0_18px_46px_rgba(255,106,0,0.22)] sm:rounded-2xl">
              <div className="relative p-4 sm:p-6">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-20 left-1/2 h-44 w-44 rounded-full bg-amber-200/20" />
	                <div className="relative flex items-center justify-between gap-2">
	                  <div className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-[11px] font-black backdrop-blur sm:text-xs">
	                    <Wallet size={15} />
	                    <span className="truncate">Solde disponible</span>
	                  </div>
	                  <span className="shrink-0 rounded-full bg-white/14 px-2.5 py-1.5 text-[10px] font-bold backdrop-blur sm:px-3 sm:text-[11px]">
	                    {recentPendingCount > 0 ? `${recentPendingCount} en attente` : 'A jour'}
	                  </span>
	                </div>

                <div className="relative mt-4 sm:mt-5">
                  <p className="text-[11px] font-bold uppercase text-white/70">Disponible maintenant</p>
                  <p className="mt-1 break-words text-[28px] font-black leading-none tracking-normal min-[380px]:text-[32px] sm:text-[40px]">
                    {formatPrice(availableBalance)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
                    <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                      <p className="text-[10px] font-bold uppercase text-white/65">En attente</p>
                      <p className="mt-1 text-sm font-black">{formatPrice(pendingBalance)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                      <p className="text-[10px] font-bold uppercase text-white/65">Total</p>
                      <p className="mt-1 text-sm font-black">{formatPrice(totalBalance)}</p>
                    </div>
                  </div>
                  {frozenBalance > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold text-white/85">
                      <LockKeyhole size={13} />
                      Bloqué: {formatPrice(frozenBalance)}
                    </div>
                  )}
                </div>
              </div>

	              <div className="grid grid-cols-2 gap-2 border-t border-white/12 bg-white/10 p-2.5 sm:p-3">
                <button
                  type="button"
                  onClick={() => setDepositModal(true)}
	                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-sm font-black text-[#ff6a00] shadow-sm transition hover:bg-gray-100 sm:px-4 sm:py-3"
                >
                  <Plus size={17} />
                  {t('wallet.deposit', 'Déposer')}
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawModal(true)}
	                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#d95700] px-3 py-2.5 text-sm font-black text-white transition hover:bg-[#bf4d00] sm:px-4 sm:py-3"
                >
                  <Send size={16} />
                  {t('wallet.withdraw', 'Retirer')}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            {[
              { icon: ShieldCheck, label: 'Protégé', value: 'Suivi clair' },
              { icon: ReceiptText, label: 'Historique', value: `${transactions.length}/${txnTotal || 0}` },
              { icon: CheckCircle2, label: 'Remboursement', value: 'Traçable' }
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="min-w-[132px] rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:min-w-0">
                <Icon size={16} className="text-[#ff6a00]" />
                <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">{label}</p>
                <p className="mt-0.5 truncate text-xs font-black text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-4">
            <h3 className="text-sm font-black text-slate-900">{t('wallet.howItWorks', 'Sécurité et usage')}</h3>
            <div className="mt-3 space-y-3 text-xs font-medium text-slate-600">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-black text-[#ff6a00]">1</span>
                <p><strong className="text-slate-900">Rechargez</strong> par Mobile Money avec la preuve et le code transaction.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-black text-[#ff6a00]">2</span>
                <p><strong className="text-slate-900">Payez</strong> vos commandes et annonces directement avec le solde disponible.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-black text-[#ff6a00]">3</span>
                <p><strong className="text-slate-900">Suivez</strong> les fonds en attente jusqu'à la confirmation ou le remboursement.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <ArrowDownUp size={17} className="text-[#ff6a00]" />
                {t('wallet.transactions', 'Transactions')}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {txnTotal ? `${txnTotal} mouvement${txnTotal > 1 ? 's' : ''}` : 'Historique du portefeuille'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadTransactions(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-gray-100 hover:text-[#ff6a00]"
              aria-label="Actualiser les transactions"
            >
              <RefreshCcw size={15} className={txnLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-2.5 border-b border-slate-100 bg-white px-3 py-3 sm:space-y-3 sm:px-5">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={txnSearch}
                onChange={(event) => setTxnSearch(event.target.value)}
                placeholder="Référence, commande, note"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:bg-white focus:ring-4 focus:ring-orange-50 sm:h-11 sm:text-sm"
              />
            </div>

            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              {TRANSACTION_CATEGORY_FILTERS.map((filter) => {
                const active = txnCategoryFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTxnCategoryFilter(filter.id)}
                    className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition sm:text-xs ${
                      active
                        ? 'bg-[#ff6a00] text-white shadow-[0_8px_18px_rgba(255,106,0,0.22)]'
                        : 'bg-slate-50 text-slate-600 hover:bg-gray-100 hover:text-[#ff6a00]'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              {TRANSACTION_STATUS_FILTERS.map((filter) => {
                const active = txnStatusFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTxnStatusFilter(filter.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
                      active
                        ? 'border-[#ff6a00] bg-gray-100 text-[#ff6a00]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-gray-200 hover:text-[#ff6a00]'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              {hasActiveTransactionFilters && (
                <button
                  type="button"
                  onClick={resetTransactionFilters}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            {hasActiveTransactionFilters && transactions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-100 px-3 py-2 text-[11px] font-bold leading-snug text-gray-500">
                Vue filtrée: certaines transactions peuvent être masquées. Utilisez “Tout” ou “Réinitialiser” pour voir tout l’historique.
              </div>
            )}
          </div>

          <div className="p-2 pt-4 sm:p-3">
            {txnLoading && transactions.length === 0 ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <ReceiptText size={34} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">
                  {hasActiveTransactionFilters
                    ? 'Aucune transaction ne correspond aux filtres.'
                    : t('wallet.noTransactions', 'Aucune transaction pour le moment.')}
                </p>
                {hasActiveTransactionFilters ? (
                  <button
                    type="button"
                    onClick={resetTransactionFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700"
                  >
                    Réinitialiser les filtres
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDepositModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ff6a00] px-4 py-2 text-xs font-black text-white"
                  >
                    <Plus size={14} />
                    Faire un dépôt
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => {
                  const isSellerReversal = txn.type === 'sale_reversal' || txn?.metadata?.reversal === true;
                  const Icon = isSellerReversal ? ArrowUpRight : TXN_ICONS[txn.type] || Clock;
                  const isDebit = txn.direction === 'debit' || Number(txn.signedAmount || 0) < 0;
                  const isCredit = txn.direction === 'credit' || Number(txn.signedAmount || 0) > 0;
                  const colorClass = isCredit ? 'text-emerald-600' : isDebit ? 'text-rose-600' : TXN_COLORS[txn.type] || 'text-slate-600';
                  const chipClass = isCredit ? 'bg-emerald-50' : isDebit ? 'bg-rose-50' : 'bg-slate-50';
                  const label = isSellerReversal ? TXN_LABELS.sale_reversal : TXN_LABELS[txn.type] || txn.type;
                  const isPending = txn.status === 'pending';
                  const amountPrefix = isCredit ? '+' : isDebit ? '-' : '';
                  const displayAmount = Number(txn.displayAmount || Math.abs(Number(txn.signedAmount || 0)) || txn.amount || 0);
                  const pendingContext = getPendingTransactionContext(txn);
                  return (
                    <div key={txn._id} className="rounded-2xl border border-slate-100 bg-white p-2.5 transition hover:border-gray-200 hover:bg-gray-100/30 sm:p-4">
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-10 sm:w-10 ${isPending ? 'bg-amber-50' : chipClass}`}>
                          <Icon size={15} className={isPending ? 'text-amber-500' : colorClass} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-black text-slate-900 sm:text-sm">{label}</p>
                              {txn.note && <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{txn.note}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`max-w-[116px] break-words text-right text-[13px] font-black leading-tight sm:max-w-none sm:text-sm ${colorClass}`}>{amountPrefix}{formatPrice(displayAmount)}</p>
                              {isPending && (
                                <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                  En attente
                                </span>
                              )}
                            </div>
                          </div>
                          {pendingContext && (
                            <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 sm:mt-3">
                              <p className="font-black">{pendingContext.title}</p>
                              <p className="mt-0.5 font-medium">{pendingContext.text}</p>
                              {pendingContext.link && (
                                <Link
                                  to={pendingContext.link}
                                  className="mt-1.5 inline-flex text-[10px] font-black uppercase text-amber-700 underline underline-offset-2"
                                >
                                  Voir la commande
                                </Link>
                              )}
                            </div>
                          )}
                          <p className="mt-2 text-[10px] font-bold uppercase text-slate-300">{formatDate(txn.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={transactionSentinelRef} className="min-h-8">
                  {txnLoading && transactions.length > 0 ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-slate-400">
                      <RefreshCcw size={13} className="animate-spin" />
                      Chargement des transactions...
                    </div>
                  ) : txnHasMore ? (
                    <div className="py-4 text-center text-xs font-bold text-slate-400">
                      Faites défiler pour charger plus
                    </div>
                  ) : transactions.length > TRANSACTIONS_PAGE_SIZE ? (
                    <div className="py-4 text-center text-xs font-bold text-slate-300">
                      Toutes les transactions sont affichées
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Withdraw Modal */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-0 sm:items-center sm:px-4" onClick={() => setWithdrawModal(false)}>
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">{t('wallet.withdrawTitle', 'Retirer vers Mobile Money')}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Le retrait sera traité vers le numéro de votre compte.</p>
              </div>
              <button type="button" onClick={() => setWithdrawModal(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                <X size={16} />
              </button>
            </div>
	            <div className="mt-4 rounded-2xl bg-gray-100 p-3 text-xs font-bold text-[#ff6a00]">
	              Disponible: {formatPrice(availableBalance)}
	            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-black text-slate-600">Montant (FCFA)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="ex: 5000"
                  className={`mt-1 w-full rounded-2xl border px-3 py-3 text-sm font-semibold outline-none transition focus:ring-4 ${
                    withdrawAmountInvalid
                      ? 'border-rose-200 bg-rose-50 focus:border-rose-400 focus:ring-rose-50'
                      : 'border-slate-200 focus:border-[#ff6a00] focus:ring-orange-50'
                  }`}
                />
                {withdrawAmountInvalid && (
                  <p className="mt-1 text-[11px] font-bold text-rose-600">
                    Montant supérieur au solde disponible.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-slate-600">Numéro Mobile Money</label>
                <input
                  type="text"
                  value={withdrawRef || user?.phone || ''}
                  readOnly
                  placeholder="Numéro de téléphone du compte"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"
                />
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Les retraits sont envoyés uniquement au numéro enregistré sur votre compte.
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-4 pb-[max(0rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
              <button
                onClick={() => setWithdrawModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || !user?.phone || withdrawAmountInvalid}
                className="flex-1 rounded-2xl bg-[#ff6a00] py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {withdrawing ? 'Envoi...' : 'Demander le retrait'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deposit Modal */}
      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-0 sm:items-center sm:px-4" onClick={() => setDepositModal(false)}>
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">{t('wallet.depositTitle', 'Déposer sur mon portefeuille')}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {t('wallet.depositHint', 'Envoyez de l\'argent via Mobile Money, puis soumettez la preuve de paiement ci-dessous. Votre compte sera crédité après vérification.')}
                </p>
              </div>
              <button type="button" onClick={() => setDepositModal(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-black text-slate-600">Montant envoyé (FCFA)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="ex: 5000"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-4 focus:ring-orange-50"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-600">Mode de paiement</label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-4 focus:ring-orange-50"
                >
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_money">MTN Money</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="other">Autre</option>
                </select>
                {/* Show matching contact network number */}
                {(() => {
                  const methodLabels = { orange_money: 'orange', mtn_money: 'mtn', airtel_money: 'airtel' };
                  const searchTerm = methodLabels[depositMethod] || depositMethod;
                  const network = contactNetworks.find((n) =>
                    String(n?.name || '').toLowerCase().includes(searchTerm)
                  );
	                  if (network?.phoneNumber) {
	                    return (
	                      <p className="mt-2 rounded-2xl bg-gray-100 px-3 py-2 text-xs font-semibold text-slate-600">
	                        Numéro à utiliser : <span className="font-black text-[#ff6a00]">{network.phoneNumber}</span>
	                      </p>
	                    );
	                  }
                  return null;
                })()}
              </div>
              <div>
                <label className="text-xs font-black text-slate-600">Référence / Numéro de transaction</label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="ex: 0612345678 (10 chiffres)"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-4 focus:ring-orange-50"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-600">Preuve de paiement</label>
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="hidden"
                />
	                <button
	                  type="button"
	                  onClick={() => proofInputRef.current?.click()}
	                  disabled={depositProof.length >= 1}
	                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 px-3 py-5 text-sm font-bold text-slate-500 transition hover:border-[#ff6a00]/40 hover:bg-gray-100 hover:text-[#ff6a00] disabled:opacity-40"
	                >
                  <Upload size={16} />
                  {depositProof.length === 0
                    ? 'Ajouter une capture d\'écran du paiement'
                    : 'Preuve ajoutée (1/1)'}
                </button>
                {depositPreview.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
	                    {depositPreview.map((url, i) => (
	                      <div key={i} className="relative flex-shrink-0">
	                        <img src={url} alt={`Preuve ${i + 1}`} className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
	                        <button
	                          type="button"
	                          onClick={() => removeProof(i)}
	                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow"
	                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-4 pb-[max(0rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
              <button
                onClick={() => setDepositModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={handleDeposit}
                disabled={depositing || !depositAmount || !depositProof.length}
                className="flex-1 rounded-2xl bg-[#ff6a00] py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {depositing ? 'Envoi...' : 'Soumettre le dépôt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
