import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowDownUp, ArrowUpRight, ArrowDownLeft, RefreshCcw, Clock, Ban, Upload, X } from 'lucide-react';
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

export default function WalletPage() {
  const { user } = useContext(AuthContext);
  const { formatPrice, t } = useAppSettings();
  const { showToast } = useToast();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
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
      const { data } = await api.get('/wallet/transactions', {
        params: { page, limit: TRANSACTIONS_PAGE_SIZE },
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
  }, []);

  useEffect(() => { loadWallet(); loadTransactions(1); loadContactNetworks(); }, [loadWallet, loadTransactions, loadContactNetworks]);

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
    setWithdrawing(true);
    try {
      await api.post('/wallet/withdraw', { amount, reference: user.phone });
      showToast('Demande de retrait envoyée. En attente de validation.', { variant: 'success' });
      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawRef(user.phone || '');
      loadWallet();
      loadTransactions(1);
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
    <div className="hd-profile-flow hd-commerce-shell min-h-screen">
      <header className="ui-glass-header sticky top-20 z-20">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/profile" className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold">{t('wallet.title', 'Portefeuille HDMarket')}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-4 space-y-4">
        {/* Balance Card */}
        {loading ? (
          <div className="animate-pulse rounded-2xl bg-gray-200 h-40" />
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">{t('wallet.error', 'Impossible de charger le portefeuille.')}</p>
            <button onClick={loadWallet} className="mt-2 text-xs font-semibold text-red-700 underline">
              {t('wallet.retry', 'Réessayer')}
            </button>
          </div>
        ) : wallet ? (
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg">
            <div className="flex items-center gap-2">
              <Wallet size={18} />
              <p className="text-sm font-semibold opacity-90">{t('wallet.balance', 'Solde disponible')}</p>
            </div>
            <p className="mt-2 text-3xl font-black">{formatPrice(wallet.availableBalance)}</p>
            {Number(wallet.pendingBalance || 0) > 0 && (
              <p className="mt-1 text-xs opacity-80">
                En attente de confirmation: {formatPrice(wallet.pendingBalance)}
              </p>
            )}
            {wallet.frozenBalance > 0 && (
              <p className="mt-1 text-xs opacity-70">
                {t('wallet.frozen', 'Bloqué')}: {formatPrice(wallet.frozenBalance)}
              </p>
            )}
            {Number(wallet.totalBalance || 0) > Number(wallet.availableBalance || 0) && (
              <p className="mt-1 text-xs opacity-70">
                Total portefeuille: {formatPrice(wallet.totalBalance)}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDepositModal(true)}
                className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-sm hover:bg-white/30 transition"
              >
                {t('wallet.deposit', 'Déposer')}
              </button>
              <button
                onClick={() => setWithdrawModal(true)}
                className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-sm hover:bg-white/30 transition"
              >
                {t('wallet.withdraw', 'Retirer')}
              </button>
              <button
                onClick={() => { loadWallet(); loadTransactions(1); }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs backdrop-blur-sm hover:bg-white/20 transition"
              >
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Transactions */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
            <ArrowDownUp size={16} />
            {t('wallet.transactions', 'Transactions')}
          </h2>

          {txnLoading && transactions.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {t('wallet.noTransactions', 'Aucune transaction pour le moment.')}
            </p>
          ) : (
            <div className="space-y-1">
              <div className="divide-y divide-gray-50">
                {transactions.map((txn) => {
                const isSellerReversal = txn.type === 'sale_reversal' || txn?.metadata?.reversal === true;
                const Icon = isSellerReversal ? ArrowUpRight : TXN_ICONS[txn.type] || Clock;
                const isDebit = txn.direction === 'debit' || Number(txn.signedAmount || 0) < 0;
                const isCredit = txn.direction === 'credit' || Number(txn.signedAmount || 0) > 0;
                const colorClass = isCredit ? 'text-green-600' : isDebit ? 'text-red-600' : TXN_COLORS[txn.type] || 'text-gray-600';
                const label = isSellerReversal ? TXN_LABELS.sale_reversal : TXN_LABELS[txn.type] || txn.type;
                const isPending = txn.status === 'pending';
                const amountPrefix = isCredit ? '+' : isDebit ? '-' : '';
                const displayAmount = Number(txn.displayAmount || Math.abs(Number(txn.signedAmount || 0)) || txn.amount || 0);
                return (
                  <div key={txn._id} className="flex items-center gap-3 py-3">
                    <div className={`rounded-full p-2 ${isPending ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <Icon size={14} className={isPending ? 'text-amber-500' : colorClass} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {label}
                        {isPending && <span className="ml-1 text-[10px] text-amber-600">(en attente)</span>}
                      </p>
                      {txn.note && <p className="text-xs text-gray-400 truncate">{txn.note}</p>}
                      <p className="text-[10px] text-gray-400">{formatDate(txn.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ${colorClass}`}>
                      {amountPrefix}{formatPrice(displayAmount)}
                    </span>
                  </div>
                );
                })}
              </div>
              <div ref={transactionSentinelRef} className="min-h-8">
                {txnLoading && transactions.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-gray-400">
                    <RefreshCcw size={13} className="animate-spin" />
                    Chargement des transactions...
                  </div>
                ) : txnHasMore ? (
                  <div className="py-3 text-center text-xs font-semibold text-gray-400">
                    Faites défiler pour charger plus
                  </div>
                ) : transactions.length > TRANSACTIONS_PAGE_SIZE ? (
                  <div className="py-3 text-center text-xs font-semibold text-gray-300">
                    Toutes les transactions sont affichées
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">{t('wallet.howItWorks', 'Comment ça marche')}</h3>
          <div className="mt-2 space-y-2 text-xs text-gray-600">
            <p>💳 <strong>Recharger</strong> — Effectuez un dépôt Mobile Money et fournissez le code de transaction. Un administrateur valide et crédite votre portefeuille.</p>
            <p>🛒 <strong>Acheter</strong> — Lors du checkout, choisissez "Payer avec mon solde HDMarket".</p>
            <p>💰 <strong>Vendre</strong> — Les paiements Portefeuille HDMarket restent en attente puis deviennent disponibles après confirmation de la commande.</p>
            <p>🏦 <strong>Retirer</strong> — Les vendeurs peuvent retirer uniquement leur solde disponible vers le numéro Mobile Money du compte.</p>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setWithdrawModal(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">{t('wallet.withdrawTitle', 'Retirer vers Mobile Money')}</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Montant (FCFA)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="ex: 5000"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Numéro Mobile Money</label>
                <input
                  type="text"
                  value={withdrawRef || user?.phone || ''}
                  readOnly
                  placeholder="Numéro de téléphone du compte"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
                />
                <p className="mt-1 text-[11px] font-medium text-gray-500">
                  Les retraits sont envoyés uniquement au numéro enregistré sur votre compte.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setWithdrawModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || !user?.phone}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {withdrawing ? 'Envoi...' : 'Demander le retrait'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deposit Modal */}
      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDepositModal(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">{t('wallet.depositTitle', 'Déposer sur mon portefeuille')}</h3>
            <p className="mt-1 text-xs text-gray-500">
              {t('wallet.depositHint', 'Envoyez de l\'argent via Mobile Money, puis soumettez la preuve de paiement ci-dessous. Votre compte sera crédité après vérification.')}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Montant envoyé (FCFA)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="ex: 5000"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Mode de paiement</label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
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
                      <p className="mt-1.5 text-xs text-gray-500">
                        Numéro à utiliser : <span className="font-bold text-[#FF6A00]">{network.phoneNumber}</span>
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Référence / Numéro de transaction</label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="ex: 0612345678 (10 chiffres)"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Preuve de paiement</label>
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
                  className="mt-1 w-full rounded-xl border-2 border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
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
                        <img src={url} alt={`Preuve ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => removeProof(i)}
                          className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white w-5 h-5 flex items-center justify-center shadow"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDepositModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleDeposit}
                disabled={depositing || !depositAmount || !depositProof.length}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
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
