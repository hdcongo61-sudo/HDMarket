import asyncHandler from 'express-async-handler';
import ImprovementFeedback from '../models/improvementFeedbackModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const ensureAdminOnly = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Acces reserve aux administrateurs.');
  }
};

const ensureCanReadFeedback = (req, res) => {
  if (req.user?.role !== 'admin' && !req.user?.canReadFeedback) {
    res.status(403);
    throw new Error('Acces reserve aux lecteurs d\'avis autorises.');
  }
};

export const createImprovementFeedback = asyncHandler(async (req, res) => {
  const { subject, body } = req.body;
  const existingCount = await ImprovementFeedback.countDocuments({ user: req.user.id });
  if (existingCount >= 5) {
    return res.status(400).json({
      message: 'Vous avez atteint la limite de 5 avis sur l\'amelioration.'
    });
  }

  const feedback = await ImprovementFeedback.create({
    user: req.user.id,
    subject: subject.trim(),
    body: body.trim()
  });

  // Notify admins and users with feedback read access
  const recipients = await User.find({
    $or: [{ role: 'admin' }, { canReadFeedback: true }]
  })
    .select('_id')
    .lean();
  const actorId = req.user.id;
  const metadata = { feedbackId: feedback._id, subject: feedback.subject || '' };
  for (const r of recipients) {
    const recipientId = r._id.toString();
    if (recipientId === actorId) continue;
    await createNotification({
      userId: r._id,
      actorId,
      type: 'improvement_feedback_created',
      metadata
    });
  }

  res.status(201).json({
    feedback: {
      _id: feedback._id,
      subject: feedback.subject,
      body: feedback.body,
      readAt: feedback.readAt,
      createdAt: feedback.createdAt
    },
    remaining: Math.max(0, 5 - (existingCount + 1))
  });
});

export const listMyImprovementFeedback = asyncHandler(async (req, res) => {
  const items = await ImprovementFeedback.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    items,
    total: items.length,
    remaining: Math.max(0, 5 - items.length)
  });
});

export const listImprovementFeedbackAdmin = asyncHandler(async (req, res) => {
  ensureCanReadFeedback(req, res);

  const { status = 'all', search = '' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (status === 'unread') {
    filter.readAt = null;
  } else if (status === 'read') {
    filter.readAt = { $ne: null };
  }
  if (search) {
    const safe = String(search).trim();
    if (safe) {
      const regex = new RegExp(safe, 'i');
      filter.$or = [{ subject: regex }, { body: regex }];
    }
  }

  const [items, total] = await Promise.all([
    ImprovementFeedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone')
      .populate('readBy', 'name')
      .lean(),
    ImprovementFeedback.countDocuments(filter)
  ]);

  res.json({
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
});

export const markImprovementFeedbackRead = asyncHandler(async (req, res) => {
  ensureCanReadFeedback(req, res);

  const feedback = await ImprovementFeedback.findById(req.params.id);
  if (!feedback) {
    return res.status(404).json({ message: 'Avis introuvable.' });
  }

  if (!feedback.readAt) {
    feedback.readAt = new Date();
    feedback.readBy = req.user.id;
    await feedback.save();

    await createNotification({
      userId: feedback.user,
      actorId: req.user.id,
      type: 'feedback_read',
      metadata: {
        subject: feedback.subject
      }
    });
  }

  const populated = await ImprovementFeedback.findById(feedback._id)
    .populate('user', 'name email phone')
    .populate('readBy', 'name')
    .lean();

  res.json({
    feedback: populated
  });
});

export const exportFeedbackPDF = asyncHandler(async (req, res) => {
  ensureAdminOnly(req, res);

  const { status = 'all', search = '' } = req.query;
  const filter = {};
  
  if (status === 'unread') {
    filter.readAt = null;
  } else if (status === 'read') {
    filter.readAt = { $ne: null };
  }
  
  if (search) {
    const safe = String(search).trim();
    if (safe) {
      const regex = new RegExp(safe, 'i');
      filter.$or = [{ subject: regex }, { body: regex }];
    }
  }

  const items = await ImprovementFeedback.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email phone')
    .populate('readBy', 'name')
    .lean();

  // Return JSON data for frontend to generate PDF
  res.json({
    items,
    total: items.length,
    exportDate: new Date().toISOString()
  });
});

export const listFeedbackReaders = asyncHandler(async (req, res) => {
  ensureAdminOnly(req, res);

  const readers = await User.find({ canReadFeedback: true })
    .select('name email phone role canReadFeedback')
    .sort({ name: 1 })
    .lean();

  res.json({ readers });
});

export const toggleFeedbackReader = asyncHandler(async (req, res) => {
  ensureAdminOnly(req, res);

  const user = await User.findById(req.params.userId);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Les administrateurs ont deja acces aux avis.' });
  }

  user.canReadFeedback = !user.canReadFeedback;
  await user.save();

  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      canReadFeedback: user.canReadFeedback
    },
    message: user.canReadFeedback 
      ? 'Acces aux avis accorde avec succes.' 
      : 'Acces aux avis revoque avec succes.'
  });
});
