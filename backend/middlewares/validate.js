import Joi from 'joi';

export const validate =
  (schema, property = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const firstMessage = error.details[0]?.message;
      return res.status(400).json({
        message: firstMessage || 'Validation error',
        details: error.details.map((d) => d.message),
      });
    }
    req[property] = value;
    next();
  };

const identifierPattern = Joi.string().pattern(/^[^/]+$/, 'identifiant produit');

export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(60).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    phone: Joi.string().min(5).max(30).required(),
    // Optional in production (email verification disabled)
    verificationCode: Joi.string().min(0).max(10).optional(),
    role: Joi.string().valid('user', 'admin', 'manager').optional(),
    accountType: Joi.string().valid('person').default('person'),
    address: Joi.string().min(4).max(200).required(),
    city: Joi.string().trim().min(2).max(80).required(),
    commune: Joi.string().trim().min(2).max(80).allow('', null),
    gender: Joi.string().valid('homme', 'femme').required(),
    country: Joi.string().valid('République du Congo').optional()
  }),
  registerSendCode: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().min(5).max(30)
  }).or('email', 'phone'),
  login: Joi.object({
    phone: Joi.string().min(5).max(30).required(),
    password: Joi.string().min(6).required(),
  }),
  passwordForgot: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().min(5).max(30)
  }).or('email', 'phone'),
  passwordReset: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().min(5).max(30),
    verificationCode: Joi.string().min(3).max(10).required(),
    newPassword: Joi.string().min(6).max(100).required()
  }).or('email', 'phone'),
  passwordForgotLink: Joi.object({
    email: Joi.string().email().required()
  }),
  passwordResetToken: Joi.object({
    token: Joi.string().min(10).required(),
    newPassword: Joi.string().min(6).max(100).required()
  }),
  passwordChange: Joi.object({
    verificationCode: Joi.string().min(3).max(10).required(),
    newPassword: Joi.string().min(6).max(100).required()
  }),
  passwordSendCode: Joi.object({}).max(0),
  productCreate: Joi.object({
    title: Joi.string().min(2).max(120).required(),
    description: Joi.string().min(5).max(5000).required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().min(2).max(60),
    categoryId: Joi.string().hex().length(24).allow('', null),
    subcategoryId: Joi.string().hex().length(24).allow('', null),
    condition: Joi.string().valid('new', 'used').default('used'),
    discount: Joi.number().min(0).max(99.99).default(0),
    installmentEnabled: Joi.boolean().truthy('true').falsy('false').optional(),
    installmentMinAmount: Joi.number().min(0).optional(),
    installmentDuration: Joi.number().integer().min(1).optional(),
    installmentStartDate: Joi.date().iso().optional().allow('', null),
    installmentEndDate: Joi.date().iso().optional().allow('', null),
    installmentLatePenaltyRate: Joi.number().min(0).max(100).optional(),
    installmentMaxMissedPayments: Joi.number().integer().min(1).max(12).optional(),
    installmentRequireGuarantor: Joi.boolean().truthy('true').falsy('false').optional(),
    wholesaleEnabled: Joi.boolean().truthy('true').falsy('false').optional(),
    wholesaleTiers: Joi.alternatives().try(
      Joi.string().allow('', null),
      Joi.array()
        .items(
          Joi.object({
            minQty: Joi.number().integer().min(1).required(),
            unitPrice: Joi.number().min(0).required(),
            label: Joi.string().max(60).allow('', null)
          })
        )
        .max(10)
    ).optional(),
    deliveryAvailable: Joi.boolean().truthy('true').falsy('false').optional(),
    pickupAvailable: Joi.boolean().truthy('true').falsy('false').optional(),
    deliveryFee: Joi.number().min(0).optional(),
    deliveryFeeEnabled: Joi.boolean().truthy('true').falsy('false').optional()
  }).or('category', 'categoryId', 'subcategoryId'),
  productUpdate: Joi.object({
    title: Joi.string().min(2).max(120),
    description: Joi.string().min(5).max(5000),
    price: Joi.number().min(0),
    category: Joi.string().min(2).max(60),
    categoryId: Joi.string().hex().length(24).allow('', null),
    subcategoryId: Joi.string().hex().length(24).allow('', null),
    condition: Joi.string().valid('new', 'used'),
    discount: Joi.number().min(0).max(99.99),
    installmentEnabled: Joi.boolean().truthy('true').falsy('false'),
    installmentMinAmount: Joi.number().min(0),
    installmentDuration: Joi.number().integer().min(1),
    installmentStartDate: Joi.date().iso().allow('', null),
    installmentEndDate: Joi.date().iso().allow('', null),
    installmentLatePenaltyRate: Joi.number().min(0).max(100),
    installmentMaxMissedPayments: Joi.number().integer().min(1).max(12),
    installmentRequireGuarantor: Joi.boolean().truthy('true').falsy('false'),
    wholesaleEnabled: Joi.boolean().truthy('true').falsy('false'),
    wholesaleTiers: Joi.alternatives().try(
      Joi.string().allow('', null),
      Joi.array()
        .items(
          Joi.object({
            minQty: Joi.number().integer().min(1).required(),
            unitPrice: Joi.number().min(0).required(),
            label: Joi.string().max(60).allow('', null)
          })
        )
        .max(10)
    ),
    deliveryAvailable: Joi.boolean().truthy('true').falsy('false'),
    pickupAvailable: Joi.boolean().truthy('true').falsy('false'),
    deliveryFee: Joi.number().min(0),
    deliveryFeeEnabled: Joi.boolean().truthy('true').falsy('false'),
    removeImages: Joi.array().items(Joi.string().max(500)).max(3).single(),
    removeVideo: Joi.boolean().truthy('true').falsy('false'),
    removePdf: Joi.boolean().truthy('true').falsy('false')
  }),
  commentCreate: Joi.object({
    productId: Joi.string().hex().length(24).optional(),
    message: Joi.string().min(1).max(500).required(),
    parentId: Joi.string().hex().length(24).optional(),
    parentReadIds: Joi.array().items(Joi.string().hex().length(24)).optional()
  }),
  ratingUpsert: Joi.object({
    value: Joi.number().integer().min(1).max(5).required(),
    productId: Joi.string().hex().length(24).optional()
  }),
  shopReviewUpsert: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).allow('', null)
  }),
  cartAdd: Joi.object({
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).default(1),
  }),
  cartUpdate: Joi.object({
    quantity: Joi.number().integer().min(0).required(),
  }),
  profileUpdate: Joi.object({
    name: Joi.string().min(2).max(60),
    email: Joi.string().email(),
    phone: Joi.string().min(5).max(30),
    profileImage: Joi.string().trim().max(1000).allow('', null),
    accountType: Joi.string().valid('person', 'shop'),
    shopName: Joi.string().min(2).max(120),
    shopAddress: Joi.string().min(4).max(200),
    shopDescription: Joi.string().min(10).max(1000),
    shopHours: Joi.string().allow('', null),
    freeDeliveryEnabled: Joi.boolean().truthy('true').falsy('false'),
    freeDeliveryNote: Joi.string().max(300).allow('', null),
    address: Joi.string().min(4).max(200),
    city: Joi.string().trim().min(2).max(80),
    commune: Joi.string().trim().min(2).max(80).allow('', null),
    gender: Joi.string().valid('homme', 'femme')
  }).min(0),
  shopLocationUpdate: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(50000).allow(null),
    source: Joi.string().valid('gps', 'map', 'manual').default('manual'),
    resolvedAddress: Joi.string().max(220).allow('', null),
    applyResolvedAddress: Joi.boolean().truthy('true').falsy('false').default(false)
  }),
  profileLocationUpdate: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(50000).allow(null)
  }),
  favoriteModify: Joi.object({
    productId: Joi.string().hex().length(24).required()
  }),
  prohibitedWordCreate: Joi.object({
    word: Joi.string().min(2).max(50).required()
  }),
  complaintCreate: Joi.object({
    subject: Joi.string().max(150).allow('', null),
    message: Joi.string().min(5).max(1500).required()
  }),
  disputeCreate: Joi.object({
    orderId: Joi.string().hex().length(24).required(),
    reason: Joi.string().valid('wrong_item', 'damaged_item', 'not_received', 'other').required(),
    description: Joi.string().min(10).max(2000).required()
  }),
  disputeSellerResponse: Joi.object({
    sellerResponse: Joi.string().max(2000).allow('', null)
  }),
  disputeAdminDecision: Joi.object({
    resolutionType: Joi.string().valid('refund_full', 'refund_partial', 'compensation', 'reject').required(),
    favor: Joi.string().valid('client', 'seller').allow('', null),
    adminDecision: Joi.string().min(5).max(2000).required()
  }),
  feedbackCreate: Joi.object({
    subject: Joi.string().min(3).max(150).required(),
    body: Joi.string().min(10).max(2000).required()
  }),
  paymentCreate: Joi.object({
    productId: Joi.string().hex().length(24).required(),
    promoCode: Joi.string().trim().uppercase().max(40).allow('', null),
    payerName: Joi.string().min(2).max(120).allow('', null),
    transactionNumber: Joi.string()
      .pattern(/^\d{10}$/)
      .allow('', null)
      .messages({ 'string.pattern.base': 'Le numéro de transaction doit contenir exactement 10 chiffres.' }),
    amount: Joi.number().min(0).default(0),
    operator: Joi.string().valid('MTN', 'Airtel', 'Orange', 'Moov', 'Other').allow('', null),
  }),
  transactionCodeVerify: Joi.object({
    transactionCode: Joi.string()
      .pattern(/^\d{10}$/)
      .required()
      .messages({ 'string.pattern.base': 'Le code de transaction doit contenir exactement 10 chiffres.' })
  }),
  promoCodeValidate: Joi.object({
    productId: Joi.string().hex().length(24).required(),
    code: Joi.string().trim().uppercase().min(3).max(40).required()
  }),
  promoCodeCreate: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(40).optional().allow('', null),
    autoGenerate: Joi.boolean().default(false),
    codePrefix: Joi.string().trim().uppercase().max(8).allow('', null),
    codeLength: Joi.number().integer().min(4).max(16).default(8),
    discountType: Joi.string().valid('percentage', 'full_waiver').required(),
    discountValue: Joi.number().min(0).max(100).required(),
    usageLimit: Joi.number().integer().min(1).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().allow('', null),
    isActive: Joi.boolean().default(true),
    referralTag: Joi.string().trim().max(80).allow('', null),
    isFlashPromo: Joi.boolean().default(false),
    flashDurationHours: Joi.number().integer().min(1).max(720).allow(null)
  }),
  promoCodeUpdate: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(40),
    discountType: Joi.string().valid('percentage', 'full_waiver'),
    discountValue: Joi.number().min(0).max(100),
    usageLimit: Joi.number().integer().min(1),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().allow('', null),
    isActive: Joi.boolean(),
    referralTag: Joi.string().trim().max(80).allow('', null),
    isFlashPromo: Joi.boolean(),
    flashDurationHours: Joi.number().integer().min(1).max(720).allow(null)
  }).min(1),
  promoCodeToggle: Joi.object({
    isActive: Joi.boolean().required()
  }),
  promoCodeGenerate: Joi.object({
    prefix: Joi.string().trim().uppercase().max(8).allow('', null),
    length: Joi.number().integer().min(4).max(16).default(8)
  }),
  promoCommissionPreview: Joi.object({
    code: Joi.string().trim().uppercase().max(40).allow('', null),
    productPrice: Joi.number().min(0).required()
  }),
  marketplacePromoCreate: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(40).required(),
    appliesTo: Joi.string().valid('boutique', 'product').required(),
    productId: Joi.string().hex().length(24).allow('', null),
    discountType: Joi.string().valid('percentage', 'fixed').required(),
    discountValue: Joi.number().positive().required(),
    usageLimit: Joi.number().integer().min(1).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    isActive: Joi.boolean().default(true)
  }),
  marketplacePromoUpdate: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(40),
    appliesTo: Joi.string().valid('boutique', 'product'),
    productId: Joi.string().hex().length(24).allow('', null),
    discountType: Joi.string().valid('percentage', 'fixed'),
    discountValue: Joi.number().positive(),
    usageLimit: Joi.number().integer().min(1),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    isActive: Joi.boolean()
  }).min(1),
  marketplacePromoToggle: Joi.object({
    isActive: Joi.boolean().required()
  }),
  marketplacePromoPreview: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(40).required(),
    productId: Joi.string().hex().length(24),
    quantity: Joi.number().integer().min(1).default(1),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().hex().length(24).required(),
          quantity: Joi.number().integer().min(1).default(1)
        })
      )
      .min(1)
  })
    .or('productId', 'items')
    .required(),
  boostPricingPreview: Joi.object({
    boostType: Joi.string()
      .valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED')
      .required(),
    duration: Joi.number().integer().min(1).max(365).default(1),
    city: Joi.string().trim().min(2).max(80).allow('', null),
    productIds: Joi.alternatives().try(
      Joi.array().items(Joi.string().hex().length(24)).max(100),
      Joi.string().allow('', null)
    )
  }),
  boostRequestCreate: Joi.object({
    boostType: Joi.string()
      .valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED')
      .required(),
    productIds: Joi.alternatives().try(
      Joi.array().items(Joi.string().hex().length(24)).max(100),
      Joi.string().allow('', null)
    ),
    city: Joi.string().trim().min(2).max(80).allow('', null),
    duration: Joi.number().integer().min(1).max(365).default(1),
    paymentOperator: Joi.string().trim().min(2).max(40).required(),
    paymentSenderName: Joi.string().trim().min(2).max(120).required(),
    paymentTransactionId: Joi.string()
      .pattern(/^\d{10}$/)
      .required()
      .messages({ 'string.pattern.base': 'L’ID de transaction doit contenir exactement 10 chiffres.' })
  }),
  boostRequestListQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED').allow('', null)
  }),
  boostTrackImpressions: Joi.object({
    requestIds: Joi.array().items(Joi.string().hex().length(24)).min(1).max(100).required()
  }),
  adminBoostPricingUpsert: Joi.object({
    type: Joi.string()
      .valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED')
      .required(),
    city: Joi.string().trim().min(2).max(80).allow('', null),
    basePrice: Joi.number().min(0).required(),
    priceType: Joi.string().valid('per_day', 'per_week', 'fixed').required(),
    multiplier: Joi.number().positive().default(1),
    isActive: Joi.boolean().default(true)
  }),
  adminBoostPricingUpdate: Joi.object({
    type: Joi.string().valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED'),
    city: Joi.string().trim().min(2).max(80).allow('', null),
    basePrice: Joi.number().min(0),
    priceType: Joi.string().valid('per_day', 'per_week', 'fixed'),
    multiplier: Joi.number().positive(),
    isActive: Joi.boolean()
  }).min(1),
  adminSeasonalPricingCreate: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    multiplier: Joi.number().positive().required(),
    isActive: Joi.boolean().default(true),
    appliesTo: Joi.array()
      .items(Joi.string().valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED'))
      .default([])
  }),
  adminSeasonalPricingUpdate: Joi.object({
    name: Joi.string().trim().min(2).max(120),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    multiplier: Joi.number().positive(),
    isActive: Joi.boolean(),
    appliesTo: Joi.array().items(
      Joi.string().valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED')
    )
  }).min(1),
  adminBoostRequestListQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED').allow('', null),
    boostType: Joi.string()
      .valid('PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'SHOP_BOOST', 'HOMEPAGE_FEATURED')
      .allow('', null),
    city: Joi.string().trim().min(2).max(80).allow('', null),
    sellerId: Joi.string().hex().length(24).allow('', null)
  }),
  adminBoostRequestStatusUpdate: Joi.object({
    status: Joi.string().valid('APPROVED', 'ACTIVE', 'REJECTED', 'EXPIRED').required(),
    startDate: Joi.date().iso().allow('', null),
    endDate: Joi.date().iso().allow('', null),
    rejectionReason: Joi.string().max(500).allow('', null)
  }),
  publicQuery: Joi.object({
    q: Joi.string().allow(''),
    category: Joi.string().allow(''),
    city: Joi.string().trim().min(2).max(80),
    userCity: Joi.string().trim().min(2).max(80),
    locationPriority: Joi.boolean().truthy('true').falsy('false'),
    nearMe: Joi.boolean().truthy('true').falsy('false'),
    certified: Joi.boolean().truthy('true').falsy('false'),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    sort: Joi.string()
      .valid('new', 'newest', 'price_asc', 'price_desc', 'discount', 'popular')
      .default('new'),
    shopVerified: Joi.string().valid('true', 'false').allow(''),
    installmentOnly: Joi.boolean().truthy('true').falsy('false'),
    wholesaleOnly: Joi.boolean().truthy('true').falsy('false'),
    pickupOnly: Joi.boolean().truthy('true').falsy('false'),
    freeDeliveryOnly: Joi.boolean().truthy('true').falsy('false'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
  }),
  sellerAnalyticsQuery: Joi.object({
    dateFrom: Joi.date().iso().allow('', null),
    dateTo: Joi.date().iso().allow('', null),
    timezone: Joi.string().trim().max(64).allow('', null)
  }),
  idParam: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  installmentScheduleParam: Joi.object({
    id: Joi.string().hex().length(24).required(),
    scheduleIndex: Joi.number().integer().min(0).required()
  }),
  restrictionParam: Joi.object({
    id: Joi.string().hex().length(24).required(),
    type: Joi.string()
      .valid('canComment', 'canOrder', 'canMessage', 'canAddFavorites', 'canUploadImages', 'canBeViewed')
      .required()
  }),
  slugParam: Joi.object({
    id: Joi.string()
      .lowercase()
      .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .required()
  }),
  identifierParam: Joi.object({
    id: Joi.alternatives().try(Joi.string().hex().length(24), identifierPattern).required()
  }),
  adminUserAccountType: Joi.object({
    accountType: Joi.string().valid('person', 'shop').required(),
    shopName: Joi.when('accountType', {
      is: 'shop',
      then: Joi.string().trim().min(2).max(120).optional(),
      otherwise: Joi.forbidden()
    }),
    shopAddress: Joi.when('accountType', {
      is: 'shop',
      then: Joi.string().trim().min(4).max(200).optional(),
      otherwise: Joi.forbidden()
    }),
    shopLogo: Joi.string().max(500).allow('', null)
  }),
  adminBlockUser: Joi.object({
    reason: Joi.string().trim().max(500).allow('', null)
  }),
  adminShopVerification: Joi.object({
    verified: Joi.boolean().required()
  }),
  adminShopLocationReview: Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.when('decision', {
      is: 'reject',
      then: Joi.string().trim().min(3).max(500).required(),
      otherwise: Joi.string().trim().max(500).allow('', null)
    })
  }),
  adminProductCertification: Joi.object({
    certified: Joi.boolean().required()
  }),
  orderCreate: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().hex().length(24).required(),
          quantity: Joi.number().integer().min(1).default(1)
        })
      )
      .min(1)
      .required(),
    customerId: Joi.string().hex().length(24).required(),
    deliveryAddress: Joi.string().min(4).max(300).required(),
    deliveryCity: Joi.string().trim().min(2).max(80).required(),
    trackingNote: Joi.string().max(500).allow('', null)
  }),
  orderInquiry: Joi.object({
    productId: Joi.string().hex().length(24).required()
  }),
  orderCheckout: Joi.alternatives()
    .try(
      Joi.object({
        deliveryMode: Joi.string().valid('PICKUP', 'DELIVERY').default('PICKUP'),
        shippingAddress: Joi.object({
          cityId: Joi.string().hex().length(24).allow('', null),
          communeId: Joi.string().hex().length(24).allow('', null),
          addressLine: Joi.string().max(250).allow('', null),
          phone: Joi.string().trim().min(5).max(30).allow('', null)
        }).allow(null),
        payments: Joi.array()
          .items(
            Joi.object({
              sellerId: Joi.string().hex().length(24).required(),
              payerName: Joi.string().min(2).max(120).required(),
              transactionCode: Joi.string()
                .pattern(/^\d{10}$/)
                .required()
                .messages({ 'string.pattern.base': 'Le code de transaction doit contenir exactement 10 chiffres.' }),
              promoCode: Joi.string().trim().uppercase().min(3).max(40).allow('', null)
            })
          )
          .min(1)
          .required()
      }),
      Joi.object({
        deliveryMode: Joi.string().valid('PICKUP', 'DELIVERY').default('PICKUP'),
        shippingAddress: Joi.object({
          cityId: Joi.string().hex().length(24).allow('', null),
          communeId: Joi.string().hex().length(24).allow('', null),
          addressLine: Joi.string().max(250).allow('', null),
          phone: Joi.string().trim().min(5).max(30).allow('', null)
        }).allow(null),
        payerName: Joi.string().min(2).max(120).required(),
        transactionCode: Joi.string()
          .pattern(/^\d{10}$/)
          .required()
          .messages({ 'string.pattern.base': 'Le code de transaction doit contenir exactement 10 chiffres.' }),
        promoCode: Joi.string().trim().uppercase().min(3).max(40).allow('', null)
      })
    )
    .required(),
  installmentCheckout: Joi.object({
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).default(1),
    firstPaymentAmount: Joi.number().positive().required(),
    payerName: Joi.string().min(2).max(120).required(),
    transactionCode: Joi.string()
      .pattern(/^\d{10}$/)
      .required()
      .messages({ 'string.pattern.base': 'Le code de transaction doit contenir exactement 10 chiffres.' }),
    guarantor: Joi.alternatives()
      .try(
        Joi.object({
          fullName: Joi.string().max(120).allow('', null),
          phone: Joi.string().max(30).allow('', null),
          relation: Joi.string().max(120).allow('', null),
          nationalId: Joi.string().max(120).allow('', null),
          address: Joi.string().max(250).allow('', null)
        }),
        Joi.string().max(2000)
      )
      .optional()
  }),
  installmentPaymentProofSubmit: Joi.object({
    payerName: Joi.string().min(2).max(120).required(),
    transactionCode: Joi.string()
      .pattern(/^\d{10}$/)
      .required()
      .messages({ 'string.pattern.base': 'Le code de transaction doit contenir exactement 10 chiffres.' }),
    amount: Joi.number().positive().required()
  }),
  installmentSaleConfirmation: Joi.object({
    approve: Joi.boolean().required()
  }),
  installmentPaymentValidation: Joi.object({
    approve: Joi.boolean().required(),
    note: Joi.string().max(500).allow('', null)
  }),
  deliveryProofSubmit: Joi.object({
    clientSignatureImage: Joi.string().max(2000000).required(),
    deliveryNote: Joi.string().max(1000).allow('', null),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).allow(null),
      longitude: Joi.number().min(-180).max(180).allow(null),
      accuracy: Joi.number().min(0).allow(null)
    }).allow(null),
    locationLatitude: Joi.number().min(-90).max(90).allow(null),
    locationLongitude: Joi.number().min(-180).max(180).allow(null),
    locationAccuracy: Joi.number().min(0).allow(null)
  }),
  deliveryConfirm: Joi.object({
    confirm: Joi.boolean().default(true)
  }),
  orderRequestDelivery: Joi.object({
    note: Joi.string().trim().max(1000).allow('', null),
    pickupInstructions: Joi.string().trim().max(1000).allow('', null),
    invoiceUrl: Joi.string().uri().max(1000).allow('', null),
    deliveryPrice: Joi.number().min(0).allow(null),
    resubmit: Joi.boolean().default(false),
    pickup: Joi.object({
      cityId: Joi.string().hex().length(24).allow('', null),
      communeId: Joi.string().hex().length(24).allow('', null),
      cityName: Joi.string().trim().max(120).allow('', null),
      communeName: Joi.string().trim().max(120).allow('', null),
      address: Joi.string().trim().max(300).allow('', null)
    }).allow(null)
  }),
  sellerDeliveryPinUpdate: Joi.object({
    action: Joi.string().valid('generate', 'set', 'clear').allow('', null),
    enabled: Joi.boolean().optional(),
    generate: Joi.boolean().optional(),
    deliveryPinCode: Joi.string()
      .trim()
      .pattern(/^\d{4,8}$/)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Le code de livraison doit contenir entre 4 et 8 chiffres.'
      }),
    code: Joi.string()
      .trim()
      .pattern(/^\d{4,8}$/)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Le code de livraison doit contenir entre 4 et 8 chiffres.'
      }),
    expiresHours: Joi.number().integer().min(1).max(168).allow(null)
  }),
  orderStatusUpdate: Joi.object({
    status: Joi.string()
      .valid(
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
        'overdue_installment',
        'dispute_opened',
        'confirmed',
        'delivering',
        'delivered',
        'completed',
        'cancelled'
      )
      .required()
  }),
  orderAddressUpdate: Joi.object({
    deliveryAddress: Joi.string().min(4).max(300).required(),
    deliveryCity: Joi.string().trim().min(2).max(80).required()
  }),
  orderMessageUpdate: Joi.object({
    text: Joi.string().trim().min(0).max(1000).required().messages({
      'any.required': 'Le texte du message est requis.'
    })
  }),
  orderMessage: Joi.object({
    text: Joi.string().trim().min(0).max(1000).allow('', null).optional(),
    recipientId: Joi.any().optional().allow(null, ''),
    encryptedText: Joi.string().allow('', null).optional(),
    encryptionData: Joi.object({
      iv: Joi.string(),
      tag: Joi.string(),
      salt: Joi.string(),
      key: Joi.string()
    }).allow(null).optional(),
    attachments: Joi.array().items(Joi.object({
      type: Joi.string().valid('image', 'document', 'audio'),
      url: Joi.string(),
      filename: Joi.string(),
      size: Joi.number(),
      mimeType: Joi.string()
    }).unknown(true)).optional().allow(null),
    voiceMessage: Joi.object({
      url: Joi.string(),
      duration: Joi.number(),
      type: Joi.string()
    }).unknown(true).allow(null).optional()
  }).optional(),
  sellerOrderStatusUpdate: Joi.object({
    status: Joi.string()
      .valid(
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
        'overdue_installment',
        'dispute_opened',
        'confirmed',
        'delivering',
        'delivered',
        'completed',
        'cancelled'
      )
      .required()
  }),
  sellerCancelOrder: Joi.object({
    reason: Joi.string().trim().min(5).max(500).required().messages({
      'string.empty': 'La raison de l\'annulation est requise.',
      'string.min': 'La raison de l\'annulation doit contenir au moins 5 caractères.',
      'any.required': 'La raison de l\'annulation est requise.'
    }),
    issueRefund: Joi.boolean().default(false)
  }),
  sellerDeliveryFeeUpdate: Joi.object({
    deliveryFeeTotal: Joi.number().min(0).required()
  }),
  orderUpdate: Joi.object({
    status: Joi.string().valid(
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
      'overdue_installment',
      'dispute_opened',
      'confirmed',
      'delivering',
      'delivered',
      'completed',
      'cancelled'
    ),
    deliveryAddress: Joi.string().min(4).max(300),
    deliveryCity: Joi.string().trim().min(2).max(80),
    trackingNote: Joi.string().max(500).allow('', null),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null),
    cancellationReason: Joi.string().max(500).allow('', null)
  }).min(1),
  deliveryGuyCreate: Joi.object({
    userId: Joi.string().hex().length(24).allow('', null),
    fullName: Joi.string().min(2).max(120),
    name: Joi.string().min(2).max(120),
    photoUrl: Joi.string().trim().max(1000).allow('', null),
    phone: Joi.string().max(30).allow('', null),
    cityId: Joi.string().hex().length(24).allow('', null),
    communes: Joi.array().items(Joi.string().hex().length(24)).max(50).default([]),
    isActive: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    vehicleType: Joi.string().valid('bike', 'motorcycle', 'car', 'van', 'truck', 'other', '').optional(),
    notes: Joi.string().max(500).allow('', null)
  }),
  deliveryGuyUpdate: Joi.object({
    userId: Joi.string().hex().length(24).allow('', null),
    fullName: Joi.string().min(2).max(120),
    name: Joi.string().min(2).max(120),
    photoUrl: Joi.string().trim().max(1000).allow('', null),
    phone: Joi.string().max(30).allow('', null),
    cityId: Joi.string().hex().length(24).allow('', null),
    communes: Joi.array().items(Joi.string().hex().length(24)).max(50),
    isActive: Joi.boolean(),
    active: Joi.boolean(),
    vehicleType: Joi.string().valid('bike', 'motorcycle', 'car', 'van', 'truck', 'other', ''),
    notes: Joi.string().max(500).allow('', null)
  }).min(1),
  adminDeliveryRequestsListQuery: Joi.object({
    status: Joi.string().trim().max(40).allow('', null),
    pickupCommune: Joi.string().trim().allow('', null),
    dropoffCommune: Joi.string().trim().allow('', null),
    city: Joi.string().trim().allow('', null),
    dateFrom: Joi.date().iso().allow('', null),
    dateTo: Joi.date().iso().allow('', null),
    shop: Joi.string().trim().allow('', null),
    priceMin: Joi.number().min(0).allow('', null),
    priceMax: Joi.number().min(0).allow('', null),
    page: Joi.number().integer().min(1).max(100000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),
  adminDeliveryRequestAccept: Joi.object({
    deliveryGuyId: Joi.string().hex().length(24).allow('', null)
  }),
  adminDeliveryRequestReject: Joi.object({
    reason: Joi.string().trim().min(2).max(1000).required()
  }),
  adminDeliveryRequestAssign: Joi.object({
    deliveryGuyId: Joi.string().hex().length(24).required()
  }),
  adminDeliveryRequestUnassign: Joi.object({
    reason: Joi.string().trim().max(1000).allow('', null)
  }),
  adminDeliveryRequestPriceUpdate: Joi.object({
    deliveryPrice: Joi.number().min(0).required(),
    reason: Joi.string().trim().max(500).allow('', null)
  }),
  adminDeliveryRequestCoordinates: Joi.object({
    pickup: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required()
    }).optional(),
    dropoff: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required()
    }).optional()
  }).min(1),
  courierAssignmentsListQuery: Joi.object({
    status: Joi.string().trim().max(40).allow('', null),
    date: Joi.string().valid('today', 'all', '').allow(null),
    pickupCommune: Joi.string().trim().allow('', null),
    dropoffCommune: Joi.string().trim().allow('', null),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null),
    page: Joi.number().integer().min(1).max(100000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),
  courierAssignmentReject: Joi.object({
    reason: Joi.string().trim().min(2).max(1000).required(),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null)
  }),
  courierAssignmentStage: Joi.object({
    stage: Joi.string()
      .valid(
        'ASSIGNED',
        'ACCEPTED',
        'PICKUP_STARTED',
        'PICKED_UP',
        'IN_TRANSIT',
        'ARRIVED',
        'DELIVERED',
        'FAILED'
      )
      .required(),
    note: Joi.string().trim().max(1000).allow('', null),
    reason: Joi.string().trim().max(1000).allow('', null),
    deliveryPinCode: Joi.string().trim().max(12).allow('', null),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null)
  }),
  courierAssignmentProof: Joi.object({
    proofType: Joi.string().valid('pickup', 'delivery').required(),
    note: Joi.string().trim().max(1000).allow('', null),
    signatureUrl: Joi.string().trim().uri().allow('', null),
    deliveryPinCode: Joi.string().trim().max(12).allow('', null),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null)
  }),
  deliveryLocationPing: Joi.object({
    jobId: Joi.string().hex().length(24).allow('', null),
    assignmentId: Joi.string().hex().length(24).allow('', null),
    deliveryRequestId: Joi.string().hex().length(24).allow('', null),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }).or('jobId', 'assignmentId', 'deliveryRequestId'),
  adminUserRole: Joi.object({
    role: Joi.string().valid('user', 'manager', 'delivery_agent').required()
  }),
  adminPromoteDeliveryGuy: Joi.object({
    fullName: Joi.string().trim().min(2).max(120).allow('', null),
    phone: Joi.string().trim().min(5).max(40).allow('', null),
    cityId: Joi.string().hex().length(24).allow('', null),
    communes: Joi.array().items(Joi.string().hex().length(24)).max(50),
    isActive: Joi.boolean(),
    active: Joi.boolean(),
    vehicleType: Joi.string()
      .valid('bike', 'motorcycle', 'car', 'van', 'truck', 'other', '')
      .allow('', null),
    notes: Joi.string().trim().max(500).allow('', null)
  }),
  adminDirectPasswordUpdate: Joi.object({
    newPassword: Joi.string().min(6).max(100).required(),
    forceLogout: Joi.boolean().default(true)
  }),
  complaintStatusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'in_review', 'resolved').required(),
    note: Joi.string().max(500).allow('', null)
  }),
  reportCreate: Joi.object({
    type: Joi.string().valid('comment', 'photo').required(),
    commentId: Joi.string().hex().length(24).when('type', {
      is: 'comment',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, '')
    }),
    productId: Joi.string().hex().length(24).required(),
    photoUrl: Joi.string().max(500).when('type', {
      is: 'photo',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, '')
    }),
    reason: Joi.string().max(500).allow('', null)
  }),
  reportStatusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'reviewed', 'resolved', 'dismissed').required(),
    adminNote: Joi.string().max(1000).allow('', null)
  }),
  notificationPreferencesUpdate: Joi.object({
    product_comment: Joi.boolean(),
    reply: Joi.boolean(),
    favorite: Joi.boolean(),
    rating: Joi.boolean(),
    product_approval: Joi.boolean(),
    product_rejection: Joi.boolean(),
    product_boosted: Joi.boolean(),
    promotional: Joi.boolean(),
    shop_review: Joi.boolean(),
    shop_follow: Joi.boolean(),
    payment_pending: Joi.boolean(),
    order_created: Joi.boolean(),
    order_received: Joi.boolean(),
    order_reminder: Joi.boolean(),
    delivery_request_created: Joi.boolean(),
    delivery_request_accepted: Joi.boolean(),
    delivery_request_rejected: Joi.boolean(),
    delivery_request_assigned: Joi.boolean(),
    delivery_request_in_progress: Joi.boolean(),
    delivery_request_delivered: Joi.boolean(),
    order_delivering: Joi.boolean(),
    order_delivered: Joi.boolean(),
    installment_due_reminder: Joi.boolean(),
    installment_overdue_warning: Joi.boolean(),
    installment_payment_submitted: Joi.boolean(),
    installment_payment_validated: Joi.boolean(),
    installment_sale_confirmation_required: Joi.boolean(),
    installment_sale_confirmed: Joi.boolean(),
    installment_completed: Joi.boolean(),
    installment_product_suspended: Joi.boolean(),
    review_reminder: Joi.boolean(),
    order_address_updated: Joi.boolean(),
    order_message: Joi.boolean(),
    order_cancelled: Joi.boolean(),
    dispute_created: Joi.boolean(),
    dispute_seller_responded: Joi.boolean(),
    dispute_deadline_near: Joi.boolean(),
    dispute_under_review: Joi.boolean(),
    dispute_resolved: Joi.boolean(),
    complaint_created: Joi.boolean(),
    improvement_feedback_created: Joi.boolean(),
    admin_broadcast: Joi.boolean(),
    feedback_read: Joi.boolean(),
    account_restriction: Joi.boolean(),
    account_restriction_lifted: Joi.boolean(),
    shop_conversion_approved: Joi.boolean(),
    shop_conversion_rejected: Joi.boolean()
  }).min(1),
  userPreferencesUpdate: Joi.object({
    preferredLanguage: Joi.string().trim().min(2).max(10),
    preferredCurrency: Joi.string().trim().uppercase().min(2).max(8),
    preferredCity: Joi.string().trim().min(2).max(80).allow('', null),
    theme: Joi.string().valid('light', 'dark', 'system')
  }).min(1),
  adminSettingKeyParam: Joi.object({
    key: Joi.string()
      .valid(
        'commissionRate',
        'boostEnabled',
        'installmentMinPercent',
        'installmentMaxDuration',
        'shopConversionAmount',
        'analyticsViewWeight',
        'analyticsConversionWeight',
        'analyticsRevenueWeight',
        'analyticsRefundPenalty',
        'disputeWindowHours',
        'deliveryOTPExpirationMinutes',
        'maxDisputesPerMonth',
        'maxUploadImages'
      )
      .required()
  }),
  adminSettingUpdate: Joi.object({
    value: Joi.alternatives()
      .try(Joi.number(), Joi.boolean(), Joi.string(), Joi.array(), Joi.object())
      .required(),
    description: Joi.string().max(300).allow('', null)
  }),
  adminCurrencyCodeParam: Joi.object({
    code: Joi.string().trim().uppercase().min(2).max(8).required()
  }),
  adminCurrencyCreate: Joi.object({
    code: Joi.string().trim().uppercase().min(2).max(8).required(),
    symbol: Joi.string().trim().min(1).max(8).required(),
    name: Joi.string().trim().min(2).max(80).required(),
    decimals: Joi.number().integer().min(0).max(8).default(0),
    isDefault: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
    exchangeRateToDefault: Joi.number().positive().default(1),
    formatting: Joi.object({
      symbolPosition: Joi.string().valid('prefix', 'suffix').default('suffix'),
      thousandSeparator: Joi.string().max(2).default(' '),
      decimalSeparator: Joi.string().max(2).default(',')
    }).default(() => ({
      symbolPosition: 'suffix',
      thousandSeparator: ' ',
      decimalSeparator: ','
    }))
  }),
  adminCurrencyUpdate: Joi.object({
    symbol: Joi.string().trim().min(1).max(8),
    name: Joi.string().trim().min(2).max(80),
    decimals: Joi.number().integer().min(0).max(8),
    isDefault: Joi.boolean(),
    isActive: Joi.boolean(),
    exchangeRateToDefault: Joi.number().positive(),
    formatting: Joi.object({
      symbolPosition: Joi.string().valid('prefix', 'suffix'),
      thousandSeparator: Joi.string().max(2),
      decimalSeparator: Joi.string().max(2)
    })
  }).min(1),
  adminLanguagesUpdate: Joi.object({
    languages: Joi.array()
      .items(
        Joi.object({
          code: Joi.string().trim().lowercase().min(2).max(10).required(),
          name: Joi.string().trim().min(2).max(80).required(),
          isActive: Joi.boolean().default(true)
        })
      )
      .min(1)
      .required(),
    defaultLanguage: Joi.string().trim().lowercase().min(2).max(10).allow('', null)
  }),
  adminCityCreate: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    isActive: Joi.boolean().default(true),
    isDefault: Joi.boolean().default(false),
    order: Joi.number().integer().min(0).default(0),
    deliveryAvailable: Joi.boolean().default(true),
    boostMultiplier: Joi.number().positive().default(1)
  }),
  adminCityUpdate: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    isActive: Joi.boolean(),
    isDefault: Joi.boolean(),
    order: Joi.number().integer().min(0),
    deliveryAvailable: Joi.boolean(),
    boostMultiplier: Joi.number().positive()
  }).min(1),
  adminCommuneCreate: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    cityId: Joi.string().hex().length(24).required(),
    isActive: Joi.boolean().default(true),
    deliveryPolicy: Joi.string().valid('FREE', 'FIXED_FEE', 'DEFAULT_RULE').default('DEFAULT_RULE'),
    fixedFee: Joi.number().min(0).default(0),
    order: Joi.number().integer().min(0).default(0)
  }),
  adminCommuneUpdate: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    cityId: Joi.string().hex().length(24),
    isActive: Joi.boolean(),
    deliveryPolicy: Joi.string().valid('FREE', 'FIXED_FEE', 'DEFAULT_RULE'),
    fixedFee: Joi.number().min(0),
    order: Joi.number().integer().min(0)
  }).min(1),
  adminRuntimeSettingKeyParam: Joi.object({
    key: Joi.string()
      .trim()
      .pattern(/^[a-zA-Z0-9_.:-]+$/)
      .min(2)
      .max(120)
      .required()
  }),
  adminRuntimeSettingUpdate: Joi.object({
    value: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array(),
      Joi.object()
    ).required(),
    description: Joi.string().max(300).allow('', null),
    environment: Joi.string().valid('all', 'production', 'staging', 'dev', 'development', 'prod').optional()
  }),
  adminRuntimeSettingBulkUpdate: Joi.object({
    environment: Joi.string().valid('all', 'production', 'staging', 'dev', 'development', 'prod').optional(),
    items: Joi.array()
      .items(
        Joi.object({
          key: Joi.string()
            .trim()
            .pattern(/^[a-zA-Z0-9_.:-]+$/)
            .min(2)
            .max(120)
            .required(),
          value: Joi.alternatives().try(
            Joi.string(),
            Joi.number(),
            Joi.boolean(),
            Joi.array(),
            Joi.object()
          ).required(),
          description: Joi.string().max(300).allow('', null)
        })
      )
      .min(1)
      .max(100)
      .required()
  }),
  adminFeatureFlagParam: Joi.object({
    featureName: Joi.string()
      .trim()
      .pattern(/^[a-zA-Z0-9_.:-]+$/)
      .min(2)
      .max(120)
      .required()
  }),
  adminFeatureFlagUpdate: Joi.object({
    enabled: Joi.boolean().required(),
    rolesAllowed: Joi.array().items(Joi.string().trim().min(2).max(40)).max(20).default([]),
    rolloutPercentage: Joi.number().min(0).max(100).default(100),
    description: Joi.string().max(300).allow('', null),
    environment: Joi.string().valid('all', 'production', 'staging', 'dev', 'development', 'prod').optional()
  }),
  adminConfigRefresh: Joi.object({
    keys: Joi.array()
      .items(
        Joi.string()
          .trim()
          .pattern(/^[a-zA-Z0-9_.:-]+$/)
          .min(2)
          .max(120)
      )
      .max(200)
      .default([])
  }),
  pushTokenRegister: Joi.object({
    token: Joi.string().trim().required(),
    platform: Joi.string().valid('ios', 'android', 'web', 'unknown').optional(),
    deviceId: Joi.string().trim().allow('', null),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null),
      model: Joi.string().trim().allow('', null),
      manufacturer: Joi.string().trim().allow('', null),
      osVersion: Joi.string().trim().allow('', null),
      appVersion: Joi.string().trim().allow('', null)
    }).unknown(true).optional()
  }),
  pushTokenRemove: Joi.object({
    token: Joi.string().trim().required()
  }),
  deviceTokenRegister: Joi.object({
    token: Joi.string().trim().required(),
    platform: Joi.string().valid('ios', 'android', 'web', 'unknown').optional(),
    deviceId: Joi.string().trim().allow('', null),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null),
      model: Joi.string().trim().allow('', null),
      manufacturer: Joi.string().trim().allow('', null),
      osVersion: Joi.string().trim().allow('', null),
      appVersion: Joi.string().trim().allow('', null)
    }).unknown(true).optional()
  }),
  deviceTokenRemove: Joi.object({
    token: Joi.string().trim().required()
  }),
  bulkProductAction: Joi.object({
    productIds: Joi.array().items(Joi.string().hex().length(24)).min(1).max(100).required()
  })
};
