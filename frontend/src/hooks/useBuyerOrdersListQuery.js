import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../services/api';
import { orderQueryKeys } from './useOrderQueryKeys';
import useNetworkProfile from './useNetworkProfile';
import { isOrderGroupKey } from '../utils/orderStatusEngine';

const ACTIVE_ORDER_STATUSES = new Set([
  'pending_payment',
  'paid',
  'ready_for_pickup',
  'ready_for_delivery',
  'out_for_delivery',
  'delivery_proof_submitted',
  'pending',
  'pending_installment',
  'installment_active',
  'overdue_installment',
  'confirmed',
  'delivering'
]);

const normalizeOrdersListPayload = (payload, fallbackPage = 1) => {
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return {
    items,
    total: Number(payload?.total ?? items.length),
    totalPages: Math.max(1, Number(payload?.totalPages) || 1),
    page: Math.max(1, Number(payload?.page) || Number(fallbackPage) || 1)
  };
};

export const useBuyerOrdersListQuery = ({
  limit = 10,
  status = 'all',
  enabled = true
} = {}) => {
  const { rapid3GActive } = useNetworkProfile();

  return useInfiniteQuery({
    queryKey: orderQueryKeys.list('user', { limit, status, mode: 'infinite' }),
    initialPageParam: 1,
    enabled: Boolean(enabled),
    queryFn: async ({ pageParam = 1 }) => {
      const page = Math.max(1, Number(pageParam) || 1);
      const params = { page, limit };
      if (status && status !== 'all') {
        if (isOrderGroupKey('buyer', status)) {
          params.statusGroup = status;
        } else {
          params.status = status;
        }
      }
      const { data } = await api.get('/orders', {
        params,
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return normalizeOrdersListPayload(data, page);
    },
    staleTime: rapid3GActive ? 45_000 : 20_000,
    getNextPageParam: (lastPage) => {
      const currentPage = Math.max(1, Number(lastPage?.page || 1));
      const totalPages = Math.max(1, Number(lastPage?.totalPages || 1));
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const pages = Array.isArray(query?.state?.data?.pages) ? query.state.data.pages : [];
      const items = pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : []));
      return items.some((item) => ACTIVE_ORDER_STATUSES.has(String(item?.status || '')))
        ? rapid3GActive ? 60_000 : 30_000
        : false;
    }
  });
};

export default useBuyerOrdersListQuery;
