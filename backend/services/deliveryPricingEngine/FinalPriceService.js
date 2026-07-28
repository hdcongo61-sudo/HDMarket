/**
 * Aggregates every module's contribution into a single itemized breakdown
 * and total — the customer must always see the breakdown, never just one
 * number (see PRICE BREAKDOWN requirement).
 */
export const buildFinalPrice = ({ lines, minPrice = 0 }) => {
  const filteredLines = (lines || []).filter((line) => line && Number(line.amount) !== 0);
  const rawTotal = filteredLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const total = Math.max(Math.max(0, Number(minPrice || 0)), Math.round(rawTotal));

  const breakdown = [...filteredLines];
  if (total > Math.round(rawTotal)) {
    breakdown.push({ label: 'Ajustement au tarif minimum', amount: total - Math.round(rawTotal) });
  }

  return {
    total,
    breakdown: breakdown.map((line) => ({ label: line.label, amount: Math.round(Number(line.amount || 0)) }))
  };
};
