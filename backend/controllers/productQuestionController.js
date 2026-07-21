import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import ProductQuestion from '../models/productQuestionModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import { createNotification } from '../utils/notificationService.js';
import { awardPoints } from '../services/rewardPointsService.js';
import { getRuntimeConfig } from '../services/configService.js';

const VERIFIED_BUYER_STATUSES = [
  'delivery_proof_submitted',
  'delivered',
  'picked_up_confirmed',
  'confirmed_by_client',
  'completed'
];

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const resolveIsVerifiedBuyer = async (userId, productId) => {
  const order = await Order.findOne({
    customer: userId,
    'items.product': productId,
    status: { $in: VERIFIED_BUYER_STATUSES }
  })
    .select('_id')
    .lean();
  return Boolean(order);
};

export const listQuestionsForProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 20)));

  const [items, total] = await Promise.all([
    ProductQuestion.find({ productId, status: 'visible' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('askedBy', 'name')
      .populate('answers.userId', 'name shopName')
      .lean(),
    ProductQuestion.countDocuments({ productId, status: 'visible' })
  ]);

  return res.json({
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
});

export const askQuestion = asyncHandler(async (req, res) => {
  const enabled = await getRuntimeConfig('enable_product_qa', { fallback: true });
  if (!enabled) {
    return res.status(403).json({ message: 'Les questions produit sont désactivées.' });
  }
  const { productId, question } = req.body;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }
  const text = String(question || '').trim();
  if (text.length < 3) {
    return res.status(400).json({ message: 'La question doit contenir au moins 3 caractères.' });
  }

  const product = await Product.findById(productId).select('_id title user').lean();
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable.' });
  }

  const sellerId = product.user;
  const userId = req.user.id || req.user._id;

  const created = await ProductQuestion.create({
    productId,
    sellerId,
    askedBy: userId,
    question: text
  });

  if (String(sellerId) !== String(userId)) {
    createNotification({
      userId: sellerId,
      actorId: userId,
      type: 'product_question_asked',
      productId,
      priority: 'MEDIUM',
      pushEnabled: true,
      metadata: {
        title: 'Nouvelle question sur un produit',
        message: `Un acheteur a posé une question sur « ${product.title} ».`,
        productTitle: product.title,
        question: text
      },
      entityType: 'product',
      entityId: String(productId),
      deepLink: `/product/${productId}`,
      actionLink: `/product/${productId}`
    }).catch(() => {});
  }

  const populated = await ProductQuestion.findById(created._id)
    .populate('askedBy', 'name')
    .lean();

  return res.status(201).json(populated);
});

export const answerQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Question invalide.' });
  }
  const answerText = String(text || '').trim();
  if (answerText.length < 1) {
    return res.status(400).json({ message: 'La réponse ne peut pas être vide.' });
  }

  const qa = await ProductQuestion.findById(id);
  if (!qa || qa.status !== 'visible') {
    return res.status(404).json({ message: 'Question introuvable.' });
  }

  const userId = req.user.id || req.user._id;
  const isSeller = String(qa.sellerId) === String(userId);
  const isVerifiedBuyer = isSeller ? false : await resolveIsVerifiedBuyer(userId, qa.productId);

  qa.answers.push({
    userId,
    isSeller,
    isVerifiedBuyer,
    text: answerText
  });
  await qa.save();

  if (String(qa.askedBy) !== String(userId)) {
    createNotification({
      userId: qa.askedBy,
      actorId: userId,
      type: 'product_question_answered',
      productId: qa.productId,
      priority: 'MEDIUM',
      pushEnabled: true,
      metadata: {
        title: 'Votre question a une réponse',
        message: isSeller
          ? 'Le vendeur a répondu à votre question.'
          : 'Quelqu’un a répondu à votre question.',
        question: qa.question,
        answer: answerText
      },
      entityType: 'product',
      entityId: String(qa.productId),
      deepLink: `/product/${qa.productId}`,
      actionLink: `/product/${qa.productId}`
    }).catch(() => {});
  }

  if (isVerifiedBuyer || isSeller) {
    awardPoints({
      userId,
      reason: 'qa_answer',
      metadata: { questionId: String(qa._id), productId: String(qa.productId) }
    }).catch(() => {});
  }

  const populated = await ProductQuestion.findById(id)
    .populate('askedBy', 'name')
    .populate('answers.userId', 'name shopName')
    .lean();

  return res.status(201).json(populated);
});

export const upvoteQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Question invalide.' });
  }
  const userId = req.user.id || req.user._id;

  const qa = await ProductQuestion.findById(id);
  if (!qa || qa.status !== 'visible') {
    return res.status(404).json({ message: 'Question introuvable.' });
  }

  const alreadyUpvoted = qa.upvotes.some((entry) => String(entry) === String(userId));
  if (alreadyUpvoted) {
    qa.upvotes = qa.upvotes.filter((entry) => String(entry) !== String(userId));
  } else {
    qa.upvotes.push(userId);
  }
  await qa.save();

  return res.json({ upvoteCount: qa.upvotes.length, upvoted: !alreadyUpvoted });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Question invalide.' });
  }
  const userId = req.user.id || req.user._id;
  const isAdmin = ['admin', 'founder'].includes(String(req.user.role || ''));

  const qa = await ProductQuestion.findById(id);
  if (!qa) {
    return res.status(404).json({ message: 'Question introuvable.' });
  }
  if (!isAdmin && String(qa.askedBy) !== String(userId)) {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  qa.status = 'hidden';
  await qa.save();

  return res.json({ success: true });
});
