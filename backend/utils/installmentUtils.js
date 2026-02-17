const DAY_MS = 24 * 60 * 60 * 1000;

export const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const addDays = (date, days) => {
  const base = toDateOrNull(date) || new Date();
  return new Date(base.getTime() + Number(days || 0) * DAY_MS);
};

export const diffDays = (startDate, endDate) => {
  const start = toDateOrNull(startDate);
  const end = toDateOrNull(endDate);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
};

export const isProductInstallmentActive = (product, now = new Date()) => {
  if (!product?.installmentEnabled) return false;
  const start = toDateOrNull(product?.installmentStartDate);
  const end = toDateOrNull(product?.installmentEndDate);
  if (!start || !end) return false;
  const nowDate = toDateOrNull(now) || new Date();
  return nowDate >= start && nowDate <= end;
};

export const getRiskLevelByScore = (score) => {
  const numericScore = Number(score || 0);
  if (numericScore >= 75) return 'low';
  if (numericScore >= 50) return 'medium';
  return 'high';
};

export const validateInstallmentConfig = ({
  installmentEnabled,
  installmentMinAmount,
  installmentDuration,
  installmentStartDate,
  installmentEndDate,
  installmentLatePenaltyRate,
  installmentMaxMissedPayments,
  installmentRequireGuarantor,
  price,
  isShop
}) => {
  const enabled = Boolean(installmentEnabled);
  if (!enabled) {
    return {
      valid: true,
      normalized: {
        installmentEnabled: false,
        installmentMinAmount: 0,
        installmentDuration: null,
        installmentStartDate: null,
        installmentEndDate: null,
        installmentLatePenaltyRate: 0,
        installmentMaxMissedPayments: 3,
        installmentRequireGuarantor: false
      }
    };
  }

  if (!isShop) {
    return { valid: false, message: 'Seules les boutiques peuvent activer le paiement par tranche.' };
  }

  const minAmount = Number(installmentMinAmount);
  const duration = Number(installmentDuration);
  const start = toDateOrNull(installmentStartDate);
  const end = toDateOrNull(installmentEndDate);
  const latePenaltyRate = Number(installmentLatePenaltyRate ?? 0);
  const maxMissedPayments = Number(installmentMaxMissedPayments ?? 3);
  const requireGuarantor = Boolean(installmentRequireGuarantor);

  if (!Number.isFinite(minAmount) || minAmount <= 0) {
    return { valid: false, message: 'Le montant minimum du premier paiement est invalide.' };
  }
  if (Number.isFinite(Number(price || 0)) && minAmount > Number(price || 0)) {
    return {
      valid: false,
      message: 'Le premier paiement minimum ne peut pas dépasser le prix du produit.'
    };
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    return { valid: false, message: 'La durée du paiement par tranche doit être un nombre entier de jours.' };
  }
  if (!start || !end) {
    return { valid: false, message: 'Les dates de début et de fin du paiement par tranche sont requises.' };
  }
  if (end <= start) {
    return { valid: false, message: 'La date de fin doit être postérieure à la date de début.' };
  }
  const durationFromDates = diffDays(start, end);
  if (durationFromDates !== duration) {
    return {
      valid: false,
      message: `La durée (${duration} jours) doit correspondre à l'écart entre les dates (${durationFromDates} jours).`
    };
  }
  if (!Number.isFinite(latePenaltyRate) || latePenaltyRate < 0 || latePenaltyRate > 100) {
    return { valid: false, message: 'Le taux de pénalité doit être compris entre 0 et 100.' };
  }
  if (!Number.isInteger(maxMissedPayments) || maxMissedPayments < 1 || maxMissedPayments > 12) {
    return { valid: false, message: 'Le nombre maximal d\'impayés doit être compris entre 1 et 12.' };
  }

  return {
    valid: true,
    normalized: {
      installmentEnabled: true,
      installmentMinAmount: minAmount,
      installmentDuration: duration,
      installmentStartDate: start,
      installmentEndDate: end,
      installmentLatePenaltyRate: latePenaltyRate,
      installmentMaxMissedPayments: maxMissedPayments,
      installmentRequireGuarantor: requireGuarantor
    }
  };
};

export const generateInstallmentSchedule = ({
  remainingAmount,
  durationDays,
  firstPaymentDate = new Date()
}) => {
  const remaining = Number(remainingAmount || 0);
  const duration = Number(durationDays || 0);
  if (!Number.isFinite(remaining) || remaining <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return [];
  }

  const steps = Math.max(1, Math.ceil(duration / 30));
  const roundedRemaining = Math.round(remaining * 100);
  const baseStep = Math.floor(roundedRemaining / steps);
  const schedule = [];

  let consumed = 0;
  for (let index = 0; index < steps; index += 1) {
    const stepAmountCents = index === steps - 1 ? roundedRemaining - consumed : baseStep;
    consumed += stepAmountCents;
    const dueOffsetDays = Math.max(1, Math.round(((index + 1) * duration) / steps));
    schedule.push({
      dueDate: addDays(firstPaymentDate, dueOffsetDays),
      amount: Number((stepAmountCents / 100).toFixed(2)),
      status: 'pending',
      penaltyAmount: 0
    });
  }

  return schedule;
};

export const getInstallmentProgress = (plan = {}) => {
  const totalAmount = Number(plan.totalAmount || 0);
  const amountPaid = Number(plan.amountPaid || 0);
  const remainingAmount = Math.max(0, Number(plan.remainingAmount ?? totalAmount - amountPaid));
  const progress = totalAmount > 0 ? Math.min(100, Math.round((amountPaid / totalAmount) * 100)) : 0;
  return { totalAmount, amountPaid, remainingAmount, progress };
};

export const isScheduleEntryLate = (entry, now = new Date()) => {
  const dueDate = toDateOrNull(entry?.dueDate);
  if (!dueDate) return false;
  const isPaid = entry?.status === 'paid' || entry?.status === 'waived';
  if (isPaid) return false;
  return dueDate < (toDateOrNull(now) || new Date());
};
