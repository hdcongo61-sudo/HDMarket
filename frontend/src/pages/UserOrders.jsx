import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { ClipboardList, Package, Truck, CheckCircle, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { buildProductPath } from '../utils/links';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée'
};

const STATUS_STYLES = {
  pending: 'border-gray-200 bg-gray-50 text-gray-700',
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800'
};

const STATUS_TABS = [
  { key: 'all', label: 'Toutes les commandes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'delivering', label: 'En cours de livraison' },
  { key: 'delivered', label: 'Livrées' }
];

const PAGE_SIZE = 6;

const ORDER_FLOW = [
  {
    id: 'pending',
    label: 'Commande en attente',
    description: 'Votre commande est enregistrée et en attente de validation.',
    icon: Clock
  },
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'Un gestionnaire a validé la commande et prépare l’expédition.',
    icon: Package
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le colis est pris en charge par le livreur et se dirige vers vous.',
    icon: Truck
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée et archivée par nos équipes.',
    icon: CheckCircle
  }
];

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

const OrderProgress = ({ status }) => {
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="mt-4 border border-gray-100 rounded-2xl p-3 bg-gray-50">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suivi commande</p>
      <div className="space-y-4">
        {ORDER_FLOW.map((step, index) => {
          const Icon = step.icon;
          const reached = currentIndex >= index;
          const isCurrent = currentIndex === index;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                  reached ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-gray-200 text-gray-400 bg-white'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                {step.label}
                {isCurrent && (
                  <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {step.id === 'delivered'
                      ? 'Terminée'
                      : step.id === 'pending'
                      ? 'En attente'
                      : 'En cours'}
                  </span>
                )}
                  {!isCurrent && reached && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Terminée
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const { status: statusParam } = useParams();

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
        const { data } = await api.get(`/orders?${params.toString()}`);
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
        setError(err.response?.data?.message || 'Impossible de charger vos commandes.');
        setOrders([]);
        setMeta({ total: 0, totalPages: 1 });
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [activeStatus, page]);

  const emptyMessage =
    activeStatus === 'all'
      ? 'Vous n’avez pas encore de commande.'
      : `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
              Mes commandes
            </h1>
            <p className="text-sm text-gray-500">Retrouvez ici vos commandes enregistrées par nos équipes.</p>
          </div>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-500">
            Retour à l’accueil
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === activeStatus;
            const to = tab.key === 'all' ? '/orders' : `/orders/${tab.key}`;
            return (
              <Link
                key={tab.key}
                to={to}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
              const orderItems =
                order.items && order.items.length
                  ? order.items
                  : order.productSnapshot
                  ? [{ snapshot: order.productSnapshot, quantity: 1 }]
                  : [];
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
              const showPayment = Boolean(
                paidAmount || order.paymentTransactionCode || order.paymentName
              );
              const createdBySelf =
                order.createdBy?._id && order.customer?._id ? order.createdBy._id === order.customer._id : false;
              const createdByLabel = createdBySelf
                ? 'Gestionnaire : Vous'
                : `Gestionnaire : ${order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket'}`;
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
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <div className="inline-flex items-center gap-1 text-gray-600">
                          <ShieldCheck size={13} className="text-indigo-500" />
                          <span>{createdByLabel}</span>
                        </div>
                        <span className="hidden sm:block text-gray-300">•</span>
                        <span className="font-semibold text-gray-700">Statut : {STATUS_LABELS[order.status]}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status]}`}>
                      {order.status === 'pending' && <Clock size={14} />}
                      {order.status === 'confirmed' && <Package size={14} />}
                      {order.status === 'delivering' && <Truck size={14} />}
                      {order.status === 'delivered' && <CheckCircle size={14} />}
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-900">Livraison</p>
                      <p>{order.deliveryAddress}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={13} />
                        {order.deliveryCity}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">Suivi</p>
                      {order.trackingNote ? (
                        <p className="text-sm">{order.trackingNote}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Aucune note ajoutée pour le moment.</p>
                      )}
                    </div>
                  </div>

                  {showPayment && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                      <div>
                        <p className="font-semibold text-gray-900">Paiement</p>
                        <p>Acompte versé : {Number(paidAmount).toLocaleString()} FCFA</p>
                        <p>Reste à payer : {Number(remainingAmount).toLocaleString()} FCFA</p>
                      </div>
                      <div className="space-y-1 text-xs text-gray-500">
                        {order.paymentName && <p>Payeur : {order.paymentName}</p>}
                        {order.paymentTransactionCode && (
                          <p>Code transaction : {order.paymentTransactionCode}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <OrderProgress status={order.status} />

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
