import Joi from 'joi';

export const validate =
  (schema, property = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
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
    verificationCode: Joi.string().min(3).max(10).required(),
    role: Joi.string().valid('user', 'admin', 'manager').optional(),
    accountType: Joi.string().valid('person').default('person'),
    address: Joi.string().min(4).max(200).required(),
    city: Joi.string()
      .valid('Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo')
      .required(),
    gender: Joi.string().valid('homme', 'femme').required(),
    country: Joi.string().valid('République du Congo').optional()
  }),
  registerSendCode: Joi.object({
    phone: Joi.string().min(5).max(30).required()
  }),
  login: Joi.object({
    phone: Joi.string().min(5).max(30).required(),
    password: Joi.string().min(6).required(),
  }),
  passwordForgot: Joi.object({
    phone: Joi.string().min(5).max(30).required()
  }),
  passwordReset: Joi.object({
    phone: Joi.string().min(5).max(30).required(),
    verificationCode: Joi.string().min(3).max(10).required(),
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
    category: Joi.string().min(2).max(60).required(),
    condition: Joi.string().valid('new', 'used').default('used'),
    discount: Joi.number().min(0).max(99.99).default(0),
  }),
  productUpdate: Joi.object({
    title: Joi.string().min(2).max(120),
    description: Joi.string().min(5).max(5000),
    category: Joi.string().min(2).max(60),
    condition: Joi.string().valid('new', 'used'),
    discount: Joi.number().min(0).max(99.99),
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
    accountType: Joi.string().valid('person', 'shop'),
    shopName: Joi.string().min(2).max(120),
    shopAddress: Joi.string().min(4).max(200),
    shopDescription: Joi.string().min(10).max(1000),
    shopHours: Joi.string().allow('', null),
    address: Joi.string().min(4).max(200),
    city: Joi.string().valid('Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'),
    gender: Joi.string().valid('homme', 'femme')
  }).min(0),
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
  paymentCreate: Joi.object({
    productId: Joi.string().hex().length(24).required(),
    payerName: Joi.string().min(2).max(120).required(),
    transactionNumber: Joi.string().min(3).max(120).required(),
    amount: Joi.number().min(0).required(),
    operator: Joi.string().valid('MTN', 'Airtel', 'Orange', 'Moov', 'Other').required(),
  }),
  publicQuery: Joi.object({
    q: Joi.string().allow(''),
    category: Joi.string().allow(''),
    city: Joi.string().valid('Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'),
    certified: Joi.boolean().truthy('true').falsy('false'),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    sort: Joi.string()
      .valid('new', 'price_asc', 'price_desc', 'discount')
      .default('new'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
  }),
  idParam: Joi.object({
    id: Joi.string().hex().length(24).required()
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
      then: Joi.string().min(2).max(120).required(),
      otherwise: Joi.forbidden()
    }),
    shopAddress: Joi.when('accountType', {
      is: 'shop',
      then: Joi.string().min(4).max(200).required(),
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
    deliveryCity: Joi.string().valid('Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo').required(),
    trackingNote: Joi.string().max(500).allow('', null)
  }),
  orderCheckout: Joi.alternatives()
    .try(
      Joi.object({
        payments: Joi.array()
          .items(
            Joi.object({
              sellerId: Joi.string().hex().length(24).required(),
              payerName: Joi.string().min(2).max(120).required(),
              transactionCode: Joi.string().min(3).max(120).required()
            })
          )
          .min(1)
          .required()
      }),
      Joi.object({
        payerName: Joi.string().min(2).max(120).required(),
        transactionCode: Joi.string().min(3).max(120).required()
      })
    )
    .required(),
  orderStatusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'delivering', 'delivered').required()
  }),
  sellerOrderStatusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'delivering', 'delivered').required()
  }),
  orderUpdate: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'delivering', 'delivered'),
    deliveryAddress: Joi.string().min(4).max(300),
    deliveryCity: Joi.string().valid('Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'),
    trackingNote: Joi.string().max(500).allow('', null),
    deliveryGuyId: Joi.string().hex().length(24).allow('', null)
  }).min(1),
  deliveryGuyCreate: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    phone: Joi.string().max(30).allow('', null),
    active: Joi.boolean().optional()
  }),
  deliveryGuyUpdate: Joi.object({
    name: Joi.string().min(2).max(80),
    phone: Joi.string().max(30).allow('', null),
    active: Joi.boolean()
  }).min(1),
  adminUserRole: Joi.object({
    role: Joi.string().valid('user', 'manager').required()
  }),
  complaintStatusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'in_review', 'resolved').required(),
    note: Joi.string().max(500).allow('', null)
  }),
  notificationPreferencesUpdate: Joi.object({
    product_comment: Joi.boolean(),
    reply: Joi.boolean(),
    favorite: Joi.boolean(),
    rating: Joi.boolean(),
    product_approval: Joi.boolean(),
    product_rejection: Joi.boolean(),
    promotional: Joi.boolean(),
    shop_review: Joi.boolean(),
    payment_pending: Joi.boolean(),
    order_created: Joi.boolean(),
    order_received: Joi.boolean(),
    order_reminder: Joi.boolean(),
    order_delivering: Joi.boolean(),
    order_delivered: Joi.boolean()
  }).min(1),
  pushTokenRegister: Joi.object({
    token: Joi.string().trim().required(),
    platform: Joi.string().valid('ios', 'android', 'web', 'unknown').optional(),
    deviceId: Joi.string().trim().allow('', null)
  }),
  pushTokenRemove: Joi.object({
    token: Joi.string().trim().required()
  })
};
