let ioInstance = null;

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
