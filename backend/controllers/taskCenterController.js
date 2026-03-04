import asyncHandler from 'express-async-handler';
import Notification from '../models/notificationModel.js';
import {
  expireValidationTaskNotifications,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import {
  getTaskSummaryForRole,
  normalizeValidationTaskType
} from '../utils/notificationTaskCounter.js';

const roleToAudienceValues = (role = '') => {
  const normalized = String(role || '').trim().toLowerCase();
  const upper = normalized.toUpperCase();
  if (normalized === 'admin' || normalized === 'founder') {
    return {
      $or: [
        { audience: upper },
        { audience: 'ROLE_GROUP', targetRole: { $in: [upper, normalized] } }
      ]
    };
  }
  return {
    audience: 'ROLE_GROUP',
    targetRole: { $in: [upper, normalized] }
  };
};

const ensureAdminAccess = (req) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (!['admin', 'manager', 'founder'].includes(role)) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
};

const ensureFounderAccess = (req) => {
  if (String(req.user?.role || '').toLowerCase() !== 'founder') {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
};

export const getAdminTaskSummary = asyncHandler(async (req, res) => {
  ensureAdminAccess(req);
  await expireValidationTaskNotifications().catch(() => {});
  const summary = await getTaskSummaryForRole('admin');
  return res.json(summary);
});

export const getFounderTaskSummary = asyncHandler(async (req, res) => {
  ensureFounderAccess(req);
  await expireValidationTaskNotifications().catch(() => {});
  const summary = await getTaskSummaryForRole('founder');
  return res.json(summary);
});

export const listRoleValidationTasks = asyncHandler(async (req, res) => {
  const requestedRole = String(req.query?.role || '').trim().toLowerCase();
  const actorRole = String(req.user?.role || '').trim().toLowerCase();
  const role = requestedRole || (actorRole === 'founder' ? 'founder' : 'admin');

  if (role === 'founder') {
    ensureFounderAccess(req);
  } else {
    ensureAdminAccess(req);
  }

  const status = String(req.query?.status || 'PENDING').trim().toUpperCase();
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 20)));
  const skip = (page - 1) * limit;
  const validationType = req.query?.validationType
    ? normalizeValidationTaskType(req.query.validationType)
    : '';

  const filter = {
    actionRequired: true,
    ...roleToAudienceValues(role)
  };
  if (status && ['PENDING', 'DONE', 'EXPIRED'].includes(status)) {
    filter.actionStatus = status;
  }
  if (validationType) {
    filter.validationType = validationType;
  }

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ priority: -1, actionDueAt: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email')
      .populate('user', 'name email')
      .lean(),
    Notification.countDocuments(filter)
  ]);

  return res.json({
    items: items.map((item) => ({
      id: item._id,
      type: item.type,
      audience: item.audience,
      validationType: item.validationType || 'other',
      priority: item.priority || 'NORMAL',
      title: item?.metadata?.title || '',
      message: item?.metadata?.message || '',
      deepLink: item.deepLink || item.actionLink || item?.metadata?.deepLink || '',
      actionType: item.actionType || 'NONE',
      actionStatus: item.actionStatus || 'DONE',
      actionDueAt: item.actionDueAt || null,
      entityType: item.entityType || '',
      entityId: item.entityId || '',
      createdAt: item.createdAt,
      actor: item.actor
        ? {
            id: item.actor._id,
            name: item.actor.name,
            email: item.actor.email
          }
        : null
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
});

export const markRoleValidationTaskDone = asyncHandler(async (req, res) => {
  const actorRole = String(req.user?.role || '').trim().toLowerCase();
  if (!['admin', 'manager', 'founder'].includes(actorRole)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = String(req.params?.id || '').trim();
  const task = await Notification.findById(id).lean();
  if (!task || !task.actionRequired) {
    return res.status(404).json({ message: 'Tâche introuvable.' });
  }

  await resolveValidationTaskNotifications({
    entityType: task.entityType,
    entityId: task.entityId,
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: task.validationType || null
  });

  return res.json({ success: true });
});

