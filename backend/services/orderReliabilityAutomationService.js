import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { processInstallmentReminders } from '../utils/installmentReminder.js';
import { getRuntimeConfig } from './configService.js';

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const hasSlaEscalationEvent = (order, scheduleIndex, transactionCode = '') => {
  const timeline = Array.isArray(order?.timeline) ? order.timeline : [];
  const normalizedCode = String(transactionCode || '').trim();
  return timeline.some((event) => {
    if (String(event?.type || '') !== 'installment_payment_proof_sla_escalated') return false;
    const metadata = event?.metadata || {};
    const sameIndex = Number(metadata?.scheduleIndex) === Number(scheduleIndex);
    const sameCode = String(metadata?.transactionCode || '').trim() === normalizedCode;
    return sameIndex && sameCode;
  });
};

const resolveAdminRecipients = async () => {
  const admins = await User.find({
    $or: [
      { role: { $in: ['admin', 'manager', 'founder'] } },
      { canVerifyPayments: true }
    ]
  })
    .select('_id')
    .lean();

  const unique = new Set(
    admins
      .map((entry) => String(entry?._id || '').trim())
      .filter(Boolean)
  );
  return Array.from(unique);
};

export const runInstallmentReminderSweep = async () => processInstallmentReminders();

export const runInstallmentProofValidationSlaSweep = async ({
  limit = 200,
  actorId = null,
  slaHours = null
} = {}) => {
  const now = new Date();
  const configuredSla = await getRuntimeConfig('installment_payment_validation_sla_hours', {
    fallback: 48
  });
  const thresholdHours = Math.max(
    12,
    Number.isFinite(Number(slaHours)) ? Number(slaHours) : Number(configuredSla || 48)
  );
  const deadline = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
  const maxRows = Math.max(1, Math.min(Number(limit) || 200, 1000));

  const orders = await Order.find({
    paymentType: 'installment',
    isDraft: { $ne: true },
    'installmentPlan.saleConfirmationConfirmedAt': { $ne: null },
    'installmentPlan.schedule': {
      $elemMatch: {
        status: 'proof_uploaded',
        'transactionProof.submittedAt': { $lte: deadline }
      }
    }
  })
    .select(
      '_id customer status items installmentPlan.schedule timeline'
    )
    .limit(maxRows);

  if (!orders.length) {
    return {
      processedOrders: 0,
      escalatedOrders: 0,
      escalatedEntries: 0,
      notifiedAdmins: 0,
      thresholdHours
    };
  }

  const adminRecipientIds = await resolveAdminRecipients();
  let escalatedOrders = 0;
  let escalatedEntries = 0;
  let notificationsCreated = 0;

  for (const order of orders) {
    const schedule = Array.isArray(order?.installmentPlan?.schedule)
      ? order.installmentPlan.schedule
      : [];
    let orderEscalated = false;
    let orderChanged = false;

    for (let index = 0; index < schedule.length; index += 1) {
      const entry = schedule[index];
      if (String(entry?.status || '') !== 'proof_uploaded') continue;
      const submittedAt = toDate(entry?.transactionProof?.submittedAt);
      if (!submittedAt || submittedAt.getTime() > deadline.getTime()) continue;
      const transactionCode = String(entry?.transactionProof?.transactionCode || '').trim();
      if (hasSlaEscalationEvent(order, index, transactionCode)) continue;

      const metadata = {
        orderId: order._id,
        scheduleIndex: index,
        amount: Number(entry?.amount || 0),
        dueDate: entry?.dueDate || null,
        submittedAt,
        transactionCode,
        thresholdHours
      };

      order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
      order.timeline.push({
        type: 'installment_payment_proof_sla_escalated',
        label: 'Installment payment proof pending seller validation',
        actor: actorId || null,
        metadata,
        at: now
      });
      orderChanged = true;
      orderEscalated = true;
      escalatedEntries += 1;

      await Promise.all(
        adminRecipientIds.map(async (recipientId) => {
          await createNotification({
            userId: recipientId,
            actorId: actorId || null,
            type: 'admin_broadcast',
            metadata: {
              orderId: order._id,
              status: order.status,
              message: `Validation vendeur en attente > ${thresholdHours}h sur tranche ${index + 1}.`,
              scheduleIndex: index,
              submittedAt,
              thresholdHours
            },
            allowSelf: false
          });
          notificationsCreated += 1;
        })
      );
    }

    if (orderEscalated) {
      escalatedOrders += 1;
    }
    if (orderChanged) {
      order.markModified('timeline');
      await order.save();
    }
  }

  return {
    processedOrders: orders.length,
    escalatedOrders,
    escalatedEntries,
    notifiedAdmins: notificationsCreated,
    thresholdHours
  };
};

