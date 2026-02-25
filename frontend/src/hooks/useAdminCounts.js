import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { hasAnyPermission } from '../utils/permissions';

const initialCounts = {
  waitingPayments: 0,
  unreadFeedback: 0
};

export default function useAdminCounts(enabled) {
  const { user } = useContext(AuthContext);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canLoadCounts = useMemo(
    () => Boolean(enabled) && hasAnyPermission(user, ['view_admin_dashboard']),
    [enabled, user]
  );

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
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        setCounts(initialCounts);
        setError('');
        return;
      }
      setError(
        e.response?.data?.message || e.message || 'Erreur lors du chargement des statistiques admin.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canLoadCounts) {
      setCounts(initialCounts);
      setError('');
      setLoading(false);
      return;
    }

    loadCounts().catch(() => {});
    return () => {
    };
  }, [canLoadCounts, loadCounts]);

  useEffect(() => {
    if (!canLoadCounts) return () => {};
    const handler = () => {
      loadCounts().catch(() => {});
    };
    window.addEventListener('hdmarket:admin-counts-refresh', handler);
    return () => {
      window.removeEventListener('hdmarket:admin-counts-refresh', handler);
    };
  }, [canLoadCounts, loadCounts]);

  return { counts, loading, error };
}
