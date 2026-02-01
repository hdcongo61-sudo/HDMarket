import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

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
  feedback_read: true
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
    setLoading(true);
    try {
      const { data } = await api.get('/users/notifications');
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

    let token = window.localStorage.getItem('qm_token');
    // Handle token that may be JSON-stringified (has quotes around it)
    if (token) {
      try {
        const parsed = JSON.parse(token);
        if (typeof parsed === 'string') {
          token = parsed;
        }
      } catch {
        // Token is already a plain string, use as-is
      }
    }
    if (!token) {
      closeSource();
      clearRetry();
      return () => {
        closeSource();
        clearRetry();
      };
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const streamUrl = new URL('users/notifications/stream', normalizedBase);
    streamUrl.searchParams.set('token', token);

    const connect = () => {
      clearRetry();
      closeSource();
      const source = new EventSource(streamUrl.toString());
      eventSourceRef.current = source;

      source.onopen = () => {
        fetchData();
      };

      source.onmessage = (event) => {
        if (!event?.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'connected') return;
        } catch {
          // ignore parse errors and still refresh
        }
        fetchData();
      };

      source.onerror = () => {
        closeSource();
        retryRef.current = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      closeSource();
      clearRetry();
    };
  }, [enabled, fetchData]);

  useEffect(() => {
    if (skipRefreshEvent) return;
    const handler = () => {
      fetchData();
    };
    window.addEventListener(EVENT_KEY, handler);
    return () => {
      window.removeEventListener(EVENT_KEY, handler);
    };
  }, [fetchData, skipRefreshEvent]);

  return { counts, loading, error, refresh: fetchData, updateCounts };
}

export const triggerNotificationsRefresh = () => {
  window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
};
