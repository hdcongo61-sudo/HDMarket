import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import Cart from '../models/cartModel.js';
import { createNotification } from '../utils/notificationService.js';
import { isTwilioMessagingConfigured, sendSms } from '../utils/twilioMessaging.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import { calculateProductSalesCount } from '../utils/salesCalculator.js';

const ORDER_STATUS = ['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'];

const formatSmsAmount = (value) =>
  Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

const buildSmsItemsSummary = (items = [], limit = 2) => {
  const list = Array.isArray(items) ? items : [];
  const parts = list.slice(0, limit).map((item) => {
    const title = item?.snapshot?.title || item?.product?.title || 'Produit';
    const qty = Number(item?.quantity || 0);
    const price = item?.snapshot?.price;
    const priceLabel = Number.isFinite(Number(price)) ? `${formatSmsAmount(price)} FCFA` : '';
    const qtyLabel = qty > 1 ? ` x${qty}` : '';
    return [title + qtyLabel, priceLabel].filter(Boolean).join(' @ ');
  });
  if (!parts.length) return '';
  const remaining = list.length - parts.length;
  return `Articles : ${parts.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
};

const buildOrderSmsDetails = (order) => {
  if (!order) return '';
  const itemsSummary = buildSmsItemsSummary(order.items);
  const total = `Total : ${formatSmsAmount(order.totalAmount)} FCFA`;
  const paidAmount =
    Number(order.paidAmount || 0) ||
    Math.round(Number(order.totalAmount || 0) * 0.25);
  const deposit = paidAmount ? `Acompte : ${formatSmsAmount(paidAmount)} FCFA` : '';
  const delivery = order.deliveryAddress
    ? `Livraison : ${order.deliveryAddress}${order.deliveryCity ? `, ${order.deliveryCity}` : ''}`
    : '';
  return [itemsSummary, total, deposit, delivery].filter(Boolean).join(' | ');
};

const buildOrderPendingMessage = (order) => {
  if (!order) return '';
  const deliveryCode = order.deliveryCode ? ` Code de livraison: ${order.deliveryCode}` : '';
  let orderId = '';
  if (order._id) {
    try {
      orderId = String(order._id).slice(-6);
    } catch (e) {
      orderId = String(order._id).substring(String(order._id).length - 6);
    }
  }
  return `HDMarket : Votre commande ${orderId} est en attente.${deliveryCode} ${buildOrderSmsDetails(order)}`;
};

const buildOrderDeliveringMessage = (order) => {
  if (!order) return '';
  const deliveryCode = order.deliveryCode ? ` Code de livraison: ${order.deliveryCode}` : '';
  let orderId = '';
  if (order._id) {
    try {
      orderId = String(order._id).slice(-6);
    } catch (e) {
      orderId = String(order._id).substring(String(order._id).length - 6);
    }
  }
  return `HDMarket : Votre commande ${orderId} est en cours de livraison.${deliveryCode} ${buildOrderSmsDetails(order)}`;
};

const sendOrderSms = async ({ phone, message, context }) => {
  if (!phone || !isTwilioMessagingConfigured()) return;
  try {
    await sendSms(phone, message);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Order SMS failed', context, error?.message || error);
  }
};

const baseOrderQuery = () =>
  Order.find()
    .populate('customer', 'name email phone address city')
    .populate({
      path: 'items.product',
      select: 'title price images status user slug',
      populate: { path: 'user', select: 'name shopName phone' }
    })
    .populate('deliveryGuy', 'name phone active')
    .populate('createdBy', 'name email');

const collectOrderProductRefs = (orders = []) => {
  const list = Array.isArray(orders) ? orders : [orders];
  const seen = new Set();
  const products = [];
  list.forEach((order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    items.forEach((item) => {
      const product = item?.product;
      if (!product || typeof product !== 'object') return;
      const id = String(product._id || '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      products.push(product);
    });
  });
  return products;
};

const ensureOrderProductSlugs = async (orders = []) => {
  const productRefs = collectOrderProductRefs(orders);
  if (!productRefs.length) return;
  await ensureModelSlugsForItems({ Model: Product, items: productRefs, sourceValueKey: 'title' });
};

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const generateDeliveryCode = async () => {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    // Generate a 6-digit code
    code = String(Math.floor(100000 + Math.random() * 900000));
    
    // Check if code already exists
    const existing = await Order.findOne({ deliveryCode: code });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    // Fallback: use timestamp-based code if all attempts fail
    code = String(Date.now()).slice(-6);
  }
  
  return code;
};

const resolveItemShopId = (item) =>
  item?.snapshot?.shopId ||
  item?.product?.user ||
  item?.product?.user?._id ||
  null;

const filterOrderItemsForSeller = (order, sellerId) => {
  if (!order) return [];
  const sellerKey = String(sellerId);
  const items = Array.isArray(order.items) ? order.items : [];
  return items.filter((item) => {
    const shopId = resolveItemShopId(item);
    return shopId && String(shopId) === sellerKey;
  });
};

// Check if order is within 30-minute cancellation window
const isWithinCancellationWindow = (order) => {
  if (!order || !order.createdAt) return false;
  if (order.status === 'cancelled' || order.status === 'delivered') return false;
  
  const createdAt = new Date(order.createdAt);
  const now = new Date();
  const diffMs = now - createdAt;
  const diffMinutes = diffMs / (1000 * 60);
  
  return diffMinutes <= 30;
};

// Get remaining cancellation time in milliseconds
const getCancellationWindowRemaining = (order) => {
  if (!order || !order.createdAt) return 0;
  if (order.status === 'cancelled' || order.status === 'delivered') return 0;
  
  const createdAt = new Date(order.createdAt);
  const cancellationDeadline = new Date(createdAt.getTime() + 30 * 60 * 1000); // 30 minutes
  const now = new Date();
  const remaining = cancellationDeadline - now;
  
  return Math.max(0, remaining);
};

const buildOrderResponse = (order) => {
  if (!order) return null;
  const obj = order.toObject ? order.toObject() : order;
  return {
    ...obj,
    items: Array.isArray(obj.items)
      ? obj.items.map((item) => ({
          ...item,
          snapshot: item.snapshot || {}
        }))
      : [],
    customer: obj.customer
      ? {
          _id: obj.customer._id,
          name: obj.customer.name,
          email: obj.customer.email,
          phone: obj.customer.phone,
          address: obj.customer.address,
          city: obj.customer.city
        }
      : null,
    createdBy: obj.createdBy
      ? {
          _id: obj.createdBy._id,
          name: obj.createdBy.name,
          email: obj.createdBy.email
        }
      : null,
    deliveryGuy: obj.deliveryGuy
      ? {
          _id: obj.deliveryGuy._id,
          name: obj.deliveryGuy.name,
          phone: obj.deliveryGuy.phone,
          active: obj.deliveryGuy.active
        }
      : null,
    cancelledAt: obj.cancelledAt || null,
    cancellationReason: obj.cancellationReason || '',
    cancelledBy: obj.cancelledBy || null,
    deliveryCode: obj.deliveryCode || null,
    isDraft: obj.isDraft || false,
    draftPayments: Array.isArray(obj.draftPayments) ? obj.draftPayments : [],
    cancellationWindow: {
      isActive: isWithinCancellationWindow(obj),
      remainingMs: getCancellationWindowRemaining(obj),
      deadline: obj.createdAt ? new Date(new Date(obj.createdAt).getTime() + 30 * 60 * 1000).toISOString() : null
    }
  };
};

export const adminCreateOrder = asyncHandler(async (req, res) => {
  const { items, customerId, deliveryAddress, deliveryCity, trackingNote } = req.body;

  if (!ensureObjectId(customerId)) {
    return res.status(400).json({ message: 'Client invalide.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Veuillez sélectionner au moins un produit.' });
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1
  }));

  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const [customer, productDocs] = await Promise.all([
    User.findById(customerId).select('name email phone address city'),
    Product.find({ _id: { $in: productIds } }).populate('user', 'shopName name slug')
  ]);

  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }

  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));
  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || product.status !== 'approved') {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      return {
        product: product._id,
        quantity: item.quantity,
        snapshot: {
          title: product.title,
          price: product.price,
          image: Array.isArray(product.images) ? product.images[0] : null,
          shopName: product.user?.shopName || product.user?.name || '',
          shopId: product.user?._id || null,
          confirmationNumber: product.confirmationNumber || '',
          slug: product.slug || null
        }
      };
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
    0
  );

  const deliveryCode = await generateDeliveryCode();

  const order = await Order.create({
    items: orderItems,
    customer: customer._id,
    createdBy: req.user.id,
    deliveryAddress: deliveryAddress.trim(),
    deliveryCity,
    trackingNote: trackingNote?.trim() || '',
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount,
    deliveryCode
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  await createNotification({
    userId: customer._id,
    actorId: req.user.id,
    type: 'order_created',
    metadata: {
      orderId: order._id,
      deliveryCity,
      deliveryAddress,
      status: 'pending'
    },
    allowSelf: true
  });

  await sendOrderSms({
    phone: customer.phone,
    message: buildOrderPendingMessage(order),
    context: `order_created:${order._id}`
  });

  res.status(201).json(buildOrderResponse(populated));
});

export const userCheckoutOrder = asyncHandler(async (req, res) => {
  const { payerName, transactionCode, payments } = req.body;
  const userId = req.user?.id || req.user?._id;

  const customer = await User.findById(userId).select('name email phone address city');
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }
  if (!customer.address || !customer.city) {
    return res.status(400).json({
      message: 'Veuillez compléter votre adresse et votre ville avant de confirmer la commande.'
    });
  }

  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(400).json({ message: 'Votre panier est vide.' });
  }

  const normalizedItems = cart.items.map((item) => ({
    productId: item.product,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1
  }));
  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const productDocs = await Product.find({ _id: { $in: productIds } }).populate(
    'user',
    'shopName name slug'
  );
  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));

  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!product || product.status !== 'approved') {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      return {
        product: product._id,
        quantity: item.quantity,
        snapshot: {
          title: product.title,
          price: product.price,
          image: Array.isArray(product.images) ? product.images[0] : null,
          shopName: product.user?.shopName || product.user?.name || '',
          shopId: product.user?._id || null,
          confirmationNumber: product.confirmationNumber || '',
          slug: product.slug || null
        }
      };
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const missingSellerItem = orderItems.find((item) => !resolveItemShopId(item));
  if (missingSellerItem) {
    return res.status(400).json({ message: 'Vendeur introuvable pour un produit.' });
  }

  const itemsBySeller = new Map();
  orderItems.forEach((item) => {
    const shopId = resolveItemShopId(item);
    if (!shopId) return;
    const shopKey = String(shopId);
    if (!itemsBySeller.has(shopKey)) {
      itemsBySeller.set(shopKey, []);
    }
    itemsBySeller.get(shopKey).push(item);
  });

  if (!itemsBySeller.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à la commande.' });
  }

  const normalizedPayments = Array.isArray(payments) ? payments : [];
  const paymentsBySeller = new Map();
  if (normalizedPayments.length) {
    for (const payment of normalizedPayments) {
      if (!ensureObjectId(payment?.sellerId)) {
        return res.status(400).json({ message: 'Vendeur invalide.' });
      }
      paymentsBySeller.set(String(payment.sellerId), {
        payerName: payment?.payerName?.trim() || '',
        transactionCode: payment?.transactionCode?.trim() || ''
      });
    }
  }

  const fallbackPayer = payerName?.trim() || '';
  const fallbackTransaction = transactionCode?.trim() || '';
  const usePaymentList = paymentsBySeller.size > 0;

  if (!usePaymentList && itemsBySeller.size > 1) {
    return res
      .status(400)
      .json({ message: 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.' });
  }

  if (!usePaymentList && (!fallbackPayer || !fallbackTransaction)) {
    return res.status(400).json({ message: 'Veuillez renseigner le nom et le code de transaction.' });
  }

  if (usePaymentList) {
    const missingPayments = Array.from(itemsBySeller.keys()).filter((sellerId) => {
      const payment = paymentsBySeller.get(sellerId);
      return !payment || !payment.payerName || !payment.transactionCode;
    });
    if (missingPayments.length) {
      return res
        .status(400)
        .json({ message: 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.' });
    }
  }

  // Delete existing draft orders for this user when confirming
  await Order.deleteMany({ customer: userId, isDraft: true });

  // Generate unique delivery codes for each order
  const orderPayloads = await Promise.all(
    Array.from(itemsBySeller.entries()).map(async ([sellerId, sellerItems]) => {
      const totalAmount = sellerItems.reduce(
        (sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
        0
      );
      const paidAmount = Math.round(totalAmount * 0.25);
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const paymentInfo = usePaymentList
        ? paymentsBySeller.get(sellerId)
        : { payerName: fallbackPayer, transactionCode: fallbackTransaction };

      const deliveryCode = await generateDeliveryCode();

      return {
        sellerId,
        items: sellerItems,
        customer: customer._id,
        createdBy: userId,
        deliveryAddress: customer.address,
        deliveryCity: customer.city,
        trackingNote: '',
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentName: paymentInfo.payerName,
        paymentTransactionCode: paymentInfo.transactionCode,
        deliveryCode
      };
    })
  );

  const createdOrders = await Order.create(
    orderPayloads.map(({ sellerId, ...payload }) => payload)
  );

  await Cart.updateOne({ user: userId }, { $set: { items: [] } });

  const populated = await baseOrderQuery().find({
    _id: { $in: createdOrders.map((order) => order._id) }
  });
  await ensureOrderProductSlugs(populated);

  await Promise.all(
    createdOrders.map((order, index) => {
      const { sellerId, items } = orderPayloads[index];
      const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
      const totalAmount = Number(order.totalAmount || 0);
      const productId = items[0]?.product || null;
      return createNotification({
        userId: sellerId,
        actorId: userId,
        productId,
        type: 'order_received',
        metadata: {
          orderId: order._id,
          itemCount,
          totalAmount
        }
      });
    })
  );

  await Promise.all(
    createdOrders.map((order) =>
      createNotification({
        userId: customer._id,
        actorId: userId,
        type: 'order_created',
        metadata: {
          orderId: order._id,
          deliveryCity: order.deliveryCity,
          deliveryAddress: order.deliveryAddress,
          status: 'pending'
        },
        allowSelf: true
      })
    )
  );

  await Promise.all(
    createdOrders.map((order) =>
      sendOrderSms({
        phone: customer.phone,
        message: buildOrderPendingMessage(order),
        context: `order_created:${order._id}`
      })
    )
  );

  const responseOrders = populated.map(buildOrderResponse);
  if (responseOrders.length === 1) {
    return res.status(201).json(responseOrders[0]);
  }

  res.status(201).json({ orders: responseOrders, count: responseOrders.length });
});

export const adminListOrders = asyncHandler(async (req, res) => {
  const { status, search = '', page = 1, limit = 20 } = req.query;
  const filter = {};

  if (status && ORDER_STATUS.includes(status)) {
    filter.status = status;
  }

  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const customerIds = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }]
    })
      .limit(50)
      .select('_id');

    filter.$or = [
      { 'items.snapshot.title': regex }, // Recherche par nom de produit
      { 'items.snapshot.shopName': regex }, // Recherche par nom de boutique
      { trackingNote: regex },
      { deliveryAddress: regex },
      { deliveryCode: regex } // Recherche par code de livraison
    ];
    if (customerIds.length) {
      filter.$or.push({ customer: { $in: customerIds.map((c) => c._id) } });
    }
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    items: orders.map(buildOrderResponse),
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const adminUpdateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const { status, deliveryAddress, deliveryCity, trackingNote, deliveryGuyId, cancellationReason } = req.body;
  const previousStatus = order.status;
  let notifyPending = false;
  let notifyConfirmed = false;
  let notifyDelivering = false;
  let notifyDelivered = false;
  let notifyCancelled = false;
  let deliveredTimestampAdded = false;

  if (status) {
    if (!ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    // Prevent cancelling already delivered orders
    if (status === 'cancelled' && order.status === 'delivered') {
      return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
    }
    if (order.status !== status) {
      order.status = status;
      notifyPending = status === 'pending';
      notifyConfirmed = status === 'confirmed';
      notifyDelivering = status === 'delivering';
      notifyDelivered = status === 'delivered';
      notifyCancelled = status === 'cancelled';
    }
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
      notifyDelivered = true;
      deliveredTimestampAdded = true;
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancelledBy = req.user.id;
      if (cancellationReason && typeof cancellationReason === 'string') {
        order.cancellationReason = cancellationReason.trim();
      }
    }
  }

  if (typeof deliveryAddress !== 'undefined') {
    order.deliveryAddress = deliveryAddress.trim();
  }
  if (typeof deliveryCity !== 'undefined') {
    order.deliveryCity = deliveryCity;
  }
  if (typeof trackingNote !== 'undefined') {
    order.trackingNote = trackingNote.toString();
  }

  if (typeof deliveryGuyId !== 'undefined') {
    if (!deliveryGuyId) {
      order.deliveryGuy = undefined;
    } else if (!ensureObjectId(deliveryGuyId)) {
      return res.status(400).json({ message: 'Livreur invalide.' });
    } else {
      const deliveryGuy = await DeliveryGuy.findById(deliveryGuyId).select('_id');
      if (!deliveryGuy) {
        return res.status(404).json({ message: 'Livreur introuvable.' });
      }
      order.deliveryGuy = deliveryGuy._id;
    }
  }

  await order.save();
  const baseMetadata = {
    orderId: order._id,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity
  };

  if (notifyPending && previousStatus !== 'pending') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_created',
      metadata: {
        ...baseMetadata,
        status: 'pending'
      },
      allowSelf: true
    });
  }
  if (notifyConfirmed && previousStatus !== 'confirmed') {
    // Update product salesCount when order is confirmed
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }

    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_created',
      metadata: {
        ...baseMetadata,
        status: 'confirmed'
      },
      allowSelf: true
    });
  }
  if (notifyDelivering && previousStatus !== 'delivering') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_delivering',
      metadata: {
        ...baseMetadata,
        status: 'delivering'
      },
      allowSelf: true
    });
  }
  if (notifyDelivered && (previousStatus !== 'delivered' || deliveredTimestampAdded)) {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_delivered',
      metadata: {
        ...baseMetadata,
        status: 'delivered',
        deliveredAt: order.deliveredAt
      },
      allowSelf: true
    });
  }

  if (notifyDelivering && isTwilioMessagingConfigured()) {
    const customer = await User.findById(order.customer).select('phone');
    await sendOrderSms({
      phone: customer?.phone,
      message: buildOrderDeliveringMessage(order),
      context: `order_delivering:${order._id}`
    });
  }

  if (notifyCancelled && previousStatus !== 'cancelled') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_cancelled',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'cancelled',
        cancelledBy: 'admin',
        reason: order.cancellationReason
      },
      allowSelf: true
    });

    // Update product salesCount when order is cancelled (decrease count)
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }

    // Send SMS if configured
    if (isTwilioMessagingConfigured()) {
      const customer = await User.findById(order.customer).select('phone');
      if (customer?.phone) {
        const itemsSummary = buildSmsItemsSummary(order.items);
        const total = formatSmsAmount(order.totalAmount);
        const reasonText = order.cancellationReason ? ` Raison: ${order.cancellationReason}` : '';
        const orderId = order._id ? String(order._id).slice(-6) : '';
      const message = `HDMarket : Votre commande ${orderId} a été annulée.${reasonText} ${itemsSummary ? `| ${itemsSummary}` : ''} | Total: ${total} FCFA`;
        await sendOrderSms({
          phone: customer.phone,
          message,
          context: `order_cancelled:${order._id}`
        });
      }
    }
  }

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.json(buildOrderResponse(populated));
});

export const adminSendOrderReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id).lean();
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (order.status === 'delivered') {
    return res.status(400).json({ message: 'Commande déjà livrée.' });
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const sellerIds = new Set();
  items.forEach((item) => {
    const shopId = item?.snapshot?.shopId;
    if (shopId) sellerIds.add(String(shopId));
  });

  if (!sellerIds.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à cette commande.' });
  }

  await Promise.all(
    Array.from(sellerIds).map((sellerId) =>
      createNotification({
        userId: sellerId,
        actorId: req.user.id,
        type: 'order_reminder',
        metadata: {
          orderId: order._id,
          status: order.status,
          deliveryCity: order.deliveryCity,
          deliveryAddress: order.deliveryAddress
        }
      })
    )
  );

  res.json({ message: 'Rappel envoyé aux vendeurs.' });
});

export const adminOrderStats = asyncHandler(async (req, res) => {
  const [statusAgg, recentAgg] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } },
      { $limit: 12 }
    ])
  ]);

  const statusCounts = ORDER_STATUS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: statusAgg.find((item) => item._id === key)?.count || 0
    }),
    {}
  );

  const timeline = recentAgg.map((item) => {
    const [year, month] = item._id.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      label: date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      count: item.count
    };
  });

  res.json({
    statusCounts,
    total: statusAgg.reduce((sum, item) => sum + item.count, 0),
    timeline
  });
});

export const adminSearchCustomers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const query = {};
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .select('name email phone address city accountType');
  res.json(users);
});

export const adminSearchProducts = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const filter = { status: 'approved' };
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }
  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .select('title price images user status slug')
    .populate('user', 'shopName name slug');
  res.json(products);
});

export const userListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { status, search = '', page = 1, limit = 6 } = req.query || {};

  const filter = userId ? { customer: userId, isDraft: false } : { customer: null, isDraft: false };
  if (status && ORDER_STATUS.includes(status)) {
    filter.status = status;
  }

  // Add search functionality for product names
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { 'items.snapshot.title': regex }, // Recherche par nom de produit
      { 'items.snapshot.shopName': regex }, // Recherche par nom de boutique
      { deliveryAddress: regex }, // Recherche par adresse
      { deliveryCode: regex } // Recherche par code de livraison
    ];
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 6, 24));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    items: orders.map(buildOrderResponse),
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

// Save draft order
export const saveDraftOrder = asyncHandler(async (req, res) => {
  const { payments } = req.body;
  const userId = req.user?.id || req.user?._id;

  const customer = await User.findById(userId).select('name email phone address city');
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }

  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(400).json({ message: 'Votre panier est vide.' });
  }

  const normalizedItems = cart.items.map((item) => ({
    productId: item.product,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1
  }));
  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const productDocs = await Product.find({ _id: { $in: productIds } }).populate(
    'user',
    'shopName name slug'
  );
  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));

  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!product || product.status !== 'approved') {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      return {
        product: product._id,
        quantity: item.quantity,
        snapshot: {
          title: product.title,
          price: product.price,
          image: Array.isArray(product.images) ? product.images[0] : null,
          shopName: product.user?.shopName || product.user?.name || '',
          shopId: product.user?._id || null,
          confirmationNumber: product.confirmationNumber || '',
          slug: product.slug || null
        }
      };
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const itemsBySeller = new Map();
  orderItems.forEach((item) => {
    const shopId = resolveItemShopId(item);
    if (!shopId) return;
    const shopKey = String(shopId);
    if (!itemsBySeller.has(shopKey)) {
      itemsBySeller.set(shopKey, []);
    }
    itemsBySeller.get(shopKey).push(item);
  });

  if (!itemsBySeller.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à la commande.' });
  }

  // Prepare draft payments
  const normalizedPayments = Array.isArray(payments) ? payments : [];
  const draftPayments = normalizedPayments.map((payment) => ({
    sellerId: payment?.sellerId || null,
    payerName: payment?.payerName?.trim() || '',
    transactionCode: payment?.transactionCode?.trim() || ''
  }));

  // Delete existing draft orders for this user
  await Order.deleteMany({ customer: userId, isDraft: true });

  // Create draft orders (one per seller)
  const draftOrderPayloads = Array.from(itemsBySeller.entries()).map(([sellerId, sellerItems]) => {
    const totalAmount = sellerItems.reduce(
      (sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
      0
    );
    const paidAmount = Math.round(totalAmount * 0.25);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    return {
      items: sellerItems,
      customer: customer._id,
      createdBy: userId,
      deliveryAddress: customer.address || '',
      deliveryCity: customer.city || 'Brazzaville',
      trackingNote: '',
      totalAmount,
      paidAmount,
      remainingAmount,
      status: 'pending',
      isDraft: true,
      draftPayments: draftPayments.filter((p) => String(p.sellerId) === sellerId)
    };
  });

  const createdDrafts = await Order.insertMany(draftOrderPayloads);
  const populated = await baseOrderQuery().find({
    _id: { $in: createdDrafts.map((order) => order._id) }
  });
  await ensureOrderProductSlugs(populated);

  res.status(201).json({
    items: populated.map(buildOrderResponse),
    message: 'Commande enregistrée comme brouillon.'
  });
});

// Get draft orders
export const getDraftOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  const orders = await baseOrderQuery()
    .find({ customer: userId, isDraft: true })
    .sort({ createdAt: -1 });

  await ensureOrderProductSlugs(orders);

  res.json({
    items: orders.map(buildOrderResponse),
    total: orders.length
  });
});

// Delete draft order
export const deleteDraftOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, customer: userId, isDraft: true });
  if (!order) {
    return res.status(404).json({ message: 'Brouillon introuvable.' });
  }

  await Order.deleteOne({ _id: id });
  res.json({ message: 'Brouillon supprimé avec succès.' });
});

/**
 * Create an inquiry order (Alibaba-style: start a conversation about a product)
 * Creates a draft order with one item so buyer can message the seller with product context.
 */
export const createInquiryOrder = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const product = await Product.findById(productId).populate('user', 'shopName name slug _id');
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non disponible.' });
  }

  const sellerId = product.user?._id || product.user?.id;
  if (!sellerId) {
    return res.status(400).json({ message: 'Vendeur introuvable pour ce produit.' });
  }

  if (String(sellerId) === String(userId)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas ouvrir une conversation avec vous-même.' });
  }

  const customer = await User.findById(userId).select('name email phone address city');
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }

  const snapshot = {
    title: product.title,
    price: product.price,
    image: Array.isArray(product.images) ? product.images[0] : null,
    shopName: product.user?.shopName || product.user?.name || '',
    shopId: sellerId,
    confirmationNumber: product.confirmationNumber || '',
    slug: product.slug || null
  };

  const existingInquiry = await Order.findOne({
    customer: userId,
    isDraft: true,
    isInquiry: true,
    'items.snapshot.shopId': sellerId,
    'items.product': productId
  }).lean();

  if (existingInquiry) {
    const populated = await baseOrderQuery().findById(existingInquiry._id);
    await ensureOrderProductSlugs([populated]);
    return res.status(200).json(buildOrderResponse(populated));
  }

  const orderItem = {
    product: product._id,
    quantity: 1,
    snapshot
  };

  const order = await Order.create({
    items: [orderItem],
    customer: userId,
    createdBy: userId,
    deliveryAddress: customer.address?.trim() || 'À préciser',
    deliveryCity: customer.city || 'Brazzaville',
    status: 'pending',
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    isDraft: true,
    isInquiry: true
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.status(201).json(buildOrderResponse(populated));
});

export const userUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, customer: userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const { status } = req.body;
  if (!ORDER_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }

  // Prevent cancelling already delivered orders
  if (status === 'cancelled' && order.status === 'delivered') {
    return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
  }

  // Only allow cancellation within 30 minutes of order creation
  if (status === 'cancelled') {
    if (!isWithinCancellationWindow(order)) {
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      const diffMs = now - createdAt;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return res.status(403).json({ 
        message: `Le délai d'annulation de 30 minutes est expiré. Votre commande a été créée il y a ${diffMinutes} minute(s).`,
        code: 'CANCELLATION_WINDOW_EXPIRED',
        createdAt: order.createdAt
      });
    }
  }

  if (order.status !== status) {
    order.status = status;
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
    }
  }

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  // Send cancellation notification
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_cancelled',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'cancelled',
        cancelledBy: 'user'
      },
      allowSelf: true
    });
  }

  res.json(buildOrderResponse(populated));
});

/**
 * Update delivery address for an order (buyer only, before shipping)
 */
export const userUpdateOrderAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Verify the order belongs to the user
  if (String(order.customer) !== String(userId)) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette commande.' });
  }

  // Only allow address modification before shipping
  if (order.status === 'delivering' || order.status === 'delivered') {
    return res.status(400).json({ 
      message: 'Impossible de modifier l\'adresse de livraison. La commande est déjà en cours de livraison ou livrée.',
      code: 'ORDER_ALREADY_SHIPPED'
    });
  }

  if (order.status === 'cancelled') {
    return res.status(400).json({ 
      message: 'Impossible de modifier l\'adresse d\'une commande annulée.',
      code: 'ORDER_CANCELLED'
    });
  }

  const { deliveryAddress, deliveryCity } = req.body;
  const oldAddress = order.deliveryAddress;
  const oldCity = order.deliveryCity;

  // Update address
  order.deliveryAddress = deliveryAddress.trim();
  order.deliveryCity = deliveryCity;

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  // Send notification to sellers about address change
  if (Array.isArray(order.items) && order.items.length > 0) {
    const sellerIds = new Set();
    order.items.forEach((item) => {
      const shopId = item?.snapshot?.shopId;
      if (shopId) sellerIds.add(String(shopId));
    });

    await Promise.all(
      Array.from(sellerIds).map((sellerId) =>
        createNotification({
          userId: sellerId,
          actorId: userId,
          type: 'order_address_updated',
          metadata: {
            orderId: order._id,
            oldAddress: oldAddress,
            newAddress: deliveryAddress.trim(),
            oldCity: oldCity,
            newCity: deliveryCity,
            status: order.status
          },
          allowSelf: true
        })
      )
    );
  }

  res.json(buildOrderResponse(populated));
});

export const sellerListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { status, page = 1, limit = 6 } = req.query || {};

  const filter = { 'items.snapshot.shopId': userId };
  if (status && ORDER_STATUS.includes(status)) {
    filter.status = status;
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 6, 24));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = orders
    .map((order) => {
      const filteredItems = filterOrderItemsForSeller(order, userId);
      if (!filteredItems.length) return null;
      const response = buildOrderResponse(order);
      response.items = filteredItems.map((item) => {
        const normalized = item.toObject ? item.toObject() : item;
        return {
          ...normalized,
          snapshot: normalized.snapshot || {}
        };
      });
      return response;
    })
    .filter(Boolean);

  res.json({
    items,
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const sellerUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Prevent seller from changing order status within 30 minutes of creation
  if (isWithinCancellationWindow(order)) {
    const remainingMs = getCancellationWindowRemaining(order);
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    return res.status(403).json({ 
      message: `Vous ne pouvez pas modifier le statut de cette commande pendant les 30 premières minutes. Temps restant: ${remainingMinutes} minute(s).`,
      code: 'CANCELLATION_WINDOW_ACTIVE',
      remainingMs,
      remainingMinutes
    });
  }

  const { status } = req.body;
  const previousStatus = order.status;
  let notifyPending = false;
  let notifyConfirmed = false;
  let notifyDelivering = false;
  if (!ORDER_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }

  // Prevent cancelling already delivered orders
  if (status === 'cancelled' && order.status === 'delivered') {
    return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
  }

  if (order.status !== status) {
    order.status = status;
    notifyPending = status === 'pending';
    notifyConfirmed = status === 'confirmed';
    notifyDelivering = status === 'delivering';
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
    }
  }

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  if (notifyPending && previousStatus !== 'pending') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_created',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'pending'
      },
      allowSelf: true
    });
  }
  if (notifyConfirmed && previousStatus !== 'confirmed') {
    // Update product salesCount when order is confirmed
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }

    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_created',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'confirmed'
      },
      allowSelf: true
    });
  }
  if (status === 'delivered') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_delivered',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'delivered',
        deliveredAt: order.deliveredAt
      },
      allowSelf: true
    });
  }

  if (notifyDelivering && previousStatus !== 'delivering' && isTwilioMessagingConfigured()) {
    const customer = await User.findById(order.customer).select('phone');
    await sendOrderSms({
      phone: customer?.phone,
      message: buildOrderDeliveringMessage(order),
      context: `order_delivering:${order._id}`
    });
  }

  if (notifyDelivering && previousStatus !== 'delivering') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_delivering',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'delivering'
      },
      allowSelf: true
    });
  }

  // Send cancellation notification
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_cancelled',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'cancelled',
        cancelledBy: 'seller'
      },
      allowSelf: true
    });

    // Update product salesCount when order is cancelled (decrease count)
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }
  }

  res.json(buildOrderResponse(populated));
});

export const sellerCancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  const { reason } = req.body;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Prevent cancelling already delivered or cancelled orders
  if (order.status === 'delivered') {
    return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ message: 'Cette commande est déjà annulée.' });
  }

  // Reason is required (validated by middleware, but double-check)
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ message: 'La raison de l\'annulation est requise (minimum 5 caractères).' });
  }

  const previousStatus = order.status;
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelledBy = userId;
  order.cancellationReason = reason.trim();

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  // Update product salesCount when order is cancelled (decrease count)
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      if (item.product) {
        const salesCount = await calculateProductSalesCount(item.product);
        await Product.updateOne(
          { _id: item.product },
          { $set: { salesCount } }
        );
      }
    }
  }

  // Send notification to customer
  await createNotification({
    userId: order.customer,
    actorId: userId,
    type: 'order_cancelled',
    metadata: {
      orderId: order._id,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      status: 'cancelled',
      cancelledBy: 'seller',
      reason: order.cancellationReason
    },
    allowSelf: true
  });

  // Send SMS if configured
  if (isTwilioMessagingConfigured()) {
    const customer = await User.findById(order.customer).select('phone');
    if (customer?.phone) {
      const itemsSummary = buildSmsItemsSummary(order.items);
      const total = formatSmsAmount(order.totalAmount);
      const reasonText = order.cancellationReason ? ` Raison: ${order.cancellationReason}` : '';
      const orderId = order._id ? String(order._id).slice(-6) : '';
      const message = `HDMarket : Votre commande ${orderId} a été annulée par le vendeur.${reasonText} ${itemsSummary ? `| ${itemsSummary}` : ''} | Total: ${total} FCFA`;
      await sendOrderSms({
        phone: customer.phone,
        message,
        context: `order_cancelled:${order._id}`
      });
    }
  }

  res.json(buildOrderResponse(populated));
});
