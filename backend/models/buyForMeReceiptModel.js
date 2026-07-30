import mongoose from 'mongoose';

const buyForMeReceiptSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, unique: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeName: { type: String, trim: true, required: true, maxlength: 140 },
    amountSpent: { type: Number, required: true, min: 0 },
    receiptImageUrl: { type: String, trim: true, required: true },
    productPhotoUrls: { type: [String], default: [] },
    note: { type: String, trim: true, default: '', maxlength: 1000 }
  },
  { timestamps: true, collection: 'shopping_receipts' }
);

export default mongoose.models.BuyForMeReceipt || mongoose.model('BuyForMeReceipt', buyForMeReceiptSchema);
