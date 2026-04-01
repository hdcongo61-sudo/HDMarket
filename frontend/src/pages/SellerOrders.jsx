import React, { useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import OrderChat from '../components/OrderChat';
import GlassHeader from '../components/orders/GlassHeader';
import AnimatedOrderTimeline from '../components/orders/AnimatedOrderTimeline';
import StatusBadge from '../components/orders/StatusBadge';
import { OrderListSkeleton } from '../components/orders/OrderSkeletons';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import usePullToRefresh from '../hooks/usePullToRefresh';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useAppSettings } from '../context/AppSettingsContext';
import { getPickupShopAddress, isPickupOrder as resolvePickupOrder } from '../utils/pickupAddress';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import useReliableMutation from '../hooks/useReliableMutation';
import useOrderRealtimeSync from '../hooks/useOrderRealtimeSync';
import useSellerOrdersListQuery from '../hooks/useSellerOrdersListQuery';
import { orderQueryKeys } from '../hooks/useOrderQueryKeys';
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
  delivery_proof_submitted: 'Preuve soumise',
  confirmed_by_client: 'Confirmée client',
  pending: 'En attente',
  pending_installment: 'Validation vente',
  installment_active: 'Tranche active',
  overdue_installment: 'Retard tranche',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  completed: 'Paiement terminé',
  cancelled: 'Commande annulée'
};

const STATUS_STYLES = {
  pending: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  ready_for_pickup: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  picked_up_confirmed: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  pending_installment: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  installment_active: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  overdue_installment: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  confirmed: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  delivering: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  delivered: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  completed: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
  cancelled: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' }
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

const STATUS_TABS = [
  { key: 'all', label: 'Toutes', icon: ClipboardList, count: null },
  { key: 'pending_payment', label: 'Paiement', icon: Clock, count: null },
  { key: 'paid', label: 'Payées', icon: CreditCard, count: null },
  { key: 'ready_for_pickup', label: 'Prêtes au retrait', icon: Package, count: null },
  { key: 'picked_up_confirmed', label: 'Retraits confirmés', icon: CheckCircle, count: null },
  { key: 'ready_for_delivery', label: 'Prêtes à livrer', icon: Package, count: null },
  { key: 'out_for_delivery', label: 'En livraison', icon: Truck, count: null },
  { key: 'delivery_proof_submitted', label: 'Preuve soumise', icon: ClipboardList, count: null },
  { key: 'confirmed_by_client', label: 'Confirmées client', icon: CheckCircle, count: null },
  { key: 'pending', label: 'En attente', icon: Clock, count: null },
  { key: 'pending_installment', label: 'Vente à confirmer', icon: Receipt, count: null },
  { key: 'installment_active', label: 'Tranches actives', icon: CreditCard, count: null },
  { key: 'overdue_installment', label: 'Tranches en retard', icon: AlertCircle, count: null },
  { key: 'confirmed', label: 'Confirmées', icon: Package, count: null },
  { key: 'delivering', label: 'En livraison', icon: Truck, count: null },
  { key: 'delivered', label: 'Livrées', icon: CheckCircle, count: null },
  { key: 'completed', label: 'Paiement terminé', icon: CheckCircle, count: null },
  { key: 'cancelled', label: 'Annulées', icon: X, count: null }
];

const PAGE_SIZE = 6;
const ACTIVE_LIVE_STATUSES = new Set([
  'pending_payment',
  'paid',
  'ready_for_pickup',
  'ready_for_delivery',
  'out_for_delivery',
  'delivery_proof_submitted',
  'pending',
  'pending_installment',
  'installment_active',
  'overdue_installment',
  'confirmed',
  'delivering'
]);

const SELLER_OFFLINE_QUEUEABLE_STATUSES = new Set([
  'confirmed',
  'ready_for_pickup',
  'ready_for_delivery',
  'delivering',
  'out_for_delivery'
]);

const normalizeStatusFilter = (value) => {
  if (!value) return 'all';
  const safe = String(value).trim();
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, safe) ? safe : 'all';
};

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

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const getFullPaymentBadgeStatus = (order) => {
  if (!order || order.paymentType === 'installment') return 'pending_payment';

  const rawStatus = String(order.status || '').toLowerCase();
  const paidAmount = Number(order.paidAmount || 0);

  if (rawStatus === 'cancelled') {
    return paidAmount > 0 ? 'paid' : 'pending_payment';
  }

  const paidStatuses = new Set([
    'paid',
    'ready_for_pickup',
    'picked_up_confirmed',
    'ready_for_delivery',
    'out_for_delivery',
    'delivery_proof_submitted',
    'confirmed_by_client',
    'confirmed',
    'delivering',
    'delivered',
    'completed'
  ]);

  return paidStatuses.has(rawStatus) ? 'paid' : 'pending_payment';
};

const getPickupCardStatus = (order) => {
  if (!order || order.paymentType === 'installment' || !resolvePickupOrder(order)) return null;
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
};

const isInstallmentFullyPaid = (order) => {
  if (String(order?.paymentType || '') !== 'installment') return false;
  const schedule = Array.isArray(order?.installmentPlan?.schedule) ? order.installmentPlan.schedule : [];
  if (!schedule.length) return false;
  return schedule.every((entry) => ['paid', 'waived'].includes(String(entry?.status || '')));
};

const getSellerTimelineStatus = (order) => {
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
    return rawStatus || 'pending_installment';
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

const dedupeOrders = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((entry) => {
    const id = String(entry?._id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const applyRealtimeStatusPatch = (order, payload = {}) => {
  if (!order || typeof order !== 'object') return order;
  if (String(order._id || '') !== String(payload.orderId || '')) return order;
  const next = { ...order };
  const assignIfPresent = (key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      next[key] = payload[key];
    }
  };
  assignIfPresent('status');
  assignIfPresent('installmentSaleStatus');
  assignIfPresent('platformDeliveryStatus');
  assignIfPresent('platformDeliveryRequestId');
  assignIfPresent('deliveryStatus');
  assignIfPresent('currentStage');
  assignIfPresent('outForDeliveryAt');
  assignIfPresent('shippedAt');
  assignIfPresent('deliverySubmittedAt');
  assignIfPresent('deliveryDate');
  assignIfPresent('deliveredAt');
  assignIfPresent('clientDeliveryConfirmedAt');
  assignIfPresent('updatedAt');
  return next;
};

const patchOrdersListPayload = (payload, nextOrder) => {
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
};

const OrderProgress = ({ status }) => {
  const { t } = useAppSettings();
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-neutral-900">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{t('orders.tracking', 'Suivi de commande')}</h3>
      </div>
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200">
          <div
            className="absolute top-0 left-0 w-full bg-neutral-900 transition-all duration-500"
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
              amber: 'bg-neutral-700',
              blue: 'bg-neutral-700',
              emerald: 'bg-neutral-700',
              red: 'bg-neutral-700'
            };
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
                  <Icon className="w-4 h-4" />
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
                  <p className={`text-xs ${reached ? 'text-gray-600' : 'text-gray-400'}`}>
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

// Compact order summary card - links to seller order detail page
const SellerOrderSummaryCard = ({ order }) => {
  const { t } = useAppSettings();
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const computedTotal = orderItems.reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const isInstallmentOrder = order.paymentType === 'installment';
  const installmentPlan = isInstallmentOrder ? order.installmentPlan || {} : null;
  const installmentTotal = Number(installmentPlan?.totalAmount ?? totalAmount);
  const installmentPaid = Number(installmentPlan?.amountPaid || 0);
  const installmentSaleStatus =
    isInstallmentOrder && order.status === 'completed'
      ? order.installmentSaleStatus || 'confirmed'
      : order.installmentSaleStatus || '';
  const installmentProgress =
    installmentTotal > 0 ? Math.min(100, Math.round((installmentPaid / installmentTotal) * 100)) : 0;
  const fullPaymentBadgeStatus = getFullPaymentBadgeStatus(order);
  const pickupCardStatus = getPickupCardStatus(order);
  const statusBadgeKey = pickupCardStatus || order.status;
  const firstItem = orderItems[0];
  const productTitle = firstItem?.snapshot?.title || t('orders.product', 'Produit');
  const itemCount = orderItems.length;
  const customerName = order.customer?.name || t('orders.customer', 'Client');

  return (
    <Link
      to={`/seller/orders/detail/${order._id}`}
      className="ui-card ui-card-interactive ui-card-fade-in group block overflow-hidden transition hover:bg-neutral-50 dark:hover:bg-neutral-900/80"
    >
      <div className="ui-card-soft-separator flex items-center justify-between px-4 py-3 bg-gray-50/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-semibold text-gray-900 truncate">{customerName}</span>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
        <StatusBadge status={statusBadgeKey} />
      </div>
      <div className="p-4 flex gap-3">
        {firstItem?.snapshot?.image ? (
          <div className="ui-media-frame ui-media-frame-square h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0">
            <img
              src={firstItem.snapshot.image}
              alt={productTitle}
              className="ui-media-img ui-media-img-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <div className="ui-media-frame ui-media-frame-square w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center flex-shrink-0">
            <Package className="w-8 h-8 text-neutral-800" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm line-clamp-2">{productTitle}</p>
          {itemCount > 1 && <p className="text-xs text-gray-500 mt-0.5">+{itemCount - 1} autre{itemCount > 2 ? 's' : ''}</p>}
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <span>{formatCurrency(firstItem?.snapshot?.price ?? 0)}</span>
            <span className="text-gray-400">×</span>
            <span>{firstItem?.quantity ?? 1}</span>
          </div>
          <SelectedAttributesList
            selectedAttributes={firstItem?.selectedAttributes}
            compact
            className="mt-2"
          />
          {isInstallmentOrder && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-neutral-700">
                {t('orders.installment', 'Tranche')}: {installmentProgress}% {t('orders.validated', 'validé')}
              </p>
              <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-neutral-900"
                  style={{ width: `${installmentProgress}%` }}
                />
              </div>
              {order.status === 'completed' && (
                <p className="text-[11px] text-gray-500">
                  {t('orders.saleStatus', 'Statut vente')}: {INSTALLMENT_SALE_STATUS_LABELS[installmentSaleStatus] || t('orders.confirmedFeminine', 'Confirmée')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          {isInstallmentOrder ? (
            <StatusBadge paymentType="installment" compact />
          ) : (
            <StatusBadge status={fullPaymentBadgeStatus} compact />
          )}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
            <span className="text-neutral-800 font-medium text-sm flex items-center gap-0.5">{t('orders.viewDetail', 'Voir le détail')} <ChevronRight className="w-4 h-4" /></span>
          </div>
        </div>
        {Number(order.deliveryFeeTotal ?? 0) > 0 && (
          <p className="text-xs text-gray-500">
            {t('orders.deliveryFee', 'Frais de livraison')}: {formatCurrency(order.deliveryFeeTotal)}
          </p>
        )}
      </div>
    </Link>
  );
};

// Mobile Order Tracking Card for Sellers - App-style tracking UI
const SellerMobileOrderCard = ({
  order,
  onStatusUpdate,
  onOpenCancelModal,
  statusUpdatingId,
  statusUpdateError,
  statusUpdateUiPhase = 'idle',
  orderUnreadCounts,
  externalLinkProps
}) => {
  const { t } = useAppSettings();
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const itemCount = orderItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const computedTotal = orderItems.reduce((sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const isPickupOrder = resolvePickupOrder(order);
  const isInstallmentOrder = String(order?.paymentType || '') === 'installment';
  const installmentSaleStatus = String(order?.installmentSaleStatus || 'confirmed');
  const installmentFullyPaid = isInstallmentFullyPaid(order);
  const pickupCardStatus = getPickupCardStatus(order);
  const statusLabelKey = pickupCardStatus || order.status;
  const pickupShopAddress = isPickupOrder ? getPickupShopAddress(order) : null;
  const normalizedStatus = (() => {
    const value = String(order.status || '').toLowerCase();
    if (value === 'cancelled') return 'cancelled';
    if (['picked_up_confirmed', 'delivered', 'delivery_proof_submitted', 'confirmed_by_client', 'completed'].includes(value)) return 'delivered';
    if (['ready_for_pickup', 'delivering', 'out_for_delivery'].includes(value)) return 'delivering';
    if (['confirmed', 'ready_for_delivery'].includes(value)) return 'confirmed';
    return 'pending';
  })();

  // Progress percentage based on status
  const progressMap = { pending: 25, confirmed: 50, delivering: 75, delivered: 100, cancelled: 0 };
  const progress = progressMap[normalizedStatus] || 0;

  // Status colors
  const statusColors = {
    pending: { bg: 'bg-neutral-500 dark:bg-neutral-300', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', border: 'border-neutral-200 dark:border-neutral-700' },
    confirmed: { bg: 'bg-neutral-600 dark:bg-neutral-300', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    delivering: { bg: 'bg-neutral-700 dark:bg-neutral-200', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    delivered: { bg: 'bg-neutral-800 dark:bg-neutral-200', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-900 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    cancelled: { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  };
  const colors = statusColors[normalizedStatus] || statusColors.pending;

  // Timeline steps with timestamps
  const timelineSteps = [
    { id: 'pending', label: 'Passée', icon: ClipboardList, time: order.createdAt },
    { id: 'confirmed', label: 'Confirmée', icon: Package, time: order.confirmedAt },
    {
      id: 'delivering',
      label: isPickupOrder ? 'Prête au retrait' : 'Expédiée',
      icon: isPickupOrder ? Store : Truck,
      time: isPickupOrder
        ? order.readyForPickupAt || order.shippedAt || order.updatedAt
        : order.outForDeliveryAt || order.shippedAt
    },
    {
      id: 'delivered',
      label: isPickupOrder ? 'Retirée' : 'Livrée',
      icon: CheckCircle,
      time: order.completedAt || order.clientDeliveryConfirmedAt || order.deliveredAt
    }
  ];

  const statusIndex = ['pending', 'confirmed', 'delivering', 'delivered'].indexOf(normalizedStatus);
  const isCancelled = order.status === 'cancelled';
  const canUpdateStatus =
    !isCancelled &&
    !['delivered', 'picked_up_confirmed'].includes(String(order.status || '').toLowerCase()) &&
    !order.cancellationWindow?.isActive &&
    (!isInstallmentOrder || installmentFullyPaid);

  const formatTime = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
      {/* Header with Progress Circle */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Circular Progress */}
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle
                  cx="28" cy="28" r="24"
                  stroke={isCancelled ? '#ef4444' : '#0a0a0a'}
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 150.8} 150.8`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-900">{progress}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{t('orders.order', 'Commande')}</p>
              <h3 className="text-lg font-bold text-gray-900">#{order._id.slice(-6)}</h3>
              <p className="text-xs text-gray-500">{itemCount} article{itemCount > 1 ? 's' : ''} • {formatCurrency(totalAmount)}</p>
              {Number(order.deliveryFeeTotal ?? 0) > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">{t('orders.deliveryFee', 'Frais de livraison')}: {formatCurrency(order.deliveryFeeTotal)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className={`mx-4 mt-4 p-4 rounded-2xl ${colors.light} ${colors.border} border`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isCancelled ? (
              <X className={`w-5 h-5 ${colors.text}`} />
            ) : (
              <div className={`w-2 h-2 rounded-full ${colors.bg} animate-pulse`} />
            )}
            <span className={`font-semibold ${colors.text}`}>
              {STATUS_LABELS[statusLabelKey] || statusLabelKey}
            </span>
          </div>
          {order.deliveryGuy && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <div className="h-5 w-5 overflow-hidden rounded-full bg-gray-200">
                {resolveDeliveryGuyProfileImage(order.deliveryGuy) ? (
                  <img
                    src={resolveDeliveryGuyProfileImage(order.deliveryGuy)}
                    alt={order.deliveryGuy.name || 'Livreur'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-gray-600">
                    {String(order.deliveryGuy.name || 'L').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <Truck className="h-3.5 w-3.5" />
              <span>{order.deliveryGuy.name}</span>
            </div>
          )}
        </div>

        {/* Progress Dots */}
        {!isCancelled && (
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  step <= statusIndex ? colors.bg : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delivery Code - Prominent display */}
      {order.deliveryCode && order.status !== 'cancelled' && (
        <div className="mx-4 mt-3 p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-800 uppercase tracking-wide">{t('orders.deliveryCode', 'Code de livraison')}</p>
              <p className="text-3xl font-black text-neutral-900 tracking-widest font-mono mt-1">
                {order.deliveryCode}
              </p>
            </div>
            <ShieldCheck className="w-10 h-10 text-neutral-500" />
          </div>
        </div>
      )}

      {/* Customer Info */}
      <div className="mx-4 mt-3 p-4 rounded-2xl bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('orders.customer', 'Client')}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900">{order.customer?.name || t('orders.customer', 'Client')}</p>
        {order.customer?.phone && (
          <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1 text-xs text-neutral-800 mt-1">
            <Phone className="w-3 h-3" />
            <span>{order.customer.phone}</span>
          </a>
        )}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{isPickupOrder ? (pickupShopAddress?.addressLine || 'Adresse boutique non renseignée') : (order.deliveryAddress || 'Adresse non renseignée')}</span>
          </div>
          <p className="text-xs text-gray-400 ml-4">{isPickupOrder ? (pickupShopAddress?.cityLine || '') : (order.deliveryCity || '')}</p>
        </div>
      </div>

      {/* Timeline */}
      {!isCancelled && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('orders.tracking', 'Suivi')}</span>
          </div>
          <AnimatedOrderTimeline
            status={getSellerTimelineStatus(order)}
            paymentType={order.paymentType}
            deliveryMode={order.deliveryMode}
            className="border-gray-100 shadow-none"
          />
        </div>
      )}

      {/* Cancelled Status */}
      {isCancelled && (
        <div className="mx-4 my-4 p-4 rounded-2xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-800">{t('orders.cancelledOrder', 'Commande annulée')}</p>
              {order.cancellationReason && (
                <p className="text-sm text-red-600 mt-1">{order.cancellationReason}</p>
              )}
              {order.cancelledAt && (
                <p className="text-xs text-red-500 mt-1">
                  {formatOrderTimestamp(order.cancelledAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Window Warning */}
      {order.cancellationWindow?.isActive && order.status !== 'cancelled' && (
        <div className="mx-4 mt-3 p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <CancellationTimer
            deadline={order.cancellationWindow.deadline}
            remainingMs={order.cancellationWindow.remainingMs}
            isActive={order.cancellationWindow.isActive}
          />
          <p className="text-xs text-neutral-700 mt-2">
            ⏱️ {t('orders.cancelWindowActive', "Délai d'annulation client actif. Modifications temporairement désactivées.")}
          </p>
        </div>
      )}

      {/* Products Preview - Collapsible */}
      <div className="px-4 pb-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">{t('orders.articles', 'Articles')} ({itemCount})</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-3 space-y-2">
            {orderItems.slice(0, 3).map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                {item.snapshot?.image || item.product?.images?.[0] ? (
                  <img
                    src={item.snapshot?.image || item.product?.images?.[0]}
                    alt={item.snapshot?.title || t('orders.product', 'Produit')}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-neutral-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.snapshot?.title || t('orders.product', 'Produit')}</p>
                  <p className="text-xs text-gray-500">{t('orders.qty', 'Qté')}: {item.quantity || 1} • {formatCurrency(item.snapshot?.price || 0)}</p>
                  <SelectedAttributesList
                    selectedAttributes={item.selectedAttributes}
                    compact
                    className="mt-1"
                  />
                </div>
              </div>
            ))}
            {orderItems.length > 3 && (
              <p className="text-xs text-gray-500 text-center py-2">+{orderItems.length - 3} autre(s) article(s)</p>
            )}
          </div>
        </details>
      </div>

      {/* Payment Summary */}
      <div className="mx-4 mb-4 p-4 rounded-xl bg-gray-50">
        {Number(order.deliveryFeeTotal ?? 0) > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('orders.deliveryFee', 'Frais de livraison')}</span>
            <span className="text-sm font-medium text-gray-900">{formatCurrency(order.deliveryFeeTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{t('orders.total', 'Total')}</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
        </div>
        {paidAmount > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('orders.depositPaid', 'Acompte versé')}</span>
              <span className="font-medium text-neutral-600">{formatCurrency(paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('orders.remaining', 'Reste à payer')}</span>
              <span className="font-medium text-neutral-600">{formatCurrency(remainingAmount)}</span>
            </div>
          </>
        )}
      </div>

      {/* Status Update Actions */}
      {canUpdateStatus && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('orders.actions', 'Actions')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {isInstallmentOrder ? (
              <>
                <button
                  type="button"
                  onClick={() => onStatusUpdate(order._id, 'delivering')}
                  disabled={
                    !installmentFullyPaid ||
                    installmentSaleStatus !== 'confirmed' ||
                    statusUpdatingId === order._id
                  }
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Truck className="w-4 h-4" />
                  En livraison
                </button>
                <button
                  type="button"
                  onClick={() => onStatusUpdate(order._id, 'delivered')}
                  disabled={
                    !installmentFullyPaid ||
                    installmentSaleStatus !== 'delivering' ||
                    statusUpdatingId === order._id
                  }
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('orders.delivered', 'Livrée')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onStatusUpdate(order._id, 'confirmed')}
                  disabled={!['pending', 'pending_payment', 'paid'].includes(String(order.status || '').toLowerCase()) || statusUpdatingId === order._id}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Package className="w-4 h-4" />
                  {t('orders.confirm', 'Confirmer')}
                </button>
                <button
                  type="button"
                  onClick={() => onStatusUpdate(order._id, isPickupOrder ? 'ready_for_pickup' : 'delivering')}
                  disabled={
                    (isPickupOrder
                      ? !['confirmed'].includes(String(order.status || '').toLowerCase())
                      : !['confirmed', 'ready_for_delivery'].includes(String(order.status || '').toLowerCase())) ||
                    statusUpdatingId === order._id
                  }
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isPickupOrder ? <Package className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                  {isPickupOrder ? 'Prête au retrait' : t('orders.ship', 'Expédier')}
                </button>
                <button
                  type="button"
                  onClick={() => onStatusUpdate(order._id, isPickupOrder ? 'picked_up_confirmed' : 'delivered')}
                  disabled={
                    (isPickupOrder
                      ? !['confirmed', 'ready_for_pickup'].includes(String(order.status || '').toLowerCase())
                      : !['delivering', 'out_for_delivery'].includes(String(order.status || '').toLowerCase())) ||
                    statusUpdatingId === order._id
                  }
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isPickupOrder ? 'Retrait confirmé' : t('orders.delivered', 'Livrée')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onOpenCancelModal(order._id)}
              disabled={statusUpdatingId === order._id}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <X className="w-4 h-4" />
              {t('common.cancel', 'Annuler')}
            </button>
          </div>
          {statusUpdateError.id === order._id && (
            <p className={`mt-2 text-center text-xs ${statusUpdateError.tone === 'warning' ? 'text-amber-700' : 'text-red-600'}`}>
              {statusUpdateError.message}
            </p>
          )}
          {statusUpdatingId === order._id && statusUpdateUiPhase === 'slow' && statusUpdateError.id !== order._id && (
            <p className="mt-2 text-center text-xs text-amber-700">
              Réseau lent. Vérification automatique en cours. Vérifiez le statut avant de renvoyer.
            </p>
          )}
        </div>
      )}

      {/* Chat Button */}
      <div className="px-4 pb-4">
        <OrderChat
          order={order}
          buttonText={t('orders.contactBuyer', "Contacter l'acheteur")}
          unreadCount={orderUnreadCounts[order._id] || 0}
        />
      </div>
    </div>
  );
};

export default function SellerOrders() {
  const { user } = useContext(AuthContext);
  const { t } = useAppSettings();
  const { showToast } = useToast();
  const { shouldUseOfflineSnapshot } = useNetworkProfile();
  const queryClient = useQueryClient();
  const externalLinkProps = useDesktopExternalLink();
  const isMobile = useIsMobile(768);
  const userScopeId = useMemo(() => String(user?._id || user?.id || '').trim(), [user?._id, user?.id]);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState({ id: '', message: '', tone: 'error' });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [queuedStatusActionCount, setQueuedStatusActionCount] = useState(0);
  const [statusQueueSyncing, setStatusQueueSyncing] = useState(false);
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, byStatus: {} });
  const [statsLoading, setStatsLoading] = useState(false);
  const [installmentAnalytics, setInstallmentAnalytics] = useState({
    totalInstallmentSales: 0,
    revenueInProgress: 0,
    collectedAmount: 0,
    riskExposure: 0,
    overdueOrders: 0,
    completedOrders: 0
  });
  const [installmentAnalyticsLoading, setInstallmentAnalyticsLoading] = useState(false);
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});
  const { status: statusParam } = useParams();
  const [activeStatus, setActiveStatus] = useState(() => normalizeStatusFilter(statusParam));
  const [initialLoadingDone, setInitialLoadingDone] = useState(false);

  useEffect(() => {
    const normalizedStatus = normalizeStatusFilter(statusParam);
    setActiveStatus((currentStatus) =>
      currentStatus === normalizedStatus ? currentStatus : normalizedStatus
    );
    setPage(1);
  }, [statusParam]);

  const sellerOrdersListQuery = useSellerOrdersListQuery({
    page,
    limit: PAGE_SIZE,
    status: activeStatus,
    enabled: Boolean(user?._id || user?.id)
  });

  const mergeOrderUpdate = useCallback(
    (updatedOrder) => {
      if (!updatedOrder?._id) return;
      setOrders((prev) => {
        const patched = dedupeOrders(
          prev.map((entry) =>
            String(entry?._id || '') === String(updatedOrder._id) ? updatedOrder : entry
          )
        );
        if (activeStatus === 'all') return patched;
        return patched.filter(
          (entry) => String(entry?.status || '').trim() === String(activeStatus).trim()
        );
      });

      queryClient.setQueriesData(
        { queryKey: orderQueryKeys.listRoot('seller') },
        (existing) => patchOrdersListPayload(existing, updatedOrder)
      );

      queryClient.setQueryData(
        orderQueryKeys.detail('seller', String(updatedOrder._id)),
        (existing) => ({
          ...(existing || {}),
          order: updatedOrder,
          unreadCount: Number(existing?.unreadCount || 0)
        })
      );
    },
    [activeStatus, queryClient]
  );

  const invalidateOrderItem = useCallback(
    async (orderId) => {
      if (!orderId) return;
      await queryClient.invalidateQueries({
        queryKey: orderQueryKeys.detail('seller', String(orderId)),
        refetchType: 'inactive'
      });
      await queryClient.invalidateQueries({
        queryKey: orderQueryKeys.list('seller', {
          page,
          limit: PAGE_SIZE,
          status: activeStatus
        }),
        refetchType: 'active'
      });
    },
    [activeStatus, page, queryClient]
  );

  const refreshOrders = useCallback(async () => {
    await sellerOrdersListQuery.refetch();
  }, [sellerOrdersListQuery.refetch]);

  const syncQueuedStatusActionCount = useCallback(async () => {
    if (!userScopeId) {
      setQueuedStatusActionCount(0);
      return;
    }
    const queue = await loadOrderStatusOfflineQueue(userScopeId, 'seller');
    setQueuedStatusActionCount(queue.length);
  }, [userScopeId]);

  const normalizeOrderPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    if (payload?.order && payload.order._id) return payload.order;
    if (payload?._id) return payload;
    return null;
  };

  const getStatusCounterValue = (order) => {
    if (!order) return 'pending';
    return String(
      String(order?.paymentType || '') === 'installment' &&
        String(order?.status || '') === 'completed'
        ? order?.installmentSaleStatus || order?.status || 'pending'
        : order?.status || 'pending'
    );
  };

  const bumpStatusCounters = useCallback((previousStatus, nextStatus) => {
    const prev = String(previousStatus || '').trim();
    const next = String(nextStatus || '').trim();
    if (!prev || !next || prev === next) return;
    setStats((s) => ({
      ...s,
      byStatus: {
        ...s.byStatus,
        [prev]: Math.max(0, (s.byStatus[prev] || 1) - 1),
        [next]: (s.byStatus[next] || 0) + 1
      }
    }));
  }, []);

  const { pullDistance, refreshing, bind } = usePullToRefresh(refreshOrders, {
    enabled: isMobile
  });

  useEffect(() => {
    if (!sellerOrdersListQuery.data) return;
    const items = Array.isArray(sellerOrdersListQuery.data.items)
      ? dedupeOrders(sellerOrdersListQuery.data.items)
      : [];
    setOrders(items);
    setMeta({
      total: Number(sellerOrdersListQuery.data.total || items.length),
      totalPages: Math.max(1, Number(sellerOrdersListQuery.data.totalPages || 1))
    });
    const incomingPage = Number(sellerOrdersListQuery.data.page || page);
    if (Number.isFinite(incomingPage) && incomingPage > 0 && incomingPage !== page) {
      setPage(incomingPage);
    }
    if (!initialLoadingDone) {
      setInitialLoadingDone(true);
    }
  }, [initialLoadingDone, page, sellerOrdersListQuery.data]);

  const hasActiveOrders = useMemo(
    () =>
      orders.some((order) => ACTIVE_LIVE_STATUSES.has(String(order?.status || '').trim())),
    [orders]
  );

  useOrderRealtimeSync({
    scope: 'seller',
    enabled: Boolean(user?._id || user?.id),
    pollIntervalMs: 15000,
    currentStatus: hasActiveOrders ? 'pending_payment' : 'delivered'
  });

  const flushQueuedStatusActions = useCallback(async () => {
    if (!userScopeId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let queue = await loadOrderStatusOfflineQueue(userScopeId, 'seller');
    setQueuedStatusActionCount(queue.length);
    if (!queue.length) return;
    setStatusQueueSyncing(true);
    try {
      for (const action of queue) {
        const prevOrder = orders.find((entry) => String(entry?._id || '') === String(action?.orderId || ''));
        try {
          const { data } = await api.patch(
            `/orders/seller/${action.orderId}/status`,
            { status: action.nextStatus },
            {
              headers: {
                'Idempotency-Key': action.idempotencyKey || createIdempotencyKey('seller-status-replay')
              }
            }
          );
          const nextOrder = normalizeOrderPayload(data);
          if (nextOrder?._id) {
            mergeOrderUpdate(nextOrder);
            bumpStatusCounters(getStatusCounterValue(prevOrder), getStatusCounterValue(nextOrder));
          }
          queue = await removeOrderStatusOfflineAction(userScopeId, 'seller', action.queueId);
          setQueuedStatusActionCount(queue.length);
          window.dispatchEvent(new Event('hdmarket:orders-refresh'));
        } catch (error) {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            break;
          }
          showToast(
            error?.response?.data?.message || 'Impossible de synchroniser certains changements de statut.',
            { variant: 'error' }
          );
          break;
        }
      }
    } finally {
      setStatusQueueSyncing(false);
      await sellerOrdersListQuery.refetch();
    }
  }, [
    bumpStatusCounters,
    mergeOrderUpdate,
    orders,
    sellerOrdersListQuery.refetch,
    showToast,
    userScopeId
  ]);

  useEffect(() => {
    syncQueuedStatusActionCount();
    const handleQueueChange = () => {
      syncQueuedStatusActionCount();
    };
    window.addEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    };
  }, [syncQueuedStatusActionCount]);

  useEffect(() => {
    if (!userScopeId) return;
    if (!shouldUseOfflineSnapshot) {
      flushQueuedStatusActions();
    }
    const handleOnline = () => {
      flushQueuedStatusActions();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushQueuedStatusActions, shouldUseOfflineSnapshot, userScopeId]);

  useEffect(() => {
    const onStatusUpdated = (event) => {
      const payload = event?.detail || {};
      const incomingOrderId = String(payload?.orderId || '').trim();
      if (!incomingOrderId) return;
      setOrders((prev) => {
        const patched = dedupeOrders(
          prev.map((entry) => applyRealtimeStatusPatch(entry, payload))
        );
        if (activeStatus === 'all') return patched;
        return patched.filter(
          (entry) => String(entry?.status || '').trim() === String(activeStatus).trim()
        );
      });
    };

    window.addEventListener('hdmarket:orders-status-updated', onStatusUpdated);
    return () =>
      window.removeEventListener('hdmarket:orders-status-updated', onStatusUpdated);
  }, [activeStatus]);

  // Load order statistics
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data } = await api.get('/orders/seller?limit=1000');
        if (!active) return;
        const rawOrders = Array.isArray(data) ? data : data?.items || [];
        // Deduplicate orders by _id
        const seenIds = new Set();
        const allOrders = rawOrders.filter((order) => {
          if (!order?._id || seenIds.has(order._id)) return false;
          seenIds.add(order._id);
          return true;
        });
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

  useEffect(() => {
    let active = true;
    const loadInstallmentAnalytics = async () => {
      setInstallmentAnalyticsLoading(true);
      try {
        const { data } = await api.get('/orders/seller/installment/analytics');
        if (!active) return;
        setInstallmentAnalytics({
          totalInstallmentSales: Number(data?.totalInstallmentSales || 0),
          revenueInProgress: Number(data?.revenueInProgress || 0),
          collectedAmount: Number(data?.collectedAmount || 0),
          riskExposure: Number(data?.riskExposure || 0),
          overdueOrders: Number(data?.overdueOrders || 0),
          completedOrders: Number(data?.completedOrders || 0)
        });
      } catch (err) {
        console.error('Error loading installment analytics:', err);
      } finally {
        if (active) setInstallmentAnalyticsLoading(false);
      }
    };
    loadInstallmentAnalytics();
    return () => {
      active = false;
    };
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
    if (!orders.length || !user?._id) {
      setOrderUnreadCounts({});
      return;
    }
    let active = true;
    const run = async () => {
      const orderIds = orders.map((order) => order._id).filter(Boolean);
      const unreadCounts = await loadUnreadCounts(orderIds);
      if (active) {
        setOrderUnreadCounts(unreadCounts);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [orders, user?._id]);

  const openCancelModal = useCallback((orderId) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setCancelModalOpen(true);
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelModalOpen(false);
    setCancelOrderId(null);
    setCancelReason('');
  }, []);

  const matchesSellerTargetStatus = (order, nextStatus) => {
    if (!order || !nextStatus) return false;
    const normalizedTarget = String(nextStatus || '');
    const isInstallmentCompleted =
      String(order?.paymentType || '') === 'installment' &&
      String(order?.status || '') === 'completed';
    if (isInstallmentCompleted) {
      return String(order?.installmentSaleStatus || '') === normalizedTarget;
    }
    return String(order?.status || '') === normalizedTarget;
  };

  const statusUpdateMutation = useReliableMutation({
    mutationFn: async ({ orderId, nextStatus, idempotencyKey }) => {
      const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
      const canQueueOffline =
        shouldUseOfflineSnapshot &&
        userScopeId &&
        SELLER_OFFLINE_QUEUEABLE_STATUSES.has(normalizedStatus);
      if (canQueueOffline) {
        const queue = await enqueueOrderStatusOfflineAction(userScopeId, 'seller', {
          queueId: createIdempotencyKey('seller-status-queue'),
          orderId,
          nextStatus,
          idempotencyKey: idempotencyKey || createIdempotencyKey('seller-status')
        });
        return {
          queued: true,
          queueLength: queue.length,
          orderId,
          nextStatus
        };
      }
      const { data } = await api.patch(
        `/orders/seller/${orderId}/status`,
        { status: nextStatus },
        {
          silentGlobalError: true,
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      return data;
    },
    verifyFn: async ({ orderId, nextStatus }) => {
      if (!orderId || !nextStatus) return false;
      const { data } = await api.get(`/orders/seller/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      return matchesSellerTargetStatus(data, nextStatus) ? data : false;
    },
    onMutate: ({ orderId, nextStatus }) => {
      const prevOrder = orders.find((order) => String(order?._id) === String(orderId));
      if (prevOrder && nextStatus) {
        const optimisticOrder =
          String(prevOrder?.paymentType || '') === 'installment' &&
          String(prevOrder?.status || '') === 'completed'
            ? { ...prevOrder, installmentSaleStatus: nextStatus, updatedAt: new Date().toISOString() }
            : { ...prevOrder, status: nextStatus, updatedAt: new Date().toISOString() };
        mergeOrderUpdate(optimisticOrder);
      }
      return {
        prevStatus: getStatusCounterValue(prevOrder),
        prevOrder
      };
    },
    onSuccess: async (result, variables, context) => {
      if (result?.data?.queued) {
        setQueuedStatusActionCount(Number(result?.data?.queueLength || 0));
        showToast('Statut enregistré hors ligne. Synchronisation automatique dès le retour du réseau.', {
          variant: 'info'
        });
        return;
      }
      const nextOrder = normalizeOrderPayload(result?.data);
      if (nextOrder?._id) {
        mergeOrderUpdate(nextOrder);
        bumpStatusCounters(context?.prevStatus, getStatusCounterValue(nextOrder));
      }
      showToast(
        result?.recovered ? 'Statut de la commande mis à jour après vérification automatique.' : 'Statut de la commande mis à jour.',
        { variant: 'success' }
      );
    },
    onError: async (err, variables, context) => {
      if (context?.possiblyCommitted) {
        const message = 'Réseau lent ou interrompu. Vérification automatique en cours avant tout renvoi.';
        setStatusUpdateError({ id: variables?.orderId || '', message, tone: 'warning' });
        showToast(message, { variant: 'info' });
        return;
      }
      if (context?.prevOrder?._id) {
        mergeOrderUpdate(context.prevOrder);
      }
      const message =
        err?.response?.data?.message || 'Impossible de mettre à jour le statut.';
      setStatusUpdateError({ id: variables?.orderId || '', message, tone: 'error' });
      showToast(message, { variant: 'error' });
    },
    onSettled: async (data, _error, variables) => {
      if (data?.data?.queued) return;
      await invalidateOrderItem(variables?.orderId);
    }
  });

  const cancelOrderMutation = useReliableMutation({
    mutationFn: async ({ orderId, reason, idempotencyKey }) => {
      const { data } = await api.post(
        `/orders/seller/${orderId}/cancel`,
        { reason },
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
      const { data } = await api.get(`/orders/seller/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      return String(data?.status || '') === 'cancelled' ? data : false;
    },
    onMutate: ({ orderId }) => {
      const prevOrder = orders.find((order) => String(order?._id) === String(orderId));
      return {
        prevStatus: String(prevOrder?.status || 'pending')
      };
    },
    onSuccess: async (result, variables, context) => {
      const nextOrder = normalizeOrderPayload(result?.data);
      if (nextOrder?._id) {
        mergeOrderUpdate(nextOrder);
        bumpStatusCounters(context?.prevStatus, 'cancelled');
      }
      showToast(
        result?.recovered
          ? t('orders.cancelRecovered', 'Commande annulée après vérification automatique.')
          : t('orders.cancelSuccess', 'Commande annulée avec succès. Le client a été notifié.'),
        { variant: 'success' }
      );
      closeCancelModal();
    },
    onError: async (err, _variables, context) => {
      if (context?.possiblyCommitted) {
        showToast('Réseau lent ou interrompu. Vérification automatique en cours avant tout renvoi.', {
          variant: 'info'
        });
        closeCancelModal();
        return;
      }
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.details?.[0] ||
        t('orders.cancelError', "Impossible d'annuler la commande.");
      showToast(message, { variant: 'error' });
    },
    onSettled: async (_data, _error, variables) => {
      await invalidateOrderItem(variables?.orderId);
    }
  });

  const handleStatusUpdate = async (orderId, nextStatus) => {
    setStatusUpdatingId(orderId);
    setStatusUpdateError({ id: '', message: '', tone: 'error' });
    try {
      await statusUpdateMutation.mutateAsync({ orderId, nextStatus });
    } catch {
      // handled by mutation callbacks
    } finally {
      setStatusUpdatingId('');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) return;
    
    // Validate reason before submitting
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      showToast('Veuillez fournir une raison d\'annulation (minimum 5 caractères).', { variant: 'error' });
      return;
    }
    
    try {
      await cancelOrderMutation.mutateAsync({ orderId: cancelOrderId, reason: trimmedReason });
    } catch {
      // handled by mutation callbacks
    }
  };

  const emptyMessage =
    activeStatus === 'all'
      ? t('orders.noCustomerOrdersYet', 'Aucune commande client pour le moment.')
      : t('orders.noOrdersWithStatusYet', `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`);

  const loading = !initialLoadingDone && sellerOrdersListQuery.isLoading && orders.length === 0;
  const error =
    sellerOrdersListQuery.error?.response?.data?.message ||
    sellerOrdersListQuery.error?.message ||
    '';

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <GlassHeader title={t('orders.sellerTitle', 'Commandes vendeur')} subtitle={t('common.loading', 'Chargement...')} backTo="/" />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <OrderListSkeleton items={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950" {...bind}>
      {(pullDistance > 0 || refreshing) && (
        <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-neutral-900 py-2 text-white">
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${pullDistance * 2}deg)` }}
          />
          <span className="text-xs font-medium">
            {refreshing ? t('orders.refreshing', 'Actualisation...') : t('orders.pullDown', 'Tirez pour actualiser')}
          </span>
        </div>
      )}
      <GlassHeader
        title={t('orders.sellerTitle', 'Commandes vendeur')}
        subtitle={t('orders.sellerSubtitle', 'Suivi, livraison et validation')}
        backTo="/"
        right={
          <Link
            to="/stats"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {t('orders.stats', 'Stats')}
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {(queuedStatusActionCount > 0 || statusQueueSyncing) && (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 shadow-sm dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
            {statusQueueSyncing
              ? 'Synchronisation des changements de statut en attente...'
              : `${queuedStatusActionCount} changement${queuedStatusActionCount > 1 ? 's' : ''} de statut en attente de connexion.`}
          </div>
        )}
        {(user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager') && (
          <div className="mb-4">
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {t('orders.allAdminOrders', 'Toutes les commandes (admin)')}
            </Link>
          </div>
        )}
        {/* Statistics Cards */}
        {!statsLoading && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-900">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.totalOrders', 'Total commandes')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.allCustomerOrders', 'Toutes les commandes clients')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-700">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.revenue', "Chiffre d'affaires")}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.totalOrderAmount', 'Montant total des commandes')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-700">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.byStatus.pending || 0}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.pending', 'En attente')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.pendingHelp', 'Commandes en cours de traitement')}</p>
            </div>
          </div>
        )}

        {!installmentAnalyticsLoading && installmentAnalytics.totalInstallmentSales > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-900">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {installmentAnalytics.totalInstallmentSales}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.installmentSales', 'Ventes en tranche')}</p>
              <p className="text-xs text-gray-500 mt-1">
                Terminées: {installmentAnalytics.completedOrders} • Retard: {installmentAnalytics.overdueOrders}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-700">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(installmentAnalytics.revenueInProgress)}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.revenueInProgress', 'Revenus en cours')}</p>
              <p className="text-xs text-gray-500 mt-1">
                Déjà collecté: {formatCurrency(installmentAnalytics.collectedAmount)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-700">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(installmentAnalytics.riskExposure)}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.riskExposure', 'Exposition au risque')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.riskExposureHelp', 'Montant des commandes à risque.')}</p>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const isActive = tab.key === activeStatus;
              const Icon = tab.icon;
              const count = tab.key === 'all' ? stats.total : stats.byStatus[tab.key] || 0;
              
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (tab.key === activeStatus) return;
                    setActiveStatus(tab.key);
                    setPage(1);
                  }}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-lg scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
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
                <h3 className="text-sm font-bold text-red-800 mb-1">{t('orders.loadErrorTitle', 'Erreur de chargement')}</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <ClipboardList className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('orders.noOrders', 'Aucune commande')}</h3>
            <p className="text-sm text-gray-500 mb-6">{emptyMessage}</p>
            <Link
              to="/my"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 text-white font-semibold hover:bg-neutral-800 shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
              {t('orders.manageListings', 'Gérer mes annonces')}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {orders.map((order) => (
                <SellerOrderSummaryCard key={order._id} order={order} />
              ))}
            </div>

            {/* Cancel Order Modal */}
            <BaseModal
              isOpen={cancelModalOpen}
              onClose={closeCancelModal}
              size="md"
              mobileSheet
              ariaLabel={t('orders.cancelOrderTitle', 'Annuler la commande')}
            >
              <ModalHeader
                icon={<AlertCircle className="h-5 w-5" />}
                title={t('orders.cancelOrderTitle', 'Annuler la commande')}
                subtitle={`${t('orders.order', 'Commande')} #${cancelOrderId?.slice(-6) || '—'}`}
                onClose={closeCancelModal}
                closeLabel={t('common.cancel', 'Fermer')}
              />
              <ModalBody className="space-y-4">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-3">
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 mb-1">⚠️ {t('orders.warning', 'Attention')}</p>
                  <p className="text-xs text-neutral-700">
                    {t('orders.cancelOrderWarning', "Cette action est irréversible. Le client sera notifié de l'annulation.")}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {t('orders.cancelReason', "Raison de l'annulation")} <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t('orders.cancelReasonPlaceholder', "Expliquez la raison de l'annulation (minimum 5 caractères)...")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={4}
                    required
                    minLength={5}
                  />
                  {cancelReason.length > 0 && cancelReason.length < 5 && (
                    <p className="mt-1 text-xs text-red-600">
                      {t('orders.cancelReasonMinLength', 'La raison doit contenir au moins 5 caractères.')}
                    </p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeCancelModal}
                    disabled={cancelOrderMutation.isReliablePending}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('common.cancel', 'Annuler')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={
                      cancelOrderMutation.isReliablePending ||
                      !cancelReason.trim() ||
                      cancelReason.trim().length < 5
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-700 text-white text-sm font-semibold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelOrderMutation.isReliablePending
                      ? t('orders.cancelling', 'Annulation...')
                      : t('orders.confirmCancellation', "Confirmer l'annulation")}
                  </button>
                </div>
              </ModalFooter>
            </BaseModal>

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
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
