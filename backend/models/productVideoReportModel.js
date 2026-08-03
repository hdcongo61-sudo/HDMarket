import mongoose from 'mongoose';

const productVideoReportSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVideo', required: true, index: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVideoComment', default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: ['spam', 'misleading', 'inappropriate', 'counterfeit', 'dangerous', 'other'],
      default: 'other'
    },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolution: { type: String, trim: true, maxlength: 1000, default: '' }
  },
  { timestamps: true }
);

productVideoReportSchema.index(
  { video: 1, comment: 1, reporter: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'reviewing'] } } }
);

export default mongoose.model('ProductVideoReport', productVideoReportSchema);
