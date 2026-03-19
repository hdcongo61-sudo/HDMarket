import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  Check,
  ClipboardList,
  CreditCard,
  Gavel,
  MessageSquare,
  Package,
  ShieldAlert,
  Sparkles,
  Store,
  Truck
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import useUserNotifications, { triggerNotificationsRefresh } from '../hooks/useUserNotifications';
import usePullToRefresh from '../hooks/usePullToRefresh';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';
import { resolveNotificationLink } from '../utils/notificationLinks';
import NotificationItem from '../components/notifications/NotificationItem';
import NotificationSkeleton from '../components/notifications/NotificationSkeleton';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import { useAppSettings } from '../context/AppSettingsContext';
import GlassHeader from '../components/ui/GlassHeader';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';

const SELLER_ORDER_NOTIFICATION_TYPES = new Set([
  'order_received',
  'order_reminder',
  'installment_sale_confirmation_required',
  'installment_payment_submitted',
  'order_address_updated',
  'installment_product_suspended'
]);

const ORDER_TYPES = new Set([
  'order_created',
  'order_received',
  'order_reminder',
  'order_cancelled',
  'order_cancellation_window_skipped',
  'order_message',
  'order_address_updated',
  'order_delivery_fee_updated'
]);

const BOOST_TYPES = new Set(['product_boosted']);
const DISPUTE_TYPES = new Set([
  'dispute_created',
  'dispute_seller_responded',
  'dispute_deadline_near',
  'dispute_under_review',
  'dispute_resolved'
]);
const DELIVERY_TYPES = new Set(['order_delivering', 'order_delivered']);
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
  'installment_overdue_warning'
]);

const TYPE_PRIORITY = Object.freeze({
  dispute_deadline_near: 110,
  validation_required: 108,
  account_restriction: 105,
  order_cancelled: 100,
  installment_overdue_warning: 98,
  dispute_created: 95,
  payment_pending: 92,
  order_received: 88,
  order_created: 84,
  order_reminder: 82,
  order_delivering: 80,
  order_delivered: 78,
  delivery_request_created: 79,
  delivery_request_accepted: 81,
  delivery_request_rejected: 83,
  delivery_request_assigned: 80,
  delivery_request_in_progress: 79,
  delivery_request_delivered: 78,
  dispute_seller_responded: 76,
  dispute_under_review: 75,
  dispute_resolved: 74,
  admin_broadcast: 70,
  product_boosted: 68,
  installment_sale_confirmation_required: 65,
  installment_payment_submitted: 64,
  installment_payment_validated: 62
});

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
  if (ORDER_TYPES.has(type)) return 'orders';
  if (DISPUTE_TYPES.has(type)) return 'dispute';
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
  if (ORDER_TYPES.has(type)) return { title: t('notifications.orderUpdate', 'Mise à jour commande'), icon: <Package className="h-4 w-4" /> };
  if (DELIVERY_TYPES.has(type) || PLATFORM_DELIVERY_TYPES.has(type)) {
    return { title: t('notifications.deliveryUpdate', 'Mise à jour livraison'), icon: <Truck className="h-4 w-4" /> };
  }
  if (DISPUTE_TYPES.has(type)) return { title: t('notifications.disputeUpdate', 'Mise à jour litige'), icon: <Gavel className="h-4 w-4" /> };
  if (VALIDATION_TYPES.has(type)) return { title: t('notifications.validationRequired', 'Action requise'), icon: <ShieldAlert className="h-4 w-4" /> };
  if (type === 'payment_pending') return { title: t('notifications.paymentPending', 'Paiement en attente'), icon: <CreditCard className="h-4 w-4" /> };
  if (type === 'order_message') return { title: t('notifications.orderMessage', 'Message commande'), icon: <MessageSquare className="h-4 w-4" /> };
  if (type === 'admin_broadcast') return { title: t('notifications.adminMessage', 'Message admin'), icon: <ShieldAlert className="h-4 w-4" /> };
  if (type === 'product_boosted' || /boost/i.test(String(alert?.message || ''))) {
    return { title: t('notifications.boost', 'Boost'), icon: <Sparkles className="h-4 w-4" /> };
  }
  if (type === 'account_restriction' || type === 'account_restriction_lifted') {
    return { title: t('notifications.accountAlert', 'Alerte compte'), icon: <AlertCircle className="h-4 w-4" /> };
  }
  if (type === 'shop_follow' || type === 'shop_review') {
    return { title: t('notifications.shop', 'Boutique'), icon: <Store className="h-4 w-4" /> };
  }
  if (type.startsWith('installment_')) {
    return { title: t('notifications.installment', 'Paiement par tranche'), icon: <ClipboardList className="h-4 w-4" /> };
  }
  return { title: t('notifications.notification', 'Notification'), icon: <Bell className="h-4 w-4" /> };
};

const buildOrderNotificationPath = (alert, user) => {
  const orderId =
    extractObjectId(alert?.metadata?.orderId) ||
    extractObjectId(alert?.entityId) ||
    extractObjectId(alert?.metadata?.entityId);
  const normalizedRole = String(user?.role || '').toLowerCase();
  const normalizedAccountType = String(user?.accountType || '').toLowerCase();
  const isBackOffice = ['admin', 'founder', 'manager'].includes(normalizedRole);
  const isSeller = normalizedRole === 'seller' || normalizedAccountType === 'shop';

  if (alert?.type === 'order_message') {
    if (!orderId) return '/orders/messages';
    return `/orders/messages?orderId=${encodeURIComponent(orderId)}`;
  }

  if (!orderId) {
    return '';
  }
  if (isBackOffice) {
    return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  }
  if (isSeller && (SELLER_ORDER_NOTIFICATION_TYPES.has(alert?.type) || alert?.type === 'order_message')) {
    return `/seller/orders/detail/${orderId}`;
  }
  return `/orders/detail/${orderId}`;
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
  if (primaryLink) actions.push({ to: primaryLink, label: t('notifications.openTask', 'Ouvrir tâche') });
  if (orderPath) actions.push({ to: orderPath, label: t('notifications.viewOrder', 'Voir commande') });
  const disputePath = buildDisputeNotificationPath(alert, user);
  if (disputePath) actions.push({ to: disputePath, label: t('notifications.viewDispute', 'Voir litige') });
  if (alert?.type === 'payment_pending' && (user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager')) {
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

const getPriorityScore = (alert) => {
  const createdAt = new Date(alert?.createdAt || Date.now()).getTime();
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
  const recencyBoost = Math.max(0, 24 - ageHours);
  const base = TYPE_PRIORITY[alert?.type] || 55;
  const unreadBoost = alert?.isNew ? 26 : 0;
  return base + unreadBoost + recencyBoost;
};

const applyFilter = (alert, filterKey) => {
  if (filterKey === 'all') return true;
  if (filterKey === 'unread') return Boolean(alert?.isNew);
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
  const [visibleCount, setVisibleCount] = useState(20);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');
  const sentinelRef = useRef(null);
  const filters = useMemo(
    () => [
      { key: 'all', label: t('notifications.filters.all', 'Tout') },
      { key: 'unread', label: t('notifications.filters.unread', 'Non lues') },
      { key: 'orders', label: t('notifications.filters.orders', 'Commandes') },
      { key: 'boost', label: t('notifications.filters.boost', 'Boost') },
      { key: 'dispute', label: t('notifications.filters.dispute', 'Litiges') },
      { key: 'delivery', label: t('notifications.filters.delivery', 'Livraison') },
      { key: 'admin', label: t('notifications.filters.admin', 'Admin') },
      { key: 'system', label: t('notifications.filters.system', 'Système') }
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

  const prioritizedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const scoreDiff = getPriorityScore(b) - getPriorityScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [alerts]);

  const filteredAlerts = useMemo(
    () => prioritizedAlerts.filter((alert) => applyFilter(alert, activeFilter)),
    [prioritizedAlerts, activeFilter]
  );

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
      const bucket = getDateBucket(alert?.createdAt);
      buckets[bucket].push(alert);
    });
    return buckets;
  }, [visibleAlerts]);

  const filterCounts = useMemo(() => {
    const countsMap = {
      all: alerts.length,
      unread: alerts.filter((alert) => alert?.isNew).length,
      orders: alerts.filter((alert) => resolveCategory(alert) === 'orders').length,
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
    try {
      await fetchMarkRead(notificationIds);
      const idSet = new Set(notificationIds.map((id) => String(id)));
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
      triggerNotificationsRefresh({ type: 'markRead', notificationIds, refetch: false });
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t('notifications.errors.markRead', 'Impossible de marquer la notification comme lue.')
      );
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
    try {
      await api.delete(`/users/notifications/${notificationId}`);
      updateCounts((prev) => {
        const previousAlerts = Array.isArray(prev?.alerts) ? prev.alerts : [];
        const notificationIdStr = String(notificationId);
        const deleted = previousAlerts.find((alert) => String(alert?._id) === notificationIdStr);
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
        next.delete(notificationId);
        return next;
      });
      triggerNotificationsRefresh({ type: 'delete', notificationId, refetch: false });
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t('notifications.errors.delete', 'Impossible de supprimer la notification.')
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setActionError('');
    try {
      await fetchMarkRead([]);
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

  if (!user) {
    return (
      <main className="glass-page-shell min-h-screen px-5 py-16 text-center">
        <div className="mx-auto max-w-sm">
          <div className="glass-card mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <Bell className="h-7 w-7 text-neutral-500 dark:text-neutral-300" />
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
    <main className="glass-page-shell min-h-screen text-neutral-900 dark:text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        {(offlineSnapshotActive || rapid3GActive) && (
          <div className="px-4 pt-4">
            <section
              className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                offlineSnapshotActive
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
              }`}
            >
              <p className="font-semibold">
                {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
              </p>
            </section>
          </div>
        )}
        <header className="sticky top-0 z-30 px-4 pb-3 pt-4">
          <GlassHeader
            title={t('notifications.title', 'Notifications')}
            subtitle={
              unreadCount > 0
                ? `${unreadCount} ${t('notifications.newCount', `nouvelle${unreadCount > 1 ? 's' : ''}`)}`
                : `${alerts.length} ${t('notifications.notificationCount', `notification${alerts.length > 1 ? 's' : ''}`)}`
            }
            className="rounded-2xl"
          >
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount < 1}
              className="glass-card inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-45 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              <Check className="h-3.5 w-3.5" />
              {markingAll ? '...' : t('notifications.markAllRead', 'Tout lire')}
            </button>
          </GlassHeader>
          <div className="glass-card mt-3 overflow-x-auto rounded-2xl p-2">
            <div className="flex w-max items-center gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                        : 'glass-card text-neutral-600 hover:bg-white/80 dark:text-neutral-300 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActive ? 'bg-white/30 dark:bg-black/20' : 'bg-neutral-100/80 dark:bg-neutral-800/80'
                      }`}
                    >
                      {filterCounts[filter.key] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <section className="relative px-4 pb-10" {...bind}>
          <AnimatePresence>
            {(pullDistance > 0 || refreshing) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center justify-center py-2"
              >
                <div className="glass-card inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-neutral-500 dark:text-neutral-300">
                  <Bell className={`h-3.5 w-3.5 ${refreshing ? 'animate-pulse' : ''}`} />
                  {refreshing ? t('notifications.refreshing', 'Actualisation…') : t('notifications.pullToRefresh', 'Relâchez pour actualiser')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {actionError && (
            <div className="soft-card soft-card-red mt-4 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-100">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="mt-3">
              <NotificationSkeleton count={8} />
            </div>
          ) : error && !offlineSnapshotActive ? (
            <div className="mt-6">
              <div className="glass-card rounded-2xl p-1 shadow-sm">
                <NetworkFallbackCard
                  title={t('notifications.errors.loadTitle', 'Unable to load data.')}
                  message={t('notifications.errors.load', 'Network is slow, please retry.')}
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
                    <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                      {title}
                    </h2>
                    <div className="divide-y divide-white/35 dark:divide-neutral-800">
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
                              timeLabel={getRelativeTime(alert?.createdAt, t, language)}
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
                                if (isUnread) {
                                  handleMarkRead([alert._id]);
                                }
                              }}
                              onMarkRead={() => handleMarkRead([alert._id])}
                              onDelete={() => handleDelete(alert._id)}
                              onNavigateAction={(to) => {
                                api.post(`/users/notifications/${alert._id}/click`).catch(() => {});
                                if (/^https?:\/\//i.test(String(to || ''))) {
                                  window.location.assign(to);
                                } else {
                                  navigate(to);
                                }
                                if (isUnread) {
                                  handleMarkRead([alert._id]);
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
              <div className="glass-card mx-auto max-w-md rounded-2xl p-6 shadow-sm">
                <div className="glass-card mx-auto flex h-14 w-14 items-center justify-center rounded-full">
                  <Bell className="h-6 w-6 text-neutral-500 dark:text-neutral-300" />
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
    </main>
  );
}
