import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    payerName: { type: String, required: true },
    transactionNumber: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    operator: { type: String, enum: ['MTN', 'Airtel', 'Orange', 'Moov', 'Other'], required: true },
    status: { type: String, enum: ['waiting', 'verified', 'rejected'], default: 'waiting' },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    validatedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
