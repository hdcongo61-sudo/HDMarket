import mongoose from 'mongoose';

const errorLogSchema = new mongoose.Schema(
  {
    requestId: { type: String, trim: true, index: true },
    method: { type: String, trim: true, default: '' },
    path: { type: String, trim: true, default: '' },
    status: { type: Number, default: 500, index: true },
    code: { type: String, trim: true, default: 'SERVER_ERROR', index: true },
    message: { type: String, trim: true, default: '' },
    stack: { type: String, default: '' },
    ip: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ code: 1, createdAt: -1 });

export default mongoose.model('ErrorLog', errorLogSchema);

