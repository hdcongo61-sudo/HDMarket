import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ClipboardList,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  User,
  X,
  AlertCircle,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  Store,
  Sparkles,
  Info,
  CreditCard,
  Receipt,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import OrderChat from '../components/OrderChat';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  cancelled: 'Commande annulée'
};

const STATUS_STYLES = {
  pending: { header: 'bg-gray-600', card: 'bg-gray-50 border-gray-200 text-gray-700' },
  confirmed: { header: 'bg-amber-600', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  delivering: { header: 'bg-blue-600', card: 'bg-blue-50 border-blue-200 text-blue-800' },
  delivered: { header: 'bg-emerald-600', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  cancelled: { header: 'bg-red-600', card: 'bg-red-50 border-red-200 text-red-800' }
};

const STATUS_ICONS = {
  pending: Clock,
  confirmed: Package,
  delivering: Truck,
  delivered: CheckCircle,
  cancelled: X
};

const STATUS_TABS = [
  { key: 'all', label: 'Toutes', icon: ClipboardList, count: null },
  { key: 'pending', label: 'En attente', icon: Clock, count: null },
  { key: 'confirmed', label: 'Confirmées', icon: Package, count: null },
  { key: 'delivering', label: 'En livraison', icon: Truck, count: null },
  { key: 'delivered', label: 'Livrées', icon: CheckCircle, count: null },
  { key: 'cancelled', label: 'Annulées', icon: X, count: null }
];

const PAGE_SIZE = 6;

const ORDER_FLOW = [
  {
    id: 'pending',
    label: 'Commande en attente',
    description: 'La commande est enregistrée et en attente de confirmation.',
    icon: Clock,
    color: 'gray'
  },
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'La commande est confirmée et prête pour la préparation.',
    icon: Package,
    color: 'amber'
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le colis est pris en charge par le livreur.',
    icon: Truck,
    color: 'blue'
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée avec succès.',
    icon: CheckCircle,
    color: 'emerald'
  },
  {
    id: 'cancelled',
    label: 'Commande annulée',
    description: 'Cette commande a été annulée et ne sera pas livrée.',
    icon: X,
    color: 'red'
  }
];

const formatOrderTimestamp = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const OrderProgress = ({ status }) => {
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-600">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Suivi de commande</h3>
      </div>
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200">
          <div
            className="absolute top-0 left-0 w-full bg-indigo-600 transition-all duration-500"
            style={{ height: `${(currentIndex / (ORDER_FLOW.length - 1)) * 100}%` }}
          />
        </div>
        
        <div className="space-y-6 relative">
          {ORDER_FLOW.map((step, index) => {
            const Icon = step.icon;
            const reached = currentIndex >= index;
            const isCurrent = currentIndex === index;
            const colorClasses = {
              gray: 'bg-gray-600',
              amber: 'bg-amber-600',
              blue: 'bg-blue-600',
              emerald: 'bg-emerald-600',
              red: 'bg-red-600'
            };
            const stepColor = colorClasses[step.color] || colorClasses.gray;

            return (
              <div key={step.id} className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    reached
                      ? `${stepColor} text-white shadow-lg scale-110`
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 pt-1">
                  <p
                    className={`text-sm font-bold mb-1 ${
                      reached ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-xs ${
                      reached ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function SellerOrders() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const externalLinkProps = useDesktopExternalLink();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState({ id: '', message: '' });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, byStatus: {} });
  const [statsLoading, setStatsLoading] = useState(false);
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});
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

  // Load order statistics
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data } = await api.get('/orders/seller?limit=1000');
        if (!active) return;
        const allOrders = Array.isArray(data) ? data : data?.items || [];
        const total = allOrders.length;
        const totalAmount = allOrders.reduce((sum, order) => {
          const items = order.items || [];
          const computed = items.reduce(
            (s, item) => s + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
            0
          );
          return sum + Number(order.totalAmount ?? computed);
        }, 0);
        const byStatus = allOrders.reduce((acc, order) => {
          const status = order.status || 'pending';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        setStats({ total, totalAmount, byStatus });
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    loadStats();
    return () => { active = false; };
  }, []);

  const loadUnreadCounts = async (orderIds) => {
    if (!orderIds || orderIds.length === 0 || !user?._id) return {};
    try {
      const counts = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const { data } = await api.get(`/orders/${orderId}/messages`);
            const unread = Array.isArray(data) ? data.filter(
              (msg) => String(msg.recipient?._id) === String(user._id) && !msg.readAt
            ) : [];
            return { orderId, count: unread.length };
          } catch {
            return { orderId, count: 0 };
          }
        })
      );
      return counts.reduce((acc, { orderId, count }) => {
        acc[orderId] = count;
        return acc;
      }, {});
    } catch {
      return {};
    }
  };

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
        
        // Load unread message counts
        const orderIds = items.map((order) => order._id);
        const unreadCounts = await loadUnreadCounts(orderIds);
        setOrderUnreadCounts(unreadCounts);
        
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
  }, [activeStatus, page, user?._id]);

  const handleStatusUpdate = async (orderId, nextStatus) => {
    setStatusUpdatingId(orderId);
    setStatusUpdateError({ id: '', message: '' });
    try {
      const { data } = await api.patch(`/orders/seller/${orderId}/status`, {
        status: nextStatus
      });
      setOrders((prev) => prev.map((order) => (order._id === orderId ? data : order)));
      showToast('Statut de la commande mis à jour.', { variant: 'success' });
      // Reload stats
      const { data: statsData } = await api.get('/orders/seller?limit=1000');
      const allOrders = Array.isArray(statsData) ? statsData : statsData?.items || [];
      const byStatus = allOrders.reduce((acc, order) => {
        const status = order.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      setStats((prev) => ({ ...prev, byStatus }));
    } catch (err) {
      const message =
        err.response?.data?.message || 'Impossible de mettre à jour le statut.';
      setStatusUpdateError({ id: orderId, message });
      showToast(message, { variant: 'error' });
    } finally {
      setStatusUpdatingId('');
    }
  };

  const openCancelModal = (orderId) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    setCancelModalOpen(false);
    setCancelOrderId(null);
    setCancelReason('');
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) return;
    
    // Validate reason before submitting
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      showToast('Veuillez fournir une raison d\'annulation (minimum 5 caractères).', { variant: 'error' });
      return;
    }
    
    setCancelLoading(true);
    try {
      const { data } = await api.post(`/orders/seller/${cancelOrderId}/cancel`, {
        reason: trimmedReason
      });
      setOrders((prev) => prev.map((order) => (order._id === cancelOrderId ? data : order)));
      showToast('Commande annulée avec succès. Le client a été notifié.', { variant: 'success' });
      closeCancelModal();
      // Reload stats
      const { data: statsData } = await api.get('/orders/seller?limit=1000');
      const allOrders = Array.isArray(statsData) ? statsData : statsData?.items || [];
      const byStatus = allOrders.reduce((acc, order) => {
        const status = order.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      setStats((prev) => ({ ...prev, byStatus }));
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.details?.[0] || 'Impossible d\'annuler la commande.';
      showToast(message, { variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  const emptyMessage =
    activeStatus === 'all'
      ? 'Aucune commande client pour le moment.'
      : `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`;

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="space-y-8">
            <div className="h-8 bg-gray-200 rounded-xl w-64 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-wide">Commandes clients</p>
                  <h1 className="text-3xl font-bold">Gestion des commandes</h1>
                </div>
              </div>
              <p className="text-white/90 text-sm max-w-2xl">
                Suivez les commandes passées sur vos produits, mettez à jour leur statut et gérez les livraisons.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Accueil
              </Link>
              <Link
                to="/my/stats"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all shadow-lg"
              >
                <TrendingUp className="w-4 h-4" />
                Statistiques
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-12">
        {/* Statistics Cards */}
        {!statsLoading && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-indigo-600">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total commandes</p>
              <p className="text-xs text-gray-500 mt-1">Toutes les commandes clients</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-600">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Chiffre d'affaires</p>
              <p className="text-xs text-gray-500 mt-1">Montant total des commandes</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-600">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.byStatus.pending || 0}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">En attente</p>
              <p className="text-xs text-gray-500 mt-1">Commandes en cours de traitement</p>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const isActive = tab.key === activeStatus;
              const to = tab.key === 'all' ? '/seller/orders' : `/seller/orders/${tab.key}`;
              const Icon = tab.icon;
              const count = tab.key === 'all' ? stats.total : stats.byStatus[tab.key] || 0;
              
              return (
                <Link
                  key={tab.key}
                  to={to}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Erreur de chargement</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <ClipboardList className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune commande</h3>
            <p className="text-sm text-gray-500 mb-6">{emptyMessage}</p>
            <Link
              to="/my"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Gérer mes annonces
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-6">
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
                const showPayment = Boolean(
                  paidAmount || order.paymentTransactionCode || order.paymentName
                );
                const StatusIcon = STATUS_ICONS[order.status] || Clock;
                const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;

                return (
                  <div
                    key={order._id}
                    className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                  >
                    {/* Order Header */}
                    <div className={`${statusStyle.header} text-white px-6 py-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Commande</p>
                            <h3 className="text-lg font-bold">#{order._id.slice(-6)}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wide">
                            {STATUS_LABELS[order.status]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Products List */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Package className="w-4 h-4 text-gray-500" />
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Articles commandés</h4>
                        </div>
                        <div className="space-y-3">
                          {orderItems.map((item, index) => (
                            <div
                              key={`${order._id}-${item.product || item.snapshot?.title || index}`}
                              className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                            >
                              {item.snapshot?.image || item.product?.images?.[0] ? (
                                <img
                                  src={item.snapshot?.image || item.product?.images?.[0]}
                                  alt={item.snapshot?.title || 'Produit'}
                                  className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-indigo-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  {item.product ? (
                                    <Link
                                      to={buildProductPath(item.product)}
                                      {...externalLinkProps}
                                      className="font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate"
                                    >
                                      {item.snapshot?.title || 'Produit'}
                                    </Link>
                                  ) : (
                                    <span className="font-bold text-gray-900">
                                      {item.snapshot?.title || 'Produit'}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                                    {formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                  <span>Quantité: {item.quantity || 1}</span>
                                  <span>•</span>
                                  <span>Prix unitaire: {formatCurrency(item.snapshot?.price || 0)}</span>
                                </div>
                                {item.snapshot?.confirmationNumber && (
                                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                                      Code: {item.snapshot.confirmationNumber}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer & Delivery Information */}
                        <div className="space-y-4">
                          {/* Delivery Code */}
                          {order.deliveryCode && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Code de livraison</h4>
                              </div>
                              <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Code pour le livreur</p>
                                <div className="flex items-center justify-center">
                                  <span className="text-4xl font-black text-indigo-900 tracking-wider font-mono">
                                    {order.deliveryCode}
                                  </span>
                                </div>
                                <p className="text-xs text-indigo-600 mt-3 text-center">
                                  Le client doit présenter ce code pour recevoir la commande
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Client</h4>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                            <p className="text-sm font-semibold text-gray-900">{order.customer?.name || 'Client'}</p>
                            {order.customer?.phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Phone className="w-3 h-3" />
                                <span>{order.customer.phone}</span>
                              </div>
                            )}
                            {order.customer?.email && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Mail className="w-3 h-3" />
                                <span>{order.customer.email}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Adresse de livraison</h4>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                            <p className="text-sm font-semibold text-gray-900">{order.deliveryAddress || 'Non renseignée'}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="w-3 h-3" />
                              <span>{order.deliveryCity || 'Ville non renseignée'}</span>
                            </div>
                            {order.deliveryGuy && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-xs">
                                  <Truck className="w-3 h-3 text-blue-600" />
                                  <span className="font-semibold text-gray-700">Livreur:</span>
                                  <span className="text-gray-600">{order.deliveryGuy.name || 'Non assigné'}</span>
                                  {order.deliveryGuy.phone && (
                                    <>
                                      <span>•</span>
                                      <span className="text-gray-600">{order.deliveryGuy.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {order.trackingNote && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-gray-500" />
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Note de suivi</h4>
                              </div>
                              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                                <p className="text-sm text-gray-700">{order.trackingNote}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Payment & Actions */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCard className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Informations de paiement</h4>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total commande</span>
                              <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
                            </div>
                            {showPayment && (
                              <>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                  <span className="text-sm text-gray-600">Acompte versé</span>
                                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(paidAmount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Reste à payer</span>
                                  <span className="text-sm font-semibold text-amber-700">{formatCurrency(remainingAmount)}</span>
                                </div>
                                {(order.paymentName || order.paymentTransactionCode) && (
                                  <div className="pt-2 border-t border-gray-200 space-y-1 text-xs text-gray-500">
                                    {order.paymentName && (
                                      <div className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        <span>Payeur: {order.paymentName}</span>
                                      </div>
                                    )}
                                    {order.paymentTransactionCode && (
                                      <div className="flex items-center gap-1">
                                        <Receipt className="w-3 h-3" />
                                        <span>Transaction: {order.paymentTransactionCode}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Cancellation Window Warning */}
                          {order.cancellationWindow?.isActive && order.status !== 'cancelled' && (
                            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                              <CancellationTimer
                                deadline={order.cancellationWindow.deadline}
                                remainingMs={order.cancellationWindow.remainingMs}
                                isActive={order.cancellationWindow.isActive}
                              />
                              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-100 border border-amber-200">
                                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                  <span className="font-semibold">Délai d'annulation actif :</span> Vous ne pouvez pas modifier le statut de cette commande pendant les 30 premières minutes. Le client peut annuler sa commande pendant ce délai.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Chat with Customer - Always visible */}
                          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                            <OrderChat 
                              order={order} 
                              buttonText="Contacter l'acheteur"
                              unreadCount={orderUnreadCounts[order._id] || 0}
                            />
                          </div>

                          {/* Status Update Actions */}
                          {order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-gray-500" />
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Mettre à jour le statut</h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(order._id, 'confirmed')}
                                  disabled={order.status !== 'pending' || statusUpdatingId === order._id || order.cancellationWindow?.isActive}
                                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <Package size={12} />
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(order._id, 'delivering')}
                                  disabled={order.status !== 'confirmed' || statusUpdatingId === order._id || order.cancellationWindow?.isActive}
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <Truck size={12} />
                                  En livraison
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(order._id, 'delivered')}
                                  disabled={order.status !== 'delivering' || statusUpdatingId === order._id || order.cancellationWindow?.isActive}
                                  className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <CheckCircle size={12} />
                                  Marquer livrée
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCancelModal(order._id)}
                                  disabled={order.status === 'delivered' || statusUpdatingId === order._id || order.cancellationWindow?.isActive}
                                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <X size={12} />
                                  Annuler
                                </button>
                              </div>
                              {statusUpdateError.id === order._id && (
                                <p className="text-xs text-red-600">{statusUpdateError.message}</p>
                              )}
                              {order.cancellationWindow?.isActive && (
                                <p className="text-xs text-amber-700 font-medium">
                                  ⏱️ Les modifications de statut sont temporairement désactivées pendant le délai d'annulation.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cancellation Info */}
                      {order.status === 'cancelled' && (
                        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-600">
                              <AlertCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-red-800">Commande annulée</p>
                              {order.cancelledAt && (
                                <p className="text-xs text-red-600 mt-1">
                                  Annulée le {formatOrderTimestamp(order.cancelledAt)}
                                </p>
                              )}
                            </div>
                          </div>
                          {order.cancellationReason && (
                            <div className="p-4 rounded-xl border border-red-200 bg-red-100/50">
                              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Raison de l'annulation</p>
                              <p className="text-sm text-red-800 font-medium">{order.cancellationReason}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Progress Timeline - Only show if not cancelled */}
                      {order.status !== 'cancelled' && <OrderProgress status={order.status} />}

                      {/* Timestamps */}
                      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span className="font-semibold">Créée:</span>
                          <span>{formatOrderTimestamp(order.createdAt)}</span>
                        </div>
                        {order.shippedAt && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3 h-3" />
                            <span className="font-semibold">Expédiée:</span>
                            <span>{formatOrderTimestamp(order.shippedAt)}</span>
                          </div>
                        )}
                        {order.deliveredAt && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3" />
                            <span className="font-semibold">Livrée:</span>
                            <span>{formatOrderTimestamp(order.deliveredAt)}</span>
                          </div>
                        )}
                        {order.cancelledAt && (
                          <div className="flex items-center gap-1.5">
                            <X className="w-3 h-3" />
                            <span className="font-semibold">Annulée:</span>
                            <span>{formatOrderTimestamp(order.cancelledAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cancel Order Modal */}
            {cancelModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
                <div
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                  onClick={closeCancelModal}
                />
                <div
                  className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 p-6"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-600">
                        <AlertCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Annuler la commande</h3>
                        <p className="text-xs text-gray-500">Commande #{cancelOrderId?.slice(-6)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeCancelModal}
                      className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      aria-label="Fermer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Attention</p>
                      <p className="text-xs text-amber-700">
                        Cette action est irréversible. Le client sera notifié de l'annulation.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Raison de l'annulation <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Expliquez la raison de l'annulation (minimum 5 caractères)..."
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                        rows={4}
                        required
                        minLength={5}
                      />
                      {cancelReason.length > 0 && cancelReason.length < 5 && (
                        <p className="mt-1 text-xs text-red-600">
                          La raison doit contenir au moins 5 caractères.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeCancelModal}
                        disabled={cancelLoading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelOrder}
                        disabled={cancelLoading || !cancelReason.trim() || cancelReason.trim().length < 5}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm text-gray-600">
                  Page <span className="font-bold text-gray-900">{page}</span> sur{' '}
                  <span className="font-bold text-gray-900">{meta.totalPages}</span> —{' '}
                  <span className="font-bold text-gray-900">{meta.total}</span> commande{meta.total > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
