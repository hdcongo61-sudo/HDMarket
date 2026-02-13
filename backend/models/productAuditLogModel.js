import mongoose from 'mongoose';

const productAuditLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

productAuditLogSchema.index({ product: 1, createdAt: -1 });
productAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
productAuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('ProductAuditLog', productAuditLogSchema);
