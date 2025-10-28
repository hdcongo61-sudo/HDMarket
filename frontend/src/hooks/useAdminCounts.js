import { useEffect, useState } from 'react';
import api from '../services/api';

const initialCounts = {
  waitingPayments: 0
};

export default function useAdminCounts(enabled) {
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setCounts(initialCounts);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/admin/stats');
        if (!active) return;
        setCounts({ waitingPayments: data?.payments?.waiting || 0 });
        setError('');
      } catch (e) {
        if (!active) return;
        setError(
          e.response?.data?.message || e.message || 'Erreur lors du chargement des statistiques admin.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [enabled]);

  return { counts, loading, error };
}
