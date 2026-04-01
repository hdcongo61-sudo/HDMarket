import React, { useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { isApiPossiblyCommittedError } from '../services/api';
import {
  ClipboardList,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  ShieldCheck,
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Download,
  Eye,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Info,
  CreditCard,
  Receipt,
  Store,
  Sparkles,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight
} from 'lucide-react';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import EditAddressModal from '../components/EditAddressModal';
import OrderChat from '../components/OrderChat';
import GlassHeader from '../components/orders/GlassHeader';
import StatusBadge from '../components/orders/StatusBadge';
import { OrderListSkeleton } from '../components/orders/OrderSkeletons';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useAppSettings } from '../context/AppSettingsContext';
import { getPickupShopAddress, isPickupOrder } from '../utils/pickupAddress';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import useReliableMutation from '../hooks/useReliableMutation';
import useOrderRealtimeSync from '../hooks/useOrderRealtimeSync';
import useBuyerOrdersListQuery from '../hooks/useBuyerOrdersListQuery';
import { orderQueryKeys } from '../hooks/useOrderQueryKeys';
import { appAlert, appConfirm } from '../utils/appDialog';

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
  overdue_installment: 'Tranche en retard',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  completed: 'Paiement terminé',
  cancelled: 'Commande annulée'
};

const STATUS_STYLES = {
  pending: { header: 'bg-neutral-700', card: 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100' },
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

const normalizeStatusFilter = (value) => {
  if (!value) return 'all';
  const safe = String(value).trim();
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, safe) ? safe : 'all';
};

const ORDER_FLOW = [
  {
    id: 'pending',
    label: 'Commande en attente',
    description: 'Votre commande est enregistrée et en attente de validation par nos équipes.',
    icon: Clock,
    color: 'gray'
  },
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'Un gestionnaire a validé votre commande et prépare l\'expédition.',
    icon: Package,
    color: 'amber'
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le colis est pris en charge par le livreur et se dirige vers votre adresse.',
    icon: Truck,
    color: 'blue'
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée avec succès et archivée par nos équipes.',
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

const getEffectiveOrderStatus = (order) => {
  if (!order) return 'pending';
  if (order.paymentType === 'installment' && order.status === 'completed') {
    return order.installmentSaleStatus || 'confirmed';
  }
  const map = {
    pending_payment: 'pending',
    paid: 'confirmed',
    ready_for_delivery: 'confirmed',
    out_for_delivery: 'delivering',
    delivery_proof_submitted: 'delivered',
    confirmed_by_client: 'delivered'
  };
  return map[order.status] || order.status || 'pending';
};

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
  if (!order || order.paymentType === 'installment' || !isPickupOrder(order)) return null;
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
              emerald: 'bg-neutral-700'
            };
            
            return (
              <div key={step.id} className="flex items-start gap-4 relative">
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  reached
                    ? `${colorClasses[step.color]} border-transparent text-white shadow-lg scale-110`
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}>
                  <Icon size={16} />
                  {isCurrent && (
                    <div className={`absolute inset-0 rounded-full ${colorClasses[step.color]} animate-ping opacity-75`} />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClasses[step.color]} text-white`}>
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

// Mobile Order Tracking Card - App-style tracking UI
const MobileOrderTrackingCard = ({ order, onDownloadPdf, onEditAddress, onCancelOrder, onSkipWindow, onReorder, skipLoadingId, reordering, orderUnreadCounts }) => {
  const { t } = useAppSettings();
  const externalLinkProps = useDesktopExternalLink();
  const orderItems = order.items?.length ? order.items : order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }] : [];
  const itemCount = orderItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const computedTotal = orderItems.reduce((sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1), 0);
  const totalAmount = Number(order.totalAmount ?? computedTotal);
  const effectiveStatus = getEffectiveOrderStatus(order);
  const pickupCardStatus = getPickupCardStatus(order);
  const statusLabelKey = pickupCardStatus || effectiveStatus;
  const pickupOrder = isPickupOrder(order);
  const pickupShopAddress = pickupOrder ? getPickupShopAddress(order) : null;

  // Progress percentage based on status
  const progressMap = { pending: 25, confirmed: 50, delivering: 75, delivered: 100, cancelled: 0 };
  const progress = progressMap[effectiveStatus] || 0;

  // Status colors
  const statusColors = {
    pending: { bg: 'bg-neutral-500 dark:bg-neutral-300', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', border: 'border-neutral-200 dark:border-neutral-700' },
    confirmed: { bg: 'bg-neutral-600 dark:bg-neutral-300', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    delivering: { bg: 'bg-neutral-700 dark:bg-neutral-200', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    delivered: { bg: 'bg-neutral-800 dark:bg-neutral-200', light: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-900 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
    cancelled: { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  };
  const colors = statusColors[effectiveStatus] || statusColors.pending;

  // Timeline steps with timestamps
  const timelineSteps = [
    { id: 'pending', label: 'Passée', icon: ClipboardList, time: order.createdAt },
    { id: 'confirmed', label: 'Confirmée', icon: Package, time: order.confirmedAt },
    {
      id: 'delivering',
      label: pickupOrder ? 'Prête au retrait' : 'Expédiée',
      icon: pickupOrder ? Store : Truck,
      time: pickupOrder
        ? order.readyForPickupAt || order.shippedAt || order.updatedAt
        : order.outForDeliveryAt || order.shippedAt
    },
    {
      id: 'delivered',
      label: pickupOrder ? 'Retirée' : 'Livrée',
      icon: CheckCircle,
      time: order.completedAt || order.clientDeliveryConfirmedAt || order.deliveredAt
    }
  ];

  const statusIndex = ['pending', 'confirmed', 'delivering', 'delivered'].indexOf(effectiveStatus);
  const isCancelled = effectiveStatus === 'cancelled';

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
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDownloadPdf(order)}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
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
      {order.deliveryCode && effectiveStatus !== 'cancelled' && (
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

      {/* Timeline */}
      {!isCancelled && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('orders.tracking', 'Suivi')}</span>
          </div>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200">
              <div
                className="absolute top-0 left-0 w-full bg-neutral-900 transition-all duration-500"
                style={{ height: `${(statusIndex / 3) * 100}%` }}
              />
            </div>

            <div className="space-y-4">
              {timelineSteps.map((step, index) => {
                const Icon = step.icon;
                const isReached = statusIndex >= index;
                const isCurrent = statusIndex === index;

                return (
                  <div key={step.id} className="flex items-center gap-4 relative">
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isReached
                        ? 'bg-neutral-900 text-white shadow-md'
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-neutral-100' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className={`text-sm font-medium ${isReached ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                      {step.time && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-900">{formatTime(step.time)}</p>
                          <p className="text-[10px] text-gray-500">{formatDate(step.time)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Cancellation Window Actions */}
      {order.cancellationWindow?.isActive && effectiveStatus !== 'cancelled' && (
        <div className="px-4 pb-4 space-y-3">
          <CancellationTimer
            deadline={order.cancellationWindow.deadline}
            remainingMs={order.cancellationWindow.remainingMs}
            isActive={order.cancellationWindow.isActive}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSkipWindow(order._id)}
              disabled={skipLoadingId === order._id}
              className="px-4 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <ShieldCheck className="w-4 h-4" />
              {skipLoadingId === order._id ? '...' : 'Autoriser'}
            </button>
            <button
              type="button"
              onClick={() => onCancelOrder(order._id)}
              className="px-4 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Products Preview - Collapsible */}
      <div className="px-4 pb-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Articles ({itemCount})</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-3 space-y-2">
            {orderItems.slice(0, 3).map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                {item.snapshot?.image || item.product?.images?.[0] ? (
                  <img
                    src={item.snapshot?.image || item.product?.images?.[0]}
                    alt={item.snapshot?.title || 'Produit'}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-neutral-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.snapshot?.title || 'Produit'}</p>
                  <p className="text-xs text-gray-500">Qté: {item.quantity || 1} • {formatCurrency(item.snapshot?.price || 0)}</p>
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

      {/* Delivery Address */}
      <div className="px-4 pb-4">
        <div className="p-4 rounded-xl bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {pickupOrder ? 'Retrait boutique' : t('orders.delivery', 'Livraison')}
            </span>
            </div>
            {!pickupOrder && (order.status === 'pending' || order.status === 'confirmed') && (
              <button
                type="button"
                onClick={() => onEditAddress(order)}
                className="text-xs font-semibold text-neutral-800 hover:text-neutral-700"
              >
                Modifier
              </button>
            )}
          </div>
          {pickupOrder ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{pickupShopAddress?.shopName || 'Boutique'}</p>
              <p className="text-sm font-medium text-gray-900">{pickupShopAddress?.addressLine || 'Adresse boutique non renseignée'}</p>
              {pickupShopAddress?.cityLine ? (
                <p className="text-xs text-gray-500 mt-1">{pickupShopAddress.cityLine}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">{order.deliveryAddress || 'Non renseignée'}</p>
              <p className="text-xs text-gray-500 mt-1">{order.deliveryCity || 'Ville non renseignée'}</p>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 space-y-2">
        <OrderChat
          order={order}
          buttonText="Contacter le vendeur"
          unreadCount={orderUnreadCounts[order._id] || 0}
        />

        {effectiveStatus === 'delivered' && orderItems.length > 0 && (
          <button
            type="button"
            onClick={() => onReorder(order)}
            disabled={reordering}
            className="w-full px-4 py-3 rounded-xl bg-neutral-900 text-white font-semibold hover:bg-neutral-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {reordering ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Commander à nouveau
          </button>
        )}
      </div>
    </div>
  );
};

// Compact order summary card - links to order detail page (reference-style layout)
const OrderSummaryCard = ({ order }) => {
  const { t } = useAppSettings();
  const pickupOrder = isPickupOrder(order);
  const orderItems = order.items?.length ? order.items : order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }] : [];
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
  const effectiveStatus = getEffectiveOrderStatus(order);
  const pickupCardStatus = getPickupCardStatus(order);
  const statusBadgeKey = pickupCardStatus || effectiveStatus;
  const fullPaymentBadgeStatus = getFullPaymentBadgeStatus(order);
  const installmentProgress =
    installmentTotal > 0 ? Math.min(100, Math.round((installmentPaid / installmentTotal) * 100)) : 0;
  const firstItem = orderItems[0];
  const shopName = firstItem?.snapshot?.shopName || t('orders.shop', 'Boutique');
  const productTitle = firstItem?.snapshot?.title || t('orders.product', 'Produit');
  const itemCount = orderItems.length;

  return (
    <Link
      to={`/orders/detail/${order._id}`}
      className="ui-card ui-card-interactive ui-card-fade-in group block overflow-hidden transition hover:bg-neutral-50 dark:hover:bg-neutral-900/80"
    >
      {/* Seller + Status header */}
      <div className="ui-card-soft-separator flex items-center justify-between px-4 py-3 bg-gray-50/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <Store className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-semibold text-gray-900 truncate">{shopName}</span>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
        <StatusBadge status={statusBadgeKey} />
      </div>
      {/* Product summary */}
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
                {t('orders.installmentProgress', 'Progression tranche')}: {installmentProgress}%
              </p>
              <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-neutral-900"
                  style={{ width: `${installmentProgress}%` }}
                />
              </div>
              {installmentPlan?.nextDueDate && (
                <p className="text-[11px] text-gray-500">
                  {t('orders.nextDueDate', 'Prochaine échéance')}: {new Date(installmentPlan.nextDueDate).toLocaleDateString('fr-FR')}
                </p>
              )}
              {order.status === 'completed' && (
                <p className="text-[11px] text-gray-500">
                  {t('orders.saleStatus', 'Statut vente')}: {INSTALLMENT_SALE_STATUS_LABELS[installmentSaleStatus] || t('orders.confirmedFeminine', 'Confirmée')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Footer: total + CTA */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          {isInstallmentOrder ? (
            <StatusBadge paymentType="installment" compact />
          ) : (
            <StatusBadge status={fullPaymentBadgeStatus} compact />
          )}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">
              {formatCurrency(isInstallmentOrder ? installmentPaid : totalAmount)}
            </span>
            <span className="text-neutral-800 font-medium text-sm flex items-center gap-0.5">{t('orders.viewDetail', 'Voir le détail')} <ChevronRight className="w-4 h-4" /></span>
          </div>
        </div>
        {!pickupOrder && Number(order.deliveryFeeTotal ?? 0) > 0 && (
          <p className="text-xs text-gray-500">
            {t('orders.deliveryFee', 'Frais de livraison')}: {formatCurrency(order.deliveryFeeTotal)}
          </p>
        )}
      </div>
    </Link>
  );
};

export default function UserOrders() {
  const externalLinkProps = useDesktopExternalLink();
  const { user } = useContext(AuthContext);
  const { t } = useAppSettings();
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, byStatus: {} });
  const [statsLoading, setStatsLoading] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [skipLoadingId, setSkipLoadingId] = useState(null);
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swipedOrderId, setSwipedOrderId] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const pullStartY = useRef(0);
  const pullMoveY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const { status: statusParam } = useParams();
  const { addItem } = useContext(CartContext);
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const [activeStatus, setActiveStatus] = useState(() => normalizeStatusFilter(statusParam));
  const [initialLoadingDone, setInitialLoadingDone] = useState(false);

  useEffect(() => {
    const normalizedStatus = normalizeStatusFilter(statusParam);
    setActiveStatus((currentStatus) =>
      currentStatus === normalizedStatus ? currentStatus : normalizedStatus
    );
    setPage(1);
  }, [statusParam]);

  const ordersListQuery = useBuyerOrdersListQuery({
    page,
    limit: PAGE_SIZE,
    status: activeStatus,
    enabled: Boolean(user?._id || user?.id)
  });

  const mergeOrderUpdate = useCallback(
    (updatedOrder) => {
      if (!updatedOrder?._id) return;
      setOrders((prev) => {
        const patched = prev.map((entry) =>
          String(entry?._id || '') === String(updatedOrder._id) ? updatedOrder : entry
        );
        if (activeStatus === 'all') return patched;
        return patched.filter(
          (entry) => String(entry?.status || '').trim() === String(activeStatus).trim()
        );
      });
      queryClient.setQueriesData(
        { queryKey: orderQueryKeys.listRoot('user') },
        (existing) => patchOrdersListPayload(existing, updatedOrder)
      );
      queryClient.setQueryData(
        orderQueryKeys.detail('user', String(updatedOrder._id)),
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
        queryKey: orderQueryKeys.detail('user', String(orderId)),
        refetchType: 'inactive'
      });
      await queryClient.invalidateQueries({
        queryKey: orderQueryKeys.list('user', {
          page,
          limit: PAGE_SIZE,
          status: activeStatus
        }),
        refetchType: 'active'
      });
    },
    [activeStatus, page, queryClient]
  );

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasActiveOrders = useMemo(
    () =>
      orders.some((order) => ACTIVE_LIVE_STATUSES.has(String(order?.status || '').trim())),
    [orders]
  );

  useOrderRealtimeSync({
    scope: 'user',
    enabled: Boolean(user?._id || user?.id),
    pollIntervalMs: 15000,
    currentStatus: hasActiveOrders ? 'pending_payment' : 'delivered'
  });

  useEffect(() => {
    const onStatusUpdated = (event) => {
      const payload = event?.detail || {};
      const incomingOrderId = String(payload?.orderId || '').trim();
      if (!incomingOrderId) return;
      setOrders((prev) => {
        const patched = prev.map((entry) => applyRealtimeStatusPatch(entry, payload));
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

  // Cache orders for offline access
  useEffect(() => {
    if (orders.length > 0 && isOnline) {
      try {
        localStorage.setItem('cached_orders', JSON.stringify({
          orders,
          timestamp: Date.now(),
          status: activeStatus
        }));
      } catch (e) {
        console.warn('Failed to cache orders:', e);
      }
    }
  }, [orders, isOnline, activeStatus]);

  // Load cached orders when offline
  useEffect(() => {
    if (!isOnline && orders.length === 0) {
      try {
        const cached = localStorage.getItem('cached_orders');
        if (cached) {
          const { orders: cachedOrders } = JSON.parse(cached);
          setOrders(cachedOrders);
        }
      } catch (e) {
        console.warn('Failed to load cached orders:', e);
      }
    }
  }, [isOnline, orders.length]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (pullStartY.current === 0) return;
    pullMoveY.current = e.touches[0].clientY;
    const distance = pullMoveY.current - pullStartY.current;
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 80 && !isRefreshing && isOnline) {
      setIsRefreshing(true);
      try {
        await ordersListQuery.refetch();
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        setIsRefreshing(false);
      }
    }
    pullStartY.current = 0;
    pullMoveY.current = 0;
    setPullDistance(0);
  }, [pullDistance, isRefreshing, isOnline, ordersListQuery]);

  // Swipe action handlers
  const minSwipeDistance = 50;

  const onSwipeStart = (e, orderId) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipedOrderId(orderId);
  };

  const onSwipeMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onSwipeEnd = async (order) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && order.cancellationWindow?.isActive && getEffectiveOrderStatus(order) !== 'cancelled') {
      // Show cancel confirmation
      if (await appConfirm('Annuler cette commande ?')) {
        await handleCancelOrder(order._id);
      }
    }

    setSwipedOrderId(null);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Load order statistics and available shops
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data } = await api.get('/orders?limit=1000');
        if (!active) return;
        const allOrders = Array.isArray(data) ? data : data?.items || [];
        const total = allOrders.length;
        const totalAmount = allOrders.reduce((sum, order) => {
          const items = order.items || (order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1 }] : []);
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
    if (!ordersListQuery.data) return;
    const items = Array.isArray(ordersListQuery.data.items)
      ? ordersListQuery.data.items
      : [];
    setOrders(items);
    setMeta({
      total: Number(ordersListQuery.data.total || items.length),
      totalPages: Math.max(1, Number(ordersListQuery.data.totalPages || 1))
    });
    const incomingPage = Number(ordersListQuery.data.page || page);
    if (Number.isFinite(incomingPage) && incomingPage > 0 && incomingPage !== page) {
      setPage(incomingPage);
    }
    if (!initialLoadingDone) {
      setInitialLoadingDone(true);
    }
  }, [initialLoadingDone, ordersListQuery.data, page]);

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

  const emptyMessage =
    activeStatus === 'all'
      ? 'Vous n\'avez pas encore de commande.'
      : `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`;

  const cancelOrderMutation = useReliableMutation({
    mutationFn: async ({ orderId, idempotencyKey }) => {
      const { data } = await api.patch(
        `/orders/${orderId}/status`,
        { status: 'cancelled' },
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
      return String(data?.status || '') === 'cancelled' ? data : false;
    },
    onSuccess: async (result, variables) => {
      const payload = result?.data;
      const nextOrder =
        payload?.order && typeof payload.order === 'object' ? payload.order : payload;
      if (nextOrder?._id) {
        mergeOrderUpdate(nextOrder);
      } else if (variables?.orderId) {
        await queryClient.invalidateQueries({
          queryKey: orderQueryKeys.detail('user', String(variables.orderId)),
          refetchType: 'active'
        });
      }
    },
    onSettled: async (_data, _error, variables) => {
      await invalidateOrderItem(variables?.orderId);
    }
  });

  const handleSkipCancellationWindow = async (orderId) => {
    if (!(await appConfirm('En confirmant, vous autorisez le vendeur à traiter immédiatement cette commande. Vous ne pourrez plus l\'annuler.'))) {
      return;
    }

    setSkipLoadingId(orderId);
    try {
      const { data } = await api.post(`/orders/${orderId}/skip-cancellation-window`);
      mergeOrderUpdate(data);
      await invalidateOrderItem(orderId);
    } catch (err) {
      appAlert(err.response?.data?.message || 'Impossible de lever le délai d\'annulation.');
    } finally {
      setSkipLoadingId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!(await appConfirm('Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.'))) {
      return;
    }

    try {
      await cancelOrderMutation.mutateAsync({ orderId });
    } catch (err) {
      if (isApiPossiblyCommittedError(err)) {
        appAlert('Réseau lent ou interrompu. Vérification automatique en cours. Vérifiez le statut avant de renvoyer.');
        return;
      }
      appAlert(err.response?.data?.message || 'Impossible d\'annuler la commande.');
    }
  };

  const handleEditAddress = (order) => {
    setSelectedOrderForEdit(order);
    setEditAddressModalOpen(true);
  };

  const handleSaveAddress = async (addressData) => {
    if (!selectedOrderForEdit) return;
    
    try {
      const { data } = await api.patch(`/orders/${selectedOrderForEdit._id}/address`, addressData);
      mergeOrderUpdate(data);
      await invalidateOrderItem(selectedOrderForEdit._id);
      setEditAddressModalOpen(false);
      setSelectedOrderForEdit(null);
    } catch (err) {
      throw err; // Let the modal handle the error
    }
  };

  const handleReorder = async (order) => {
    if (!order || !order.items || order.items.length === 0) return;
    
    setReordering(true);
    const addedItems = [];
    const failedItems = [];
    
    try {
      // Add each item from the order to the cart
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
        } catch (err) {
          // Product might be unavailable or removed
          failedItems.push(item.snapshot?.title || 'Produit inconnu');
        }
      }
      
      // Show feedback
      if (addedItems.length > 0) {
        const message = failedItems.length > 0
          ? `${addedItems.length} article(s) ajouté(s) au panier. ${failedItems.length} article(s) non disponible(s).`
          : 'Tous les articles ont été ajoutés au panier !';
        appAlert(message);
        
        // Navigate to cart if items were added
        if (addedItems.length > 0) {
          navigate('/cart');
        }
      } else if (failedItems.length > 0) {
        appAlert('Aucun article n\'a pu être ajouté au panier. Les produits peuvent être indisponibles ou supprimés.');
      }
    } catch (err) {
      appAlert('Erreur lors de l\'ajout des articles au panier. Veuillez réessayer.');
    } finally {
      setReordering(false);
    }
  };

  const openOrderPdf = (order) => {
    const orderItems = order.items && order.items.length
      ? order.items
      : order.productSnapshot
      ? [{ snapshot: order.productSnapshot, quantity: 1 }]
      : [];
    
    const computedTotal = orderItems.reduce((sum, item) => {
      const price = Number(item.snapshot?.price || 0);
      const qty = Number(item.quantity || 1);
      return sum + price * qty;
    }, 0);
    const orderTotal = Number(order.totalAmount ?? computedTotal);
    const paidAmount = Number(order.paidAmount || 0);
    const remainingAmount = Number(order.remainingAmount ?? Math.max(0, orderTotal - paidAmount));
    
    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rowsHtml = orderItems
      .map((item, index) => {
        const title = escapeHtml(item.snapshot?.title || 'Produit');
        const shopName = escapeHtml(item.snapshot?.shopName || '');
        const confirmation = escapeHtml(item.snapshot?.confirmationNumber || '');
        const qty = Number(item.quantity || 1);
        const price = formatCurrency(item.snapshot?.price || 0);
        const lineTotal = formatCurrency((item.snapshot?.price || 0) * qty);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <div class="title">${title}</div>
              ${shopName ? `<div class="meta">${t('orders.shop', 'Boutique')}: ${shopName}</div>` : ''}
              ${confirmation ? `<div class="meta">${t('orders.deliveryCode', 'Code')}: ${confirmation}</div>` : ''}
            </td>
            <td class="right">x${qty}</td>
            <td class="right">${price}</td>
            <td class="right">${lineTotal}</td>
          </tr>
        `;
      })
      .join('');

    const orderRef = escapeHtml(order._id || '');
    const orderShort = escapeHtml(order._id?.slice(-6) || '');
    const logoUrl = `${window.location.origin}/favicon.svg`;
    const html = `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>${t('orders.purchaseOrder', 'Bon de commande')} ${orderShort}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 32px; color: #111827; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e5e7eb; padding: 6px; }
            .title { font-size: 22px; font-weight: 700; }
            .badge { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; }
            .right { text-align: right; }
            .total-row td { font-weight: 700; border-top: 2px solid #111827; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img src="${logoUrl}" alt="HDMarket" class="logo" />
              <div>
                <div class="title">${t('orders.purchaseOrder', 'Bon de commande')}</div>
                <div class="badge">HDMarket</div>
              </div>
            </div>
            <div class="right">
              <div class="badge">${t('orders.order', 'Commande')} #${orderShort}</div>
              <div>${escapeHtml(new Date(order.createdAt).toLocaleDateString('fr-FR'))}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${t('orders.article', 'Article')}</th>
                <th class="right">${t('orders.qty', 'Qté')}</th>
                <th class="right">${t('orders.price', 'Prix')}</th>
                <th class="right">${t('orders.total', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="4" class="right">${t('orders.orderTotal', 'Total commande')}</td>
                <td class="right">${formatCurrency(orderTotal)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }
    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
    pdfWindow.focus();
  };

  const loading = !initialLoadingDone && ordersListQuery.isLoading && orders.length === 0;
  const queryErrorMessage =
    ordersListQuery.error?.response?.data?.message ||
    ordersListQuery.error?.message ||
    '';
  const error = !isOnline && orders.length > 0 ? '' : queryErrorMessage;

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <GlassHeader title={t('orders.title', 'Mes commandes')} subtitle={t('common.loading', 'Chargement...')} backTo="/" />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <OrderListSkeleton items={5} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-neutral-50 dark:bg-neutral-950"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-neutral-900 text-white transition-all duration-200"
          style={{ height: Math.min(pullDistance, 80) }}
        >
          <RefreshCw
            className={`w-5 h-5 transition-transform ${pullDistance > 80 ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 2}deg)` }}
          />
          <span className="ml-2 text-sm font-medium">
            {pullDistance > 80 ? t('orders.pullRelease', 'Relâchez pour actualiser') : t('orders.pullDown', 'Tirez pour actualiser')}
          </span>
        </div>
      )}

      {/* Refreshing Indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-neutral-900 text-white py-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="ml-2 text-sm font-medium">{t('orders.refreshing', 'Actualisation...')}</span>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-neutral-900 text-white py-2 px-4">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">{t('orders.offlineMode', 'Mode hors ligne - Données en cache')}</span>
        </div>
      )}

      <div className={!isOnline ? 'mt-10' : ''}>
        <GlassHeader
          title={t('orders.title', 'Mes commandes')}
          subtitle={t('orders.subtitle', 'Suivi livraison et paiement')}
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
      </div>

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-4 pb-6' : 'py-6 pb-12'} pb-[env(safe-area-inset-bottom)]`}>
        {/* Statistics Cards - Same layout as /seller/orders (readable on mobile) */}
        {!statsLoading && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-900">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.totalOrders', 'Total commandes')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.allYourOrders', 'Toutes vos commandes')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-neutral-700">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.totalSpent', 'Total dépensé')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.totalSpentHelp', 'Montant total de vos achats')}</p>
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

        {/* Status Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 sm:mb-8">
          <div
            className={`flex gap-2 ${
              isMobile ? 'overflow-x-auto pb-2 -mx-1 px-1 hide-scrollbar snap-x snap-mandatory' : 'flex-wrap'
            }`}
            style={isMobile ? { WebkitOverflowScrolling: 'touch' } : undefined}
          >
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
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-lg scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  } ${isMobile ? 'flex-shrink-0 snap-start' : ''}`}
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-neutral-900 text-white font-semibold hover:bg-neutral-800 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                {t('orders.discoverProducts', 'Découvrir nos produits')}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* List View - Hidden on mobile (card view is better for touch) */}
            {viewMode === 'list' && !isMobile && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* List Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <div className="col-span-1">{t('orders.numberShort', 'N°')}</div>
                  <div className="col-span-3">{t('orders.products', 'Produit(s)')}</div>
                  <div className="col-span-2">{t('orders.shop', 'Boutique')}</div>
                  <div className="col-span-2">{t('orders.date', 'Date')}</div>
                  <div className="col-span-2">{t('orders.amount', 'Montant')}</div>
                  <div className="col-span-2">{t('orders.status', 'Statut')}</div>
                </div>
                <div className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const orderItems =
                      order.items && order.items.length
                        ? order.items
                        : order.productSnapshot
                        ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }]
                        : [];
                    const computedTotal = orderItems.reduce(
                      (sum, item) =>
                        sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
                      0
                    );
                    const totalAmount = Number(order.totalAmount ?? computedTotal);
                    const effectiveStatus = getEffectiveOrderStatus(order);
                    const pickupOrder = isPickupOrder(order);
                    const pickupCardStatus = getPickupCardStatus(order);
                    const statusBadgeKey = pickupCardStatus || effectiveStatus;
                    const firstItem = orderItems[0];
                    const shopName = firstItem?.snapshot?.shopName || 'N/A';
                    const productTitle = firstItem?.snapshot?.title || t('orders.product', 'Produit');
                    const itemCount = orderItems.length;

                    return (
                      <Link
                        key={order._id}
                        to={`/orders/detail/${order._id}`}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors items-center"
                      >
                        {/* Order Number */}
                        <div className="col-span-1 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">{t('orders.numberShort', 'N°')}:</span>
                          <span className="font-bold text-gray-900 text-sm">#{order._id.slice(-6)}</span>
                        </div>

                        {/* Product */}
                        <div className="col-span-3 flex items-center gap-3">
                          {firstItem?.snapshot?.image ? (
                            <img
                              src={firstItem.snapshot.image}
                              alt={productTitle}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-neutral-800" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{productTitle}</p>
                            {itemCount > 1 && (
                              <p className="text-xs text-gray-500">+{itemCount - 1} autre{itemCount > 2 ? 's' : ''}</p>
                            )}
                            <SelectedAttributesList
                              selectedAttributes={firstItem?.selectedAttributes}
                              compact
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* Shop */}
                        <div className="col-span-2 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">{t('orders.shop', 'Boutique')}:</span>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{shopName}</span>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="col-span-2 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">{t('orders.date', 'Date')}:</span>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="col-span-2 flex flex-col gap-0.5 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">{t('orders.amount', 'Montant')}:</span>
                          <span className="font-bold text-gray-900 text-sm">{formatCurrency(totalAmount)}</span>
                          {!pickupOrder && Number(order.deliveryFeeTotal ?? 0) > 0 && (
                            <span className="text-xs text-gray-500">{t('orders.deliveryFee', 'Frais livraison')}: {formatCurrency(order.deliveryFeeTotal)}</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="md:hidden text-xs font-medium text-gray-500">{t('orders.status', 'Statut')}:</span>
                          <StatusBadge status={statusBadgeKey} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card View - Summary cards linking to order detail */}
            {(viewMode === 'card' || isMobile) && (
            <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'pb-4' : ''}`}>
              {orders.map((order) => (
                <OrderSummaryCard key={order._id} order={order} />
              ))}
            </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm text-gray-600">
                  {t('orders.page', 'Page')} <span className="font-bold text-gray-900">{page}</span> {t('orders.of', 'sur')}{' '}
                  <span className="font-bold text-gray-900">{meta.totalPages}</span> —{' '}
                  <span className="font-bold text-gray-900">{meta.total}</span> {t('orders.orderCount', `commande${meta.total > 1 ? 's' : ''}`)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {t('orders.previous', 'Précédent')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {t('orders.next', 'Suivant')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit Address Modal */}
        <EditAddressModal
          isOpen={editAddressModalOpen}
          onClose={() => {
            setEditAddressModalOpen(false);
            setSelectedOrderForEdit(null);
          }}
          order={selectedOrderForEdit}
          onSave={handleSaveAddress}
        />
      </div>
    </div>
  );
}
