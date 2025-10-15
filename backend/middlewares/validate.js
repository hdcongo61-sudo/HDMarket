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

export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(60).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    phone: Joi.string().min(5).max(30).required(),
    role: Joi.string().valid('user', 'admin').optional(),
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),
  productCreate: Joi.object({
    title: Joi.string().min(2).max(120).required(),
    description: Joi.string().min(5).max(5000).required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().min(2).max(60).required(),
    discount: Joi.number().min(0).max(99.99).default(0),
  }),
  productUpdate: Joi.object({
    title: Joi.string().min(2).max(120),
    description: Joi.string().min(5).max(5000),
    category: Joi.string().min(2).max(60),
    discount: Joi.number().min(0).max(99.99),
  }),
  commentCreate: Joi.object({
    message: Joi.string().min(1).max(500).required(),
    parentId: Joi.string().hex().length(24).optional(),
    parentReadIds: Joi.array().items(Joi.string().hex().length(24)).optional()
  }),
  ratingUpsert: Joi.object({
    value: Joi.number().integer().min(1).max(5).required(),
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
    password: Joi.string().min(6).max(100)
  }).min(1),
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
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    sort: Joi.string()
      .valid('new', 'price_asc', 'price_desc', 'discount')
      .default('new'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
  }),
};
