import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { verifyTransactionCodeAvailability } from '../services/api';
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
import GlassHeader from '../components/orders/GlassHeader';
import StatusBadge from '../components/orders/StatusBadge';
import AnimatedOrderTimeline from '../components/orders/AnimatedOrderTimeline';
import InstallmentReminder from '../components/orders/InstallmentReminder';
import { OrderDetailSkeleton } from '../components/orders/OrderSkeletons';
import BaseModal from '../components/modals/BaseModal';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { getPickupShopAddress, isPickupOrder } from '../utils/pickupAddress';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import useReliableMutation from '../hooks/useReliableMutation';
import { getInstallmentWorkflow } from '../utils/installmentTracking';
import useBuyerOrderDetailQuery from '../hooks/useBuyerOrderDetailQuery';
import useBuyerOrderStatusMutation from '../hooks/useBuyerOrderStatusMutation';
import useOrderRealtimeSync from '../hooks/useOrderRealtimeSync';
import { orderQueryKeys } from '../hooks/useOrderQueryKeys';
import { appAlert, appConfirm } from '../utils/appDialog';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { createIdempotencyKey } from '../utils/idempotency';
import {
  enqueueOrderStatusOfflineAction,
  loadOrderStatusOfflineQueue,
  removeOrderStatusOfflineAction
} from '../utils/orderStatusOfflineQueue';

const STATUS_LABELS = {
  pending_payment: 'Paiement en attente',
  paid: 'Payée',
  ready_for_pickup: 'Prête au retrait',
  picked_up_confirmed: 'Retrait confirmé',
  ready_for_delivery: 'Prête à livrer',
  out_for_delivery: 'En cours de livraison',
  delivery_proof_submitted: 'Preuve de livraison soumise',
  confirmed_by_client: 'Confirmée par vous',
  pending: 'En attente',
  pending_installment: 'Validation de vente en attente',
  installment_active: 'Paiement par tranche actif',
  overdue_installment: 'Tranche en retard',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  completed: 'Paiement terminé',
  cancelled: 'Commande annulée'
};

const STATUS_STYLES = {
  pending_payment: { header: 'bg-gray-600', card: 'bg-gray-50 border-gray-200 text-gray-700' },
  paid: { header: 'bg-emerald-600', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  ready_for_pickup: { header: 'bg-orange-600', card: 'bg-orange-50 border-orange-200 text-orange-800' },
  picked_up_confirmed: { header: 'bg-emerald-700', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  ready_for_delivery: { header: 'bg-amber-600', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  out_for_delivery: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  delivery_proof_submitted: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  confirmed_by_client: { header: 'bg-emerald-700', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  pending: { header: 'bg-gray-600', card: 'bg-gray-50 border-gray-200 text-gray-700' },
  pending_installment: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  installment_active: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  overdue_installment: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  confirmed: { header: 'bg-amber-600', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  delivering: { header: 'bg-neutral-600', card: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
  delivered: { header: 'bg-emerald-600', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  completed: { header: 'bg-emerald-700', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  cancelled: { header: 'bg-red-600', card: 'bg-red-50 border-red-200 text-red-800' }
};

const STATUS_ICONS = {
  pending_payment: Clock,
  paid: CreditCard,
  ready_for_pickup: Package,
  picked_up_confirmed: CheckCircle,
  ready_for_delivery: Package,
  out_for_delivery: Truck,
  delivery_proof_submitted: Receipt,
  confirmed_by_client: CheckCircle,
  pending: Clock,
  pending_installment: Clock,
  installment_active: CreditCard,
  overdue_installment: AlertCircle,
  confirmed: Package,
  delivering: Truck,
  delivered: CheckCircle,
  completed: CheckCircle,
  cancelled: X
};

const INSTALLMENT_SALE_STATUS_LABELS = {
  confirmed: 'Confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

const CLASSIC_ORDER_FLOW = [
  { id: 'pending_payment', label: 'Paiement en attente', description: 'Votre commande est enregistrée.', icon: Clock, color: 'gray' },
  { id: 'paid', label: 'Payée', description: 'Paiement soumis. En attente de confirmation.', icon: CreditCard, color: 'emerald' },
  { id: 'ready_for_delivery', label: 'Prête à livrer', description: 'Préparation terminée.', icon: Package, color: 'amber' },
  { id: 'out_for_delivery', label: 'En cours de livraison', description: 'Le colis est en route.', icon: Truck, color: 'blue' },
  { id: 'delivered', label: 'Livrée', description: 'Livraison signalée.', icon: CheckCircle, color: 'emerald' },
  { id: 'delivery_proof_submitted', label: 'Preuve soumise', description: 'Le vendeur a soumis les preuves de livraison.', icon: Receipt, color: 'blue' },
  { id: 'confirmed_by_client', label: 'Confirmée par vous', description: 'Vous avez confirmé la réception.', icon: CheckCircle, color: 'emerald' },
  { id: 'completed', label: 'Commande terminée', description: 'Livraison clôturée.', icon: CheckCircle, color: 'emerald' },
  { id: 'cancelled', label: 'Commande annulée', description: 'Cette commande a été annulée.', icon: X, color: 'red' }
];

const INSTALLMENT_ORDER_FLOW = [
  { id: 'pending_installment', label: 'Validation de vente', description: 'Le vendeur doit confirmer la preuve de vente.', icon: Clock, color: 'violet' },
  { id: 'installment_active', label: 'Plan actif', description: 'Les tranches sont en cours de paiement.', icon: CreditCard, color: 'indigo' },
  { id: 'overdue_installment', label: 'En retard', description: 'Au moins une tranche est en retard.', icon: AlertCircle, color: 'rose' },
  { id: 'completed', label: 'Paiement terminé', description: 'Toutes les tranches ont été validées.', icon: CheckCircle, color: 'emerald' },
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

const formatCurrency = (value) => formatPriceWithStoredSettings(value);
const normalizeAddressPart = (value) => (typeof value === 'string' ? value.trim() : '');
const resolveOrderPaymentMode = (order) => {
  if (String(order?.paymentType || '').toLowerCase() === 'installment') return 'INSTALLMENT';
  if (
    String(order?.paymentMode || '').toUpperCase() === 'FULL_PAYMENT' ||
    String(order?.paymentStatus || '').toUpperCase() === 'PAID_FULL'
  ) {
    return 'FULL_PAYMENT';
  }
  return 'STANDARD';
};

const getPaymentModeLabel = (mode) => {
  switch (mode) {
    case 'INSTALLMENT':
      return 'Paiement par tranche';
    case 'FULL_PAYMENT':
      return 'Paiement intégral';
    default:
      return 'Paiement classique';
  }
};

const getEffectiveOrderStatus = (order) => {
  if (!order) return 'pending';
  const pickupOrder = isPickupOrder(order);
  const platformAutoConfirmed =
    (Boolean(order.platformDeliveryRequestId) ||
      String(order.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY') &&
    String(order.platformDeliveryStatus || '').toUpperCase() === 'DELIVERED';
  if (pickupOrder && String(order.status || '').toLowerCase() === 'confirmed') {
    const hasSubmittedPayment = Boolean(
      Number(order.paidAmount || 0) > 0 ||
        String(order.paymentTransactionCode || '').trim() ||
        String(order.paymentName || '').trim()
    );
    return hasSubmittedPayment ? 'paid' : 'pending_payment';
  }
  const map = {
    pending: 'pending_payment',
    confirmed: 'ready_for_delivery',
    delivering: 'out_for_delivery',
    delivered:
      order.deliveryStatus === 'submitted' && !platformAutoConfirmed
        ? 'delivery_proof_submitted'
        : 'delivered'
  };
  return map[order.status] || order.status || 'pending_payment';
};

const getScheduleStatusLabel = (status) => {
  switch (status) {
    case 'paid':
      return 'Payé';
    case 'proof_uploaded':
      return 'Preuve envoyée';
    case 'overdue':
      return 'En retard';
    case 'waived':
      return 'Annulé';
    case 'pending':
    default:
      return 'À payer';
  }
};

const getScheduleStatusClassName = (status) => {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'proof_uploaded':
      return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    case 'overdue':
      return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    case 'waived':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
};

const getBuyerPrimaryActionMeta = (order = {}) => {
  const nextAction = order?.nextAction?.buyer;
  if (!nextAction || typeof nextAction !== 'object') return null;
  const actionKey = String(nextAction.key || '').trim();
  const nextStatus = String(nextAction.nextStatus || '').trim();

  switch (actionKey) {
    case 'cancel_order':
      return {
        key: actionKey,
        mode: 'cancel',
        nextStatus: nextStatus || 'cancelled',
        intent: 'danger',
        label: 'Annuler la commande'
      };
    case 'confirm_delivery':
      return {
        key: actionKey,
        mode: 'confirm_delivery',
        nextStatus: nextStatus || null,
        intent: 'success',
        label: 'Confirmer la livraison'
      };
    default:
      return null;
  }
};

const getPrimaryActionClassName = (intent = 'primary') => {
  switch (intent) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100';
    case 'primary':
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100';
  }
};

const OrderProgress = ({ status, paymentType }) => {
  const flow = paymentType === 'installment' ? INSTALLMENT_ORDER_FLOW : CLASSIC_ORDER_FLOW;
  const currentIndexRaw = flow.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;
  const colorClasses = {
    gray: 'bg-gray-600',
    amber: 'bg-amber-600',
    blue: 'bg-neutral-600',
    emerald: 'bg-emerald-600',
    violet: 'bg-neutral-600',
    indigo: 'bg-neutral-600',
    rose: 'bg-neutral-600'
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-neutral-600">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Suivi de commande</h3>
      </div>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200">
          <div
            className="absolute top-0 left-0 w-full bg-neutral-600 transition-all duration-500"
            style={{ height: `${(currentIndex / (flow.length - 1)) * 100}%` }}
          />
        </div>
        <div className="space-y-6 relative">
          {flow.filter((s) => s.id !== 'cancelled').map((step, index) => {
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
  const { isFeatureEnabled } = useAppSettings();
  const { showToast } = useToast();
  const aiRecommendationsEnabled = isFeatureEnabled('enable_ai_recommendations', {
    defaultValue: true
  });
  const queryClient = useQueryClient();
  const { rapid3GActive, offlineBannerText, rapid3GBannerText, shouldUseOfflineSnapshot } =
    useNetworkProfile();

  const [order, setOrder] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [skipLoadingId, setSkipLoadingId] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [installmentProofForms, setInstallmentProofForms] = useState({});
  const [installmentUploadIndex, setInstallmentUploadIndex] = useState(-1);
  const [suggestionsProducts, setSuggestionsProducts] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [proofPreview, setProofPreview] = useState(null);
  const [queuedDeliveryActionCount, setQueuedDeliveryActionCount] = useState(0);
  const [deliveryQueueSyncing, setDeliveryQueueSyncing] = useState(false);
  const isMobile = useIsMobile();
  const userScopeId = String(user?._id || user?.id || '').trim();
  const normalizeFileUrl = useCallback((url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const host = apiBase.replace(/\/api\/?$/, '');
    return `${host}/${String(url).replace(/^\/+/, '')}`;
  }, []);
  const openProofPreview = useCallback(
    (url, label = 'Preuve') => {
      const normalized = normalizeFileUrl(url || '');
      if (!normalized) return;
      setProofPreview({
        url: normalized,
        label: String(label || 'Preuve')
      });
    },
    [normalizeFileUrl]
  );

  const buyerOrderDetailQuery = useBuyerOrderDetailQuery({
    orderId,
    userId: user?._id || user?.id || '',
    enabled: Boolean(orderId)
  });

  const loadOrder = useCallback(async () => {
    await buyerOrderDetailQuery.refetch();
  }, [buyerOrderDetailQuery.refetch]);

  useEffect(() => {
    const nextOrder = buyerOrderDetailQuery.data?.order || null;
    setOrder(nextOrder);
    setUnreadCount(Number(buyerOrderDetailQuery.data?.unreadCount || 0));
  }, [buyerOrderDetailQuery.data]);

  useOrderRealtimeSync({
    scope: 'user',
    orderId,
    enabled: Boolean(orderId),
    pollIntervalMs: 15000,
    currentStatus: order?.status || ''
  });

  const applyOrderSnapshot = useCallback(
    (payload) => {
      const nextOrder =
        payload?.order && typeof payload.order === 'object' ? payload.order : payload;
      if (!nextOrder?._id) return false;
      setOrder(nextOrder);
      queryClient.setQueryData(orderQueryKeys.detail('user', String(orderId || '')), (existing) => ({
        ...(existing || {}),
        order: nextOrder,
        unreadCount: Number(existing?.unreadCount || 0)
      }));
      return true;
    },
    [orderId, queryClient]
  );

  const patchOrdersListPayload = useCallback((payload, nextOrder) => {
    if (!nextOrder?._id) return payload;
    if (Array.isArray(payload)) {
      return payload.map((entry) =>
        String(entry?._id || '') === String(nextOrder._id) ? nextOrder : entry
      );
    }
    if (payload && Array.isArray(payload.items)) {
      return {
        ...payload,
        items: payload.items.map((entry) =>
          String(entry?._id || '') === String(nextOrder._id) ? nextOrder : entry
        )
      };
    }
    return payload;
  }, []);

  const applyOrderToUserCaches = useCallback(
    (nextOrder) => {
      if (!nextOrder?._id) return false;
      applyOrderSnapshot(nextOrder);
      queryClient.setQueriesData({ queryKey: orderQueryKeys.listRoot('user') }, (existing) =>
        patchOrdersListPayload(existing, nextOrder)
      );
      return true;
    },
    [applyOrderSnapshot, patchOrdersListPayload, queryClient]
  );

  const getOptimisticDeliveredOrder = useCallback(
    (currentOrder) =>
      currentOrder?._id
        ? {
            ...currentOrder,
            status: 'confirmed_by_client',
            updatedAt: new Date().toISOString(),
            clientDeliveryConfirmedAt:
              currentOrder?.clientDeliveryConfirmedAt || new Date().toISOString()
          }
        : currentOrder,
    []
  );

  const invalidateOrderQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: orderQueryKeys.detail('user', String(orderId || '')),
      refetchType: 'active'
    });
    await queryClient.invalidateQueries({
      queryKey: orderQueryKeys.listRoot('user'),
      refetchType: 'inactive'
    });
    window.dispatchEvent(new Event('hdmarket:orders-refresh'));
  }, [orderId, queryClient]);

  const buyerStatusMutation = useBuyerOrderStatusMutation({
    orderId,
    onApplied: async (result) => {
      applyOrderSnapshot(result?.data);
      showToast(
        result?.recovered ? 'Statut mis à jour après vérification automatique.' : 'Statut mis à jour.',
        { variant: 'success' }
      );
    },
    onFailed: async (error, _variables, context) => {
      if (context?.possiblyCommitted) {
        showToast('Réseau lent ou interrompu. Vérification automatique en cours avant tout renvoi.', {
          variant: 'info'
        });
        return;
      }
      showToast(error?.response?.data?.message || 'Impossible de mettre à jour la commande.', {
        variant: 'error'
      });
    }
  });

  // Load suggestions / similar products for mobile bottom section
  useEffect(() => {
    if (!aiRecommendationsEnabled) {
      setSuggestionsProducts([]);
      setSuggestionsLoading(false);
      return;
    }
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
  }, [aiRecommendationsEnabled, order?._id, order?.items?.length]);

  const handleSkipCancellationWindow = async () => {
    if (!order || !(await appConfirm('En confirmant, vous autorisez le vendeur à traiter immédiatement cette commande.'))) return;
    setSkipLoadingId(order._id);
    try {
      const { data } = await api.post(`/orders/${order._id}/skip-cancellation-window`);
      applyOrderSnapshot(data);
      await invalidateOrderQueries();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Impossible de lever le délai.');
    } finally {
      setSkipLoadingId(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !(await appConfirm('Êtes-vous sûr de vouloir annuler cette commande ?'))) return;
    try {
      await buyerStatusMutation.mutateAsync({ nextStatus: 'cancelled' });
    } catch {
      // handled by mutation callbacks
    }
  };

  const handleSaveAddress = async (addressData) => {
    if (!order) return;
    try {
      const { data } = await api.patch(`/orders/${order._id}/address`, addressData);
      applyOrderSnapshot(data);
      setEditAddressModalOpen(false);
      await invalidateOrderQueries();
    } catch (err) {
      throw err;
    }
  };

  const handleInstallmentProofFieldChange = (index, field, value) => {
    setInstallmentProofForms((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || {}),
        [field]:
          field === 'transactionCode'
            ? String(value || '').replace(/\D/g, '').slice(0, 10)
            : value
      }
    }));
  };

  const handleInstallmentProofUpload = async (index, entry) => {
    if (!order) return;
    const currentProof = installmentProofForms[index] || {
      payerName: entry?.transactionProof?.senderName || user?.name || '',
      transactionCode: entry?.transactionProof?.transactionCode || ''
    };
    const cleanPayerName = String(currentProof.payerName || '').trim();
    const cleanTransactionCode = String(currentProof.transactionCode || '').replace(/\D/g, '');
    const amount = Number(entry?.amount || 0);

    if (!cleanPayerName) {
      appAlert('Le nom de l’expéditeur est requis.');
      return;
    }
    if (cleanTransactionCode.length !== 10) {
      appAlert('L’ID de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    try {
      const verification = await verifyTransactionCodeAvailability(cleanTransactionCode);
      if (!verification.available) {
        appAlert(verification.message || 'Ce code de transaction est déjà utilisé.');
        return;
      }
    } catch (error) {
      appAlert(error?.response?.data?.message || 'Impossible de vérifier le code de transaction.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      appAlert('Montant de tranche invalide.');
      return;
    }
    setInstallmentUploadIndex(index);
    try {
      const { data } = await api.post(
        `/orders/${order._id}/installment/payments/${index}/proof`,
        {
          payerName: cleanPayerName,
          transactionCode: cleanTransactionCode,
          amount
        }
      );
      applyOrderSnapshot(data);
      setInstallmentProofForms((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      appAlert('Preuve transactionnelle transmise au vendeur. En attente de validation.');
      await invalidateOrderQueries();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Impossible de transmettre la preuve.');
    } finally {
      setInstallmentUploadIndex(-1);
    }
  };

  const confirmDeliveryMutation = useReliableMutation({
    mutationFn: async ({ orderId, idempotencyKey }) => {
      if (shouldUseOfflineSnapshot && userScopeId) {
        const queue = await enqueueOrderStatusOfflineAction(userScopeId, 'buyer', {
          queueId: createIdempotencyKey('buyer-confirm-delivery-queue'),
          orderId,
          nextStatus: 'confirmed_by_client',
          type: 'confirm-delivery',
          idempotencyKey: idempotencyKey || createIdempotencyKey('buyer-confirm-delivery')
        });
        return {
          queued: true,
          queueLength: queue.length,
          orderId
        };
      }
      const { data } = await api.post(
        `/orders/${orderId}/confirm-delivery`,
        { confirm: true },
        {
          silentGlobalError: true,
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      return data;
    },
    verifyFn: async ({ orderId }) => {
      if (!orderId) return false;
      const { data } = await api.get(`/orders/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      const status = String(data?.status || '').toLowerCase();
      return ['confirmed_by_client', 'completed'].includes(status);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: orderQueryKeys.detail('user', String(orderId || ''))
      });
      await queryClient.cancelQueries({ queryKey: orderQueryKeys.listRoot('user') });
      const previous = queryClient.getQueryData(orderQueryKeys.detail('user', String(orderId || '')));
      const previousLists = queryClient.getQueriesData({ queryKey: orderQueryKeys.listRoot('user') });
      if (order?._id) {
        const optimisticOrder = getOptimisticDeliveredOrder(order);
        applyOrderToUserCaches(optimisticOrder);
      }
      return { previous, previousLists };
    },
    onSuccess: async (result, _variables, context) => {
      if (result?.data?.queued) {
        setQueuedDeliveryActionCount(Number(result?.data?.queueLength || 0));
        showToast('Confirmation enregistrée hors ligne. Synchronisation automatique dès le retour du réseau.', {
          variant: 'info'
        });
        return;
      }
      const payload = result?.data;
      if (!applyOrderToUserCaches(payload)) {
        await loadOrder();
      }
      const successMessage = result?.recovered
        ? 'Livraison confirmée (récupérée après délai réseau).'
        : 'Livraison confirmée. La commande est terminée.';
      showToast(successMessage, { variant: 'success' });
    },
    onError: (error, _variables, context) => {
      if (!context?.possiblyCommitted && context?.previous) {
        queryClient.setQueryData(orderQueryKeys.detail('user', String(orderId || '')), context.previous);
      }
      if (!context?.possiblyCommitted && Array.isArray(context?.previousLists)) {
        context.previousLists.forEach(([queryKey, previousValue]) => {
          queryClient.setQueryData(queryKey, previousValue);
        });
      }
      if (context?.possiblyCommitted) {
        showToast('Réseau lent ou interrompu. Vérification automatique en cours avant tout renvoi.', {
          variant: 'info'
        });
        return;
      }
      showToast(error?.response?.data?.message || 'Impossible de confirmer la livraison.', {
        variant: 'error'
      });
    },
    onSettled: async (data) => {
      if (data?.data?.queued) return;
      await invalidateOrderQueries();
    }
  });

  const handleConfirmDelivery = async () => {
    if (!order || confirmDeliveryMutation.isReliablePending) return;
    try {
      await confirmDeliveryMutation.mutateAsync({ orderId: order._id });
    } catch {
      // handled by mutation callbacks
    }
  };

  const syncQueuedDeliveryActionCount = useCallback(async () => {
    if (!userScopeId) {
      setQueuedDeliveryActionCount(0);
      return;
    }
    const queue = await loadOrderStatusOfflineQueue(userScopeId, 'buyer');
    const deliveryQueue = queue.filter((entry) => String(entry?.type || '') === 'confirm-delivery');
    setQueuedDeliveryActionCount(deliveryQueue.length);
  }, [userScopeId]);

  const flushQueuedDeliveryActions = useCallback(async () => {
    if (!userScopeId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let queue = await loadOrderStatusOfflineQueue(userScopeId, 'buyer');
    queue = queue.filter((entry) => String(entry?.type || '') === 'confirm-delivery');
    setQueuedDeliveryActionCount(queue.length);
    if (!queue.length) return;
    setDeliveryQueueSyncing(true);
    try {
      for (const action of queue) {
        try {
          const { data } = await api.post(
            `/orders/${action.orderId}/confirm-delivery`,
            { confirm: true },
            {
              headers: {
                'Idempotency-Key':
                  action.idempotencyKey || createIdempotencyKey('buyer-confirm-delivery-replay')
              }
            }
          );
          if (data?._id || data?.order?._id) {
            applyOrderToUserCaches(data?.order?._id ? data.order : data);
          }
          await removeOrderStatusOfflineAction(userScopeId, 'buyer', action.queueId);
          await syncQueuedDeliveryActionCount();
          window.dispatchEvent(new Event('hdmarket:orders-refresh'));
        } catch (error) {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            break;
          }
          showToast(
            error?.response?.data?.message || 'Impossible de synchroniser la confirmation de livraison.',
            { variant: 'error' }
          );
          break;
        }
      }
    } finally {
      setDeliveryQueueSyncing(false);
      await invalidateOrderQueries();
    }
  }, [applyOrderToUserCaches, invalidateOrderQueries, showToast, syncQueuedDeliveryActionCount, userScopeId]);

  useEffect(() => {
    syncQueuedDeliveryActionCount();
    const handleQueueChange = () => {
      syncQueuedDeliveryActionCount();
    };
    window.addEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    };
  }, [syncQueuedDeliveryActionCount]);

  useEffect(() => {
    if (!userScopeId) return;
    if (!shouldUseOfflineSnapshot) {
      flushQueuedDeliveryActions();
    }
    const handleOnline = () => {
      flushQueuedDeliveryActions();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushQueuedDeliveryActions, shouldUseOfflineSnapshot, userScopeId]);

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
        appAlert(message);
        navigate('/cart');
      } else if (failedItems.length > 0) {
        appAlert('Aucun article disponible pour le moment.');
      }
    } catch {
      appAlert('Erreur lors de l\'ajout au panier.');
    } finally {
      setReordering(false);
    }
  };

  const openOrderPdf = (o) => {
    const orderItems = o?.items?.length ? o.items : o?.productSnapshot ? [{ snapshot: o.productSnapshot, quantity: 1 }] : [];
    const itemsSubtotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
    const pickupOrderInPdf = isPickupOrder(o);
    const deliveryFeeTotal = Number(o?.deliveryFeeTotal ?? 0);
    const orderTotal = Number(o?.totalAmount ?? itemsSubtotal + deliveryFeeTotal);
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
    const deliveryLocked = Boolean(o?.deliveryFeeLocked) && String(o?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
    const deliveryRowHtml = !pickupOrderInPdf && (deliveryFeeTotal > 0 || deliveryLocked)
      ? `<tr><td colspan="3" class="right">Frais de livraison</td><td class="right">${deliveryLocked ? 'Offerts' : formatCurrency(deliveryFeeTotal)}</td></tr>`
      : '';
    const orderShort = escapeHtml(o?._id?.slice(-6) || '');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Bon de commande ${orderShort}</title><style>body{font-family:sans-serif;margin:32px;} table{width:100%;border-collapse:collapse;} th,td{border-bottom:1px solid #eee;padding:10px;} .right{text-align:right;} .total-row td{font-weight:700;}</style></head><body><h1>Bon de commande #${orderShort}</h1><p>${escapeHtml(new Date(o?.createdAt).toLocaleDateString('fr-FR'))}</p><table><thead><tr><th>#</th><th>Article</th><th class="right">Qté</th><th class="right">Total</th></tr></thead><tbody>${rowsHtml}${deliveryRowHtml}<tr class="total-row"><td colspan="3" class="right">Total</td><td class="right">${formatCurrency(orderTotal)}</td></tr></tbody></table></body></html>`;
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

  const loading = buyerOrderDetailQuery.isLoading && !order;
  const queryErrorMessage =
    buyerOrderDetailQuery.error?.response?.data?.message ||
    buyerOrderDetailQuery.error?.message ||
    '';

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <GlassHeader title="Commande" subtitle="Chargement..." backTo="/orders" />
        <OrderDetailSkeleton />
      </div>
    );
  }

  if (queryErrorMessage || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Link to="/orders" className="inline-flex items-center gap-2 text-neutral-600 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>
        <p className="text-red-600">{queryErrorMessage || 'Commande introuvable.'}</p>
      </div>
    );
  }

  const orderItems = order.items?.length ? order.items : order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }] : [];
  const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const isInstallmentOrder = order.paymentType === 'installment';
  const orderPaymentMode = resolveOrderPaymentMode(order);
  const isFullPaymentOrder = orderPaymentMode === 'FULL_PAYMENT';
  const deliveryFeeLockedByFullPayment =
    Boolean(order.deliveryFeeLocked) && String(order.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
  const showDeliveryFeeRow =
    !isPickupOrder(order) &&
    (Number(order.deliveryFeeTotal ?? 0) > 0 || Boolean(order.deliveryFeeWaived) || deliveryFeeLockedByFullPayment);
  const paymentModeLabel = getPaymentModeLabel(orderPaymentMode);
  const paidAmountLabel = isInstallmentOrder
    ? 'Montant validé'
    : isFullPaymentOrder
      ? 'Paiement reçu'
      : 'Acompte versé';
  const installmentPlan = isInstallmentOrder ? order.installmentPlan || {} : null;
  const installmentSchedule = Array.isArray(installmentPlan?.schedule) ? installmentPlan.schedule : [];
  const installmentWorkflow = isInstallmentOrder ? getInstallmentWorkflow(order) : null;
  const installmentCurrentIndex = installmentSchedule.findIndex(
    (entry) => !['paid', 'waived'].includes(entry?.status)
  );
  const visibleInstallmentEntries =
    installmentCurrentIndex === -1
      ? installmentSchedule.map((entry, index) => ({ entry, index }))
      : installmentSchedule
          .slice(0, installmentCurrentIndex + 1)
          .map((entry, index) => ({ entry, index }));
  const installmentTotal = Number(installmentPlan?.totalAmount ?? totalAmount);
  const installmentPaid = Number(installmentPlan?.amountPaid ?? paidAmount);
  const installmentRemaining = Number(
    installmentPlan?.remainingAmount ??
      installmentWorkflow?.remainingFromSchedule ??
      Math.max(0, installmentTotal - installmentPaid)
  );
  const installmentProgressPercent =
    installmentTotal > 0 ? Math.min(100, Math.round((installmentPaid / installmentTotal) * 100)) : 0;
  const saleConfirmationConfirmed = Boolean(installmentWorkflow?.saleConfirmed);
  const installmentSaleStatus =
    isInstallmentOrder && order.status === 'completed'
      ? order.installmentSaleStatus || 'confirmed'
      : order.installmentSaleStatus || '';
  const effectiveOrderStatus = isInstallmentOrder
    ? installmentWorkflow?.workflowStatus || order.status
    : getEffectiveOrderStatus(order);
  const showPayment = Boolean(
    isInstallmentOrder ||
      paidAmount ||
      order.paymentTransactionCode ||
      order.paymentName
  );
  const createdBySelf = order.createdBy?._id && order.customer?._id ? order.createdBy._id === order.customer._id : false;
  const createdByLabel = createdBySelf ? 'Vous' : order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket';
  const StatusIcon = STATUS_ICONS[effectiveOrderStatus] || Clock;
  const statusStyle = STATUS_STYLES[effectiveOrderStatus] || STATUS_STYLES.pending;
  const pickupOrder = isPickupOrder(order);
  const pickupShopAddress = pickupOrder ? getPickupShopAddress(order) : null;
  const normalizedBuyerAccountType = String(
    order?.customer?.accountType || user?.accountType || ''
  )
    .trim()
    .toLowerCase();
  const isParticulierBuyer = ['person', 'particulier'].includes(normalizedBuyerAccountType);
  const personalAddressLine = (() => {
    if (!isParticulierBuyer) return '';
    const baseAddress =
      normalizeAddressPart(order?.customer?.address) || normalizeAddressPart(user?.address);
    if (!baseAddress) return '';
    const commune =
      normalizeAddressPart(order?.customer?.commune) || normalizeAddressPart(user?.commune);
    const city = normalizeAddressPart(order?.customer?.city) || normalizeAddressPart(user?.city);
    const locality = [commune, city].filter(Boolean).join(', ');
    if (!locality) return baseAddress;
    const lowerBase = baseAddress.toLowerCase();
    const lowerLocality = locality.toLowerCase();
    return lowerBase.includes(lowerLocality) ? baseAddress : `${baseAddress}, ${locality}`;
  })();
  const deliveryAddressText = normalizeAddressPart(order?.deliveryAddress);
  const deliveryCityText = normalizeAddressPart(order?.deliveryCity);
  const displayDeliveryAddress = deliveryAddressText || personalAddressLine || 'Non renseignée';
  const displayDeliveryCity =
    deliveryCityText ||
    normalizeAddressPart(order?.customer?.city) ||
    normalizeAddressPart(user?.city) ||
    '';
  const personalAddressIsDifferent =
    Boolean(personalAddressLine) &&
    deliveryAddressText &&
    personalAddressLine.toLowerCase() !== deliveryAddressText.toLowerCase();
  const platformDeliveryAutoConfirmed =
    (Boolean(order.platformDeliveryRequestId) ||
      String(order.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY') &&
    String(order.platformDeliveryStatus || '').toUpperCase() === 'DELIVERED';
  const deliveryConfirmationDone = order.deliveryStatus === 'verified' || platformDeliveryAutoConfirmed;
  const buyerPrimaryAction = getBuyerPrimaryActionMeta(order);
  const handlePrimaryBuyerAction = async () => {
    if (!buyerPrimaryAction || buyerPrimaryAction.mode === 'none') return;
    if (buyerPrimaryAction.mode === 'cancel') {
      await handleCancelOrder();
      return;
    }
    if (buyerPrimaryAction.mode === 'confirm_delivery') {
      await handleConfirmDelivery();
    }
  };
  const isPrimaryActionPending =
    (buyerPrimaryAction?.mode === 'cancel' && buyerStatusMutation.isReliablePending) ||
    (buyerPrimaryAction?.mode === 'confirm_delivery' && confirmDeliveryMutation.isReliablePending);
  const statusTimelineEntries = [
    { key: 'created', label: 'Créée', icon: Calendar, time: order.createdAt },
    { key: 'confirmed', label: 'Confirmée', icon: Package, time: order.confirmedAt },
    pickupOrder
      ? {
          key: 'ready_for_pickup',
          label: 'Prête au retrait',
          icon: Store,
          time: order.readyForPickupAt
        }
      : {
          key: 'out_for_delivery',
          label: 'En livraison',
          icon: Truck,
          time: order.outForDeliveryAt || order.shippedAt
        },
    { key: 'proof_submitted', label: 'Preuve soumise', icon: Receipt, time: order.deliverySubmittedAt },
    {
      key: 'delivered',
      label: pickupOrder ? 'Retrait confirmé' : 'Livrée',
      icon: CheckCircle,
      time: order.deliveredAt
    },
    {
      key: 'confirmed_by_client',
      label: 'Confirmée client',
      icon: ShieldCheck,
      time: order.clientDeliveryConfirmedAt
    },
    { key: 'completed', label: 'Terminée', icon: CheckCircle, time: order.completedAt },
    { key: 'cancelled', label: 'Annulée', icon: X, time: order.cancelledAt }
  ].filter((entry) => Boolean(entry.time));
  const proofPreviewIsSignature = /signature/i.test(String(proofPreview?.label || ''));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <GlassHeader
        title={`Commande #${order._id.slice(-6)}`}
        subtitle="Détail client"
        backTo="/orders"
        right={<StatusBadge status={effectiveOrderStatus} compact />}
      />
      {(buyerOrderDetailQuery.offlineSnapshotActive || rapid3GActive) && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              buyerOrderDetailQuery.offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {buyerOrderDetailQuery.offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        </div>
      )}
      {(queuedDeliveryActionCount > 0 || deliveryQueueSyncing) && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <section className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm shadow-sm dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
            <p className="font-semibold text-violet-800 dark:text-violet-300">
              {deliveryQueueSyncing
                ? 'Synchronisation des confirmations de livraison en attente...'
                : `${queuedDeliveryActionCount} confirmation${queuedDeliveryActionCount > 1 ? 's' : ''} de livraison en attente de connexion.`}
            </p>
          </section>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-6">

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
                <span className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-bold uppercase">
                  {STATUS_LABELS[effectiveOrderStatus] || effectiveOrderStatus}
                </span>
                <button type="button" onClick={() => openOrderPdf(order)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30" title="Télécharger le bon de commande">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {order.cancellationWindow?.isActive && effectiveOrderStatus !== 'cancelled' && (
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
                {buyerPrimaryAction?.key !== 'cancel_order' ? (
                  <button type="button" onClick={handleCancelOrder} className="w-full px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">
                    <X className="w-5 h-5 inline mr-2" /> Annuler la commande
                  </button>
                ) : null}
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
                      <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-neutral-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-1">
                        {item.product ? (
                          <Link to={buildProductPath(item.product)} {...externalLinkProps} className="font-bold text-gray-900 hover:text-neutral-600 truncate">
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
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-neutral-500" /> Code de livraison</h4>
                  <div className="p-5 rounded-xl border-2 border-neutral-200 bg-neutral-50">
                    <p className="text-xs font-semibold text-neutral-700 uppercase mb-2">Présentez ce code au livreur</p>
                    <div className="text-4xl font-black text-neutral-900 tracking-wider font-mono text-center">{order.deliveryCode}</div>
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" /> {pickupOrder ? 'Adresse boutique (retrait)' : 'Adresse de livraison'}
                  </h4>
                  {[
                    'pending',
                    'pending_payment',
                    'paid',
                    'confirmed',
                    'pending_installment'
                  ].includes(order.status) && !pickupOrder && (
                    <button type="button" onClick={() => setEditAddressModalOpen(true)} className="px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 text-xs font-semibold hover:bg-neutral-100">
                      Modifier
                    </button>
                  )}
                </div>
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                  {pickupOrder ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{pickupShopAddress?.shopName || 'Boutique'}</p>
                      <p className="text-sm text-gray-800">{pickupShopAddress?.addressLine || 'Adresse boutique non renseignée'}</p>
                      {pickupShopAddress?.cityLine ? <p className="text-xs text-gray-500">{pickupShopAddress.cityLine}</p> : null}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{displayDeliveryAddress}</p>
                      <p className="text-xs text-gray-500">{displayDeliveryCity || 'Ville non renseignée'}</p>
                      {isParticulierBuyer && personalAddressIsDifferent ? (
                        <p className="text-xs text-gray-600">
                          <span className="font-semibold">Adresse personnelle:</span> {personalAddressLine}
                        </p>
                      ) : null}
                    </>
                  )}
                  {!pickupOrder && order.deliveryGuy && (
                    <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3 text-xs">
                      <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-200">
                        {resolveDeliveryGuyProfileImage(order.deliveryGuy) ? (
                          <img
                            src={resolveDeliveryGuyProfileImage(order.deliveryGuy)}
                            alt={order.deliveryGuy.name || 'Livreur'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-600">
                            {String(order.deliveryGuy.name || 'L').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <Truck className="mr-1 inline h-3 w-3 text-neutral-600" />
                        <span className="font-semibold">Livreur:</span> {order.deliveryGuy.name || 'Non assigné'}
                        {order.deliveryGuy.phone && ` • ${order.deliveryGuy.phone}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {order.trackingNote && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-gray-500" /> Note de suivi</h4>
                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50"><p className="text-sm text-gray-700">{order.trackingNote}</p></div>
              </div>
            )}

            {(order.deliveryStatus === 'submitted' ||
              order.deliveryStatus === 'verified' ||
              order.status === 'delivery_proof_submitted') && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-neutral-700" /> {pickupOrder ? 'Preuve de retrait' : 'Preuve de livraison'}
                </h4>
                <p className="text-sm text-gray-700">
                  Statut:{' '}
                  <span className="font-semibold">
                    {pickupOrder
                      ? 'Retrait confirmé par le vendeur'
                      : deliveryConfirmationDone
                      ? 'Livraison confirmée'
                      : 'Soumise par le vendeur (en attente de votre confirmation)'}
                  </span>
                </p>
                {order.deliveryDate && (
                  <p className="text-xs text-gray-500">
                    Date de livraison: {formatOrderTimestamp(order.deliveryDate)}
                  </p>
                )}
                {order.deliveryNote && (
                  <p className="text-sm text-gray-700">
                    Note vendeur: <span className="font-medium">{order.deliveryNote}</span>
                  </p>
                )}
                {(order.deliveryProofImages || []).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(order.deliveryProofImages || []).map((proof, index) => {
                      const src = normalizeFileUrl(proof?.url || proof?.path || '');
                      if (!src) return null;
                      return (
                        <button
                          key={`proof-image-${index}`}
                          type="button"
                          onClick={() => openProofPreview(src, `Preuve ${index + 1}`)}
                          className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200"
                        >
                          <img
                            src={src}
                            alt={`Preuve ${index + 1}`}
                            className="h-full w-full object-contain bg-slate-50 p-1"
                            loading="lazy"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                            Photo {index + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {order.clientSignatureImage && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Signature client</p>
                    <button
                      type="button"
                      onClick={() => openProofPreview(order.clientSignatureImage, 'Signature client')}
                      className="block w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white"
                    >
                      <img
                        src={order.clientSignatureImage}
                        alt="Signature client"
                        className="h-24 w-full bg-white object-contain p-1"
                      />
                    </button>
                  </div>
                )}
                {!deliveryConfirmationDone && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {buyerPrimaryAction?.key !== 'confirm_delivery' ? (
                        <button
                          type="button"
                          onClick={handleConfirmDelivery}
                          disabled={confirmDeliveryMutation.isReliablePending}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {confirmDeliveryMutation.isReliablePending
                            ? 'Confirmation en cours...'
                            : 'Confirmer la livraison'}
                        </button>
                      ) : null}
                      <Link
                        to={`/reclamations?orderId=${order._id}`}
                        className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        Ouvrir un litige
                      </Link>
                    </div>
                    {confirmDeliveryMutation.uiPhase === 'stillWorking' && (
                      <p className="text-xs text-amber-700">
                        Traitement en cours... merci de patienter.
                      </p>
                    )}
                    {confirmDeliveryMutation.uiPhase === 'slow' && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700">
                        <span>Réseau lent. Vérification automatique en cours.</span>
                        <Link
                          to="/orders"
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-800"
                        >
                          Voir le statut
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-500" /> Paiement</h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-blue-700">Mode de paiement</span>
                    {isFullPaymentOrder && (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-blue-900">{paymentModeLabel}</span>
                </div>
                {showDeliveryFeeRow && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Frais de livraison</span>
                      {deliveryFeeLockedByFullPayment ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Offerts et verrouillés
                        </span>
                      ) : order.deliveryFeeUpdatedAt ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={new Date(order.deliveryFeeUpdatedAt).toLocaleString('fr-FR')}>
                          Modifié par le vendeur
                        </span>
                      ) : null}
                    </div>
                    <span className={`text-sm font-semibold ${deliveryFeeLockedByFullPayment ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {deliveryFeeLockedByFullPayment ? 'GRATUITE' : formatCurrency(order.deliveryFeeTotal)}
                    </span>
                  </div>
                )}
                {deliveryFeeLockedByFullPayment && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Livraison offerte grâce au paiement intégral. Aucun frais de livraison ne peut être ajouté sur cette commande.
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total commande</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(isInstallmentOrder ? installmentTotal : totalAmount)}
                  </span>
                </div>
                {showPayment && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">
                        {paidAmountLabel}
                      </span>
                      <span className="text-sm font-semibold text-emerald-700">
                        {formatCurrency(isInstallmentOrder ? installmentPaid : paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reste à payer</span>
                      <span className="text-sm font-semibold text-amber-700">
                        {formatCurrency(isInstallmentOrder ? installmentRemaining : remainingAmount)}
                      </span>
                    </div>
                    {isInstallmentOrder && (
                      <>
                        <div>
                          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-neutral-600 transition-all duration-300"
                              style={{ width: `${installmentProgressPercent}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-600">
                            Progression: {installmentProgressPercent}%
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                          <p>
                            Prochaine échéance:{' '}
                            <span className="font-semibold text-gray-900">
                              {installmentWorkflow?.nextDueDate
                                ? formatOrderTimestamp(installmentWorkflow.nextDueDate)
                                : 'Aucune'}
                            </span>
                          </p>
                          <p>
                            Prochaine tranche à payer:{' '}
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(installmentWorkflow?.nextInstallmentAmount || 0)}
                            </span>
                          </p>
                          <p>
                            Pénalités cumulées:{' '}
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(installmentPlan?.totalPenaltyAccrued || 0)}
                            </span>
                          </p>
                        </div>
                        {order.status === 'completed' && (
                          <div className="pt-2 border-t border-gray-200 text-xs text-gray-600">
                            <p>
                              Statut de vente:{' '}
                              <span className="font-semibold text-gray-900">
                                {INSTALLMENT_SALE_STATUS_LABELS[installmentSaleStatus] || 'Confirmée'}
                              </span>
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {!isInstallmentOrder && (order.paymentName || order.paymentTransactionCode) && (
                      <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                        {order.paymentName && <p>Payeur: {order.paymentName}</p>}
                        {order.paymentTransactionCode && <p>Transaction: {order.paymentTransactionCode}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {isInstallmentOrder && (
              <InstallmentReminder
                plan={{
                  ...installmentPlan,
                  totalAmount: installmentTotal,
                  amountPaid: installmentPaid,
                  remainingAmount: installmentRemaining
                }}
                formatCurrency={formatCurrency}
              />
            )}

            {isInstallmentOrder && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/40 p-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-neutral-600" /> Validation de vente
                </h4>
                <p className="text-sm text-gray-700">
                  Statut:{' '}
                  <span className="font-semibold">
                    {saleConfirmationConfirmed ? 'Confirmée par le vendeur' : 'En attente de confirmation vendeur'}
                  </span>
                </p>
                {installmentPlan?.guarantor?.required && (
                  <p className="text-xs text-gray-600">
                    Garant enregistré: {installmentPlan?.guarantor?.fullName || 'N/A'} (
                    {installmentPlan?.guarantor?.phone || 'N/A'})
                  </p>
                )}
              </div>
            )}

            {isInstallmentOrder && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-500" /> Échéancier et preuves transactionnelles
                </h4>
                {!visibleInstallmentEntries.length ? (
                  <p className="text-sm text-gray-500">Aucune tranche disponible.</p>
                ) : (
                  visibleInstallmentEntries.map(({ entry, index }) => {
                    const isCurrentInstallment = installmentCurrentIndex === index;
                    const canUploadProof =
                      saleConfirmationConfirmed &&
                      isCurrentInstallment &&
                      ['pending', 'overdue'].includes(entry?.status);
                    const transactionProof = entry?.transactionProof || {};
                    const hasTransactionProof = Boolean(transactionProof?.transactionCode);
                    const proofDraftState = installmentProofForms[index] || {};
                    const proofDraft = {
                      payerName:
                        proofDraftState?.payerName ??
                        transactionProof?.senderName ??
                        user?.name ??
                        '',
                      transactionCode:
                        proofDraftState?.transactionCode ??
                        transactionProof?.transactionCode ??
                        ''
                    };
                    return (
                      <div key={`${order._id}-installment-${index}`} className="rounded-xl border border-gray-200 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              Tranche {index + 1} • {formatCurrency(entry?.amount || 0)}
                            </p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getScheduleStatusClassName(entry?.status)}`}>
                            {getScheduleStatusLabel(entry?.status)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Échéance: {entry?.dueDate ? formatOrderTimestamp(entry.dueDate) : 'Non définie'}
                        </div>
                        {hasTransactionProof && (
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2 text-xs text-neutral-900 space-y-1">
                            <p>
                              Expéditeur: <span className="font-semibold">{transactionProof.senderName || 'N/A'}</span>
                            </p>
                            <p>
                              ID transaction:{' '}
                              <span className="font-semibold">{transactionProof.transactionCode || 'N/A'}</span>
                            </p>
                            <p>
                              Montant:{' '}
                              <span className="font-semibold">{formatCurrency(transactionProof.amount || entry?.amount || 0)}</span>
                            </p>
                            {transactionProof?.submittedAt && (
                              <p>
                                Soumis le:{' '}
                                <span className="font-semibold">{formatOrderTimestamp(transactionProof.submittedAt)}</span>
                              </p>
                            )}
                          </div>
                        )}
                        {Number(entry?.penaltyAmount || 0) > 0 && (
                          <p className="text-xs text-amber-700">
                            Pénalité appliquée: {formatCurrency(entry?.penaltyAmount || 0)}
                          </p>
                        )}
                        {!saleConfirmationConfirmed && (
                          <p className="text-xs text-amber-700">
                            La vente doit être confirmée par le vendeur avant l’envoi des preuves transactionnelles.
                          </p>
                        )}
                        {canUploadProof && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                                Nom de l’expéditeur
                              </label>
                              <input
                                type="text"
                                value={String(proofDraft.payerName ?? '')}
                                onChange={(event) =>
                                  handleInstallmentProofFieldChange(index, 'payerName', event.target.value)
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                                placeholder="Nom affiché dans le transfert"
                              />
                            </div>
                            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 overflow-hidden">
                              <p className="text-xs font-bold uppercase text-neutral-800 mb-2">
                                Exemple: où trouver l'ID dans le SMS
                              </p>
                              <img
                                src="/images/transaction-id-sms-example-checkout.png"
                                alt="Exemple de SMS Mobile Money montrant l'ID de la transaction"
                                className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-white shadow-sm object-contain"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                                ID transaction (10 chiffres)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={10}
                                value={String(proofDraft.transactionCode ?? '')}
                                onChange={(event) =>
                                  handleInstallmentProofFieldChange(index, 'transactionCode', event.target.value)
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                                placeholder="Ex: 7232173826"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                                Montant de la tranche
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(entry?.amount || 0)}
                                readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInstallmentProofUpload(index, entry)}
                              disabled={
                                installmentUploadIndex === index ||
                                !String(proofDraft.payerName || '').trim() ||
                                String(proofDraft.transactionCode || '').replace(/\D/g, '').length !== 10
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-neutral-600 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
                            >
                              {installmentUploadIndex === index ? 'Envoi...' : 'Envoyer la preuve transactionnelle'}
                            </button>
                          </div>
                        )}
                        {entry?.status === 'proof_uploaded' && (
                          <p className="text-xs text-neutral-700">
                            Votre preuve est transmise. En attente de validation vendeur.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-500" /> Gestionnaire</h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <p className="text-sm font-semibold text-gray-900">{createdByLabel}</p>
                {order.createdBy?.email && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Mail className="w-3 h-3" />{order.createdBy.email}</p>}
              </div>
            </div>

            {effectiveOrderStatus === 'cancelled' && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-bold text-red-800">Commande annulée</p>
                </div>
                {order.cancellationReason && <p className="text-sm text-red-700">Raison: {order.cancellationReason}</p>}
                {order.cancelledAt && <p className="text-xs text-red-600">Annulée le {formatOrderTimestamp(order.cancelledAt)}</p>}
              </div>
            )}

            {effectiveOrderStatus !== 'cancelled' && (
              isInstallmentOrder ? (
                <OrderProgress status={effectiveOrderStatus} paymentType="installment" />
              ) : (
                <AnimatedOrderTimeline
                  status={effectiveOrderStatus}
                  paymentType={order.paymentType}
                  deliveryMode={order.deliveryMode}
                />
              )
            )}

            {buyerPrimaryAction ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    Action suivante
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handlePrimaryBuyerAction}
                  disabled={isPrimaryActionPending || skipLoadingId === order._id}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${getPrimaryActionClassName(
                    buyerPrimaryAction.intent
                  )}`}
                >
                  {isPrimaryActionPending ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : null}
                  {buyerPrimaryAction.label}
                </button>
                {buyerPrimaryAction.mode === 'cancel' && buyerStatusMutation.uiPhase === 'stillWorking' ? (
                  <p className="text-xs text-amber-700">
                    Traitement en cours... merci de patienter.
                  </p>
                ) : null}
                {buyerPrimaryAction.mode === 'cancel' && buyerStatusMutation.uiPhase === 'slow' ? (
                  <p className="text-xs text-amber-700">
                    Réseau lent. Vérification automatique en cours. Vérifiez le statut avant de renvoyer.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <OrderChat order={order} buttonText="Contacter le vendeur" unreadCount={unreadCount} />
              {['delivered', 'completed', 'confirmed_by_client'].includes(effectiveOrderStatus) &&
                order.items?.length > 0 && (
                <button type="button" onClick={handleReorder} disabled={reordering} className="w-full px-6 py-3 rounded-xl bg-neutral-600 text-white font-semibold hover:bg-neutral-700 flex items-center justify-center gap-2 disabled:opacity-50">
                  {reordering ? <Clock className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  <span>{reordering ? 'Ajout au panier...' : 'Commander à nouveau'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100 text-xs text-gray-600">
              {statusTimelineEntries.map((entry) => {
                const EntryIcon = entry.icon;
                return (
                  <span key={entry.key} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                    <EntryIcon className="w-3 h-3" />
                    {entry.label}: {formatOrderTimestamp(entry.time)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile-only: Suggestions & similar products at bottom (like Suggestions page) */}
        {isMobile && aiRecommendationsEnabled && (
          <div className="mt-8 md:hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-600" />
                Suggestions & produits similaires
              </h3>
              <Link to="/suggestions" className="text-sm font-semibold text-neutral-600 flex items-center gap-0.5">
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
                        <p className="text-xs font-bold text-neutral-600 mt-0.5">{formatCurrency(price)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Link
                to="/suggestions"
                className="block py-6 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500 hover:border-neutral-200 hover:text-neutral-600"
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

      <BaseModal
        isOpen={Boolean(proofPreview?.url)}
        onClose={() => setProofPreview(null)}
        mobileSheet={false}
        size="full"
        rootClassName="z-[140] p-3 sm:p-6"
        panelClassName="max-h-[92dvh] border-none bg-transparent p-0 shadow-none sm:max-w-[92vw]"
        backdropClassName="bg-black/85 backdrop-blur-sm"
        ariaLabel={proofPreview?.label || 'Aperçu preuve'}
      >
        <div className="relative mx-auto flex max-h-[92dvh] max-w-[92vw] items-center justify-center p-2 sm:p-4">
          {proofPreview?.url ? (
            <a
              href={proofPreview.url}
              target="_blank"
              rel="noreferrer"
              className="absolute left-2 top-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 sm:left-4 sm:top-4"
            >
              Ouvrir
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setProofPreview(null)}
            className="absolute right-2 top-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 sm:right-4 sm:top-4"
          >
            Fermer
          </button>
          <div
            className={`rounded-xl p-2 sm:p-3 ${
              proofPreviewIsSignature ? 'bg-white shadow-2xl' : 'bg-black/20'
            }`}
          >
            <img
              src={proofPreview?.url || ''}
              alt={proofPreview?.label || 'Aperçu preuve'}
              className={`max-h-[84dvh] max-w-[88vw] rounded-lg object-contain ${
                proofPreviewIsSignature ? 'bg-white' : 'bg-black/10'
              }`}
              loading="lazy"
            />
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
