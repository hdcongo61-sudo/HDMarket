import mongoose from 'mongoose';

const buyForMePreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    defaultBalancePreference: {
      type: String,
      enum: ['WALLET_REFUND', 'DRIVER_TIP', 'PLATFORM_DONATION'],
      default: 'WALLET_REFUND'
    }
  },
  { timestamps: true, collection: 'shopping_preferences' }
);

export default mongoose.models.BuyForMePreference || mongoose.model('BuyForMePreference', buyForMePreferenceSchema);
