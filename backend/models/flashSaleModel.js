import mongoose from 'mongoose';

const flashSaleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    flashPrice: {
      type: Number,
      required: true,
      min: 0
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancelReason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

// Prevent duplicate active flash sales for the same product
flashSaleSchema.index({ product: 1, status: 1 });
// Efficient query for active/scheduled flash sales
flashSaleSchema.index({ status: 1, startDate: 1, endDate: 1 });
// Admin listing
flashSaleSchema.index({ createdAt: -1 });

// Virtual: time remaining in seconds
flashSaleSchema.virtual('endsInSeconds').get(function () {
  if (this.status !== 'active') return 0;
  return Math.max(0, Math.floor((new Date(this.endDate) - Date.now()) / 1000));
});

// Virtual: whether the flash sale has started
flashSaleSchema.virtual('hasStarted').get(function () {
  return new Date(this.startDate) <= new Date();
});

export default mongoose.model('FlashSale', flashSaleSchema);
