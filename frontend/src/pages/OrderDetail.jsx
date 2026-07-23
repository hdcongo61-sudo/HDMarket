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
  AlertCircle,
  Info,
  CreditCard,
  Receipt,
  ChevronRight,
  Wallet,
  Copy,
  Check,
  Eye,
  EyeOff,
  MessageCircle
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { buildProgressSteps, resolveProgressStepIndex, riseIn } from '../utils/orderProgress';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import EditAddressModal from '../components/EditAddressModal';
import OrderChat from '../components/OrderChat';
import GlassHeader from '../components/orders/GlassHeader';
import StatusBadge from '../components/orders/StatusBadge';
import InstallmentReminder from '../components/orders/InstallmentReminder';
import InstallmentOrderTracking from '../components/orders/InstallmentOrderTracking';
import { OrderDetailSkeleton } from '../components/orders/OrderSkeletons';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import PawaPayButton from '../components/PawaPayButton';
import OrderMiniRail from '../components/orders/OrderMiniRail';
import BaseModal from '../components/modals/BaseModal';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { getPickupShopAddress, isPickupOrder } from '../utils/pickupAddress';
import { getSponsorshipStatusMeta } from '../utils/sponsorship';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import useReliableMutation from '../hooks/useReliableMutation';
import { getInstallmentWorkflow } from '../utils/installmentTracking';
import { isOrderFulfilmentComplete } from '../utils/orderStatusEngine';
import useBuyerOrderDetailQuery from '../hooks/useBuyerOrderDetailQuery';
import useBuyerOrderStatusMutation from '../hooks/useBuyerOrderStatusMutation';
import useOrderRealtimeSync from '../hooks/useOrderRealtimeSync';
import { orderQueryKeys } from '../hooks/useOrderQueryKeys';
import { appAlert, appConfirm } from '../utils/appDialog';
import OrderTrackingMap from '../components/OrderTrackingMap';
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

const DeliveryProofImage = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`flex flex-col items-center justify-center gap-1 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-600 ${className}`}>
        Aperçu indisponible
        <a href={src} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="text-[#e85d00] underline">Ouvrir la photo</a>
      </span>
    );
  }
  return <img src={src} alt={alt} className={className} loading="eager" onError={() => setFailed(true)} />;
};
const normalizeAddressPart = (value) => (typeof value === 'string' ? value.trim() : '');
const isEnabledFlag = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  return fallback;
};
const resolveOrderPaymentMode = (order) => {
  const paymentSource = String(order?.paymentSource || '').trim().toLowerCase();
  const explicitPaymentMode = String(order?.paymentMode || '').trim().toUpperCase();
  if (order?.sponsoredPayment?.isSponsored) return 'SPONSOR';
  if (String(order?.paymentType || '').toLowerCase() === 'installment') return 'INSTALLMENT';
  if (
    paymentSource === 'wallet' ||
    ['WALLET', 'HDMARKET_WALLET', 'PORTEFEUILLE_HDMARKET'].includes(explicitPaymentMode)
  ) {
    return 'WALLET';
  }
  if (explicitPaymentMode === 'FULL_PAYMENT') return 'FULL_PAYMENT';
  if (explicitPaymentMode && explicitPaymentMode !== 'STANDARD') return explicitPaymentMode;
  if (!explicitPaymentMode && String(order?.paymentStatus || '').toUpperCase() === 'PAID_FULL') return 'FULL_PAYMENT';
  return 'STANDARD';
};

const shouldHideDeliveryDetailsForPaymentMode = (mode) =>
  ['FULL_PAYMENT'].includes(String(mode || '').toUpperCase());

const getPaymentModeLabel = (mode) => {
  switch (mode) {
    case 'WALLET':
      return 'Portefeuille HDMarket';
    case 'INSTALLMENT':
      return 'Paiement par tranche';
    case 'FULL_PAYMENT':
      return 'Paiement intégral';
    case 'SPONSOR':
      return 'Paiement par un proche';
    default:
      return 'Paiement classique';
  }
};

// One consistent color per payment mode across checkout and order detail, so a
// user learns "orange = classique, emerald = intégral, amber = tranche, bleu =
// portefeuille, violet = proche" once and recognizes it everywhere.
const PAYMENT_MODE_BADGE_CLASSES = {
  STANDARD: 'border-orange-200 bg-orange-50 text-[#B45309] dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300',
  FULL_PAYMENT: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300',
  INSTALLMENT: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300',
  WALLET: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300',
  SPONSOR: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300'
};
const getPaymentModeBadgeClasses = (mode) => PAYMENT_MODE_BADGE_CLASSES[mode] || PAYMENT_MODE_BADGE_CLASSES.STANDARD;

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
    case 'confirm_delivery': {
      const pickupOrder = isPickupOrder(order);
      return {
        key: actionKey,
        mode: 'confirm_delivery',
        nextStatus: nextStatus || null,
        intent: 'success',
        label: pickupOrder ? 'Confirmer le retrait' : 'Confirmer la livraison'
      };
    }
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

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = React.useContext(AuthContext);
  const { addItem } = React.useContext(CartContext);
  const externalLinkProps = useDesktopExternalLink();
  const { isFeatureEnabled, getRuntimeValue } = useAppSettings();
  const { showToast } = useToast();
  const aiRecommendationsEnabled = isFeatureEnabled('enable_ai_recommendations', {
    defaultValue: true
  });
  const walletFeatureEnabled =
    isEnabledFlag(getRuntimeValue('enable_digital_wallet', false), false) &&
    isEnabledFlag(getRuntimeValue('enable_wallet_payment', false), false);
  const queryClient = useQueryClient();
  const { rapid3GActive, offlineBannerText, rapid3GBannerText, shouldUseOfflineSnapshot } =
    useNetworkProfile();

  const [order, setOrder] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
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
  const [deliveryCodeRevealed, setDeliveryCodeRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const reduceMotion = useReducedMotion();

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      showToast('Copié.', { variant: 'success' });
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      showToast('Impossible de copier. Notez le code manuellement.', { variant: 'error' });
    }
  };

  const shareOrderOnWhatsApp = () => {
    if (!order) return;
    const effectiveStatus = getEffectiveOrderStatus(order);
    const statusLabel = STATUS_LABELS[effectiveStatus] || effectiveStatus || 'Non renseigné';
    const items = order.items?.length
      ? order.items
      : order.productSnapshot
        ? [{ snapshot: order.productSnapshot, quantity: 1 }]
        : [];
    const itemsSubtotal = items.reduce((sum, item) => {
      const unitPrice = Number(item.unitPrice ?? item.snapshot?.price ?? 0);
      return sum + Number(item.lineTotal ?? unitPrice * Number(item.quantity || 1));
    }, 0);
    const total = Number(order.totalAmount ?? itemsSubtotal + Number(order.deliveryFeeTotal || 0));
    const paid = Number(order.paidAmount || 0);
    const remaining = Number(order.remainingAmount ?? Math.max(0, total - paid));
    const pickup = isPickupOrder(order);
    const pickupAddress = pickup ? getPickupShopAddress(order) : null;
    const deliveryAddress = pickup
      ? pickupAddress?.addressLine || 'Adresse boutique non renseignée'
      : order.deliveryAddress || order.shippingAddressSnapshot?.addressLine || 'Adresse non renseignée';
    const deliveryCity = pickup
      ? pickupAddress?.cityLine || ''
      : order.deliveryCity || order.shippingAddressSnapshot?.cityName || '';
    const customerName = order.customer?.name || order.customerName || user?.name || 'Client HDMarket';
    const customerPhone =
      order.shippingAddressSnapshot?.phone || order.customer?.phone || order.customerPhone || user?.phone || '';
    const sellerLines = Array.from(
      new Map(
        items
          .map((item) => {
            const name = item.snapshot?.shopName || item.product?.user?.shopName || item.product?.user?.name || '';
            const phone = item.snapshot?.shopPhone || item.product?.user?.phone || '';
            return name || phone ? [`${name}|${phone}`, `• ${name || 'Vendeur'}${phone ? ` — ${phone}` : ''}`] : null;
          })
          .filter(Boolean)
      ).values()
    );
    const itemLines = items.flatMap((item, index) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice ?? item.snapshot?.price ?? 0);
      const lineTotal = Number(item.lineTotal ?? unitPrice * quantity);
      const options = (Array.isArray(item.selectedAttributes) ? item.selectedAttributes : [])
        .map((entry) => `${entry?.name || 'Option'}: ${entry?.value || '—'}`)
        .join(', ');
      return [
        `${index + 1}. *${item.snapshot?.title || item.product?.title || 'Produit'}*`,
        ...(options ? [`   Choix : ${options}`] : []),
        `   Quantité : ${quantity}`,
        `   Prix unitaire : ${formatCurrency(unitPrice)}`,
        `   Total ligne : ${formatCurrency(lineTotal)}`
      ];
    });
    const installmentLines = order.paymentType === 'installment'
      ? [
          '',
          '*Paiement en tranches*',
          `• Progression : ${Number(order.installmentPlan?.progressPercent || 0)}%`,
          `• Échéances : ${Array.isArray(order.installmentPlan?.schedule) ? order.installmentPlan.schedule.length : 0}`
        ]
      : [];
    const deliveryPerson = order.deliveryGuy
      ? `${order.deliveryGuy.fullName || order.deliveryGuy.name || 'Livreur'}${order.deliveryGuy.phone ? ` — ${order.deliveryGuy.phone}` : ''}`
      : '';
    const lines = [
      '*DÉTAIL DE LA COMMANDE HDMARKET*',
      `• Référence : #${String(order.orderNumber || order._id).slice(-8).toUpperCase()}`,
      `• Date : ${formatOrderTimestamp(order.createdAt) || 'Non disponible'}`,
      `• Statut : ${statusLabel}`,
      `• Mode de paiement : ${getPaymentModeLabel(resolveOrderPaymentMode(order))}`,
      '',
      '*Articles*',
      ...itemLines,
      '',
      '*Montants*',
      `• Sous-total : ${formatCurrency(itemsSubtotal)}`,
      `• Livraison : ${Number(order.deliveryFeeTotal || 0) > 0 ? formatCurrency(order.deliveryFeeTotal) : 'Gratuite / incluse'}`,
      `• Total : ${formatCurrency(total)}`,
      `• Montant payé : ${formatCurrency(paid)}`,
      `• Reste à payer : ${formatCurrency(remaining)}`,
      ...installmentLines,
      '',
      '*Client*',
      `• Nom : ${customerName}`,
      ...(customerPhone ? [`• Téléphone : ${customerPhone}`] : []),
      '',
      '*Réception*',
      `• Mode : ${pickup ? 'Retrait en boutique' : 'Livraison'}`,
      `• Adresse : ${deliveryAddress}${deliveryCity ? `, ${deliveryCity}` : ''}`,
      ...(deliveryPerson ? [`• Livreur : ${deliveryPerson}`] : []),
      ...(sellerLines.length ? ['', '*Vendeur(s)*', ...sellerLines] : []),
      '',
      `*Suivi de la commande* : ${window.location.href}`
    ];
    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener');
  };
  const walletEnabledPhones = String(getRuntimeValue('wallet_enabled_shops', '') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const orderSellerPhone = String(
    order?.items?.[0]?.snapshot?.shopPhone || order?.items?.[0]?.product?.user?.phone || ''
  ).trim();
  const installmentWalletEnabled =
    walletFeatureEnabled &&
    (walletEnabledPhones.length === 0 || walletEnabledPhones.includes(orderSellerPhone));
  const userScopeId = String(user?._id || user?.id || '').trim();
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

  useEffect(() => {
    const nextOrder = buyerOrderDetailQuery.data?.order || null;
    if (!nextOrder?._id || nextOrder.status === 'cancelled') {
      setTrackingData(null);
      return undefined;
    }

    let active = true;
    const fetchTracking = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const { data } = await api.get(`/orders/${nextOrder._id}/tracking`);
        if (active) setTrackingData(data);
      } catch {
        if (!active) return;
        setTrackingData((previous) => previous || {
          orderId: nextOrder._id,
          status: nextOrder.status,
          createdAt: nextOrder.createdAt,
          currentPosition: null,
          mapCenter: { lat: -4.2634, lng: 15.2429 },
          checkpoints: [{
            type: 'placed',
            icon: '🛒',
            label: 'Commande passée',
            time: nextOrder.createdAt,
            description: 'Suivi en attente de mise à jour par le vendeur.',
            active: true,
            isCurrent: true
          }],
          hasDeliveryRequest: false,
          courierName: null
        });
      }
    };

    fetchTracking();
    const terminal = ['cancelled', 'delivered', 'completed'].includes(
      String(nextOrder.status || '').toLowerCase()
    );
    const shouldPollLiveLocation = Boolean(nextOrder.platformDeliveryRequestId) && !terminal;
    const interval = shouldPollLiveLocation ? window.setInterval(fetchTracking, 15_000) : null;

    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [
    buyerOrderDetailQuery.data?.order?._id,
    buyerOrderDetailQuery.data?.order?.createdAt,
    buyerOrderDetailQuery.data?.order?.platformDeliveryRequestId,
    buyerOrderDetailQuery.data?.order?.status
  ]);

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
        showToast('Action en cours de confirmation. Le statut sera synchronisé automatiquement.', {
          variant: 'info'
        });
        return;
      }
      showToast(error?.response?.data?.message || 'Impossible de mettre à jour la commande.', {
        variant: 'error'
      });
    }
  });

  // Load suggestions / similar products from the ordered product category.
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
    const category = (order?.items || [])
      .map((item) => item?.product?.category || item?.snapshot?.category)
      .find(Boolean);
    api
      .get('/products/public', {
        params: { limit: 12, sort: 'new', ...(category ? { category } : {}) }
      })
      .then((res) => {
        if (!active) return;
        const raw = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.data || [];
        const filtered = raw.filter((p) => p?._id && !orderProductIds.has(String(p._id)));
        setSuggestionsProducts(filtered.slice(0, 9));
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
  }, [aiRecommendationsEnabled, order?._id, order?.items]);

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
    const paymentMethod = 'wallet';
    const amount = Number(entry?.amount || 0);

    if (paymentMethod === 'mobile_money' && !cleanPayerName) {
      appAlert('Le nom de l’expéditeur est requis.');
      return;
    }
    if (paymentMethod === 'mobile_money' && cleanTransactionCode.length !== 10) {
      appAlert('L’ID de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    if (paymentMethod === 'mobile_money') {
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
          paymentMethod,
          payerName: paymentMethod === 'wallet' ? user?.name || '' : cleanPayerName,
          transactionCode: paymentMethod === 'wallet' ? '' : cleanTransactionCode,
          amount
        }
      );
      applyOrderSnapshot(data);
      setInstallmentProofForms((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      appAlert(
        paymentMethod === 'wallet'
          ? 'Tranche payée avec le portefeuille HDMarket.'
          : 'Preuve transactionnelle transmise au vendeur. En attente de validation.'
      );
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
        showToast('Action en cours de confirmation. Le statut sera synchronisé automatiquement.', {
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
          await addItem(productId, quantity, item.selectedAttributes || []);
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
    const pdfStatus = getEffectiveOrderStatus(o);
    const pdfPaymentMode = resolveOrderPaymentMode(o);
    const hidePdfDeliveryDetails = shouldHideDeliveryDetailsForPaymentMode(pdfPaymentMode);
    const pdfCustomerName = escapeHtml(o?.customer?.name || o?.customerName || 'Client HDMarket');
    const pdfCustomerPhone = escapeHtml(
      o?.shippingAddressSnapshot?.phone || o?.customerPhone || o?.customer?.phone || ''
    );
    const pdfCustomerEmail = escapeHtml(o?.customer?.email || '');
    const pdfDeliveryAddress = escapeHtml(
      pickupOrderInPdf
        ? getPickupShopAddress(o)?.addressLine || 'Adresse boutique non renseignee'
        : o?.deliveryAddress || o?.customer?.address || 'Adresse non renseignee'
    );
    const pdfDeliveryCity = escapeHtml(
      pickupOrderInPdf
        ? getPickupShopAddress(o)?.cityLine || ''
        : o?.deliveryCity || o?.customer?.city || ''
    );
    const paidAmountPdf = Number(o?.paidAmount || 0);
    const remainingAmountPdf = Number(o?.remainingAmount ?? Math.max(0, orderTotal - paidAmountPdf));
    const rowsHtml = orderItems
      .map((item, idx) => {
        const title = escapeHtml(item.snapshot?.title || 'Produit');
        const shopName = escapeHtml(item.snapshot?.shopName || '');
        const qty = Number(item.quantity || 1);
        const unitPrice = formatCurrency(item.snapshot?.price || 0);
        const lineTotal = formatCurrency((item.snapshot?.price || 0) * qty);
        return `<tr>
          <td class="idx">${idx + 1}</td>
          <td>
            <div class="item-title">${title}</div>
            ${shopName ? `<div class="muted">Boutique: ${shopName}</div>` : ''}
          </td>
          <td class="right">${unitPrice}</td>
          <td class="right">x${qty}</td>
          <td class="right strong">${lineTotal}</td>
        </tr>`;
      })
      .join('');
    const deliveryLocked = Boolean(o?.deliveryFeeLocked) && String(o?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
    const deliveryRowHtml = !hidePdfDeliveryDetails && !pickupOrderInPdf && (deliveryFeeTotal > 0 || deliveryLocked)
      ? `<tr><td colspan="4" class="right muted">Frais de livraison</td><td class="right strong">${deliveryLocked ? 'Offerts' : formatCurrency(deliveryFeeTotal)}</td></tr>`
      : '';
    const deliveryCardHtml = hidePdfDeliveryDetails
      ? ''
	      : `<section class="card">
	            <h2>${pickupOrderInPdf ? 'Retrait boutique' : 'Livraison'}</h2>
	            <p class="strong">${pdfDeliveryAddress}</p>
	            ${pdfDeliveryCity ? `<p class="muted">${pdfDeliveryCity}</p>` : ''}
	            ${!pickupOrderInPdf && pdfCustomerPhone ? `<p class="muted">Téléphone: ${pdfCustomerPhone}</p>` : ''}
	          </section>`;
    const orderShort = escapeHtml(o?._id?.slice(-6) || '');
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bon de commande ${orderShort}</title>
  <style>
    :root{--orange:#e85d00;--orange-dark:#9a4a00;--paper:#fffaf4;--ink:#111827;--muted:#6b7280;--line:#f2dfcf;}
    *{box-sizing:border-box}
    body{margin:0;background:#f6f3ee;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
    .page{max-width:900px;margin:24px auto;padding:24px}
    .sheet{overflow:hidden;border:1px solid var(--line);border-radius:28px;background:#fff;box-shadow:0 18px 48px rgba(117,75,36,.10)}
    .hero{padding:28px;background:linear-gradient(135deg,#e85d00,#e85d00 58%,#ff9a1f);color:#fff}
    .brand{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .brand h1{margin:0;font-size:34px;letter-spacing:-.03em}
    .pill{display:inline-flex;align-items:center;border-radius:999px;padding:8px 12px;background:#fff;color:var(--orange-dark);font-size:12px;font-weight:900;text-transform:uppercase}
    .hero-meta{margin-top:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    .hero-card{border:1px solid rgba(255,255,255,.24);border-radius:18px;background:rgba(255,255,255,.14);padding:12px}
    .label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.72)}
    .hero-card strong{display:block;margin-top:4px;font-size:15px}
    .content{padding:22px;background:var(--paper)}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .card{border:1px solid var(--line);border-radius:22px;background:#fff;padding:16px}
    .card h2{margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--orange-dark)}
    .muted{color:var(--muted);font-size:12px;line-height:1.45}
    .strong{font-weight:900}
    table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#fff}
    th{background:#fff2e6;color:var(--orange-dark);font-size:11px;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:12px}
    td{border-top:1px solid #f4eadf;padding:13px 12px;vertical-align:top;font-size:13px}
    .idx{width:42px;color:var(--muted);font-weight:800}
    .item-title{font-weight:900}
    .right{text-align:right}
    .total-row td{background:#111827;color:#fff;border-top:0;font-size:16px;font-weight:900}
    .summary{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .summary .card{padding:14px}
    .summary strong{display:block;margin-top:4px;font-size:18px;color:var(--orange)}
    .footer{padding:16px 22px;border-top:1px solid var(--line);background:#fff;color:var(--muted);font-size:11px;display:flex;justify-content:space-between;gap:16px}
    @media print{body{background:#fff}.page{margin:0;max-width:none;padding:0}.sheet{box-shadow:none;border-radius:0}.no-print{display:none}}
    @media (max-width:720px){.page{padding:12px}.hero-meta,.grid,.summary{grid-template-columns:1fr}.brand{align-items:flex-start;flex-direction:column}.brand h1{font-size:28px}}
  </style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <section class="hero">
        <div class="brand">
          <div>
            <div class="label">HDMarket</div>
            <h1>Bon de commande</h1>
          </div>
          <span class="pill">#${orderShort}</span>
        </div>
        <div class="hero-meta">
          <div class="hero-card"><span class="label">Statut</span><strong>${escapeHtml(STATUS_LABELS[pdfStatus] || pdfStatus)}</strong></div>
          <div class="hero-card"><span class="label">Date</span><strong>${escapeHtml(new Date(o?.createdAt).toLocaleDateString('fr-FR'))}</strong></div>
          <div class="hero-card"><span class="label">Paiement</span><strong>${escapeHtml(getPaymentModeLabel(pdfPaymentMode))}</strong></div>
        </div>
      </section>
      <main class="content">
        <div class="grid">
          <section class="card">
            <h2>Client</h2>
            <p class="strong">${pdfCustomerName}</p>
            ${pdfCustomerPhone ? `<p class="muted">${pdfCustomerPhone}</p>` : ''}
            ${pdfCustomerEmail ? `<p class="muted">${pdfCustomerEmail}</p>` : ''}
          </section>
          ${deliveryCardHtml}
        </div>
        <table>
          <thead><tr><th>#</th><th>Article</th><th class="right">Prix</th><th class="right">Qté</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${rowsHtml}
            ${deliveryRowHtml}
            <tr class="total-row"><td colspan="4" class="right">Total commande</td><td class="right">${formatCurrency(orderTotal)}</td></tr>
          </tbody>
        </table>
        <div class="summary">
          <section class="card"><h2>Total</h2><strong>${formatCurrency(orderTotal)}</strong></section>
          <section class="card"><h2>Payé</h2><strong>${formatCurrency(paidAmountPdf)}</strong></section>
          <section class="card"><h2>Reste</h2><strong>${formatCurrency(remainingAmountPdf)}</strong></section>
        </div>
      </main>
      <footer class="footer">
        <span>Document généré par HDMarket.</span>
        <span>Conservez ce bon pour le suivi de votre commande.</span>
      </footer>
    </div>
  </div>
</body>
</html>`;
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
      <div className="hd-order-flow hd-commerce-shell min-h-screen dark:bg-neutral-950">
        <GlassHeader title="Commande" subtitle="Chargement..." backTo="/orders" />
        <OrderDetailSkeleton />
      </div>
    );
  }

  if (queryErrorMessage || !order) {
    return (
      <div className="hd-order-flow hd-commerce-shell min-h-screen p-4">
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
  const hideDeliveryDetails = shouldHideDeliveryDetailsForPaymentMode(orderPaymentMode);
  const deliveryFeeLockedByFullPayment =
    Boolean(order.deliveryFeeLocked) && String(order.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
  const showDeliveryFeeRow =
    !hideDeliveryDetails &&
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
    isInstallmentOrder && ['installment_paid', 'completed'].includes(order.status)
      ? order.installmentSaleStatus || 'confirmed'
      : order.installmentSaleStatus || '';
  const effectiveOrderStatus = isInstallmentOrder
    ? installmentWorkflow?.workflowStatus || order.status
    : getEffectiveOrderStatus(order);
  const pickupOrder = isPickupOrder(order);
  const displayOrderStatus =
    isInstallmentOrder && effectiveOrderStatus === 'completed'
      ? pickupOrder
        ? ['delivered', 'picked_up_confirmed'].includes(installmentSaleStatus)
          ? 'picked_up_confirmed'
          : installmentSaleStatus === 'ready_for_pickup'
            ? 'ready_for_pickup'
            : 'confirmed'
        : installmentSaleStatus || 'confirmed'
      : effectiveOrderStatus;
  const showPayment = Boolean(
    isInstallmentOrder ||
      paidAmount ||
      order.paymentTransactionCode ||
      order.paymentName
  );
  const createdBySelf = order.createdBy?._id && order.customer?._id ? order.createdBy._id === order.customer._id : false;
  const createdByLabel = createdBySelf ? 'Vous' : order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket';
  const StatusIcon = STATUS_ICONS[effectiveOrderStatus] || Clock;
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
  const displayDeliveryPhone =
    normalizeAddressPart(order?.shippingAddressSnapshot?.phone) ||
    normalizeAddressPart(order?.customerPhone) ||
    normalizeAddressPart(order?.customer?.phone) ||
    normalizeAddressPart(user?.phone) ||
    '';
  // City mismatch warning for buyer
  const sellerCity = normalizeAddressPart(order?.seller?.city || '');
  const buyerCity = displayDeliveryCity;
  const cityMismatch = Boolean(sellerCity && buyerCity) && sellerCity.toLowerCase() !== buyerCity.toLowerCase();
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
  const visibleBuyerPrimaryAction =
    hideDeliveryDetails && !pickupOrder && buyerPrimaryAction?.mode === 'confirm_delivery' ? null : buyerPrimaryAction;
  const handlePrimaryBuyerAction = async () => {
    if (!visibleBuyerPrimaryAction || visibleBuyerPrimaryAction.mode === 'none') return;
    if (visibleBuyerPrimaryAction.mode === 'cancel') {
      await handleCancelOrder();
      return;
    }
    if (visibleBuyerPrimaryAction.mode === 'confirm_delivery') {
      await handleConfirmDelivery();
    }
  };
  const isPrimaryActionPending =
    (visibleBuyerPrimaryAction?.mode === 'cancel' && buyerStatusMutation.isReliablePending) ||
    (visibleBuyerPrimaryAction?.mode === 'confirm_delivery' && confirmDeliveryMutation.isReliablePending);
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
  const deliveryProofSources = (Array.isArray(order.deliveryProofImages) ? order.deliveryProofImages : [])
    .map((proof) => typeof proof === 'string' ? proof : proof?.url || proof?.path || proof?.secure_url || proof?.location || '')
    .map(normalizeFileUrl)
    .filter(Boolean);
  const hasDeliveryEvidence = deliveryProofSources.length > 0 || Boolean(String(order.clientSignatureImage || '').trim());
  const compactProgressSteps = buildProgressSteps({
    isInstallment: isInstallmentOrder,
    isPickup: pickupOrder
  });
  const compactProgressIndex = effectiveOrderStatus === 'cancelled'
    ? 0
    : resolveProgressStepIndex({ status: effectiveOrderStatus, isInstallment: isInstallmentOrder });
  const compactProgress = effectiveOrderStatus === 'cancelled'
    ? 100
    : compactProgressSteps.length > 1
      ? (compactProgressIndex / (compactProgressSteps.length - 1)) * 100
      : 100;

  return (
    <div className="hd-order-flow min-h-screen bg-[#f6f3ee] text-slate-950 dark:bg-neutral-950">
      <GlassHeader
        title={`Commande #${order._id.slice(-6)}`}
        subtitle="Détail client"
        backTo="/orders"
        right={<StatusBadge status={displayOrderStatus} compact />}
      />
      {order.sponsoredPayment?.isSponsored && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-sm">
            <p className="font-black text-amber-900">
              {getSponsorshipStatusMeta(order.sponsoredPayment.status).title}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-amber-700">
              {getSponsorshipStatusMeta(order.sponsoredPayment.status).hint}
            </p>
            {['pending', 'declined', 'expired'].includes(order.sponsoredPayment.status) && (
              <Link
                to="/sponsorships"
                className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-900 underline underline-offset-2"
              >
                Gérer la demande →
              </Link>
            )}
          </section>
        </div>
      )}
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
      {!hideDeliveryDetails && (queuedDeliveryActionCount > 0 || deliveryQueueSyncing) && (
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
      <div className="mx-auto max-w-5xl px-3 py-4 pb-28 sm:px-5 sm:py-6">

        {/* The compact legacy card is kept out of the rendered layout. The complete
            order surface below is responsive and is now the single source of truth
            for both mobile and desktop, preventing order information from diverging. */}
        <section className="hidden" aria-hidden="true">
          <article className="overflow-hidden rounded-2xl border border-[#e2dcd2] bg-white shadow-sm">
            <div className="border-b border-[#eee8e0] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order._id.slice(-6).toUpperCase(), 'orderId')}
                    className="inline-flex min-h-11 items-center gap-2 text-left"
                  >
                    <span className="text-base font-black text-[#231f1b]">Commande #{order._id.slice(-6)}</span>
                    {copiedKey === 'orderId' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[#8a8378]" />}
                  </button>
                  <p className="text-xs font-semibold text-[#8a8378]">{formatOrderTimestamp(order.createdAt) || 'Date non disponible'}</p>
                </div>
                <StatusBadge status={displayOrderStatus} compact />
              </div>
              <OrderMiniRail
                className="mt-3"
                progress={compactProgress}
                stops={compactProgressSteps.length}
                step={compactProgressIndex + 1}
                urgent={effectiveOrderStatus === 'cancelled'}
                label={STATUS_LABELS[displayOrderStatus] || STATUS_LABELS[effectiveOrderStatus] || effectiveOrderStatus}
              />
            </div>

            <div className="space-y-3 p-4">
              <div className="space-y-3">
                {orderItems.map((item, index) => {
                  const image = item.snapshot?.image || item.product?.images?.[0];
                  return (
                    <div key={`${order._id}-compact-${index}`} className="flex gap-3">
                      {image ? (
                        <img src={image} alt={item.snapshot?.title || 'Produit'} className="h-16 w-16 shrink-0 rounded-xl border border-[#eee8e0] object-cover" />
                      ) : (
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#f5f2ee]"><Package className="h-5 w-5 text-[#8a8378]" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-black leading-5 text-[#231f1b]">{item.snapshot?.title || 'Produit'} × {item.quantity || 1}</p>
                        <p className="mt-1 text-xs font-semibold text-[#6b6459]">{item.snapshot?.shopName || order.seller?.shopName || 'Vendeur HDMarket'}</p>
                        <p className="mt-1 text-sm font-black text-[#231f1b]">{formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl bg-[#f5f2ee] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#6b6459]">{paymentModeLabel}</span>
                  <span className="text-lg font-black text-[#231f1b]">{formatCurrency(isInstallmentOrder ? installmentTotal : totalAmount)}</span>
                </div>
                {showPayment ? <p className="mt-1 text-xs font-semibold text-[#8a8378]">{paidAmountLabel} : {formatCurrency(isInstallmentOrder ? installmentPaid : paidAmount)} · Reste {formatCurrency(isInstallmentOrder ? installmentRemaining : remainingAmount)}</p> : null}
              </div>

              {!hideDeliveryDetails ? (
                <div className="flex items-start gap-3 rounded-xl border border-[#eee8e0] px-3 py-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e85d00]" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#231f1b]">{pickupOrder ? 'Point de retrait' : 'Adresse de livraison'}</p>
                    <p className="mt-1 text-xs leading-5 text-[#6b6459]">{pickupOrder ? pickupShopAddress?.addressLine || 'Adresse boutique non renseignée' : displayDeliveryAddress}{!pickupOrder && displayDeliveryCity ? `, ${displayDeliveryCity}` : ''}</p>
                  </div>
                </div>
              ) : null}

              {order.deliveryCode && !hideDeliveryDetails ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f0c7aa] bg-[#fff8f2] px-3 py-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#8a8378]">Code de livraison</p>
                    <p className={`mt-1 font-mono text-xl font-black tracking-[0.22em] text-[#231f1b] ${deliveryCodeRevealed ? '' : 'select-none blur-sm'}`}>{order.deliveryCode}</p>
                  </div>
                  <button type="button" onClick={() => setDeliveryCodeRevealed((value) => !value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#231f1b] ring-1 ring-[#e2dcd2]" aria-label={deliveryCodeRevealed ? 'Masquer le code' : 'Afficher le code'}>
                    {deliveryCodeRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              ) : null}

              {(hasDeliveryEvidence || order.deliveryStatus === 'submitted' ||
                order.deliveryStatus === 'verified' ||
                order.status === 'delivery_proof_submitted') ? (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm font-black text-[#231f1b]">
                      {pickupOrder ? 'Preuve de retrait' : 'Preuve de livraison'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold leading-5 text-[#6b6459]">
                    {pickupOrder
                      ? deliveryConfirmationDone
                        ? 'Retrait confirmé par le client'
                        : 'Preuve soumise par le vendeur, en attente de votre confirmation'
                      : deliveryConfirmationDone
                        ? 'Livraison confirmée'
                        : 'Preuve soumise par le vendeur, en attente de votre confirmation'}
                  </p>
                  {order.deliveryDate ? (
                    <p className="text-xs text-[#8a8378]">{formatOrderTimestamp(order.deliveryDate)}</p>
                  ) : null}
                  {order.deliveryNote ? (
                    <p className="rounded-lg bg-white/80 px-3 py-2 text-xs leading-5 text-[#6b6459]">
                      <span className="font-black text-[#231f1b]">Note vendeur :</span> {order.deliveryNote}
                    </p>
                  ) : null}
                  {deliveryProofSources.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {deliveryProofSources.map((src, index) => (
                        <button
                          key={`mobile-proof-image-${index}`}
                          type="button"
                          onClick={() => openProofPreview(src, `Photo ${index + 1}`)}
                          className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white ring-1 ring-emerald-100"
                        >
                          <DeliveryProofImage
                            src={src}
                            alt={`${pickupOrder ? 'Photo de retrait' : 'Photo de livraison'} ${index + 1}`}
                            className="h-full w-full object-contain bg-slate-50 p-1.5"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] font-black text-white">
                            Photo {index + 1} · Agrandir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {order.clientSignatureImage ? (
                    <button
                      type="button"
                      onClick={() => openProofPreview(order.clientSignatureImage, 'Signature client')}
                      className="relative block w-full overflow-hidden rounded-xl border border-rose-100 bg-white"
                    >
                      <img
                        src={normalizeFileUrl(order.clientSignatureImage)}
                        alt="Signature client"
                        className="h-24 w-full object-contain p-2"
                        loading="lazy"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] font-black text-white">
                        Signature client · Agrandir
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {order.cancellationWindow?.isActive && effectiveOrderStatus !== 'cancelled' ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <CancellationTimer
                    deadline={order.cancellationWindow.deadline}
                    remainingMs={order.cancellationWindow.remainingMs}
                    isActive={order.cancellationWindow.isActive}
                    onExpire={() => setOrder((prev) => prev ? { ...prev, cancellationWindow: { ...prev.cancellationWindow, isActive: false, remainingMs: 0 } } : null)}
                  />
                  <button
                    type="button"
                    onClick={handleSkipCancellationWindow}
                    disabled={skipLoadingId === order._id}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-black text-white shadow-sm disabled:opacity-70"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {skipLoadingId === order._id ? 'En cours...' : 'Autoriser le vendeur à traiter'}
                  </button>
                </div>
              ) : null}

              {visibleBuyerPrimaryAction ? (
                <button type="button" onClick={handlePrimaryBuyerAction} disabled={isPrimaryActionPending || skipLoadingId === order._id} className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-white disabled:opacity-60 ${visibleBuyerPrimaryAction.intent === 'danger' ? 'bg-red-700' : 'bg-[#e85d00]'}`}>
                  {isPrimaryActionPending ? <Clock className="h-4 w-4 animate-spin" /> : null}
                  {visibleBuyerPrimaryAction.label}
                </button>
              ) : null}

              <OrderChat order={order} buttonText="Contacter le vendeur" unreadCount={unreadCount} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={shareOrderOnWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e2dcd2] text-xs font-black text-[#231f1b]"><MessageCircle className="h-4 w-4" /> Partager</button>
                <button type="button" onClick={() => openOrderPdf(order)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e2dcd2] text-xs font-black text-[#231f1b]"><Download className="h-4 w-4" /> Bon de commande</button>
              </div>
            </div>
          </article>
        </section>

        <motion.div
          {...riseIn(reduceMotion, 0)}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="relative overflow-hidden bg-[#e85d00] px-5 py-5 text-white sm:px-7 sm:py-6">
            <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-sm ring-1 ring-white/25">
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/78">Commande HDMarket</p>
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
                  {STATUS_LABELS[effectiveOrderStatus] || effectiveOrderStatus}
                </span>
                <button type="button" onClick={shareOrderOnWhatsApp} className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-black/18 px-3 text-xs font-black text-white ring-1 ring-white/20 transition hover:bg-black/25 active:scale-95" title="Partager le suivi sur WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                  Partager
                </button>
                <button type="button" onClick={() => openOrderPdf(order)} className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-black/18 px-3 text-xs font-black text-white ring-1 ring-white/20 transition hover:bg-black/25 active:scale-95" title="Télécharger le bon de commande">
                  <Download className="w-4 h-4" />
                  Bon
                </button>
              </div>
            </div>
          </div>

          {isInstallmentOrder && <InstallmentOrderTracking order={order} isPickup={pickupOrder} />}
          {!isInstallmentOrder && (() => {
            const cancelled = effectiveOrderStatus === 'cancelled';
            const steps = buildProgressSteps({ isInstallment: isInstallmentOrder, isPickup: pickupOrder });
            const stepIndex = cancelled
              ? 0
              : resolveProgressStepIndex({ status: effectiveOrderStatus, isInstallment: isInstallmentOrder });
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

          {order.deliveryCode && !hideDeliveryDetails && (
            <div className="relative border-t-2 border-dashed border-gray-200 bg-white px-5 pb-5 pt-4 dark:border-neutral-800 dark:bg-neutral-950 sm:px-7">
              <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#f6f3ee] dark:bg-neutral-950" aria-hidden="true" />
              <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#f6f3ee] dark:bg-neutral-950" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#e85d00]" /> Code de livraison
                  </p>
                  <motion.p
                    animate={reduceMotion ? {} : { scale: deliveryCodeRevealed ? [1, 1.06, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                    className={`mt-1 font-mono text-3xl font-black tracking-[0.25em] text-neutral-950 transition-all duration-300 sm:text-4xl ${
                      deliveryCodeRevealed ? '' : 'select-none blur-md'
                    }`}
                  >
                    {order.deliveryCode}
                  </motion.p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">
                    {deliveryCodeRevealed
                      ? 'Présentez ce code au livreur à la réception.'
                      : 'Masqué par sécurité — affichez-le devant le livreur.'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryCodeRevealed((prev) => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition active:scale-95 dark:bg-neutral-800 dark:text-neutral-200"
                    title={deliveryCodeRevealed ? 'Masquer le code' : 'Afficher le code'}
                  >
                    {deliveryCodeRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.deliveryCode, 'deliveryCode')}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e85d00] text-white transition active:scale-95"
                    title="Copier le code"
                  >
                    {copiedKey === 'deliveryCode' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 bg-gray-50 p-3 sm:p-5">
            {order.cancellationWindow?.isActive && effectiveOrderStatus !== 'cancelled' && (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                <CancellationTimer
                  deadline={order.cancellationWindow.deadline}
                  remainingMs={order.cancellationWindow.remainingMs}
                  isActive={order.cancellationWindow.isActive}
                  onExpire={() => setOrder((prev) => prev ? { ...prev, cancellationWindow: { ...prev.cancellationWindow, isActive: false, remainingMs: 0 } } : null)}
                />
                <button type="button" onClick={handleSkipCancellationWindow} disabled={skipLoadingId === order._id} className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-70">
                  <ShieldCheck className="w-5 h-5 inline mr-2" />
                  {skipLoadingId === order._id ? 'En cours...' : 'Autoriser le vendeur à traiter'}
                </button>
                {visibleBuyerPrimaryAction?.key !== 'cancel_order' ? (
                  <button type="button" onClick={handleCancelOrder} className="w-full rounded-full bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700">
                    <X className="w-5 h-5 inline mr-2" /> Annuler la commande
                  </button>
                ) : null}
              </div>
            )}

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
            </motion.section>

            {!hideDeliveryDetails && (
            <motion.div {...riseIn(reduceMotion, 0.16)} className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-black text-gray-900">
                    <MapPin className="w-4 h-4 text-[#e85d00]" /> {pickupOrder ? 'Adresse boutique' : 'Adresse de livraison'}
                  </h4>
                  {[
                    'pending',
                    'pending_payment',
                    'paid',
                    'confirmed',
                    'pending_installment'
                  ].includes(order.status) && !pickupOrder && (
                    <button type="button" onClick={() => setEditAddressModalOpen(true)} className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-500 hover:bg-orange-100">
                      Modifier
                    </button>
                  )}
                </div>
                <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
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
	                      {displayDeliveryPhone ? (
	                        <p className="text-xs font-semibold text-gray-700">
	                          Téléphone: {displayDeliveryPhone}
	                        </p>
	                      ) : null}
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
            </motion.div>
            )}

            {!hideDeliveryDetails && order.trackingNote && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900"><Info className="w-4 h-4 text-[#e85d00]" /> Note de suivi</h4>
                <p className="text-sm font-semibold leading-6 text-gray-700">{order.trackingNote}</p>
              </div>
            )}

            {(hasDeliveryEvidence || order.deliveryStatus === 'submitted' ||
              order.deliveryStatus === 'verified' ||
              order.status === 'delivery_proof_submitted') && (
              <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-black text-gray-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> {pickupOrder ? 'Preuve de retrait' : 'Preuve de livraison'}
                </h4>
                <p className="text-sm text-gray-700">
                  Statut:{' '}
                  <span className="font-semibold">
                    {pickupOrder
                      ? deliveryConfirmationDone
                        ? 'Retrait confirmé par le client'
                        : 'Preuve soumise par le vendeur (en attente de votre confirmation)'
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
                {deliveryProofSources.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Photos de livraison</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {deliveryProofSources.map((src, index) => {
                        return (
                          <button
                            key={`proof-image-${index}`}
                            type="button"
                            onClick={() => openProofPreview(src, `Photo ${index + 1}`)}
                            className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-white ring-1 ring-sky-100 transition hover:ring-sky-300 hover:shadow-md"
                          >
                            <DeliveryProofImage
                              src={src}
                              alt={`Photo de livraison ${index + 1}`}
                              className="h-full w-full object-contain bg-slate-50 p-2"
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
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>
                      </div>
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Signature du client</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProofPreview(order.clientSignatureImage, 'Signature client')}
                      className="group relative block w-full overflow-hidden rounded-xl border border-rose-100 bg-rose-50/30 ring-1 ring-rose-100 transition hover:ring-rose-300"
                    >
                      <img
                        src={normalizeFileUrl(order.clientSignatureImage)}
                        alt="Signature client"
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
                {!deliveryConfirmationDone && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {visibleBuyerPrimaryAction?.key !== 'confirm_delivery' ? (
                        <button
                          type="button"
                          onClick={handleConfirmDelivery}
                          disabled={confirmDeliveryMutation.isReliablePending}
                          className="rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {confirmDeliveryMutation.isReliablePending
                            ? 'Confirmation en cours...'
                            : pickupOrder ? 'Confirmer le retrait' : 'Confirmer la livraison'}
                        </button>
                      ) : null}
                      <Link
                        to={`/reclamations?orderId=${order._id}`}
                        className="rounded-full border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100"
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
                        <span>Synchronisation automatique en cours.</span>
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
                {deliveryConfirmationDone && (
                  <Link
                    to={`/reclamations?orderId=${order._id}`}
                    className="inline-flex rounded-full border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100"
                  >
                    Signaler un problème / Ouvrir un litige
                  </Link>
                )}
              </div>
            )}

            <motion.section {...riseIn(reduceMotion, 0.22)} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900"><CreditCard className="w-4 h-4 text-[#e85d00]" /> Paiement</h4>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-500">Mode de paiement</span>
                    {isFullPaymentOrder && (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${getPaymentModeBadgeClasses(orderPaymentMode)}`}
                  >
                    {paymentModeLabel}
                  </span>
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
                    <span className={`text-sm font-black ${deliveryFeeLockedByFullPayment ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {deliveryFeeLockedByFullPayment ? 'GRATUITE' : formatCurrency(order.deliveryFeeTotal)}
                    </span>
                  </div>
                )}
                {!hideDeliveryDetails && deliveryFeeLockedByFullPayment && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Livraison offerte grâce au paiement intégral. Aucun frais de livraison ne peut être ajouté sur cette commande.
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
                      <span className="text-sm font-black text-emerald-700">
                        {formatCurrency(isInstallmentOrder ? installmentPaid : paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reste à payer</span>
                      <span className="text-sm font-black text-amber-700">
                        {formatCurrency(isInstallmentOrder ? installmentRemaining : remainingAmount)}
                      </span>
                    </div>
                    {isInstallmentOrder && (
                      <>
                        <div>
                          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-[#ffb000] transition-all duration-300"
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
                        {['installment_paid', 'completed'].includes(order.status) && (
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
            </motion.section>

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
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-black text-gray-900">
                  <Receipt className="w-4 h-4 text-[#e85d00]" /> Validation de vente
                </h4>
                <p className="text-sm text-gray-700">
                  Statut:{' '}
                  <span className="font-semibold">
                    {saleConfirmationConfirmed ? 'Confirmée par vous' : 'En attente de confirmation vendeur'}
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
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-black text-gray-900">
                  <CreditCard className="w-4 h-4 text-[#e85d00]" /> Échéancier et preuves transactionnelles
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
                        '',
                      paymentMethod: 'wallet'
                    };
                    return (
                      <div key={`${order._id}-installment-${index}`} className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
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
                            {installmentWalletEnabled && Number(entry?.amount || 0) >= 10 && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <p className="mb-2 text-xs font-black text-emerald-900">
                                  Recharge automatique pour cette tranche
                                </p>
                                <PawaPayButton
                                  amount={entry?.amount || 0}
                                  purpose="INSTALLMENT_FUNDING"
                                  returnPath={typeof window !== 'undefined' ? window.location.pathname : '/orders'}
                                  label="Payer la tranche avec PawaPay"
                                />
                                <p className="mt-2 text-[11px] font-semibold text-emerald-800">
                                  Après votre retour, choisissez « Portefeuille » pour valider la tranche.
                                </p>
                              </div>
                            )}
                            {installmentWalletEnabled && (
                              <div className="rounded-xl border border-emerald-500 bg-emerald-50 p-3 text-left text-xs font-bold text-emerald-800">
                                <Wallet size={16} className="mb-1.5" />
                                PawaPay · aucun ID transaction
                              </div>
                            )}
                            {proofDraft.paymentMethod === 'wallet' ? (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                                {formatCurrency(entry?.amount || 0)} seront débités et validés automatiquement.
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
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
                                (proofDraft.paymentMethod !== 'wallet' &&
                                  (!String(proofDraft.payerName || '').trim() ||
                                    String(proofDraft.transactionCode || '').replace(/\D/g, '').length !== 10))
                              }
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                                proofDraft.paymentMethod === 'wallet'
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-neutral-600 hover:bg-neutral-700'
                              }`}
                            >
                              {installmentUploadIndex === index
                                ? 'Traitement...'
                                : proofDraft.paymentMethod === 'wallet'
                                  ? 'Payer avec le portefeuille'
                                  : 'Envoyer la preuve transactionnelle'}
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
              <h4 className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900"><ShieldCheck className="w-4 h-4 text-[#e85d00]" /> Gestionnaire</h4>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{createdByLabel}</p>
                {order.createdBy?.email && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Mail className="w-3 h-3" />{order.createdBy.email}</p>}
              </div>
            </div>

            {effectiveOrderStatus === 'cancelled' && (
              <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-bold text-red-800">Commande annulée</p>
                </div>
                {order.cancellationReason && <p className="text-sm text-red-700">Raison: {order.cancellationReason}</p>}
                {order.cancelledAt && <p className="text-xs text-red-600">Annulée le {formatOrderTimestamp(order.cancelledAt)}</p>}
                {Number(order.refundAmount || 0) > 0 && (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
                    <p className="font-bold">Remboursement intégral: {formatCurrency(order.refundAmount)}</p>
                    <p>
                      Mode: {order.refundMethod === 'wallet' ? 'Portefeuille HDMarket' : 'Mobile Money'}
                    </p>
                    {order.refundMethod === 'wallet' ? (
                      <p className="text-xs font-semibold text-emerald-700">Le montant a été crédité dans votre portefeuille.</p>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 📍 Carte de suivi — includes its own "Suivi de la commande" history below the map */}
            {!hideDeliveryDetails && effectiveOrderStatus !== 'cancelled' && trackingData && (
              <OrderTrackingMap trackingData={trackingData} />
            )}

            {/* ⚠️ City mismatch warning (buyer side) */}
            {!hideDeliveryDetails && cityMismatch && (
              <div className="rounded-2xl border-2 border-gray-200 bg-gray-100 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-900">Attention: villes différentes</p>
                    <p className="text-xs text-orange-800 mt-1">
                      Le vendeur est à <span className="font-semibold">{sellerCity}</span> et vous êtes à{' '}
                      <span className="font-semibold">{buyerCity}</span>. Vérifiez les conditions de livraison avant de confirmer la commande.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {visibleBuyerPrimaryAction ? (
              <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${getPrimaryActionClassName(
                    visibleBuyerPrimaryAction.intent
                  )}`}
                >
                  {isPrimaryActionPending ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : null}
                  {visibleBuyerPrimaryAction.label}
                </button>
                {visibleBuyerPrimaryAction.mode === 'cancel' && buyerStatusMutation.uiPhase === 'stillWorking' ? (
                  <p className="text-xs text-amber-700">
                    Traitement en cours... merci de patienter.
                  </p>
                ) : null}
                {visibleBuyerPrimaryAction.mode === 'cancel' && buyerStatusMutation.uiPhase === 'slow' ? (
                  <p className="text-xs text-amber-700">
                    Action en cours de confirmation. Le statut sera synchronisé automatiquement.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <OrderChat order={order} buttonText="Contacter le vendeur" unreadCount={unreadCount} />
              {isOrderFulfilmentComplete(order) &&
                order.items?.length > 0 && (
                <button type="button" onClick={handleReorder} disabled={reordering} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e85d00] px-6 py-3 font-black text-white shadow-sm hover:bg-[#e85f00] disabled:opacity-50">
                  {reordering ? <Clock className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                  <span>{reordering ? 'Ajout au panier...' : 'Commander à nouveau'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 text-xs font-semibold text-gray-600">
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

        {aiRecommendationsEnabled && (
          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:mt-8 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-gray-900 sm:text-base">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-gray-100 text-[#e85d00] ring-1 ring-gray-200">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="truncate">Produits de la même catégorie</span>
              </h3>
              <Link to="/suggestions" className="flex shrink-0 items-center gap-0.5 text-xs font-black text-gray-500 sm:text-sm">
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {suggestionsLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : suggestionsProducts.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {suggestionsProducts.map((product) => {
                  const imageUrl = Array.isArray(product.images) ? product.images[0] : product.image;
                  const price = product.price != null ? product.price : product.prix;
                  return (
                    <Link
                      key={product._id}
                      to={buildProductPath(product)}
                      {...externalLinkProps}
                      className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="relative aspect-square w-full bg-gray-100">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.title || 'Produit'} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-7 w-7 text-[#e85d00]/45" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 sm:p-2.5">
                        <p className="line-clamp-2 min-h-[2rem] text-[11px] font-bold leading-4 text-gray-900 sm:text-xs">{product.title || 'Produit'}</p>
                        <p className="mt-1 truncate text-[11px] font-black text-[#e85d00] sm:text-xs">{formatCurrency(price)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Link
                to="/suggestions"
                className="block rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm font-semibold text-gray-500 hover:border-gray-200"
              >
                Découvrir des suggestions personnalisées
              </Link>
            )}
          </section>
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
    </div>
  );
}
