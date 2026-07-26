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

// ─── Seller Auto-Reply ────────────────────────────────────────────────────────

export const fetchSellerAutoReply = async () => {
  const { data } = await api.get('/conversations/seller/auto-reply');
  return data?.autoReply || null;
};

export const saveSellerAutoReply = async ({ message, isActive, schedule, cooldownMinutes }) => {
  const { data } = await api.put('/conversations/seller/auto-reply', {
    message,
    isActive,
    schedule,
    cooldownMinutes
  });
  return data?.autoReply || null;
};

export const deleteSellerAutoReply = async () => {
  await api.delete('/conversations/seller/auto-reply');
};

// ─── Seller Message Templates ─────────────────────────────────────────────────

export const fetchSellerTemplates = async () => {
  const { data } = await api.get('/conversations/seller/templates');
  return Array.isArray(data?.templates) ? data.templates : [];
};

export const createSellerTemplate = async ({ label, message, order = 0 }) => {
  const { data } = await api.post('/conversations/seller/templates', { label, message, order });
  return data?.template || null;
};

export const updateSellerTemplateApi = async (templateId, updates) => {
  const { data } = await api.patch(`/conversations/seller/templates/${templateId}`, updates);
  return data?.template || null;
};

export const deleteSellerTemplateApi = async (templateId) => {
  await api.delete(`/conversations/seller/templates/${templateId}`);
};

// ─── Card Messages ────────────────────────────────────────────────────────────

export const sendCardMessage = async ({ conversationId, cardType, entityId, snapshot, text }) => {
  const payload = {
    messageType: 'card',
    card: { cardType, entityId, snapshot },
    text: text || null
  };
  const { data } = await api.post(`/conversations/${conversationId}/messages`, payload, {
    silentGlobalError: true,
    headers: {
      'Idempotency-Key': `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
  });
  return data;
};
