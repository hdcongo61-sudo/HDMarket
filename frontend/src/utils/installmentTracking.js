const SETTLED_SCHEDULE_STATUSES = new Set(['paid', 'waived']);
const OPEN_SCHEDULE_STATUSES = new Set(['pending', 'proof_uploaded', 'overdue']);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Number(toNumber(value).toFixed(2));

export const isInstallmentOrder = (order) => String(order?.paymentType || '') === 'installment';

export const getInstallmentSchedule = (order) =>
  Array.isArray(order?.installmentPlan?.schedule) ? order.installmentPlan.schedule : [];

export const getInstallmentWorkflow = (order) => {
  if (!isInstallmentOrder(order)) return null;

  const plan = order?.installmentPlan || {};
  const schedule = getInstallmentSchedule(order);
  const saleConfirmed = Boolean(plan?.saleConfirmationConfirmedAt);
  const hasOverdue = schedule.some((entry) => String(entry?.status || '') === 'overdue');
  const hasOpenInstallments = schedule.some(
    (entry) => !SETTLED_SCHEDULE_STATUSES.has(String(entry?.status || ''))
  );
  const nextInstallment =
    schedule.find((entry) => OPEN_SCHEDULE_STATUSES.has(String(entry?.status || ''))) || null;
  const remainingFromSchedule = roundMoney(
    schedule.reduce((sum, entry) => {
      if (SETTLED_SCHEDULE_STATUSES.has(String(entry?.status || ''))) return sum;
      return sum + toNumber(entry?.amount);
    }, 0)
  );

  let workflowStatus = 'installment_active';
  if (String(order?.status || '') === 'cancelled' || String(order?.installmentSaleStatus || '') === 'cancelled') {
    workflowStatus = 'cancelled';
  } else if (!saleConfirmed || String(order?.status || '') === 'pending_installment') {
    workflowStatus = 'pending_installment';
  } else if (!hasOpenInstallments) {
    workflowStatus = 'completed';
  } else if (hasOverdue || String(order?.status || '') === 'overdue_installment') {
    workflowStatus = 'overdue_installment';
  }

  return {
    workflowStatus,
    schedule,
    nextInstallment,
    nextInstallmentAmount: roundMoney(nextInstallment?.amount || 0),
    nextDueDate: nextInstallment?.dueDate || plan?.nextDueDate || null,
    remainingFromSchedule,
    saleConfirmed,
    hasOpenInstallments,
    hasOverdue
  };
};

