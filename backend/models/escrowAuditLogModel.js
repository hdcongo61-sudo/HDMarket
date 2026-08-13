import mongoose from 'mongoose';

const escrowAuditLogSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: {
      type: String,
      enum: ['buyer', 'seller', 'admin', 'system'],
      default: 'system'
    },
    action: {
      type: String,
      enum: [
        'ESCROW_FUNDED',
        'SELLER_MARKED_DELIVERED',
        'SELLER_MARKED_COLLECTED',
        'BUYER_CONFIRMED',
        'ESCROW_RELEASED_AUTOMATICALLY',
        'ESCROW_RELEASED_MANUALLY',
        'DISPUTE_OPENED',
        'DISPUTE_RESOLVED',
        'REFUND_PROCESSED'
      ],
      required: true,
      index: true
    },
    fromStatus: { type: String, trim: true, default: '' },
    toStatus: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0, min: 0 },
    ipAddress: { type: String, trim: true, default: '' },
    device: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

escrowAuditLogSchema.index({ order: 1, createdAt: -1 });
escrowAuditLogSchema.index(
  { order: 1, action: 1 },
  { unique: true, partialFilterExpression: { action: 'ESCROW_FUNDED' } }
);

export default mongoose.models.EscrowAuditLog ||
  mongoose.model('EscrowAuditLog', escrowAuditLogSchema);
