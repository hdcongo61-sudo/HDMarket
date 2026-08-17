import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema(
  {
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationRequest', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    selectedAttributes: {
      type: [{
        name: { type: String, trim: true, required: true },
        value: { type: String, trim: true, required: true }
      }],
      default: []
    },
    selectionKey: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 1, max: 9999, required: true },
    originalPrice: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
    requestedPrice: { type: Number, min: 0, default: null },
    quotedPrice: { type: Number, min: 0, default: null },
    snapshot: {
      title: { type: String, trim: true, default: '' },
      image: { type: String, trim: true, default: '' },
      slug: { type: String, trim: true, default: '' }
    }
  },
  { timestamps: true }
);

quotationItemSchema.index({ quotation: 1, product: 1, selectionKey: 1 }, { unique: true });

export default mongoose.model('QuotationItem', quotationItemSchema);
