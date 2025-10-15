import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const initialState = {
  commentAlerts: 0,
  alerts: []
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
      const nextState = {
        commentAlerts: data?.commentAlerts || 0,
        alerts: Array.isArray(data?.alerts) ? data.alerts : []
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
