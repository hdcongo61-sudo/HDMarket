import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { orderQueryKeys } from './useOrderQueryKeys';

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
    page: Math.max(1, Number(payload?.page) || Number(fallbackPage) || 1)
  };
};

export const useSellerOrdersListQuery = ({
  page = 1,
  limit = 10,
  status = 'all',
  enabled = true
} = {}) =>
  useQuery({
    queryKey: orderQueryKeys.list('seller', { page, limit, status }),
    enabled: Boolean(enabled),
    queryFn: async () => {
      const params = { page, limit };
      if (status && status !== 'all') {
        params.status = status;
      }
      const { data } = await api.get('/orders/seller', {
        params,
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return normalizeOrdersListPayload(data, page);
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const items = Array.isArray(query?.state?.data?.items) ? query.state.data.items : [];
      return items.some((item) =>
        ACTIVE_ORDER_STATUSES.has(String(item?.status || '').trim().toLowerCase())
      )
        ? 15_000
        : false;
    }
  });

export default useSellerOrdersListQuery;
