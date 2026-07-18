import React, { useEffect, useState, useCallback, useContext, useRef } from 'react';
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
  Loader2,
  Send,
  Copy,
  Check,
  MessageCircle
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { buildProgressSteps, resolveProgressStepIndex, riseIn } from '../utils/orderProgress';
import { sanitizePhoneNumber } from '../utils/whatsapp';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import OrderChat from '../components/OrderChat';
import DeliveryProofUpload from '../components/DeliveryProofUpload';
import GlassHeader from '../components/orders/GlassHeader';
import StatusBadge from '../components/orders/StatusBadge';
import InstallmentReminder from '../components/orders/InstallmentReminder';
import InstallmentOrderTracking from '../components/orders/InstallmentOrderTracking';
import { OrderDetailSkeleton } from '../components/orders/OrderSkeletons';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import OrderMiniRail from '../components/orders/OrderMiniRail';
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
import { orderQueryKeys } from '../hooks/useOrderQueryKeys';

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
  ready_for_pickup: { header: 'bg-orange-600', card: 'bg-gray-100 border-gray-200 text-orange-800' },
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
  const paymentSource = String(order?.paymentSource || '').trim().toLowerCase();
  const explicitPaymentMode = String(order?.paymentMode || '').trim().toUpperCase();
  if (String(order?.paymentType || '').toLowerCase() === 'installment') return 'INSTALLMENT';
  if (
    paymentSource === 'wallet' ||
    ['WALLET', 'HDMARKET_WALLET', 'PORTEFEUILLE_HDMARKET'].includes(explicitPaymentMode)
  ) {
    return 'WALLET';
  }
  if (
    explicitPaymentMode === 'FULL_PAYMENT' ||
    (!explicitPaymentMode && String(order?.paymentStatus || '').toUpperCase() === 'PAID_FULL')
  ) {
    return 'FULL_PAYMENT';
  }
  return 'STANDARD';
};

const getPaymentModeLabel = (mode) => {
  switch (mode) {
    case 'WALLET':
      return 'Portefeuille HDMarket';
    case 'INSTALLMENT':
      return 'Paiement par tranche';
    case 'FULL_PAYMENT':
      return 'Paiement intégral';
    default:
      return 'Paiement classique';
  }
};

const shouldHideDeliveryDetailsForPaymentMode = (mode) =>
  ['FULL_PAYMENT'].includes(String(mode || '').toUpperCase());

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
  if (rawStatus === 'delivered' || rawStatus === 'picked_up_confirmed') return 'completed';
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
      return {
        ...base,
        label: resolvePickupOrder(order) ? 'Commande prête à récupérer' : 'Passer: En livraison'
      };
    case 'mark_ready_for_pickup':
      return { ...base, label: 'Passer: Prête au retrait' };
    case 'submit_delivery_proof':
      return {
        ...base,
        mode: resolvePickupOrder(order) ? 'proof_pickup' : 'proof_delivery',
        nextStatus: null,
        intent: 'success',
        label: resolvePickupOrder(order) ? 'Preuve de retrait' : 'Preuve livraison'
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
  const [copiedKey, setCopiedKey] = useState('');
  const reduceMotion = useReducedMotion();
  const [statusUpdatingId, setStatusUpdatingId] = useState('');

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      showToast('Copié.', { variant: 'success' });
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      showToast('Impossible de copier.', { variant: 'error' });
    }
  };
  const [statusUpdateFeedback, setStatusUpdateFeedback] = useState({ id: '', message: '', tone: 'error' });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRefundMethod, setCancelRefundMethod] = useState('wallet');
  const [cancelRefundSenderName, setCancelRefundSenderName] = useState('');
  const [cancelRefundTransactionNumber, setCancelRefundTransactionNumber] = useState('');
  const [cancelRefundProof, setCancelRefundProof] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showDeliveryProofForm, setShowDeliveryProofForm] = useState(false);
  const deliveryProofFormRef = useRef(null);
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
  const [confirmationReminderLoading, setConfirmationReminderLoading] = useState(false);
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
  const orderPaymentMode = resolveOrderPaymentMode(order);
  const hideDeliveryDetails = shouldHideDeliveryDetailsForPaymentMode(orderPaymentMode);
  const deliveryFeeLockedByFullPayment =
    Boolean(order?.deliveryFeeLocked) && String(order?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
  const canEditDeliveryFee =
    order &&
    SELLER_CAN_EDIT_DELIVERY_FEE.includes(String(order.status)) &&
    !hideDeliveryDetails &&
    !deliveryFeeLockedByFullPayment;
  const deliveryFeeUpdatedAt = order?.deliveryFeeUpdatedAt ? new Date(order.deliveryFeeUpdatedAt) : null;

  const normalizeFileUrl = useCallback((url) => {
    const value = String(url || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^data:/i.test(value)) return value;
    if (/^blob:/i.test(value)) return value;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    let host = apiBase.replace(/\/api(?:\/v\d+)?\/?$/i, '');
    try { host = new URL(apiBase, window.location.origin).origin; } catch { /* keep configured host */ }
    return `${host}/${value.replace(/^\/+/, '')}`;
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

  const applyOrderSnapshot = useCallback(
    (payload) => {
      const nextOrder =
        payload?.order && typeof payload.order === 'object' ? payload.order : payload;
      if (!nextOrder?._id) return false;
      setOrder(nextOrder);
      queryClient.setQueryData(orderQueryKeys.detail('seller', String(orderId || '')), (existing) => ({
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

  const applyOrderToSellerCaches = useCallback(
    (nextOrder) => {
      if (!nextOrder?._id) return false;
      applyOrderSnapshot(nextOrder);
      queryClient.setQueriesData({ queryKey: orderQueryKeys.listRoot('seller') }, (existing) =>
        patchOrdersListPayload(existing, nextOrder)
      );
      return true;
    },
    [applyOrderSnapshot, patchOrdersListPayload, queryClient]
  );

  const statusMutation = useSellerOrderStatusMutation({
    orderId,
    onApplied: async (result) => {
      const payload = result?.data?.data || result?.data;
      if (payload?.order?._id) {
        applyOrderToSellerCaches(payload.order);
      } else if (payload?._id) {
        applyOrderToSellerCaches(payload);
      }
      setStatusUpdateFeedback({ id: '', message: '', tone: 'error' });
      showToast(
        result?.recovered ? 'Statut mis à jour après vérification automatique.' : 'Statut mis à jour.',
        { variant: 'success' }
      );
    },
    onFailed: async (error, _variables, context) => {
      if (context?.possiblyCommitted) {
        const message = 'Action en cours de confirmation. Le statut sera synchronisé automatiquement.';
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

  const invalidateOrderQueries = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: orderQueryKeys.detail('seller', String(orderId || '')),
      refetchType: 'active'
    }).catch(() => {});
    queryClient.invalidateQueries({
      queryKey: orderQueryKeys.listRoot('seller'),
      refetchType: 'inactive'
    }).catch(() => {});
    window.dispatchEvent(new Event('hdmarket:orders-refresh'));
    return Promise.resolve();
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
      applyOrderToSellerCaches(data);
      setDeliveryFeeEditValue('');
      showToast('Frais de livraison mis à jour. Le client a été notifié.', { variant: 'success' });
      invalidateOrderQueries();
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible de modifier les frais.', { variant: 'error' });
    } finally {
      setDeliveryFeeSaving(false);
    }
  };

  const handleSendConfirmationReminder = async () => {
    if (!order?._id) return;
    setConfirmationReminderLoading(true);
    try {
      const { data } = await api.post(`/orders/seller/${order._id}/confirmation-reminder`);
      showToast(data?.message || 'Relance envoyée au client.', { variant: 'success' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible d’envoyer la relance.', { variant: 'error' });
    } finally {
      setConfirmationReminderLoading(false);
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
        applyOrderToSellerCaches(data);
      } else {
        loadOrder();
      }
      showToast(
        approve
          ? 'Preuve de vente confirmée. Le plan de tranches est activé.'
          : 'Commande tranche refusée et annulée.',
        { variant: 'success' }
      );
      invalidateOrderQueries();
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
      applyOrderToSellerCaches(data);
      showToast(
        approve ? 'Tranche validée.' : 'Tranche rejetée. Le client doit renvoyer une preuve.',
        { variant: 'success' }
      );
      invalidateOrderQueries();
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
    setCancelRefundMethod('wallet');
    setCancelRefundSenderName('');
    setCancelRefundTransactionNumber('');
    setCancelRefundProof(null);
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim() || cancelReason.trim().length < 5) return;
    setCancelLoading(true);
    try {
      const mustRefund = Number(order.paidAmount || 0) > 0;
      if (mustRefund && cancelRefundMethod === 'mobile_money' && (!cancelRefundSenderName.trim() || cancelRefundTransactionNumber.length !== 10 || !cancelRefundProof)) {
        showToast('Complétez le nom, le code à 10 chiffres et la preuve du remboursement.', { variant: 'error' });
        return;
      }
      const payload = new FormData();
      payload.append('reason', cancelReason.trim());
      payload.append('issueRefund', String(mustRefund));
      if (mustRefund) payload.append('refundMethod', cancelRefundMethod);
      if (cancelRefundMethod === 'mobile_money') {
        payload.append('refundSenderName', cancelRefundSenderName.trim());
        payload.append('refundTransactionNumber', cancelRefundTransactionNumber);
        payload.append('refundProof', cancelRefundProof);
      }
      const { data } = await api.post(`/orders/seller/${order._id}/cancel`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      applyOrderToSellerCaches(data);
      showToast(
        mustRefund
          ? 'Commande annulée. Le remboursement intégral a été enregistré.'
          : 'Commande annulée. Le client a été notifié.',
        { variant: 'success' }
      );
      closeCancelModal({ force: true });
      invalidateOrderQueries();
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
      loadOrder();
      invalidateOrderQueries();
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
      loadOrder();
      invalidateOrderQueries();
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
    const serverProofAction = String(order?.nextAction?.seller?.key || '');
    const canRequestDeliveryProof =
      (serverProofAction === 'submit_delivery_proof' ||
        (!isInstallmentOrder && ['delivering', 'out_for_delivery'].includes(order.status)) ||
        (isInstallmentOrder &&
          installmentWorkflowStatus === 'completed' &&
          (installmentSaleStatus || 'confirmed') === (resolvePickupOrder(order) ? 'ready_for_pickup' : 'delivering'))) &&
      !['submitted', 'verified'].includes(order.deliveryStatus);
    const canRequestPickupProof =
      (serverProofAction === 'submit_pickup_proof' ||
        (resolvePickupOrder(order) &&
          (isInstallmentOrder
            ? installmentWorkflowStatus === 'completed' && installmentSaleStatus === 'ready_for_pickup'
            : ['confirmed', 'ready_for_pickup'].includes(order.status)))) &&
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
      <div className="hd-order-flow hd-commerce-shell min-h-screen dark:bg-neutral-950">
        <GlassHeader title="Commande" subtitle="Chargement..." backTo="/seller/orders" />
        <OrderDetailSkeleton />
      </div>
    );
  }

  if (queryErrorMessage || !order) {
    return (
      <div className="hd-order-flow hd-commerce-shell min-h-screen p-4">
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
  const isFullPaymentOrder = orderPaymentMode === 'FULL_PAYMENT';
  const paymentModeLabel = getPaymentModeLabel(orderPaymentMode);
  const paidAmountLabel = isInstallmentOrder
    ? 'Montant validé'
    : isFullPaymentOrder
      ? 'Paiement reçu'
      : 'Acompte versé';
  const isPickupOrder = resolvePickupOrder(order);
  const pickupShopAddress = isPickupOrder ? getPickupShopAddress(order) : null;
  const orderContactPhone =
    String(order?.shippingAddressSnapshot?.phone || '').trim() ||
    String(order?.customerPhone || '').trim() ||
    String(order?.customer?.phone || '').trim();
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
    isInstallmentOrder && ['installment_paid', 'completed'].includes(order.status)
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
  const installmentWorkflowStatus = installmentWorkflow?.workflowStatus || order.status;
  const displayStatusLabel = isInstallmentOrder
    ? installmentWorkflowStatus === 'completed'
      ? isPickupOrder
        ? ['delivered', 'picked_up_confirmed'].includes(installmentSaleStatus)
          ? 'picked_up_confirmed'
          : installmentSaleStatus === 'ready_for_pickup'
            ? 'ready_for_pickup'
            : 'confirmed'
        : installmentSaleStatus || 'confirmed'
      : installmentWorkflowStatus
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
      picked_up_confirmed: 'completed',
      delivering: 'out_for_delivery',
      delivered:
        String(order.deliveryStatus || '').toLowerCase() === 'submitted' && !platformAutoConfirmed
          ? 'delivery_proof_submitted'
          : 'completed'
    };
    return map[order.status] || order.status;
  })();
  const serverProofAction = String(order?.nextAction?.seller?.key || '');
  const canRequestDeliveryProof =
    (serverProofAction === 'submit_delivery_proof' ||
      (!isInstallmentOrder && ['delivering', 'out_for_delivery'].includes(order.status)) ||
      (isInstallmentOrder &&
        (installmentWorkflow?.workflowStatus || order.status) === 'completed' &&
        (installmentSaleStatus || 'confirmed') === (isPickupOrder ? 'ready_for_pickup' : 'delivering'))) &&
    !['submitted', 'verified'].includes(order.deliveryStatus);
  const canRequestPickupProof =
    (serverProofAction === 'submit_pickup_proof' ||
      (isPickupOrder &&
        (isInstallmentOrder
          ? (installmentWorkflow?.workflowStatus || order.status) === 'completed' && installmentSaleStatus === 'ready_for_pickup'
          : ['confirmed', 'ready_for_pickup'].includes(order.status)))) &&
    !['submitted', 'verified'].includes(order.deliveryStatus);
  const canRequestProof = canRequestDeliveryProof || canRequestPickupProof;
  const canShowDeliveryProofForm = canRequestProof && showDeliveryProofForm;
  const sellerCity = String(user?.city || '').trim();
  const buyerCity = String(order.deliveryCity || '').trim();
  // Same rule as the buyer-side page: default to offering a refund when
  // cancelling a cross-city order.
  const cityMismatch = Boolean(sellerCity && buyerCity) && sellerCity.toLowerCase() !== buyerCity.toLowerCase();
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
  const canSendConfirmationReminder =
    String(order.paymentSource || '').toLowerCase() === 'wallet' &&
    !isPickupOrder &&
    !platformDeliveryAutoConfirmed &&
    ['delivery_proof_submitted', 'delivered'].includes(String(order.status || '').toLowerCase()) &&
    !order.clientDeliveryConfirmedAt;
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
  const cancellationBlockedByStatus =
    ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status) ||
    (isInstallmentOrder && ['delivery_proof_submitted', 'delivered', 'picked_up_confirmed'].includes(installmentSaleStatus));
  const canCancelOrder = !cancellationBlockedByStatus && order.status !== 'cancelled' && !order.cancellationWindow?.isActive;
  const sellerPrimaryAction = getPrimaryActionMeta(order);
  const toggleDeliveryProofForm = () => {
    if (showDeliveryProofForm) {
      setShowDeliveryProofForm(false);
      return;
    }
    setShowDeliveryProofForm(true);
    window.setTimeout(() => {
      deliveryProofFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      deliveryProofFormRef.current?.focus({ preventScroll: true });
    }, 50);
  };
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
      toggleDeliveryProofForm();
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
  const compactProgressSteps = buildProgressSteps({
    isInstallment: isInstallmentOrder,
    isPickup: isPickupOrder
  });
  const compactRailStatus = getSellerTimelineStatus(order, installmentWorkflow?.workflowStatus);
  const compactProgressIndex = order.status === 'cancelled'
    ? 0
    : resolveProgressStepIndex({ status: compactRailStatus, isInstallment: isInstallmentOrder });
  const compactProgress = order.status === 'cancelled'
    ? 100
    : compactProgressSteps.length > 1
      ? (compactProgressIndex / (compactProgressSteps.length - 1)) * 100
      : 100;
  const openCancelModal = ({ prefillReason = '', defaultRefund = false } = {}) => {
    setCancelModalOpen(true);
    if (prefillReason) {
      setCancelReason((currentReason) =>
        String(currentReason || '').trim() ? currentReason : prefillReason
      );
    }
  };

  return (
    <div className="hd-order-flow min-h-screen bg-[#f6f3ee] text-slate-950 dark:bg-neutral-950">
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
      <div className="mx-auto max-w-5xl px-3 py-4 pb-28 sm:px-5 sm:py-6">

        <section className="space-y-3 md:hidden">
          <article className="overflow-hidden rounded-2xl border border-[#e2dcd2] bg-white shadow-sm">
            <div className="border-b border-[#eee8e0] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button type="button" onClick={() => copyToClipboard(order._id.slice(-6).toUpperCase(), 'orderId')} className="inline-flex min-h-11 items-center gap-2 text-left">
                    <span className="text-base font-black text-[#231f1b]">Commande #{order._id.slice(-6)}</span>
                    {copiedKey === 'orderId' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[#8a8378]" />}
                  </button>
                  <p className="text-xs font-semibold text-[#8a8378]">{formatOrderTimestamp(order.createdAt) || 'Date non disponible'}</p>
                </div>
                <StatusBadge status={displayStatusLabel} compact />
              </div>
              <OrderMiniRail className="mt-3" progress={compactProgress} stops={compactProgressSteps.length} step={compactProgressIndex + 1} urgent={order.status === 'cancelled'} label={STATUS_LABELS[displayStatusLabel] || displayStatusLabel} />
            </div>

            <div className="space-y-3 p-4">
              {orderItems.map((item, index) => {
                const image = item.snapshot?.image || item.product?.images?.[0];
                return (
                  <div key={`${order._id}-seller-compact-${index}`} className="flex gap-3">
                    {image ? <img src={image} alt={item.snapshot?.title || 'Produit'} className="h-16 w-16 shrink-0 rounded-xl border border-[#eee8e0] object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#f5f2ee]"><Package className="h-5 w-5 text-[#8a8378]" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-[#231f1b]">{item.snapshot?.title || 'Produit'} × {item.quantity || 1}</p>
                      <p className="mt-1 text-xs font-semibold text-[#6b6459]">{isInstallmentOrder ? `Acompte ${formatCurrency(installmentPaid)} · reste ${formatCurrency(installmentRemaining)}` : paymentModeLabel}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-[#231f1b]">{formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}</p>
                  </div>
                );
              })}

              <div className="flex items-center justify-between rounded-xl bg-[#f5f2ee] px-3 py-3">
                <span className="text-xs font-bold text-[#6b6459]">Total commande</span>
                <span className="text-lg font-black text-[#231f1b]">{formatCurrency(isInstallmentOrder ? installmentTotal : totalAmount)}</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-[#eee8e0] px-3 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff0e4] text-sm font-black text-[#c2410c]">{String(order.customer?.name || 'C').charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#231f1b]">{order.customer?.name || 'Client'}</p>
                  <p className="truncate text-xs text-[#8a8378]">{order.deliveryAddress || order.deliveryCity || 'Adresse non renseignée'}</p>
                </div>
                {orderContactPhone ? <a href={`tel:${orderContactPhone}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] text-[#231f1b]" aria-label="Appeler le client"><Phone className="h-4 w-4" /></a> : null}
              </div>

              {order.deliveryCode ? (
                <div className="flex items-center justify-between rounded-xl border border-[#eee8e0] px-3 py-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#8a8378]">Code de livraison</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-[0.22em] text-[#231f1b]">••••</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(order.deliveryCode, 'deliveryCode')} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-black text-[#c2410c]">{copiedKey === 'deliveryCode' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiedKey === 'deliveryCode' ? 'Copié' : 'Copier'}</button>
                </div>
              ) : null}

              <OrderChat order={order} buttonText="Contacter l’acheteur" unreadCount={unreadCount} />

              {sellerPrimaryAction ? (
                <button type="button" onClick={handlePrimarySellerAction} disabled={sellerPrimaryAction.disabled || Boolean(statusUpdatingId) || statusMutation.isReliablePending || saleConfirmationLoading || paymentValidationLoadingIndex >= 0 || order.cancellationWindow?.isActive} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0d0d0d] px-4 text-sm font-black text-white disabled:opacity-60">
                  {statusMutation.isReliablePending || Boolean(statusUpdatingId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                  {sellerPrimaryAction.label}
                </button>
              ) : null}

              {canShowDeliveryProofForm ? (
                <div ref={deliveryProofFormRef} tabIndex={-1} className="scroll-mt-24 rounded-xl border border-[#e2dcd2] p-3 outline-none">
                  <DeliveryProofUpload orderId={order._id} initialProofs={order.deliveryProofImages || []} mode={canRequestPickupProof ? 'pickup' : 'delivery'} minFiles={canRequestPickupProof ? 3 : 1} onSuccess={(updatedOrder) => { if (updatedOrder?._id) { applyOrderToSellerCaches(updatedOrder); setShowDeliveryProofForm(false); showToast(canRequestPickupProof ? 'Preuve de retrait enregistrée et retrait confirmé.' : 'Preuve de livraison envoyée au client.', { variant: 'success' }); invalidateOrderQueries(); } else { loadOrder(); } }} />
                </div>
              ) : null}

              {canCancelOrder ? <button type="button" onClick={() => openCancelModal({ defaultRefund: cityMismatch })} className="min-h-11 w-full text-center text-xs font-black text-red-700">Annuler la commande</button> : null}
            </div>
          </article>
        </section>

        <motion.div
          {...riseIn(reduceMotion, 0)}
          className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block"
        >
          <div className="relative overflow-hidden bg-[#e85d00] px-5 py-5 text-white sm:px-7 sm:py-6">
            <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-sm ring-1 ring-white/25">
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/78">Commande vendeur</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order._id.slice(-6).toUpperCase(), 'orderId')}
                    className="group inline-flex items-center gap-2"
                    title="Copier le numéro de commande"
                  >
                    <h3 className="text-2xl font-black tracking-tight">#{order._id.slice(-6)}</h3>
                    {copiedKey === 'orderId' ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <Copy className="h-4 w-4 text-white/60 transition group-hover:text-white" />
                    )}
                  </button>
                  <p className="mt-1 text-xs font-semibold text-white/78">
                    {formatOrderTimestamp(order.createdAt) || 'Date non disponible'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black uppercase text-gray-500 shadow-sm">
                  {STATUS_LABELS[displayStatusLabel] || displayStatusLabel}
                </span>
                {sanitizePhoneNumber(orderContactPhone) ? (
                  <a
                    href={`https://wa.me/${sanitizePhoneNumber(orderContactPhone)}?text=${encodeURIComponent(
                      `Bonjour ${order.customer?.name || ''}, concernant votre commande HDMarket n°${String(order._id).slice(-6).toUpperCase()}.`.trim()
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-black/18 px-3 text-xs font-black text-white ring-1 ring-white/20 transition hover:bg-black/25 active:scale-95"
                    title="Écrire au client sur WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {isInstallmentOrder && <InstallmentOrderTracking order={order} isPickup={isPickupOrder} />}
          {!isInstallmentOrder && (() => {
            const cancelled = order.status === 'cancelled';
            const railStatus = getSellerTimelineStatus(order, installmentWorkflow?.workflowStatus);
            const steps = buildProgressSteps({
              isInstallment: isInstallmentOrder,
              isPickup: isPickupOrder
            });
            const stepIndex = cancelled
              ? 0
              : resolveProgressStepIndex({ status: railStatus, isInstallment: isInstallmentOrder });
            const fillPct = cancelled ? 100 : (stepIndex / (steps.length - 1)) * 100;
            return (
              <div className="bg-white px-5 pb-3 pt-4 dark:bg-neutral-950 sm:px-7">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Suivi</p>
                  <p className={`text-[11px] font-black ${cancelled ? 'text-rose-600' : 'text-[#e85d00]'}`}>
                    {cancelled ? 'Commande annulée' : `Étape ${stepIndex + 1}/${steps.length}`}
                  </p>
                </div>
                <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${cancelled ? 'bg-rose-300' : 'bg-[#FFB000]'}`}
                    initial={reduceMotion ? { width: `${fillPct}%` } : { width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut', delay: reduceMotion ? 0 : 0.3 }}
                  />
                  <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
                    {steps.map((step, index) => {
                      const done = !cancelled && index <= stepIndex;
                      const current = !cancelled && index === stepIndex;
                      return (
                        <motion.span
                          key={step}
                          initial={reduceMotion ? false : { scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.3 + index * 0.12 }}
                          className={`h-3 w-3 rounded-full border-2 border-white dark:border-neutral-950 ${
                            cancelled
                              ? 'bg-rose-300'
                              : done
                                ? 'bg-[#e85d00]'
                                : 'bg-gray-200 dark:bg-neutral-700'
                          } ${current && !reduceMotion ? 'animate-pulse' : ''}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2 flex justify-between">
                  {steps.map((step, index) => (
                    <span
                      key={step}
                      className={`w-0 flex-1 text-[9px] font-black uppercase tracking-wide sm:text-[10px] ${
                        index === 0 ? 'text-left' : index === steps.length - 1 ? 'text-right' : 'text-center'
                      } ${
                        !cancelled && index === stepIndex ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                      }`}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="space-y-4 bg-gray-50 p-3 sm:p-5">
            <motion.section {...riseIn(reduceMotion, 0.1)} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00] ring-1 ring-gray-200">
                    <Package className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Articles commandés</h4>
                    <p className="text-xs font-semibold text-gray-500">{orderItems.length} article{orderItems.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-500 ring-1 ring-gray-200">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="space-y-3">
                {orderItems.map((item, index) => (
                  <div key={`${order._id}-${index}`} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-2.5 sm:gap-4 sm:p-3">
                    {item.snapshot?.image || item.product?.images?.[0] ? (
                      <img src={item.snapshot?.image || item.product?.images?.[0]} alt={item.snapshot?.title || 'Produit'} className="h-20 w-20 flex-shrink-0 rounded-xl border border-gray-200 object-cover sm:h-24 sm:w-24" />
                    ) : (
                      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 sm:h-24 sm:w-24">
                        <Package className="w-6 h-6 text-neutral-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-1">
                        {item.product ? (
                          <Link to={buildProductPath(item.product)} {...externalLinkProps} className="line-clamp-2 font-black text-gray-900 hover:text-[#e85d00]">
                            {item.snapshot?.title || 'Produit'}
                          </Link>
                        ) : (
                          <span className="font-bold text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                        )}
                        <span className="whitespace-nowrap text-sm font-black text-[#e85d00]">{formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}</span>
                      </div>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-gray-100">Qté {item.quantity || 1}</span>
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-gray-100">{formatCurrency(item.snapshot?.price || 0)} / unité</span>
                      </div>
                      <SelectedAttributesList
                        selectedAttributes={item.selectedAttributes}
                        compact
                        className="mb-1.5"
                      />
                      {item.snapshot?.confirmationNumber && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
                          <span className="text-[10px] font-bold text-neutral-700 uppercase">Code: {item.snapshot.confirmationNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.div {...riseIn(reduceMotion, 0.16)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.deliveryCode && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-neutral-500" /> Code de livraison</h4>
                  <div className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
                    <p className="text-xs font-semibold text-neutral-700 uppercase mb-2">Code pour le livreur</p>
                    <div className="text-4xl font-black text-neutral-900 tracking-wider font-mono text-center">{order.deliveryCode}</div>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><User className="w-4 h-4 text-gray-500" /> Client</h4>
                <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{order.customer?.name || 'Client'}</p>
	                  {orderContactPhone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{orderContactPhone}</p>}
                  {order.customer?.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{order.customer.email}</p>}
                </div>
              </div>
            </motion.div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" /> {isPickupOrder ? 'Point de retrait' : 'Adresse de livraison'}
              </h4>
              <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
	                    {orderContactPhone ? (
	                      <p className="text-xs font-semibold text-gray-700">Téléphone: {orderContactPhone}</p>
	                    ) : null}
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

            {order.trackingNote && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-gray-500" /> Note de suivi</h4>
                <p className="text-sm font-semibold leading-6 text-gray-700">{order.trackingNote}</p>
              </div>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-500" /> Paiement</h4>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-500">Mode de paiement</span>
                    {isFullPaymentOrder && (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black text-slate-950">{paymentModeLabel}</span>
                </div>
                {!hideDeliveryDetails && !isPickupOrder && (Number(order.deliveryFeeTotal ?? 0) > 0 || canEditDeliveryFee || deliveryFeeLockedByFullPayment) && (
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
                <div className="flex justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-600">Total commande</span>
                  <span className="text-xl font-black text-[#e85d00]">
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
                        {['installment_paid', 'completed'].includes(order.status) && (
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
            </section>

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
              <div ref={deliveryProofFormRef} tabIndex={-1} className="scroll-mt-24 outline-none">
                <DeliveryProofUpload
                orderId={order._id}
                initialProofs={order.deliveryProofImages || []}
                mode={canRequestPickupProof ? 'pickup' : 'delivery'}
                minFiles={canRequestPickupProof ? 3 : 1}
                onSuccess={(updatedOrder) => {
                  if (updatedOrder?._id) {
                    applyOrderToSellerCaches(updatedOrder);
                    setShowDeliveryProofForm(false);
                    showToast(
                      canRequestPickupProof
                        ? 'Preuve de retrait enregistrée et retrait confirmé.'
                        : 'Preuve de livraison envoyée au client.',
                      { variant: 'success' }
                    );
                    invalidateOrderQueries();
                  } else {
                    loadOrder();
                  }
                }}
                />
              </div>
            )}

            {!isInstallmentOrder && ((Array.isArray(order.deliveryProofImages) && order.deliveryProofImages.length > 0) || order.clientSignatureImage) && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50">
                    <ClipboardList className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Preuve de livraison</h4>
                    <p className="text-[11px] text-gray-500">
                      {String(order.deliveryStatus || '').toLowerCase() === 'verified'
                        ? 'Livraison confirmée par le client.'
                        : 'Preuve soumise. En attente de confirmation du client.'}
                    </p>
                  </div>
                </div>
                {Array.isArray(order.deliveryProofImages) && order.deliveryProofImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Photos ({order.deliveryProofImages.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(order.deliveryProofImages || []).map((proof, index) => {
                        const rawSource = typeof proof === 'string' ? proof : proof?.url || proof?.path || proof?.secure_url || proof?.location || '';
                        const src = normalizeFileUrl(rawSource);
                        if (!src) return null;
                        return (
                          <button
                            key={`seller-proof-${index}`}
                            type="button"
                            onClick={() => openProofPreview(src, `Photo ${index + 1}`)}
                            className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-white ring-1 ring-emerald-100 transition hover:ring-emerald-300 hover:shadow-md"
                          >
                            <img
                              src={src}
                              alt={`Photo de livraison ${index + 1}`}
                              className="h-full w-full object-contain bg-slate-50 p-2"
                              loading="lazy"
                            />
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white group-hover:bg-black/70 transition">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                              Photo {index + 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {order.clientSignatureImage && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>
                      Signature du client
                    </p>
                    <button
                      type="button"
                      onClick={() => openProofPreview(order.clientSignatureImage, 'Signature client')}
                      className="group relative block w-full overflow-hidden rounded-xl border border-rose-100 bg-rose-50/30 ring-1 ring-rose-100 transition hover:ring-rose-300"
                    >
                      <img
                        src={normalizeFileUrl(order.clientSignatureImage)}
                        alt="Signature du client"
                        className="h-28 w-full object-contain p-3"
                        loading="lazy"
                      />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 px-2 py-1 text-[10px] font-semibold text-white group-hover:bg-black/65 transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        Agrandir
                      </span>
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

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <OrderChat order={order} buttonText="Contacter l'acheteur" unreadCount={unreadCount} />
            </div>

            {sellerPrimaryAction ? (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#e85d00]" />
                  <h4 className="text-sm font-black text-gray-900">
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
                  className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-black shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${getPrimaryActionClassName(
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
                    Action en cours de confirmation. Le statut sera synchronisé automatiquement.
                  </p>
                ) : null}
              </div>
            ) : null}

            {canSendConfirmationReminder ? (
              <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#e85d00] ring-1 ring-amber-100">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-amber-950">Fonds portefeuille en attente</h4>
                    <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                      Le client doit confirmer la réception pour libérer le paiement dans votre portefeuille.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendConfirmationReminder}
                  disabled={confirmationReminderLoading}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#e85f00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmationReminderLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Relancer le client
                </button>
              </div>
            ) : null}

            {canManageInstallmentSaleStatus && !sellerPrimaryAction && (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#e85d00]" />
                  <h4 className="text-sm font-black text-gray-900">
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
                    {isPickupOrder ? <Store size={12} /> : <Truck size={12} />}
                    {isPickupOrder ? 'Prêt à récupérer' : 'En livraison'}
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
                        <CheckCircle size={12} /> {isPickupOrder ? 'Récupéré' : 'Livrée'}
                      </>
                    ) : (
                      <>
                        <ClipboardList size={12} /> {showDeliveryProofForm ? 'Masquer preuve' : isPickupOrder ? 'Preuve de retrait' : 'Livrer'}
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
                    {isPickupOrder
                      ? 'Ajoutez la preuve de retrait avant de confirmer que la commande a été récupérée.'
                      : 'Cliquez sur "Livrer" pour soumettre la preuve de livraison.'}
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
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#e85d00]" />
                  <h4 className="text-sm font-black text-gray-900">
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
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
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
                {Number(order.refundAmount || 0) > 0 && (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-emerald-900">
                    <p className="font-bold">Remboursement intégral: {formatCurrency(order.refundAmount)}</p>
                    <p>Mode: {order.refundMethod === 'wallet' ? 'Portefeuille HDMarket' : 'Mobile Money'}</p>
                    {order.refundSenderName && <p>Expéditeur: {order.refundSenderName}</p>}
                    {order.refundTransactionNumber && <p>ID transaction: {order.refundTransactionNumber}</p>}
                    {order.refundProof && /^https?:\/\//i.test(order.refundProof) && (
                      <a href={order.refundProof} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={order.refundProof}
                          alt="Preuve du remboursement"
                          className="max-h-56 w-full rounded-xl border border-emerald-200 object-contain"
                        />
                      </a>
                    )}
                  </div>
                )}
              </div>
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
        </motion.div>
      </div>

      <BaseModal
        isOpen={Boolean(proofPreview?.url)}
        onClose={() => setProofPreview(null)}
        mobileSheet={false}
        size="full"
        rootClassName="z-[140] p-3 sm:p-6"
        panelClassName="max-h-[92dvh] border-none bg-transparent p-0 shadow-none sm:max-w-[92vw]"
        backdropClassName="bg-black/85"
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
              proofPreviewIsSignature ? 'bg-white shadow-sm' : 'bg-black/20'
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
          {Number(order?.paidAmount || 0) > 0 && (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
              <div>
                <p className="text-xs font-black text-orange-900">Remboursement intégral obligatoire</p>
                <p className="mt-1 text-sm font-black text-[#e85d00]">{formatCurrency(order.paidAmount)} — en une seule fois</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['wallet', 'mobile_money'].map((method) => (
                  <button key={method} type="button" onClick={() => setCancelRefundMethod(method)} className={`rounded-xl border px-3 py-2 text-xs font-black ${cancelRefundMethod === method ? 'border-[#e85d00] bg-white text-[#e85d00]' : 'border-orange-100 text-gray-600'}`}>
                    {method === 'wallet' ? 'Portefeuille' : 'Mobile Money'}
                  </button>
                ))}
              </div>
              {cancelRefundMethod === 'mobile_money' && (
                <div className="space-y-2">
                  <input value={cancelRefundSenderName} onChange={(e) => setCancelRefundSenderName(e.target.value)} placeholder="Nom de l’expéditeur" className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm" />
                  <input value={cancelRefundTransactionNumber} onChange={(e) => setCancelRefundTransactionNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Code transaction (10 chiffres)" className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm" />
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-orange-300 bg-white px-3 py-3 text-xs font-black text-orange-700">
                    {cancelRefundProof ? cancelRefundProof.name : 'Ajouter la preuve du remboursement'}
                    <input type="file" accept="image/*" onChange={(e) => setCancelRefundProof(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button type="button" onClick={closeCancelModal} disabled={cancelLoading} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annuler
            </button>
            <button type="button" onClick={handleCancelOrder} disabled={cancelLoading || !cancelReason.trim() || cancelReason.trim().length < 5 || (Number(order?.paidAmount || 0) > 0 && cancelRefundMethod === 'mobile_money' && (!cancelRefundSenderName.trim() || cancelRefundTransactionNumber.length !== 10 || !cancelRefundProof))} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
            </button>
          </div>
        </ModalFooter>
      </BaseModal>
    </div>
  );
}
