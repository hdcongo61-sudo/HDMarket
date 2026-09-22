// Read-only by default. --apply-country fills only missing country IDs from
// the same customer's confirmed checkout. Never creates or resends payments.
import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/buyForMeOrderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Country from '../models/countryModel.js';
import Transaction from '../models/buyForMeTransactionModel.js';
import Dispute from '../models/buyForMeDisputeModel.js';
import Transfer from '../models/buyForMeTransferModel.js';

const applyCountry = process.argv.includes('--apply-country');
const id = value => String(value || '');
await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  const counts = { checked: 0, countryCandidates: 0, countriesFilled: 0, disputeCountriesFilled: 0 };
  const review = [];
  for await (const order of Order.find().lean().cursor()) {
    counts.checked++;
    const issues = [];
    const checkout = order.payment?.checkoutId && await Checkout.findOne({ checkoutId: order.payment.checkoutId }).lean();
    let countryId = order.countryId;
    if (!countryId) {
      const validCountry = checkout?.countryId && await Country.exists({ _id: checkout.countryId, 'currency.code': order.currency });
      if (checkout?.paymentState === 'CONFIRMED' && id(checkout.user) === id(order.customerId) && checkout.currency === order.currency && validCountry) {
        counts.countryCandidates++;
        if (applyCountry) {
          const result = await Order.updateOne({ _id: order._id, countryId: null, 'payment.checkoutId': checkout.checkoutId },
            { $set: { countryId: checkout.countryId }, $inc: { __v: 1 } });
          counts.countriesFilled += result.modifiedCount;
          countryId = result.modifiedCount ? checkout.countryId : null;
        }
      } else issues.push('COUNTRY_REQUIRES_MANUAL_REVIEW');
    }
    if (applyCountry && countryId) {
      const result = await Dispute.updateMany({ orderId: order._id, countryId: null }, { $set: { countryId } });
      counts.disputeCountriesFilled += result.modifiedCount;
    }
    if (order.payment?.checkoutId && await Order.countDocuments({ 'payment.checkoutId': order.payment.checkoutId }) > 1) issues.push('DUPLICATE_CHECKOUT_ORDERS');
    if (!checkout || checkout.paymentState !== 'CONFIRMED') issues.push('INITIAL_PAYMENT_REQUIRES_RECONCILIATION');
    const funding = await Transaction.find({ orderId: order._id, type: { $in: ['FUNDING', 'ADDITIONAL_FUNDING'] } }).lean();
    if (funding.reduce((sum, row) => sum + row.amount, 0) !== order.payment?.totalPaid) issues.push('FUNDING_LEDGER_MISMATCH');
    if (order.status === 'COMPLETED' && !order.settlementVersion) issues.push('LEGACY_SETTLEMENT_VERIFY_ACTUAL_TRANSFERS');
    if (order.status === 'CANCELED' && order.payment?.totalPaid > 0 && !await Transfer.exists({ orderId: order._id, type: 'REFUND' })) issues.push('LEGACY_CANCELLATION_VERIFY_ACTUAL_REFUND');
    if (issues.length) review.push({ orderId: id(order._id), issues });
  }
  const paidWithoutSnapshot = await Checkout.find({ paymentState: 'CONFIRMED', purpose: 'BUY_FOR_ME_FUNDING', buyForMeSnapshot: null,
    autoValidationState: { $ne: 'COMPLETED' } }).select('_id').lean();
  console.log(JSON.stringify({ mode: applyCountry ? 'FILL_MISSING_COUNTRIES' : 'READ_ONLY', counts, review,
    legacyPaidCheckoutsToReview: paidWithoutSnapshot.map(row => id(row._id)) }, null, 2));
} finally { await mongoose.disconnect(); }
