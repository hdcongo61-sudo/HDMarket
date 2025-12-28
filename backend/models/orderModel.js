import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
    snapshot: {
      title: String,
      price: Number,
      image: String,
      shopName: String,
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Au moins un produit est requis.'
      },
      required: true
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['confirmed', 'delivering', 'delivered'],
      default: 'confirmed'
    },
    deliveryAddress: { type: String, required: true, trim: true },
    deliveryCity: {
      type: String,
      enum: ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
      default: 'Brazzaville'
    },
    trackingNote: { type: String, default: '' },
    shippedAt: { type: Date },
    deliveredAt: { type: Date }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
