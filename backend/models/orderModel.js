import mongoose from 'mongoose';
import Product from './productModel.js';
import Tag from './tagModel.js';

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
      countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null },
      currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
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
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF', index: true },
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
    pricingSnapshot: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
      countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null },
      productPrice: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      deliveryFee: { type: Number, default: 0, min: 0 },
      platformFee: { type: Number, default: 0, min: 0 },
      taxes: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
      configVersion: { type: Number, default: 1, min: 1 },
      capturedAt: { type: Date, default: null }
    },
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
    // Escrow is the source of truth for releasing online funds to the seller.
    // `deliveryMode` is kept for backwards compatibility while
    // `fulfillmentMethod` exposes the explicit vocabulary used by escrow.
    fulfillmentMethod: {
      type: String,
      enum: ['DELIVERY', 'STORE_PICKUP'],
      default: 'DELIVERY',
      index: true
    },
    escrowStatus: {
      type: String,
      enum: [
        'WAITING_PAYMENT',
        'IN_ESCROW',
        'DELIVERED',
        'WAITING_BUYER_CONFIRMATION',
        'ON_HOLD',
        'RELEASED',
        'REFUNDED'
      ],
      default: 'WAITING_PAYMENT',
      index: true
    },
    escrowAmount: { type: Number, default: 0, min: 0 },
    deliveryCompletedAt: { type: Date, default: null },
    sellerMarkedDeliveredAt: { type: Date, default: null },
    buyerConfirmedAt: { type: Date, default: null },
    autoReleaseAt: { type: Date, default: null, index: true },
    escrowReleasedAt: { type: Date, default: null },
    escrowReleaseReason: {
      type: String,
      enum: ['', 'BUYER_CONFIRMED', 'AUTO_RELEASE', 'ADMIN_RELEASE', 'DISPUTE_RESOLVED_SELLER'],
      default: ''
    },
    disputeOpened: { type: Boolean, default: false, index: true },
    disputeOpenedAt: { type: Date, default: null },
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
    quotationRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuotationRequest',
      default: null
    },
    quotationSnapshot: {
      applied: { type: Boolean, default: false },
      currency: { type: String, trim: true, default: '' },
      originalSubtotal: { type: Number, default: 0, min: 0 },
      quotedSubtotal: { type: Number, default: 0, min: 0 },
      savings: { type: Number, default: 0, min: 0 },
      sellerMessage: { type: String, trim: true, default: '' },
      acceptedAt: { type: Date, default: null }
    },
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
    },

    // Social Commerce Hub — which social channel/campaign/click drove this
    // order, if any. Additive and defaults to DIRECT so every existing order
    // creation path (web/app checkout with no social context) is unaffected.
    // Populated server-side only, by attributionService validating a
    // client-supplied socialClickId/socialInteractionId against real records
    // — never trusted from the client as a bare channel string.
    acquisition: {
      channel: {
        type: String,
        enum: [
          'DIRECT',
          'TIKTOK_WHATSAPP',
          'WHATSAPP',
          'INSTAGRAM_DM',
          'FACEBOOK_MESSENGER',
          'TIKTOK_MESSAGING'
        ],
        default: 'DIRECT'
      },
      socialInteractionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialInteraction', default: null },
      socialCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialCampaign', default: null },
      socialClickId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialClick', default: null },
      sourceProductCode: { type: String, trim: true, default: '' }
    }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ countryId: 1, status: 1, createdAt: -1 });
orderSchema.index({ countryId: 1, customer: 1, createdAt: -1 });
orderSchema.index(
  { quotationRequest: 1 },
  { unique: true, partialFilterExpression: { quotationRequest: { $type: 'objectId' } } }
);
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
orderSchema.index({ escrowStatus: 1, autoReleaseAt: 1, disputeOpened: 1 });

orderSchema.pre('validate', async function ensureCountryAndPricingSnapshot() {
  const productIds = (this.items || []).map((item) => item?.product).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('_id countryId currency price').lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const { ensureDefaultCountry } = await import('../services/countryService.js');
  const defaultCountry = await ensureDefaultCountry();
  const countryIds = new Set();
  const currencies = new Set();
  for (const item of this.items || []) {
    const product = productMap.get(String(item?.product || ''));
    const countryId = product?.countryId || item?.snapshot?.countryId || this.countryId || defaultCountry._id;
    const currency = String(product?.currency || item?.snapshot?.currency || this.currency || defaultCountry.currency.code).toUpperCase();
    countryIds.add(String(countryId));
    currencies.add(currency);
    if (item?.snapshot) {
      item.snapshot.countryId = countryId;
      item.snapshot.currency = currency;
    }
  }
  if (countryIds.size > 1) {
    const error = new Error('Une commande ne peut pas contenir des produits de plusieurs pays.');
    error.code = 'CROSS_BORDER_NOT_SUPPORTED';
    throw error;
  }
  if (currencies.size > 1) {
    const error = new Error('Une commande ne peut pas mélanger plusieurs devises.');
    error.code = 'CURRENCY_NOT_SUPPORTED';
    throw error;
  }
  this.countryId = this.countryId || [...countryIds][0] || defaultCountry._id;
  this.currency = this.currency || [...currencies][0] || defaultCountry.currency.code;
  if (!this.pricingSnapshot?.capturedAt) {
    const productPrice = (this.items || []).reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0);
    this.pricingSnapshot = {
      amount: Number(this.totalAmount || 0),
      currency: this.currency,
      countryId: this.countryId,
      productPrice,
      discount: Number(this.discountTotal || 0),
      deliveryFee: Number(this.deliveryFeeTotal || 0),
      platformFee: 0,
      taxes: 0,
      total: Number(this.totalAmount || 0),
      configVersion: 1,
      capturedAt: new Date()
    };
  }
});

orderSchema.pre('save', function orderStatusTracking(next) {
  this.$locals.wasNewOrder = this.isNew;
  if (this.isModified('status')) {
    this.statusStuckSince = new Date();
  }
  if (!this.expectedDeliveryDate && this.deliveryDate) {
    this.expectedDeliveryDate = this.deliveryDate;
  }
  this.fulfillmentMethod = this.deliveryMode === 'PICKUP' ? 'STORE_PICKUP' : 'DELIVERY';
  if (
    String(this.paymentSource || '').toLowerCase() === 'pawapay' &&
    Number(this.paidAmount || 0) > 0 &&
    this.escrowStatus === 'WAITING_PAYMENT'
  ) {
    this.escrowStatus = 'IN_ESCROW';
    this.escrowAmount = Number(this.paidAmount || 0);
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
  // Fulfilment must never invent a payment. Partial online payments (50/70%)
  // remain partial; only the amount already captured can enter escrow.
  if (this.isModified('paidAmount') || this.isModified('totalAmount')) {
    const paid = Math.max(0, Number(this.paidAmount || 0));
    const total = Math.max(0, Number(this.totalAmount || 0));
    this.remainingAmount = Math.max(0, total - paid);
    this.paymentStatus = paid <= 0 ? 'PENDING' : paid >= total ? 'PAID_FULL' : 'PARTIAL';
    if (paid >= total && total > 0 && !this.paymentCompletedAt) this.paymentCompletedAt = new Date();
  }
  next();
});

// A completed checkout is a tag conversion. Keep this close to the Order model
// so every order-creation path (standard, sponsored, installment, multi-seller)
// records the same analytics without duplicating controller logic.
orderSchema.post('save', async function recordTagConversions(doc, next) {
  if (!doc?.$locals?.wasNewOrder || doc.isDraft) return next();
  try {
    const productIds = Array.from(
      new Set((doc.items || []).map((item) => String(item?.product || '')).filter(mongoose.Types.ObjectId.isValid))
    );
    if (!productIds.length) return next();
    const products = await Product.find({ _id: { $in: productIds } }).select('tags').lean();
    const tagIds = Array.from(
      new Set(products.flatMap((product) => (product.tags || []).map(String)))
    ).filter(mongoose.Types.ObjectId.isValid);
    if (tagIds.length) {
      await Tag.updateMany(
        { _id: { $in: tagIds }, deletedAt: null },
        { $inc: { conversionCount: 1, popularityScore: 8 } }
      );
    }
    return next();
  } catch (error) {
    // Analytics must never prevent a checkout from completing.
    console.error('Tag conversion analytics error:', error);
    return next();
  }
});

export default mongoose.model('Order', orderSchema);
