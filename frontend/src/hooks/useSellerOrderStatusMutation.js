import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import useReliableMutation from './useReliableMutation';
import { orderQueryKeys } from './useOrderQueryKeys';

const matchesSellerTarget = (order, nextStatus) => {
  if (!order || !nextStatus) return false;
  const normalizedTarget = String(nextStatus || '');
  const isInstallmentCompleted =
    String(order?.paymentType || '') === 'installment' &&
    String(order?.status || '') === 'completed';
  if (isInstallmentCompleted) {
    return String(order?.installmentSaleStatus || '') === normalizedTarget;
  }
  return String(order?.status || '') === normalizedTarget;
};

const normalizeMutationPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result?.order && result.order._id) return result.order;
  if (result?._id) return result;
  return null;
};

export const useSellerOrderStatusMutation = ({ orderId, onApplied, onFailed } = {}) => {
  const queryClient = useQueryClient();
  const detailKey = orderQueryKeys.detail('seller', orderId);

  return useReliableMutation({
    mutationFn: async ({ nextStatus, idempotencyKey }) => {
      const { data } = await api.patch(
        `/orders/seller/${orderId}/status`,
        { status: nextStatus },
        {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      return data;
    },
    verifyFn: async ({ nextStatus }) => {
      if (!orderId || !nextStatus) return false;
      const { data } = await api.get(`/orders/seller/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      return matchesSellerTarget(data, nextStatus) ? data : false;
    },
    onMutate: async ({ nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);
      queryClient.setQueryData(detailKey, (existing) => {
        if (!existing?.order || !nextStatus) return existing;
        const currentOrder = existing.order;
        const nextOrder =
          String(currentOrder?.paymentType || '') === 'installment' &&
          String(currentOrder?.status || '') === 'completed'
            ? { ...currentOrder, installmentSaleStatus: nextStatus }
            : { ...currentOrder, status: nextStatus };
        return { ...existing, order: nextOrder };
      });
      return { previous };
    },
    onSuccess: async (result) => {
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
        queryKey: orderQueryKeys.listRoot('seller'),
        refetchType: 'active'
      });
      if (typeof onApplied === 'function') {
        await onApplied(result);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hdmarket:orders-refresh'));
      }
    },
    onError: async (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      if (typeof onFailed === 'function') {
        await onFailed(error);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
    }
  });
};

export default useSellerOrderStatusMutation;
