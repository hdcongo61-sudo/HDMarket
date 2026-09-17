import AiSearchOutcome from '../models/aiSearchOutcomeModel.js';
import Payment from '../models/paymentModel.js';
import ListingFeePayment from '../models/listingFeePaymentModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import GlobalNotificationRequest from '../models/globalNotificationRequestModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Order from '../models/orderModel.js';
import PlatformExpense from '../models/platformExpenseModel.js';
import AiUsage from '../models/aiUsageModel.js';
import ImageEditJob from '../models/imageEditJobModel.js';

// Each revenue channel has ONE authoritative collection. PawaPay funding rows
// for listing/boost/conversion are deliberately not added a second time.
export const financeSources = [
  { model: Payment, channel: 'listing', match: { paymentType: 'LISTING_FEE', status: { $in: ['VERIFIED', 'verified', 'REFUNDED'] }, waivedByPromo: { $ne: true } }, amount: { $ifNull: ['$amountPaid', { $ifNull: ['$amount', 0] }] }, refund: { $eq: ['$status', 'REFUNDED'] } },
  { model: ListingFeePayment, channel: 'listing_adjustment', match: { status: 'APPROVED' }, amount: '$amountPaid', lookup: true },
  { model: BoostRequest, channel: 'boost', match: { paymentStatus: { $in: ['paid', 'refunded'] } }, amount: '$totalPrice', refund: { $eq: ['$paymentStatus', 'refunded'] } },
  { model: ShopConversionRequest, channel: 'shop', match: { paymentStatus: { $in: ['paid', 'refunded'] } }, amount: '$paymentAmount', checkoutCurrency: true, refund: { $eq: ['$paymentStatus', 'refunded'] } },
  { model: GlobalNotificationRequest, channel: 'notification', match: { paymentStatus: { $in: ['paid', 'refunded'] } }, amount: '$price', refund: { $eq: ['$paymentStatus', 'refunded'] } },
  { model: PawaPayCheckout, channel: 'ai', match: { purpose: 'IMAGE_EDIT_FUNDING', status: 'COMPLETED', paymentState: 'CONFIRMED' }, amount: '$amount' }
];
export function combineFinanceRows(rows, expenses = []) {
  const map = new Map();
  const get = currency => {
    const key = currency || 'UNKNOWN';
    if (!map.has(key)) map.set(key, { currency: key, receipts: 0, recordedRefunds: 0, recordedExpenses: 0, channels: {} });
    return map.get(key);
  };
  for (const row of rows) {
    const item = get(row.currency);
    item.receipts += Number(row.receipts || 0); item.recordedRefunds += Number(row.refunds || 0);
    item.channels[row.channel] = (item.channels[row.channel] || 0) + Number(row.receipts || 0) - Number(row.refunds || 0);
  }
  for (const row of expenses) get(row._id).recordedExpenses += Number(row.amount || 0);
  return [...map.values()].map(x => ({ ...x, balanceAfterRecordedCosts: x.receipts - x.recordedRefunds - x.recordedExpenses }));
}
export async function getPlatformFinance() {
  const since = new Date(Date.now() - 30 * 86400000);
  const sourceRows = await Promise.all(financeSources.map(async source => {
    const pipeline = [{ $match: { ...source.match, createdAt: { $gte: since } } }];
    if (source.lookup) pipeline.push({ $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } });
    if (source.checkoutCurrency) pipeline.push({ $lookup: { from: 'pawapaycheckouts', localField: 'pawaPayCheckoutId', foreignField: 'checkoutId', as: 'checkout' } });
    pipeline.push({ $group: {
      _id: { $ifNull: [source.lookup ? { $arrayElemAt: ['$product.currency', 0] } : source.checkoutCurrency ? { $arrayElemAt: ['$checkout.currency', 0] } : '$currency', 'UNKNOWN'] },
      receipts: { $sum: source.amount }, refunds: { $sum: { $cond: [source.refund || false, source.amount, 0] } }
    } });
    return (await source.model.aggregate(pipeline)).map(x => ({ currency: x._id, channel: source.channel, receipts: x.receipts, refunds: x.refunds }));
  }));
  const [expenses, merchandise, usage, failedPaidJobs, recentExpenses, searches] = await Promise.all([
    PlatformExpense.aggregate([{ $match: { incurredAt: { $gte: since } } }, { $group: { _id: '$currency', amount: { $sum: '$amount' } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ['delivered', 'completed', 'confirmed_by_client', 'picked_up_confirmed'] } } }, { $group: { _id: { $ifNull: ['$currency', 'UNKNOWN'] }, amount: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
    AiUsage.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$feature', calls: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$state', 'failed'] }, 1, 0] } }, inputTokens: { $sum: '$inputTokens' }, outputTokens: { $sum: '$outputTokens' }, estimatedUsd: { $sum: '$estimatedUsd' }, unpriced: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$estimatedUsd', null] }, null] }, 1, 0] } } } }]),
    ImageEditJob.countDocuments({ state: { $in: ['FAILED', 'PROCESSING'] }, checkoutId: { $ne: '' }, updatedAt: { $lt: new Date(Date.now() - 10 * 60000) } }),
    PlatformExpense.find({ incurredAt: { $gte: since } }).select('reference category amount currency note incurredAt').sort({ incurredAt: -1 }).limit(30).lean(),
    AiSearchOutcome.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: 1 }, noResults: { $sum: { $cond: [{ $eq: ['$resultCount', 0] }, 1, 0] } } } }])
  ]);
  return { since, generatedAt: new Date(), period: 'Cohorte créée sur 30 jours, état actuel des paiements. Ce rapport ne constitue pas une comptabilité de trésorerie.', currencies: combineFinanceRows(sourceRows.flat(), expenses), merchandise, usage, searches: searches[0] || { total: 0, noResults: 0 }, jobsNeedingReview: failedPaidJobs, recentExpenses,
    limitations: ['Le solde déduit uniquement les coûts saisis; ce n’est pas le bénéfice net.', 'Les estimations IA en USD sont séparées des dépenses réellement saisies et ne sont pas déduites deux fois.', 'Les devises inconnues, notamment les anciennes conversions boutique, restent séparées.', 'Les remboursements de paiements plus anciens que 30 jours doivent être rapprochés séparément. Les remboursements déjà inclus dans une source ne doivent pas être saisis à nouveau.'] };
}
