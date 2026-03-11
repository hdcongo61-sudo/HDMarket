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

const computeUnread = (messages = [], userId = '') => {
  if (!Array.isArray(messages) || !userId) return 0;
  return messages.filter((message) => {
    const recipientId = message?.recipient?._id || message?.recipient || '';
    return String(recipientId) === String(userId) && !message?.readAt;
  }).length;
};

export const useBuyerOrderDetailQuery = ({ orderId, userId, enabled = true } = {}) =>
  useQuery({
    queryKey: orderQueryKeys.detail('user', orderId),
    enabled: Boolean(enabled && orderId),
    queryFn: async () => {
      const [orderResponse, messagesResponse] = await Promise.all([
        api.get(`/orders/detail/${orderId}`, {
          skipCache: true,
          headers: { 'x-skip-cache': '1' }
        }),
        api.get(`/orders/${orderId}/messages`, {
          skipCache: true,
          headers: { 'x-skip-cache': '1' }
        })
      ]);
      const order = orderResponse?.data || null;
      const messages = Array.isArray(messagesResponse?.data) ? messagesResponse.data : [];
      return {
        order,
        unreadCount: computeUnread(messages, userId),
        messages
      };
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = String(query?.state?.data?.order?.status || '');
      return ACTIVE_ORDER_STATUSES.has(status) ? 15_000 : false;
    }
  });

export default useBuyerOrderDetailQuery;
