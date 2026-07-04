import asyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import {
  getBuyerOrderReviewPageData,
  getReviewReminderSettings,
  isOrderEligibleForReviewReminder,
  markOrderReviewReminderAction,
  runReviewReminderSweep
} from '../services/orderReviewReminderService.js';

export const triggerReviewReminders = asyncHandler(async (_req, res) => {
  const result = await runReviewReminderSweep({ limit: 200, source: 'manual' });

  res.json({
    message: 'Review reminders processed',
    ...result
  });
});

export const checkOrderReviewReminderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    customer: req.user.id,
    isDraft: false
  }).select(
    '_id status deliveredAt completedAt reviewStatus reviewReminderDisabled reviewReminderSentAt reviewCompletedAt reviewReminderCount'
  );

  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const settings = await getReviewReminderSettings();
  const eligible = isOrderEligibleForReviewReminder(order);
  const baseline = order.deliveredAt || order.completedAt || null;
  const dueAt =
    baseline && settings.delayHours
      ? new Date(new Date(baseline).getTime() + Number(settings.delayHours || 0) * 60 * 60 * 1000)
      : null;

  res.json({
    needsReminder:
      Boolean(settings.enabled) &&
      eligible &&
      order.reviewStatus !== 'DONE' &&
      order.reviewStatus !== 'SKIPPED' &&
      order.reviewReminderDisabled !== true &&
      Number(order.reviewReminderCount || 0) < Number(settings.maxCount || 1),
    eligible,
    reviewState: {
      status: order.reviewStatus || 'PENDING',
      disabled: Boolean(order.reviewReminderDisabled),
      sentAt: order.reviewReminderSentAt || null,
      completedAt: order.reviewCompletedAt || null,
      reminderCount: Number(order.reviewReminderCount || 0)
    },
    settings,
    dueAt
  });
});

export const getBuyerOrderReviewPage = asyncHandler(async (req, res) => {
  const payload = await getBuyerOrderReviewPageData({
    orderId: req.params.id,
    userId: req.user.id
  });
  res.json(payload);
});

export const updateBuyerOrderReviewReminder = asyncHandler(async (req, res) => {
  const action = String(req.body?.action || '').trim().toLowerCase();
  const order = await markOrderReviewReminderAction({
    orderId: req.params.id,
    userId: req.user.id,
    action
  });

  res.json({
    success: true,
    reviewState: {
      status: order.reviewStatus || 'PENDING',
      disabled: Boolean(order.reviewReminderDisabled),
      sentAt: order.reviewReminderSentAt || null,
      completedAt: order.reviewCompletedAt || null,
      reminderCount: Number(order.reviewReminderCount || 0)
    }
  });
});
