import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const initialCounts = {
  waitingPayments: 0,
  unreadFeedback: 0
};

export default function useAdminCounts(enabled) {
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/stats');
      setCounts({
        waitingPayments: data?.payments?.waiting || 0,
        unreadFeedback: data?.feedback?.unread || 0
      });
      setError('');
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || 'Erreur lors du chargement des statistiques admin.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCounts(initialCounts);
      return;
    }

    loadCounts().catch(() => {});
    return () => {
    };
  }, [enabled, loadCounts]);

  useEffect(() => {
    if (!enabled) return () => {};
    const handler = () => {
      loadCounts().catch(() => {});
    };
    window.addEventListener('hdmarket:admin-counts-refresh', handler);
    return () => {
      window.removeEventListener('hdmarket:admin-counts-refresh', handler);
    };
  }, [enabled, loadCounts]);

  return { counts, loading, error };
}
