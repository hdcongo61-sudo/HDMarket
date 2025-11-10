import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const ORDER_STATUS = ['confirmed', 'delivering', 'delivered'];

const baseOrderQuery = () =>
  Order.find()
    .populate('customer', 'name email phone address city')
    .populate('items.product', 'title price images status user')
    .populate('createdBy', 'name email');

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
    Product.find({ _id: { $in: productIds } }).populate('user', 'shopName name')
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
          shopId: product.user?._id || null
        }
      };
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const order = await Order.create({
    items: orderItems,
    customer: customer._id,
    createdBy: req.user.id,
    deliveryAddress: deliveryAddress.trim(),
    deliveryCity,
    trackingNote: trackingNote?.trim() || ''
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
      status: 'confirmed'
    },
    allowSelf: true
  });

  res.status(201).json(buildOrderResponse(populated));
});

export const adminListOrders = asyncHandler(async (req, res) => {
  const { status, search = '' } = req.query;
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

  const orders = await baseOrderQuery()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(orders.map(buildOrderResponse));
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

  const { status, deliveryAddress, deliveryCity, trackingNote } = req.body;
  const previousStatus = order.status;
  let notifyConfirmed = false;
  let notifyDelivered = false;
  let deliveredTimestampAdded = false;

  if (status) {
    if (!ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    if (order.status !== status) {
      order.status = status;
      notifyConfirmed = status === 'confirmed';
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

  await order.save();
  const baseMetadata = {
    orderId: order._id,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity
  };

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

  const populated = await baseOrderQuery().findById(order._id);
  res.json(buildOrderResponse(populated));
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
    .populate('user', 'shopName name');
  res.json(products);
});

export const userListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const filter = userId ? { customer: userId } : { customer: null };

  const orders = await baseOrderQuery()
    .find(filter)
    .sort({ createdAt: -1 });
  res.json(orders.map(buildOrderResponse));
});
