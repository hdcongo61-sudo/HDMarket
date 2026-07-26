let ioInstance = null;

// ─── Presence Tracking ────────────────────────────────────────────────────────
// Simple in-memory map: userId -> { online: boolean, lastSeen: ISO string }
const userPresence = new Map();

export const setUserOnline = (userId) => {
  if (!userId) return;
  const key = String(userId);
  userPresence.set(key, { online: true, lastSeen: new Date().toISOString() });
  if (ioInstance) {
    ioInstance.emit('presence:update', { userId: key, online: true });
  }
};

export const setUserOffline = (userId) => {
  if (!userId) return;
  const key = String(userId);
  userPresence.set(key, { online: false, lastSeen: new Date().toISOString() });
  if (ioInstance) {
    ioInstance.emit('presence:update', { userId: key, online: false });
  }
};

export const getUserPresence = (userId) => {
  if (!userId) return { online: false, lastSeen: null };
  const key = String(userId);
  return userPresence.get(key) || { online: false, lastSeen: null };
};

// ─── Room / Event Emitters ────────────────────────────────────────────────────

export const buildOrderConversationRoom = (conversationId) => `conversation:${String(conversationId)}`;
export const buildOrderUserRoom = (userId) => `user:${String(userId)}`;

export const setChatSocket = (io) => {
  ioInstance = io;
};

export const getChatSocket = () => ioInstance;

export const emitOrderMessageCreated = ({
  conversationId,
  message,
  senderId,
  recipientId
}) => {
  if (!ioInstance || !conversationId || !message) return;

  const payload = {
    conversationId: String(conversationId),
    message
  };

  ioInstance.to(buildOrderConversationRoom(conversationId)).emit('orders:message:new', payload);

  if (senderId) {
    ioInstance.to(buildOrderUserRoom(senderId)).emit('orders:conversation:updated', payload);
  }
  if (recipientId) {
    ioInstance.to(buildOrderUserRoom(recipientId)).emit('orders:conversation:updated', payload);
  }
};

export const emitOrderMessageUpdated = ({ conversationId, message }) => {
  if (!ioInstance || !conversationId || !message) return;
  const payload = {
    conversationId: String(conversationId),
    message
  };
  ioInstance.to(buildOrderConversationRoom(conversationId)).emit('orders:message:updated', payload);
};

export const emitOrderMessageDeleted = ({ conversationId, messageId }) => {
  if (!ioInstance || !conversationId || !messageId) return;
  const payload = {
    conversationId: String(conversationId),
    messageId: String(messageId)
  };
  ioInstance.to(buildOrderConversationRoom(conversationId)).emit('orders:message:deleted', payload);
};

export const emitOrderConversationRead = ({ conversationId, userId, readAt }) => {
  if (!ioInstance || !conversationId || !userId) return;
  ioInstance.to(buildOrderConversationRoom(conversationId)).emit('orders:conversation:read', {
    conversationId: String(conversationId),
    userId: String(userId),
    readAt: readAt || new Date().toISOString()
  });
};

export const emitOrderUnreadUpdate = ({
  userId,
  totalUnread,
  conversationId,
  conversationUnread
}) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(buildOrderUserRoom(userId)).emit('orders:unread:update', {
    userId: String(userId),
    totalUnread: Number(totalUnread || 0),
    conversationId: conversationId ? String(conversationId) : null,
    conversationUnread: Number(conversationUnread || 0)
  });
};

export const emitOrderStatusUpdated = ({
  orderId,
  status,
  installmentSaleStatus,
  platformDeliveryStatus,
  platformDeliveryRequestId,
  deliveryStatus,
  currentStage,
  outForDeliveryAt,
  shippedAt,
  deliverySubmittedAt,
  deliveryDate,
  deliveredAt,
  clientDeliveryConfirmedAt,
  customerId,
  sellerIds = [],
  updatedBy,
  updatedAt
}) => {
  if (!ioInstance || !orderId) return;

  const payload = {
    orderId: String(orderId),
    status: String(status || ''),
    installmentSaleStatus: String(installmentSaleStatus || ''),
    updatedBy: updatedBy ? String(updatedBy) : '',
    updatedAt: updatedAt || new Date().toISOString()
  };
  if (typeof platformDeliveryStatus !== 'undefined') {
    payload.platformDeliveryStatus = String(platformDeliveryStatus || '');
  }
  if (typeof platformDeliveryRequestId !== 'undefined') {
    payload.platformDeliveryRequestId = platformDeliveryRequestId
      ? String(platformDeliveryRequestId)
      : null;
  }
  if (typeof deliveryStatus !== 'undefined') {
    payload.deliveryStatus = String(deliveryStatus || '');
  }
  if (typeof currentStage !== 'undefined') {
    payload.currentStage = String(currentStage || '');
  }
  if (typeof outForDeliveryAt !== 'undefined') {
    payload.outForDeliveryAt = outForDeliveryAt || null;
  }
  if (typeof shippedAt !== 'undefined') {
    payload.shippedAt = shippedAt || null;
  }
  if (typeof deliverySubmittedAt !== 'undefined') {
    payload.deliverySubmittedAt = deliverySubmittedAt || null;
  }
  if (typeof deliveryDate !== 'undefined') {
    payload.deliveryDate = deliveryDate || null;
  }
  if (typeof deliveredAt !== 'undefined') {
    payload.deliveredAt = deliveredAt || null;
  }
  if (typeof clientDeliveryConfirmedAt !== 'undefined') {
    payload.clientDeliveryConfirmedAt = clientDeliveryConfirmedAt || null;
  }

  const recipients = new Set();
  if (customerId) recipients.add(String(customerId));
  if (Array.isArray(sellerIds)) {
    sellerIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .forEach((id) => recipients.add(id));
  }

  recipients.forEach((userId) => {
    ioInstance.to(buildOrderUserRoom(userId)).emit('orders:status:updated', payload);
  });

  ioInstance.to(buildOrderConversationRoom(orderId)).emit('orders:status:updated', payload);
};

export const emitDeliveryLocationUpdated = ({
  orderId,
  deliveryRequestId,
  position,
  currentStage,
  buyerId,
  sellerId,
  updatedAt
}) => {
  if (!ioInstance || !orderId || !position) return;

  const lat = Number(position.lat);
  const lng = Number(position.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const payload = {
    orderId: String(orderId),
    deliveryRequestId: deliveryRequestId ? String(deliveryRequestId) : null,
    position: { lat, lng },
    currentStage: String(currentStage || ''),
    updatedAt: updatedAt || new Date().toISOString()
  };

  const recipients = new Set();
  if (buyerId) recipients.add(String(buyerId));
  if (sellerId) recipients.add(String(sellerId));

  recipients.forEach((userId) => {
    ioInstance.to(buildOrderUserRoom(userId)).emit('delivery:location:updated', payload);
  });
};
