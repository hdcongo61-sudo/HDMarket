/**
 * Weight Extra — finds the admin-configured bracket the parcel's weight
 * falls into and returns either a multiplier to apply to the running
 * subtotal, or a flat extra to add. Neutral (multiplier 1, extra 0) when no
 * weight was given or no bracket matches.
 */
import WeightRule from '../../models/weightRuleModel.js';

export const computeWeightContribution = async (weightKg) => {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { multiplier: 1, fixedExtra: 0, rule: null };
  }
  const rule = await WeightRule.findOne({
    isActive: true,
    minKg: { $lte: weightKg },
    maxKg: { $gte: weightKg }
  })
    .sort({ minKg: -1 })
    .lean();
  if (!rule) return { multiplier: 1, fixedExtra: 0, rule: null };

  if (rule.mode === 'MULTIPLIER') {
    return { multiplier: Math.max(0, Number(rule.multiplier || 1)), fixedExtra: 0, rule };
  }
  return { multiplier: 1, fixedExtra: Math.max(0, Number(rule.fixedExtra || 0)), rule };
};
