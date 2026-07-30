import mongoose from 'mongoose';

const buyForMeConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    enabled: { type: Boolean, default: true },
    serviceCommissionPercent: { type: Number, min: 0, max: 100, default: 5 },
    minimumCommission: { type: Number, min: 0, default: 0 },
    maximumCommission: { type: Number, min: 0, default: 0 },
    cashAdvanceFee: { type: Number, min: 0, default: 500 },
    minimumBudget: { type: Number, min: 1, default: 1000 },
    maximumBudget: { type: Number, min: 1, default: 500000 },
    supportedStoreTypes: {
      type: [String],
      default: ['SUPERMARKET', 'PHARMACY', 'RESTAURANT', 'HARDWARE', 'ELECTRONICS', 'CLOTHING', 'LOCAL_MARKET', 'OTHER']
    },
    supportedCities: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'shopping_service_config' }
);

export default mongoose.models.BuyForMeConfig || mongoose.model('BuyForMeConfig', buyForMeConfigSchema);
