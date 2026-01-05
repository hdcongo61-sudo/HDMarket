import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ClipboardList, Package, Truck, CheckCircle, MapPin, Clock, User } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { buildProductPath } from '../utils/links';

const STATUS_LABELS = {
  confirmed: 'Confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Livrée'
};

const STATUS_STYLES = {
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800'
};

const STATUS_TABS = [
  { key: 'all', label: 'Toutes les commandes' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'delivering', label: 'En cours de livraison' },
  { key: 'delivered', label: 'Livrées' }
];

const PAGE_SIZE = 6;

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

const formatOrderTimestamp = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

export default function SellerOrders() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState({ id: '', message: '' });
  const { status: statusParam } = useParams();

  if (user?.role === 'admin') {
    return <Navigate to="/admin/orders" replace />;
  }

  const activeStatus = useMemo(() => {
    if (!statusParam) return 'all';
    return Object.keys(STATUS_LABELS).includes(statusParam) ? statusParam : 'all';
  }, [statusParam]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus]);

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', PAGE_SIZE);
        if (activeStatus !== 'all') {
          params.set('status', activeStatus);
        }
        const { data } = await api.get(`/orders/seller?${params.toString()}`);
        const items = Array.isArray(data) ? data : data?.items || [];
        const totalPages = Math.max(1, Number(data?.totalPages) || 1);
        setOrders(items);
        setMeta({
          total: data?.total ?? items.length,
          totalPages
        });
        const incomingPage = Number(data?.page);
        if (Number.isFinite(incomingPage) && incomingPage > 0 && incomingPage !== page) {
          setPage(incomingPage);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger les commandes clients.');
        setOrders([]);
        setMeta({ total: 0, totalPages: 1 });
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [activeStatus, page]);

  const handleStatusUpdate = async (orderId, nextStatus) => {
    setStatusUpdatingId(orderId);
    setStatusUpdateError({ id: '', message: '' });
    try {
      const { data } = await api.patch(`/orders/seller/${orderId}/status`, {
        status: nextStatus
      });
      setOrders((prev) => prev.map((order) => (order._id === orderId ? data : order)));
      showToast('Statut de la commande mis à jour.', { variant: 'success' });
    } catch (err) {
      const message =
        err.response?.data?.message || 'Impossible de mettre à jour le statut.';
      setStatusUpdateError({ id: orderId, message });
      showToast(message, { variant: 'error' });
    } finally {
      setStatusUpdatingId('');
    }
  };

  const emptyMessage =
    activeStatus === 'all'
      ? 'Aucune commande client pour le moment.'
      : `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
              Commandes clients
            </h1>
            <p className="text-sm text-gray-500">
              Suivez les commandes passées sur vos produits et mettez à jour leur statut.
            </p>
          </div>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-500">
            Retour à l’accueil
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === activeStatus;
            const to = tab.key === 'all' ? '/seller/orders' : `/seller/orders/${tab.key}`;
            return (
              <Link
                key={tab.key}
                to={to}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement des commandes…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => {
              const orderItems = Array.isArray(order.items) ? order.items : [];
              const computedTotal = orderItems.reduce(
                (sum, item) =>
                  sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
                0
              );
              const totalAmount = Number(order.totalAmount ?? computedTotal);
              const paidAmount = Number(order.paidAmount || 0);
              const remainingAmount = Number(
                order.remainingAmount ?? Math.max(0, totalAmount - paidAmount)
              );
              return (
                <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Commande #{order._id.slice(-6)}</p>
                      <div className="text-sm text-gray-600 space-y-1 mt-1">
                        {orderItems.map((item) => (
                          <div
                            key={`${order._id}-${item.product || item.snapshot?.title}`}
                            className="space-y-0.5"
                          >
                            <div className="flex items-center gap-2">
                              {item.product ? (
                                <Link
                                  to={buildProductPath(item.product)}
                                  className="font-semibold text-gray-900 hover:text-indigo-600"
                                >
                                  {item.snapshot?.title || 'Produit'}
                                </Link>
                              ) : (
                                <span className="font-semibold text-gray-900">
                                  {item.snapshot?.title || 'Produit'}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()} FCFA
                              </span>
                            </div>
                            {item.snapshot?.confirmationNumber && (
                              <span className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wide">
                                Code produit : {item.snapshot.confirmationNumber}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status]}`}>
                      {order.status === 'confirmed' && <Package size={14} />}
                      {order.status === 'delivering' && <Truck size={14} />}
                      {order.status === 'delivered' && <CheckCircle size={14} />}
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">Client</p>
                      <p className="flex items-center gap-2">
                        <User size={14} className="text-gray-500" />
                        {order.customer?.name || 'Client'}
                      </p>
                      <p className="text-xs text-gray-500">{order.customer?.phone}</p>
                      <p className="text-xs text-gray-500">{order.customer?.email}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Livraison</p>
                      <p>{order.deliveryAddress}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={13} />
                        {order.deliveryCity}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Paiement
                    </p>
                    <p>
                      Acompte versé:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(paidAmount)} FCFA
                      </span>
                    </p>
                    <p>
                      Reste à payer:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(remainingAmount)} FCFA
                      </span>
                    </p>
                    <p>Nom du payeur: {order.paymentName || 'Non renseigné'}</p>
                    <p>Transaction: {order.paymentTransactionCode || 'Non renseigné'}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mettre à jour le statut
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(order._id, 'confirmed')}
                        disabled={order.status === 'confirmed' || statusUpdatingId === order._id}
                        className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                      >
                        <Package size={12} />
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(order._id, 'delivering')}
                        disabled={order.status !== 'confirmed' || statusUpdatingId === order._id}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Truck size={12} />
                        En cours de livraison
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(order._id, 'delivered')}
                        disabled={order.status === 'delivered' || statusUpdatingId === order._id}
                        className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        <CheckCircle size={12} />
                        Marquer livrée
                      </button>
                    </div>
                    {statusUpdateError.id === order._id && (
                      <p className="text-xs text-red-600">{statusUpdateError.message}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      Créée le {formatOrderTimestamp(order.createdAt)}
                    </div>
                    {order.shippedAt && (
                      <div className="flex items-center gap-1">
                        <Truck size={12} />
                        Expédiée le {formatOrderTimestamp(order.shippedAt)}
                      </div>
                    )}
                    {order.deliveredAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle size={12} />
                        Livrée le {formatOrderTimestamp(order.deliveredAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {meta.totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Page {page} sur {meta.totalPages} — {meta.total} commande{meta.total > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
