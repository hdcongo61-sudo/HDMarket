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
import NotificationItem from '../components/notifications/NotificationItem';
import NotificationSkeleton from '../components/notifications/NotificationSkeleton';
import { useAppSettings } from '../context/AppSettingsContext';

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
  'order_message',
  'order_address_updated'
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
const ADMIN_TYPES = new Set(['admin_broadcast']);
const SYSTEM_TYPES = new Set([
  'account_restriction',
  'account_restriction_lifted',
  'payment_pending',
  'installment_overdue_warning'
]);

const TYPE_PRIORITY = Object.freeze({
  dispute_deadline_near: 110,
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

const resolveCategory = (alert) => {
  const type = alert?.type || '';
  if (ORDER_TYPES.has(type)) return 'orders';
  if (DISPUTE_TYPES.has(type)) return 'dispute';
  if (DELIVERY_TYPES.has(type)) return 'delivery';
  if (ADMIN_TYPES.has(type)) return 'admin';
  if (SYSTEM_TYPES.has(type)) return 'system';
  if (BOOST_TYPES.has(type)) return 'boost';
  if (type === 'admin_broadcast' && /boost/i.test(String(alert?.message || ''))) return 'boost';
  return 'system';
};

const notificationMeta = (alert, t) => {
  const type = alert?.type || '';
  if (ORDER_TYPES.has(type)) return { title: t('notifications.orderUpdate', 'Mise à jour commande'), icon: <Package className="h-4 w-4" /> };
  if (DELIVERY_TYPES.has(type)) return { title: t('notifications.deliveryUpdate', 'Mise à jour livraison'), icon: <Truck className="h-4 w-4" /> };
  if (DISPUTE_TYPES.has(type)) return { title: t('notifications.disputeUpdate', 'Mise à jour litige'), icon: <Gavel className="h-4 w-4" /> };
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
  const orderId = String(alert?.metadata?.orderId || '').trim();
  if (!orderId) return '';
  if (user?.role === 'admin' || user?.role === 'manager') {
    return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  }
  if (SELLER_ORDER_NOTIFICATION_TYPES.has(alert?.type)) {
    return `/seller/orders/detail/${orderId}`;
  }
  return `/orders/detail/${orderId}`;
};

const buildDisputeNotificationPath = (alert, user) => {
  if (!DISPUTE_TYPES.has(alert?.type)) return '';
  if (user?.role === 'admin' || user?.role === 'manager' || user?.canManageComplaints) {
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
  if (orderPath) actions.push({ to: orderPath, label: t('notifications.viewOrder', 'Voir commande') });
  const disputePath = buildDisputeNotificationPath(alert, user);
  if (disputePath) actions.push({ to: disputePath, label: t('notifications.viewDispute', 'Voir litige') });
  if (alert?.type === 'payment_pending' && (user?.role === 'admin' || user?.role === 'manager')) {
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
  const { counts, loading, error, refresh, updateCounts } = useUserNotifications(Boolean(user), {
    skipRefreshEvent: true
  });
  const alerts = Array.isArray(counts?.alerts) ? counts.alerts : [];
  const unreadCount = Number(counts?.unreadCount || 0);

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
      const idSet = new Set(notificationIds);
      updateCounts((prev) => {
        const previousAlerts = Array.isArray(prev?.alerts) ? prev.alerts : [];
        const markedUnread = previousAlerts.filter((alert) => idSet.has(alert._id) && alert.isNew).length;
        const nextAlerts = previousAlerts.map((alert) =>
          idSet.has(alert._id) ? { ...alert, isNew: false, readAt: alert.readAt || new Date().toISOString() } : alert
        );
        return {
          ...prev,
          alerts: nextAlerts,
          unreadCount: Math.max(0, Number(prev?.unreadCount || 0) - markedUnread),
          commentAlerts: Math.max(0, Number(prev?.commentAlerts || 0) - markedUnread)
        };
      });
      triggerNotificationsRefresh();
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
        const deleted = previousAlerts.find((alert) => alert._id === notificationId);
        const wasUnread = Boolean(deleted?.isNew);
        return {
          ...prev,
          alerts: previousAlerts.filter((alert) => alert._id !== notificationId),
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
      triggerNotificationsRefresh();
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
      triggerNotificationsRefresh();
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
      <main className="min-h-screen bg-white px-5 py-16 text-center dark:bg-neutral-950">
        <div className="mx-auto max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
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
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        <header className="sticky top-0 z-30 border-b border-neutral-200/90 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/90">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('notifications.title', 'Notifications')}</h1>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {unreadCount > 0
                  ? `${unreadCount} ${t('notifications.newCount', `nouvelle${unreadCount > 1 ? 's' : ''}`)}`
                  : `${alerts.length} ${t('notifications.notificationCount', `notification${alerts.length > 1 ? 's' : ''}`)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount < 1}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              <Check className="h-3.5 w-3.5" />
              {markingAll ? '...' : t('notifications.markAllRead', 'Tout lire')}
            </button>
          </div>
          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex w-max items-center gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActive ? 'bg-white/20 dark:bg-neutral-900/10' : 'bg-neutral-100 dark:bg-neutral-800'
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
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <Bell className={`h-3.5 w-3.5 ${refreshing ? 'animate-pulse' : ''}`} />
                  {refreshing ? t('notifications.refreshing', 'Actualisation…') : t('notifications.pullToRefresh', 'Relâchez pour actualiser')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {actionError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="mt-3">
              <NotificationSkeleton count={8} />
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
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
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
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
                                navigate(to);
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Bell className="h-6 w-6 text-neutral-500 dark:text-neutral-300" />
              </div>
              <h3 className="mt-4 text-base font-medium text-neutral-900 dark:text-neutral-100">
                {t('notifications.emptyTitle', 'Aucune notification')}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                {t('notifications.emptySubtitle', 'Votre flux est à jour. Les nouveaux événements apparaîtront ici.')}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
