import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    audience: {
      type: String,
      enum: ['USER', 'ADMIN', 'FOUNDER', 'ROLE_GROUP'],
      default: 'USER',
      index: true
    },
    targetRole: {
      type: [String],
      default: []
    },
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
      'shop_boosted',
      'shop_verified',
      'promotional',
      'shop_review',
      'shop_follow',
      'payment_pending',
      'order_created',
      'order_delivering',
      'order_received',
      'order_full_payment_waived',
      'order_full_payment_received',
      'order_full_payment_ready',
      'order_reminder',
      'order_delivered',
      'installment_due_reminder',
      'installment_overdue_warning',
      'installment_payment_submitted',
      'installment_payment_validated',
      'installment_sale_confirmation_required',
      'installment_sale_confirmed',
      'installment_completed',
      'installment_product_suspended',
      'review_reminder',
      'order_address_updated',
      'order_delivery_fee_updated',
      'order_cancellation_window_skipped',
      'order_message',
      'delivery_request_created',
      'delivery_request_accepted',
      'delivery_request_rejected',
      'delivery_request_assigned',
      'delivery_request_in_progress',
      'delivery_request_delivered',
      'complaint_resolved',
      'complaint_created',
      'dispute_created',
      'dispute_seller_responded',
      'dispute_deadline_near',
      'dispute_under_review',
      'dispute_resolved',
      'feedback_read',
      'improvement_feedback_created',
      'admin_broadcast',
      'account_restriction',
      'account_restriction_lifted',
      'shop_conversion_request',
      'shop_conversion_approved',
      'shop_conversion_rejected',
      'validation_required'
    ],
      required: true
    },
    validationType: {
      type: String,
      enum: [
        '',
        'boostApproval',
        'productValidation',
        'shopVerification',
        'deliveryOps',
        'disputes',
        'refunds',
        'shopConversion',
        'sponsoredAds',
        'other'
      ],
      default: '',
      index: true
    },
    actionRequired: {
      type: Boolean,
      default: false,
      index: true
    },
    actionType: {
      type: String,
      enum: ['APPROVE', 'REJECT', 'REVIEW', 'ASSIGN', 'VERIFY', 'RESPOND', 'NONE'],
      default: 'NONE'
    },
    actionStatus: {
      type: String,
      enum: ['PENDING', 'DONE', 'EXPIRED'],
      default: 'DONE',
      index: true
    },
    channels: {
      type: [String],
      default: ['IN_APP', 'PUSH']
    },
    actionDueAt: {
      type: Date,
      default: null
    },
    deepLink: {
      type: String,
      default: ''
    },
    actionLink: {
      type: String,
      default: ''
    },
    entityType: {
      type: String,
      enum: ['', 'order', 'product', 'shop', 'boost', 'deliveryRequest', 'dispute', 'user', 'payment', 'refund', 'shopConversionRequest'],
      default: '',
      index: true
    },
    entityId: {
      type: String,
      default: '',
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
      index: true
    },
    groupingKey: {
      type: String,
      default: '',
      index: true
    },
    groupCount: {
      type: Number,
      default: 1,
      min: 1
    },
    delivery: {
      queueJobId: { type: String, default: '' },
      queueAttempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      socketDelivered: { type: Boolean, default: false },
      pushDelivered: { type: Boolean, default: false },
      pushFallbackWebOnline: { type: Boolean, default: false },
      pushFallbackReason: { type: String, default: '' },
      pushError: { type: String, default: '' },
      status: {
        type: String,
        enum: ['pending', 'queued', 'delivered', 'failed'],
        default: 'pending'
      }
    },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, groupingKey: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, actionStatus: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
notificationSchema.index({ validationType: 1, actionStatus: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
