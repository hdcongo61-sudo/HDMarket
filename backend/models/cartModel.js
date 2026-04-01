import mongoose from 'mongoose';

const cartItemSelectedAttributeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    value: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    selectionKey: { type: String, trim: true, default: '' },
    selectedAttributes: { type: [cartItemSelectedAttributeSchema], default: [] }
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] }
  },
  { timestamps: true }
);

cartSchema.index({ user: 1 });

export default mongoose.model('Cart', cartSchema);
