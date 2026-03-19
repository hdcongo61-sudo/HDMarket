import { useCallback, useEffect, useMemo, useState } from 'react';
import { countAllOrderChatOfflineActions } from '../utils/orderChatOfflineQueue';
import { countAllOrderStatusOfflineActions } from '../utils/orderStatusOfflineQueue';
import { countAllAdminDeliveryOfflineActions } from '../utils/adminDeliveryOfflineQueue';

const OFFLINE_QUEUE_EVENT = 'hdmarket:offline-queue-changed';

export default function useOfflineQueueStats() {
  const [counts, setCounts] = useState({
    chat: 0,
    orderStatus: 0,
    adminDelivery: 0
  });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [chat, orderStatus, adminDelivery] = await Promise.all([
        countAllOrderChatOfflineActions(),
        countAllOrderStatusOfflineActions(),
        countAllAdminDeliveryOfflineActions()
      ]);
      setCounts({
        chat: Number(chat || 0),
        orderStatus: Number(orderStatus || 0),
        adminDelivery: Number(adminDelivery || 0)
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const refresh = () => {
      reload();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
    };
  }, [reload]);

  const total = useMemo(
    () =>
      Number(counts.chat || 0) +
      Number(counts.orderStatus || 0) +
      Number(counts.adminDelivery || 0),
    [counts]
  );

  return {
    counts,
    total,
    loading,
    reload
  };
}
