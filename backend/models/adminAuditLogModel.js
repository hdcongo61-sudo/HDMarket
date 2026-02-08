import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'restriction_applied',
        'restriction_removed',
        'user_blocked',
        'user_unblocked',
        'shop_verified',
        'shop_unverified',
        'role_changed',
        'account_type_changed'
      ],
      required: true
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying
adminAuditLogSchema.index({ targetUser: 1, createdAt: -1 });
adminAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AdminAuditLog', adminAuditLogSchema);
