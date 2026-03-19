import React, { useEffect, useState, useCallback, useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
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
  ClipboardList,
  Loader2
} from 'lucide-react';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import OrderChat from '../components/OrderChat';
import DeliveryProofUpload from '../components/DeliveryProofUpload';
import GlassHeader from '../components/orders/GlassHeader';
import StatusBadge from '../components/orders/StatusBadge';
import AnimatedOrderTimeline from '../components/orders/AnimatedOrderTimeline';
import InstallmentReminder from '../components/orders/InstallmentReminder';
import { OrderDetailSkeleton } from '../components/orders/OrderSkeletons';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { getPickupShopAddress, isPickupOrder as resolvePickupOrder } from '../utils/pickupAddress';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import { getInstallmentWorkflow } from '../utils/installmentTracking';
import useSellerOrderDetailQuery from '../hooks/useSellerOrderDetailQuery';
import useSellerOrderStatusMutation from '../hooks/useSellerOrderStatusMutation';
import useOrderRealtimeSync from '../hooks/useOrderRealtimeSync';
import useNetworkProfile from '../hooks/useNetworkProfile';

const STATUS_LABELS = {
  pending_payment: 'Paiement en attente',
  paid: 'Payée',
  ready_for_pickup: 'Prête au retrait',
  picked_up_confirmed: 'Retrait confirmé',
  ready_for_delivery: 'Prête à livrer',
  out_for_delivery: 'En cours de livraison',
  delivery_proof_submitted: 'Preuve soumise',
  confirmed_by_client: 'Confirmée client',
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
  delivery_proof_submitted: ClipboardList,
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

const getInstallmentSaleStatusClassName = (status) => {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'delivering':
      return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'confirmed':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
};

const getSellerTimelineStatus = (order, workflowStatus = '') => {
  const rawStatus = String(order?.status || '').toLowerCase();
  if (rawStatus === 'cancelled') return 'cancelled';

  const platformAutoConfirmed =
    (Boolean(order?.platformDeliveryRequestId) ||
      String(order?.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY') &&
    String(order?.platformDeliveryStatus || '').toUpperCase() === 'DELIVERED';

  if (String(order?.paymentType || '') === 'installment') {
    const saleStatus = String(order?.installmentSaleStatus || '').toLowerCase();
    if (saleStatus === 'delivering') return 'out_for_delivery';
    if (saleStatus === 'delivered') return 'completed';
    return String(workflowStatus || rawStatus || 'pending_installment');
  }

  if (resolvePickupOrder(order) && rawStatus === 'confirmed') {
    const hasSubmittedPayment = Boolean(
      Number(order?.paidAmount || 0) > 0 ||
        String(order?.paymentTransactionCode || '').trim() ||
        String(order?.paymentName || '').trim()
    );
    return hasSubmittedPayment ? 'paid' : 'pending_payment';
  }

  if (rawStatus === 'delivered' && String(order?.deliveryStatus || '').toLowerCase() === 'submitted' && !platformAutoConfirmed) {
    return 'delivery_proof_submitted';
  }

  if (rawStatus === 'delivering') return 'out_for_delivery';
  return rawStatus || 'pending';
};

const getPrimaryActionMeta = (order) => {
  const nextAction = order?.nextAction?.seller;
  if (!nextAction || typeof nextAction !== 'object') return null;
  const actionKey = String(nextAction.key || '').trim();
  const nextStatus = String(nextAction.nextStatus || '').trim();

  const base = {
    key: actionKey,
    nextStatus: nextStatus || null,
    disabled: false,
    intent: 'primary',
    mode: 'status',
    label: 'Mettre à jour le statut'
  };

  switch (actionKey) {
    case 'confirm_order':
      return { ...base, label: 'Confirmer la commande' };
    case 'mark_ready_for_delivery':
      return { ...base, label: 'Passer: Prête à livrer' };
    case 'start_delivery':
      return { ...base, label: 'Passer: En livraison' };
    case 'mark_ready_for_pickup':
      return { ...base, label: 'Passer: Prête au retrait' };
    case 'submit_delivery_proof':
      return {
        ...base,
        mode: 'proof_delivery',
        nextStatus: null,
        intent: 'success',
        label: 'Preuve livraison'
      };
    case 'submit_pickup_proof':
      return {
        ...base,
        mode: 'proof_pickup',
        nextStatus: null,
        intent: 'success',
        label: 'Preuve retrait'
      };
    case 'confirm_installment_sale':
      return {
        ...base,
        mode: 'confirm_sale',
        nextStatus: null,
        intent: 'primary',
        label: 'Confirmer la vente tranche'
      };
    case 'wait_installment_settlement':
      return {
        ...base,
        mode: 'none',
        nextStatus: null,
        disabled: true,
        intent: 'muted',
        label: 'En attente du paiement complet'
      };
    case 'wait_client_confirmation':
      return {
        ...base,
        mode: 'none',
        nextStatus: null,
        disabled: true,
        intent: 'muted',
        label: 'En attente de confirmation client'
      };
    default:
      if (nextStatus) {
        return {
          ...base,
          label: `Passer: ${nextStatus}`
        };
      }
      return null;
  }
};

const getPrimaryActionClassName = (intent = 'primary') => {
  switch (intent) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    case 'muted':
      return 'border-gray-200 bg-gray-100 text-gray-500';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
    case 'primary':
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100';
  }
};

const CLASSIC_ORDER_FLOW = [
  { id: 'pending_payment', label: 'Paiement en attente', description: 'En attente de confirmation du paiement.', icon: Clock, color: 'gray' },
  { id: 'paid', label: 'Payée', description: 'Paiement soumis par le client. En attente de confirmation.', icon: CreditCard, color: 'emerald' },
  { id: 'ready_for_delivery', label: 'Prête à livrer', description: 'Préparation terminée.', icon: Package, color: 'amber' },
  { id: 'out_for_delivery', label: 'En cours de livraison', description: 'Colis pris en charge.', icon: Truck, color: 'blue' },
  { id: 'delivered', label: 'Livrée', description: 'Livraison signalée.', icon: CheckCircle, color: 'emerald' },
  { id: 'delivery_proof_submitted', label: 'Preuve soumise', description: 'En attente de confirmation client.', icon: ClipboardList, color: 'indigo' },
  { id: 'confirmed_by_client', label: 'Confirmée client', description: 'Le client a confirmé la réception.', icon: CheckCircle, color: 'emerald' },
  { id: 'completed', label: 'Commande terminée', description: 'Livraison clôturée.', icon: CheckCircle, color: 'emerald' },
  { id: 'cancelled', label: 'Commande annulée', description: 'Cette commande a été annulée.', icon: X, color: 'red' }
];

const INSTALLMENT_ORDER_FLOW = [
  { id: 'pending_installment', label: 'Validation de vente', description: 'Confirmez la preuve de vente du client.', icon: Clock, color: 'violet' },
  { id: 'installment_active', label: 'Plan actif', description: 'Les tranches sont en cours de validation.', icon: CreditCard, color: 'indigo' },
  { id: 'overdue_installment', label: 'Retard', description: 'Une ou plusieurs tranches sont en retard.', icon: AlertCircle, color: 'rose' },
  { id: 'completed', label: 'Paiement terminé', description: 'Toutes les tranches sont validées.', icon: CheckCircle, color: 'emerald' },
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

const getScheduleStatusLabel = (status) => {
  switch (status) {
    case 'paid':
      return 'Payé';
    case 'proof_uploaded':
      return 'Preuve reçue';
    case 'overdue':
      return 'En retard';
    case 'waived':
      return 'Annulé';
    case 'pending':
    default:
      return 'En attente';
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

const OrderProgress = ({ status, paymentType }) => {
  const flow = paymentType === 'installment' ? INSTALLMENT_ORDER_FLOW : CLASSIC_ORDER_FLOW;
  const currentIndexRaw = flow.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;
  const colorClasses = {
    gray: 'bg-gray-600',
    amber: 'bg-amber-600',
    blue: 'bg-neutral-600',
    emerald: 'bg-emerald-600',
    red: 'bg-red-600',
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
          <div className="absolute top-0 left-0 w-full bg-neutral-600 transition-all duration-500" style={{ height: `${(currentIndex / (flow.length - 1)) * 100}%` }} />
        </div>
        <div className="space-y-6 relative">
          {flow.filter((s) => s.id !== 'cancelled').map((step, index) => {
            const Icon = step.icon;
            const reached = currentIndex >= index;
            const isCurrent = currentIndex === index;
            const stepColor = colorClasses[step.color] || colorClasses.gray;
            return (
              <div key={step.id} className="flex items-start gap-4 relative">
                <div
                  className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    reached
                      ? `${stepColor} border-transparent text-white shadow-lg scale-110`
                      : 'border-gray-300 text-gray-400 bg-white'
                  }`}
                >
                  <Icon size={16} />
                  {isCurrent && (
                    <div className={`absolute inset-0 rounded-full ${stepColor} animate-ping opacity-75`} />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stepColor} text-white`}>
                        En cours
                      </span>
                    )}
                    {!isCurrent && reached && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                        Terminé
                      </span>
                    )}
                  </div>
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
  const { user } = useContext(AuthContext);
  const { getRuntimeValue } = useAppSettings();
  const externalLinkProps = useDesktopExternalLink();
  const queryClient = useQueryClient();
  const { rapid3GActive, offlineBannerText, rapid3GBannerText } = useNetworkProfile();

  const [order, setOrder] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusUpdateFeedback, setStatusUpdateFeedback] = useState({ id: '', message: '', tone: 'error' });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelIssueRefund, setCancelIssueRefund] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showDeliveryProofForm, setShowDeliveryProofForm] = useState(false);
  const [saleConfirmationLoading, setSaleConfirmationLoading] = useState(false);
  const [paymentValidationLoadingIndex, setPaymentValidationLoadingIndex] = useState(-1);
  const [requestPlatformDeliveryLoading, setRequestPlatformDeliveryLoading] = useState(false);
  const [requestPlatformDeliveryOpen, setRequestPlatformDeliveryOpen] = useState(false);
  const [requestPlatformDeliveryNote, setRequestPlatformDeliveryNote] = useState('');
  const [requestPlatformDeliveryInvoiceUrl, setRequestPlatformDeliveryInvoiceUrl] = useState('');
  const [requestPlatformDeliveryError, setRequestPlatformDeliveryError] = useState('');
  const [deliveryPinDraft, setDeliveryPinDraft] = useState('');
  const [deliveryPinLoading, setDeliveryPinLoading] = useState(false);
  const [deliveryPinError, setDeliveryPinError] = useState('');
  const [deliveryPinValue, setDeliveryPinValue] = useState('');
  const [deliveryPinExpiresAt, setDeliveryPinExpiresAt] = useState('');
  const [deliveryFeeEditValue, setDeliveryFeeEditValue] = useState('');
  const [deliveryFeeSaving, setDeliveryFeeSaving] = useState(false);
  const [proofPreview, setProofPreview] = useState(null);

  // Delivery fee cannot be modified once order is "Prête à livrer" or "En cours de livraison"
  const SELLER_CAN_EDIT_DELIVERY_FEE = [
    'pending_payment',
    'paid',
    'pending',
    'pending_installment',
    'installment_active',
    'overdue_installment',
    'confirmed',
    'ready_for_pickup'
  ];
  const deliveryFeeLockedByFullPayment =
    Boolean(order?.deliveryFeeLocked) && String(order?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
  const canEditDeliveryFee =
    order &&
    SELLER_CAN_EDIT_DELIVERY_FEE.includes(String(order.status)) &&
    !deliveryFeeLockedByFullPayment;
  const deliveryFeeUpdatedAt = order?.deliveryFeeUpdatedAt ? new Date(order.deliveryFeeUpdatedAt) : null;

  const normalizeFileUrl = useCallback((url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const host = apiBase.replace(/\/api\/?$/, '');
    return `${host}/${String(url).replace(/^\/+/, '')}`;
  }, []);

  const openProofPreview = useCallback(
    (url, label = 'Preuve') => {
      const normalized = normalizeFileUrl(url);
      if (!normalized) return;
      setProofPreview({
        url: normalized,
        label: String(label || 'Preuve')
      });
    },
    [normalizeFileUrl]
  );

  const sellerOrderDetailQuery = useSellerOrderDetailQuery({
    orderId,
    userId: user?._id || user?.id || '',
    enabled: Boolean(orderId)
  });

  const loadOrder = useCallback(async () => {
    await sellerOrderDetailQuery.refetch();
  }, [sellerOrderDetailQuery.refetch]);

  useEffect(() => {
    const nextOrder = sellerOrderDetailQuery.data?.order || null;
    setOrder(nextOrder);
    setUnreadCount(Number(sellerOrderDetailQuery.data?.unreadCount || 0));
  }, [sellerOrderDetailQuery.data]);

  useOrderRealtimeSync({
    scope: 'seller',
    orderId,
    enabled: Boolean(orderId),
    pollIntervalMs: 15000,
    currentStatus: order?.status || ''
  });

  const statusMutation = useSellerOrderStatusMutation({
    orderId,
    onApplied: async (result) => {
      const payload = result?.data?.data || result?.data;
      if (payload?.order?._id) {
        setOrder(payload.order);
      } else if (payload?._id) {
        setOrder(payload);
      }
      setStatusUpdateFeedback({ id: '', message: '', tone: 'error' });
      showToast(
        result?.recovered ? 'Statut mis à jour après vérification automatique.' : 'Statut mis à jour.',
        { variant: 'success' }
      );
    },
    onFailed: async (error, _variables, context) => {
      if (context?.possiblyCommitted) {
        const message = 'Réseau lent ou interrompu. Vérification automatique en cours avant tout renvoi.';
        setStatusUpdateFeedback({ id: orderId || '', message, tone: 'warning' });
        showToast(message, { variant: 'info' });
        return;
      }
      const message = error?.response?.data?.message || 'Impossible de mettre à jour le statut.';
      setStatusUpdateFeedback({ id: orderId || '', message, tone: 'error' });
      showToast(message, { variant: 'error' });
    },
    onQueued: async () => {
      setStatusUpdateFeedback({ id: '', message: '', tone: 'error' });
      showToast('Statut enregistré hors ligne. Synchronisation automatique dès le retour du réseau.', {
        variant: 'info'
      });
    }
  });

  const invalidateOrderQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['orders', 'detail', 'seller', String(orderId || '')],
      refetchType: 'active'
    });
    await queryClient.invalidateQueries({
      queryKey: ['orders', 'list', 'seller'],
      refetchType: 'inactive'
    });
    window.dispatchEvent(new Event('hdmarket:orders-refresh'));
  }, [orderId, queryClient]);

  const handleStatusUpdate = async (nextStatus) => {
    if (!order) return;
    setStatusUpdatingId(order._id);
    setStatusUpdateFeedback({ id: '', message: '', tone: 'error' });
    try {
      await statusMutation.mutateAsync({ nextStatus });
    } catch {
      // handled in mutation callbacks
    } finally {
      setStatusUpdatingId('');
    }
  };

  const handleUpdateDeliveryFee = async () => {
    if (!order) return;
    if (deliveryFeeLockedByFullPayment) {
      showToast('Les frais de livraison sont verrouillés car la commande a été payée intégralement.', {
        variant: 'info'
      });
      return;
    }
    const num = Number(deliveryFeeEditValue);
    if (!Number.isFinite(num) || num < 0) {
      showToast('Montant invalide.', { variant: 'error' });
      return;
    }
    setDeliveryFeeSaving(true);
    try {
      const { data } = await api.patch(`/orders/seller/${order._id}/delivery-fee`, {
        deliveryFeeTotal: num
      });
      setOrder(data);
      setDeliveryFeeEditValue('');
      showToast('Frais de livraison mis à jour. Le client a été notifié.', { variant: 'success' });
      await invalidateOrderQueries();
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible de modifier les frais.', { variant: 'error' });
    } finally {
      setDeliveryFeeSaving(false);
    }
  };

  const handleConfirmInstallmentSale = async (approve) => {
    if (!order) return;
    setSaleConfirmationLoading(true);
    try {
      const { data } = await api.patch(`/orders/seller/${order._id}/installment/confirm-sale`, {
        approve
      });
      if (data?._id) {
        setOrder(data);
      } else {
        await loadOrder();
      }
      showToast(
        approve
          ? 'Preuve de vente confirmée. Le plan de tranches est activé.'
          : 'Commande tranche refusée et annulée.',
        { variant: 'success' }
      );
      await invalidateOrderQueries();
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de traiter la preuve de vente.';
      showToast(message, { variant: 'error' });
    } finally {
      setSaleConfirmationLoading(false);
    }
  };

  const handleValidateInstallmentPayment = async (scheduleIndex, approve) => {
    if (!order) return;
    setPaymentValidationLoadingIndex(scheduleIndex);
    try {
      const { data } = await api.patch(
        `/orders/seller/${order._id}/installment/payments/${scheduleIndex}/validate`,
        { approve }
      );
      setOrder(data);
      showToast(
        approve ? 'Tranche validée.' : 'Tranche rejetée. Le client doit renvoyer une preuve.',
        { variant: 'success' }
      );
      await invalidateOrderQueries();
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de valider cette tranche.';
      showToast(message, { variant: 'error' });
    } finally {
      setPaymentValidationLoadingIndex(-1);
    }
  };

  const closeCancelModal = ({ force = false } = {}) => {
    if (cancelLoading && !force) return;
    setCancelModalOpen(false);
    setCancelReason('');
    setCancelIssueRefund(false);
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim() || cancelReason.trim().length < 5) return;
    setCancelLoading(true);
    try {
      const issueRefund = Boolean(cancelIssueRefund && Number(order.paidAmount || 0) > 0);
      const { data } = await api.post(`/orders/seller/${order._id}/cancel`, {
        reason: cancelReason.trim(),
        issueRefund
      });
      setOrder(data);
      showToast(
        issueRefund
          ? 'Commande annulée. Le client est notifié et le remboursement est demandé.'
          : 'Commande annulée. Le client a été notifié.',
        { variant: 'success' }
      );
      closeCancelModal({ force: true });
      await invalidateOrderQueries();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.details?.[0] || 'Impossible d\'annuler la commande.';
      showToast(message, { variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRequestPlatformDelivery = async () => {
    if (!order?._id) return;
    const fallbackInvoiceUrl = (() => {
      if (typeof window === 'undefined' || !order?._id) return '';
      const host = String(window.location.hostname || '').trim().toLowerCase();
      const looksLikeIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
      if (!host || (host !== 'localhost' && !host.includes('.') && !looksLikeIpv4)) {
        return '';
      }
      return `${window.location.origin}/orders/detail/${order._id}`;
    })();
    const rawInvoiceUrl = String(requestPlatformDeliveryInvoiceUrl || fallbackInvoiceUrl || '').trim();
    const normalizedInvoiceUrl = (() => {
      if (!rawInvoiceUrl) return '';
      if (/^https?:\/\//i.test(rawInvoiceUrl)) return rawInvoiceUrl;
      // Accept domain-like values typed by sellers and normalize them.
      return `https://${rawInvoiceUrl}`;
    })();

    const totalAmount = Number(order.totalAmount || 0);
    const paidAmount = Number(order.paidAmount || 0);
    const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
    const settlementInstruction = remainingAmount > 0
      ? `Montant restant a collecter: ${formatCurrency(remainingAmount)}. Faire signer la facture par le client a la livraison.`
      : 'Faire signer la facture par le client a la livraison.';
    const sellerNote = String(requestPlatformDeliveryNote || '').trim();
    const mergedNote = sellerNote
      ? `${sellerNote}\n\n${settlementInstruction}`
      : settlementInstruction;

    if (requireInvoiceForPlatformDelivery && !normalizedInvoiceUrl) {
      const message = 'URL facture requise pour envoyer la demande.';
      setRequestPlatformDeliveryError(message);
      showToast(message, { variant: 'error' });
      return;
    }

    if (normalizedInvoiceUrl) {
      try {
        const parsed = new URL(normalizedInvoiceUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('INVALID_PROTOCOL');
        }
        const host = String(parsed.hostname || '').trim().toLowerCase();
        const looksLikeIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
        if (!host || (host !== 'localhost' && !host.includes('.') && !looksLikeIpv4)) {
          throw new Error('INVALID_HOST');
        }
      } catch {
        const message = 'URL facture invalide (ex: https://exemple.com/facture.pdf).';
        setRequestPlatformDeliveryError(message);
        showToast(message, { variant: 'error' });
        return;
      }
    }

    setRequestPlatformDeliveryLoading(true);
    setRequestPlatformDeliveryError('');
    try {
      const payload = {
        note: mergedNote,
        pickupInstructions: mergedNote,
        invoiceUrl: normalizedInvoiceUrl
      };
      const { data } = await api.post(`/orders/${order._id}/request-delivery`, payload);
      showToast(data?.message || 'Demande de livraison envoyée.', { variant: 'success' });
      setRequestPlatformDeliveryOpen(false);
      setRequestPlatformDeliveryNote('');
      setRequestPlatformDeliveryInvoiceUrl('');
      await loadOrder();
      await invalidateOrderQueries();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.details?.[0] ||
        'Impossible de demander la livraison plateforme.';
      setRequestPlatformDeliveryError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setRequestPlatformDeliveryLoading(false);
    }
  };

  const handleSellerDeliveryPin = async (action = 'generate') => {
    if (!order?._id || deliveryPinLoading) return;
    const normalizedAction = String(action || '').trim().toLowerCase();
    const manualCode = String(deliveryPinDraft || '').trim();
    if (normalizedAction === 'set' && !/^\d{4,8}$/.test(manualCode)) {
      const message = 'Le code doit contenir entre 4 et 8 chiffres.';
      setDeliveryPinError(message);
      showToast(message, { variant: 'error' });
      return;
    }

    setDeliveryPinLoading(true);
    setDeliveryPinError('');
    try {
      const payload =
        normalizedAction === 'clear'
          ? { action: 'clear' }
          : normalizedAction === 'set'
          ? { action: 'set', deliveryPinCode: manualCode, expiresHours: 24 }
          : { action: 'generate', expiresHours: 24 };
      const { data } = await api.post(`/orders/${order._id}/delivery-pin`, payload);
      const nextCode = String(data?.deliveryPinCode || '').trim();
      const nextExpiresAt = data?.deliveryPinCodeExpiresAt || '';
      setDeliveryPinValue(nextCode);
      setDeliveryPinExpiresAt(nextExpiresAt);
      if (normalizedAction !== 'set') {
        setDeliveryPinDraft(nextCode || '');
      }
      showToast(data?.message || 'Code de livraison mis à jour.', { variant: 'success' });
      await loadOrder();
      await invalidateOrderQueries();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.details?.[0] ||
        'Impossible de mettre à jour le code de livraison.';
      setDeliveryPinError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setDeliveryPinLoading(false);
    }
  };

  useEffect(() => {
    if (!order) {
      if (showDeliveryProofForm) setShowDeliveryProofForm(false);
      return;
    }
    const isInstallmentOrder = order.paymentType === 'installment';
    const installmentWorkflowStatus = isInstallmentOrder
      ? getInstallmentWorkflow(order)?.workflowStatus || order.status
      : order.status;
    const installmentSaleStatus = order.installmentSaleStatus || '';
    const canRequestDeliveryProof =
      ((!isInstallmentOrder && ['delivering', 'out_for_delivery'].includes(order.status)) ||
        (isInstallmentOrder &&
          installmentWorkflowStatus === 'completed' &&
          (installmentSaleStatus || 'confirmed') === 'delivering')) &&
      !['submitted', 'verified'].includes(order.deliveryStatus);
    const canRequestPickupProof =
      !isInstallmentOrder &&
      resolvePickupOrder(order) &&
      ['confirmed', 'ready_for_pickup'].includes(order.status) &&
      !['submitted', 'verified'].includes(order.deliveryStatus);

    if (!(canRequestDeliveryProof || canRequestPickupProof) && showDeliveryProofForm) {
      setShowDeliveryProofForm(false);
    }
  }, [order, showDeliveryProofForm]);

  useEffect(() => {
    if (!order?.platformDeliveryRequestId) {
      setDeliveryPinDraft('');
      setDeliveryPinValue('');
      setDeliveryPinExpiresAt('');
      setDeliveryPinError('');
    }
  }, [order?.platformDeliveryRequestId]);

  const loading = sellerOrderDetailQuery.isLoading && !order;
  const queryErrorMessage =
    sellerOrderDetailQuery.error?.response?.data?.message ||
    sellerOrderDetailQuery.error?.message ||
    '';

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <GlassHeader title="Commande" subtitle="Chargement..." backTo="/seller/orders" />
        <OrderDetailSkeleton />
      </div>
    );
  }

  if (queryErrorMessage || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Link to="/seller/orders" className="inline-flex items-center gap-2 text-neutral-600 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>
        <p className="text-red-600">{queryErrorMessage || 'Commande introuvable.'}</p>
      </div>
    );
  }

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const isInstallmentOrder = order.paymentType === 'installment';
  const orderPaymentMode = resolveOrderPaymentMode(order);
  const isFullPaymentOrder = orderPaymentMode === 'FULL_PAYMENT';
  const paymentModeLabel = getPaymentModeLabel(orderPaymentMode);
  const paidAmountLabel = isInstallmentOrder
    ? 'Montant validé'
    : isFullPaymentOrder
      ? 'Paiement reçu'
      : 'Acompte versé';
  const isPickupOrder = resolvePickupOrder(order);
  const pickupShopAddress = isPickupOrder ? getPickupShopAddress(order) : null;
  const installmentPlan = isInstallmentOrder ? order.installmentPlan || {} : null;
  const installmentSchedule = Array.isArray(installmentPlan?.schedule) ? installmentPlan.schedule : [];
  const installmentWorkflow = isInstallmentOrder ? getInstallmentWorkflow(order) : null;
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
  const showPayment = Boolean(
    isInstallmentOrder ||
      paidAmount ||
      order.paymentTransactionCode ||
      order.paymentName
  );
  const pickupStatusLabel = (() => {
    if (!isPickupOrder || isInstallmentOrder) return '';
    const rawStatus = String(order.status || '').toLowerCase();
    if (rawStatus === 'cancelled') return 'cancelled';
    if (rawStatus === 'ready_for_pickup') return 'ready_for_pickup';
    if (['picked_up_confirmed', 'completed', 'confirmed_by_client', 'delivered'].includes(rawStatus)) {
      return 'picked_up_confirmed';
    }
    const hasSubmittedPayment = Boolean(
      Number(order.paidAmount || 0) > 0 ||
        String(order.paymentTransactionCode || '').trim() ||
        String(order.paymentName || '').trim()
    );
    return hasSubmittedPayment ? 'paid' : 'pending_payment';
  })();
  const displayStatusLabel = isInstallmentOrder
    ? installmentWorkflow?.workflowStatus || order.status
    : pickupStatusLabel || order.status;
  const StatusIcon = STATUS_ICONS[displayStatusLabel] || STATUS_ICONS[order.status] || Clock;
  const statusStyle =
    STATUS_STYLES[displayStatusLabel] || STATUS_STYLES[order.status] || STATUS_STYLES.pending;
  const canManageInstallmentSaleStatus =
    isInstallmentOrder &&
    (installmentWorkflow?.workflowStatus || order.status) === 'completed' &&
    !['delivered', 'cancelled'].includes(installmentSaleStatus);
  const normalizedOrderStatusForTimeline = (() => {
    const platformAutoConfirmed =
      (Boolean(order.platformDeliveryRequestId) ||
        String(order.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY') &&
      String(order.platformDeliveryStatus || '').toUpperCase() === 'DELIVERED';
    if (isPickupOrder && String(order.status || '').toLowerCase() === 'confirmed') {
      const hasSubmittedPayment = Boolean(
        Number(order.paidAmount || 0) > 0 ||
          String(order.paymentTransactionCode || '').trim() ||
          String(order.paymentName || '').trim()
      );
      return hasSubmittedPayment ? 'paid' : 'pending_payment';
    }
    const map = {
      pending: 'pending_payment',
      ready_for_pickup: 'ready_for_delivery',
      picked_up_confirmed: 'delivered',
      confirmed: 'ready_for_delivery',
      delivering: 'out_for_delivery',
      delivered:
        order.deliveryStatus === 'submitted' && !platformAutoConfirmed
          ? 'delivery_proof_submitted'
          : 'delivered'
    };
    return map[order.status] || order.status;
  })();
  const canRequestDeliveryProof =
    ((!isInstallmentOrder && ['delivering', 'out_for_delivery'].includes(order.status)) ||
      (isInstallmentOrder &&
        (installmentWorkflow?.workflowStatus || order.status) === 'completed' &&
        (installmentSaleStatus || 'confirmed') === 'delivering')) &&
    !['submitted', 'verified'].includes(order.deliveryStatus);
  const canRequestPickupProof =
    !isInstallmentOrder &&
    isPickupOrder &&
    ['confirmed', 'ready_for_pickup'].includes(order.status) &&
    !['submitted', 'verified'].includes(order.deliveryStatus);
  const canRequestProof = canRequestDeliveryProof || canRequestPickupProof;
  const canShowDeliveryProofForm = canRequestProof && showDeliveryProofForm;
  const sellerCity = String(user?.city || '').trim();
  const platformDeliveryEnabled =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('enable_platform_delivery', false)).trim().toLowerCase()
    ) &&
    !['false', '0', 'no', 'off'].includes(
      String(getRuntimeValue('enable_delivery_requests', true)).trim().toLowerCase()
    );
  const requireInvoiceForPlatformDelivery =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('delivery_require_invoice_attachment', false)).trim().toLowerCase()
    );
  const deliveryPinEnabled =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('enable_delivery_pin_code', false)).trim().toLowerCase()
    );
  const platformDeliveryStatus = String(order.platformDeliveryStatus || 'NONE').toUpperCase();
  const supportsPlatformDeliveryForOrder =
    String(order.deliveryMode || '').toUpperCase() === 'DELIVERY';
  const hasPlatformDeliveryRequest = Boolean(order.platformDeliveryRequestId);
  const platformDeliveryAutoConfirmed =
    (hasPlatformDeliveryRequest || String(order.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY') &&
    platformDeliveryStatus === 'DELIVERED';
  const canManageDeliveryPin =
    platformDeliveryEnabled &&
    deliveryPinEnabled &&
    supportsPlatformDeliveryForOrder &&
    hasPlatformDeliveryRequest &&
    !['REJECTED', 'DELIVERED', 'CANCELED'].includes(platformDeliveryStatus);
  const canRequestPlatformDelivery =
    platformDeliveryEnabled &&
    supportsPlatformDeliveryForOrder &&
    !isPickupOrder &&
    !['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED'].includes(platformDeliveryStatus) &&
    !['cancelled', 'completed'].includes(order.status);
  const buyerCity = String(order.customer?.city || order.deliveryCity || '').trim();
  const cityMismatch =
    Boolean(sellerCity && buyerCity) && sellerCity.toLowerCase() !== buyerCity.toLowerCase();
  const cancellationBlockedByStatus = ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status);
  const canCancelOrder = !cancellationBlockedByStatus && order.status !== 'cancelled' && !order.cancellationWindow?.isActive;
  const sellerPrimaryAction = getPrimaryActionMeta(order);
  const handlePrimarySellerAction = async () => {
    if (!sellerPrimaryAction || sellerPrimaryAction.disabled) return;
    if (sellerPrimaryAction.mode === 'status' && sellerPrimaryAction.nextStatus) {
      await handleStatusUpdate(sellerPrimaryAction.nextStatus);
      return;
    }
    if (sellerPrimaryAction.mode === 'confirm_sale') {
      await handleConfirmInstallmentSale(true);
      return;
    }
    if (sellerPrimaryAction.mode === 'proof_delivery' || sellerPrimaryAction.mode === 'proof_pickup') {
      setShowDeliveryProofForm((prev) => !prev);
    }
  };
  const statusTimelineEntries = [
    { key: 'created', label: 'Créée', icon: Calendar, time: order.createdAt },
    { key: 'confirmed', label: 'Confirmée', icon: Package, time: order.confirmedAt },
    isPickupOrder
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
      label: isPickupOrder ? 'Retrait confirmé' : 'Livrée',
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
  const openCancelModal = ({ prefillReason = '', defaultRefund = false } = {}) => {
    setCancelModalOpen(true);
    setCancelIssueRefund(Boolean(defaultRefund && Number(order?.paidAmount || 0) > 0));
    if (prefillReason) {
      setCancelReason((currentReason) =>
        String(currentReason || '').trim() ? currentReason : prefillReason
      );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <GlassHeader
        title={`Commande #${order._id.slice(-6)}`}
        subtitle="Détail vendeur"
        backTo="/seller/orders"
        right={<StatusBadge status={displayStatusLabel} compact />}
      />
      {(sellerOrderDetailQuery.offlineSnapshotActive || rapid3GActive) && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              sellerOrderDetailQuery.offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {sellerOrderDetailQuery.offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        </div>
      )}
      {(statusMutation.queuedActionCount > 0 || statusMutation.isQueueSyncing) && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <section className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 shadow-sm dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
            <p className="font-semibold">
              {statusMutation.isQueueSyncing
                ? 'Synchronisation des changements de statut en attente...'
                : `${statusMutation.queuedActionCount} changement${statusMutation.queuedActionCount > 1 ? 's' : ''} de statut en attente de connexion.`}
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
              <span className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-bold uppercase">
                {STATUS_LABELS[displayStatusLabel] || displayStatusLabel}
              </span>
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
                      {item.snapshot?.confirmationNumber && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
                          <span className="text-[10px] font-bold text-neutral-700 uppercase">Code: {item.snapshot.confirmationNumber}</span>
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
                  <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-neutral-500" /> Code de livraison</h4>
                  <div className="p-5 rounded-xl border-2 border-neutral-200 bg-neutral-50">
                    <p className="text-xs font-semibold text-neutral-700 uppercase mb-2">Code pour le livreur</p>
                    <div className="text-4xl font-black text-neutral-900 tracking-wider font-mono text-center">{order.deliveryCode}</div>
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
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" /> {isPickupOrder ? 'Point de retrait' : 'Adresse de livraison'}
              </h4>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                {isPickupOrder ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{pickupShopAddress?.shopName || 'Boutique'}</p>
                    <p className="text-sm text-gray-800">{pickupShopAddress?.addressLine || 'Adresse boutique non renseignée'}</p>
                    {pickupShopAddress?.cityLine ? <p className="text-xs text-gray-500">{pickupShopAddress.cityLine}</p> : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{order.deliveryAddress || 'Non renseignée'}</p>
                    <p className="text-xs text-gray-500">{order.deliveryCity || 'Ville non renseignée'}</p>
                  </>
                )}
                {!isPickupOrder && order.deliveryGuy && (
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

            {cityMismatch && (
              <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-900">Attention: villes différentes</p>
                    <p className="text-xs text-orange-800 mt-1">
                      Le vendeur est à <span className="font-semibold">{sellerCity}</span> et l'acheteur est à{' '}
                      <span className="font-semibold">{buyerCity}</span>. Si la livraison est impossible, vous pouvez annuler la commande et demander un remboursement.
                    </p>
                  </div>
                </div>
                {canCancelOrder && (
                  <button
                    type="button"
                    onClick={() =>
                      openCancelModal({
                        defaultRefund: true,
                        prefillReason:
                          "Annulation pour contrainte de livraison: vendeur et acheteur dans des villes différentes."
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    <X className="w-4 h-4" />
                    Annuler et demander remboursement
                  </button>
                )}
              </div>
            )}

            {order.trackingNote && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-gray-500" /> Note de suivi</h4>
                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50"><p className="text-sm text-gray-700">{order.trackingNote}</p></div>
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
                {!isPickupOrder && (Number(order.deliveryFeeTotal ?? 0) > 0 || canEditDeliveryFee || deliveryFeeLockedByFullPayment) && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-600">
                          Frais de livraison{hasPlatformDeliveryRequest ? ' (plateforme)' : ''}
                        </span>
                        {deliveryFeeLockedByFullPayment ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Offerts et verrouillés
                          </span>
                        ) : deliveryFeeUpdatedAt ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={deliveryFeeUpdatedAt.toLocaleString('fr-FR')}>
                            Modifié par le vendeur
                          </span>
                        ) : null}
                      </div>
                      {!canEditDeliveryFee && (
                        <span className={`text-sm font-semibold ${deliveryFeeLockedByFullPayment ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {deliveryFeeLockedByFullPayment ? 'GRATUITE' : formatCurrency(order.deliveryFeeTotal)}
                        </span>
                      )}
                    </div>
                    {deliveryFeeLockedByFullPayment ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        Livraison offerte activée par paiement intégral. Les frais sont verrouillés et ne peuvent plus être modifiés.
                      </div>
                    ) : canEditDeliveryFee ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={deliveryFeeEditValue !== '' ? deliveryFeeEditValue : (order.deliveryFeeTotal ?? 0)}
                          onChange={(e) => setDeliveryFeeEditValue(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-900"
                        />
                        <span className="text-xs text-gray-500">FCFA</span>
                        <button
                          type="button"
                          onClick={handleUpdateDeliveryFee}
                          disabled={deliveryFeeSaving}
                          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                        >
                          {deliveryFeeSaving ? 'Enregistrement...' : 'Modifier'}
                        </button>
                      </div>
                    ) : null}
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
                            Progression client: {installmentProgressPercent}%
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
                            Risque client:{' '}
                            <span className="font-semibold text-gray-900">
                              {installmentPlan?.riskLevel || 'N/A'} ({Math.round(installmentPlan?.eligibilityScore || 0)}/100)
                            </span>
                          </p>
                        </div>
                        {order.status === 'completed' && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Statut de vente</p>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getInstallmentSaleStatusClassName(
                                installmentSaleStatus
                              )}`}
                            >
                              {INSTALLMENT_SALE_STATUS_LABELS[installmentSaleStatus] || 'Confirmée'}
                            </span>
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
                  <Receipt className="w-4 h-4 text-neutral-600" /> Preuve de vente
                </h4>
                <p className="text-sm text-gray-700">
                  Statut:{' '}
                  <span className="font-semibold">
                    {saleConfirmationConfirmed ? 'Confirmée' : 'En attente de votre confirmation'}
                  </span>
                </p>
                {installmentPlan?.guarantor?.required && (
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-900">Garant requis</p>
                    <p>Nom: {installmentPlan?.guarantor?.fullName || 'N/A'}</p>
                    <p>Téléphone: {installmentPlan?.guarantor?.phone || 'N/A'}</p>
                    <p>Relation: {installmentPlan?.guarantor?.relation || 'N/A'}</p>
                    <p>Adresse: {installmentPlan?.guarantor?.address || 'N/A'}</p>
                  </div>
                )}
                {!saleConfirmationConfirmed && order.status === 'pending_installment' && (
                  <div className="flex flex-wrap gap-2">
                    {sellerPrimaryAction?.key !== 'confirm_installment_sale' ? (
                      <button
                        type="button"
                        onClick={() => handleConfirmInstallmentSale(true)}
                        disabled={saleConfirmationLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {saleConfirmationLoading ? 'Traitement...' : 'Confirmer la vente'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleConfirmInstallmentSale(false)}
                      disabled={saleConfirmationLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <X className="w-4 h-4" />
                      Refuser la vente
                    </button>
                  </div>
                )}
              </div>
            )}

            {canRequestProof && !showDeliveryProofForm && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs text-neutral-800">
                  {canRequestPickupProof ? (
                    <>
                      Cliquez sur <span className="font-semibold">Retrait confirmé</span> pour soumettre la preuve de retrait (3 photos + signature client).
                    </>
                  ) : (
                    <>
                      Cliquez sur <span className="font-semibold">Livrer</span> pour soumettre la preuve de livraison.
                    </>
                  )}
                </p>
              </div>
            )}

            {canShowDeliveryProofForm && (
              <DeliveryProofUpload
                orderId={order._id}
                initialProofs={order.deliveryProofImages || []}
                mode={canRequestPickupProof ? 'pickup' : 'delivery'}
                minFiles={canRequestPickupProof ? 3 : 1}
                onSuccess={(updatedOrder) => {
                  if (updatedOrder?._id) {
                    setOrder(updatedOrder);
                    setShowDeliveryProofForm(false);
                    showToast(
                      canRequestPickupProof
                        ? 'Preuve de retrait enregistrée et retrait confirmé.'
                        : 'Preuve de livraison envoyée au client.',
                      { variant: 'success' }
                    );
                  } else {
                    loadOrder();
                  }
                }}
              />
            )}

            {!isInstallmentOrder && order.deliveryStatus === 'submitted' && !platformDeliveryAutoConfirmed && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-neutral-900">
                  Preuve de livraison soumise. En attente de confirmation du client.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(order.deliveryProofImages || []).map((proof, index) => {
                    const src = normalizeFileUrl(proof?.url || proof?.path || '');
                    if (!src) return null;
                    return (
                      <button
                        key={`seller-proof-${index}`}
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
                {order.clientSignatureImage && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-700 mb-1">Signature client</p>
                    <button
                      type="button"
                      onClick={() => openProofPreview(order.clientSignatureImage, 'Signature client')}
                      className="block w-full max-w-md overflow-hidden rounded-lg border border-neutral-200 bg-white"
                    >
                      <img
                        src={normalizeFileUrl(order.clientSignatureImage)}
                        alt="Signature client"
                        className="h-24 w-full bg-white object-contain p-1"
                        loading="lazy"
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            {isInstallmentOrder && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-500" /> Échéancier, preuves et validations
                </h4>
                {!installmentSchedule.length ? (
                  <p className="text-sm text-gray-500">Aucune tranche définie.</p>
                ) : (
                  installmentSchedule.map((entry, index) => {
                    const canValidate =
                      saleConfirmationConfirmed &&
                      entry?.status === 'proof_uploaded';
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
                        <p className="text-xs text-gray-600">
                          Échéance: {entry?.dueDate ? formatOrderTimestamp(entry.dueDate) : 'Non définie'}
                        </p>
                        {entry?.transactionProof?.transactionCode ? (
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2 text-xs text-neutral-900 space-y-1">
                            <p>
                              Expéditeur:{' '}
                              <span className="font-semibold">{entry?.transactionProof?.senderName || 'N/A'}</span>
                            </p>
                            <p>
                              ID transaction:{' '}
                              <span className="font-semibold">{entry?.transactionProof?.transactionCode || 'N/A'}</span>
                            </p>
                            <p>
                              Montant déclaré:{' '}
                              <span className="font-semibold">{formatCurrency(entry?.transactionProof?.amount || entry?.amount || 0)}</span>
                            </p>
                            {entry?.transactionProof?.submittedAt && (
                              <p>
                                Soumis le:{' '}
                                <span className="font-semibold">{formatOrderTimestamp(entry.transactionProof.submittedAt)}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Aucune preuve transactionnelle déposée.</p>
                        )}
                        {Number(entry?.penaltyAmount || 0) > 0 && (
                          <p className="text-xs text-amber-700">
                            Pénalité appliquée: {formatCurrency(entry?.penaltyAmount || 0)}
                          </p>
                        )}
                        {canValidate && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleValidateInstallmentPayment(index, true)}
                              disabled={paymentValidationLoadingIndex === index}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {paymentValidationLoadingIndex === index ? 'Validation...' : 'Valider'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleValidateInstallmentPayment(index, false)}
                              disabled={paymentValidationLoadingIndex === index}
                              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              <X className="w-4 h-4" />
                              Rejeter
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

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

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <OrderChat order={order} buttonText="Contacter l'acheteur" unreadCount={unreadCount} />
            </div>

            {sellerPrimaryAction ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    Action suivante
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handlePrimarySellerAction}
                  disabled={
                    sellerPrimaryAction.disabled ||
                    Boolean(statusUpdatingId) ||
                    statusMutation.isReliablePending ||
                    saleConfirmationLoading ||
                    paymentValidationLoadingIndex >= 0 ||
                    order.cancellationWindow?.isActive
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${getPrimaryActionClassName(
                    sellerPrimaryAction.intent
                  )}`}
                >
                  {statusMutation.isReliablePending || Boolean(statusUpdatingId) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {sellerPrimaryAction.label}
                </button>
                {sellerPrimaryAction.mode === 'proof_pickup' ? (
                  <p className="text-xs text-gray-500">
                    La preuve de retrait exige 3 photos et la signature du client.
                  </p>
                ) : null}
                {statusMutation.uiPhase === 'stillWorking' ? (
                  <p className="text-xs text-amber-700">
                    Traitement en cours... merci de patienter.
                  </p>
                ) : null}
                {statusMutation.uiPhase === 'slow' ? (
                  <p className="text-xs text-amber-700">
                    Réseau lent. Vérification automatique en cours. Vérifiez le suivi avant de renvoyer.
                  </p>
                ) : null}
              </div>
            ) : null}

            {canManageInstallmentSaleStatus && !sellerPrimaryAction && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    Mettre à jour le statut de vente
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('confirmed')}
                    disabled={
                      installmentSaleStatus !== 'confirmed' ||
                      statusUpdatingId === order._id
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Package size={12} /> Confirmée
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('delivering')}
                    disabled={
                      installmentSaleStatus !== 'confirmed' ||
                      statusUpdatingId === order._id
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    <Truck size={12} /> En livraison
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (order.deliveryStatus === 'submitted') {
                        handleStatusUpdate('delivered');
                        return;
                      }
                      setShowDeliveryProofForm((prev) => !prev);
                    }}
                    disabled={
                      installmentSaleStatus !== 'delivering' ||
                      statusUpdatingId === order._id
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    {order.deliveryStatus === 'submitted' ? (
                      <>
                        <CheckCircle size={12} /> Livrée
                      </>
                    ) : (
                      <>
                        <ClipboardList size={12} /> {showDeliveryProofForm ? 'Masquer preuve' : 'Livrer'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('cancelled')}
                    disabled={
                      ['delivered', 'cancelled'].includes(installmentSaleStatus) ||
                      statusUpdatingId === order._id
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <X size={12} /> Annuler
                  </button>
                </div>
                {installmentSaleStatus === 'delivering' && order.deliveryStatus !== 'submitted' && (
                  <p className="text-xs text-amber-700">
                    Cliquez sur "Livrer" pour soumettre la preuve de livraison.
                  </p>
                )}
                {statusUpdateFeedback.id === order._id && (
                  <p className={`text-xs ${statusUpdateFeedback.tone === 'warning' ? 'text-amber-700' : 'text-red-600'}`}>
                    {statusUpdateFeedback.message}
                  </p>
                )}
              </div>
            )}

            {!isInstallmentOrder &&
              !sellerPrimaryAction &&
              !['cancelled', 'delivery_proof_submitted', 'confirmed_by_client', 'completed', 'delivered', 'picked_up_confirmed'].includes(
                order.status
              ) && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    Mettre à jour le statut {isPickupOrder ? '(retrait boutique)' : ''}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('confirmed')}
                    disabled={
                      !['pending', 'pending_payment', 'paid'].includes(order.status) ||
                      statusUpdatingId === order._id ||
                      order.cancellationWindow?.isActive
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Package size={12} /> Confirmer
                  </button>
                  {isPickupOrder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate('ready_for_pickup')}
                        disabled={
                          !['confirmed'].includes(order.status) ||
                          statusUpdatingId === order._id ||
                          order.cancellationWindow?.isActive
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                      >
                        <Package size={12} /> Prête au retrait
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeliveryProofForm((prev) => !prev)}
                        disabled={
                          !canRequestPickupProof ||
                          statusUpdatingId === order._id ||
                          order.cancellationWindow?.isActive
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <ClipboardList size={12} /> {showDeliveryProofForm ? 'Masquer preuve' : 'Retrait confirmé'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate('delivering')}
                        disabled={
                          !['confirmed', 'ready_for_delivery'].includes(order.status) ||
                          statusUpdatingId === order._id ||
                          order.cancellationWindow?.isActive
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <Truck size={12} /> En livraison
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeliveryProofForm((prev) => !prev)}
                        disabled={
                          !['delivering', 'out_for_delivery'].includes(order.status) ||
                          ['submitted', 'verified'].includes(order.deliveryStatus) ||
                          statusUpdatingId === order._id ||
                          order.cancellationWindow?.isActive
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <ClipboardList size={12} /> {showDeliveryProofForm ? 'Masquer preuve' : 'Livrer'}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => openCancelModal({ defaultRefund: cityMismatch })}
                    disabled={
                      cancellationBlockedByStatus ||
                      statusUpdatingId === order._id ||
                      order.cancellationWindow?.isActive
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <X size={12} /> Annuler
                  </button>
                </div>
                {isPickupOrder ? (
                  <p className="text-xs text-orange-700">
                    Flux retrait: confirmez la commande, marquez-la "Prête au retrait", puis "Retrait confirmé" avec 3 photos + signature client.
                  </p>
                ) : (
                  ['delivering', 'out_for_delivery', 'delivery_proof_submitted'].includes(order.status) && (
                    <p className="text-xs text-neutral-700">
                      Après "En livraison", cliquez sur "Livrer" pour déposer la preuve de livraison.
                    </p>
                  )
                )}
                {statusUpdateFeedback.id === order._id && (
                  <p className={`text-xs ${statusUpdateFeedback.tone === 'warning' ? 'text-amber-700' : 'text-red-600'}`}>
                    {statusUpdateFeedback.message}
                  </p>
                )}
              </div>
            )}

            {platformDeliveryEnabled && !isPickupOrder ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-700" />
                    <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
                      Livraison plateforme
                    </h4>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {platformDeliveryStatus}
                  </span>
                </div>

                {canRequestPlatformDelivery ? (
                  <>
                    {!requestPlatformDeliveryOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          const defaultInvoiceUrl = (() => {
                            if (typeof window === 'undefined' || !order?._id) return '';
                            const host = String(window.location.hostname || '').trim().toLowerCase();
                            const looksLikeIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
                            if (!host || (host !== 'localhost' && !host.includes('.') && !looksLikeIpv4)) {
                              return '';
                            }
                            return `${window.location.origin}/orders/detail/${order._id}`;
                          })();
                          if (!String(requestPlatformDeliveryInvoiceUrl || '').trim() && defaultInvoiceUrl) {
                            setRequestPlatformDeliveryInvoiceUrl(defaultInvoiceUrl);
                          }
                          setRequestPlatformDeliveryOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Truck size={12} />
                        Request platform delivery
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={requestPlatformDeliveryInvoiceUrl}
                          onChange={(e) => setRequestPlatformDeliveryInvoiceUrl(e.target.value)}
                          placeholder="URL facture (auto-remplie)"
                          className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800"
                        />
                        <textarea
                          value={requestPlatformDeliveryNote}
                          onChange={(e) => setRequestPlatformDeliveryNote(e.target.value)}
                          placeholder="Instructions de récupération (optionnel)"
                          rows={3}
                          className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800"
                        />
                        {requireInvoiceForPlatformDelivery ? (
                          <p className="text-[11px] text-blue-700">
                            La configuration actuelle exige une URL de facture.
                          </p>
                        ) : null}
                        <p className="text-[11px] text-blue-700">
                          La facture sera transmise pour signature client et reglement du montant restant.
                        </p>
                        {requestPlatformDeliveryError ? (
                          <p className="text-xs text-red-600">{requestPlatformDeliveryError}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleRequestPlatformDelivery}
                            disabled={requestPlatformDeliveryLoading}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                          >
                            {requestPlatformDeliveryLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Envoyer la demande
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRequestPlatformDeliveryOpen(false);
                              setRequestPlatformDeliveryError('');
                            }}
                            disabled={requestPlatformDeliveryLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-blue-800">
                    {supportsPlatformDeliveryForOrder
                      ? 'Demande déjà créée ou indisponible pour ce statut de commande.'
                      : 'La demande plateforme est disponible uniquement pour les commandes en mode livraison.'}
                  </p>
                )}

                {deliveryPinEnabled && hasPlatformDeliveryRequest ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                        Code livraison (optionnel)
                      </p>
                      {deliveryPinValue ? (
                        <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Actif
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Non défini
                        </span>
                      )}
                    </div>
                    {deliveryPinValue ? (
                      <div className="rounded-lg border border-amber-300 bg-white px-3 py-2">
                        <p className="text-lg font-black tracking-[0.2em] text-amber-900">{deliveryPinValue}</p>
                        <p className="text-[11px] text-amber-700">
                          Expire: {deliveryPinExpiresAt ? formatOrderTimestamp(deliveryPinExpiresAt) : '—'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800">
                        Le vendeur peut générer un code de sécurité à partager avec l’acheteur et le livreur.
                      </p>
                    )}

                    {canManageDeliveryPin ? (
                      <>
                        <input
                          value={deliveryPinDraft}
                          onChange={(e) => setDeliveryPinDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                          placeholder="Code manuel (4-8 chiffres)"
                          inputMode="numeric"
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800"
                        />
                        {deliveryPinError ? <p className="text-xs text-red-600">{deliveryPinError}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSellerDeliveryPin('generate')}
                            disabled={deliveryPinLoading}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                          >
                            {deliveryPinLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Générer auto
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSellerDeliveryPin('set')}
                            disabled={deliveryPinLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                          >
                            Enregistrer manuel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSellerDeliveryPin('clear')}
                            disabled={deliveryPinLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            Supprimer code
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-amber-700">
                        Code non modifiable pour ce statut.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

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

            {order.status !== 'cancelled' && (
              <AnimatedOrderTimeline
                status={getSellerTimelineStatus(order, installmentWorkflow?.workflowStatus)}
                paymentType={order.paymentType}
                deliveryMode={order.deliveryMode}
              />
            )}

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
      </div>

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

      <BaseModal
        isOpen={cancelModalOpen}
        onClose={closeCancelModal}
        size="md"
        mobileSheet
        ariaLabel="Annuler la commande"
      >
        <ModalHeader
          icon={<AlertCircle className="h-5 w-5" />}
          title="Annuler la commande"
          subtitle={`Commande #${order?._id?.slice(-6) || '—'}`}
          onClose={closeCancelModal}
        />
        <ModalBody className="space-y-4">
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
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={cancelIssueRefund}
                disabled={Number(order?.paidAmount || 0) <= 0}
                onChange={(e) => setCancelIssueRefund(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500 disabled:opacity-50"
              />
              <span className="text-xs text-neutral-900">
                Demander le remboursement de l'acheteur
                {Number(order?.paidAmount || 0) > 0 ? (
                  <>
                    {' '}
                    (<span className="font-semibold">{formatCurrency(order?.paidAmount || 0)}</span>)
                  </>
                ) : (
                  ' (aucun paiement reçu)'
                )}
              </span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button type="button" onClick={closeCancelModal} disabled={cancelLoading} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annuler
            </button>
            <button type="button" onClick={handleCancelOrder} disabled={cancelLoading || !cancelReason.trim() || cancelReason.trim().length < 5} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
            </button>
          </div>
        </ModalFooter>
      </BaseModal>
    </div>
  );
}
