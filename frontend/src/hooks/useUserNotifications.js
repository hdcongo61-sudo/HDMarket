import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import storage from '../utils/storage.js';

const DEFAULT_PREFERENCES = Object.freeze({
  product_comment: true,
  reply: true,
  favorite: true,
  rating: true,
  product_approval: true,
  product_rejection: true,
  promotional: true,
  shop_review: true,
  shop_follow: true,
  payment_pending: true,
  order_created: true,
  order_received: true,
  order_reminder: true,
  order_delivering: true,
  order_delivered: true,
  installment_due_reminder: true,
  installment_overdue_warning: true,
  installment_payment_submitted: true,
  installment_payment_validated: true,
  installment_sale_confirmation_required: true,
  installment_sale_confirmed: true,
  installment_completed: true,
  installment_product_suspended: true,
  review_reminder: true,
  order_address_updated: true,
  order_message: true,
  order_cancelled: true,
  dispute_created: true,
  dispute_seller_responded: true,
  dispute_deadline_near: true,
  dispute_under_review: true,
  dispute_resolved: true,
  feedback_read: true,
  complaint_created: true,
  improvement_feedback_created: true,
  admin_broadcast: true,
  account_restriction: true,
  account_restriction_lifted: true,
  shop_conversion_approved: true,
  shop_conversion_rejected: true
});

const buildDefaultPreferences = () => ({ ...DEFAULT_PREFERENCES });

const normalizePreferences = (prefs = {}) => {
  const merged = buildDefaultPreferences();
  Object.keys(merged).forEach((key) => {
    if (typeof prefs[key] === 'boolean') {
      merged[key] = prefs[key];
    }
  });
  return merged;
};

const buildInitialState = () => ({
  commentAlerts: 0,
  alerts: [],
  unreadCount: 0,
  preferences: buildDefaultPreferences()
});

const applyNotificationsPatch = (prev, patch = {}) => {
  const state = prev && typeof prev === 'object' ? prev : buildInitialState();
  const alerts = Array.isArray(state.alerts) ? state.alerts : [];
  const patchType = String(patch?.type || '').trim();

  if (patchType === 'reset') {
    return buildInitialState();
  }

  if (patchType === 'markAllRead') {
    return {
      ...state,
      alerts: alerts.map((alert) => ({ ...alert, isNew: false, readAt: alert?.readAt || new Date().toISOString() })),
      unreadCount: 0,
      commentAlerts: 0
    };
  }

  if (patchType === 'markRead') {
    const ids = Array.isArray(patch.notificationIds)
      ? patch.notificationIds.map((id) => String(id))
      : [];
    if (!ids.length) return state;
    const idSet = new Set(ids);
    const unreadToMark = alerts.filter((alert) => idSet.has(String(alert?._id)) && alert?.isNew).length;
    return {
      ...state,
      alerts: alerts.map((alert) =>
        idSet.has(String(alert?._id))
          ? { ...alert, isNew: false, readAt: alert?.readAt || new Date().toISOString() }
          : alert
      ),
      unreadCount: Math.max(0, Number(state.unreadCount || 0) - unreadToMark),
      commentAlerts: Math.max(0, Number(state.commentAlerts || 0) - unreadToMark)
    };
  }

  if (patchType === 'delete') {
    const notificationId = String(patch.notificationId || '').trim();
    if (!notificationId) return state;
    const removed = alerts.find((alert) => String(alert?._id) === notificationId);
    const wasUnread = Boolean(removed?.isNew);
    return {
      ...state,
      alerts: alerts.filter((alert) => String(alert?._id) !== notificationId),
      unreadCount: wasUnread ? Math.max(0, Number(state.unreadCount || 0) - 1) : Number(state.unreadCount || 0),
      commentAlerts: wasUnread
        ? Math.max(0, Number(state.commentAlerts || 0) - 1)
        : Number(state.commentAlerts || 0)
    };
  }

  return state;
};

const readAuthToken = async () => {
  try {
    const token = await storage.get('qm_token');
    if (typeof token === 'string') return token.trim();
    if (!token) return '';
    return String(token).trim();
  } catch {
    return '';
  }
};

export default function useUserNotifications(enabled, options = {}) {
  const { skipRefreshEvent = false } = options;
  const [counts, setCounts] = useState(() => buildInitialState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const EVENT_KEY = 'hdmarket:notifications-refresh';

  /** Update counts locally without refetch (e.g. after mark-as-read or delete). */
  const updateCounts = useCallback((updater) => {
    setCounts((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      const emptyState = buildInitialState();
      setCounts(emptyState);
      return emptyState;
    }
    const token = await readAuthToken();
    if (!token) {
      const emptyState = buildInitialState();
      setCounts(emptyState);
      setError('');
      return emptyState;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/users/notifications', { skipCache: true });
      const unread =
        typeof data?.unreadCount === 'number'
          ? data.unreadCount
          : typeof data?.commentAlerts === 'number'
          ? data.commentAlerts
          : 0;
      const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
      const nextState = {
        commentAlerts: unread,
        unreadCount: unread,
        alerts,
        preferences: normalizePreferences(data?.preferences)
      };
      setCounts(nextState);
      setError('');
      return nextState;
    } catch (e) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const emptyState = buildInitialState();
        setCounts(emptyState);
        setError('');
        return emptyState;
      }
      setError(e.response?.data?.message || e.message || 'Erreur lors du chargement des notifications.');
      return buildInitialState();
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eventSourceRef = useRef(null);
  const retryRef = useRef(null);
  const socketRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchData();
    }, 120);
  }, [fetchData]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};

    const closeSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    if (!enabled) {
      closeSource();
      clearRetry();
      setCounts(buildInitialState());
      setError('');
      return () => {
        closeSource();
        clearRetry();
      };
    }

    let cancelled = false;

    const initializeStream = async () => {
      const token = await readAuthToken();
      if (cancelled) return;
      if (!token) {
        closeSource();
        clearRetry();
        return;
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const streamUrl = new URL('users/notifications/stream', normalizedBase);
      streamUrl.searchParams.set('token', token);

      const connect = () => {
        if (cancelled) return;
        clearRetry();
        closeSource();
        const source = new EventSource(streamUrl.toString());
        eventSourceRef.current = source;

        source.onopen = () => {
          scheduleRefresh();
        };

        source.onmessage = (event) => {
          if (!event?.data) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type === 'connected') return;
          } catch {
            // ignore parse errors and still refresh
          }
          scheduleRefresh();
        };

        source.onerror = () => {
          closeSource();
          retryRef.current = setTimeout(() => {
            if (!cancelled) connect();
          }, 5000);
        };
      };

      connect();
    };

    initializeStream();

    return () => {
      cancelled = true;
      closeSource();
      clearRetry();
    };
  }, [enabled, scheduleRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    let cancelled = false;
    let mountedSocket = null;

    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return () => {};
    }

    const initializeSocket = async () => {
      const token = await readAuthToken();
      if (cancelled || !token) return;

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const origin = apiBase.replace(/\/api\/?$/, '');
      const socket = io(`${origin}/notifications`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 20,
        reconnectionDelay: 800
      });
      mountedSocket = socket;
      if (cancelled) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on('connect', () => {
        scheduleRefresh();
      });
      socket.on('notification', () => {
        scheduleRefresh();
      });
      socket.on('notifications:refresh', () => {
        scheduleRefresh();
      });
      socket.on('connect_error', () => {
        // SSE fallback remains active.
      });
    };

    initializeSocket();

    return () => {
      cancelled = true;
      if (mountedSocket) {
        mountedSocket.disconnect();
      }
      if (socketRef.current === mountedSocket) {
        socketRef.current = null;
      }
    };
  }, [enabled, scheduleRefresh]);

  useEffect(() => {
    if (skipRefreshEvent) return;
    const handler = (event) => {
      const detail = event?.detail && typeof event.detail === 'object' ? event.detail : null;
      const patchType = String(detail?.type || '').trim();
      if (patchType) {
        updateCounts((prev) => applyNotificationsPatch(prev, detail));
      }
      if (
        patchType &&
        ['markRead', 'markAllRead', 'delete', 'reset'].includes(patchType) &&
        detail?.refetch !== true
      ) {
        return;
      }
      scheduleRefresh();
    };
    window.addEventListener(EVENT_KEY, handler);
    return () => {
      window.removeEventListener(EVENT_KEY, handler);
    };
  }, [scheduleRefresh, skipRefreshEvent, updateCounts]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  return { counts, loading, error, refresh: fetchData, updateCounts };
}

export const triggerNotificationsRefresh = (detail = null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('hdmarket:notifications-refresh', {
      detail: detail && typeof detail === 'object' ? detail : undefined
    })
  );
};
