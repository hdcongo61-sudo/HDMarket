import mongoose from 'mongoose';

// The unique _id serializes an operation across API workers and callbacks.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  revision: { type: Number, default: 0 },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
}, { timestamps: true });

export default mongoose.models.CommerceOperation || mongoose.model('CommerceOperation', schema);
