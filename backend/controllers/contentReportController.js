import asyncHandler from 'express-async-handler';
import Report from '../models/reportModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';

const ALLOWED_STATUSES = new Set(['pending', 'reviewed', 'resolved', 'dismissed']);

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

  const admins = await User.find({
    $or: [
      { role: 'admin' },
      { role: 'manager' },
      { canManageComplaints: true }
    ]
  })
    .select('_id')
    .lean();

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

  for (const admin of admins) {
    if (admin._id.toString() === req.user.id) continue;
    await createNotification({
      userId: admin._id,
      actorId: req.user.id,
      type: 'content_reported',
      metadata
    });
  }

  res.status(201).json({
    _id: report._id,
    type: report.type,
    status: report.status,
    createdAt: report.createdAt
  });
});

export const listReportsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  const { status, type } = req.query;

  if (status && ALLOWED_STATUSES.has(status)) {
    filter.status = status;
  }

  if (type && ['comment', 'photo'].includes(type)) {
    filter.type = type;
  }

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .populate('reporter', 'name email phone')
    .populate('reportedUser', 'name email phone')
    .populate('product', 'title slug images')
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
    { path: 'comment', select: 'message createdAt' },
    { path: 'handledBy', select: 'name email' }
  ]);

  res.json(report);
});
