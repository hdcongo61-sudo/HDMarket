import mongoose from 'mongoose';

export const DISPUTE_REASONS = ['wrong_item', 'damaged_item', 'not_received', 'other'];
export const DISPUTE_STATUSES = [
  'OPEN',
  'SELLER_RESPONDED',
  'UNDER_REVIEW',
  'RESOLVED_CLIENT',
  'RESOLVED_SELLER',
  'REJECTED'
];
export const DISPUTE_RESOLUTION_TYPES = ['refund_full', 'refund_partial', 'compensation', 'reject'];

const disputeFileSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true, default: '' },
    originalName: { type: String, trim: true, default: '' },
    mimetype: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0, min: 0 },
    path: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const disputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    proofImages: { type: [disputeFileSchema], default: [] },
    status: { type: String, enum: DISPUTE_STATUSES, default: 'OPEN', index: true },
    sellerResponse: { type: String, trim: true, maxlength: 2000, default: '' },
    sellerProofImages: { type: [disputeFileSchema], default: [] },
    adminDecision: { type: String, trim: true, maxlength: 2000, default: '' },
    resolutionType: { type: String, enum: DISPUTE_RESOLUTION_TYPES, default: null },
    sellerDeadline: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null },
    disputeWindowEndsAt: { type: Date, required: true },
    deadlineReminderSentAt: { type: Date, default: null },
    escalatedAt: { type: Date, default: null },
    abuseSignals: {
      clientMonthlyCount: { type: Number, default: 0, min: 0 },
      clientSuccessRate: { type: Number, default: 0, min: 0, max: 1 },
      sellerMonthlyCount: { type: Number, default: 0, min: 0 },
      suspicious: { type: Boolean, default: false },
      reasons: { type: [String], default: [] }
    },
    reputationImpactApplied: { type: Boolean, default: false }
  },
  { timestamps: true }
);

disputeSchema.index({ createdAt: -1 });
disputeSchema.index({ sellerId: 1, status: 1, sellerDeadline: 1 });
disputeSchema.index({ clientId: 1, status: 1, createdAt: -1 });

export default mongoose.model('Dispute', disputeSchema);
