import mongoose from 'mongoose';

const disputeActionLogSchema = new mongoose.Schema(
  {
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, enum: ['client', 'seller', 'admin', 'system'], required: true },
    action: {
      type: String,
      enum: [
        'DISPUTE_CREATED',
        'SELLER_RESPONDED',
        'AUTO_ESCALATED',
        'UNDER_REVIEW_SET',
        'ADMIN_RESOLVED',
        'DEADLINE_REMINDER_SENT'
      ],
      required: true
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

disputeActionLogSchema.index({ disputeId: 1, createdAt: -1 });
disputeActionLogSchema.index({ orderId: 1, createdAt: -1 });

export default mongoose.model('DisputeActionLog', disputeActionLogSchema);
