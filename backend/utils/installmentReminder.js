import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import { createNotification } from './notificationService.js';
import { addDays } from './installmentUtils.js';
import { getRuntimeConfig } from '../services/configService.js';
import { isPastDueDate } from '../services/installmentPolicyService.js';
import { withCommerceOperation } from '../services/commerceOperationService.js';
import { installmentOrderKey } from '../services/installmentPaymentService.js';

const ACTIVE_INSTALLMENT_STATUSES = [
  'pending_installment',
  'installment_active',
  'overdue_installment'
];

const resolveItemShopId = (item) =>
  item?.snapshot?.shopId ||
  item?.product?.user ||
  item?.product?.user?._id ||
  null;

const getNextDueDate = (schedule = []) => {
  const next = schedule.find((entry) =>
    ['pending', 'proof_uploaded', 'overdue'].includes(entry.status)
  );
  return next?.dueDate || null;
};

export const processInstallmentReminders = async () => {
  const now = new Date();
  const envFallback = Math.max(1, Number(process.env.INSTALLMENT_REMINDER_LEAD_DAYS || 3));
  const configValue = await getRuntimeConfig('installment_reminder_lead_days', { fallback: envFallback });
  const reminderLeadDays = Math.max(1, Number.isFinite(Number(configValue)) ? Number(configValue) : envFallback);
  const reminderLimit = addDays(now, reminderLeadDays);

  const orders = await Order.find({
    paymentType: 'installment',
    status: { $in: ACTIVE_INSTALLMENT_STATUSES },
    isDraft: { $ne: true },
    'installmentPlan.saleConfirmationConfirmedAt': { $ne: null }
  }).select('_id');

  if (!orders.length) {
    return {
      processedOrders: 0,
      remindersSent: 0,
      overdueWarningsSent: 0,
      suspendedProducts: 0
    };
  }

  let remindersSent = 0;
  let overdueWarningsSent = 0;
  let suspendedProducts = 0;

  for (const reference of orders) {
    await withCommerceOperation(installmentOrderKey(reference._id), async session => {
    const order = await Order.findOne({ _id: reference._id, status: { $in: ACTIVE_INSTALLMENT_STATUSES },
      'installmentPlan.saleConfirmationConfirmedAt': { $ne: null } }).session(session);
    if (!order) return;
    const schedule = Array.isArray(order.installmentPlan?.schedule)
      ? order.installmentPlan.schedule
      : [];
    if (!schedule.length) return;

    let changed = false;
    const sellerId = resolveItemShopId(order.items?.[0]);
    for (let index = 0; index < schedule.length; index += 1) {
      const entry = schedule[index];
      if (!entry?.dueDate) continue;
      if (entry.status === 'paid' || entry.status === 'waived') continue;
      // A submitted proof awaits review; seller delay must not turn it into
      // unpaid debt or remove it from the proof-validation escalation queue.
      if (entry.transactionProof?.transactionCode && entry.transactionProof.paymentMethod !== 'pawapay' && entry.status === 'overdue') {
        entry.status = 'proof_uploaded';
        entry.overdueAt = null;
        changed = true;
      }
      if (entry.status === 'proof_uploaded' || entry.transactionProof?.transactionCode) continue;

      const dueDate = new Date(entry.dueDate);
      if (isPastDueDate(dueDate, now)) {
        if (entry.status !== 'overdue') {
          entry.status = 'overdue';
          changed = true;
        }
        if (!entry.overdueNotifiedAt) {
          await createNotification({
            userId: order.customer,
            actorId: sellerId || order.customer,
            productId: order.items?.[0]?.product || null,
            type: 'installment_overdue_warning',
            metadata: {
              orderId: order._id,
              status: 'overdue_installment',
              scheduleIndex: index,
              amount: entry.amount,
              dueDate: entry.dueDate
            },
            allowSelf: !sellerId
          });
          if (sellerId) {
            await createNotification({
              userId: sellerId,
              actorId: order.customer,
              productId: order.items?.[0]?.product || null,
              type: 'installment_overdue_warning',
              metadata: {
                orderId: order._id,
                status: 'overdue_installment',
                scheduleIndex: index,
                amount: entry.amount,
                dueDate: entry.dueDate
              }
            });
          }
          entry.overdueNotifiedAt = now;
          overdueWarningsSent += 1;
          changed = true;
        }
      } else if (dueDate <= reminderLimit && !entry.reminderSentAt) {
        await createNotification({
          userId: order.customer,
          actorId: sellerId || order.customer,
          productId: order.items?.[0]?.product || null,
          type: 'installment_due_reminder',
          metadata: {
            orderId: order._id,
            status: order.status,
            scheduleIndex: index,
            amount: entry.amount,
            dueDate: entry.dueDate
          },
          allowSelf: !sellerId
        });
        entry.reminderSentAt = now;
        remindersSent += 1;
        changed = true;
      }
    }

    const overdueCount = schedule.filter((entry) => entry.status === 'overdue').length;
    if (Number(order.installmentPlan.overdueCount || 0) !== overdueCount) {
      order.installmentPlan.overdueCount = overdueCount;
      changed = true;
    }
    const nextDueDate = getNextDueDate(schedule);
    if (
      String(order.installmentPlan.nextDueDate || '') !== String(nextDueDate || '')
    ) {
      order.installmentPlan.nextDueDate = nextDueDate;
      changed = true;
    }
    if (overdueCount > 0 && order.status !== 'overdue_installment') {
      order.status = 'overdue_installment';
      changed = true;
    }
    if (overdueCount === 0 && order.status === 'overdue_installment') {
      order.status = 'installment_active';
      changed = true;
    }

    if (changed) {
      order.markModified('installmentPlan');
      await order.save({ session });
    }

    const productId = order.items?.[0]?.product;
    if (!productId) return;
    const product = await Product.findById(productId).select(
      '_id installmentEnabled installmentMaxMissedPayments installmentSuspendedAt user title'
    ).session(session);
    if (!product?.installmentEnabled) return;
    const maxMissed = Number(product.installmentMaxMissedPayments || 3);
    if (overdueCount >= maxMissed) {
      product.installmentEnabled = false;
      product.installmentSuspendedAt = now;
      await product.save({ session });
      suspendedProducts += 1;

      if (product.user) {
        await createNotification({
          userId: product.user,
          actorId: sellerId || product.user,
          productId: product._id,
          type: 'installment_product_suspended',
          metadata: {
            productId: product._id,
            productTitle: product.title,
            message:
              'Le paiement par tranche a été suspendu automatiquement après plusieurs impayés.'
          },
          allowSelf: !sellerId
        });
      }
    }
    });
  }

  return {
    processedOrders: orders.length,
    remindersSent,
    overdueWarningsSent,
    suspendedProducts
  };
};
