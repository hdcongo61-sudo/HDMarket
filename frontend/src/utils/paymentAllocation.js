// Keep the allocation rule in sync with backend/utils/paymentAllocation.js.
export const allocatePayment = (amount, entries) => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.amount) || 0), 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > Math.round(total)) {
    throw new Error('Montant à répartir invalide.');
  }
  const rows = entries.map(entry => {
    const exact = total ? amount * Math.max(0, Number(entry.amount) || 0) / total : 0;
    return { key: String(entry.key), amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = amount - rows.reduce((sum, row) => sum + row.amount, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  for (const row of rows) if (remaining-- > 0) row.amount++;
  return new Map(rows.map(row => [row.key, row.amount]));
};
