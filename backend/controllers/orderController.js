import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import Cart from '../models/cartModel.js';
import { createNotification } from '../utils/notificationService.js';
import { isTwilioMessagingConfigured, sendSms } from '../utils/twilioMessaging.js';

const ORDER_STATUS = ['pending', 'confirmed', 'delivering', 'delivered'];

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

const buildOrderPendingMessage = (order) =>
  `HDMarket : Votre commande ${order._id} est en attente. ${buildOrderSmsDetails(order)}`;

const buildOrderDeliveringMessage = (order) =>
  `HDMarket : Votre commande ${order._id} est en cours de livraison. ${buildOrderSmsDetails(
    order
  )}`;

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
      select: 'title price images status user',
      populate: { path: 'user', select: 'name shopName phone' }
    })
    .populate('deliveryGuy', 'name phone active')
    .populate('createdBy', 'name email');

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
      : null
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
          confirmationNumber: product.confirmationNumber || ''
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

  const order = await Order.create({
    items: orderItems,
    customer: customer._id,
    createdBy: req.user.id,
    deliveryAddress: deliveryAddress.trim(),
    deliveryCity,
    trackingNote: trackingNote?.trim() || '',
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount
  });

  const populated = await baseOrderQuery().findById(order._id);

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
          confirmationNumber: product.confirmationNumber || ''
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

  const orderPayloads = Array.from(itemsBySeller.entries()).map(([sellerId, sellerItems]) => {
    const totalAmount = sellerItems.reduce(
      (sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
      0
    );
    const paidAmount = Math.round(totalAmount * 0.25);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const paymentInfo = usePaymentList
      ? paymentsBySeller.get(sellerId)
      : { payerName: fallbackPayer, transactionCode: fallbackTransaction };

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
      paymentTransactionCode: paymentInfo.transactionCode
    };
  });

  const createdOrders = await Order.create(
    orderPayloads.map(({ sellerId, ...payload }) => payload)
  );

  await Cart.updateOne({ user: userId }, { $set: { items: [] } });

  const populated = await baseOrderQuery().find({
    _id: { $in: createdOrders.map((order) => order._id) }
  });

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
      { 'items.snapshot.title': regex },
      { trackingNote: regex },
      { deliveryAddress: regex }
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

  const { status, deliveryAddress, deliveryCity, trackingNote, deliveryGuyId } = req.body;
  const previousStatus = order.status;
  let notifyPending = false;
  let notifyConfirmed = false;
  let notifyDelivering = false;
  let notifyDelivered = false;
  let deliveredTimestampAdded = false;

  if (status) {
    if (!ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    if (order.status !== status) {
      order.status = status;
      notifyPending = status === 'pending';
      notifyConfirmed = status === 'confirmed';
      notifyDelivering = status === 'delivering';
      notifyDelivered = status === 'delivered';
    }
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
      notifyDelivered = true;
      deliveredTimestampAdded = true;
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

  const populated = await baseOrderQuery().findById(order._id);
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
    .select('title price images user status')
    .populate('user', 'shopName name slug');
  res.json(products);
});

export const userListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { status, page = 1, limit = 6 } = req.query || {};

  const filter = userId ? { customer: userId } : { customer: null };
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    items: orders.map(buildOrderResponse),
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
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

  if (order.status !== status) {
    order.status = status;
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
  }

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
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

  const { status } = req.body;
  const previousStatus = order.status;
  let notifyPending = false;
  let notifyDelivering = false;
  if (!['pending', 'confirmed', 'delivering', 'delivered'].includes(status)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }

  if (order.status !== status) {
    order.status = status;
    notifyPending = status === 'pending';
    notifyDelivering = status === 'delivering';
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
  }

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);

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
  if (status === 'delivered') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      type: 'order_delivered',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
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

  res.json(buildOrderResponse(populated));
});
