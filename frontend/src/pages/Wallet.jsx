import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowDownUp, ArrowUpRight, ArrowDownLeft, RefreshCcw, Clock, Ban } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const TXN_ICONS = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  purchase: ArrowUpRight,
  refund: ArrowDownLeft,
  commission: ArrowUpRight
};

const TXN_COLORS = {
  deposit: 'text-green-600',
  withdrawal: 'text-red-600',
  purchase: 'text-red-600',
  refund: 'text-green-600',
  commission: 'text-orange-600'
};

const TXN_LABELS = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  purchase: 'Achat',
  refund: 'Remboursement',
  commission: 'Commission'
};

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
  const [withdrawRef, setWithdrawRef] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

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

  const loadTransactions = useCallback(async (page = 1) => {
    setTxnLoading(true);
    try {
      const { data } = await api.get('/wallet/transactions', { params: { page, limit: 20 } });
      setTransactions(data.items || []);
      setTxnTotal(data.total || 0);
      setTxnPage(page);
    } catch {
      // ignore
    } finally {
      setTxnLoading(false);
    }
  }, []);

  useEffect(() => { loadWallet(); loadTransactions(); }, [loadWallet, loadTransactions]);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return showToast('Montant invalide.', { variant: 'error' });
    setWithdrawing(true);
    try {
      await api.post('/wallet/withdraw', { amount, reference: withdrawRef });
      showToast('Demande de retrait envoyée. En attente de validation.', { variant: 'success' });
      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawRef('');
      loadWallet();
      loadTransactions();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur lors du retrait.', { variant: 'error' });
    } finally {
      setWithdrawing(false);
    }
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
            {wallet.frozenBalance > 0 && (
              <p className="mt-1 text-xs opacity-70">
                {t('wallet.frozen', 'Bloqué')}: {formatPrice(wallet.frozenBalance)}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setWithdrawModal(true)}
                className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-sm hover:bg-white/30 transition"
              >
                {t('wallet.withdraw', 'Retirer')}
              </button>
              <button
                onClick={() => { loadWallet(); loadTransactions(); }}
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
            <div className="divide-y divide-gray-50">
              {transactions.map((txn) => {
                const Icon = TXN_ICONS[txn.type] || Clock;
                const colorClass = TXN_COLORS[txn.type] || 'text-gray-600';
                const label = TXN_LABELS[txn.type] || txn.type;
                const isPending = txn.status === 'pending';
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
                    <span className={`text-sm font-bold ${txn.type === 'deposit' || txn.type === 'refund' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'deposit' || txn.type === 'refund' ? '+' : '-'}{formatPrice(txn.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {txnTotal > 20 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                disabled={txnPage <= 1}
                onClick={() => loadTransactions(txnPage - 1)}
                className="rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-30"
              >
                ‹ Précédent
              </button>
              <span className="text-xs text-gray-500">{txnPage}/{Math.ceil(txnTotal / 20)}</span>
              <button
                disabled={txnPage >= Math.ceil(txnTotal / 20)}
                onClick={() => loadTransactions(txnPage + 1)}
                className="rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-30"
              >
                Suivant ›
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">{t('wallet.howItWorks', 'Comment ça marche')}</h3>
          <div className="mt-2 space-y-2 text-xs text-gray-600">
            <p>💳 <strong>Recharger</strong> — Effectuez un dépôt Mobile Money et fournissez le code de transaction. Un administrateur valide et crédite votre portefeuille.</p>
            <p>🛒 <strong>Acheter</strong> — Lors du checkout, choisissez "Payer avec mon solde HDMarket".</p>
            <p>💰 <strong>Retirer</strong> — Les vendeurs peuvent retirer leurs gains vers leur compte Mobile Money.</p>
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
                  value={withdrawRef}
                  onChange={(e) => setWithdrawRef(e.target.value)}
                  placeholder="ex: 06xxxxxx"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
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
                disabled={withdrawing || !withdrawAmount}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {withdrawing ? 'Envoi...' : 'Demander le retrait'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
