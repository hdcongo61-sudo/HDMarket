import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const isCloseTo = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

export const createPayment = asyncHandler(async (req, res) => {
  const { productId, payerName, transactionNumber, amount, operator } = req.body;
  if (!productId || !payerName || !transactionNumber || !amount || !operator)
    return res.status(400).json({ message: 'Missing fields' });

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  // Vérifier 3%
  const expected = +(product.price * 0.03).toFixed(2);
  const received = +(+amount).toFixed(2);
  if (!(isCloseTo(received, expected, 0.02) || received >= expected)) {
    return res.status(400).json({ message: `Amount must be ~3% of price (${expected}).` });
  }

  const payment = await Payment.create({
    user: req.user.id,
    product: product._id,
    payerName,
    transactionNumber,
    amount: received,
    operator,
    status: 'waiting'
  });

  product.payment = payment._id;
  product.status = 'pending';
  await product.save();

  try {
    const [moderators, waitingCount] = await Promise.all([
      User.find({ role: { $in: ['admin', 'manager'] } })
        .select('_id')
        .lean(),
      Payment.countDocuments({ status: 'waiting' })
    ]);

    if (moderators.length) {
      const metadata = {
        paymentId: payment._id,
        productId: product._id,
        productTitle: product.title || '',
        amount: received,
        operator,
        payerName,
        waitingCount
      };

      const notifications = moderators
        .filter((moderator) => String(moderator._id) !== String(req.user.id))
        .map((moderator) =>
          createNotification({
            userId: moderator._id,
            actorId: req.user.id,
            productId: product._id,
            type: 'payment_pending',
            metadata
          })
        );

      if (notifications.length) {
        await Promise.all(notifications);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to notify moderators about pending payment', err);
  }

  res.status(201).json(payment);
});

export const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user.id }).populate(
    'product',
    'title price status images slug'
  );
  res.json(payments);
});

export const listPaymentsAdmin = asyncHandler(async (req, res) => {
  const { status, search, startDate, endDate } = req.query; // waiting/verified/rejected, product search, date filters
  const query = status ? { status } : {};

  if (search && search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const products = await Product.find({ title: regex }).select('_id');
    if (!products.length) {
      return res.json([]);
    }
    query.product = { $in: products.map((product) => product._id) };
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        query.createdAt.$gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        query.createdAt.$lte = end;
      }
    }
    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
  }

  const payments = await Payment.find(query)
    .populate('user', 'name email')
    .populate('product', 'title price status images slug')
    .populate('validatedBy', 'name email');
  res.json(payments);
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('product');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  payment.status = 'verified';
  payment.validatedBy = req.user.id;
  payment.validatedAt = new Date();
  await payment.save();

  const product = await Product.findById(payment.product._id);
  product.status = 'approved';
  product.payment = payment._id;
  await product.save();

  await createNotification({
    userId: product.user,
    actorId: req.user.id,
    productId: product._id,
    type: 'product_approval',
    metadata: {
      paymentId: payment._id
    }
  });

  res.json({ message: 'Payment verified, product approved' });
});

export const rejectPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('product');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  payment.status = 'rejected';
  payment.validatedBy = req.user.id;
  payment.validatedAt = new Date();
  await payment.save();

  const product = await Product.findById(payment.product._id);
  product.status = 'rejected';
  await product.save();

  await createNotification({
    userId: product.user,
    actorId: req.user.id,
    productId: product._id,
    type: 'product_rejection',
    metadata: {
      paymentId: payment._id
    }
  });

  res.json({ message: 'Payment rejected, product rejected' });
});
