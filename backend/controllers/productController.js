import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';

export const createProduct = asyncHandler(async (req, res) => {
  const { title, description, price, category, discount, condition } = req.body;
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

  const resolvedCondition = (condition || 'used').toString().toLowerCase();
  const safeCondition = resolvedCondition === 'new' ? 'new' : 'used';

  const images = (req.files || []).map((f) => `${req.protocol}://${req.get('host')}/` + f.path.replace('\\', '/'));

  const product = await Product.create({
    title,
    description,
    price: finalPrice,
    category,
    discount: discountValue,
    condition: safeCondition,
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

  const filter = { status: 'approved' };

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

export const getPublicHighlights = asyncHandler(async (req, res) => {
  const limitParam = Number(req.query?.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 6, 60));

  const baseFilter = { status: 'approved' };

  const favoritesRaw = await Product.find(baseFilter)
    .sort({ favoritesCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  const dealsRaw = await Product.find(baseFilter)
    .sort({ price: 1, createdAt: -1 })
    .limit(limit)
    .lean();

  const discountRaw = await Product.find({ ...baseFilter, discount: { $gt: 0 } })
    .sort({ discount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  const newRaw = await Product.find({ ...baseFilter, condition: 'new' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const usedRaw = await Product.find({ ...baseFilter, condition: 'used' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const topRatingStats = await Rating.aggregate([
    { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 0 } } },
    { $sort: { average: -1, count: -1 } },
    { $limit: limit * 5 }
  ]);

  const ratingCandidateIds = topRatingStats.map((stat) => stat._id);
  let ratingProductsRaw = [];
  if (ratingCandidateIds.length) {
    ratingProductsRaw = await Product.find({ _id: { $in: ratingCandidateIds }, status: 'approved' })
      .lean();
  }

  const ratingProductMap = new Map(ratingProductsRaw.map((doc) => [String(doc._id), doc]));
  const topRatedRaw = [];
  for (const stat of topRatingStats) {
    const product = ratingProductMap.get(String(stat._id));
    if (product) {
      topRatedRaw.push(product);
      if (topRatedRaw.length >= limit) break;
    }
  }

  const combinedMap = new Map();
  favoritesRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  topRatedRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  dealsRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  discountRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  newRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  usedRaw.forEach((doc) => combinedMap.set(String(doc._id), doc));
  const productIds = Array.from(combinedMap.values()).map((doc) => doc._id);

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

  const serialize = (doc) => {
    const idStr = String(doc._id);
    const rating = ratingMap.get(idStr) || { average: 0, count: 0 };
    return {
      ...doc,
      commentCount: commentMap.get(idStr) || 0,
      ratingAverage: rating.average,
      ratingCount: rating.count
    };
  };

  const favorites = favoritesRaw.map(serialize);
  const topRated = topRatedRaw.map(serialize);
  const topDeals = dealsRaw
    .map(serialize)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, limit);
  const topDiscounts = discountRaw.map(serialize).slice(0, limit);
  const newProducts = newRaw.map(serialize).slice(0, limit);
  const usedProducts = usedRaw.map(serialize).slice(0, limit);

  res.json({ favorites, topRated, topDeals, topDiscounts, newProducts, usedProducts });
});

export const getPublicProductById = asyncHandler(async (req, res) => {
  const productDoc = await Product.findById(req.params.id)
    .select('-payment')
    .populate('user', 'name phone accountType shopName shopAddress shopLogo');
  if (!productDoc || productDoc.status !== 'approved') {
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
  const products = await Product.find(query)
    .populate('user', 'name email phone accountType shopName shopAddress shopLogo')
    .populate('payment');
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

  const { title, description, category, discount, condition } = req.body;
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

  if (condition) {
    const normalized = condition.toString().toLowerCase();
    if (normalized === 'new' || normalized === 'used') {
      product.condition = normalized;
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

  if (product.status !== 'disabled') {
    product.lastStatusBeforeDisable = product.status;
  }
  product.status = 'disabled';
  product.disabledByAdmin = req.user.role === 'admin';
  await product.save();
  res.json(product);
});

export const enableProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('payment', 'status');
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  if (product.disabledByAdmin && req.user.role !== 'admin') {
    return res
      .status(403)
      .json({
        message:
          'Cette annonce a été désactivée par l\'administration. Merci de contacter un administrateur pour la réactiver.'
      });
  }

  const paymentStatus = product.payment?.status || null;
  let restoredStatus = product.lastStatusBeforeDisable;

  if (paymentStatus === 'verified') {
    restoredStatus = 'approved';
  } else if (!restoredStatus) {
    restoredStatus = paymentStatus ? 'pending' : 'approved';
  }

  if (restoredStatus === 'disabled' || !restoredStatus) {
    restoredStatus = 'approved';
  }

  product.status = restoredStatus;
  product.lastStatusBeforeDisable = null;
  product.disabledByAdmin = false;
  await product.save();
  res.json(product);
});

export const registerWhatsappClick = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, status: { $ne: 'disabled' } },
    { $inc: { whatsappClicks: 1 } },
    { new: true, select: '_id whatsappClicks' }
  );

  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable ou désactivé.' });
  }

  res.json({ whatsappClicks: product.whatsappClicks });
});
