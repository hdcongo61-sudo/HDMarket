const normalizeUserKey = (userId) => String(userId || 'anon');
const normalizeConversationKey = (conversationId) => String(conversationId || 'none');

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
  messagesRoot: (userId, conversationId) => [
    ...orderChatKeys.user(userId),
    'messages',
    normalizeConversationKey(conversationId)
  ],
  messages: (userId, conversationId) => [...orderChatKeys.messagesRoot(userId, conversationId), 'infinite']
};

export default orderChatKeys;
