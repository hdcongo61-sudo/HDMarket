const paymentTimestamp = (payment) => {
  const value = payment?.submittedAt || payment?.createdAt || payment?.paymentDate || '';
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const sortPaymentsByRecency = (payments, order = 'newest') => {
  const direction = order === 'oldest' ? 1 : -1;
  return [...(Array.isArray(payments) ? payments : [])].sort(
    (left, right) => (paymentTimestamp(left) - paymentTimestamp(right)) * direction
  );
};

export const getPaymentPeriodStart = (period, now = new Date()) => {
  const start = new Date(now);
  if (Number.isNaN(start.getTime()) || period === 'all') return '';
  start.setHours(0, 0, 0, 0);
  if (period === 'today') return start.toISOString();
  const days = period === '7d' ? 6 : period === '30d' ? 29 : 0;
  if (!days) return '';
  start.setDate(start.getDate() - days);
  return start.toISOString();
};
