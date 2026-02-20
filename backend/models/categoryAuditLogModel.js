import mongoose from 'mongoose';

const categoryAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'REORDER', 'SOFT_DELETE', 'RESTORE', 'IMPORT', 'REASSIGN']
    },
    entityType: { type: String, default: 'Category' },
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

categoryAuditLogSchema.index({ createdAt: -1 });
categoryAuditLogSchema.index({ action: 1, createdAt: -1 });
categoryAuditLogSchema.index({ entityId: 1, createdAt: -1 });

export default mongoose.model('CategoryAuditLog', categoryAuditLogSchema);
