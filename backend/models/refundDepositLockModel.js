import mongoose from 'mongoose';

// Updating one document per deposit serializes refund reservations across
// workers, including checkouts that fund orders from several sellers.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  revision: { type: Number, default: 0 }
});
export default mongoose.models.RefundDepositLock || mongoose.model('RefundDepositLock', schema);
