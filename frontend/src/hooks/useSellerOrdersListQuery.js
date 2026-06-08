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

const dedupeOrders = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((entry) => {
    const id = String(entry?._id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const normalizeOrdersListPayload = (payload, fallbackPage = 1) => {
  const rawItems = Array.isArray(payload) ? payload : payload?.items || [];
  const items = dedupeOrders(rawItems);
  return {
    items,
    total: Number(payload?.total ?? items.length),
    totalPages: Math.max(1, Number(payload?.totalPages) || 1),
    page: Math.max(1, Number(payload?.page) || Number(fallbackPage) || 1),
    nextCursor: String(payload?.nextCursor || ''),
    hasMore: Boolean(payload?.hasMore)
  };
};

export const useSellerOrdersListQuery = ({
  limit = 10,
  status = 'all',
  enabled = true
} = {}) => {
  const { rapid3GActive } = useNetworkProfile();

  return useInfiniteQuery({
    queryKey: orderQueryKeys.list('seller', { limit, status, mode: 'infinite' }),
    initialPageParam: '',
    enabled: Boolean(enabled),
    queryFn: async ({ pageParam = '' }) => {
      const cursor = String(pageParam || '');
      const params = { limit };
      if (cursor) params.cursor = cursor;
      if (status && status !== 'all') {
        if (isOrderGroupKey('seller', status)) {
          params.statusGroup = status;
        } else {
          params.status = status;
        }
      }
      const { data } = await api.get('/orders/seller', {
        params,
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return normalizeOrdersListPayload(data, 1);
    },
    staleTime: rapid3GActive ? 45_000 : 20_000,
    getNextPageParam: (lastPage) => {
      return lastPage?.nextCursor || undefined;
    },
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const pages = Array.isArray(query?.state?.data?.pages) ? query.state.data.pages : [];
      const items = pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : []));
      return items.some((item) =>
        ACTIVE_ORDER_STATUSES.has(String(item?.status || '').trim().toLowerCase())
      )
        ? rapid3GActive ? 60_000 : 30_000
        : false;
    }
  });
};

export default useSellerOrdersListQuery;
