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
        const { data } = await api.get('/payments/admin?status=waiting');
        if (!active) return;
        setCounts({ waitingPayments: Array.isArray(data) ? data.length : 0 });
        setError('');
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Erreur lors du chargement des paiements.');
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
