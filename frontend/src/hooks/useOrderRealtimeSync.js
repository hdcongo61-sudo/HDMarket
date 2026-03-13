import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

const applyPayloadToOrder = (order, payload = {}) => {
  if (!order || typeof order !== 'object') return order;
  if (String(order._id || '') !== String(payload.orderId || '')) return order;
  const next = { ...order };
  const assignIfPresent = (key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      next[key] = payload[key];
    }
  };
  assignIfPresent('status');
  assignIfPresent('installmentSaleStatus');
  assignIfPresent('platformDeliveryStatus');
  assignIfPresent('platformDeliveryRequestId');
  assignIfPresent('deliveryStatus');
  assignIfPresent('currentStage');
  assignIfPresent('outForDeliveryAt');
  assignIfPresent('shippedAt');
  assignIfPresent('deliverySubmittedAt');
  assignIfPresent('deliveryDate');
  assignIfPresent('deliveredAt');
  assignIfPresent('clientDeliveryConfirmedAt');
  assignIfPresent('updatedAt');
  return next;
};

const getOrderFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload?.order && typeof payload.order === 'object') return payload.order;
  if (payload?._id) return payload;
  return null;
};

const patchOrderSnapshot = (currentValue, payload = {}) => {
  const order = getOrderFromPayload(currentValue);
  if (!order) return currentValue;
  const nextOrder = applyPayloadToOrder(order, payload);
  if (nextOrder === order) return currentValue;
  if (currentValue?.order && typeof currentValue === 'object') {
    return { ...currentValue, order: nextOrder };
  }
  return nextOrder;
};

const patchOrderCollection = (currentValue, payload = {}) => {
  if (Array.isArray(currentValue)) {
    return currentValue.map((entry) => applyPayloadToOrder(entry, payload));
  }
  if (currentValue && Array.isArray(currentValue.items)) {
    return {
      ...currentValue,
      items: currentValue.items.map((entry) => applyPayloadToOrder(entry, payload))
    };
  }
  return currentValue;
};

export const useOrderRealtimeSync = ({
  scope = 'user',
  orderId = '',
  enabled = true,
  pollIntervalMs = 0,
  currentStatus = ''
} = {}) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const onStatusUpdated = (event) => {
      const payload = event?.detail || {};
      const incomingOrderId = String(payload?.orderId || '').trim();
      if (!incomingOrderId) return;
      if (orderId && incomingOrderId !== String(orderId)) return;

      queryClient.setQueriesData(
        { queryKey: ['orders', 'detail'] },
        (existing) => patchOrderSnapshot(existing, payload)
      );
      queryClient.setQueriesData(
        { queryKey: orderQueryKeys.listRoot(scope) },
        (existing) => patchOrderCollection(existing, payload)
      );
      queryClient.invalidateQueries({
        queryKey: orderQueryKeys.listRoot(scope),
        refetchType: 'active'
      });
    };

    const onGlobalRefresh = () => {
      queryClient.invalidateQueries({
        queryKey: orderQueryKeys.detailRoot(scope),
        refetchType: 'active'
      });
      queryClient.invalidateQueries({
        queryKey: orderQueryKeys.listRoot(scope),
        refetchType: 'inactive'
      });
    };

    window.addEventListener('hdmarket:orders-status-updated', onStatusUpdated);
    window.addEventListener('hdmarket:orders-refresh', onGlobalRefresh);
    return () => {
      window.removeEventListener('hdmarket:orders-status-updated', onStatusUpdated);
      window.removeEventListener('hdmarket:orders-refresh', onGlobalRefresh);
    };
  }, [enabled, orderId, queryClient, scope]);

  useEffect(() => {
    if (!enabled || !pollIntervalMs || !Number.isFinite(Number(pollIntervalMs))) return undefined;
    if (!ACTIVE_ORDER_STATUSES.has(String(currentStatus || ''))) return undefined;

    const timer = setInterval(() => {
      if (orderId) {
        queryClient.invalidateQueries({
          queryKey: orderQueryKeys.detail(scope, orderId),
          refetchType: 'active'
        });
      }
      queryClient.invalidateQueries({
        queryKey: orderQueryKeys.listRoot(scope),
        refetchType: 'inactive'
      });
    }, Math.max(4000, Number(pollIntervalMs)));

    return () => clearInterval(timer);
  }, [currentStatus, enabled, orderId, pollIntervalMs, queryClient, scope]);
};

export default useOrderRealtimeSync;
