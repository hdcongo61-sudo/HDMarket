import {
  deriveInstallmentOrderStatus,
  getNextDueDate,
  getRemainingScheduleAmount,
  isScheduleEntrySettled
} from './installmentPolicyService.js';

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

export const isDeliveryFeeLocked = (order = {}) =>
  Boolean(order?.deliveryFeeLocked) &&
  String(order?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';

export const assertDeliveryFeeEditable = (order = {}) => {
  if (isDeliveryFeeLocked(order)) {
    const error = new Error('Delivery fee is locked because the order was fully paid.');
    error.statusCode = 403;
    error.code = 'DELIVERY_FEE_LOCKED';
    throw error;
  }
};

const buildSyntheticInstallment = ({ amount, now = new Date() }) => {
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  return {
    dueDate,
    amount: roundMoney(amount),
    status: 'pending',
    proofOfPayment: {},
    transactionProof: {},
    validatedBy: null,
    validatedAt: null,
    paidAt: null,
    penaltyAmount: 0,
    reminderSentAt: null,
    overdueNotifiedAt: null
  };
};

const findLastOpenScheduleIndex = (schedule = []) => {
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    if (!isScheduleEntrySettled(schedule[index])) {
      return index;
    }
  }
  return -1;
};

const applyPositiveDeltaToSchedule = ({ schedule, delta, now }) => {
  const lastOpenIndex = findLastOpenScheduleIndex(schedule);
  if (lastOpenIndex >= 0) {
    schedule[lastOpenIndex].amount = roundMoney(Number(schedule[lastOpenIndex].amount || 0) + delta);
    return;
  }
  schedule.push(buildSyntheticInstallment({ amount: delta, now }));
};

const applyNegativeDeltaToSchedule = ({ schedule, delta }) => {
  let remainingDiscount = roundMoney(Math.abs(delta));
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    const entry = schedule[index];
    if (remainingDiscount <= 0) break;
    if (isScheduleEntrySettled(entry)) continue;
    const currentAmount = roundMoney(Number(entry?.amount || 0));
    if (currentAmount <= 0) continue;
    const deduction = Math.min(currentAmount, remainingDiscount);
    entry.amount = roundMoney(currentAmount - deduction);
    remainingDiscount = roundMoney(remainingDiscount - deduction);
  }
};

export const applyDeliveryFeeToOrder = ({
  order,
  nextFee,
  actorId = null,
  updatedAt = new Date()
}) => {
  if (!order) {
    throw new Error('Order document is required.');
  }

  assertDeliveryFeeEditable(order);

  const previousFee = roundMoney(Number(order.deliveryFeeTotal || 0));
  const targetFee = roundMoney(Math.max(0, Number(nextFee || 0)));
  const delta = roundMoney(targetFee - previousFee);
  const paidAmount = roundMoney(Number(order.paidAmount || 0));
  const currentTotalAmount = roundMoney(Number(order.totalAmount || 0));
  const tentativeTotalAmount = roundMoney(currentTotalAmount + delta);

  order.deliveryFeeTotal = targetFee;
  order.deliveryFeeUpdatedAt = updatedAt;
  if (actorId) {
    order.deliveryFeeUpdatedBy = actorId;
  }

  if (String(order.paymentType || '') === 'installment' && order.installmentPlan) {
    const schedule = Array.isArray(order.installmentPlan.schedule) ? order.installmentPlan.schedule : [];

    if (delta > 0) {
      applyPositiveDeltaToSchedule({ schedule, delta, now: updatedAt });
    } else if (delta < 0) {
      applyNegativeDeltaToSchedule({ schedule, delta });
    }

    const remainingAmount = roundMoney(getRemainingScheduleAmount(schedule));
    const totalAmount = roundMoney(Math.max(paidAmount + remainingAmount, tentativeTotalAmount));

    order.totalAmount = totalAmount;
    order.remainingAmount = remainingAmount;
    order.installmentPlan.totalAmount = totalAmount;
    order.installmentPlan.remainingAmount = remainingAmount;
    order.installmentPlan.nextDueDate = getNextDueDate(schedule);
    order.installmentPlan.overdueCount = schedule.filter(
      (entry) => String(entry?.status || '') === 'overdue'
    ).length;
    order.status = deriveInstallmentOrderStatus(schedule);
    order.markModified('installmentPlan');
  } else {
    const totalAmount = roundMoney(Math.max(paidAmount, tentativeTotalAmount));
    order.totalAmount = totalAmount;
    order.remainingAmount = roundMoney(Math.max(0, totalAmount - paidAmount));
  }

  return {
    previousFee,
    nextFee: targetFee,
    delta,
    totalAmount: roundMoney(Number(order.totalAmount || 0)),
    remainingAmount: roundMoney(Number(order.remainingAmount || 0))
  };
};

export default applyDeliveryFeeToOrder;
