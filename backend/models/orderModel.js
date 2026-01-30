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
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      confirmationNumber: String
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
    deliveryGuy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGuy' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'],
      default: 'pending'
    },
    deliveryAddress: { type: String, required: true, trim: true },
    deliveryCity: {
      type: String,
      enum: ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
      default: 'Brazzaville'
    },
    trackingNote: { type: String, default: '' },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    paymentName: { type: String, trim: true, default: '' },
    paymentTransactionCode: { type: String, trim: true, default: '' },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveryCode: { type: String, unique: true, sparse: true, trim: true },
    isDraft: { type: Boolean, default: false },
    draftPayments: {
      type: [{
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        payerName: { type: String, trim: true, default: '' },
        transactionCode: { type: String, trim: true, default: '' }
      }],
      default: []
    }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, isDraft: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
