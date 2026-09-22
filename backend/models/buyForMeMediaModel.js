import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  publicId: { type: String, default: '', select: false },
  legacyUrl: { type: String, default: '', select: false },
  legacyRevokedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'shopping_private_media' });
export default mongoose.models.BuyForMeMedia || mongoose.model('BuyForMeMedia', schema);
