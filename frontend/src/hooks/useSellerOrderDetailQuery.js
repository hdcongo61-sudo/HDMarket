import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { orderQueryKeys } from './useOrderQueryKeys';
import useNetworkProfile from './useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';
import { fetchOrderUnreadCounts } from '../queries/orderChatApi';

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

export const useSellerOrderDetailQuery = ({ orderId, userId, enabled = true } = {}) => {
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const { rapid3GActive, shouldUseOfflineSnapshot } = useNetworkProfile();
  const snapshotKey = useMemo(
    () => ['seller-order-detail', userId || 'guest', orderId || 'unknown'].join(':'),
    [orderId, userId]
  );

  const query = useQuery({
    queryKey: orderQueryKeys.detail('seller', orderId),
    enabled: Boolean(enabled && orderId),
    queryFn: async () => {
      try {
        const [orderResponse, unreadCounts] = await Promise.all([
          api.get(`/orders/seller/detail/${orderId}`, {
            skipCache: true,
            headers: { 'x-skip-cache': '1' }
          }),
          fetchOrderUnreadCounts([orderId])
        ]);
        const order = orderResponse?.data || null;
        setOfflineSnapshotActive(false);
        return {
          order,
          unreadCount: Number(unreadCounts?.[orderId] || 0),
          messages: []
        };
      } catch (error) {
        if (shouldUseOfflineSnapshot) {
          const snapshot = await loadOfflineSnapshot(snapshotKey);
          if (snapshot && typeof snapshot === 'object') {
            setOfflineSnapshotActive(true);
            return snapshot;
          }
        }
        throw error;
      }
    },
    staleTime: rapid3GActive ? 45_000 : 20_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = String(query?.state?.data?.order?.status || '');
      return ACTIVE_ORDER_STATUSES.has(status) ? (rapid3GActive ? 60_000 : 30_000) : false;
    }
  });

  useEffect(() => {
    if (!query.data || shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(snapshotKey, query.data);
    setOfflineSnapshotActive(false);
  }, [query.data, shouldUseOfflineSnapshot, snapshotKey]);

  return {
    ...query,
    offlineSnapshotActive
  };
};
export default useSellerOrderDetailQuery;
