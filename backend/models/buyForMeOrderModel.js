import mongoose from 'mongoose';

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null },
    cityName: { type: String, trim: true, default: '' },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
    communeName: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    coordinates: { type: geoPointSchema, default: null },
    landmarkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Landmark', default: null },
    contactName: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const shoppingItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 140 },
    quantity: { type: Number, required: true, min: 0.001 },
    estimatedUnitPrice: { type: Number, required: true, min: 0, default: 0 },
    estimatedTotal: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, trim: true, default: '', maxlength: 300 },
    imageUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ['PENDING', 'FOUND', 'UNAVAILABLE', 'REPLACED', 'CANCELED'],
      default: 'PENDING'
    },
    replacementNote: { type: String, trim: true, default: '', maxlength: 300 }
  },
  { _id: true }
);

const priceLineSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true },
    label: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const buyForMeOrderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGuy', default: null, index: true },
    storeType: {
      type: String,
      enum: ['SUPERMARKET', 'PHARMACY', 'RESTAURANT', 'HARDWARE', 'ELECTRONICS', 'CLOTHING', 'LOCAL_MARKET', 'OTHER'],
      required: true
    },
    preferredStore: { type: String, trim: true, default: '', maxlength: 140 },
    pickup: { type: locationSchema, required: true },
    dropoff: { type: locationSchema, required: true },
    items: { type: [shoppingItemSchema], validate: [(value) => Array.isArray(value) && value.length > 0, 'Ajoutez au moins un article.'] },
    specialInstructions: { type: String, trim: true, default: '', maxlength: 1000 },
    authorizationMode: {
      type: String,
      enum: ['ITEM_ESTIMATES', 'SHOPPING_BUDGET'],
      default: 'ITEM_ESTIMATES'
    },
    // Deprecated alias retained only so existing shopping orders can still be
    // read. New orders derive their authorized amount from item estimates.
    maxShoppingBudget: { type: Number, required: true, min: 1 },
    estimatedShoppingValue: { type: Number, required: true, min: 1 },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
    pricing: {
      authorizationMode: { type: String, enum: ['ITEM_ESTIMATES', 'SHOPPING_BUDGET'], default: 'ITEM_ESTIMATES' },
      shoppingBudget: { type: Number, min: 0, required: true },
      estimatedShoppingValue: { type: Number, min: 0, required: true },
      cashAdvanceFee: { type: Number, min: 0, required: true },
      deliveryFee: { type: Number, min: 0, required: true },
      serviceCommission: { type: Number, min: 0, required: true },
      serviceCommissionPercent: { type: Number, min: 0, max: 100, required: true },
      total: { type: Number, min: 0, required: true },
      driverEarnings: { type: Number, min: 0, required: true },
      distanceMeters: { type: Number, min: 0, default: 0 },
      breakdown: { type: [priceLineSchema], default: [] },
      pricingVersion: { type: String, trim: true, default: '' }
    },
    balancePreference: {
      type: String,
      enum: ['WALLET_REFUND', 'DRIVER_TIP', 'PLATFORM_DONATION'],
      default: 'WALLET_REFUND'
    },
    payment: {
      method: { type: String, enum: ['PAWAPAY'], default: 'PAWAPAY' },
      status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING', index: true },
      checkoutId: { type: String, trim: true, default: '' },
      paidAt: { type: Date, default: null },
      totalPaid: { type: Number, min: 0, default: 0 }
    },
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeReceipt', default: null },
    amountSpent: { type: Number, min: 0, default: 0 },
    remainingBalance: { type: Number, min: 0, default: 0 },
    additionalPayment: {
      required: { type: Boolean, default: false },
      amount: { type: Number, min: 0, default: 0 },
      status: { type: String, enum: ['NONE', 'REQUIRED', 'PENDING', 'PAID', 'DECLINED'], default: 'NONE' },
      checkoutId: { type: String, trim: true, default: '' },
      requestedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null }
    },
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'SEARCHING_DRIVER',
        'DRIVER_ASSIGNED',
        'SHOPPING',
        'WAITING_CUSTOMER_APPROVAL',
        'RECEIPT_UPLOADED',
        'DELIVERING',
        'DELIVERED',
        'COMPLETED',
        'CANCELED',
        'FAILED'
      ],
      default: 'PENDING_PAYMENT',
      index: true
    },
    currentStage: {
      type: String,
      enum: ['ASSIGNED', 'ACCEPTED', 'SHOPPING', 'WAITING_APPROVAL', 'RECEIPT_UPLOADED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'FAILED'],
      default: 'ASSIGNED',
      index: true
    },
    assignmentAcceptedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timeline: { type: [timelineSchema], default: [] }
  },
  { timestamps: true, collection: 'shopping_orders' }
);

buyForMeOrderSchema.index({ status: 1, createdAt: -1 });
buyForMeOrderSchema.index({ customerId: 1, updatedAt: -1 });
buyForMeOrderSchema.index({ driverId: 1, status: 1, updatedAt: -1 });
buyForMeOrderSchema.index({ 'pickup.cityId': 1, status: 1, createdAt: -1 });

export default mongoose.models.BuyForMeOrder || mongoose.model('BuyForMeOrder', buyForMeOrderSchema);
