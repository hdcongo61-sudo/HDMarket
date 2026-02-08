import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';
import { ensureDocumentSlug } from '../utils/slugUtils.js';
import { getRestrictionMessage, isRestricted } from '../utils/restrictionCheck.js';

const formatComment = (comment) => {
  const plain = comment.toObject ? comment.toObject() : comment;
  return {
    _id: plain._id,
    message: plain.message,
    product: plain.product,
    user: plain.user
      ? {
          _id: plain.user._id,
          name: plain.user.name
        }
      : null,
    parent: plain.parent
      ? {
          _id: plain.parent._id,
          message: plain.parent.message,
          user: plain.parent.user
            ? {
                _id: plain.parent.user._id,
                name: plain.parent.user.name
              }
            : null
        }
      : null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

const loadProductForComments = async (
  identifier,
  fallbackId = null,
  projection = '_id status'
) => {
  const query = buildIdentifierQuery(identifier);
  let product = await Product.findOne(query).select(projection);
  if (!product && fallbackId && mongoose.Types.ObjectId.isValid(fallbackId)) {
    product = await Product.findById(fallbackId).select(projection);
  }
  if (!product) return null;
  await ensureDocumentSlug({ document: product, sourceValue: product.title });
  return product;
};

export const getCommentsForProduct = asyncHandler(async (req, res) => {
  const product = await loadProductForComments(req.params.id, null, '_id status');
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non publié.' });
  }

  const comments = await Comment.find({ product: product._id })
    .populate('user', 'name')
    .populate({
      path: 'parent',
      select: 'message user',
      populate: { path: 'user', select: 'name' }
    })
    .sort('createdAt');

  res.json(comments.map(formatComment));
});

export const addComment = asyncHandler(async (req, res) => {
  const product = await loadProductForComments(
    req.params.id,
    req.body.productId,
    '_id status user title'
  );
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non publié.' });
  }

  const commenter = await User.findById(req.user.id).select('restrictions');
  if (!commenter) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  if (isRestricted(commenter, 'canComment')) {
    return res.status(403).json({
      message: getRestrictionMessage('canComment'),
      restrictionType: 'canComment'
    });
  }

  const { message, parentId, parentReadIds } = req.body;

  let parent = null;
  if (parentId) {
    parent = await Comment.findById(parentId).select('product user message');
    if (!parent) {
      return res.status(404).json({ message: 'Commentaire parent introuvable.' });
    }
    if (parent.product.toString() !== product._id.toString()) {
      return res.status(400).json({ message: 'Le commentaire parent ne correspond pas au produit.' });
    }
  }

  const comment = await Comment.create({
    product: product._id,
    user: req.user.id,
    message,
    parent: parent ? parent._id : null
  });

  await comment.populate('user', 'name');
  await comment.populate({
    path: 'parent',
    select: 'message user',
    populate: { path: 'user', select: 'name' }
  });

  const notifications = [];
  if (String(product.user) !== req.user.id) {
    notifications.push(
      createNotification({
        userId: product.user,
        actorId: req.user.id,
        productId: product._id,
        type: 'product_comment',
        metadata: {
          commentId: comment._id,
          message,
          productTitle: product.title || ''
        }
      })
    );
  }

  if (
    parent &&
    parent.user &&
    String(parent.user) !== req.user.id &&
    String(parent.user) !== String(product.user)
  ) {
    notifications.push(
      createNotification({
        userId: parent.user,
        actorId: req.user.id,
        productId: product._id,
        type: 'reply',
        metadata: {
          commentId: comment._id,
          parentId: parent._id,
          parentMessage: parent.message || '',
          message,
          productTitle: product.title || ''
        }
      })
    );
  }

  if (notifications.length) {
    await Promise.all(notifications);
  }

  res.status(201).json(formatComment(comment));
});
