import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import ShopReview from '../models/shopReviewModel.js';
import { createNotification } from '../utils/notificationService.js';
import { sanitizeShopHours } from '../utils/shopHours.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';
import { ensureDocumentSlug, ensureModelSlugsForItems } from '../utils/slugUtils.js';

const formatShopReview = (review) => {
  if (!review) return null;
  const user = review.user || {};
  return {
    _id: review._id,
    rating: review.rating,
    comment: review.comment || '',
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: {
      _id: user._id,
      name: user.name || 'Utilisateur',
      shopName: user.shopName || null,
      shopLogo: user.shopLogo || null
    }
  };
};

const loadShopByIdentifier = async (identifier, projection = 'shopName shopAddress shopLogo shopBanner name createdAt shopVerified followersCount slug accountType phone shopDescription shopHours isBlocked') => {
  const query = buildIdentifierQuery(identifier);
  if (!Object.keys(query).length) return null;
  const shop = await User.findOne(query).select(projection);
  if (!shop) return null;
  await ensureDocumentSlug({ document: shop, sourceValue: shop.shopName || shop.name });
  return shop;
};

export const listShops = asyncHandler(async (req, res) => {
  const filters = { accountType: 'shop' };
  if (req.query?.verified === 'true') {
    filters.shopVerified = true;
  }
  const includeImages = req.query?.withImages === 'true';
  const imageLimit = Math.max(1, Math.min(Number(req.query?.imageLimit) || 6, 12));
  const shops = await User.find(filters)
    .select('shopName shopAddress shopLogo shopBanner name createdAt shopVerified followersCount')
    .sort({ shopName: 1, createdAt: 1 })
    .lean();

  if (!shops.length) {
    return res.json([]);
  }

  const shopIds = shops.map((shop) => shop._id);
  const productCounts = await Product.aggregate([
    { $match: { user: { $in: shopIds }, status: 'approved' } },
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);

  const productCountMap = new Map(productCounts.map((entry) => [String(entry._id), entry.count]));
  let ratingMap = new Map();

  if (shopIds.length) {
    const ratingSummaries = await ShopReview.aggregate([
      { $match: { shop: { $in: shopIds } } },
      { $group: { _id: '$shop', average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    ratingMap = new Map(
      ratingSummaries.map((summary) => [
        String(summary._id),
        {
          average: Number(summary.average?.toFixed(2) || 0),
          count: summary.count || 0
        }
      ])
    );
  }

  let imageMap = new Map();
  if (includeImages && shopIds.length) {
    const imageAgg = await Product.aggregate([
      {
        $match: {
          user: { $in: shopIds },
          status: 'approved',
          images: { $exists: true, $ne: [] }
        }
      },
      { $project: { user: 1, images: 1 } },
      { $unwind: '$images' },
      { $group: { _id: '$user', images: { $addToSet: '$images' } } }
    ]);
    imageMap = new Map(
      imageAgg.map((entry) => [String(entry._id), Array.isArray(entry.images) ? entry.images : []])
    );
  }

  const pickRandomImages = (images, limit) => {
    const pool = Array.isArray(images) ? images.filter(Boolean) : [];
    if (pool.length <= limit) return pool;
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, limit);
  };

  const payload = shops.map((shop) => {
    const id = String(shop._id);
    const ratingStats = ratingMap.get(id) || { average: 0, count: 0 };
    const sampleImages = includeImages ? pickRandomImages(imageMap.get(id) || [], imageLimit) : [];
    return {
      _id: shop._id,
      slug: shop.slug,
      shopName: shop.shopName || shop.name,
      shopAddress: shop.shopAddress || '',
      shopLogo: shop.shopLogo || null,
      shopBanner: shop.shopBanner || null,
      shopVerified: Boolean(shop.shopVerified),
      followersCount: Number(shop.followersCount || 0),
      productCount: productCountMap.get(id) || 0,
      ratingAverage: ratingStats.average,
      ratingCount: ratingStats.count,
      createdAt: shop.createdAt,
      sampleImages
    };
  });

  res.json(payload);
});

export const getShopProfile = asyncHandler(async (req, res) => {
  const shop = await loadShopByIdentifier(req.params.id, [
    'name shopName phone accountType createdAt shopLogo shopBanner shopAddress shopVerified shopDescription shopHours isBlocked followersCount slug'
  ].join(' '));
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  if (shop.isBlocked) {
    return res.status(403).json({ message: 'Cette boutique a été suspendue.' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  const skip = (page - 1) * limit;

  const [totalProducts, productsRaw] = await Promise.all([
    Product.countDocuments({ user: shop._id, status: 'approved' }),
    Product.find({
      user: shop._id,
      status: 'approved'
    })
      .select('_id title price images category condition city createdAt slug salesCount favoritesCount whatsappClicks views discount priceBeforeDiscount')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean()
  ]);
  await ensureModelSlugsForItems({ Model: Product, items: productsRaw, sourceValueKey: 'title' });

  const productIds = productsRaw.map((item) => item._id);
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

  const sellerInfo = {
    _id: shop._id,
    name: shop.name,
    shopName: shop.shopName,
    accountType: shop.accountType,
    phone: shop.phone,
    shopLogo: shop.shopLogo,
    shopAddress: shop.shopAddress,
    shopVerified: Boolean(shop.shopVerified)
  };

  const products = productsRaw.map((item) => {
    const commentCount = commentMap.get(String(item._id)) || 0;
    const rating = ratingMap.get(String(item._id)) || { average: 0, count: 0 };
    return {
      ...item,
      commentCount,
      ratingAverage: rating.average,
      ratingCount: rating.count,
      user: sellerInfo
    };
  });

  const ratingSummaryAgg = await ShopReview.aggregate([
    { $match: { shop: shop._id } },
    { $group: { _id: '$shop', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const ratingSummary = ratingSummaryAgg[0] || { average: 0, count: 0 };
  const ratingAverage = ratingSummary.count ? Number(ratingSummary.average?.toFixed(2) || 0) : 0;
  const ratingCount = ratingSummary.count || 0;

  const recentReviewsRaw = await ShopReview.find({ shop: shop._id })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('user', 'name shopName shopLogo slug')
    .lean();

  const recentReviews = recentReviewsRaw.map(formatShopReview);

  res.json({
    shop: {
      _id: shop._id,
      shopName: shop.shopName || shop.name,
      ownerName: shop.name,
      phone: shop.phone,
      createdAt: shop.createdAt,
      productCount: totalProducts,
      shopLogo: shop.shopLogo || null,
      shopBanner: shop.shopBanner || null,
      shopAddress: shop.shopAddress || null,
      shopVerified: Boolean(shop.shopVerified),
      shopDescription: shop.shopDescription || '',
      followersCount: Number(shop.followersCount || 0),
      ratingAverage,
      ratingCount,
      shopHours: sanitizeShopHours(shop.shopHours || [])
    },
    products,
    pagination: {
      page,
      limit,
      total: totalProducts,
      pages: Math.max(1, Math.ceil(totalProducts / limit) || 1)
    },
    recentReviews
  });
});

export const getShopReviews = asyncHandler(async (req, res) => {
  const shop = await loadShopByIdentifier(req.params.id, 'accountType');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const [reviewsRaw, total, summaryAgg] = await Promise.all([
    ShopReview.find({ shop: shop._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name shopName shopLogo slug')
      .lean(),
    ShopReview.countDocuments({ shop: shop._id }),
    ShopReview.aggregate([
      { $match: { shop: shop._id } },
      { $group: { _id: '$shop', average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ])
  ]);

  const summary = summaryAgg[0] || { average: 0, count: 0 };
  const average = summary.count ? Number(summary.average?.toFixed(2) || 0) : 0;
  const count = summary.count || 0;
  const pages = Math.max(1, Math.ceil(total / limit) || 1);

  res.json({
    reviews: reviewsRaw.map(formatShopReview),
    pagination: { page, pages, total, limit },
    summary: { average, count }
  });
});

export const getMyShopReview = asyncHandler(async (req, res) => {
  const shop = await loadShopByIdentifier(req.params.id, 'accountType');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  const review = await ShopReview.findOne({ shop: shop._id, user: req.user.id })
    .populate('user', 'name shopName shopLogo slug')
    .lean();

  if (!review) {
    return res.json(null);
  }

  res.json(formatShopReview(review));
});

export const upsertShopReview = asyncHandler(async (req, res) => {
  const shop = await User.findById(req.params.id).select('accountType shopName name');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  if (shop._id.equals(req.user.id)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas évaluer votre propre boutique.' });
  }

  const payload = {
    rating: req.body.rating,
    comment: (req.body.comment || '').trim()
  };

  let review = await ShopReview.findOne({ shop: shop._id, user: req.user.id });
  const isNew = !review;

  if (review) {
    review.rating = payload.rating;
    review.comment = payload.comment;
    await review.save();
  } else {
    review = await ShopReview.create({ shop: shop._id, user: req.user.id, ...payload });
  }

  await review.populate('user', 'name shopName shopLogo slug');

  if (isNew) {
    await createNotification({
      userId: shop._id,
      actorId: req.user.id,
      shopId: shop._id,
      type: 'shop_review',
      metadata: {
        rating: review.rating,
        comment: review.comment,
        shopName: shop.shopName || shop.name,
        reviewId: review._id
      }
    });
  }

  res.status(isNew ? 201 : 200).json(formatShopReview(review.toObject()));
});

export const deleteShopReview = asyncHandler(async (req, res) => {
  const shop = await User.findById(req.params.id).select('accountType');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  const deleted = await ShopReview.findOneAndDelete({ shop: shop._id, user: req.user.id });
  if (!deleted) {
    return res.status(404).json({ message: 'Avis introuvable.' });
  }

  res.status(204).send();
});
