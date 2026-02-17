import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
    snapshot: {
      title: String,
      price: Number,
      image: String,
      shopName: String,
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      confirmationNumber: String,
      slug: String
    }
  },
  { _id: false }
);

const installmentProofSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    resourceType: { type: String, enum: ['image', 'pdf'], default: 'image' },
    mimeType: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { _id: false }
);

const installmentTransactionProofSchema = new mongoose.Schema(
  {
    senderName: { type: String, trim: true, default: '' },
    transactionCode: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0, min: 0 },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { _id: false }
);

const installmentScheduleSchema = new mongoose.Schema(
  {
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'proof_uploaded', 'paid', 'overdue', 'waived'],
      default: 'pending'
    },
    proofOfPayment: { type: installmentProofSchema, default: () => ({}) },
    transactionProof: { type: installmentTransactionProofSchema, default: () => ({}) },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    validatedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    penaltyAmount: { type: Number, default: 0, min: 0 },
    reminderSentAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null }
  },
  { _id: false }
);

const installmentPlanSchema = new mongoose.Schema(
  {
    totalAmount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    nextDueDate: { type: Date, default: null },
    firstPaymentMinAmount: { type: Number, default: 0, min: 0 },
    schedule: { type: [installmentScheduleSchema], default: [] },
    proofOfPayment: { type: installmentProofSchema, default: () => ({}) },
    saleConfirmationProof: { type: installmentProofSchema, default: () => ({}) },
    saleConfirmationConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    saleConfirmationConfirmedAt: { type: Date, default: null },
    eligibilityScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    latePenaltyRate: { type: Number, default: 0, min: 0, max: 100 },
    totalPenaltyAccrued: { type: Number, default: 0, min: 0 },
    overdueCount: { type: Number, default: 0, min: 0 },
    guarantor: {
      required: { type: Boolean, default: false },
      fullName: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
      nationalId: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' }
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Au moins un produit est requis.'
      },
      required: true
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deliveryGuy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGuy' },
    status: {
      type: String,
      enum: [
        'pending',
        'pending_installment',
        'installment_active',
        'overdue_installment',
        'confirmed',
        'delivering',
        'delivered',
        'completed',
        'cancelled'
      ],
      default: 'pending'
    },
    paymentType: {
      type: String,
      enum: ['full', 'installment'],
      default: 'full'
    },
    installmentSaleStatus: {
      type: String,
      enum: ['', 'confirmed', 'delivering', 'delivered', 'cancelled'],
      default: ''
    },
    deliveryAddress: { type: String, required: true, trim: true },
    deliveryCity: {
      type: String,
      enum: ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
      default: 'Brazzaville'
    },
    trackingNote: { type: String, default: '' },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    appliedPromoCode: {
      code: { type: String, trim: true, default: '' },
      boutiqueId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      appliesTo: { type: String, enum: ['', 'boutique', 'product'], default: '' },
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
      discountType: { type: String, enum: ['', 'percentage', 'fixed'], default: '' },
      discountValue: { type: Number, default: 0, min: 0 },
      discountAmount: { type: Number, default: 0, min: 0 }
    },
    paymentName: { type: String, trim: true, default: '' },
    paymentTransactionCode: { type: String, trim: true, default: '' },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveryCode: { type: String, unique: true, sparse: true, trim: true },
    isDraft: { type: Boolean, default: false },
    isInquiry: { type: Boolean, default: false },
    installmentPlan: { type: installmentPlanSchema, default: null },
    draftPayments: {
      type: [{
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        payerName: { type: String, trim: true, default: '' },
        transactionCode: { type: String, trim: true, default: '' },
        promoCode: { type: String, trim: true, default: '' }
      }],
      default: []
    },
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    cancellationWindowSkippedAt: { type: Date } // When buyer confirms they won't cancel, allows seller to process immediately
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, isDraft: 1, createdAt: -1 });
orderSchema.index({ paymentType: 1, status: 1, createdAt: -1 });
orderSchema.index({ 'installmentPlan.nextDueDate': 1, status: 1 });

export default mongoose.model('Order', orderSchema);
