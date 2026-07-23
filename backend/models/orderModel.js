import mongoose from 'mongoose';

const orderItemSelectedAttributeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    value: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
    selectedAttributes: { type: [orderItemSelectedAttributeSchema], default: [] },
    snapshot: {
      title: String,
      price: Number,
      basePrice: Number,
      image: String,
      shopName: String,
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      shopAddress: { type: String, default: '' },
      shopPhone: { type: String, default: '' },
      shopCity: { type: String, default: '' },
      shopCommune: { type: String, default: '' },
      wholesaleEnabled: { type: Boolean, default: false },
      wholesaleApplied: { type: Boolean, default: false },
      wholesaleTierMinQty: { type: Number, default: 0, min: 0 },
      wholesaleTierLabel: { type: String, default: '' },
      bundleApplied: { type: Boolean, default: false },
      bundleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle', default: null },
      bundleDiscountPercent: { type: Number, default: 0, min: 0 },
      groupBuyApplied: { type: Boolean, default: false },
      groupBuyId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupBuy', default: null },
      deliveryAvailable: { type: Boolean, default: true },
      pickupAvailable: { type: Boolean, default: true },
      deliveryFeeEnabled: { type: Boolean, default: true },
      deliveryFee: { type: Number, default: 0, min: 0 },
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
    paymentMethod: {
      type: String,
      enum: ['mobile_money', 'pawapay', ''],
      default: ''
    },
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

const deliveryProofImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    path: { type: String, trim: true, default: '' },
    originalName: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0, min: 0 },
    uploadedAt: { type: Date, default: null }
  },
  { _id: false }
);

const orderAdminNoteSchema = new mongoose.Schema(
  {
    note: { type: String, trim: true, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orderTimelineEventSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: 'system' },
    label: { type: String, trim: true, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now }
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
        'pending_payment',
        'paid',
        'ready_for_pickup',
        'picked_up_confirmed',
        'ready_for_delivery',
        'out_for_delivery',
        'delivery_proof_submitted',
        'confirmed_by_client',
        'pending',
        'pending_installment',
        'installment_active',
        'installment_paid',
        'overdue_installment',
        'dispute_opened',
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
    paymentMode: {
      type: String,
      enum: ['INSTALLMENT', 'STANDARD', 'FULL_PAYMENT'],
      default: 'STANDARD'
    },
    deliveryFeeWaived: { type: Boolean, default: false },
    deliveryFeeLocked: { type: Boolean, default: false },
    deliveryFeeWaiverReason: {
      type: String,
      enum: ['', 'FULL_PAYMENT'],
      default: ''
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID_FULL'],
      default: 'PENDING'
    },
    paymentCompletedAt: { type: Date, default: null },
    checkoutPromotionApplied: { type: Boolean, default: false },
    deliveryMode: {
      type: String,
      enum: ['PICKUP', 'DELIVERY'],
      default: 'DELIVERY'
    },
    platformDeliveryMode: {
      type: String,
      enum: ['NONE', 'SELLER_DELIVERY', 'PLATFORM_DELIVERY'],
      default: 'NONE'
    },
    platformDeliveryRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryRequest',
      default: null
    },
    platformDeliveryStatus: {
      type: String,
      enum: ['NONE', 'REQUESTED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'DELIVERED', 'CANCELED'],
      default: 'NONE'
    },
    platformDeliveryPriceSource: {
      type: String,
      enum: ['SHOP_FREE', 'ADMIN_RULE', 'SELLER', 'BUYER', 'FULL_PAYMENT_WAIVER', 'NONE'],
      default: 'NONE'
    },
    deliveryFeeSource: {
      type: String,
      enum: ['COMMUNE_FREE', 'COMMUNE_FIXED', 'SHOP_FREE', 'PRODUCT_FEE', 'FULL_PAYMENT_WAIVER', 'PICKUP'],
      default: 'PRODUCT_FEE'
    },
    installmentSaleStatus: {
      type: String,
      enum: [
        '',
        'confirmed',
        'ready_for_pickup',
        'delivering',
        'delivery_proof_submitted',
        'delivered',
        'picked_up_confirmed',
        'cancelled'
      ],
      default: ''
    },
    itemsSubtotal: { type: Number, default: 0, min: 0 },
    deliveryFeeTotal: { type: Number, default: 0, min: 0 },
    deliveryFeeUpdatedAt: { type: Date, default: null },
    deliveryFeeUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    discountTotal: { type: Number, default: 0, min: 0 },
    deliveryAddress: { type: String, required: true, trim: true },
    deliveryCity: { type: String, default: 'Brazzaville', trim: true },
    shippingAddressSnapshot: {
      cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null },
      cityName: { type: String, trim: true, default: '' },
      communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
      communeName: { type: String, trim: true, default: '' },
      addressLine: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' }
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
    paymentCheckoutId: { type: String, trim: true, default: '', index: true },
    paymentDepositId: { type: String, trim: true, default: '', index: true },
    paymentSource: {
      type: String,
      enum: ['mobile_money', 'pawapay', 'cod', ''],
      default: ''
    },
    confirmedAt: { type: Date },
    readyForPickupAt: { type: Date },
    outForDeliveryAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    completedAt: { type: Date },
    rewardPointsAwarded: { type: Boolean, default: false, index: true },
    deliveryDate: { type: Date },
    deliveryProofImages: { type: [deliveryProofImageSchema], default: [] },
    clientSignatureImage: { type: String, trim: true, default: '' },
    deliveryNote: { type: String, trim: true, default: '' },
    deliverySubmittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deliverySubmittedAt: { type: Date, default: null },
    clientDeliveryConfirmedAt: { type: Date, default: null },
    deliveryVerificationCodeHash: { type: String, trim: true, default: '' },
    deliveryStatus: {
      type: String,
      enum: ['not_submitted', 'submitted', 'verified'],
      default: 'not_submitted'
    },
    deliveryProofAttemptCount: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed', 'rejected', 'failed'],
      default: 'none'
    },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    refundRequestedAt: { type: Date, default: null },
    refundMethod: { type: String, enum: ['', 'mobile_money', 'pawapay'], default: '' },
    refundId: { type: String, trim: true, default: '', index: true },
    refundFailureReason: { type: String, trim: true, default: '' },
    refundProof: { type: String, trim: true, default: '' },
    refundTransactionNumber: { type: String, trim: true, default: '' },
    refundSenderName: { type: String, trim: true, default: '' },
    refundedAt: { type: Date, default: null },
    settlementStatus: {
      type: String,
      enum: ['none', 'held', 'waiting_account', 'ready', 'processing', 'paid', 'failed', 'blocked', 'cancelled'],
      default: 'none',
      index: true
    },
    settlementGrossAmount: { type: Number, default: 0, min: 0 },
    settlementCommissionAmount: { type: Number, default: 0, min: 0 },
    settlementNetAmount: { type: Number, default: 0, min: 0 },
    settlementReleaseAt: { type: Date, default: null },
    settlementPaidAt: { type: Date, default: null },
    settlementPayoutId: { type: String, trim: true, default: '' },
    settlementFailureReason: { type: String, trim: true, default: '' },
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
    cancellationWindowSkippedAt: { type: Date }, // When buyer confirms they won't cancel, allows seller to process immediately

    // Admin order command center fields (non-breaking extension)
    expectedDeliveryDate: { type: Date, default: null },
    delayStatus: {
      type: String,
      enum: ['on_time', 'delayed', 'resolved', 'overridden'],
      default: 'on_time'
    },
    delaySeverity: {
      type: String,
      enum: ['none', 'slight', 'moderate', 'critical'],
      default: 'none'
    },
    delayDetectedAt: { type: Date, default: null },
    delayDays: { type: Number, default: 0, min: 0 },
    delayOverride: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null },
      note: { type: String, trim: true, default: '' }
    },
    reviewRequested: { type: Boolean, default: false },
    reviewGiven: { type: Boolean, default: false },
    reviewStatus: {
      type: String,
      enum: ['PENDING', 'DONE', 'SKIPPED'],
      default: 'PENDING'
    },
    reviewReminderDisabled: { type: Boolean, default: false },
    reviewReminderSentAt: { type: Date, default: null },
    reviewCompletedAt: { type: Date, default: null },
    reviewReminderCount: { type: Number, default: 0, min: 0 },
    confirmationGiven: { type: Boolean, default: false },
    reminderSentCount: { type: Number, default: 0, min: 0 },
    lastReminderDate: { type: Date, default: null },
    reminderState: {
      sellerReminderSentAt: { type: Date, default: null },
      buyerConfirmationReminderSentAt: { type: Date, default: null },
      reviewReminderSentAt: { type: Date, default: null },
      experienceReminderSentAt: { type: Date, default: null },
      escalationReminderSentAt: { type: Date, default: null },
      delayReminderSentAt: { type: Date, default: null },
      manualReminderSentAt: { type: Date, default: null }
    },
    adminPriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW'
    },
    adminRiskScore: { type: Number, default: 0, min: 0, max: 100 },
    statusStuckSince: { type: Date, default: Date.now },
    adminNotes: { type: [orderAdminNoteSchema], default: [] },
    timeline: { type: [orderTimelineEventSchema], default: [] },

    // "Ask a friend to pay" — buyer designates another user to pay for this order.
    sponsoredPayment: {
      isSponsored: { type: Boolean, default: false },
      requestGroupId: { type: String, trim: true, default: '', index: true },
      requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      payerPhone: { type: String, trim: true, default: '' },
      message: { type: String, trim: true, default: '' },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled', 'self_paid'],
        default: 'pending'
      },
      attemptCount: { type: Number, default: 1, min: 1 },
      requestedAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'sponsoredPayment.payer': 1, 'sponsoredPayment.status': 1, createdAt: -1 });
orderSchema.index({ 'sponsoredPayment.requester': 1, 'sponsoredPayment.status': 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, isDraft: 1, createdAt: -1 });
orderSchema.index({ paymentType: 1, status: 1, createdAt: -1 });
orderSchema.index({ paymentMode: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ deliveryFeeLocked: 1, deliveryFeeWaived: 1, createdAt: -1 });
orderSchema.index({ deliveryMode: 1, deliveryFeeSource: 1, createdAt: -1 });
orderSchema.index({ platformDeliveryStatus: 1, updatedAt: -1 });
orderSchema.index({ platformDeliveryRequestId: 1 }, { sparse: true });
orderSchema.index({ 'shippingAddressSnapshot.cityId': 1, 'shippingAddressSnapshot.communeId': 1, createdAt: -1 });
orderSchema.index({ 'items.snapshot.shopId': 1, createdAt: -1, status: 1 });
orderSchema.index({ 'items.product': 1, createdAt: -1, status: 1 });
orderSchema.index({ 'installmentPlan.nextDueDate': 1, status: 1 });
orderSchema.index({ paymentTransactionCode: 1 });
orderSchema.index({ 'draftPayments.transactionCode': 1 });
orderSchema.index({ 'installmentPlan.schedule.transactionProof.transactionCode': 1 });
orderSchema.index({ deliveryStatus: 1, updatedAt: -1 });
orderSchema.index({ delayStatus: 1, delaySeverity: 1, updatedAt: -1 });
orderSchema.index({ expectedDeliveryDate: 1, status: 1 });
orderSchema.index({ adminPriority: 1, adminRiskScore: -1, updatedAt: -1 });
orderSchema.index({ statusStuckSince: 1, status: 1 });
orderSchema.index({ reviewGiven: 1, confirmationGiven: 1, deliveredAt: -1 });
orderSchema.index({ reviewStatus: 1, reviewReminderDisabled: 1, deliveredAt: -1 });

orderSchema.pre('save', function orderStatusTracking(next) {
  if (this.isModified('status')) {
    this.statusStuckSince = new Date();
  }
  if (!this.expectedDeliveryDate && this.deliveryDate) {
    this.expectedDeliveryDate = this.deliveryDate;
  }
  if (!this.confirmationGiven) {
    const status = String(this.status || '');
    if (['confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(status) || this.clientDeliveryConfirmedAt) {
      this.confirmationGiven = true;
    }
  }
  if (this.reviewGiven && this.reviewStatus !== 'DONE') {
    this.reviewStatus = 'DONE';
  }
  if (this.reviewStatus === 'DONE' && !this.reviewCompletedAt) {
    this.reviewCompletedAt = new Date();
  }
  // Finalize payment when order reaches a terminal status
  const finalStatuses = ['delivered', 'completed', 'confirmed_by_client', 'picked_up_confirmed'];
  if (this.isModified('status') && finalStatuses.includes(this.status)) {
    this.paidAmount = this.totalAmount || 0;
    this.remainingAmount = 0;
    this.paymentStatus = 'PAID_FULL';
    if (!this.paymentCompletedAt) {
      this.paymentCompletedAt = new Date();
    }
  }
  next();
});

export default mongoose.model('Order', orderSchema);
