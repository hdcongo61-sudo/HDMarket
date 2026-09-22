import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  countryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mergeId: { type: String, required: true }
}, { timestamps: true });
schema.index({ user: 1, countryId: 1, mergeId: 1 }, { unique: true });
export default mongoose.model('GuestCartMerge', schema);
