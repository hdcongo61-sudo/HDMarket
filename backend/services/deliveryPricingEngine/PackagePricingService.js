/**
 * Package Extra — flat surcharge for the selected package type (Documents,
 * Food, Medicine...). Neutral (0) when no package type was given.
 */
import PackageType from '../../models/packageTypeModel.js';

export const computePackageContribution = async (packageTypeId) => {
  if (!packageTypeId) return { amount: 0, packageType: null };
  const packageType = await PackageType.findOne({ _id: packageTypeId, isActive: true }).lean();
  if (!packageType) return { amount: 0, packageType: null };
  return { amount: Math.max(0, Number(packageType.extraPrice || 0)), packageType };
};
