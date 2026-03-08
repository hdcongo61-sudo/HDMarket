import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['comment', 'photo', 'preview_image'],
      required: true,
      index: true
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    photoUrl: {
      type: String,
      default: null
    },
    contextType: {
      type: String,
      enum: ['product', 'shop'],
      default: 'product',
      index: true
    },
    imageIndex: {
      type: Number,
      default: null,
      min: 0
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    reasonCategory: {
      type: String,
      enum: ['fraud', 'copyright', 'adult', 'violent', 'spam', 'other'],
      default: 'other',
      index: true
    },
    sourcePath: {
      type: String,
      trim: true,
      maxlength: 240,
      default: ''
    },
    deepLink: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    contextMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    adminNote: {
      type: String,
      maxlength: 1000,
      default: ''
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    handledAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ reportedUser: 1, status: 1 });
reportSchema.index({ shop: 1, status: 1 });
reportSchema.index({ contextType: 1, type: 1, status: 1 });

export default mongoose.model('Report', reportSchema);
