import asyncHandler from 'express-async-handler';
import {
  applyAdminOrderAction,
  getOrderAlertCenter,
  getOrderCommandCenterSnapshot,
  getOrderTimelineData,
  getSellerPerformanceSnapshot,
  getUserRiskSnapshot,
  runAutomatedReminderSweep,
  runDelayedOrderDetection
} from '../services/adminOrderAutomationService.js';

export const adminOrderCommandCenter = asyncHandler(async (req, res) => {
  const data = await getOrderCommandCenterSnapshot(req.query || {});
  res.json(data);
});

export const adminOrderAlerts = asyncHandler(async (req, res) => {
  const data = await getOrderAlertCenter(req.query || {});
  res.json(data);
});

export const adminSellerPerformance = asyncHandler(async (req, res) => {
  const data = await getSellerPerformanceSnapshot(req.query || {});
  res.json(data);
});

export const adminUserRisk = asyncHandler(async (req, res) => {
  const data = await getUserRiskSnapshot(req.query || {});
  res.json(data);
});

export const adminOrderTimeline = asyncHandler(async (req, res) => {
  const timeline = await getOrderTimelineData(req.params.id);
  if (!timeline) {
    return res.status(404).json({ message: 'Order not found.' });
  }
  res.json(timeline);
});

export const adminApplyOrderAction = asyncHandler(async (req, res) => {
  const requestedAction = String(req.body?.action || '')
    .trim()
    .toLowerCase();
  const adminOnlyActions = new Set([
    'force_mark_delivered',
    'force_delivered',
    'force_close_order',
    'force_close'
  ]);

  if (adminOnlyActions.has(requestedAction) && req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Only admins can force-close or force-mark delivered.'
    });
  }

  const result = await applyAdminOrderAction({
    orderId: req.params.id,
    action: requestedAction,
    actorId: req.user?.id || req.user?._id || null,
    note: req.body?.note || '',
    reminderType: req.body?.reminderType || 'manual',
    delaySeverity: req.body?.delaySeverity || 'none'
  });

  if (!result.ok) {
    return res.status(result.status || 400).json({ message: result.message || 'Unable to apply action.' });
  }

  res.json({ message: result.message, ...result.data });
});

export const adminRunDelayDetection = asyncHandler(async (req, res) => {
  const result = await runDelayedOrderDetection({
    limit: Number(req.body?.limit || req.query?.limit || 250),
    actorId: req.user?.id || req.user?._id || null
  });
  res.json({ message: 'Delay detection completed.', ...result });
});

export const adminRunReminderSweep = asyncHandler(async (req, res) => {
  const reminderType =
    req.body?.reminderType ||
    req.query?.reminderType ||
    'seller';

  const result = await runAutomatedReminderSweep({
    reminderType,
    limit: Number(req.body?.limit || req.query?.limit || 120),
    actorId: req.user?.id || req.user?._id || null
  });

  res.json({ message: 'Reminder sweep completed.', ...result });
});
