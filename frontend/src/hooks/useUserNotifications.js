import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

const initialState = {
  commentAlerts: 0,
  alerts: [],
  unreadCount: 0
};

export default function useUserNotifications(enabled) {
  const [counts, setCounts] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const EVENT_KEY = 'hdmarket:notifications-refresh';

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setCounts({ ...initialState });
      return initialState;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/users/notifications');
      const unread = data?.commentAlerts ?? data?.unreadCount ?? 0;
      const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
      const nextState = {
        commentAlerts: unread,
        unreadCount: unread,
        alerts
      };
      setCounts(nextState);
      setError('');
      return nextState;
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Erreur lors du chargement des notifications.');
      return initialState;
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
      setCounts({ ...initialState });
      setError('');
      return () => {
        closeSource();
        clearRetry();
      };
    }

    const token = window.localStorage.getItem('qm_token');
    if (!token) {
      closeSource();
      clearRetry();
      return () => {
        closeSource();
        clearRetry();
      };
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5010/api';
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
    const handler = () => {
      fetchData();
    };
    window.addEventListener(EVENT_KEY, handler);
    return () => {
      window.removeEventListener(EVENT_KEY, handler);
    };
  }, [fetchData]);

  return { counts, loading, error, refresh: fetchData };
}

export const triggerNotificationsRefresh = () => {
  window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
};
