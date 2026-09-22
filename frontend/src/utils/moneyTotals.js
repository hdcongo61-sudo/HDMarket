// Ledger amounts are already denominated in their recorded currency. Never
// convert them using the browsing preference or add different currencies.
export const formatRecordedMoney = (amount, currency = 'UNKNOWN') => {
  const code = String(currency || 'UNKNOWN').toUpperCase();
  const label = code === 'XAF' ? 'FCFA' : code === 'UNKNOWN' ? '(devise inconnue)' : code;
  return `${Number(amount || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${label}`;
};
export const sumRecordedPayments = (payments) => {
  const totals = new Map();
  for (const payment of payments) {
    const currency = payment.currency || payment.product?.currency || 'UNKNOWN';
    totals.set(currency, (totals.get(currency) || 0) + Number(payment.amountPaid ?? payment.amount ?? 0));
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount }));
};
export const formatMoneyTotals = (rows = [], field = 'amount') => rows.length
  ? rows.map((row) => formatRecordedMoney(row[field], row.currency)).join(' · ')
  : '0';
