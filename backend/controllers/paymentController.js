import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateProductCache } from '../utils/cache.js';
import { calculateCommissionBreakdown, normalizePromoCode } from '../utils/promoCodeUtils.js';
import { consumePromoCodeForSeller, previewPromoForSeller } from '../utils/promoCodeService.js';

const isCloseTo = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

export const createPayment = asyncHandler(async (req, res) => {
  const { productId, payerName, transactionNumber, amount, operator, promoCode } = req.body;
  if (!productId) return res.status(400).json({ message: 'Missing productId' });

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  const existingPayment = await Payment.findOne({
    product: product._id,
    status: { $in: ['waiting', 'verified'] }
  })
    .select('_id status')
    .lean();
  if (existingPayment) {
    return res
      .status(409)
      .json({ message: 'Un paiement existe déjà pour ce produit et attend une validation.' });
  }

  const sellerId = req.user.id;
  const normalizedPromo = normalizePromoCode(promoCode);

  let promoPreview = null;
  if (normalizedPromo) {
    promoPreview = await previewPromoForSeller({
      code: normalizedPromo,
      sellerId,
      productPrice: product.price
    });
    if (!promoPreview.valid) {
      return res.status(400).json({
        message: promoPreview.message,
        reason: promoPreview.reason
      });
    }
  }

  let commission = promoPreview?.commission || calculateCommissionBreakdown({ productPrice: product.price });
  let received = +(+(amount || 0)).toFixed(2);

  const normalizedTransaction = String(transactionNumber || '').replace(/\D/g, '');
  const hasCommissionDue = Number(commission.dueAmount || 0) > 0;

  if (hasCommissionDue) {
    if (!payerName || !operator || normalizedTransaction.length !== 10) {
      return res.status(400).json({
        message:
          'Les informations de paiement sont requises (nom, opérateur, numéro de transaction 10 chiffres).'
      });
    }

    if (!(isCloseTo(received, commission.dueAmount, 0.02) || received >= commission.dueAmount)) {
      return res.status(400).json({
        message: `Amount must be ~commission due (${commission.dueAmount}).`
      });
    }
  } else {
    received = 0;
  }

  const paymentPayload = {
    user: req.user.id,
    product: product._id,
    payerName: hasCommissionDue ? payerName : 'PROMO_WAIVER',
    transactionNumber: hasCommissionDue ? normalizedTransaction : '0000000000',
    amount: received,
    commissionBaseAmount: Number(commission.baseAmount || 0),
    commissionDiscountAmount: Number(commission.discountAmount || 0),
    commissionDueAmount: Number(commission.dueAmount || 0),
    waivedByPromo: Boolean(commission.isWaived && normalizedPromo),
    promoCodeValue: normalizedPromo || '',
    promoDiscountType: promoPreview?.promo?.discountType || null,
    promoDiscountValue: Number(promoPreview?.promo?.discountValue || 0),
    operator: hasCommissionDue ? operator : 'Other',
    status: 'waiting'
  };

  let payment = await Payment.create(paymentPayload);

  if (normalizedPromo) {
    try {
      const consumed = await consumePromoCodeForSeller({
        code: normalizedPromo,
        sellerId,
        product,
        paymentId: payment._id,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null
      });

      if (consumed?.promo) {
        commission = consumed.commission;
        payment.promoCode = consumed.promo._id;
        payment.promoCodeValue = consumed.promo.code;
        payment.promoDiscountType = consumed.promo.discountType;
        payment.promoDiscountValue = Number(consumed.promo.discountValue || 0);
        payment.waivedByPromo = Boolean(consumed.commission?.isWaived);
        payment.commissionBaseAmount = Number(consumed.commission?.baseAmount || 0);
        payment.commissionDiscountAmount = Number(consumed.commission?.discountAmount || 0);
        payment.commissionDueAmount = Number(consumed.commission?.dueAmount || 0);
        await payment.save();
      }
    } catch (error) {
      await Payment.deleteOne({ _id: payment._id });
      return res.status(error.status || 400).json({
        message: error.message || 'Code promo invalide ou expiré.',
        reason: error.code || 'promo_invalid'
      });
    }
  }

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
        commissionBaseAmount: Number(commission.baseAmount || 0),
        commissionDiscountAmount: Number(commission.discountAmount || 0),
        commissionDueAmount: Number(commission.dueAmount || 0),
        promoCode: payment.promoCodeValue || '',
        operator: payment.operator,
        payerName: payment.payerName,
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
  const payments = await Payment.find({ user: req.user.id })
    .populate('product', 'title price status images slug')
    .populate('promoCode', 'code discountType discountValue');
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
    .populate('promoCode', 'code discountType discountValue usageLimit usedCount')
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

  // Invalidate product cache so the approved product appears on home page immediately
  await invalidateProductCache();

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

  // Invalidate product cache so the rejected product is removed from home page immediately
  await invalidateProductCache();

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
