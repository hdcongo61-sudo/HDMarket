import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    priceBeforeDiscount: { type: Number, min: 0 },
    images: [{ type: String }],
    category: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'disabled'], default: 'pending' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
  },
  { timestamps: true }
);

// Indexes for search & sorting
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ status: 1, category: 1, price: 1, createdAt: -1 });

export default mongoose.model('Product', productSchema);
