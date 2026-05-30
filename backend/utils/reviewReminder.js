import Order from '../models/orderModel.js';
import {
  getReviewReminderSettings,
  isOrderEligibleForReviewReminder,
  runReviewReminderSweep
} from '../services/orderReviewReminderService.js';

export const sendReviewReminders = async () => {
  return runReviewReminderSweep({ limit: 200, source: 'legacy_scheduler' });
};

export const checkOrderReviewReminder = async (orderId) => {
  const order = await Order.findById(orderId).select(
    '_id status isDraft deliveredAt completedAt reviewStatus reviewReminderDisabled reviewReminderSentAt reviewCompletedAt reviewReminderCount'
  );

  if (!order) {
    return { needsReminder: false, reason: 'Commande introuvable.' };
  }

  const settings = await getReviewReminderSettings();
  const eligible = isOrderEligibleForReviewReminder(order);
  const baseline = order.deliveredAt || order.completedAt || null;
  const dueAt =
    baseline && settings.delayHours
      ? new Date(new Date(baseline).getTime() + Number(settings.delayHours || 0) * 60 * 60 * 1000)
      : null;

  if (!settings.enabled) {
    return { needsReminder: false, reason: 'Rappels désactivés.' };
  }
  if (!eligible) {
    return { needsReminder: false, reason: 'Commande non éligible.' };
  }
  if (order.reviewStatus === 'DONE') {
    return { needsReminder: false, reason: 'Avis déjà terminé.' };
  }
  if (order.reviewStatus === 'SKIPPED') {
    return { needsReminder: false, reason: 'Rappel ignoré pour cette commande.' };
  }
  if (order.reviewReminderDisabled === true) {
    return { needsReminder: false, reason: 'Rappel désactivé pour cette commande.' };
  }
  if (Number(order.reviewReminderCount || 0) >= Number(settings.maxCount || 1)) {
    return { needsReminder: false, reason: 'Nombre maximum de rappels atteint.' };
  }
  if (!dueAt || dueAt.getTime() > Date.now()) {
    return {
      needsReminder: false,
      reason: 'Délai de rappel non atteint.',
      dueAt
    };
  }

  return {
    needsReminder: true,
    dueAt,
    settings,
    reviewState: {
      status: order.reviewStatus || 'PENDING',
      disabled: Boolean(order.reviewReminderDisabled),
      sentAt: order.reviewReminderSentAt || null,
      completedAt: order.reviewCompletedAt || null,
      reminderCount: Number(order.reviewReminderCount || 0)
    }
  };
};
