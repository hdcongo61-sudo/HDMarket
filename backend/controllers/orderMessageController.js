import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import OrderMessage from '../models/orderMessageModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import { createNotification } from '../utils/notificationService.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';

/**
 * Get messages for an order
 * Only the customer and sellers of the order can access messages
 */
export const getOrderMessages = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const userId = req.user?.id || req.user?._id;

  if (!orderId) {
    return res.status(400).json({ message: 'ID de commande requis.' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Verify user has access to this order
  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à accéder à cette conversation.' });
  }

  const raw = await OrderMessage.find({ order: orderId })
    .populate('sender', 'name email shopName')
    .populate('recipient', 'name email shopName')
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  // Mark messages as read for the current user
  await OrderMessage.updateMany(
    {
      order: orderId,
      recipient: userId,
      readAt: null
    },
    {
      $set: { readAt: new Date() }
    }
  );

  // Normalize so every message has _id and sender/recipient._id for consistent display (customer/seller/admin)
  const messages = raw.map((m) => ({
    ...m,
    _id: m._id,
    sender: m.sender ? { ...m.sender, _id: m.sender._id } : m.sender,
    recipient: m.recipient ? { ...m.recipient, _id: m.recipient._id } : m.recipient
  }));
  res.json(messages);
});

/**
 * Send a message for an order
 */
export const sendOrderMessage = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const body = req.body ?? {};
  let { text, recipientId, encryptedText, encryptionData, attachments, voiceMessage } = body;
  const userId = req.user?.id || req.user?._id;

  // Normalize recipientId (may be object when populated from API)
  if (recipientId != null && typeof recipientId === 'object' && recipientId._id) {
    recipientId = String(recipientId._id);
  } else if (recipientId != null && typeof recipientId !== 'string') {
    recipientId = null;
  }
  if (recipientId === '') recipientId = null;

  if (!orderId) {
    return res.status(400).json({ message: 'ID de commande requis.' });
  }

  // Message must have at least text, encryptedText, attachments, or voiceMessage
  const hasText = text && text.trim();
  const hasEncrypted = encryptedText && encryptionData;
  const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
  const hasVoice = voiceMessage && voiceMessage.url;

  if (!hasText && !hasEncrypted && !hasAttachments && !hasVoice) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[orderMessage] 400: empty message', { orderId, bodyKeys: Object.keys(req.body || {}) });
    }
    return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Verify user has access to this order
  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à envoyer un message pour cette commande.' });
  }

  // Determine recipient
  let recipient = null;
  if (recipientId) {
    // Verify recipient is part of the order
    const recipientIsCustomer = String(order.customer) === String(recipientId);
    const recipientIsSeller = order.items?.some(
      (item) => item?.snapshot?.shopId && String(item.snapshot.shopId) === String(recipientId)
    );

    if (!recipientIsCustomer && !recipientIsSeller) {
      return res.status(400).json({ message: 'Le destinataire n\'est pas associé à cette commande.' });
    }

    recipient = await User.findById(recipientId).select('_id name email shopName');
    if (!recipient) {
      return res.status(404).json({ message: 'Destinataire introuvable.' });
    }
  } else {
    // Auto-determine recipient based on sender role
    if (isAdmin) {
      // Admin: if admin is the order customer (e.g. opened inquiry from product page), send to seller; else send to customer
      const customerId = order.customer;
      const adminIsCustomer = String(customerId) === String(userId);
      if (adminIsCustomer) {
        const firstItem = order.items?.[0];
        let firstSellerId = firstItem?.snapshot?.shopId;
        if (!firstSellerId && firstItem?.product) {
          const product = await Product.findById(firstItem.product).select('user').lean();
          firstSellerId = product?.user;
        }
        if (firstSellerId) {
          recipient = await User.findById(firstSellerId).select('_id name email shopName');
        }
      } else {
        if (!customerId) {
          return res.status(400).json({ message: 'Cette commande n\'a pas de client associé.' });
        }
        recipient = await User.findById(customerId).select('_id name email shopName');
      }
      if (!recipient) {
        return res.status(400).json({ message: adminIsCustomer ? 'Impossible de déterminer le vendeur.' : 'Le client de cette commande est introuvable.' });
      }
    } else if (isCustomer) {
      // Customer sends to first seller (from snapshot.shopId or product.user for inquiry orders)
      const firstItem = order.items?.[0];
      let firstSellerId = firstItem?.snapshot?.shopId;
      if (!firstSellerId && firstItem?.product) {
        const product = await Product.findById(firstItem.product).select('user').lean();
        firstSellerId = product?.user;
      }
      if (firstSellerId) {
        recipient = await User.findById(firstSellerId).select('_id name email shopName');
      }
    } else if (isSeller) {
      // Seller sends to customer
      recipient = await User.findById(order.customer).select('_id name email shopName');
    }

    if (!recipient) {
      if (process.env.NODE_ENV !== 'production') {
        const firstItem = order.items?.[0];
        console.warn('[orderMessage] 400: no recipient', {
          orderId,
          isCustomer,
          isSeller,
          firstItemShopId: firstItem?.snapshot?.shopId,
          firstItemProduct: firstItem?.product
        });
      }
      return res.status(400).json({ message: 'Impossible de déterminer le destinataire.' });
    }
  }

  if (String(recipient._id) === String(userId)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer un message.' });
  }

  const messageData = {
    order: orderId,
    sender: userId,
    recipient: recipient._id,
    metadata: {
      orderStatus: order.status,
      orderCode: order.deliveryCode
    }
  };

  // Add text or encrypted text
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
    // Store placeholder text for encrypted messages
    messageData.text = hasText ? text.trim() : '[Message chiffré]';
  } else if (hasText) {
    messageData.text = text.trim();
  }

  // Add attachments
  if (hasAttachments) {
    messageData.attachments = attachments;
  }

  // Add voice message
  if (hasVoice) {
    messageData.voiceMessage = voiceMessage;
  }

  const message = await OrderMessage.create(messageData);

  const populated = await OrderMessage.findById(message._id)
    .populate('sender', 'name email shopName')
    .populate('recipient', 'name email shopName')
    .lean();

  // Send notification to recipient
  await createNotification({
    userId: recipient._id,
    actorId: userId,
    type: 'order_message',
    metadata: {
      orderId: order._id,
      messageId: message._id,
      orderCode: order.deliveryCode,
      status: order.status
    },
    allowSelf: false
  });

  // Return plain object with explicit _id so both GET and POST have same shape for sender/admin
  const payload = populated ? {
    ...populated,
    _id: populated._id,
    sender: populated.sender ? { _id: populated.sender._id, name: populated.sender.name, email: populated.sender.email, shopName: populated.sender.shopName } : null,
    recipient: populated.recipient ? { _id: populated.recipient._id, name: populated.recipient.name, email: populated.recipient.email, shopName: populated.recipient.shopName } : null
  } : populated;
  res.status(201).json(payload);
});

/**
 * Get unread message count for orders (excludes deleted and archived conversations)
 * Only counts unread in conversations that appear in the user's inbox.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  const orderQuery = {
    $and: [
      { $or: [{ isDraft: false }, { isInquiry: true }] },
      { $or: [{ archivedBy: { $exists: false } }, { archivedBy: { $ne: userId } }] },
      { $or: [{ deletedBy: { $exists: false } }, { deletedBy: { $nin: [userId] } }] }
    ]
  };
  if (!isAdmin) {
    orderQuery.$and.push({
      $or: [
        { customer: userId },
        { 'items.snapshot.shopId': userId }
      ]
    });
  }

  const visibleOrderIds = await Order.find(orderQuery).select('_id').lean().then((orders) => orders.map((o) => o._id));
  if (visibleOrderIds.length === 0) {
    return res.json({ unreadCount: 0 });
  }

  const count = await OrderMessage.countDocuments({
    order: { $in: visibleOrderIds },
    recipient: userId,
    readAt: null
  });

  res.json({ unreadCount: count });
});

/**
 * Archive an order conversation for the current user (hide from main list)
 */
export const archiveOrderConversation = asyncHandler(async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  const userId = req.user?.id || req.user?._id;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à archiver cette conversation.' });
  }

  if (!order.archivedBy) order.archivedBy = [];
  if (!order.archivedBy.some((id) => String(id) === String(userId))) {
    order.archivedBy.push(userId);
    await order.save();
  }

  res.json({ message: 'Conversation archivée.', archived: true });
});

/**
 * Unarchive an order conversation for the current user
 */
export const unarchiveOrderConversation = asyncHandler(async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  const userId = req.user?.id || req.user?._id;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à désarchiver cette conversation.' });
  }

  if (order.archivedBy && order.archivedBy.length) {
    order.archivedBy = order.archivedBy.filter((id) => String(id) !== String(userId));
    await order.save();
  }

  res.json({ message: 'Conversation désarchivée.', archived: false });
});

/**
 * Delete (hide) an order conversation for the current user
 */
export const deleteOrderConversation = asyncHandler(async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  const userId = req.user?.id || req.user?._id;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer cette conversation.' });
  }

  if (!order.deletedBy) order.deletedBy = [];
  if (!order.deletedBy.some((id) => String(id) === String(userId))) {
    order.deletedBy.push(userId);
    await order.save();
  }

  res.json({ message: 'Conversation supprimée.', deleted: true });
});

/**
 * Get all order conversations for the current user
 * Returns orders with their latest message and unread count
 */
export const getAllOrderConversations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { page = 1, limit = 20, archived = 'false' } = req.query;
  const showArchived = String(archived).toLowerCase() === 'true';

  // If admin, get all orders
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
  let query = {
    $and: [
      { $or: [{ isDraft: false }, { isInquiry: true }] }
    ]
  };

  if (!isAdmin) {
    query.$and.push({
      $or: [
        { customer: userId },
        { 'items.snapshot.shopId': userId }
      ]
    });
  }

  // Filter by archived: false = exclude archived by this user, true = only archived by this user
  if (showArchived) {
    query.$and.push({ archivedBy: userId });
  } else {
    query.$and.push({ archivedBy: { $ne: userId } });
  }

  // Exclude conversations deleted by the current user
  query.$and.push({
    $or: [
      { deletedBy: { $exists: false } },
      { deletedBy: { $nin: [userId] } }
    ]
  });

  const allOrders = await Order.find(query)
    .select('_id customer items status deliveryCode createdAt isInquiry archivedBy deletedBy')
    .populate('customer', 'name')
    .lean();

  const orderIds = allOrders.map((order) => order._id);

  // Get latest message and unread count for each order
  const conversations = await Promise.all(
    allOrders.map(async (order) => {
      // Get latest message
      const latestMessage = await OrderMessage.findOne({ order: order._id })
        .populate('sender', 'name email shopName')
        .sort({ createdAt: -1 })
        .lean();

      // Get unread count for current user
      const unreadCount = await OrderMessage.countDocuments({
        order: order._id,
        recipient: userId,
        readAt: null
      });

      // Get first product info for display
      const firstItem = order.items?.[0];
      const customer = order.customer;
      const productInfo = {
        title: firstItem?.snapshot?.title || 'Produit',
        image: firstItem?.snapshot?.image || null,
        shopName: firstItem?.snapshot?.shopName || null,
        shopId: firstItem?.snapshot?.shopId || null,
        slug: firstItem?.snapshot?.slug || null
      };

      return {
        orderId: order._id,
        orderCode: order.deliveryCode,
        status: order.status,
        isInquiry: Boolean(order.isInquiry),
        createdAt: order.createdAt,
        customerId: customer?._id || order.customer,
        customerName: customer?.name || null,
        sellerId: firstItem?.snapshot?.shopId || null,
        productInfo,
        latestMessage: latestMessage ? {
          _id: latestMessage._id,
          text: latestMessage.text,
          sender: latestMessage.sender,
          createdAt: latestMessage.createdAt
        } : null,
        unreadCount
      };
    })
  );

  // Sort by latest message date (most recent first)
  conversations.sort((a, b) => {
    const aDate = a.latestMessage?.createdAt || a.createdAt;
    const bDate = b.latestMessage?.createdAt || b.createdAt;
    return new Date(bDate) - new Date(aDate);
  });

  // Pagination
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 50));
  const skip = (pageNumber - 1) * pageSize;
  const paginatedConversations = conversations.slice(skip, skip + pageSize);
  const totalPages = Math.max(1, Math.ceil(conversations.length / pageSize));

  res.json({
    items: paginatedConversations,
    total: conversations.length,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

/**
 * Upload attachment for order message
 */
export const uploadOrderMessageAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Fichier requis.' });
  }
  
  try {
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' :
                     req.file.mimetype.startsWith('audio/') ? 'audio' : 'document';
    
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

/**
 * Add reaction to order message
 */
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

  // Verify user has access to this message
  const order = await Order.findById(message.order);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à réagir à ce message.' });
  }
  
  // Remove existing reaction from same user
  message.reactions = message.reactions.filter(
    r => r.userId.toString() !== userId.toString()
  );
  
  // Add new reaction
  message.reactions.push({
    emoji,
    userId: userId
  });
  
  await message.save();
  
  res.json(message);
});

/**
 * Remove reaction from order message
 */
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

  // Verify user has access to this message
  const order = await Order.findById(message.order);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce message.' });
  }
  
  // Remove all reactions from this user
  message.reactions = message.reactions.filter(
    r => r.userId.toString() !== userId.toString()
  );
  
  await message.save();
  
  res.json(message);
});

/**
 * Delete an order message permanently (for both seller and buyer)
 * Only order participants (customer, seller, admin) can delete; message is removed from DB for everyone.
 */
export const deleteOrderMessage = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const messageId = req.params.messageId;
  const userId = req.user?.id || req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isCustomer = String(order.customer) === String(userId);
  const isSeller = order.items?.some(
    (item) => String(item?.snapshot?.shopId) === String(userId)
  );
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';

  if (!isCustomer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer ce message.' });
  }

  const message = await OrderMessage.findOne({ _id: messageId, order: orderId });
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  // Only the sender (or admin) can delete their own message
  if (!isAdmin && String(message.sender) !== String(userId)) {
    return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages.' });
  }

  await OrderMessage.deleteOne({ _id: messageId, order: orderId });
  res.status(200).json({ deleted: true, messageId });
});

/**
 * Update an order message (text only). Only the sender can update their own message.
 */
export const updateOrderMessage = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const messageId = req.params.messageId;
  const userId = req.user?.id || req.user?._id;
  const { text } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const message = await OrderMessage.findOne({ _id: messageId, order: orderId });
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  if (String(message.sender) !== String(userId)) {
    return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages.' });
  }

  // Only text-only messages can be edited (no attachments/voice)
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
    .populate('sender', 'name email shopName')
    .populate('recipient', 'name email shopName')
    .lean();

  res.json(populated);
});
