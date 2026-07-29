/**
 * Package Extra — flat surcharge for the selected package type (Documents,
 * Food, Medicine...). Neutral (0) when no package type was given.
 */
import PackageType from '../../models/packageTypeModel.js';

export const computePackageContribution = async (packageTypeId, pricingContext = null) => {
  if (!packageTypeId) return { amount: 0, packageType: null };
  const packageType = pricingContext
    ? pricingContext.packageTypes.find((entry) => String(entry._id) === String(packageTypeId))
    : await PackageType.findOne({ _id: packageTypeId, isActive: true }).lean();
  if (!packageType) return { amount: 0, packageType: null };
  return { amount: Math.max(0, Number(packageType.extraPrice || 0)), packageType };
};
