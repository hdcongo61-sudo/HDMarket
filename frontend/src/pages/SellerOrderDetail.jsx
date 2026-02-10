import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import {
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
  Info,
  CreditCard,
  Receipt,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import OrderChat from '../components/OrderChat';
import { useToast } from '../context/ToastContext';

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

const ORDER_FLOW = [
  { id: 'pending', label: 'Commande en attente', description: 'En attente de confirmation.', icon: Clock, color: 'gray' },
  { id: 'confirmed', label: 'Commande confirmée', description: 'Prête pour la préparation.', icon: Package, color: 'amber' },
  { id: 'delivering', label: 'En cours de livraison', description: 'Colis pris en charge.', icon: Truck, color: 'blue' },
  { id: 'delivered', label: 'Commande terminée', description: 'Livrée avec succès.', icon: CheckCircle, color: 'emerald' },
  { id: 'cancelled', label: 'Commande annulée', description: 'Cette commande a été annulée.', icon: X, color: 'red' }
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
  const colorClasses = { gray: 'bg-gray-600', amber: 'bg-amber-600', blue: 'bg-blue-600', emerald: 'bg-emerald-600', red: 'bg-red-600' };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-600">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Suivi de commande</h3>
      </div>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200">
          <div className="absolute top-0 left-0 w-full bg-indigo-600 transition-all duration-500" style={{ height: `${(currentIndex / (ORDER_FLOW.length - 1)) * 100}%` }} />
        </div>
        <div className="space-y-6 relative">
          {ORDER_FLOW.filter((s) => s.id !== 'cancelled').map((step, index) => {
            const Icon = step.icon;
            const reached = currentIndex >= index;
            return (
              <div key={step.id} className="flex items-start gap-4 relative">
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${reached ? `${colorClasses[step.color] || 'bg-gray-600'} border-transparent text-white` : 'border-gray-300 text-gray-400 bg-white'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 pt-1">
                  <p className={`text-sm font-bold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>{step.label}</p>
                  <p className={`text-xs ${reached ? 'text-gray-600' : 'text-gray-400'}`}>{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function SellerOrderDetail() {
  const { orderId } = useParams();
  const { showToast } = useToast();
  const externalLinkProps = useDesktopExternalLink();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState({ id: '', message: '' });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/orders/seller/detail/${orderId}`);
      setOrder(data);
      const { data: messages } = await api.get(`/orders/${orderId}/messages`);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const unread = Array.isArray(messages) ? messages.filter((m) => String(m.recipient?._id) === String(user?._id) && !m.readAt) : [];
      setUnreadCount(unread.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Commande introuvable.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStatusUpdate = async (nextStatus) => {
    if (!order) return;
    setStatusUpdatingId(order._id);
    setStatusUpdateError({ id: '', message: '' });
    try {
      const { data } = await api.patch(`/orders/seller/${order._id}/status`, { status: nextStatus });
      setOrder(data);
      showToast('Statut mis à jour.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de mettre à jour le statut.';
      setStatusUpdateError({ id: order._id, message });
      showToast(message, { variant: 'error' });
    } finally {
      setStatusUpdatingId('');
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim() || cancelReason.trim().length < 5) return;
    setCancelLoading(true);
    try {
      const { data } = await api.post(`/orders/seller/${order._id}/cancel`, { reason: cancelReason.trim() });
      setOrder(data);
      showToast('Commande annulée. Le client a été notifié.', { variant: 'success' });
      setCancelModalOpen(false);
      setCancelReason('');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.details?.[0] || 'Impossible d\'annuler la commande.';
      showToast(message, { variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Link to="/seller/orders" className="inline-flex items-center gap-2 text-indigo-600 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>
        <p className="text-red-600">{error || 'Commande introuvable.'}</p>
      </div>
    );
  }

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const showPayment = Boolean(paidAmount || order.paymentTransactionCode || order.paymentName);
  const StatusIcon = STATUS_ICONS[order.status] || Clock;
  const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to="/seller/orders" className="inline-flex items-center gap-2 text-indigo-600 font-medium mb-4 hover:text-indigo-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>

        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
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
              <span className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-bold uppercase">{STATUS_LABELS[order.status]}</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Articles commandés</h4>
              </div>
              <div className="space-y-3">
                {orderItems.map((item, index) => (
                  <div key={`${order._id}-${index}`} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    {item.snapshot?.image || item.product?.images?.[0] ? (
                      <img src={item.snapshot?.image || item.product?.images?.[0]} alt={item.snapshot?.title || 'Produit'} className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-indigo-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-1">
                        {item.product ? (
                          <Link to={buildProductPath(item.product)} {...externalLinkProps} className="font-bold text-gray-900 hover:text-indigo-600 truncate">
                            {item.snapshot?.title || 'Produit'}
                          </Link>
                        ) : (
                          <span className="font-bold text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                        )}
                        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                        <span>Quantité: {item.quantity || 1}</span>
                        <span>Prix unitaire: {formatCurrency(item.snapshot?.price || 0)}</span>
                      </div>
                      {item.snapshot?.confirmationNumber && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">Code: {item.snapshot.confirmationNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.deliveryCode && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /> Code de livraison</h4>
                  <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                    <p className="text-xs font-semibold text-indigo-700 uppercase mb-2">Code pour le livreur</p>
                    <div className="text-4xl font-black text-indigo-900 tracking-wider font-mono text-center">{order.deliveryCode}</div>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><User className="w-4 h-4 text-gray-500" /> Client</h4>
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{order.customer?.name || 'Client'}</p>
                  {order.customer?.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{order.customer.phone}</p>}
                  {order.customer?.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{order.customer.email}</p>}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /> Adresse de livraison</h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{order.deliveryAddress || 'Non renseignée'}</p>
                <p className="text-xs text-gray-500">{order.deliveryCity || 'Ville non renseignée'}</p>
                {order.deliveryGuy && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs">
                    <Truck className="w-3 h-3 text-blue-600 inline mr-1" />
                    <span className="font-semibold">Livreur:</span> {order.deliveryGuy.name || 'Non assigné'}
                    {order.deliveryGuy.phone && ` • ${order.deliveryGuy.phone}`}
                  </div>
                )}
              </div>
            </div>

            {order.trackingNote && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-gray-500" /> Note de suivi</h4>
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50"><p className="text-sm text-gray-700">{order.trackingNote}</p></div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-500" /> Paiement</h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total commande</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
                </div>
                {showPayment && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Acompte versé</span>
                      <span className="text-sm font-semibold text-emerald-700">{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reste à payer</span>
                      <span className="text-sm font-semibold text-amber-700">{formatCurrency(remainingAmount)}</span>
                    </div>
                    {(order.paymentName || order.paymentTransactionCode) && (
                      <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                        {order.paymentName && <p>Payeur: {order.paymentName}</p>}
                        {order.paymentTransactionCode && <p>Transaction: {order.paymentTransactionCode}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

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
                    <span className="font-semibold">Délai d'annulation actif :</span> Vous ne pouvez pas modifier le statut pendant les 30 premières minutes.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <OrderChat order={order} buttonText="Contacter l'acheteur" unreadCount={unreadCount} />
            </div>

            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Mettre à jour le statut</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleStatusUpdate('confirmed')} disabled={order.status !== 'pending' || statusUpdatingId === order._id || order.cancellationWindow?.isActive} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                    <Package size={12} /> Confirmer
                  </button>
                  <button type="button" onClick={() => handleStatusUpdate('delivering')} disabled={order.status !== 'confirmed' || statusUpdatingId === order._id || order.cancellationWindow?.isActive} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                    <Truck size={12} /> En livraison
                  </button>
                  <button type="button" onClick={() => handleStatusUpdate('delivered')} disabled={order.status !== 'delivering' || statusUpdatingId === order._id || order.cancellationWindow?.isActive} className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">
                    <CheckCircle size={12} /> Marquer livrée
                  </button>
                  <button type="button" onClick={() => setCancelModalOpen(true)} disabled={order.status === 'delivered' || statusUpdatingId === order._id || order.cancellationWindow?.isActive} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                    <X size={12} /> Annuler
                  </button>
                </div>
                {statusUpdateError.id === order._id && <p className="text-xs text-red-600">{statusUpdateError.message}</p>}
              </div>
            )}

            {order.status === 'cancelled' && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-600">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-800">Commande annulée</p>
                    {order.cancelledAt && <p className="text-xs text-red-600 mt-1">Annulée le {formatOrderTimestamp(order.cancelledAt)}</p>}
                  </div>
                </div>
                {order.cancellationReason && (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-100/50">
                    <p className="text-xs font-semibold text-red-700 uppercase mb-2">Raison</p>
                    <p className="text-sm text-red-800 font-medium">{order.cancellationReason}</p>
                  </div>
                )}
              </div>
            )}

            {order.status !== 'cancelled' && <OrderProgress status={order.status} />}

            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Créée: {formatOrderTimestamp(order.createdAt)}</span>
              {order.shippedAt && <span className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> Expédiée: {formatOrderTimestamp(order.shippedAt)}</span>}
              {order.deliveredAt && <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Livrée: {formatOrderTimestamp(order.deliveredAt)}</span>}
            </div>
          </div>
        </div>
      </div>

      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCancelModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-600">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Annuler la commande</h3>
                  <p className="text-xs text-gray-500">Commande #{order._id?.slice(-6)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCancelModalOpen(false)} className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Attention</p>
                <p className="text-xs text-amber-700">Cette action est irréversible. Le client sera notifié.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Raison de l'annulation <span className="text-red-600">*</span></label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Expliquez la raison (minimum 5 caractères)..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={4}
                  minLength={5}
                />
                {cancelReason.length > 0 && cancelReason.length < 5 && <p className="mt-1 text-xs text-red-600">Minimum 5 caractères.</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCancelModalOpen(false)} disabled={cancelLoading} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Annuler
                </button>
                <button type="button" onClick={handleCancelOrder} disabled={cancelLoading || !cancelReason.trim() || cancelReason.trim().length < 5} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
