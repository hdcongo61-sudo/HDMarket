import mongoose from 'mongoose';

const sellerAnalyticsReportSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    fileName: { type: String, trim: true, required: true },
    format: { type: String, enum: ['pdf'], default: 'pdf' },
    generatedAt: { type: Date, default: Date.now, index: true },
    metricsSnapshot: {
      revenue: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      installmentPaid: { type: Number, default: 0 },
      installmentRemaining: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

sellerAnalyticsReportSchema.index({ sellerId: 1, generatedAt: -1 });
sellerAnalyticsReportSchema.index({ sellerId: 1, periodStart: -1, periodEnd: -1 });

export default mongoose.model('SellerAnalyticsReport', sellerAnalyticsReportSchema);
