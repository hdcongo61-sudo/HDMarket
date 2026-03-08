import asyncHandler from 'express-async-handler';
import Report from '../models/reportModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';

const ALLOWED_STATUSES = new Set(['pending', 'reviewed', 'resolved', 'dismissed']);
const ALLOWED_REASON_CATEGORIES = new Set(['fraud', 'copyright', 'adult', 'violent', 'spam', 'other']);

const normalizeReasonCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_REASON_CATEGORIES.has(normalized) ? normalized : 'other';
};

const getModerationRecipients = async () =>
  User.find({
    $or: [{ role: 'admin' }, { role: 'founder' }, { role: 'manager' }, { canManageComplaints: true }]
  })
    .select('_id')
    .lean();

const notifyModerationRecipients = async ({ actorId, metadata = {} }) => {
  const recipients = await getModerationRecipients();
  for (const recipient of recipients) {
    if (String(recipient?._id || '') === String(actorId || '')) continue;
    await createNotification({
      userId: recipient._id,
      actorId,
      type: 'content_reported',
      metadata
    });
  }
};

export const createReport = asyncHandler(async (req, res) => {
  const { type, commentId, productId, photoUrl, reason } = req.body;

  if (!type || !['comment', 'photo'].includes(type)) {
    return res.status(400).json({ message: 'Type de signalement invalide. Doit être "comment" ou "photo".' });
  }

  if (!productId) {
    return res.status(400).json({ message: 'ID du produit requis.' });
  }

  const product = await Product.findById(productId).select('_id user images').lean();
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable.' });
  }

  let reportedUserId = product.user;
  let comment = null;

  if (type === 'comment') {
    if (!commentId) {
      return res.status(400).json({ message: 'ID du commentaire requis pour signaler un commentaire.' });
    }
    comment = await Comment.findById(commentId).populate('user', '_id').lean();
    if (!comment) {
      return res.status(404).json({ message: 'Commentaire introuvable.' });
    }
    if (comment.product.toString() !== productId) {
      return res.status(400).json({ message: 'Le commentaire ne correspond pas au produit.' });
    }
    reportedUserId = comment.user?._id || comment.user;
  } else if (type === 'photo') {
    if (!photoUrl) {
      return res.status(400).json({ message: 'URL de la photo requise pour signaler une photo.' });
    }
    if (!product.images || !product.images.includes(photoUrl)) {
      return res.status(400).json({ message: 'La photo ne correspond pas au produit.' });
    }
  }

  if (!reportedUserId) {
    return res.status(400).json({ message: 'Impossible de déterminer l\'utilisateur signalé.' });
  }

  if (reportedUserId.toString() === req.user.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas signaler votre propre contenu.' });
  }

  const existingReport = await Report.findOne({
    reporter: req.user.id,
    reportedUser: reportedUserId,
    type,
    product: productId,
    comment: type === 'comment' ? commentId : null,
    photoUrl: type === 'photo' ? photoUrl : null,
    status: { $in: ['pending', 'reviewed'] }
  });

  if (existingReport) {
    return res.status(400).json({ message: 'Vous avez déjà signalé ce contenu.' });
  }

  const report = await Report.create({
    reporter: req.user.id,
    reportedUser: reportedUserId,
    type,
    comment: type === 'comment' ? commentId : null,
    product: productId,
    photoUrl: type === 'photo' ? photoUrl : null,
    reason: (reason || '').trim().substring(0, 500)
  });

  const reportedUser = await User.findById(reportedUserId).select('name email').lean();
  const reporter = await User.findById(req.user.id).select('name').lean();

  const metadata = {
    reportId: report._id,
    type,
    productId,
    reportedUserName: reportedUser?.name || 'Utilisateur',
    reporterName: reporter?.name || 'Utilisateur'
  };

  if (type === 'comment') {
    metadata.commentId = commentId;
  } else {
    metadata.photoUrl = photoUrl;
  }

  await notifyModerationRecipients({
    actorId: req.user.id,
    metadata
  });

  res.status(201).json({
    _id: report._id,
    type: report.type,
    status: report.status,
    createdAt: report.createdAt
  });
});

export const createPreviewImageReport = asyncHandler(async (req, res) => {
  const {
    imageUrl,
    contextType,
    productId,
    shopId,
    reasonCategory,
    reason,
    imageIndex,
    sourcePath,
    deepLink,
    productSlug,
    shopSlug,
    productTitle,
    shopName
  } = req.body || {};

  const safeContextType = String(contextType || '').trim().toLowerCase();
  if (!['product', 'shop'].includes(safeContextType)) {
    return res.status(400).json({ message: 'Contexte invalide. Utilisez "product" ou "shop".' });
  }

  let product = null;
  let shop = null;
  let reportedUserId = null;

  if (safeContextType === 'product') {
    const targetProductId = String(productId || '').trim();
    if (!targetProductId) {
      return res.status(400).json({ message: 'productId requis.' });
    }
    const productQuery = buildIdentifierQuery(targetProductId);
    product = await Product.findOne(productQuery).select('_id slug title user images').lean();
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable.' });
    }
    const productImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (!productImages.includes(imageUrl)) {
      return res.status(400).json({ message: 'Cette image ne correspond pas au produit ciblé.' });
    }
    reportedUserId = product.user;
  } else {
    const targetShopId = String(shopId || '').trim();
    if (!targetShopId) {
      return res.status(400).json({ message: 'shopId requis.' });
    }
    const shopQuery = buildIdentifierQuery(targetShopId);
    shop = await User.findOne(shopQuery)
      .select('_id slug accountType shopName name shopLogo shopBanner')
      .lean();
    if (!shop || shop.accountType !== 'shop') {
      return res.status(404).json({ message: 'Boutique introuvable.' });
    }
    const shopMedia = [shop.shopLogo, shop.shopBanner].filter(Boolean);
    if (shopMedia.length && !shopMedia.includes(imageUrl)) {
      return res.status(400).json({ message: 'Cette image ne correspond pas au média boutique.' });
    }
    reportedUserId = shop._id;
  }

  if (!reportedUserId) {
    return res.status(400).json({ message: "Impossible de déterminer l'utilisateur signalé." });
  }

  if (String(reportedUserId) === String(req.user.id)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas signaler votre propre contenu.' });
  }

  const existing = await Report.findOne({
    reporter: req.user.id,
    reportedUser: reportedUserId,
    type: 'preview_image',
    contextType: safeContextType,
    product: safeContextType === 'product' ? product?._id : null,
    shop: safeContextType === 'shop' ? shop?._id : null,
    photoUrl: imageUrl,
    status: { $in: ['pending', 'reviewed'] }
  })
    .select('_id')
    .lean();

  if (existing) {
    return res.status(400).json({ message: 'Vous avez déjà signalé cette image.' });
  }

  const report = await Report.create({
    reporter: req.user.id,
    reportedUser: reportedUserId,
    type: 'preview_image',
    product: safeContextType === 'product' ? product?._id || null : null,
    shop: safeContextType === 'shop' ? shop?._id || null : null,
    photoUrl: imageUrl,
    contextType: safeContextType,
    imageIndex: Number.isFinite(Number(imageIndex)) ? Number(imageIndex) : null,
    reasonCategory: normalizeReasonCategory(reasonCategory),
    reason: String(reason || '').trim().slice(0, 500),
    sourcePath: String(sourcePath || '').trim().slice(0, 240),
    deepLink: String(deepLink || '').trim().slice(0, 500),
    contextMeta: {
      productSlug: String(product?.slug || productSlug || '').trim().slice(0, 140),
      shopSlug: String(shop?.slug || shopSlug || '').trim().slice(0, 140),
      productTitle: String(product?.title || productTitle || '').trim().slice(0, 200),
      shopName: String(shop?.shopName || shop?.name || shopName || '').trim().slice(0, 200)
    }
  });

  const reportedUser = await User.findById(reportedUserId).select('name email').lean();
  const reporter = await User.findById(req.user.id).select('name').lean();

  await notifyModerationRecipients({
    actorId: req.user.id,
    metadata: {
      reportId: report._id,
      type: report.type,
      contextType: safeContextType,
      productId: product?._id || null,
      shopId: shop?._id || null,
      photoUrl: imageUrl,
      reasonCategory: report.reasonCategory,
      reportedUserName: reportedUser?.name || 'Utilisateur',
      reporterName: reporter?.name || 'Utilisateur'
    }
  });

  return res.status(201).json({
    _id: report._id,
    type: report.type,
    status: report.status,
    contextType: report.contextType,
    createdAt: report.createdAt
  });
});

export const listReportsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  const { status, type } = req.query;

  if (status && ALLOWED_STATUSES.has(status)) {
    filter.status = status;
  }

  if (type && ['comment', 'photo', 'preview_image'].includes(type)) {
    filter.type = type;
  }

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .populate('reporter', 'name email phone')
    .populate('reportedUser', 'name email phone')
    .populate('product', 'title slug images')
    .populate('shop', 'name shopName slug shopLogo shopBanner')
    .populate('comment', 'message createdAt')
    .populate('handledBy', 'name email')
    .lean();

  res.json(reports);
});

export const updateReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  if (!status || !ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ message: 'Signalement introuvable.' });
  }

  report.status = status;
  if (adminNote !== undefined) {
    report.adminNote = (adminNote || '').trim().substring(0, 1000);
  }
  report.handledBy = req.user.id;
  report.handledAt = new Date();

  await report.save();

  await report.populate([
    { path: 'reporter', select: 'name email phone' },
    { path: 'reportedUser', select: 'name email phone' },
    { path: 'product', select: 'title slug images' },
    { path: 'shop', select: 'name shopName slug shopLogo shopBanner' },
    { path: 'comment', select: 'message createdAt' },
    { path: 'handledBy', select: 'name email' }
  ]);

  res.json(report);
});
