import api from '../services/api';

export const fetchOrderConversations = async ({ page = 1, limit = 12, archived = false }) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('archived', archived ? 'true' : 'false');
  const { data } = await api.get(`/orders/messages/conversations?${params.toString()}`, {
    skipCache: true,
    headers: { 'x-skip-cache': '1' }
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total || 0),
    page: Number(data?.page || page),
    pageSize: Number(data?.pageSize || limit),
    totalPages: Number(data?.totalPages || 1)
  };
};

export const fetchOrderUnreadCount = async () => {
  const { data } = await api.get('/orders/messages/unread', {
    skipCache: true,
    headers: { 'x-skip-cache': '1' }
  });
  return {
    unreadCount: Number(data?.unreadCount ?? data?.count ?? 0)
  };
};

export const fetchOrderMessagePage = async ({ orderId, before = null, limit = 20 }) => {
  const params = {
    limit: Number(limit || 20),
    withMeta: true
  };
  if (before) params.before = before;

  const { data } = await api.get(`/orders/${orderId}/messages`, {
    params,
    skipCache: true,
    headers: { 'x-skip-cache': '1' }
  });

  return {
    items: Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [],
    hasMore: Array.isArray(data) ? false : Boolean(data?.hasMore),
    nextCursor: Array.isArray(data) ? null : data?.nextCursor || null
  };
};
