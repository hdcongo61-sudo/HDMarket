import api from '../services/api';

export const startConversation = async ({ orderId, sellerId, productId } = {}) => {
  const payload = orderId ? { orderId } : { sellerId, productId };
  const { data } = await api.post('/conversations', payload);
  return data;
};

export const fetchOrderConversations = async ({ page = 1, limit = 12, archived = false }) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('archived', archived ? 'true' : 'false');
  const { data } = await api.get(`/conversations?${params.toString()}`, {
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
  const { data } = await api.get('/conversations/unread', {
    skipCache: true,
    headers: { 'x-skip-cache': '1' }
  });
  return {
    unreadCount: Number(data?.unreadCount ?? data?.count ?? 0)
  };
};

export const fetchOrderUnreadCounts = async (orderIds = []) => {
  const uniqueOrderIds = [...new Set(
    orderIds.map((orderId) => String(orderId || '').trim()).filter(Boolean)
  )];
  if (uniqueOrderIds.length === 0) return {};

  const { data } = await api.get('/conversations/unread/orders', {
    params: { orderIds: uniqueOrderIds.join(',') },
    skipCache: true,
    headers: { 'x-skip-cache': '1' }
  });
  const serverCounts = data?.byOrder && typeof data.byOrder === 'object' ? data.byOrder : {};

  return uniqueOrderIds.reduce((counts, orderId) => {
    counts[orderId] = Math.max(0, Number(serverCounts[orderId] || 0));
    return counts;
  }, {});
};

export const fetchOrderMessagePage = async ({ conversationId, before = null, limit = 20 }) => {
  const params = {
    limit: Number(limit || 20),
    withMeta: true
  };
  if (before) params.before = before;

  const { data } = await api.get(`/conversations/${conversationId}/messages`, {
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
