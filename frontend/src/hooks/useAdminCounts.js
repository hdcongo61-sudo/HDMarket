import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { hasAnyPermission } from '../utils/permissions';

const initialCounts = {
  waitingPayments: 0,
  unreadFeedback: 0,
  pendingTasks: 0,
  pendingTasksByType: {},
  urgentTasks: 0,
  overdueTasks: 0
};

export default function useAdminCounts(enabled) {
  const { user } = useContext(AuthContext);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canLoadCounts = useMemo(
    () =>
      Boolean(enabled) &&
      (['admin', 'manager', 'founder'].includes(String(user?.role || '').toLowerCase()) ||
        hasAnyPermission(user, ['view_admin_dashboard'])),
    [enabled, user]
  );

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const isFounder = String(user?.role || '').toLowerCase() === 'founder';
      const [statsRes, tasksRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get(isFounder ? '/founder/tasks/summary' : '/admin/tasks/summary')
      ]);
      const data =
        statsRes.status === 'fulfilled' && statsRes.value?.data
          ? statsRes.value.data
          : {};
      const taskData =
        tasksRes.status === 'fulfilled' && tasksRes.value?.data
          ? tasksRes.value.data
          : {};
      setCounts({
        waitingPayments: data?.payments?.waiting || 0,
        unreadFeedback: data?.feedback?.unread || 0,
        pendingTasks: Number(taskData?.pendingTotal || 0),
        pendingTasksByType:
          taskData?.pendingByType && typeof taskData.pendingByType === 'object'
            ? taskData.pendingByType
            : {},
        urgentTasks: Number(taskData?.urgentCount || 0),
        overdueTasks: Number(taskData?.overdueCount || 0)
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
  }, [user?.role]);

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
