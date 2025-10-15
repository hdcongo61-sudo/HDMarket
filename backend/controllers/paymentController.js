import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';

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

  res.status(201).json(payment);
});

export const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user.id }).populate('product', 'title price status images');
  res.json(payments);
});

export const listPaymentsAdmin = asyncHandler(async (req, res) => {
  const { status } = req.query; // waiting/verified/rejected
  const query = status ? { status } : {};
  const payments = await Payment.find(query)
    .populate('user', 'name email')
    .populate('product', 'title price status images');
  res.json(payments);
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('product');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  payment.status = 'verified';
  await payment.save();

  const product = await Product.findById(payment.product._id);
  product.status = 'approved';
  product.payment = payment._id;
  await product.save();

  res.json({ message: 'Payment verified, product approved' });
});

export const rejectPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('product');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  payment.status = 'rejected';
  await payment.save();

  const product = await Product.findById(payment.product._id);
  product.status = 'rejected';
  await product.save();

  res.json({ message: 'Payment rejected, product rejected' });
});
