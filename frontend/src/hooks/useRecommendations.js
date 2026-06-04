import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../services/api';

const DEFAULT_PAGE_SIZE = 20;

export const useRecommendations = ({
  enabled = true,
  excludeProductIds = []
} = {}) => {
  const excludeKey = useMemo(
    () => [...excludeProductIds].sort().join(','),
    [excludeProductIds]
  );

  return useInfiniteQuery({
    queryKey: ['recommendations', excludeKey],
    enabled: Boolean(enabled),
    queryFn: async ({ pageParam = 1 }) => {
      const params = { page: pageParam, limit: DEFAULT_PAGE_SIZE };
      if (excludeProductIds.length > 0) {
        params.exclude = excludeProductIds.join(',');
      }
      const { data } = await api.get('/products/recommendations', {
        params,
        skipCache: false,
        headers: {}
      });
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.hasMore === false) return undefined;
      const nextPage = (lastPage.page || 0) + 1;
      return nextPage <= (lastPage.totalPages || 1) ? nextPage : undefined;
    },
    initialPageParam: 1,
    staleTime: 60_000,      // 1 minute
    refetchOnWindowFocus: false,
    refetchInterval: false
  });
};

export default useRecommendations;
