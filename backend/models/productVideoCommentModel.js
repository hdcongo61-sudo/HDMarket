import mongoose from 'mongoose';

const productVideoCommentSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVideo', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVideoComment', default: null, index: true },
    message: { type: String, trim: true, required: true, maxlength: 1000 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['visible', 'hidden', 'deleted'], default: 'visible', index: true },
    reportsCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

productVideoCommentSchema.index({ video: 1, parent: 1, createdAt: -1 });

export default mongoose.model('ProductVideoComment', productVideoCommentSchema);
