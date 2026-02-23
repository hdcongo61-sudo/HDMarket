const normalizeUserKey = (userId) => String(userId || 'anon');
const normalizeOrderKey = (orderId) => String(orderId || 'none');

export const orderChatKeys = {
  all: ['order-chat'],
  user: (userId) => [...orderChatKeys.all, normalizeUserKey(userId)],
  conversationsRoot: (userId) => [...orderChatKeys.user(userId), 'conversations'],
  conversations: (userId, params = {}) => [
    ...orderChatKeys.conversationsRoot(userId),
    {
      page: Number(params.page || 1),
      limit: Number(params.limit || 12),
      archived: Boolean(params.archived)
    }
  ],
  unread: (userId) => [...orderChatKeys.user(userId), 'unread'],
  messagesRoot: (userId, orderId) => [
    ...orderChatKeys.user(userId),
    'messages',
    normalizeOrderKey(orderId)
  ],
  messages: (userId, orderId) => [...orderChatKeys.messagesRoot(userId, orderId), 'infinite']
};

export default orderChatKeys;
