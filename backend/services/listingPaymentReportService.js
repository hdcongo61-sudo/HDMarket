import Payment from '../models/paymentModel.js';
import ListingFeePayment from '../models/listingFeePaymentModel.js';
import mongoose from 'mongoose';

export const castCountryFilter = (value) => {
  if (typeof value === 'string' && mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(value);
  if (Array.isArray(value)) return value.map(castCountryFilter);
  if (value && value.constructor === Object) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, castCountryFilter(child)]));
  return value;
};

export const listingPaymentMatch = {
  $or: [{ paymentType: 'LISTING_FEE' }, { paymentType: { $exists: false }, product: { $ne: null } }]
};
export const listingPaymentStatuses = {
  waiting: ['waiting', 'PENDING_PAYMENT', 'SUBMITTED', 'UNDER_REVIEW', 'AMOUNT_MISMATCH'],
  verified: ['verified', 'VERIFIED'],
  rejected: ['rejected', 'REJECTED']
};

// Both initial fees and price-change top-ups are receipts. Funding checkouts
// are never summed again. Historical missing country/currency uses the product.
export const listingPaymentLedger = (countryFilter = {}) => [
  { $match: listingPaymentMatch },
  { $unionWith: { coll: ListingFeePayment.collection.name, pipeline: [
    { $match: { $or: [{ status: 'APPROVED' }, { submittedAt: { $ne: null }, transactionReference: { $ne: '' } }] } },
    { $set: { product: '$productId', status: { $switch: { branches: [
      { case: { $eq: ['$status', 'APPROVED'] }, then: 'verified' },
      { case: { $eq: ['$status', 'REJECTED'] }, then: 'rejected' }
    ], default: 'waiting' } } } }
  ] } },
  { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'listing' } },
  { $set: {
    countryId: { $ifNull: ['$countryId', { $arrayElemAt: ['$listing.countryId', 0] }] },
    currency: { $ifNull: ['$currency', { $ifNull: [{ $arrayElemAt: ['$listing.currency', 0] }, 'XAF'] }] },
    cashAmount: { $cond: ['$waivedByPromo', 0, { $ifNull: ['$amountPaid', { $ifNull: ['$amount', 0] }] }] },
    status: { $switch: { branches: Object.entries(listingPaymentStatuses).map(([status, values]) => ({ case: { $in: ['$status', values] }, then: status })), default: '$status' } }
  } },
  { $match: castCountryFilter(countryFilter) }
];

export async function getListingPaymentReport({ countryFilter = {}, now = new Date() } = {}) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [report = {}] = await Payment.aggregate([...listingPaymentLedger(countryFilter), { $facet: {
    counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
    currencies: [
      { $match: { status: 'verified' } },
      { $group: { _id: '$currency', revenue: { $sum: '$cashAmount' }, revenueLast30Days: { $sum: { $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, '$cashAmount', 0] } } } },
      { $project: { _id: 0, currency: '$_id', revenue: 1, revenueLast30Days: 1 } },
      { $sort: { currency: 1 } }
    ],
    monthly: [
      { $match: { status: 'verified', createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, currency: '$currency' }, total: { $sum: '$cashAmount' } } }
    ],
    channels: [{ $group: {
      _id: { method: { $ifNull: ['$paymentMethod', 'mobile_money'] }, currency: '$currency' },
      count: { $sum: 1 }, amount: { $sum: '$cashAmount' },
      verifiedCount: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
      verifiedAmount: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, '$cashAmount', 0] } },
      waitingCount: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
      rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
    } }]
  } }]);
  const counts = Object.fromEntries((report.counts || []).map((row) => [row._id, row.count]));
  const currencies = report.currencies || [];
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    waiting: counts.waiting || 0, verified: counts.verified || 0, rejected: counts.rejected || 0,
    currencies, revenue: currencies.length === 1 ? currencies[0].revenue : null,
    revenueLast30Days: currencies.length === 1 ? currencies[0].revenueLast30Days : null,
    monthly: report.monthly || [], channels: report.channels || []
  };
}
