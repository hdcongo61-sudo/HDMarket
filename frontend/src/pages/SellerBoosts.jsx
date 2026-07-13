import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, Smartphone, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import api from '../services/api';
import BoostRequestForm from '../components/BoostRequestForm';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 border-amber-200 text-amber-700',
  APPROVED: 'bg-sky-50 border-sky-200 text-sky-700',
  ACTIVE: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  REJECTED: 'bg-red-50 border-red-200 text-red-700',
  EXPIRED: 'bg-gray-100 border-gray-200 text-gray-700'
};

const STATUS_LABELS = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  ACTIVE: 'Active',
  REJECTED: 'Rejetée',
  EXPIRED: 'Expirée'
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

export default function SellerBoosts() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, requestsRes] = await Promise.all([
        api.get('/products'),
        api.get('/boosts/my/requests', { params: { page: 1, limit: 30 } })
      ]);
      const productItems = Array.isArray(productsRes?.data) ? productsRes.data : [];
      const requestItems = Array.isArray(requestsRes?.data?.items) ? requestsRes.data.items : [];
      setProducts(productItems);
      setRequests(requestItems);
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de charger les données boost.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = requests.length;
    const active = requests.filter((item) => item.status === 'ACTIVE').length;
    const pending = requests.filter((item) => item.status === 'PENDING').length;
    const revenue = requests
      .filter((item) => ['ACTIVE', 'EXPIRED'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    return { total, active, pending, revenue };
  }, [requests]);

  const handleSubmitted = async () => {
    showToast('Demande de boost envoyée.', { variant: 'success' });
    await load();
  };

  return (
    <div className="hd-my-flow hd-commerce-shell min-h-screen pb-8 pt-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 sm:gap-6 sm:px-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3">
            <Link
              to="/my"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFB000] to-[#e85d00] text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Boost interne</h1>
                <p className="text-sm font-medium text-gray-500">Gérez vos demandes de boost multi-produits.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Demandes</p>
            <p className="mt-1 text-xl font-black text-gray-900 sm:text-2xl">{stats.total}</p>
          </article>
          <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Actives</p>
            <p className="mt-1 text-xl font-black text-emerald-700 sm:text-2xl">{stats.active}</p>
          </article>
          <article className="rounded-xl border border-amber-100 bg-amber-50 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">En attente</p>
            <p className="mt-1 text-xl font-black text-amber-700 sm:text-2xl">{stats.pending}</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">CA boost</p>
            <p className="mt-1 truncate text-base font-black text-[#e85d00] sm:text-xl">{formatCurrency(stats.revenue)}</p>
          </article>
        </section>

        <BoostRequestForm products={products} onSubmitted={handleSubmitted} />

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="border-l-[3px] border-[#e85d00] pl-2.5 text-base font-black text-gray-900 sm:text-lg">Historique des demandes</h2>
            <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              <TrendingUp className="h-3.5 w-3.5" />
              {requests.length}
            </span>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>
          ) : !requests.length ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">Aucune demande de boost pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((item, idx) => (
                <article
                  key={item.id || item._id || `${item.boostType || 'boost'}-${item.createdAt || idx}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-2 text-sm font-black text-gray-900">
                        <Sparkles className="h-4 w-4 shrink-0 text-[#e85d00]" />
                        <span className="truncate">{item.boostType}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '-'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[item.status] || STATUS_STYLES.EXPIRED}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Produits</p>
                      <p className="font-black text-gray-900">{item.productIds?.length || 0}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Ville</p>
                      <p className="truncate font-black text-gray-900">{item.city || 'Global'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Durée</p>
                      <p className="font-black text-gray-900">{item.duration} j</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Total</p>
                      <p className="truncate font-black text-[#e85d00]">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>

                  {(() => {
                    const isWallet = item.paymentMethod === 'wallet';
                    const payStatusStyle = item.paymentStatus === 'paid'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : item.paymentStatus === 'refunded'
                        ? 'border-gray-200 bg-gray-100 text-gray-600'
                        : 'border-amber-200 bg-amber-50 text-amber-700';
                    return (
                      <div className={`mt-3 rounded-lg border p-2.5 ${isWallet ? 'border-orange-100 bg-orange-50' : 'border-indigo-100 bg-indigo-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-black text-white ${isWallet ? 'bg-[#e85d00]' : 'bg-indigo-600'}`}>
                            {isWallet ? <Wallet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                            {isWallet ? 'Portefeuille HDMarket' : 'Mobile Money'}
                          </span>
                          <span className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-bold ${payStatusStyle}`}>
                            {item.paymentStatus === 'paid' ? 'Payé' : item.paymentStatus === 'refunded' ? 'Remboursé' : 'À valider'}
                          </span>
                        </div>
                        {isWallet ? (
                          <p className="mt-2 text-xs font-medium text-gray-600">Montant débité directement de votre portefeuille HDMarket.</p>
                        ) : (
                          <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-gray-600 sm:grid-cols-2">
                            <p>Opérateur: <span className="font-semibold text-gray-800">{item.paymentOperator || '-'}</span></p>
                            <p>Expéditeur: <span className="font-semibold text-gray-800">{item.paymentSenderName || '-'}</span></p>
                            <p className="sm:col-span-2">
                              ID transaction: <span className="font-mono font-semibold text-gray-800">{item.paymentTransactionId || '-'}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {item.rejectionReason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                      Motif rejet: {item.rejectionReason}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
