import asyncHandler from 'express-async-handler';
import ListingFeePayment from '../models/listingFeePaymentModel.js';
import Product from '../models/productModel.js';
import {
  isTransactionCodeAlreadyUsed,
  normalizeTransactionCode,
  TRANSACTION_CODE_REUSED_MESSAGE
} from '../utils/transactionCodeService.js';
import { roundMoney } from '../utils/listingFeeUtils.js';

const ensurePendingPayment = async (product) => {
  let payment = await ListingFeePayment.findOne({
    productId: product._id,
    status: 'PENDING'
  }).sort({ createdAt: -1 });

  if (payment) return payment;

  payment = await ListingFeePayment.create({
    productId: product._id,
    sellerId: product.user,
    oldPrice: Number(product.approvedPrice ?? product.price ?? 0),
    newPrice: Number(product.pendingPrice ?? product.price ?? 0),
    oldFee: Number(product.listingFeePaid || 0),
    requiredFee: Number(product.listingFeeRequired || 0),
    remainingFee: Number(product.listingFeeRemaining || 0)
  });
  return payment;
};

export const getProductListingFeePayment = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId).select('user');
  if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
  const canModerate = ['admin', 'founder', 'manager'].includes(String(req.user.role || ''));
  if (String(product.user) !== String(req.user.id) && !canModerate) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const payment = await ListingFeePayment.findOne({ productId: product._id })
    .sort({ createdAt: -1 })
    .populate('validatedBy', 'name email');
  return res.json(payment || null);
});

export const submitListingFeePayment = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId).select(
    '+pendingPrice +listingFeePaid +listingFeeRequired +listingFeeRemaining'
  );
  if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
  if (String(product.user) !== String(req.user.id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (!product.requiresAdditionalPayment || product.listingFeeStatus !== 'PAYMENT_REQUIRED') {
    return res.status(409).json({ message: 'Aucun complément de frais n’est requis pour ce produit.' });
  }

  const payerName = String(req.body?.payerName || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || '').trim();
  const transactionReference = normalizeTransactionCode(req.body?.transactionReference);
  const amountPaid = roundMoney(req.body?.amountPaid);
  const remainingFee = roundMoney(product.listingFeeRemaining);

  if (payerName.length < 2 || !paymentMethod) {
    return res.status(400).json({ message: 'Le nom du payeur et le moyen de paiement sont requis.' });
  }
  if (!/^\d{10}$/.test(transactionReference)) {
    return res.status(400).json({ message: 'Le numéro de transaction doit contenir exactement 10 chiffres.' });
  }
  if (Math.abs(amountPaid - remainingFee) > 0.02) {
    return res.status(400).json({
      message: `Le montant payé doit correspondre au complément requis (${remainingFee}).`
    });
  }
  let payment = await ensurePendingPayment(product);
  if (payment.submittedAt) {
    if (payment.transactionReference !== transactionReference) {
      return res.status(409).json({ message: 'Ce complément de frais attend déjà une validation.' });
    }
    if (product.listingFeeStatus !== 'UNDER_REVIEW') {
      product.listingFeeStatus = 'UNDER_REVIEW';
      await product.save();
    }
    return res.status(200).json({
      ...payment.toObject(),
      alreadySubmitted: true,
      message: 'Ce complément de frais attend déjà une validation.'
    });
  }
  if (await isTransactionCodeAlreadyUsed(transactionReference)) {
    return res.status(409).json({ message: TRANSACTION_CODE_REUSED_MESSAGE });
  }

  payment.payerName = payerName;
  payment.paymentMethod = paymentMethod;
  payment.transactionReference = transactionReference;
  payment.amountPaid = amountPaid;
  payment.submittedAt = new Date();

  try {
    await payment.save();
  } catch (error) {
    if (Number(error?.code) === 11000) {
      return res.status(409).json({ message: TRANSACTION_CODE_REUSED_MESSAGE });
    }
    throw error;
  }

  await Product.updateOne(
    { _id: product._id, listingFeeStatus: 'PAYMENT_REQUIRED' },
    { $set: { listingFeeStatus: 'UNDER_REVIEW' } }
  );

  return res.status(201).json(payment);
});
