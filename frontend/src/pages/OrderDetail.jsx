import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  ShieldCheck,
  DollarSign,
  User,
  Mail,
  Calendar,
  Download,
  Store,
  Sparkles,
  X,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Info,
  CreditCard,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';
import CancellationTimer from '../components/CancellationTimer';
import EditAddressModal from '../components/EditAddressModal';
import OrderChat from '../components/OrderChat';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';

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
  { id: 'pending', label: 'Commande en attente', description: 'Votre commande est enregistrée.', icon: Clock, color: 'gray' },
  { id: 'confirmed', label: 'Commande confirmée', description: 'Validation et préparation.', icon: Package, color: 'amber' },
  { id: 'delivering', label: 'En cours de livraison', description: 'Le colis est en route.', icon: Truck, color: 'blue' },
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
  const colorClasses = { gray: 'bg-gray-600', amber: 'bg-amber-600', blue: 'bg-blue-600', emerald: 'bg-emerald-600' };
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
          <div
            className="absolute top-0 left-0 w-full bg-indigo-600 transition-all duration-500"
            style={{ height: `${(currentIndex / (ORDER_FLOW.length - 1)) * 100}%` }}
          />
        </div>
        <div className="space-y-6 relative">
          {ORDER_FLOW.filter((s) => s.id !== 'cancelled').map((step, index) => {
            const Icon = step.icon;
            const reached = currentIndex >= index;
            const isCurrent = currentIndex === index;
            return (
              <div key={step.id} className="flex items-start gap-4 relative">
                <div
                  className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    reached ? `${colorClasses[step.color] || 'bg-gray-600'} border-transparent text-white` : 'border-gray-300 text-gray-400 bg-white'
                  }`}
                >
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

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = React.useContext(AuthContext);
  const { addItem } = React.useContext(CartContext);
  const externalLinkProps = useDesktopExternalLink();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [skipLoadingId, setSkipLoadingId] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [suggestionsProducts, setSuggestionsProducts] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const isMobile = useIsMobile();

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/orders/detail/${orderId}`);
      setOrder(data);
      const { data: messages } = await api.get(`/orders/${orderId}/messages`);
      const unread = Array.isArray(messages) ? messages.filter((m) => String(m.recipient?._id) === String(user?._id) && !m.readAt) : [];
      setUnreadCount(unread.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Commande introuvable.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, user?._id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Load suggestions / similar products for mobile bottom section
  useEffect(() => {
    if (!order?.items?.length && !order?.productSnapshot) return;
    const orderProductIds = new Set(
      (order?.items || []).map((i) => i.product?._id || i.product).filter(Boolean).map(String)
    );
    if (order?.productSnapshot && order?.product) {
      orderProductIds.add(String(order.product._id || order.product));
    }
    let active = true;
    setSuggestionsLoading(true);
    const category = order?.items?.[0]?.product?.category || order?.items?.[0]?.product?.category || null;
    api
      .get('/products/public', {
        params: { limit: 12, sort: 'new', ...(category ? { category } : {}) }
      })
      .then((res) => {
        if (!active) return;
        const raw = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.data || [];
        const filtered = raw.filter((p) => p?._id && !orderProductIds.has(String(p._id)));
        setSuggestionsProducts(filtered.slice(0, 10));
      })
      .catch(() => {
        if (active) setSuggestionsProducts([]);
      })
      .finally(() => {
        if (active) setSuggestionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [order?._id, order?.items?.length]);

  const handleSkipCancellationWindow = async () => {
    if (!order || !confirm('En confirmant, vous autorisez le vendeur à traiter immédiatement cette commande.')) return;
    setSkipLoadingId(order._id);
    try {
      const { data } = await api.post(`/orders/${order._id}/skip-cancellation-window`);
      setOrder(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Impossible de lever le délai.');
    } finally {
      setSkipLoadingId(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return;
    try {
      const { data } = await api.patch(`/orders/${order._id}/status`, { status: 'cancelled' });
      setOrder(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Impossible d\'annuler la commande.');
    }
  };

  const handleSaveAddress = async (addressData) => {
    if (!order) return;
    try {
      const { data } = await api.patch(`/orders/${order._id}/address`, addressData);
      setOrder(data);
      setEditAddressModalOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const handleReorder = async () => {
    if (!order?.items?.length) return;
    setReordering(true);
    const addedItems = [];
    const failedItems = [];
    try {
      for (const item of order.items) {
        const productId = item.product?._id || item.product;
        const quantity = item.quantity || 1;
        if (!productId) {
          failedItems.push(item.snapshot?.title || 'Produit inconnu');
          continue;
        }
        try {
          await addItem(productId, quantity);
          addedItems.push(item.snapshot?.title || 'Produit');
        } catch {
          failedItems.push(item.snapshot?.title || 'Produit inconnu');
        }
      }
      if (addedItems.length > 0) {
        const message = failedItems.length > 0
          ? `${addedItems.length} article(s) ajouté(s). ${failedItems.length} non disponible(s).`
          : 'Tous les articles ont été ajoutés au panier !';
        alert(message);
        navigate('/cart');
      } else if (failedItems.length > 0) {
        alert('Aucun article disponible pour le moment.');
      }
    } catch {
      alert('Erreur lors de l\'ajout au panier.');
    } finally {
      setReordering(false);
    }
  };

  const openOrderPdf = (o) => {
    const orderItems = o?.items?.length ? o.items : o?.productSnapshot ? [{ snapshot: o.productSnapshot, quantity: 1 }] : [];
    const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
    const orderTotal = Number(o?.totalAmount ?? computedTotal);
    const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rowsHtml = orderItems
      .map((item, idx) => {
        const title = escapeHtml(item.snapshot?.title || 'Produit');
        const shopName = escapeHtml(item.snapshot?.shopName || '');
        const qty = Number(item.quantity || 1);
        const lineTotal = formatCurrency((item.snapshot?.price || 0) * qty);
        return `<tr><td>${idx + 1}</td><td><div class="title">${title}</div>${shopName ? `<div class="meta">Boutique: ${shopName}</div>` : ''}</td><td class="right">x${qty}</td><td class="right">${lineTotal}</td></tr>`;
      })
      .join('');
    const orderShort = escapeHtml(o?._id?.slice(-6) || '');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Bon de commande ${orderShort}</title><style>body{font-family:sans-serif;margin:32px;} table{width:100%;border-collapse:collapse;} th,td{border-bottom:1px solid #eee;padding:10px;} .right{text-align:right;} .total-row td{font-weight:700;}</style></head><body><h1>Bon de commande #${orderShort}</h1><p>${escapeHtml(new Date(o?.createdAt).toLocaleDateString('fr-FR'))}</p><table><thead><tr><th>#</th><th>Article</th><th class="right">Qté</th><th class="right">Total</th></tr></thead><tbody>${rowsHtml}<tr class="total-row"><td colspan="3" class="right">Total</td><td class="right">${formatCurrency(orderTotal)}</td></tr></tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 1500);
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
        <Link to="/orders" className="inline-flex items-center gap-2 text-indigo-600 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>
        <p className="text-red-600">{error || 'Commande introuvable.'}</p>
      </div>
    );
  }

  const orderItems = order.items?.length ? order.items : order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }] : [];
  const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const showPayment = Boolean(paidAmount || order.paymentTransactionCode || order.paymentName);
  const createdBySelf = order.createdBy?._id && order.customer?._id ? order.createdBy._id === order.customer._id : false;
  const createdByLabel = createdBySelf ? 'Vous' : order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket';
  const StatusIcon = STATUS_ICONS[order.status] || Clock;
  const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-indigo-600 font-medium mb-4 hover:text-indigo-700"
        >
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
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-bold uppercase">{STATUS_LABELS[order.status]}</span>
                <button type="button" onClick={() => openOrderPdf(order)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30" title="Télécharger le bon de commande">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {order.cancellationWindow?.isActive && order.status !== 'cancelled' && (
              <div className="space-y-3">
                <CancellationTimer
                  deadline={order.cancellationWindow.deadline}
                  remainingMs={order.cancellationWindow.remainingMs}
                  isActive={order.cancellationWindow.isActive}
                  onExpire={() => setOrder((prev) => prev ? { ...prev, cancellationWindow: { ...prev.cancellationWindow, isActive: false, remainingMs: 0 } } : null)}
                />
                <button type="button" onClick={handleSkipCancellationWindow} disabled={skipLoadingId === order._id} className="w-full px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70">
                  <ShieldCheck className="w-5 h-5 inline mr-2" />
                  {skipLoadingId === order._id ? 'En cours...' : 'Autoriser le vendeur à traiter'}
                </button>
                <button type="button" onClick={handleCancelOrder} className="w-full px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">
                  <X className="w-5 h-5 inline mr-2" /> Annuler la commande
                </button>
              </div>
            )}

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
                      {item.snapshot?.shopName && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Store className="w-3 h-3" />
                          <span>{item.snapshot.shopName}</span>
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
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /> Code de livraison</h4>
                  <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                    <p className="text-xs font-semibold text-indigo-700 uppercase mb-2">Présentez ce code au livreur</p>
                    <div className="text-4xl font-black text-indigo-900 tracking-wider font-mono text-center">{order.deliveryCode}</div>
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /> Adresse de livraison</h4>
                  {(order.status === 'pending' || order.status === 'confirmed') && (
                    <button type="button" onClick={() => setEditAddressModalOpen(true)} className="px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100">
                      Modifier
                    </button>
                  )}
                </div>
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

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-500" /> Gestionnaire</h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <p className="text-sm font-semibold text-gray-900">{createdByLabel}</p>
                {order.createdBy?.email && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Mail className="w-3 h-3" />{order.createdBy.email}</p>}
              </div>
            </div>

            {order.status === 'cancelled' && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-bold text-red-800">Commande annulée</p>
                </div>
                {order.cancellationReason && <p className="text-sm text-red-700">Raison: {order.cancellationReason}</p>}
                {order.cancelledAt && <p className="text-xs text-red-600">Annulée le {formatOrderTimestamp(order.cancelledAt)}</p>}
              </div>
            )}

            {order.status !== 'cancelled' && <OrderProgress status={order.status} />}

            <div className="space-y-3">
              <OrderChat order={order} buttonText="Contacter le vendeur" unreadCount={unreadCount} />
              {order.status === 'delivered' && order.items?.length > 0 && (
                <button type="button" onClick={handleReorder} disabled={reordering} className="w-full px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50">
                  {reordering ? <Clock className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  <span>{reordering ? 'Ajout au panier...' : 'Commander à nouveau'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Créée: {formatOrderTimestamp(order.createdAt)}</span>
              {order.shippedAt && <span className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> Expédiée: {formatOrderTimestamp(order.shippedAt)}</span>}
              {order.deliveredAt && <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Livrée: {formatOrderTimestamp(order.deliveredAt)}</span>}
            </div>
          </div>
        </div>

        {/* Mobile-only: Suggestions & similar products at bottom (like Suggestions page) */}
        {isMobile && (
          <div className="mt-8 md:hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Suggestions & produits similaires
              </h3>
              <Link to="/suggestions" className="text-sm font-semibold text-indigo-600 flex items-center gap-0.5">
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {suggestionsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-shrink-0 w-28 h-40 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : suggestionsProducts.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {suggestionsProducts.map((product) => {
                  const imageUrl = Array.isArray(product.images) ? product.images[0] : product.image;
                  const price = product.price != null ? product.price : product.prix;
                  return (
                    <Link
                      key={product._id}
                      to={buildProductPath(product)}
                      {...externalLinkProps}
                      className="flex-shrink-0 w-28 rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div className="aspect-square w-full bg-gray-50 relative">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.title || 'Produit'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-900 line-clamp-2 min-h-[2rem]">{product.title || 'Produit'}</p>
                        <p className="text-xs font-bold text-indigo-600 mt-0.5">{formatCurrency(price)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Link
                to="/suggestions"
                className="block py-6 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500 hover:border-indigo-200 hover:text-indigo-600"
              >
                Découvrir des suggestions personnalisées
              </Link>
            )}
          </div>
        )}
      </div>

      <EditAddressModal
        isOpen={editAddressModalOpen}
        onClose={() => setEditAddressModalOpen(false)}
        order={order}
        onSave={handleSaveAddress}
      />
    </div>
  );
}
