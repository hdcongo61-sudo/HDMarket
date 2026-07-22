/**
 * Conversations — buyer<->seller messaging threads, decoupled from Order.
 *
 * A conversation can be:
 *  - order-anchored (`orderId` set): logistics/support chat about one
 *    specific order. One distinct conversation per (buyer, seller, order).
 *  - general (`orderId` null): pre-sale/ongoing chat with a shop, not tied
 *    to any purchase. Exactly ONE per (buyer, seller) pair — this replaces
 *    the old "fake draft order per product question" hack
 *    (orderController.js's createInquiryOrder, now unused going forward).
 */
import Conversation from '../models/conversationModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import ShopAssistant from '../models/shopAssistantModel.js';

const MESSAGE_ASSISTANT_PERMISSIONS = [
  'respond_to_buyer_messages',
  'view_shop_orders',
  'update_order_status',
  'manage_delivery_requests'
];

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isAdminUser = (user = {}) =>
  user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager';

const getOrderSellerId = (order) => {
  const firstItem = order?.items?.[0];
  return firstItem?.snapshot?.shopId || null;
};

/**
 * Resolves an existing conversation or creates a new one.
 * Either pass `orderId` (order-anchored) or `sellerId` (+ optional
 * `productId`, general chat) — never trust a client-supplied buyer/seller
 * pair without deriving it from the order when one is given.
 */
export const resolveOrCreateConversation = async ({ requesterId, orderId, sellerId, productId }) => {
  if (orderId) {
    const order = await Order.findById(orderId).select('customer items.snapshot.shopId').lean();
    if (!order) throw createHttpError('Commande introuvable.', 404);

    const resolvedSellerId = getOrderSellerId(order);
    if (!resolvedSellerId) throw createHttpError('Vendeur introuvable pour cette commande.', 400);

    const isCustomer = String(order.customer) === String(requesterId);
    const isSeller = String(resolvedSellerId) === String(requesterId);
    const access = isCustomer || isSeller || (await hasAssistantAccess(requesterId, resolvedSellerId));
    if (!access) throw createHttpError('Accès non autorisé à cette commande.', 403);

    const buyerId = order.customer;

    let conversation = await Conversation.findOne({ buyerId, sellerId: resolvedSellerId, orderId });
    if (!conversation) {
      conversation = await Conversation.create({ buyerId, sellerId: resolvedSellerId, orderId });
    }
    return conversation;
  }

  if (sellerId) {
    if (String(sellerId) === String(requesterId)) {
      throw createHttpError('Vous ne pouvez pas ouvrir une conversation avec vous-même.', 400);
    }
    const seller = await User.findById(sellerId).select('_id').lean();
    if (!seller) throw createHttpError('Vendeur introuvable.', 404);

    let conversation = await Conversation.findOne({ buyerId: requesterId, sellerId, orderId: null });
    if (!conversation) {
      conversation = await Conversation.create({
        buyerId: requesterId,
        sellerId,
        orderId: null,
        productId: productId || null
      });
    } else if (productId && String(conversation.productId || '') !== String(productId)) {
      conversation.productId = productId;
      await conversation.save();
    }
    return conversation;
  }

  throw createHttpError('orderId ou sellerId requis.', 400);
};

const hasAssistantAccess = async (userId, sellerId, requireMessagePermission = false) => {
  const assignment = await ShopAssistant.findOne({
    assistant: userId,
    shop: sellerId,
    status: 'active',
    permissions: { $in: requireMessagePermission ? ['respond_to_buyer_messages'] : MESSAGE_ASSISTANT_PERMISSIONS }
  })
    .select('_id')
    .lean();
  return Boolean(assignment);
};

/**
 * Loads a conversation and resolves the requester's access role within it.
 * Mirrors the old resolveOrderMessageAccess but keyed by conversation
 * membership instead of order membership.
 */
export const resolveConversationAccess = async ({ userId, conversation, requireMessagePermission = false }) => {
  const isBuyer = String(conversation.buyerId) === String(userId);
  const isSeller = String(conversation.sellerId) === String(userId);
  const isAdminAccess = false; // set by caller when req.user is admin
  const access = {
    userId,
    actorId: userId,
    isCustomer: isBuyer,
    isSeller,
    isAdmin: isAdminAccess,
    isAssistant: false,
    canAccess: isBuyer || isSeller
  };
  if (access.canAccess) return access;

  const isAssistant = await hasAssistantAccess(userId, conversation.sellerId, requireMessagePermission);
  if (isAssistant) {
    return { ...access, isSeller: true, isAssistant: true, canAccess: true };
  }
  return access;
};

export const getConversationForUser = async ({ id, user, requireMessagePermission = false }) => {
  const conversation = await Conversation.findById(id);
  if (!conversation) throw createHttpError('Conversation introuvable.', 404);

  const access = await resolveConversationAccess({
    userId: user?.id || user?._id,
    conversation,
    requireMessagePermission
  });
  if (isAdminUser(user)) access.isAdmin = true;
  if (!access.canAccess && !access.isAdmin) {
    throw createHttpError('Accès non autorisé à cette conversation.', 403);
  }
  return { conversation, access };
};

const buildVisibilityQuery = async (userId) => {
  const sellerIds = [userId];
  const assignments = await ShopAssistant.find({
    assistant: userId,
    status: 'active',
    permissions: { $in: MESSAGE_ASSISTANT_PERMISSIONS }
  })
    .select('shop')
    .lean();
  assignments.forEach((entry) => entry.shop && sellerIds.push(entry.shop));

  return { $or: [{ buyerId: userId }, { sellerId: { $in: sellerIds } }] };
};

export const listConversationsForUser = async ({ user, page = 1, limit = 20, archived = false }) => {
  const userId = user?.id || user?._id;
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));

  const visibility = isAdminUser(user) ? {} : await buildVisibilityQuery(userId);
  const filter = {
    ...visibility,
    lastMessageAt: { $ne: null },
    deletedBy: { $nin: [userId] },
    archivedBy: archived ? userId : { $ne: userId }
  };

  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('buyerId', 'name profileImage shopLogo')
      .populate('sellerId', 'name shopName profileImage shopLogo')
      .populate('orderId', 'status deliveryCode')
      .populate('productId', 'title images slug')
      .lean(),
    Conversation.countDocuments(filter)
  ]);

  return { items, total, page: pageNumber, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const archiveConversation = async ({ id, userId }) => {
  await Conversation.updateOne({ _id: id }, { $addToSet: { archivedBy: userId } });
};

export const unarchiveConversation = async ({ id, userId }) => {
  await Conversation.updateOne({ _id: id }, { $pull: { archivedBy: userId } });
};

export const deleteConversationForUser = async ({ id, userId }) => {
  await Conversation.updateOne({ _id: id }, { $addToSet: { deletedBy: userId } });
};

export const touchConversationLastMessage = async ({ id, preview, senderId, at = new Date() }) => {
  await Conversation.updateOne(
    { _id: id },
    { $set: { lastMessageAt: at, lastMessagePreview: preview, lastMessageSenderId: senderId } }
  );
};
