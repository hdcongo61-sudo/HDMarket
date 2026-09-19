// Dry run: node scripts/repairPawaPayListingAmounts.js <checkout-id> [...]
// Apply the reviewed repair with --apply. No provider calls or new charges.
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const apply = process.argv.includes('--apply');
const checkoutIds = process.argv.slice(2).filter((arg) => arg !== '--apply');
if (!checkoutIds.length || checkoutIds.some((id) => !/^[a-f0-9-]{36}$/i.test(id))) {
  throw new Error('Provide explicit PawaPay checkout UUIDs. Default mode is dry run.');
}

try {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const checkoutId of checkoutIds) {
        const checkout = await db.collection('pawapaycheckouts').findOne({
          checkoutId, purpose: 'LISTING_FEE_FUNDING', status: 'COMPLETED',
          paymentState: 'CONFIRMED', autoValidationState: 'COMPLETED', promoCode: ''
        }, { session });
        if (!checkout || !(checkout.amount > 0) || !checkout.autoValidatedPayment) {
          throw new Error(`Checkout ${checkoutId}: no confirmed, completed, undiscounted payment to repair.`);
        }
        const payment = await db.collection('payments').findOne({
          _id: checkout.autoValidatedPayment, product: checkout.product,
          transactionNumber: checkoutId, 'gateway.name': 'PAWAPAY',
          status: { $in: ['verified', 'VERIFIED'] }
        }, { session });
        if (!payment) throw new Error(`Checkout ${checkoutId}: linked verified payment not found.`);
        if (payment.amountPaid === checkout.amount && payment.amount === checkout.amount && payment.paymentMethod === 'pawapay') {
          console.log(JSON.stringify({ checkoutId, result: 'already correct', amountPaid: payment.amountPaid }));
          continue;
        }
        if (payment.amount !== 0 || payment.amountPaid !== 0 || payment.commissionBaseAmount !== 0 ||
            payment.commissionDueAmount !== 0 || payment.commissionDiscountAmount !== 0 || payment.waivedByPromo) {
          throw new Error(`Checkout ${checkoutId}: unexpected payment amounts; refusing automatic repair.`);
        }
        const product = await db.collection('products').findOne({
          _id: checkout.product, payment: payment._id,
          listingFeePaid: 0, listingFeeRequired: 0, listingFeeRemaining: 0,
          requiresAdditionalPayment: { $ne: true }, listingFeeSettled: true
        }, { session });
        if (!product) throw new Error(`Checkout ${checkoutId}: product has changed; refusing automatic repair.`);

        const correctedAt = new Date();
        const amount = checkout.amount;
        const previousPayment = Object.fromEntries([
          'amount', 'amountPaid', 'expectedAmount', 'commissionBaseAmount',
          'commissionDueAmount', 'paymentMethod', 'updatedAt'
        ].map((key) => [key, payment[key]]));
        const previousProduct = Object.fromEntries([
          'listingFeePaid', 'listingFeeRequired', 'listingFeeRate', 'listingFeeStatus', 'updatedAt'
        ].map((key) => [key, product[key]]));
        console.log(JSON.stringify({ checkoutId, mode: apply ? 'apply' : 'dry-run', previousAmountPaid: 0, correctedAmountPaid: amount, currency: checkout.currency }));
        if (!apply) continue;
        await db.collection('payments').updateOne({ _id: payment._id }, { $set: {
          amount, amountPaid: amount, expectedAmount: amount,
          commissionBaseAmount: amount, commissionDueAmount: amount, paymentMethod: 'pawapay',
          'metadata.listingFeeCorrection': {
            reason: 'Confirmed PawaPay amount replaced by a recalculated zero commission',
            checkoutId, correctedAt, previousPayment, previousProduct
          }, updatedAt: correctedAt
        } }, { session });
        await db.collection('products').updateOne({ _id: product._id }, { $set: {
          listingFeePaid: amount, listingFeeRequired: amount, listingFeeStatus: 'PAID',
          listingFeeRate: payment.commissionReferencePrice > 0 ? amount / payment.commissionReferencePrice : product.listingFeeRate,
          updatedAt: correctedAt
        } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
} catch (error) {
  // Never print connection strings or driver diagnostics that may contain credentials.
  console.error(error.name === 'Error' ? error.message : `Repair failed (${error.name}).`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
