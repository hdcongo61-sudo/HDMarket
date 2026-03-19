import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import useReliableMutation from './useReliableMutation';
import { orderQueryKeys } from './useOrderQueryKeys';

const matchesTargetStatus = (order, nextStatus) => {
  if (!order || !nextStatus) return false;
  return String(order?.status || '') === String(nextStatus || '');
};

const normalizeMutationPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result?.order && result.order._id) return result.order;
  if (result?._id) return result;
  return null;
};

export const useBuyerOrderStatusMutation = ({ orderId, onApplied, onFailed } = {}) => {
  const queryClient = useQueryClient();
  const detailKey = orderQueryKeys.detail('user', orderId);

  return useReliableMutation({
    mutationFn: async ({ nextStatus, idempotencyKey }) => {
      const { data } = await api.patch(
        `/orders/${orderId}/status`,
        { status: nextStatus },
        {
          silentGlobalError: true,
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      return data;
    },
    verifyFn: async ({ nextStatus }) => {
      if (!orderId || !nextStatus) return false;
      const { data } = await api.get(`/orders/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      return matchesTargetStatus(data, nextStatus) ? data : false;
    },
    onMutate: async ({ nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);
      queryClient.setQueryData(detailKey, (existing) => {
        if (!existing?.order || !nextStatus) return existing;
        return {
          ...existing,
          order: {
            ...existing.order,
            status: nextStatus
          }
        };
      });
      return { previous };
    },
    onSuccess: async (result, variables, context) => {
      const nextOrder = normalizeMutationPayload(result?.data);
      if (nextOrder?._id) {
        queryClient.setQueryData(detailKey, (existing) => ({
          ...(existing || {}),
          order: nextOrder,
          unreadCount: Number(existing?.unreadCount || 0)
        }));
      } else {
        await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
      }
      queryClient.invalidateQueries({
        queryKey: orderQueryKeys.listRoot('user'),
        refetchType: 'active'
      });
      if (typeof onApplied === 'function') {
        await onApplied(result, variables, context);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hdmarket:orders-refresh'));
      }
    },
    onError: async (error, variables, context) => {
      if (!context?.possiblyCommitted && context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      if (typeof onFailed === 'function') {
        await onFailed(error, variables, context);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
    }
  });
};

export default useBuyerOrderStatusMutation;
