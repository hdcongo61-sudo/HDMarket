import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, Clock3, Sparkles } from 'lucide-react';
import api from '../services/api';
import BoostRequestForm from '../components/BoostRequestForm';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 border-amber-200 text-amber-700',
  APPROVED: 'bg-blue-50 border-blue-200 text-blue-700',
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
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-600 font-medium">
              <ArrowLeft className="h-4 w-4" /> Retour au dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Boost interne</h1>
            <p className="text-sm text-gray-500">Gérez vos demandes de boost multi-produits.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase">Demandes</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase">Actives</p>
            <p className="text-xl font-bold text-emerald-700">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase">En attente</p>
            <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase">CA boost</p>
            <p className="text-xl font-bold text-indigo-700">{formatCurrency(stats.revenue)}</p>
          </div>
        </div>

        <BoostRequestForm products={products} onSubmitted={handleSubmitted} />

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900">Historique des demandes</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !requests.length ? (
            <p className="text-sm text-gray-500">Aucune demande de boost pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <article key={item.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-semibold text-gray-900">{item.boostType}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[item.status] || STATUS_STYLES.EXPIRED}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-gray-600">
                    <p>Produits: <span className="font-semibold">{item.productIds?.length || 0}</span></p>
                    <p>Ville: <span className="font-semibold">{item.city || 'Global'}</span></p>
                    <p>Durée: <span className="font-semibold">{item.duration} j</span></p>
                    <p>Total: <span className="font-semibold">{formatCurrency(item.totalPrice)}</span></p>
                    <p className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '-'}</span>
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>
                      Opérateur: <span className="font-semibold text-gray-800">{item.paymentOperator || '-'}</span>
                    </p>
                    <p>
                      Expéditeur: <span className="font-semibold text-gray-800">{item.paymentSenderName || '-'}</span>
                    </p>
                    <p>
                      ID transaction:{' '}
                      <span className="font-semibold font-mono text-gray-800">{item.paymentTransactionId || '-'}</span>
                    </p>
                  </div>
                  {item.rejectionReason && (
                    <p className="mt-2 text-xs text-red-600">Motif rejet: {item.rejectionReason}</p>
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
