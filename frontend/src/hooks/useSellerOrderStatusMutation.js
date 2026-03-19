import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { isApiPossiblyCommittedError } from '../services/api';
import AuthContext from '../context/AuthContext';
import useReliableMutation from './useReliableMutation';
import useNetworkProfile from './useNetworkProfile';
import { orderQueryKeys } from './useOrderQueryKeys';
import { createIdempotencyKey } from '../utils/idempotency';
import {
  enqueueOrderStatusOfflineAction,
  loadOrderStatusOfflineQueue,
  removeOrderStatusOfflineAction
} from '../utils/orderStatusOfflineQueue';

const SELLER_OFFLINE_QUEUEABLE_STATUSES = new Set([
  'confirmed',
  'ready_for_pickup',
  'ready_for_delivery',
  'delivering',
  'out_for_delivery'
]);

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

const patchOrdersListPayload = (payload, nextOrder) => {
  if (!nextOrder?._id) return payload;
  if (Array.isArray(payload)) {
    return payload.map((entry) =>
      String(entry?._id || '') === String(nextOrder._id) ? nextOrder : entry
    );
  }
  if (payload && Array.isArray(payload.items)) {
    return {
      ...payload,
      items: payload.items.map((entry) =>
        String(entry?._id || '') === String(nextOrder._id) ? nextOrder : entry
      )
    };
  }
  return payload;
};

const getOptimisticSellerOrder = (order, nextStatus) => {
  if (!order || !nextStatus) return order;
  const normalizedStatus = String(nextStatus || '');
  const isInstallmentCompleted =
    String(order?.paymentType || '') === 'installment' &&
    String(order?.status || '') === 'completed';
  return isInstallmentCompleted
    ? {
        ...order,
        installmentSaleStatus: normalizedStatus,
        updatedAt: new Date().toISOString()
      }
    : {
        ...order,
        status: normalizedStatus,
        updatedAt: new Date().toISOString()
      };
};

export const useSellerOrderStatusMutation = ({
  orderId,
  onApplied,
  onFailed,
  onQueued
} = {}) => {
  const queryClient = useQueryClient();
  const detailKey = orderQueryKeys.detail('seller', orderId);
  const listRootKey = orderQueryKeys.listRoot('seller');
  const { user } = useContext(AuthContext);
  const { shouldUseOfflineSnapshot } = useNetworkProfile();
  const [queuedActionCount, setQueuedActionCount] = useState(0);
  const [isQueueSyncing, setIsQueueSyncing] = useState(false);
  const userScopeId = useMemo(
    () => String(user?._id || user?.id || '').trim(),
    [user?._id, user?.id]
  );

  const syncQueuedCount = useCallback(async () => {
    if (!userScopeId) {
      setQueuedActionCount(0);
      return;
    }
    const queue = await loadOrderStatusOfflineQueue(userScopeId, 'seller');
    setQueuedActionCount(queue.length);
  }, [userScopeId]);

  const applyOrderToCaches = useCallback(
    (nextOrder) => {
      if (!nextOrder?._id) return;
      queryClient.setQueriesData({ queryKey: listRootKey }, (existing) =>
        patchOrdersListPayload(existing, nextOrder)
      );
      if (String(nextOrder._id || '') === String(orderId || '')) {
        queryClient.setQueryData(detailKey, (existing) => ({
          ...(existing || {}),
          order: nextOrder,
          unreadCount: Number(existing?.unreadCount || 0)
        }));
      }
    },
    [detailKey, listRootKey, orderId, queryClient]
  );

  const flushOfflineQueue = useCallback(async () => {
    if (!userScopeId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let queue = await loadOrderStatusOfflineQueue(userScopeId, 'seller');
    setQueuedActionCount(queue.length);
    if (!queue.length) return;
    setIsQueueSyncing(true);
    try {
      for (const action of queue) {
        try {
          const { data } = await api.patch(
            `/orders/seller/${action.orderId}/status`,
            { status: action.nextStatus },
            {
              headers: {
                'Idempotency-Key': action.idempotencyKey || createIdempotencyKey('seller-status-replay')
              }
            }
          );
          const nextOrder = normalizeMutationPayload(data);
          if (nextOrder?._id) {
            applyOrderToCaches(nextOrder);
          }
          queue = await removeOrderStatusOfflineAction(userScopeId, 'seller', action.queueId);
          setQueuedActionCount(queue.length);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('hdmarket:orders-refresh'));
          }
        } catch (error) {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            break;
          }
          break;
        }
      }
    } finally {
      setIsQueueSyncing(false);
      await queryClient.invalidateQueries({ queryKey: listRootKey, refetchType: 'active' });
      if (orderId) {
        await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
      }
    }
  }, [applyOrderToCaches, detailKey, listRootKey, orderId, queryClient, userScopeId]);

  useEffect(() => {
    syncQueuedCount();
    const handleQueueChange = () => {
      syncQueuedCount();
    };
    window.addEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('hdmarket:offline-queue-changed', handleQueueChange);
    };
  }, [syncQueuedCount]);

  useEffect(() => {
    if (!userScopeId) return;
    if (!shouldUseOfflineSnapshot) {
      flushOfflineQueue();
    }
    const handleOnline = () => {
      flushOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushOfflineQueue, shouldUseOfflineSnapshot, userScopeId]);

  const mutation = useReliableMutation({
    mutationFn: async ({ nextStatus, idempotencyKey }) => {
      const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
      const canQueueOffline =
        shouldUseOfflineSnapshot &&
        userScopeId &&
        SELLER_OFFLINE_QUEUEABLE_STATUSES.has(normalizedStatus);
      if (canQueueOffline) {
        const queue = await enqueueOrderStatusOfflineAction(userScopeId, 'seller', {
          queueId: createIdempotencyKey('seller-status-queue'),
          orderId,
          nextStatus,
          idempotencyKey: idempotencyKey || createIdempotencyKey('seller-status')
        });
        return {
          queued: true,
          queueLength: queue.length,
          orderId,
          nextStatus
        };
      }

      const { data } = await api.patch(
        `/orders/seller/${orderId}/status`,
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
      const { data } = await api.get(`/orders/seller/detail/${orderId}`, {
        skipCache: true,
        skipDedupe: true,
        silentGlobalError: true,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' },
        timeout: 12_000
      });
      return matchesSellerTarget(data, nextStatus) ? data : false;
    },
    onMutate: async ({ nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listRootKey });
      const previous = queryClient.getQueryData(detailKey);
      const previousLists = queryClient.getQueriesData({ queryKey: listRootKey });
      queryClient.setQueryData(detailKey, (existing) => {
        if (!existing?.order || !nextStatus) return existing;
        return { ...existing, order: getOptimisticSellerOrder(existing.order, nextStatus) };
      });
      queryClient.setQueriesData({ queryKey: listRootKey }, (existing) => {
        if (!nextStatus) return existing;
        if (Array.isArray(existing)) {
          return existing.map((entry) =>
            String(entry?._id || '') === String(orderId || '')
              ? getOptimisticSellerOrder(entry, nextStatus)
              : entry
          );
        }
        if (existing && Array.isArray(existing.items)) {
          return {
            ...existing,
            items: existing.items.map((entry) =>
              String(entry?._id || '') === String(orderId || '')
                ? getOptimisticSellerOrder(entry, nextStatus)
                : entry
            )
          };
        }
        return existing;
      });
      return { previous, previousLists };
    },
    onSuccess: async (result, variables, context) => {
      if (result?.data?.queued) {
        setQueuedActionCount(Number(result?.data?.queueLength || 0));
        if (typeof onQueued === 'function') {
          await onQueued(result, variables, context);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('hdmarket:orders-refresh'));
        }
        return;
      }

      const nextOrder = normalizeMutationPayload(result?.data);
      if (nextOrder?._id) {
        applyOrderToCaches(nextOrder);
      } else {
        await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
      }
      queryClient.invalidateQueries({
        queryKey: listRootKey,
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
      const possiblyCommitted = isApiPossiblyCommittedError(error);
      if (!possiblyCommitted && context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      if (!possiblyCommitted && Array.isArray(context?.previousLists)) {
        context.previousLists.forEach(([queryKey, previousValue]) => {
          queryClient.setQueryData(queryKey, previousValue);
        });
      }
      if (typeof onFailed === 'function') {
        await onFailed(error, variables, {
          ...(context || {}),
          possiblyCommitted
        });
      }
    },
    onSettled: async (data) => {
      if (data?.data?.queued) return;
      await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'active' });
    }
  });

  return {
    ...mutation,
    queuedActionCount,
    isQueueSyncing
  };
};

export default useSellerOrderStatusMutation;
