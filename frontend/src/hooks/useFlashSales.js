import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

const FETCH_STALE_MS = 30_000; // 30s — flash sales change frequently

/**
 * useFlashSales — React Query hook for active flash sales.
 */
export function useFlashSales({ page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ['flash-sales', 'active', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/flash-sales', {
        params: { page, limit }
      });
      return data;
    },
    staleTime: FETCH_STALE_MS,
    placeholderData: (prev) => prev
  });
}

/**
 * useFlashSale — Single flash sale by ID.
 */
export function useFlashSale(id) {
  return useQuery({
    queryKey: ['flash-sales', id],
    queryFn: async () => {
      const { data } = await api.get(`/flash-sales/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: FETCH_STALE_MS
  });
}
