const roundMoney = (value) => Math.round(Number(value || 0));

export const isScheduleEntrySettled = (entry) =>
  ['paid', 'waived'].includes(String(entry?.status || ''));

export const isPastDueDate = (dueDate, now = new Date()) => {
  if (!dueDate) return false;
  const deadline = new Date(dueDate);
  if (Number.isNaN(deadline.getTime())) return false;
  // Congo-Brazzaville is UTC+1 all year; do not depend on server timezone.
  const local = new Date(deadline.getTime() + 3600000);
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - 3600000;
  return now.getTime() >= end;
};

export const calculateInstallmentPenalty = ({ order, scheduleEntry, now = new Date() }) => {
  const paidOn = scheduleEntry?.transactionProof?.submittedAt
    ? new Date(scheduleEntry.transactionProof.submittedAt) : now;
  const isLate = isPastDueDate(scheduleEntry?.dueDate, paidOn);
  if (!isLate) return 0;
  const baseAmount = Math.max(0, Number(scheduleEntry?.amount || 0) - Number(scheduleEntry?.penaltyComponent || 0));
  const latePenaltyRate = Number(order?.installmentPlan?.latePenaltyRate || 0);
  const penalty = roundMoney((baseAmount * latePenaltyRate) / 100);
  // Do not create an unpayable fee or compound penalties on penalties.
  return penalty >= 10 ? penalty : 0;
};

export const getNextPayableInstallmentIndex = (schedule = [], fromIndex = -1) =>
  schedule.findIndex((entry, index) => index > fromIndex && !isScheduleEntrySettled(entry));

export const forwardPenaltyToNextInstallment = ({
  schedule = [],
  fromIndex = -1,
  penalty = 0,
  now = new Date()
}) => {
  const penaltyAmount = roundMoney(penalty);
  if (penaltyAmount <= 0) return -1;

  const nextIndex = getNextPayableInstallmentIndex(schedule, fromIndex);
  if (nextIndex >= 0) {
    schedule[nextIndex].amount = roundMoney(Number(schedule[nextIndex].amount || 0) + penaltyAmount);
    schedule[nextIndex].penaltyComponent = roundMoney(Number(schedule[nextIndex].penaltyComponent || 0) + penaltyAmount);
    return nextIndex;
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  schedule.push({
    dueDate,
    amount: penaltyAmount,
    penaltyComponent: penaltyAmount,
    status: 'pending',
    proofOfPayment: {},
    transactionProof: {},
    validatedBy: null,
    validatedAt: null,
    paidAt: null,
    penaltyAmount: 0,
    reminderSentAt: null,
    overdueNotifiedAt: null
  });
  return schedule.length - 1;
};

export const getRemainingScheduleAmount = (schedule = []) =>
  roundMoney(
    schedule.reduce((sum, entry) => {
      if (isScheduleEntrySettled(entry)) return sum;
      return sum + Number(entry?.amount || 0);
    }, 0)
  );

export const getNextDueDate = (schedule = []) => {
  const next = schedule.find((entry) =>
    ['pending', 'proof_uploaded', 'overdue'].includes(String(entry?.status || ''))
  );
  return next?.dueDate || null;
};

export const deriveInstallmentOrderStatus = (schedule = []) => {
  const hasOpenInstallments = schedule.some((entry) => !isScheduleEntrySettled(entry));
  if (!hasOpenInstallments) return 'installment_paid';
  const hasOverdueInstallments = schedule.some((entry) => !isScheduleEntrySettled(entry) && entry.status !== 'proof_uploaded' &&
    (entry.status === 'overdue' || isPastDueDate(entry.dueDate)));
  return hasOverdueInstallments ? 'overdue_installment' : 'installment_active';
};

export const installmentIsClosed = (order) => ['cancelled', 'completed', 'delivered', 'picked_up_confirmed', 'confirmed_by_client', 'dispute_opened'].includes(order.status) ||
  order.installmentSaleStatus === 'cancelled' || ['REFUNDED', 'RELEASED', 'ON_HOLD'].includes(order.escrowStatus);

export const installmentRefundBlocksPayment = order => {
  if (order.installmentRefundRequired || ['pending', 'failed'].includes(order.refundStatus)) return true;
  const excess = (order.installmentPayments || []).reduce((sum, receipt) => sum + Math.max(0, receipt.amount - receipt.allocatedAmount), 0);
  // Returning an accidental extra payment does not cancel the agreed schedule.
  return order.refundStatus === 'processed' && Number(order.refundAmount || 0) > excess;
};

export const syncInstallmentAmounts = (order) => {
  const plan = order.installmentPlan;
  if (!plan) return;
  const schedule = plan.schedule || [];
  if (plan.principalAmount == null) plan.principalAmount = Number(plan.totalAmount || order.totalAmount || 0);
  const paid = schedule.filter(entry => entry.status === 'paid');
  plan.amountPaid = roundMoney(paid.reduce((sum, entry) => sum + Number(entry.transactionProof?.amount || entry.amount || 0), 0));
  plan.penaltiesPaid = roundMoney(paid.reduce((sum, entry) => sum + Number(entry.penaltyComponent || 0), 0));
  plan.principalPaid = Math.max(0, plan.amountPaid - plan.penaltiesPaid);
  plan.remainingAmount = getRemainingScheduleAmount(schedule);
  plan.totalAmount = plan.amountPaid + plan.remainingAmount;
  plan.nextDueDate = getNextDueDate(schedule);
  plan.overdueCount = schedule.filter(entry => !isScheduleEntrySettled(entry) && entry.status !== 'proof_uploaded' && isPastDueDate(entry.dueDate)).length;
  const receipts = order.installmentPayments || [];
  const unallocated = receipts.reduce((sum, entry) => sum + Math.max(0, entry.amount - entry.allocatedAmount), 0);
  order.totalAmount = plan.totalAmount;
  order.paidAmount = plan.amountPaid + unallocated;
  order.remainingAmount = plan.remainingAmount;
  order.paymentMode = 'INSTALLMENT';
  order.paymentStatus = plan.remainingAmount === 0 ? 'PAID_FULL' : plan.amountPaid > 0 ? 'PARTIAL' : 'PENDING';
  if (order.paymentSource === 'pawapay' && !['RELEASED', 'REFUNDED'].includes(order.escrowStatus)) {
    const captured = receipts.length ? receipts.reduce((sum, entry) => sum + entry.amount, 0) : plan.amountPaid;
    order.escrowAmount = captured;
    if (captured > 0 && order.escrowStatus === 'WAITING_PAYMENT') order.escrowStatus = 'IN_ESCROW';
  }
  if (!installmentIsClosed(order)) {
    order.status = plan.saleConfirmationConfirmedAt ? deriveInstallmentOrderStatus(schedule) : 'pending_installment';
  }
  if (plan.remainingAmount === 0 && !order.paymentCompletedAt) order.paymentCompletedAt = new Date();
  order.markModified?.('installmentPlan');
};
