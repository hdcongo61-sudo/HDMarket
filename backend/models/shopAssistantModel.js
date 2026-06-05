import mongoose from 'mongoose';

const shopAssistantSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    assistant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.every((p) => ALLOWED_PERMISSIONS.includes(p)),
        message: 'Permission non valide.'
      }
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'removed', 'left'],
      default: 'pending',
      index: true
    },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export const ALLOWED_PERMISSIONS = [
  'respond_to_comments',
  'manage_product_questions',
  'confirm_orders',
  'reject_orders',
  'update_order_status',
  'manage_delivery_requests',
  'respond_to_buyer_messages',
  'manage_product_availability',
  'view_shop_dashboard',
  'view_shop_orders',
  'view_shop_products',
  'view_shop_notifications'
];

// A user can only be assistant in one active shop
shopAssistantSchema.index({ assistant: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'active'] } } });
// A shop can only have one active assistant
shopAssistantSchema.index({ shop: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'active'] } } });
// Compound indexes
shopAssistantSchema.index({ shop: 1 });
shopAssistantSchema.index({ owner: 1 });

export default mongoose.model('ShopAssistant', shopAssistantSchema);
