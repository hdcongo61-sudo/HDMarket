import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import OrderMessage from '../models/orderMessageModel.js';
import User from '../models/userModel.js';
import AssistantAuditLog from '../models/assistantAuditLogModel.js';
import { createNotification } from '../utils/notificationService.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import { getRestrictionMessage, isRestricted } from '../utils/restrictionCheck.js';
import {
  emitOrderConversationRead,
  emitOrderMessageCreated,
  emitOrderMessageDeleted,
  emitOrderMessageUpdated,
  emitOrderUnreadUpdate
} from '../sockets/chatSocket.js';
import {
  decrementOrderConversationUnread,
  incrementOrderConversationUnread,
  resetOrderConversationUnread,
  setOrderUnreadTotal,
  syncOrderUnreadState
} from '../utils/orderMessageUnreadCounter.js';
import {
  resolveOrCreateConversation,
  getConversationForUser,
  listConversationsForUser,
  archiveConversation,
  unarchiveConversation,
  deleteConversationForUser,
  touchConversationLastMessage
} from '../services/conversationService.js';

const sanitizeMessagePreview = (value, maxLength = 160) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const buildMessagePreview = ({ text, hasEncrypted, hasVoice, attachments = [] }) => {
  const safeText = sanitizeMessagePreview(text);
  if (safeText) return safeText;
  if (hasEncrypted) return 'Message chiffre';
  if (hasVoice) return 'Message vocal';
  if (Array.isArray(attachments) && attachments.length > 0) {
    if (attachments.length === 1) return 'Piece jointe';
    return `${attachments.length} pieces jointes`;
  }
  return 'Nouveau message';
};

const resolveMessageDeepLink = ({ conversationId }) => {
  const safeId = String(conversationId || '').trim();
  if (!safeId) return '/orders/messages';
  return `/orders/messages?conversationId=${encodeURIComponent(safeId)}`;
};

const auditAssistantMessageAction = async ({ access, conversation, action = 'assistant_message_replied', metadata = {} }) => {
  if (!access?.isAssistant) return;
  try {
    await AssistantAuditLog.create({
      shop: conversation.sellerId,
      actor: access.actorId,
      actorRole: 'assistant',
      action,
      targetType: conversation.orderId ? 'order' : 'conversation',
      targetId: String(conversation.orderId || conversation._id || ''),
      metadata
    });
  } catch {
    // Non-blocking.
  }
};

const toClientPayload = (entry) =>
  entry
    ? {
        ...entry,
        _id: entry._id,
        sender: entry.sender
          ? {
              _id: entry.sender._id,
              name: entry.sender.name,
              email: entry.sender.email,
              shopName: entry.sender.shopName,
              profileImage: entry.sender.profileImage || entry.sender.shopLogo || ''
            }
          : null,
        recipient: entry.recipient
          ? {
              _id: entry.recipient._id,
              name: entry.recipient.name,
              email: entry.recipient.email,
              shopName: entry.recipient.shopName,
              profileImage: entry.recipient.profileImage || entry.recipient.shopLogo || ''
            }
          : null
      }
    : entry;

/**
 * Start (or resolve) a conversation. Pass `orderId` for an order-anchored
 * thread, or `sellerId` (+ optional `productId`) for a general/pre-sale
 * thread — this is what replaces the old fake-draft-order "inquiry" hack.
 */
export const postStartConversation = asyncHandler(async (req, res) => {
  const requesterId = req.user?.id || req.user?._id;
  const { orderId, sellerId, productId } = req.body || {};

  try {
    const conversation = await resolveOrCreateConversation({ requesterId, orderId, sellerId, productId });
    return res.status(200).json({ conversationId: conversation._id, conversation });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ message: error.message });
    }
    throw error;
  }
});

/**
 * Get messages for a conversation. Only its two participants (or an
 * authorized shop assistant, or an admin) can access them.
 */
export const getConversationMessages = asyncHandler(async (req, res) => {
  const conversationId = req.params.conversationId || req.params.id;
  const userId = req.user?.id || req.user?._id;

  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: 'Conversation invalide.' });
  }

  const { conversation, access } = await getConversationForUser({ id: conversationId, user: req.user });

  const limitParam = Number(req.query?.limit);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, Math.floor(limitParam))) : 20;
  const beforeParam = String(req.query?.before || '').trim();
  const beforeDate = beforeParam ? new Date(beforeParam) : null;
  const withMeta = ['1', 'true', 'yes'].includes(String(req.query?.withMeta || '').toLowerCase());
  const hasCursorQuery = Boolean(beforeParam || Number.isFinite(limitParam) || withMeta);

  let raw = [];
  let hasMore = false;
  let nextCursor = null;

  if (hasCursorQuery) {
    const findQuery = { conversation: conversationId };
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      findQuery.createdAt = { $lt: beforeDate };
    }

    const rows = await OrderMessage.find(findQuery)
      .populate('sender', 'name email shopName profileImage shopLogo')
      .populate('recipient', 'name email shopName profileImage shopLogo')
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    hasMore = rows.length > limit;
    raw = (hasMore ? rows.slice(0, limit) : rows).reverse();
    nextCursor = raw.length ? raw[0].createdAt : null;
  } else {
    raw = await OrderMessage.find({ conversation: conversationId })
      .populate('sender', 'name email shopName profileImage shopLogo')
      .populate('recipient', 'name email shopName profileImage shopLogo')
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
  }

  const markResult = await OrderMessage.updateMany(
    { conversation: conversationId, recipient: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );

  if (Number(markResult?.modifiedCount || 0) > 0) {
    const unreadState = await resetOrderConversationUnread(userId, conversationId);
    emitOrderConversationRead({
      conversationId,
      userId: String(userId),
      readAt: new Date().toISOString()
    });
    emitOrderUnreadUpdate({
      userId: String(userId),
      conversationId: String(conversationId),
      totalUnread: unreadState.totalUnread,
      conversationUnread: unreadState.conversationUnread
    });
  }
  await auditAssistantMessageAction({
    access,
    conversation,
    action: 'assistant_conversation_viewed',
    metadata: {
      messageCount: raw.length,
      markedReadCount: Number(markResult?.modifiedCount || 0),
      paginated: hasCursorQuery || withMeta
    }
  });

  const messages = raw.map((m) => ({
    ...m,
    _id: m._id,
    sender: m.sender ? { ...m.sender, _id: m.sender._id } : m.sender,
    recipient: m.recipient ? { ...m.recipient, _id: m.recipient._id } : m.recipient
  }));

  if (hasCursorQuery || withMeta) {
    return res.json({ items: messages, hasMore, nextCursor });
  }

  res.json(messages);
});

/**
 * Send a message in a conversation.
 */
export const sendConversationMessage = asyncHandler(async (req, res) => {
  const conversationId = req.params.conversationId || req.params.id;
  const body = req.body ?? {};
  let { text, recipientId, clientMessageId, encryptedText, encryptionData, attachments, voiceMessage } = body;
  const userId = req.user?.id || req.user?._id;
  const normalizedClientMessageId = String(clientMessageId || '').trim();

  if (recipientId != null && typeof recipientId === 'object' && recipientId._id) {
    recipientId = String(recipientId._id);
  } else if (recipientId != null && typeof recipientId !== 'string') {
    recipientId = null;
  }
  if (recipientId === '') recipientId = null;

  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: 'Conversation invalide.' });
  }

  const hasText = text && text.trim();
  const hasEncrypted = encryptedText && encryptionData;
  const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
  const hasVoice = voiceMessage && voiceMessage.url;

  if (!hasText && !hasEncrypted && !hasAttachments && !hasVoice) {
    return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
  }

  const { conversation, access } = await getConversationForUser({
    id: conversationId,
    user: req.user,
    requireMessagePermission: true
  });
  const { isCustomer, isSeller, isAdmin } = access;

  if (!isAdmin) {
    const sender = await User.findById(userId).select('restrictions');
    if (!sender) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    if (isRestricted(sender, 'canMessage')) {
      return res.status(403).json({ message: getRestrictionMessage('canMessage'), restrictionType: 'canMessage' });
    }
  }

  // Determine recipient — trivial now: a conversation only ever has 2 sides.
  let recipientUserId = null;
  if (recipientId) {
    const isValidTarget =
      String(conversation.buyerId) === String(recipientId) || String(conversation.sellerId) === String(recipientId);
    if (!isValidTarget) {
      return res.status(400).json({ message: 'Le destinataire n\'est pas associé à cette conversation.' });
    }
    recipientUserId = recipientId;
  } else if (isCustomer) {
    recipientUserId = conversation.sellerId;
  } else if (isSeller) {
    recipientUserId = conversation.buyerId;
  } else if (isAdmin) {
    // Admin intervening as a neutral third party defaults to the buyer side.
    recipientUserId = conversation.buyerId;
  }

  if (!recipientUserId) {
    return res.status(400).json({ message: 'Impossible de déterminer le destinataire.' });
  }
  if (String(recipientUserId) === String(userId)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer un message.' });
  }

  const recipient = await User.findById(recipientUserId).select(
    '_id name email shopName profileImage shopLogo role accountType'
  );
  if (!recipient) {
    return res.status(404).json({ message: 'Destinataire introuvable.' });
  }

  if (normalizedClientMessageId) {
    const existingMessage = await OrderMessage.findOne({
      conversation: conversationId,
      sender: userId,
      'metadata.clientMessageId': normalizedClientMessageId
    })
      .populate('sender', 'name email shopName profileImage shopLogo')
      .populate('recipient', 'name email shopName profileImage shopLogo')
      .lean();

    if (existingMessage) {
      return res.status(200).json(toClientPayload(existingMessage));
    }
  }

  const messageData = {
    conversation: conversationId,
    order: conversation.orderId || null,
    sender: userId,
    recipient: recipient._id,
    metadata: {
      ...(normalizedClientMessageId ? { clientMessageId: normalizedClientMessageId } : {})
    }
  };

  if (hasEncrypted && encryptionData) {
    messageData.encryptedText = encryptedText;
    messageData.encryptionKey = encryptionData.key;
    messageData.metadata = {
      ...messageData.metadata,
      iv: encryptionData.iv,
      tag: encryptionData.tag,
      salt: encryptionData.salt,
      encrypted: true
    };
    messageData.text = hasText ? text.trim() : '[Message chiffré]';
  } else if (hasText) {
    messageData.text = text.trim();
  }

  if (hasAttachments) messageData.attachments = attachments;
  if (hasVoice) messageData.voiceMessage = voiceMessage;

  const message = await OrderMessage.create(messageData);
  const messagePreview = buildMessagePreview({
    text: messageData?.text,
    hasEncrypted: Boolean(messageData?.encryptedText),
    hasVoice: Boolean(messageData?.voiceMessage?.url),
    attachments: messageData?.attachments || []
  });
  const messageDeepLink = resolveMessageDeepLink({ conversationId });

  await touchConversationLastMessage({
    id: conversationId,
    preview: messagePreview,
    senderId: userId,
    at: message.createdAt
  });

  const populated = await OrderMessage.findById(message._id)
    .populate('sender', 'name email shopName profileImage shopLogo')
    .populate('recipient', 'name email shopName profileImage shopLogo')
    .lean();

  await createNotification({
    userId: recipient._id,
    actorId: userId,
    type: 'order_message',
    metadata: {
      conversationId,
      orderId: conversation.orderId || null,
      messageId: message._id,
      messagePreview,
      hasAttachments,
      hasVoiceMessage: hasVoice,
      deepLink: messageDeepLink
    },
    deepLink: messageDeepLink,
    actionLink: messageDeepLink,
    entityType: 'conversation',
    entityId: String(conversationId),
    allowSelf: false
  });

  const unreadState = await incrementOrderConversationUnread(recipient._id, conversationId, 1);
  emitOrderUnreadUpdate({
    userId: String(recipient._id),
    conversationId: String(conversationId),
    totalUnread: unreadState.totalUnread,
    conversationUnread: unreadState.conversationUnread
  });

  const payload = toClientPayload(populated);

  emitOrderMessageCreated({
    conversationId,
    message: payload,
    senderId: String(userId),
    recipientId: String(recipient._id)
  });
  await auditAssistantMessageAction({
    access,
    conversation,
    metadata: { recipientId: String(recipient._id), hasAttachments, hasVoice: Boolean(hasVoice) }
  });

  res.status(201).json(payload);
});

/**
 * Unread message count across all conversations visible in the user's inbox.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { totalUnread } = await syncOrderUnreadState(userId);

  await setOrderUnreadTotal(userId, totalUnread);
  emitOrderUnreadUpdate({ userId: String(userId), totalUnread });

  res.json({ unreadCount: totalUnread });
});

export const archiveOrderConversation = asyncHandler(async (req, res) => {
  const conversationId = req.params.id || req.params.conversationId;
  const userId = req.user?.id || req.user?._id;
  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: 'Conversation invalide.' });
  }

  const { conversation, access } = await getConversationForUser({ id: conversationId, user: req.user });
  await archiveConversation({ id: conversationId, userId });
  await auditAssistantMessageAction({ access, conversation, action: 'assistant_conversation_archived' });

  res.json({ message: 'Conversation archivée.', archived: true });
});

export const unarchiveOrderConversation = asyncHandler(async (req, res) => {
  const conversationId = req.params.id || req.params.conversationId;
  const userId = req.user?.id || req.user?._id;
  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: 'Conversation invalide.' });
  }

  const { conversation, access } = await getConversationForUser({ id: conversationId, user: req.user });
  await unarchiveConversation({ id: conversationId, userId });
  await auditAssistantMessageAction({ access, conversation, action: 'assistant_conversation_unarchived' });

  res.json({ message: 'Conversation désarchivée.', archived: false });
});

export const deleteOrderConversation = asyncHandler(async (req, res) => {
  const conversationId = req.params.id || req.params.conversationId;
  const userId = req.user?.id || req.user?._id;
  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: 'Conversation invalide.' });
  }

  const { conversation, access } = await getConversationForUser({ id: conversationId, user: req.user });
  await deleteConversationForUser({ id: conversationId, userId });
  await auditAssistantMessageAction({ access, conversation, action: 'assistant_conversation_deleted' });

  res.json({ message: 'Conversation supprimée.', deleted: true });
});

/**
 * List all conversations visible in the current user's inbox, with their
 * latest message (denormalized on the Conversation doc) and unread count.
 */
export const getAllOrderConversations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { page = 1, limit = 20, archived = 'false' } = req.query;
  const showArchived = String(archived).toLowerCase() === 'true';

  const { items, total, page: pageNumber, totalPages } = await listConversationsForUser({
    user: req.user,
    page,
    limit,
    archived: showArchived
  });

  const { byConversation } = await syncOrderUnreadState(userId);

  const conversations = items.map((conversation) => {
    const buyer = conversation.buyerId;
    const seller = conversation.sellerId;
    const product = conversation.productId;
    const order = conversation.orderId;

    return {
      conversationId: conversation._id,
      orderId: order?._id || null,
      orderCode: order?.deliveryCode || null,
      status: order?.status || null,
      isInquiry: !order,
      createdAt: conversation.createdAt,
      customerId: buyer?._id || null,
      customerName: buyer?.name || null,
      customerProfileImage: buyer?.profileImage || buyer?.shopLogo || '',
      sellerId: seller?._id || null,
      sellerName: seller?.name || seller?.shopName || null,
      sellerProfileImage: seller?.profileImage || seller?.shopLogo || '',
      productInfo: {
        title: product?.title || null,
        image: Array.isArray(product?.images) ? product.images[0] : null,
        slug: product?.slug || null
      },
      latestMessage: conversation.lastMessageAt
        ? {
            text: conversation.lastMessagePreview,
            sender: conversation.lastMessageSenderId,
            createdAt: conversation.lastMessageAt
          }
        : null,
      unreadCount: Number(byConversation[String(conversation._id)] || 0)
    };
  });

  res.json({ items: conversations, total, page: pageNumber, pageSize: Number(limit) || 20, totalPages });
});

export const uploadOrderMessageAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Fichier requis.' });
  }

  try {
    const fileType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'document';

    const uploaded = await uploadToCloudinary({
      buffer: req.file.buffer,
      resourceType: fileType === 'image' ? 'image' : fileType === 'audio' ? 'video' : 'raw',
      folder: 'order-messages/attachments'
    });

    res.json({
      type: fileType,
      url: uploaded.secure_url || uploaded.url,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'upload du fichier.' });
  }
});

export const addOrderMessageReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant de message invalide.' });
  }
  if (!emoji) {
    return res.status(400).json({ message: 'Emoji requis.' });
  }

  const message = await OrderMessage.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  const { conversation, access } = await getConversationForUser({ id: message.conversation, user: req.user });

  message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId.toString());
  message.reactions.push({ emoji, userId });
  await message.save();

  emitOrderMessageUpdated({ conversationId: message.conversation, message });
  await auditAssistantMessageAction({
    access,
    conversation,
    action: 'assistant_message_reaction_added',
    metadata: { messageId: String(message._id), emoji }
  });

  res.json(message);
});

export const removeOrderMessageReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant de message invalide.' });
  }

  const message = await OrderMessage.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  const { conversation, access } = await getConversationForUser({ id: message.conversation, user: req.user });

  message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId.toString());
  await message.save();

  emitOrderMessageUpdated({ conversationId: message.conversation, message });
  await auditAssistantMessageAction({
    access,
    conversation,
    action: 'assistant_message_reaction_removed',
    metadata: { messageId: String(message._id) }
  });

  res.json(message);
});

export const deleteOrderMessage = asyncHandler(async (req, res) => {
  const conversationId = req.params.conversationId || req.params.id;
  const messageId = req.params.messageId;
  const userId = req.user?.id || req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  const { conversation, access } = await getConversationForUser({ id: conversationId, user: req.user });
  const { isAdmin } = access;

  const message = await OrderMessage.findOne({ _id: messageId, conversation: conversationId });
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  if (!isAdmin && String(message.sender) !== String(userId)) {
    return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages.' });
  }

  const recipientId = String(message.recipient || '');
  const wasUnreadForRecipient = Boolean(message.readAt == null && recipientId);

  await OrderMessage.deleteOne({ _id: messageId, conversation: conversationId });

  if (wasUnreadForRecipient) {
    const unreadState = await decrementOrderConversationUnread(recipientId, conversationId, 1);
    emitOrderUnreadUpdate({
      userId: recipientId,
      conversationId: String(conversationId),
      totalUnread: unreadState.totalUnread,
      conversationUnread: unreadState.conversationUnread
    });
  }
  await auditAssistantMessageAction({
    access,
    conversation,
    action: 'assistant_message_deleted',
    metadata: { messageId: String(messageId), wasUnreadForRecipient }
  });

  emitOrderMessageDeleted({ conversationId, messageId });

  res.status(200).json({ deleted: true, messageId });
});

export const updateOrderMessage = asyncHandler(async (req, res) => {
  const conversationId = req.params.conversationId || req.params.id;
  const messageId = req.params.messageId;
  const userId = req.user?.id || req.user?._id;
  const { text } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  await getConversationForUser({ id: conversationId, user: req.user });

  const message = await OrderMessage.findOne({ _id: messageId, conversation: conversationId });
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  if (String(message.sender) !== String(userId)) {
    return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages.' });
  }

  const hasAttachments = message.attachments?.length > 0;
  const hasVoice = message.voiceMessage?.url;
  if (hasAttachments || hasVoice) {
    return res.status(400).json({ message: 'Les messages avec pièce jointe ou vocal ne peuvent pas être modifiés.' });
  }

  const newText = text != null ? String(text).trim() : message.text;
  if (newText.length > 1000) {
    return res.status(400).json({ message: 'Le message ne doit pas dépasser 1000 caractères.' });
  }

  message.text = newText;
  await message.save();

  const populated = await OrderMessage.findById(message._id)
    .populate('sender', 'name email shopName profileImage shopLogo')
    .populate('recipient', 'name email shopName profileImage shopLogo')
    .lean();

  emitOrderMessageUpdated({ conversationId, message: populated });

  res.json(populated);
});
