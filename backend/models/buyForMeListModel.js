import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 140 },
  quantity: { type: Number, required: true, min: 0.001, max: 10000 },
  estimatedUnitPrice: { type: Number, min: 0, max: 100000000, default: 0 },
  note: { type: String, maxlength: 300, default: '' }
}, { _id: false });

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  name: { type: String, required: true, maxlength: 80 },
  storeType: { type: String, required: true },
  preferredStore: { type: String, maxlength: 140, default: '' },
  authorizationMode: { type: String, enum: ['ITEM_ESTIMATES', 'SHOPPING_BUDGET'], default: 'SHOPPING_BUDGET' },
  shoppingBudget: { type: Number, min: 0, max: 100000000, default: 0 },
  items: { type: [itemSchema], validate: value => value.length > 0 && value.length <= 30 }
}, { timestamps: true, collection: 'shopping_lists' });
schema.index({ userId: 1, countryId: 1, updatedAt: -1 });
export default mongoose.models.BuyForMeList || mongoose.model('BuyForMeList', schema);
