import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: Date, required: true },
  views: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ product: 1, day: 1 }, { unique: true });
schema.index({ seller: 1, day: 1 });
schema.index({ createdAt: 1 });
export default mongoose.model('ProductDailyView', schema);
