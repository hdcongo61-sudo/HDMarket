import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';

export const createProduct = asyncHandler(async (req, res) => {
  const { title, description, price, category, discount } = req.body;
  if (!title || !description || !price || !category)
    return res.status(400).json({ message: 'Missing fields' });

  const priceValue = Number(price);
  if (Number.isNaN(priceValue)) {
    return res.status(400).json({ message: 'Invalid price value' });
  }

  let discountValue = discount !== undefined && discount !== null ? Number(discount) : 0;
  if (Number.isNaN(discountValue) || discountValue < 0 || discountValue >= 100) {
    return res.status(400).json({ message: 'Discount must be between 0 and 100' });
  }

  let finalPrice = priceValue;
  let priceBeforeDiscount;

  if (discountValue > 0) {
    priceBeforeDiscount = priceValue;
    finalPrice = Number((priceValue * (1 - discountValue / 100)).toFixed(2));
  }

  const images = (req.files || []).map((f) => `${req.protocol}://${req.get('host')}/` + f.path.replace('\\', '/'));

  const product = await Product.create({
    title,
    description,
    price: finalPrice,
    category,
    discount: discountValue,
    priceBeforeDiscount,
    images,
    user: req.user.id,
    status: 'pending'
  });

  res.status(201).json(product);
});

export const getPublicProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    sort = 'new',
    page = 1,
    limit = 12
  } = req.query;

  const filter = { status: { $ne: 'disabled' } };

  if (q) {
    const matcher = new RegExp(q.trim(), 'i');
    filter.$or = [{ title: matcher }, { description: matcher }];
  }

  if (category) {
    filter.category = new RegExp(`^${category.trim()}$`, 'i');
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const sortOptions = {
    new: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    discount: { discount: -1, createdAt: -1 }
  };

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 12));
  const skip = (pageNumber - 1) * pageSize;

  if (sort === 'discount') {
    filter.discount = { $gt: 0 };
  }

  const [itemsRaw, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOptions[sort] || sortOptions.new)
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Product.countDocuments(filter)
  ]);

  const productIds = itemsRaw.map((item) => item._id);

  let commentStats = [];
  let ratingStats = [];
  if (productIds.length) {
    commentStats = await Comment.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', count: { $sum: 1 } } }
    ]);

    ratingStats = await Rating.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } }
    ]);
  }

  const commentMap = new Map(commentStats.map((stat) => [String(stat._id), stat.count]));
  const ratingMap = new Map(
    ratingStats.map((stat) => [
      String(stat._id),
      { average: Number(stat.average?.toFixed(2) ?? 0), count: stat.count }
    ])
  );

  const items = itemsRaw.map((item) => {
    const commentCount = commentMap.get(String(item._id)) || 0;
    const rating = ratingMap.get(String(item._id)) || { average: 0, count: 0 };
    return {
      ...item,
      commentCount,
      ratingAverage: rating.average,
      ratingCount: rating.count
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: totalPages
    }
  });
});

export const getPublicProductById = asyncHandler(async (req, res) => {
  const productDoc = await Product.findById(req.params.id).select('-payment').populate('user', 'name email phone');
  if (!productDoc || productDoc.status === 'disabled') {
    return res.status(404).json({ message: 'Produit introuvable ou non publié.' });
  }

  const [commentCount, ratingData] = await Promise.all([
    Comment.countDocuments({ product: productDoc._id }),
    Rating.aggregate([
      { $match: { product: productDoc._id } },
      { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } }
    ])
  ]);

  const rating = ratingData[0]
    ? { average: Number(ratingData[0].average?.toFixed(2) ?? 0), count: ratingData[0].count }
    : { average: 0, count: 0 };

  const product = productDoc.toObject();
  product.commentCount = commentCount;
  product.ratingAverage = rating.average;
  product.ratingCount = rating.count;

  res.json(product);
});

export const getMyProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user.id })
    .populate('payment')
    .sort('-createdAt');
  res.json(products);
});

export const getAllProductsAdmin = asyncHandler(async (req, res) => {
  const { status } = req.query; // optional filter
  const query = status ? { status } : {};
  const products = await Product.find(query).populate('user', 'name email').populate('payment');
  res.json(products);
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (
    product.status === 'disabled' &&
    product.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  const { title, description, category, discount } = req.body;
  if (title) product.title = title;
  if (description) product.description = description;
  if (category) product.category = category;
  if (discount !== undefined) {
    const parsed = Number(discount);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= 100) {
      return res.status(400).json({ message: 'Discount must be between 0 and 100' });
    }
    const basePrice = product.priceBeforeDiscount ?? product.price;
    if (parsed > 0) {
      product.priceBeforeDiscount = basePrice;
      product.price = Number((basePrice * (1 - parsed / 100)).toFixed(2));
      product.discount = parsed;
    } else {
      product.price = basePrice;
      product.priceBeforeDiscount = undefined;
      product.discount = 0;
    }
  }

  if (req.files && req.files.length) {
    const imgs = req.files.map((f) => `${req.protocol}://${req.get('host')}/` + f.path.replace('\\', '/'));
    product.images = [...product.images, ...imgs];
  }

  await product.save();
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  await product.deleteOne();
  res.json({ message: 'Deleted' });
});

export const disableProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  product.status = 'disabled';
  await product.save();
  res.json(product);
});

export const enableProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  product.status = 'approved';
  await product.save();
  res.json(product);
});
