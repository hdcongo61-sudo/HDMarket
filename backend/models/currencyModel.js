import mongoose from 'mongoose';

const currencyFormattingSchema = new mongoose.Schema(
  {
    symbolPosition: {
      type: String,
      enum: ['prefix', 'suffix'],
      default: 'suffix'
    },
    thousandSeparator: { type: String, default: ' ' },
    decimalSeparator: { type: String, default: ',' }
  },
  { _id: false }
);

const currencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    symbol: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    decimals: { type: Number, default: 0, min: 0, max: 8 },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    exchangeRateToDefault: { type: Number, default: 1, min: 0 },
    formatting: { type: currencyFormattingSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

currencySchema.index({ isActive: 1, isDefault: -1 });

export default mongoose.model('Currency', currencySchema);
