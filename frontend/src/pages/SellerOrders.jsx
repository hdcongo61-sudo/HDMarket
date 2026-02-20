import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import StatusBadge from '../components/orders/StatusBadge';
import { OrderListSkeleton } from '../components/orders/OrderSkeletons';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useAppSettings } from '../context/AppSettingsContext';

const STATUS_LABELS = {
  pending_payment: 'Paiement en attente',
  paid: 'Payée',
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
  pending: { header: 'bg-gray-600', card: 'bg-gray-50 border-gray-200 text-gray-700' },
  pending_installment: { header: 'bg-violet-600', card: 'bg-violet-50 border-violet-200 text-violet-800' },
  installment_active: { header: 'bg-indigo-600', card: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  overdue_installment: { header: 'bg-rose-600', card: 'bg-rose-50 border-rose-200 text-rose-800' },
  confirmed: { header: 'bg-amber-600', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  delivering: { header: 'bg-blue-600', card: 'bg-blue-50 border-blue-200 text-blue-800' },
  delivered: { header: 'bg-emerald-600', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  completed: { header: 'bg-emerald-700', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  cancelled: { header: 'bg-red-600', card: 'bg-red-50 border-red-200 text-red-800' }
};

const STATUS_ICONS = {
  pending_payment: Clock,
  paid: CreditCard,
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

const OrderProgress = ({ status }) => {
  const { t } = useAppSettings();
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-600">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{t('orders.tracking', 'Suivi de commande')}</h3>
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
  const firstItem = orderItems[0];
  const productTitle = firstItem?.snapshot?.title || t('orders.product', 'Produit');
  const itemCount = orderItems.length;
  const customerName = order.customer?.name || t('orders.customer', 'Client');

  return (
    <Link
      to={`/seller/orders/detail/${order._id}`}
      className="group block rounded-2xl border border-neutral-200 bg-white transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-900/80 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-semibold text-gray-900 truncate">{customerName}</span>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="p-4 flex gap-3">
        {firstItem?.snapshot?.image ? (
          <img src={firstItem.snapshot.image} alt={productTitle} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-8 h-8 text-indigo-600" />
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
          {isInstallmentOrder && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-indigo-700">
                {t('orders.installment', 'Tranche')}: {installmentProgress}% {t('orders.validated', 'validé')}
              </p>
              <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-600"
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
      <div className="px-4 pb-4 flex items-center justify-between gap-3">
        <StatusBadge paymentType={isInstallmentOrder ? 'installment' : 'full'} compact />
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
          <span className="text-indigo-600 font-medium text-sm flex items-center gap-0.5">{t('orders.viewDetail', 'Voir le détail')} <ChevronRight className="w-4 h-4" /></span>
        </div>
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

  // Progress percentage based on status
  const progressMap = { pending: 25, confirmed: 50, delivering: 75, delivered: 100, cancelled: 0 };
  const progress = progressMap[order.status] || 0;

  // Status colors
  const statusColors = {
    pending: { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    confirmed: { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    delivering: { bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    delivered: { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    cancelled: { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  };
  const colors = statusColors[order.status] || statusColors.pending;

  // Timeline steps with timestamps
  const timelineSteps = [
    { id: 'pending', label: 'Passée', icon: ClipboardList, time: order.createdAt },
    { id: 'confirmed', label: 'Confirmée', icon: Package, time: order.confirmedAt },
    { id: 'delivering', label: 'Expédiée', icon: Truck, time: order.shippedAt },
    { id: 'delivered', label: 'Livrée', icon: CheckCircle, time: order.deliveredAt }
  ];

  const statusIndex = ['pending', 'confirmed', 'delivering', 'delivered'].indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const canUpdateStatus = !isCancelled && order.status !== 'delivered' && !order.cancellationWindow?.isActive;

  const formatTime = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
      {/* Header with Progress Circle */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Circular Progress */}
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle
                  cx="28" cy="28" r="24"
                  stroke={isCancelled ? '#ef4444' : '#6366f1'}
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
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          {order.deliveryGuy && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Truck className="w-3.5 h-3.5" />
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
        <div className="mx-4 mt-3 p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">{t('orders.deliveryCode', 'Code de livraison')}</p>
              <p className="text-3xl font-black text-indigo-900 tracking-widest font-mono mt-1">
                {order.deliveryCode}
              </p>
            </div>
            <ShieldCheck className="w-10 h-10 text-indigo-400" />
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
          <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1 text-xs text-indigo-600 mt-1">
            <Phone className="w-3 h-3" />
            <span>{order.customer.phone}</span>
          </a>
        )}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{order.deliveryAddress || 'Adresse non renseignée'}</span>
          </div>
          <p className="text-xs text-gray-400 ml-4">{order.deliveryCity || ''}</p>
        </div>
      </div>

      {/* Timeline */}
      {!isCancelled && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('orders.tracking', 'Suivi')}</span>
          </div>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200">
              <div
                className="absolute top-0 left-0 w-full bg-indigo-500 transition-all duration-500"
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
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-indigo-100' : ''}`}>
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

      {/* Cancellation Window Warning */}
      {order.cancellationWindow?.isActive && order.status !== 'cancelled' && (
        <div className="mx-4 mt-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <CancellationTimer
            deadline={order.cancellationWindow.deadline}
            remainingMs={order.cancellationWindow.remainingMs}
            isActive={order.cancellationWindow.isActive}
          />
          <p className="text-xs text-amber-700 mt-2">
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
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-indigo-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.snapshot?.title || t('orders.product', 'Produit')}</p>
                  <p className="text-xs text-gray-500">{t('orders.qty', 'Qté')}: {item.quantity || 1} • {formatCurrency(item.snapshot?.price || 0)}</p>
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
        <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{t('orders.total', 'Total')}</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
        </div>
        {paidAmount > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('orders.depositPaid', 'Acompte versé')}</span>
              <span className="font-medium text-emerald-600">{formatCurrency(paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('orders.remaining', 'Reste à payer')}</span>
              <span className="font-medium text-amber-600">{formatCurrency(remainingAmount)}</span>
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
            <button
              type="button"
              onClick={() => onStatusUpdate(order._id, 'confirmed')}
              disabled={order.status !== 'pending' || statusUpdatingId === order._id}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Package className="w-4 h-4" />
              {t('orders.confirm', 'Confirmer')}
            </button>
            <button
              type="button"
              onClick={() => onStatusUpdate(order._id, 'delivering')}
              disabled={order.status !== 'confirmed' || statusUpdatingId === order._id}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Truck className="w-4 h-4" />
              {t('orders.ship', 'Expédier')}
            </button>
            <button
              type="button"
              onClick={() => onStatusUpdate(order._id, 'delivered')}
              disabled={order.status !== 'delivering' || statusUpdatingId === order._id}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              {t('orders.delivered', 'Livrée')}
            </button>
            <button
              type="button"
              onClick={() => onOpenCancelModal(order._id)}
              disabled={statusUpdatingId === order._id}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <X className="w-4 h-4" />
              {t('common.cancel', 'Annuler')}
            </button>
          </div>
          {statusUpdateError.id === order._id && (
            <p className="text-xs text-red-600 mt-2 text-center">{statusUpdateError.message}</p>
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
  const externalLinkProps = useDesktopExternalLink();
  const isMobile = useIsMobile(768);
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
  const [reloadToken, setReloadToken] = useState(0);
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

  const activeStatus = useMemo(() => {
    if (!statusParam) return 'all';
    return Object.keys(STATUS_LABELS).includes(statusParam) ? statusParam : 'all';
  }, [statusParam]);

  const refreshOrders = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  const { pullDistance, refreshing, bind } = usePullToRefresh(refreshOrders, {
    enabled: isMobile
  });

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

  const initialLoadDone = useRef(false);
  useEffect(() => {
    const loadOrders = async () => {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
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
        // Deduplicate orders by _id to prevent any duplicate display issues
        const seenIds = new Set();
        const uniqueOrders = items.filter((order) => {
          if (!order?._id || seenIds.has(order._id)) return false;
          seenIds.add(order._id);
          return true;
        });
        const totalPages = Math.max(1, Number(data?.totalPages) || 1);
        setOrders(uniqueOrders);
        
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
        initialLoadDone.current = true;
      }
    };
    loadOrders();
  }, [activeStatus, page, user?._id, reloadToken]);

  const handleStatusUpdate = async (orderId, nextStatus) => {
    setStatusUpdatingId(orderId);
    setStatusUpdateError({ id: '', message: '' });
    try {
      const { data } = await api.patch(`/orders/seller/${orderId}/status`, {
        status: nextStatus
      });
      const prevOrder = orders.find((o) => o._id === orderId);
      const prevStatus = prevOrder?.status || 'pending';
      setOrders((prev) => {
        const updated = prev.map((order) => (order._id === orderId ? data : order));
        // Deduplicate by _id
        const seenIds = new Set();
        return updated.filter((order) => {
          if (!order?._id || seenIds.has(order._id)) return false;
          seenIds.add(order._id);
          return true;
        });
      });
      setStats((s) => ({
        ...s,
        byStatus: {
          ...s.byStatus,
          [prevStatus]: Math.max(0, (s.byStatus[prevStatus] || 1) - 1),
          [nextStatus]: (s.byStatus[nextStatus] || 0) + 1
        }
      }));
      showToast('Statut de la commande mis à jour.', { variant: 'success' });
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
      const prevOrder = orders.find((o) => o._id === cancelOrderId);
      const prevStatus = prevOrder?.status || 'pending';
      setOrders((prev) => {
        const updated = prev.map((order) => (order._id === cancelOrderId ? data : order));
        // Deduplicate by _id
        const seenIds = new Set();
        return updated.filter((order) => {
          if (!order?._id || seenIds.has(order._id)) return false;
          seenIds.add(order._id);
          return true;
        });
      });
      setStats((s) => ({
        ...s,
        byStatus: {
          ...s.byStatus,
          [prevStatus]: Math.max(0, (s.byStatus[prevStatus] || 1) - 1),
          cancelled: (s.byStatus.cancelled || 0) + 1
        }
      }));
      showToast(t('orders.cancelSuccess', 'Commande annulée avec succès. Le client a été notifié.'), { variant: 'success' });
      closeCancelModal();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.details?.[0] || t('orders.cancelError', "Impossible d'annuler la commande.");
      showToast(message, { variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  const emptyMessage =
    activeStatus === 'all'
      ? t('orders.noCustomerOrdersYet', 'Aucune commande client pour le moment.')
      : t('orders.noOrdersWithStatusYet', `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`);

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
        <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-indigo-600 py-2 text-white">
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
        {(user?.role === 'admin' || user?.role === 'manager') && (
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
                <div className="p-3 rounded-xl bg-indigo-600">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.totalOrders', 'Total commandes')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.allCustomerOrders', 'Toutes les commandes clients')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-600">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('orders.revenue', "Chiffre d'affaires")}</p>
              <p className="text-xs text-gray-500 mt-1">{t('orders.totalOrderAmount', 'Montant total des commandes')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-600">
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
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-indigo-600">
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
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-600">
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
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-rose-600">
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
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
                        <h3 className="text-lg font-bold text-gray-900">{t('orders.cancelOrderTitle', 'Annuler la commande')}</h3>
                        <p className="text-xs text-gray-500">{t('orders.order', 'Commande')} #{cancelOrderId?.slice(-6)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeCancelModal}
                      className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      aria-label={t('common.cancel', 'Fermer')}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ {t('orders.warning', 'Attention')}</p>
                      <p className="text-xs text-amber-700">
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

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeCancelModal}
                        disabled={cancelLoading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {t('common.cancel', 'Annuler')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelOrder}
                        disabled={cancelLoading || !cancelReason.trim() || cancelReason.trim().length < 5}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelLoading ? t('orders.cancelling', 'Annulation...') : t('orders.confirmCancellation', "Confirmer l'annulation")}
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
