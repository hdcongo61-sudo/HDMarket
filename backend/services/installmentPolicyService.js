const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

export const isScheduleEntrySettled = (entry) =>
  ['paid', 'waived'].includes(String(entry?.status || ''));

export const isPastDueDate = (dueDate, now = new Date()) => {
  if (!dueDate) return false;
  const deadline = new Date(dueDate);
  if (Number.isNaN(deadline.getTime())) return false;
  deadline.setHours(23, 59, 59, 999);
  return now.getTime() > deadline.getTime();
};

export const calculateInstallmentPenalty = ({ order, scheduleEntry, now = new Date() }) => {
  const isLate = isPastDueDate(scheduleEntry?.dueDate, now);
  if (!isLate) return 0;
  const baseAmount = Number(scheduleEntry?.amount || 0);
  const latePenaltyRate = Number(order?.installmentPlan?.latePenaltyRate || 0);
  return roundMoney((baseAmount * latePenaltyRate) / 100);
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
    return nextIndex;
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  schedule.push({
    dueDate,
    amount: penaltyAmount,
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
  if (!hasOpenInstallments) return 'completed';
  const hasOverdueInstallments = schedule.some((entry) => String(entry?.status || '') === 'overdue');
  return hasOverdueInstallments ? 'overdue_installment' : 'installment_active';
};
