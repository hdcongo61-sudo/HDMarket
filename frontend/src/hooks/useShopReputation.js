import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * useShopReputation — Fetch seller reputation/level data.
 */
export function useShopReputation(slug) {
  return useQuery({
    queryKey: ['shop-reputation', slug],
    queryFn: async () => {
      const { data } = await api.get(`/seller-reputation/shop/${slug}/reputation`);
      return data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000 // 5 min
  });
}
