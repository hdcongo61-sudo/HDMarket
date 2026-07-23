import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  ClipboardList,
  CreditCard,
  Gavel,
  MessageSquare,
  Package,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Trash2,
  Truck,
  VolumeX
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import GlassHeader from '../components/orders/GlassHeader';
import useUserNotifications, { triggerNotificationsRefresh } from '../hooks/useUserNotifications';
import usePullToRefresh from '../hooks/usePullToRefresh';
import api, { clearCache } from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';
import { resolveNotificationLink } from '../utils/notificationLinks';
import NotificationItem from '../components/notifications/NotificationItem';
import NotificationSkeleton from '../components/notifications/NotificationSkeleton';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import { useAppSettings } from '../context/AppSettingsContext';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';

const ORDER_TYPES = new Set([
  'order_placed',
  'order_created',
  'order_received',
  'order_accepted',
  'order_rejected',
  'order_reminder',
  'review_reminder',
  'order_cancelled',
  'order_full_payment_waived',
  'order_full_payment_received',
  'order_full_payment_ready',
  'order_cancellation_window_skipped',
  'order_message',
  'order_address_updated',
  'order_delivery_fee_updated'
]);
const REMINDER_TYPES = new Set([
  'order_reminder',
  'installment_due_reminder',
  'installment_overdue_warning',
  'review_reminder'
]);
const COMPLAINT_TYPES = new Set(['complaint_created', 'complaint_resolved']);

const BOOST_TYPES = new Set(['product_boosted', 'boost_expired', 'promo_expired']);
const DISPUTE_TYPES = new Set([
  'dispute_created',
  'dispute_seller_responded',
  'dispute_deadline_near',
  'dispute_under_review',
  'dispute_resolved'
]);
const DELIVERY_TYPES = new Set(['order_delivering', 'order_delivered', 'delivery_assigned', 'delivery_in_progress', 'delivery_completed']);
const PLATFORM_DELIVERY_TYPES = new Set([
  'delivery_request_created',
  'delivery_request_accepted',
  'delivery_request_rejected',
  'delivery_request_assigned',
  'delivery_request_in_progress',
  'delivery_request_delivered'
]);
const VALIDATION_TYPES = new Set(['validation_required']);
const ADMIN_TYPES = new Set(['admin_broadcast']);
const SYSTEM_TYPES = new Set([
  'account_restriction',
  'account_restriction_lifted',
  'payment_pending',
  'payment_proof_submitted',
  'payment_validated',
  'installment_overdue_warning'
]);

const getRelativeTime = (value, t, language = 'fr') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (minutes < 1) return t('notifications.justNow', "À l'instant");
  if (minutes < 60) return `${minutes} ${t('notifications.minutesShort', 'min')}`;
  if (hours < 24) return `${hours} ${t('notifications.hoursShort', 'h')}`;
  if (days === 1) return t('notifications.yesterday', 'Hier');
  if (days < 7) return `${days} ${t('notifications.daysShort', 'j')}`;
  return date.toLocaleDateString(String(language || 'fr').startsWith('en') ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'short' });
};

const getDateBucket = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const extractObjectId = (value, depth = 0) => {
  if (depth > 3 || value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (OBJECT_ID_REGEX.test(trimmed)) return trimmed;
    return '';
  }

  if (typeof value === 'object') {
    const candidates = [value._id, value.id, value.$oid, value.orderId, value.value];
    for (const candidate of candidates) {
      const resolved = extractObjectId(candidate, depth + 1);
      if (resolved) return resolved;
    }
  }

  return '';
};

const resolveCategory = (alert) => {
  const type = alert?.type || '';
  if (type === 'shop_follow' || type === 'shop_review') return 'shop';
  if (ORDER_TYPES.has(type) || type.startsWith('order_') || type.startsWith('installment_')) return 'orders';
  if (DISPUTE_TYPES.has(type) || COMPLAINT_TYPES.has(type)) return 'dispute';
  if (DELIVERY_TYPES.has(type) || PLATFORM_DELIVERY_TYPES.has(type)) return 'delivery';
  if (VALIDATION_TYPES.has(type)) return 'admin';
  if (ADMIN_TYPES.has(type)) return 'admin';
  if (SYSTEM_TYPES.has(type)) return 'system';
  if (BOOST_TYPES.has(type)) return 'boost';
  if (type === 'admin_broadcast' && /boost/i.test(String(alert?.message || ''))) return 'boost';
  return 'system';
};

const notificationMeta = (alert, t) => {
  const type = alert?.type || '';
  const explicitTitle = String(alert?.title || alert?.metadata?.title || '').trim();
  if (ORDER_TYPES.has(type) || type.startsWith('order_')) {
    return { title: explicitTitle || t('notifications.orderUpdate', 'Mise à jour commande'), icon: <Package className="h-4 w-4" />, tone: 'order' };
  }
  if (DELIVERY_TYPES.has(type) || PLATFORM_DELIVERY_TYPES.has(type)) {
    return { title: explicitTitle || t('notifications.deliveryUpdate', 'Mise à jour livraison'), icon: <Truck className="h-4 w-4" />, tone: 'delivery' };
  }
  if (DISPUTE_TYPES.has(type) || COMPLAINT_TYPES.has(type)) {
    return { title: explicitTitle || t('notifications.disputeUpdate', 'Mise à jour litige'), icon: <Gavel className="h-4 w-4" />, tone: 'risk' };
  }
  if (VALIDATION_TYPES.has(type)) return { title: explicitTitle || t('notifications.validationRequired', 'Action requise'), icon: <ShieldAlert className="h-4 w-4" />, tone: 'risk' };
  if (type === 'payment_pending' || type === 'payment_proof_submitted' || type === 'payment_validated') return { title: explicitTitle || t('notifications.paymentPending', 'Paiement en attente'), icon: <CreditCard className="h-4 w-4" />, tone: 'payment' };
  if (type === 'order_message') return { title: explicitTitle || t('notifications.orderMessage', 'Message commande'), icon: <MessageSquare className="h-4 w-4" />, tone: 'message' };
  if (type === 'admin_broadcast') return { title: explicitTitle || t('notifications.adminMessage', 'Message admin'), icon: <ShieldAlert className="h-4 w-4" />, tone: 'admin' };
  if (type === 'product_boosted' || /boost/i.test(String(alert?.message || ''))) {
    return { title: explicitTitle || t('notifications.boost', 'Boost'), icon: <Sparkles className="h-4 w-4" />, tone: 'boost' };
  }
  if (type === 'account_restriction' || type === 'account_restriction_lifted') {
    return { title: explicitTitle || t('notifications.accountAlert', 'Alerte compte'), icon: <AlertCircle className="h-4 w-4" />, tone: 'risk' };
  }
  if (type === 'shop_follow' || type === 'shop_review') {
    return { title: explicitTitle || t('notifications.shop', 'Boutique'), icon: <Store className="h-4 w-4" />, tone: 'shop' };
  }
  if (type === 'assistant_product_action_request') {
    return { title: explicitTitle || 'Demande assistant produit', icon: <Package className="h-4 w-4" />, tone: 'shop' };
  }
  if (type.startsWith('installment_')) {
    return { title: explicitTitle || t('notifications.installment', 'Paiement par tranche'), icon: <ClipboardList className="h-4 w-4" />, tone: 'payment' };
  }
  if (type.startsWith('sponsorship_')) {
    return { title: explicitTitle || t('notifications.sponsorship', 'Paiement par un proche'), icon: <CreditCard className="h-4 w-4" />, tone: 'payment' };
  }
  return { title: explicitTitle || t('notifications.notification', 'Notification'), icon: <Bell className="h-4 w-4" />, tone: 'system' };
};

const BUYER_SIDE_ORDER_TYPES_FALLBACK = new Set([
  'order_created',
  'order_placed',
  'order_delivering',
  'order_delivered',
  'review_reminder',
  'installment_due_reminder',
  'installment_overdue_warning',
  'installment_payment_validated',
  'installment_completed',
  'order_full_payment_waived',
  'order_cancellation_window_skipped'
]);

const buildOrderNotificationPath = (alert, user) => {
  const type = String(alert?.type || '').trim();
  const metadata = alert?.metadata || {};
  const isOrderNotification =
    ORDER_TYPES.has(type) ||
    type === 'order_message' ||
    type === 'review_reminder' ||
    type.startsWith('order_') ||
    type.startsWith('installment_') ||
    Boolean(metadata.orderId);

  if (!isOrderNotification) return '';

  const orderId =
    extractObjectId(metadata.orderId) ||
    extractObjectId(alert?.entityType === 'order' ? alert?.entityId : '') ||
    extractObjectId(metadata.entityType === 'order' ? metadata.entityId : '');
  const normalizedRole = String(user?.role || '').toLowerCase();
  const normalizedAccountType = String(user?.accountType || '').toLowerCase();
  const isBackOffice = ['admin', 'founder', 'manager'].includes(normalizedRole);
  const isSeller = normalizedRole === 'seller' || normalizedAccountType === 'shop';

  if (type === 'order_message') {
    if (!orderId) return '/orders/messages';
    return `/orders/messages?orderId=${encodeURIComponent(orderId)}`;
  }

  if (!orderId) {
    return '';
  }
  if (isBackOffice) {
    return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  }

  // Check if user is the customer of this order
  const userCustomerId = String(user?._id || user?.id || '').trim();
  const orderCustomerId = String(alert?.metadata?.customerId || '').trim();
  const userIsOrderCustomer = Boolean(userCustomerId && orderCustomerId && userCustomerId === orderCustomerId);

  // User is the buyer — always route to buyer page
  if (userIsOrderCustomer) {
    return `/orders/detail/${orderId}`;
  }
  // User is seller/shop and NOT the customer
  if (isSeller) {
    // Fallback for old notifications without customerId: guess from notification type
    if (!orderCustomerId && BUYER_SIDE_ORDER_TYPES_FALLBACK.has(type)) {
      return `/orders/detail/${orderId}`;
    }
    return `/seller/orders/detail/${orderId}`;
  }
  return `/orders/detail/${orderId}`;
};

const getPrimaryActionLabel = (alert, to, t) => {
  if (String(alert?.type || '') === 'validation_required') return t('notifications.openTask', 'Ouvrir tâche');
  if (String(to || '').includes('/admin/payment-verification')) return t('notifications.verifyPayment', 'Vérifier paiement');
  if (String(to || '').includes('/orders') || String(to || '').includes('/seller/orders')) {
    return t('notifications.viewOrder', 'Voir commande');
  }
  return alert?.display?.actionLabel || alert?.metadata?.actionLabel || t('notifications.open', 'Ouvrir');
};

const buildDisputeNotificationPath = (alert, user) => {
  if (!DISPUTE_TYPES.has(alert?.type)) return '';
  if (user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager' || user?.canManageComplaints) {
    return '/admin/complaints';
  }
  if (user?.accountType === 'shop' || user?.role === 'seller') {
    return '/seller/disputes';
  }
  return '/reclamations';
};

const getNotificationActions = (alert, user, t) => {
  const actions = [];
  const orderPath = buildOrderNotificationPath(alert, user);
  const primaryLink = resolveNotificationLink(alert, user);
  if (primaryLink) actions.push({ to: primaryLink, label: getPrimaryActionLabel(alert, primaryLink, t) });
  if (orderPath) actions.push({ to: orderPath, label: t('notifications.viewOrder', 'Voir commande') });
  const disputePath = buildDisputeNotificationPath(alert, user);
  if (disputePath) actions.push({ to: disputePath, label: t('notifications.viewDispute', 'Voir litige') });
  if (
    alert?.type === 'payment_pending' &&
    (user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager')
  ) {
    actions.push({ to: '/admin/payment-verification', label: t('notifications.verifyPayment', 'Vérifier paiement') });
  }
  if (alert?.product) actions.push({ to: buildProductPath(alert.product), label: t('notifications.viewProduct', 'Voir produit') });
  if (alert?.shop) actions.push({ to: buildShopPath(alert.shop), label: t('notifications.viewShop', 'Voir boutique') });

  const dedup = new Map();
  actions.forEach((item) => {
    if (!item?.to) return;
    if (!dedup.has(item.to)) {
      dedup.set(item.to, item);
    }
  });
  return Array.from(dedup.values());
};

const applyFilter = (alert, filterKey) => {
  if (filterKey === 'all') return true;
  if (filterKey === 'unread') return Boolean(alert?.isNew);
  if (filterKey === 'reminders') return REMINDER_TYPES.has(alert?.type) || String(alert?.metadata?.reminderType || '').trim();
  return resolveCategory(alert) === filterKey;
};

export default function NotificationPage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { t, language } = useAppSettings();
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [snapshotCounts, setSnapshotCounts] = useState(null);
  const { counts, loading, error, refresh, updateCounts } = useUserNotifications(Boolean(user), {
    skipRefreshEvent: true
  });
  const { rapid3GActive, shouldUseOfflineSnapshot, offlineBannerText, rapid3GBannerText } =
    useNetworkProfile();
  const snapshotKey = useMemo(
    () => ['notifications', user?._id || user?.id || 'guest'].join(':'),
    [user?._id, user?.id]
  );
  const effectiveCounts = offlineSnapshotActive && snapshotCounts ? snapshotCounts : counts;
  const alerts = Array.isArray(effectiveCounts?.alerts) ? effectiveCounts.alerts : [];
  const unreadCount = Number(effectiveCounts?.unreadCount || 0);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [undoDelete, setUndoDelete] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [markingIds, setMarkingIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const sentinelRef = useRef(null);
  const filters = useMemo(
    () => [
      { key: 'all', label: t('notifications.filters.all', 'Tout') },
      { key: 'unread', label: t('notifications.filters.unread', 'Non lues') },
      { key: 'orders', label: t('notifications.filters.orders', 'Commandes') },
      { key: 'shop', label: t('notifications.filters.shop', 'Boutique') },
      { key: 'select', label: t('notifications.filters.more', 'Plus') }
    ],
    [t]
  );

  useEffect(() => {
    if (!user) {
      setOfflineSnapshotActive(false);
      setSnapshotCounts(null);
    }
  }, [user]);

  useEffect(() => {
    if (!counts || shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(snapshotKey, {
      alerts: Array.isArray(counts?.alerts) ? counts.alerts : [],
      unreadCount: Number(counts?.unreadCount || 0),
      commentAlerts: Number(counts?.commentAlerts || 0)
    });
    setOfflineSnapshotActive(false);
  }, [counts, shouldUseOfflineSnapshot, snapshotKey]);

  useEffect(() => {
    if (!error || !shouldUseOfflineSnapshot) return;
    let cancelled = false;
    loadOfflineSnapshot(snapshotKey).then((snapshot) => {
      if (cancelled) return;
      if (snapshot && typeof snapshot === 'object') {
        setSnapshotCounts(snapshot);
        setOfflineSnapshotActive(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [error, shouldUseOfflineSnapshot, snapshotKey]);

  const { pullDistance, refreshing, bind } = usePullToRefresh(
    async () => {
      setActionError('');
      await refresh();
    },
    { enabled: Boolean(user) }
  );

  const chronologicallySortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt));
      if (pinDiff !== 0) return pinDiff;
      const receivedDiff =
        new Date(b.receivedAt || b.createdAt || 0).getTime() -
        new Date(a.receivedAt || a.createdAt || 0).getTime();
      if (receivedDiff !== 0) return receivedDiff;
      return String(b._id || '').localeCompare(String(a._id || ''));
    });
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return chronologicallySortedAlerts.filter((alert) => {
      if (!applyFilter(alert, activeFilter)) return false;
      if (!query) return true;
      return [alert?.title, alert?.message, alert?.actor?.name, alert?.user?.name, alert?.product?.title]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [chronologicallySortedAlerts, activeFilter, searchQuery]);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeFilter, filteredAlerts.length]);

  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filteredAlerts.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 20, filteredAlerts.length));
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filteredAlerts.length, visibleCount]);

  const visibleAlerts = useMemo(
    () => filteredAlerts.slice(0, visibleCount),
    [filteredAlerts, visibleCount]
  );

  const groupedAlerts = useMemo(() => {
    const buckets = { Today: [], Yesterday: [], Earlier: [] };
    visibleAlerts.forEach((alert) => {
      const bucket = getDateBucket(alert?.receivedAt || alert?.createdAt);
      buckets[bucket].push(alert);
    });
    return buckets;
  }, [visibleAlerts]);

  const filterCounts = useMemo(() => {
    const countsMap = {
      all: alerts.length,
      unread: alerts.filter((alert) => alert?.isNew).length,
      reminders: alerts.filter((alert) => applyFilter(alert, 'reminders')).length,
      orders: alerts.filter((alert) => resolveCategory(alert) === 'orders').length,
      shop: alerts.filter((alert) => resolveCategory(alert) === 'shop').length,
      boost: alerts.filter((alert) => resolveCategory(alert) === 'boost').length,
      dispute: alerts.filter((alert) => resolveCategory(alert) === 'dispute').length,
      delivery: alerts.filter((alert) => resolveCategory(alert) === 'delivery').length,
      admin: alerts.filter((alert) => resolveCategory(alert) === 'admin').length,
      system: alerts.filter((alert) => resolveCategory(alert) === 'system').length
    };
    return countsMap;
  }, [alerts]);

  const handleMarkRead = async (notificationIds) => {
    if (!Array.isArray(notificationIds) || !notificationIds.length) return;
    const normalizedIds = notificationIds.map((id) => String(id)).filter(Boolean);
    if (!normalizedIds.length) return;
    setMarkingIds((prev) => new Set([...prev, ...normalizedIds]));

    // Optimistic update — update count immediately before server confirms
    const idSet = new Set(normalizedIds);
    const optimisticUnreadCount = alerts.filter(
      (alert) => idSet.has(String(alert?._id)) && alert?.isNew
    ).length;
    updateCounts((prev) => {
      const previousAlerts = Array.isArray(prev?.alerts) ? prev.alerts : [];
      const markedUnread = previousAlerts.filter((alert) => idSet.has(String(alert?._id)) && alert.isNew).length;
      const nextAlerts = previousAlerts.map((alert) =>
        idSet.has(String(alert?._id))
          ? { ...alert, isNew: false, readAt: alert.readAt || new Date().toISOString() }
          : alert
      );
      return {
        ...prev,
        alerts: nextAlerts,
        unreadCount: Math.max(0, Number(prev?.unreadCount || 0) - markedUnread),
        commentAlerts: Math.max(0, Number(prev?.commentAlerts || 0) - markedUnread)
      };
    });
    triggerNotificationsRefresh({ type: 'markRead', notificationIds: normalizedIds, refetch: false });

    // Confirm with server (non-blocking for UX)
    try {
      await fetchMarkRead(normalizedIds);
      void clearCache('/users/notifications');
    } catch (requestError) {
      // Revert optimistic update on failure
      updateCounts((prev) => {
        const previousAlerts = Array.isArray(prev?.alerts) ? prev.alerts : [];
        const nextAlerts = previousAlerts.map((alert) =>
          idSet.has(String(alert?._id))
            ? { ...alert, isNew: true, readAt: null }
            : alert
        );
        return {
          ...prev,
          alerts: nextAlerts,
          unreadCount: Number(prev?.unreadCount || 0) + optimisticUnreadCount,
          commentAlerts: Number(prev?.commentAlerts || 0) + optimisticUnreadCount
        };
      });
      triggerNotificationsRefresh({
        type: 'markReadRollback',
        notificationIds: normalizedIds,
        refetch: false
      });
      setActionError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t('notifications.errors.markRead', 'Impossible de marquer la notification comme lue.')
      );
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        normalizedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const fetchMarkRead = async (notificationIds = []) => {
    if (notificationIds.length) {
      return api.patch('/users/notifications/read', { notificationIds });
    }
    return api.patch('/users/notifications/read');
  };

  const handleDelete = async (notificationId) => {
    if (!notificationId) return;
    const notificationIdStr = String(notificationId);
    if (deletingIds.has(notificationIdStr)) return;
    setActionError('');
    setDeletingIds((prev) => new Set([...prev, notificationIdStr]));
    let previousState = null;
    let deletedAlert = null;
    updateCounts((prev) => {
      previousState = prev;
      const previousAlerts = Array.isArray(prev?.alerts) ? prev.alerts : [];
      const deleted = previousAlerts.find((alert) => String(alert?._id) === notificationIdStr);
      deletedAlert = deleted || null;
      const wasUnread = Boolean(deleted?.isNew);
      return {
        ...prev,
        alerts: previousAlerts.filter((alert) => String(alert?._id) !== notificationIdStr),
        unreadCount: wasUnread ? Math.max(0, Number(prev?.unreadCount || 0) - 1) : Number(prev?.unreadCount || 0),
        commentAlerts: wasUnread
          ? Math.max(0, Number(prev?.commentAlerts || 0) - 1)
          : Number(prev?.commentAlerts || 0)
      };
    });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationIdStr);
      return next;
    });
    try {
      await api.delete(`/users/notifications/${notificationIdStr}`, {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      await clearCache('/users/notifications');
      triggerNotificationsRefresh({ type: 'delete', notificationId: notificationIdStr, refetch: false });
      if (deletedAlert) setUndoDelete(deletedAlert);
    } catch (requestError) {
      if (previousState) updateCounts(previousState);
      setActionError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t('notifications.errors.delete', 'Impossible de supprimer la notification.')
      );
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationIdStr);
        return next;
      });
    }
  };

  const restoreLastDeleted = async () => {
    if (!undoDelete?._id) return;
    const restored = undoDelete;
    setUndoDelete(null);
    await api.patch(`/users/notifications/${restored._id}/state`, { action: 'restore' });
    updateCounts((prev) => ({
      ...prev,
      alerts: [restored, ...(prev?.alerts || [])],
      unreadCount: Number(prev?.unreadCount || 0) + (restored.isNew ? 1 : 0)
    }));
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setActionError('');
    try {
      await fetchMarkRead([]);
      await clearCache('/users/notifications');
      updateCounts((prev) => ({
        ...prev,
        alerts: (prev?.alerts || []).map((alert) => ({ ...alert, isNew: false })),
        unreadCount: 0,
        commentAlerts: 0
      }));
      triggerNotificationsRefresh({ type: 'markAllRead', refetch: false });
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t('notifications.errors.markAllRead', 'Impossible de marquer toutes les notifications.')
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationState = async (alert, action, extra = {}) => {
    await api.patch(`/users/notifications/${alert._id}/state`, { action, ...extra });
    updateCounts((prev) => ({
      ...prev,
      alerts: (prev?.alerts || [])
        .map((item) => String(item._id) === String(alert._id)
          ? { ...item, pinnedAt: action === 'pin' ? new Date().toISOString() : action === 'unpin' ? null : item.pinnedAt }
          : item)
        .filter((item) => action !== 'snooze' || String(item._id) !== String(alert._id))
    }));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const removed = alerts.filter((alert) => ids.includes(String(alert._id)));
    updateCounts((prev) => ({ ...prev, alerts: (prev?.alerts || []).filter((alert) => !ids.includes(String(alert._id))) }));
    setSelectedIds(new Set());
    setSelectionMode(false);
    try {
      await api.post('/users/notifications/bulk-delete', { notificationIds: ids });
      triggerNotificationsRefresh({ type: 'bulkDelete', refetch: false });
    } catch (requestError) {
      updateCounts((prev) => ({ ...prev, alerts: [...removed, ...(prev?.alerts || [])] }));
      setActionError(requestError?.response?.data?.message || 'Suppression impossible.');
    }
  };

  const muteActiveCategory = async () => {
    if (activeFilter === 'all' || activeFilter === 'unread') return;
    const supported = new Set(Object.keys(effectiveCounts?.preferences || {}));
    const types = [...new Set(alerts.filter((alert) => applyFilter(alert, activeFilter)).map((alert) => alert.type).filter((type) => type && supported.has(type)))];
    if (!types.length) return;
    const payload = Object.fromEntries(types.map((type) => [type, false]));
    await api.patch('/users/notification-preferences', payload);
    updateCounts((prev) => ({ ...prev, preferences: { ...(prev?.preferences || {}), ...payload } }));
    setActionError(`Notifications « ${activeFilter} » désactivées.`);
  };

  if (!user) {
    return (
      <main className="hd-commerce-shell min-h-screen px-5 py-16 text-center">
        <div className="mx-auto max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e85d00] text-white shadow-sm">
            <Bell className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-neutral-950 dark:text-neutral-100">{t('notifications.title', 'Notifications')}</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t('notifications.loginHint', 'Connectez-vous pour voir vos mises à jour commandes, boosts et litiges.')}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="hd-commerce-shell min-h-screen text-neutral-900 dark:text-neutral-100">
      <header className="border-b border-[#f5f2ee] bg-white/95 dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex min-h-[60px] max-w-3xl items-center px-2">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex h-11 w-11 items-center justify-center text-[#231f1b] dark:text-white" aria-label={t('common.back', 'Retour')}><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-[17px] font-black text-[#231f1b] dark:text-white">{t('notifications.title', 'Notifications')} <span className="text-[#8a8378]">({unreadCount})</span></h1>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount < 1}
            className="inline-flex min-h-11 flex-shrink-0 items-center px-3 text-xs font-black text-[#e85d00] transition active:scale-95 disabled:opacity-40"
          >
            {markingAll ? '...' : t('notifications.markAllRead', 'Tout lire')}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-3 pb-10">
        {(offlineSnapshotActive || rapid3GActive) && (
          <section
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        )}

        {/* Filter chips — normal flow */}
        <div className="mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            {filters.filter((filter) => ['all', 'select'].includes(filter.key) || Number(filterCounts[filter.key] || 0) > 0).map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    if (filter.key === 'select') {
                      setSelectionMode((value) => !value);
                      setSelectedIds(new Set());
                      return;
                    }
                    setActiveFilter(filter.key);
                  }}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-xs font-bold transition ${
                    isActive
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-[#e2dcd2] bg-white text-[#6b6459] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  {filter.label}
                  {filter.key !== 'select' ? <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive ? 'bg-white/25' : 'bg-white text-gray-500 dark:bg-neutral-900/80 dark:text-neutral-300'
                    }`}
                  >
                    {filterCounts[filter.key] || 0}
                  </span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {selectionMode && selectedIds.size > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-neutral-950 px-3 py-2 text-white">
            <span className="text-xs font-bold">{selectedIds.size} sélectionnée(s)</span>
            <button type="button" onClick={handleBulkDelete} className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-black"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
          </div>
        )}

        <section className="relative pb-10" {...bind}>
          <AnimatePresence>
            {(pullDistance > 0 || refreshing) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center justify-center py-2"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm dark:text-neutral-300">
                  <Bell className={`h-3.5 w-3.5 ${refreshing ? 'animate-pulse' : ''}`} />
                  {refreshing ? t('notifications.refreshing', 'Actualisation…') : t('notifications.pullToRefresh', 'Relâchez pour actualiser')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {actionError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-100">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="mt-3">
              <NotificationSkeleton count={8} />
            </div>
          ) : error && !offlineSnapshotActive ? (
            <div className="mt-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                <NetworkFallbackCard
                  title={t('notifications.errors.loadTitle', 'Unable to load data.')}
                  message={t('notifications.errors.load', 'Loading is taking longer than expected. Please try again shortly.')}
                  onRetry={refresh}
                  retryLabel={t('common.retry', 'Retry')}
                  refreshLabel={t('common.refreshPage', 'Refresh page')}
                />
              </div>
            </div>
          ) : visibleAlerts.length ? (
            <div className="mt-2">
              {['Today', 'Yesterday', 'Earlier'].map((bucket) => {
                const list = groupedAlerts[bucket] || [];
                if (!list.length) return null;
                const title =
                  bucket === 'Today'
                    ? t('notifications.today', "Aujourd'hui")
                    : bucket === 'Yesterday'
                      ? t('notifications.yesterday', 'Hier')
                      : t('notifications.earlier', 'Plus tôt');
                return (
                  <section key={bucket} className="pt-4">
                    <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.08em] text-gray-500 dark:text-neutral-400">
                      {title}
                    </h2>
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {list.map((alert) => {
                          const isUnread = Boolean(alert?.isNew);
                          const isExpanded = expandedIds.has(alert?._id);
                          const meta = notificationMeta(alert, t);
                          const actions = getNotificationActions(alert, user, t);
                          return (
                            <NotificationItem
                              key={alert._id}
                              alert={alert}
                              meta={meta}
                              timeLabel={getRelativeTime(alert?.receivedAt || alert?.createdAt, t, language)}
                              isUnread={isUnread}
                              isExpanded={isExpanded}
                              actions={actions}
                              onToggleExpand={() => {
                                setExpandedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(alert._id)) {
                                    next.delete(alert._id);
                                  } else {
                                    next.add(alert._id);
                                  }
                                  return next;
                                });
                              }}
                              onMarkRead={() => handleMarkRead([alert._id])}
                              onDelete={() => handleDelete(alert._id)}
                              markReadPending={markingIds.has(String(alert._id))}
                              deletePending={deletingIds.has(String(alert._id))}
                              selectionMode={selectionMode}
                              isSelected={selectedIds.has(String(alert._id))}
                              onToggleSelected={() => setSelectedIds((prev) => {
                                const next = new Set(prev);
                                const id = String(alert._id);
                                if (next.has(id)) next.delete(id); else next.add(id);
                                return next;
                              })}
                              onPin={(shouldPin) => handleNotificationState(alert, shouldPin ? 'pin' : 'unpin')}
                              onSnooze={() => handleNotificationState(alert, 'snooze', { until: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}
                              onNavigateAction={(to) => {
                                const notificationId = String(alert?._id || '');
                                if (!notificationId || !to) return;

                                // Read persistence is completed by NotificationItem before
                                // this destination callback runs.
                                void api.post(`/users/notifications/${notificationId}/click`).catch(() => {});

                                if (/^https?:\/\//i.test(String(to || ''))) {
                                  window.location.assign(to);
                                } else {
                                  navigate(to);
                                }
                              }}
                            />
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </section>
                );
              })}

              {visibleCount < filteredAlerts.length && (
              <div ref={sentinelRef} className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                {t('common.loading', 'Chargement...')}
              </div>
            )}
          </div>
          ) : (
            <div className="mt-14 text-center">
              <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00]">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-medium text-neutral-900 dark:text-neutral-100">
                  {t('notifications.emptyTitle', 'Aucune notification')}
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                  {t('notifications.emptySubtitle', 'Votre flux est à jour. Les nouveaux événements apparaîtront ici.')}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      {undoDelete && (
        <div className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-sm">
          <span className="text-sm font-bold">Notification supprimée</span>
          <button type="button" onClick={restoreLastDeleted} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-orange-300">Annuler</button>
        </div>
      )}
    </main>
  );
}
