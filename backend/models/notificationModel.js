import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    type: {
      type: String,
    enum: [
      'product_comment',
      'reply',
      'favorite',
      'rating',
      'product_approval',
      'product_rejection',
      'product_certified',
      'product_boosted',
      'shop_verified',
      'promotional',
      'shop_review',
      'shop_follow',
      'payment_pending',
      'order_created',
      'order_delivering',
      'order_received',
      'order_reminder',
      'order_delivered',
      'review_reminder',
      'order_address_updated',
      'order_message',
      'complaint_resolved',
      'complaint_created',
      'feedback_read',
      'improvement_feedback_created'
    ],
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    readAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
