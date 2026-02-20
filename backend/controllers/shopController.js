import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import ProductView from '../models/productViewModel.js';
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

// Helper function to check if a shop is currently boosted based on date range
export const isShopCurrentlyBoosted = (shop) => {
  if (!shop.shopBoosted) return false;
  
  const now = new Date();
  const hasStartDate = shop.shopBoostStartDate !== null && shop.shopBoostStartDate !== undefined;
  const hasEndDate = shop.shopBoostEndDate !== null && shop.shopBoostEndDate !== undefined;
  
  // If no dates are set, consider it always boosted (backward compatibility)
  if (!hasStartDate && !hasEndDate) {
    return true;
  }
  
  // Check if current date is within the boost range
  if (hasStartDate && now < new Date(shop.shopBoostStartDate)) {
    return false; // Boost hasn't started yet
  }
  
  if (hasEndDate && now > new Date(shop.shopBoostEndDate)) {
    return false; // Boost has ended
  }
  
  return true;
};

const SHOP_CITIES = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];

export const listShops = asyncHandler(async (req, res) => {
  try {
    const filters = { accountType: 'shop' };
    if (req.query?.verified === 'true') {
      filters.shopVerified = true;
    }
    const cityParam = typeof req.query?.city === 'string' ? req.query.city.trim() : '';
    if (cityParam && SHOP_CITIES.includes(cityParam)) {
      filters.city = cityParam;
    }
    const includeImages = req.query?.withImages === 'true';
    const imageLimit = Math.max(1, Math.min(Number(req.query?.imageLimit) || 6, 12));
    const shops = await User.find(filters)
      .select('shopName shopAddress shopLogo shopBanner name createdAt shopVerified followersCount shopBoosted shopBoostScore shopBoostStartDate shopBoostEndDate city')
      .sort({ shopBoosted: -1, shopBoostScore: -1, followersCount: -1, shopName: 1, createdAt: -1 })
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

    const viewsAgg = await ProductView.aggregate([
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $match: { 'prod.user': { $in: shopIds } } },
      { $group: { _id: '$prod.user', totalViews: { $sum: '$viewsCount' } } }
    ]);
    const totalViewsMap = new Map(viewsAgg.map((entry) => [String(entry._id), Number(entry.totalViews || 0)]));

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
      const isCurrentlyBoosted = isShopCurrentlyBoosted(shop);
      return {
        _id: shop._id,
        slug: shop.slug,
        shopName: shop.shopName || shop.name,
        shopAddress: shop.shopAddress || '',
        shopLogo: shop.shopLogo || null,
        shopBanner: shop.shopBanner || null,
        shopVerified: Boolean(shop.shopVerified),
        shopBoosted: Boolean(shop.shopBoosted),
        shopBoostScore: Number(shop.shopBoostScore || 0),
        shopBoostStartDate: shop.shopBoostStartDate || null,
        shopBoostEndDate: shop.shopBoostEndDate || null,
        isCurrentlyBoosted,
        followersCount: Number(shop.followersCount || 0),
        productCount: productCountMap.get(id) || 0,
        totalViews: totalViewsMap.get(id) || 0,
        ratingAverage: ratingStats.average,
        ratingCount: ratingStats.count,
        createdAt: shop.createdAt,
        city: shop.city || '',
        sampleImages
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error('listShops fallback used:', error?.message || error);
    return res.json([]);
  }
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

// Shop Boost Management Functions
export const listBoostShopCandidatesAdmin = asyncHandler(async (req, res) => {
  const {
    q,
    page = 1,
    limit = 12,
    sort = 'boosted'
  } = req.query;
  const filter = { accountType: 'shop', shopVerified: true };
  const boostedFilter = req.query.boosted;

  if (q) {
    const matcher = new RegExp(q.trim(), 'i');
    filter.$or = [{ shopName: matcher }, { shopAddress: matcher }, { name: matcher }];
  }
  if (boostedFilter !== undefined) {
    if (boostedFilter === 'true' || boostedFilter === true) {
      filter.shopBoosted = true;
      // Add date range check for currently active boosts
      const now = new Date();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          // Shops with no date range (always boosted)
          { $and: [{ shopBoostStartDate: null }, { shopBoostEndDate: null }] },
          // Shops where start/end are missing (legacy boosted)
          { shopBoostStartDate: { $exists: false }, shopBoostEndDate: { $exists: false } },
          // Shops where boost has started and hasn't ended
          {
            $and: [
              {
                $or: [
                  { shopBoostStartDate: null },
                  { shopBoostStartDate: { $exists: false } },
                  { shopBoostStartDate: { $lte: now } }
                ]
              },
              {
                $or: [
                  { shopBoostEndDate: null },
                  { shopBoostEndDate: { $exists: false } },
                  { shopBoostEndDate: { $gte: now } }
                ]
              }
            ]
          }
        ]
      });
    } else if (boostedFilter === 'false' || boostedFilter === false) {
      // Include shops where shopBoosted is false or field is missing (never boosted)
      filter.shopBoosted = { $ne: true };
    }
  }

  const sortOptions = {
    boosted: { shopBoosted: -1, shopBoostScore: -1, createdAt: -1 },
    recent: { createdAt: -1 },
    followers: { followersCount: -1 }
  };

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 12));
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('shopName shopAddress shopLogo shopBanner name createdAt shopVerified shopBoosted shopBoostScore shopBoostStartDate shopBoostEndDate shopBoostedBy shopBoostedAt shopBoostedByName followersCount slug')
      .sort(sortOptions[sort] || sortOptions.boosted)
      .skip(skip)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter)
  ]);

  // Get product counts for shops
  const shopIds = items.map((shop) => shop._id);
  const productCounts = await Product.aggregate([
    { $match: { user: { $in: shopIds }, status: 'approved' } },
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);
  const productCountMap = new Map(productCounts.map((entry) => [String(entry._id), entry.count]));

  // Get rating summaries
  const ratingSummaries = await ShopReview.aggregate([
    { $match: { shop: { $in: shopIds } } },
    { $group: { _id: '$shop', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const ratingMap = new Map(
    ratingSummaries.map((summary) => [
      String(summary._id),
      {
        average: Number(summary.average?.toFixed(2) || 0),
        count: summary.count || 0
      }
    ])
  );

  const enrichedItems = items.map((shop) => {
    const id = String(shop._id);
    const ratingStats = ratingMap.get(id) || { average: 0, count: 0 };
    const isCurrentlyBoosted = isShopCurrentlyBoosted(shop);
    return {
      ...shop,
      productCount: productCountMap.get(id) || 0,
      ratingAverage: ratingStats.average,
      ratingCount: ratingStats.count,
      isCurrentlyBoosted
    };
  });

  res.json({
    items: enrichedItems,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const toggleShopBoost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { shopBoostStartDate, shopBoostEndDate } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant boutique invalide.' });
  }
  
  // Check permissions
  const isAdmin = req.user.role === 'admin';
  const canManageBoosts = req.user.canManageBoosts === true;
  if (!isAdmin && !canManageBoosts) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à gérer les boosts.' });
  }
  
  const shop = await User.findById(id);
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  if (!shop.shopVerified) {
    return res.status(400).json({ message: 'Seules les boutiques vérifiées peuvent être boostées.' });
  }
  
  // Validate date range if provided
  if (shopBoostStartDate && shopBoostEndDate) {
    const start = new Date(shopBoostStartDate);
    const end = new Date(shopBoostEndDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Dates de boost invalides.' });
    }
    
    if (start >= end) {
      return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début.' });
    }
    
    // Check if end date is in the past
    if (end < new Date()) {
      return res.status(400).json({ message: 'La date de fin ne peut pas être dans le passé.' });
    }
  }
  
  const wasBoosted = shop.shopBoosted;
  shop.shopBoosted = !shop.shopBoosted;
  shop.shopBoostScore = shop.shopBoosted ? Date.now() : 0;
  
  // Store who boosted the shop and when
  if (shop.shopBoosted) {
    // Fetch the user who is boosting to get their name
    const boosterUser = await User.findById(req.user.id).select('name');
    shop.shopBoostedBy = req.user.id;
    shop.shopBoostedAt = new Date();
    shop.shopBoostedByName = boosterUser?.name || 'Administrateur';
    
    // Set boost date range if provided
    if (shopBoostStartDate) {
      shop.shopBoostStartDate = new Date(shopBoostStartDate);
    } else {
      shop.shopBoostStartDate = new Date(); // Default to now if not provided
    }
    
    if (shopBoostEndDate) {
      shop.shopBoostEndDate = new Date(shopBoostEndDate);
    } else {
      shop.shopBoostEndDate = null; // No end date means boost indefinitely
    }
  } else {
    // Clear boost information when unboosting
    shop.shopBoostedBy = null;
    shop.shopBoostedAt = null;
    shop.shopBoostedByName = null;
    shop.shopBoostStartDate = null;
    shop.shopBoostEndDate = null;
  }
  
  await shop.save();
  
  // Send notification to shop owner when shop is boosted (not when unboosted)
  if (shop.shopBoosted && !wasBoosted) {
    await createNotification({
      userId: shop._id,
      actorId: req.user.id,
      shopId: shop._id,
      type: 'shop_boosted',
      metadata: {
        shopName: shop.shopName || shop.name,
        boostedByName: shop.shopBoostedByName,
        boostStartDate: shop.shopBoostStartDate,
        boostEndDate: shop.shopBoostEndDate
      },
      allowSelf: true
    });
  }
  
  res.json({
    _id: shop._id,
    shopBoosted: shop.shopBoosted,
    shopBoostScore: shop.shopBoostScore,
    shopBoostedBy: shop.shopBoostedBy,
    shopBoostedAt: shop.shopBoostedAt,
    shopBoostedByName: shop.shopBoostedByName,
    shopBoostStartDate: shop.shopBoostStartDate,
    shopBoostEndDate: shop.shopBoostEndDate,
    isCurrentlyBoosted: isShopCurrentlyBoosted(shop)
  });
});

export const getShopBoostStatistics = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const canManageBoosts = req.user.canManageBoosts === true;
  if (!isAdmin && !canManageBoosts) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à voir les statistiques de boost.' });
  }

  const [
    totalBoosted,
    totalNonBoosted,
    recentBoosts,
    topBoostedShops,
    boostedToday,
    boostedThisWeek,
    boostedThisMonth
  ] = await Promise.all([
    User.countDocuments({ accountType: 'shop', shopVerified: true, shopBoosted: true }),
    User.countDocuments({ accountType: 'shop', shopVerified: true, shopBoosted: { $ne: true } }),
    User.find({ accountType: 'shop', shopVerified: true, shopBoosted: true })
      .sort({ shopBoostScore: -1 })
      .limit(5)
      .select('shopName shopBoostScore createdAt')
      .lean(),
    User.find({ accountType: 'shop', shopVerified: true, shopBoosted: true })
      .sort({ shopBoostScore: -1 })
      .limit(10)
      .select('shopName followersCount productCount shopBoostScore')
      .lean(),
    User.countDocuments({
      accountType: 'shop',
      shopVerified: true,
      shopBoosted: true,
      shopBoostScore: { $gte: new Date().setHours(0, 0, 0, 0) }
    }),
    User.countDocuments({
      accountType: 'shop',
      shopVerified: true,
      shopBoosted: true,
      shopBoostScore: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }),
    User.countDocuments({
      accountType: 'shop',
      shopVerified: true,
      shopBoosted: true,
      shopBoostScore: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  ]);

  // Get product counts for top boosted shops
  const shopIds = topBoostedShops.map((shop) => shop._id);
  const productCounts = await Product.aggregate([
    { $match: { user: { $in: shopIds }, status: 'approved' } },
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);
  const productCountMap = new Map(productCounts.map((entry) => [String(entry._id), entry.count]));

  const enrichedTopShops = topBoostedShops.map((shop) => ({
    ...shop,
    productCount: productCountMap.get(String(shop._id)) || 0
  }));

  res.json({
    totalBoosted,
    totalNonBoosted,
    totalShops: totalBoosted + totalNonBoosted,
    boostedToday,
    boostedThisWeek,
    boostedThisMonth,
    recentBoosts,
    topBoostedShops: enrichedTopShops
  });
});
