import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import OrderMessage from '../models/orderMessageModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
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

  const messages = await OrderMessage.find({ order: orderId })
    .populate('sender', 'name email shopName')
    .populate('recipient', 'name email shopName')
    .sort({ createdAt: 1 })
    .limit(100);

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

  res.json(messages);
});

/**
 * Send a message for an order
 */
export const sendOrderMessage = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const { text, recipientId, encryptedText, encryptionData, attachments, voiceMessage } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!orderId) {
    return res.status(400).json({ message: 'ID de commande requis.' });
  }

  // Message must have at least text, encryptedText, attachments, or voiceMessage
  const hasText = text && text.trim();
  const hasEncrypted = encryptedText && encryptionData;
  const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
  const hasVoice = voiceMessage && voiceMessage.url;

  if (!hasText && !hasEncrypted && !hasAttachments && !hasVoice) {
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
      // Admin sends to customer by default (or can specify recipientId)
      recipient = await User.findById(order.customer).select('_id name email shopName');
    } else if (isCustomer) {
      // Customer sends to first seller (or we could send to all sellers)
      const firstItem = order.items?.find((item) => item?.snapshot?.shopId);
      const firstSellerId = firstItem?.snapshot?.shopId;
      if (firstSellerId) {
        recipient = await User.findById(firstSellerId).select('_id name email shopName');
      }
    } else if (isSeller) {
      // Seller sends to customer
      recipient = await User.findById(order.customer).select('_id name email shopName');
    }

    if (!recipient) {
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
    .populate('recipient', 'name email shopName');

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

  res.status(201).json(populated);
});

/**
 * Get unread message count for orders
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  const count = await OrderMessage.countDocuments({
    recipient: userId,
    readAt: null
  });

  res.json({ unreadCount: count });
});

/**
 * Get all order conversations for the current user
 * Returns orders with their latest message and unread count
 */
export const getAllOrderConversations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { page = 1, limit = 20 } = req.query;

  // If admin, get all orders
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
  let allOrders = [];
  
  if (isAdmin) {
    allOrders = await Order.find({ isDraft: false })
      .select('_id customer items status deliveryCode createdAt')
      .lean();
  } else {
    // Find all orders where user is customer or seller
    allOrders = await Order.find({
      $or: [
        { customer: userId },
        { 'items.snapshot.shopId': userId }
      ],
      isDraft: false
    }).select('_id customer items status deliveryCode createdAt').lean();
  }

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
      const productInfo = {
        title: firstItem?.snapshot?.title || 'Produit',
        image: firstItem?.snapshot?.image || null,
        shopName: firstItem?.snapshot?.shopName || null,
        shopId: firstItem?.snapshot?.shopId || null
      };

      return {
        orderId: order._id,
        orderCode: order.deliveryCode,
        status: order.status,
        createdAt: order.createdAt,
        customerId: order.customer,
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
