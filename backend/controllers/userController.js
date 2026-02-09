import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import Rating from '../models/ratingModel.js';
import Order from '../models/orderModel.js';
import Notification from '../models/notificationModel.js';
import SearchHistory from '../models/searchHistoryModel.js';
import ProductView from '../models/productViewModel.js';
import PushToken from '../models/pushTokenModel.js';
import { registerNotificationStream } from '../utils/notificationEmitter.js';
import { createNotification } from '../utils/notificationService.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';
import { getRestrictionMessage, isRestricted } from '../utils/restrictionCheck.js';
import {
  uploadToCloudinary,
  getCloudinaryFolder,
  isCloudinaryConfigured
} from '../utils/cloudinaryUploader.js';
import { hydrateShopHours, sanitizeShopHours } from '../utils/shopHours.js';
import {
  checkVerificationCode,
  isEmailConfigured,
  sendVerificationCode
} from '../utils/firebaseVerification.js';

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  product_comment: true,
  reply: true,
  favorite: true,
  rating: true,
  product_approval: true,
  product_rejection: true,
  product_boosted: true,
  promotional: true,
  shop_review: true,
  payment_pending: true,
  order_created: true,
  order_received: true,
  order_reminder: true,
  order_delivering: true,
  order_delivered: true,
  feedback_read: true,
  account_restriction: true,
  account_restriction_lifted: true
});

const mergeNotificationPreferences = (prefs = {}) => {
  const merged = {};
  Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).forEach((key) => {
    merged[key] =
      typeof prefs[key] === 'boolean' ? prefs[key] : DEFAULT_NOTIFICATION_PREFERENCES[key];
  });
  return merged;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  phoneVerified: Boolean(user.phoneVerified),
  role: user.role,
  accountType: user.accountType,
  country: user.country,
  address: user.address,
  city: user.city,
  gender: user.gender,
  shopName: user.shopName,
  shopAddress: user.shopAddress,
  shopLogo: user.shopLogo,
  shopBanner: user.shopBanner,
  shopVerified: Boolean(user.shopVerified),
  shopDescription: user.shopDescription || '',
  shopHours: sanitizeShopHours(user.shopHours || []),
  followersCount: Number(user.followersCount || 0),
  followingShops: Array.isArray(user.followingShops)
    ? user.followingShops.map((shopId) => shopId.toString())
    : [],
  canReadFeedback: Boolean(user.canReadFeedback),
  canVerifyPayments: Boolean(user.canVerifyPayments),
  canManageBoosts: Boolean(user.canManageBoosts),
  canManageComplaints: Boolean(user.canManageComplaints),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const ensureValidUserId = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('Utilisateur introuvable.');
    err.status = 404;
    throw err;
  }
};

const collectUserStats = async (userId) => {
  ensureValidUserId(userId);

  const [products, userDoc] = await Promise.all([
    Product.find({ user: userId })
      .select(
        '_id status favoritesCount whatsappClicks views title price images createdAt category condition city payment advertismentSpend slug'
      )
      .populate('payment', 'amount status')
      .lean(),
    User.findById(userId).select('-password').lean()
  ]);

  if (!userDoc) {
    const err = new Error('Utilisateur introuvable.');
    err.status = 404;
    throw err;
  }

  await ensureModelSlugsForItems({ Model: Product, items: products, sourceValueKey: 'title' });

  const orderStatusKeys = ['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'];
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [buyerAgg, sellerAgg] = await Promise.all([
    Order.aggregate([
      { $match: { customer: userObjectId, isDraft: { $ne: true } } },
      {
        $project: {
          status: 1,
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          paidAmount: { $ifNull: ['$paidAmount', 0] },
          remainingAmount: { $ifNull: ['$remainingAmount', 0] },
          itemCount: { $sum: '$items.quantity' }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          remainingAmount: { $sum: '$remainingAmount' },
          items: { $sum: '$itemCount' }
        }
      }
    ]),
    Order.aggregate([
      { $match: { isDraft: { $ne: true } } },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': userObjectId } },
      {
        $group: {
          _id: '$status',
          revenue: {
            $sum: { $multiply: ['$items.snapshot.price', '$items.quantity'] }
          },
          orderIds: { $addToSet: '$_id' }
        }
      }
    ])
  ]);

  const purchaseByStatus = orderStatusKeys.reduce((acc, status) => {
    acc[status] = { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 };
    return acc;
  }, {});

  buyerAgg.forEach((entry) => {
    if (!entry || !purchaseByStatus[entry._id]) return;
    const isDelivered = entry._id === 'delivered';
    const totalAmount = Number(entry.totalAmount || 0);
    const paidAmount = Number(entry.paidAmount || 0);
    const remainingAmount = Number(entry.remainingAmount || 0);
    purchaseByStatus[entry._id] = {
      count: Number(entry.count || 0),
      totalAmount,
      paidAmount: isDelivered ? totalAmount : paidAmount,
      remainingAmount: isDelivered ? 0 : remainingAmount,
      items: Number(entry.items || 0)
    };
  });

  const purchases = orderStatusKeys.reduce(
    (acc, status) => {
      const data = purchaseByStatus[status];
      acc.totalCount += data.count;
      acc.totalAmount += data.totalAmount;
      acc.paidAmount += data.paidAmount;
      acc.remainingAmount += data.remainingAmount;
      acc.totalItems += data.items;
      return acc;
    },
    { totalCount: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, totalItems: 0 }
  );

  const salesByStatus = orderStatusKeys.reduce((acc, status) => {
    acc[status] = { count: 0, totalAmount: 0 };
    return acc;
  }, {});

  sellerAgg.forEach((entry) => {
    if (!entry || !salesByStatus[entry._id]) return;
    const orderCount = Array.isArray(entry.orderIds) ? entry.orderIds.length : 0;
    salesByStatus[entry._id] = {
      count: Number(orderCount || 0),
      totalAmount: Number(entry.revenue || 0)
    };
  });

  const sales = orderStatusKeys.reduce(
    (acc, status) => {
      const data = salesByStatus[status];
      acc.totalCount += data.count;
      acc.totalAmount += data.totalAmount;
      return acc;
    },
    { totalCount: 0, totalAmount: 0 }
  );

  const listings = {
    total: products.length,
    approved: 0,
    pending: 0,
    rejected: 0,
    disabled: 0
  };

  let favoritesReceived = 0;
  let whatsappClicks = 0;
  let totalViews = 0;

  const categoryCounts = new Map();
  const conditionCounts = new Map();
  const timelineMap = new Map();

  products.forEach((product) => {
    if (product?.status && Object.prototype.hasOwnProperty.call(listings, product.status)) {
      listings[product.status] += 1;
    }

    favoritesReceived += Number(product?.favoritesCount || 0);
    whatsappClicks += Number(product?.whatsappClicks || 0);
    totalViews += Number(product?.views || 0);

    if (product?.category) {
      categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
    }

    if (product?.condition) {
      conditionCounts.set(product.condition, (conditionCounts.get(product.condition) || 0) + 1);
    }

    if (product?.createdAt) {
      const createdAt = new Date(product.createdAt);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      const entry = timelineMap.get(key) || { count: 0, favorites: 0, clicks: 0 };
      entry.count += 1;
      entry.favorites += Number(product?.favoritesCount || 0);
      entry.clicks += Number(product?.whatsappClicks || 0);
      timelineMap.set(key, entry);
    }
  });

  const productIds = products.map((product) => product._id);
  const advertismentSpend = products.reduce((sum, product) => {
    const fee = Number(product?.payment?.amount || product?.advertismentSpend || 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);

  let commentsReceived = 0;
  if (productIds.length) {
    commentsReceived = await Comment.countDocuments({ product: { $in: productIds } });
  }

  const performance = {
    views: totalViews,
    clicks: whatsappClicks,
    conversion:
      listings.approved > 0 ? Math.min(100, Math.round((whatsappClicks / listings.approved) * 100)) : 0
  };

  const formatLabel = (monthIndex, year) => {
    const date = new Date(year, monthIndex - 1, 1);
    return date.toLocaleString('fr-FR', { month: 'short' });
  };

  const timeline = Array.from(timelineMap.entries())
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      const timestamp = new Date(year, month - 1, 1).getTime();
      return {
        label: `${formatLabel(month, year)} ${String(year).slice(-2)}`,
        month,
        year,
        count: value.count,
        favorites: value.favorites,
        clicks: value.clicks,
        timestamp
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6);

  const breakdown = {
    categories: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    conditions: ['new', 'used']
      .map((condition) => ({
        condition,
        count: conditionCounts.get(condition) || 0
      }))
      .filter((item) => item.count > 0)
  };

  const topProducts = [...products]
    .sort((a, b) => {
      const scoreA = Number(a?.favoritesCount || 0) + Number(a?.whatsappClicks || 0);
      const scoreB = Number(b?.favoritesCount || 0) + Number(b?.whatsappClicks || 0);
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map((product) => ({
      _id: product._id,
      slug: product.slug,
      title: product.title,
      status: product.status,
      price: product.price,
      favorites: product.favoritesCount || 0,
      whatsappClicks: product.whatsappClicks || 0,
      image: Array.isArray(product.images) ? product.images[0] : null,
      createdAt: product.createdAt,
      category: product.category
    }));

  const followedShopIds = Array.isArray(userDoc?.followingShops)
    ? userDoc.followingShops
    : [];
  let followedShopsDetails = [];
  if (followedShopIds.length) {
    const shops = await User.find({
      _id: { $in: followedShopIds },
      accountType: 'shop'
    })
      .select('shopName name slug city followersCount shopLogo shopVerified')
      .lean();
    followedShopsDetails = shops.map((shop) => ({
      id: shop._id.toString(),
      _id: shop._id,
      name: shop.shopName || shop.name,
      shopName: shop.shopName || shop.name,
      slug: shop.slug || '',
      city: shop.city || '',
      followersCount: Number(shop.followersCount || 0),
      shopLogo: shop.shopLogo || null,
      shopVerified: Boolean(shop.shopVerified)
    }));
  }

  return {
    user: sanitizeUser(userDoc),
    listings,
    engagement: {
      favoritesReceived,
      commentsReceived,
      favoritesSaved: Array.isArray(userDoc?.favorites) ? userDoc.favorites.length : 0,
      shopsFollowed: Array.isArray(userDoc?.followingShops) ? userDoc.followingShops.length : 0
    },
    performance,
    breakdown,
    timeline,
    topProducts,
    advertismentSpend,
    orders: {
      purchases: {
        ...purchases,
        byStatus: purchaseByStatus
      },
      sales: {
        ...sales,
        byStatus: salesByStatus
      }
    },
    followedShops: followedShopsDetails
  };
};

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(sanitizeUser(user));
});

export const getProfileStats = asyncHandler(async (req, res) => {
  const stats = await collectUserStats(req.user.id);
  res.json(stats);
});

export const getAdminUserStats = asyncHandler(async (req, res) => {
  const stats = await collectUserStats(req.params.id);
  res.json(stats);
});

export const followShop = asyncHandler(async (req, res) => {
  const shopId = req.params.id;
  if (shopId === req.user.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas suivre votre propre boutique.' });
  }
  const shop = await User.findById(shopId).select('accountType shopVerified shopName name');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }
  if (!shop.shopVerified) {
    return res.status(403).json({ message: 'Seules les boutiques certifiées peuvent être suivies.' });
  }

  const updatedUser = await User.updateOne(
    { _id: req.user.id, followingShops: { $ne: shopId } },
    { $addToSet: { followingShops: shopId } }
  );
  if (!updatedUser.modifiedCount) {
    return res.status(400).json({ message: 'Vous suivez déjà cette boutique.' });
  }

  const updatedShop = await User.findByIdAndUpdate(
    shopId,
    { $inc: { followersCount: 1 } },
    { new: true }
  ).select('followersCount');

  // Notify the shop owner that someone followed their shop
  const actorName = req.user.name || 'Un utilisateur';
  await createNotification({
    userId: shopId,
    actorId: req.user.id,
    shopId,
    type: 'shop_follow',
    metadata: {
      shopName: shop.shopName || shop.name,
      followerName: actorName
    },
    allowSelf: false
  });

  res.json({
    message: 'Boutique suivie.',
    followersCount: Number(updatedShop?.followersCount || 0)
  });
});

export const unfollowShop = asyncHandler(async (req, res) => {
  const shopId = req.params.id;
  const shop = await User.findById(shopId).select('accountType');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  const updatedUser = await User.updateOne(
    { _id: req.user.id, followingShops: shopId },
    { $pull: { followingShops: shopId } }
  );
  if (!updatedUser.modifiedCount) {
    return res.status(400).json({ message: 'Vous ne suivez pas cette boutique.' });
  }

  const updatedShop = await User.findByIdAndUpdate(
    shopId,
    { $inc: { followersCount: -1 } },
    { new: true }
  ).select('followersCount');

  res.json({
    message: 'Boutique désabonnée.',
    followersCount: Math.max(0, Number(updatedShop?.followersCount || 0))
  });
});

export const getFollowingShops = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('followingShops')
    .lean();
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  const followedIds = Array.isArray(user.followingShops)
    ? user.followingShops.map((id) => mongoose.Types.ObjectId(id))
    : [];
  if (!followedIds.length) {
    return res.json([]);
  }
  const shops = await User.find({ _id: { $in: followedIds }, accountType: 'shop' })
    .select(
      'shopName shopAddress shopLogo shopVerified followersCount createdAt name city slug'
    )
    .sort({ shopName: 1 })
    .lean();
  const payload = shops.map((shop) => ({
    _id: shop._id,
    shopName: shop.shopName || shop.name,
    name: shop.name,
    shopAddress: shop.shopAddress || '',
    shopLogo: shop.shopLogo || null,
    shopVerified: Boolean(shop.shopVerified),
    followersCount: Number(shop.followersCount || 0),
    city: shop.city || '',
    slug: shop.slug || '',
    createdAt: shop.createdAt
  }));
  res.json(payload);
});

export const registerPushToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const token = req.body?.token?.trim();
  if (!token) {
    return res.status(400).json({ message: 'Token push requis.' });
  }
  const platform = req.body?.platform || 'unknown';
  const deviceId = req.body?.deviceId?.trim() || '';
  const saved = await PushToken.findOneAndUpdate(
    { token },
    {
      user: userId,
      platform,
      deviceId,
      lastSeenAt: new Date()
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ token: saved.token, platform: saved.platform });
});

export const unregisterPushToken = asyncHandler(async (req, res) => {
  const token = req.body?.token?.trim();
  if (!token) {
    return res.status(400).json({ message: 'Token push requis.' });
  }
  await PushToken.deleteOne({ user: req.user.id, token });
  res.json({ message: 'Token supprimé.' });
});

export const addSearchHistory = asyncHandler(async (req, res) => {
  const { query = '', metadata = {} } = req.body || {};
  const normalized = typeof query === 'string' ? query.trim() : '';
  if (!normalized) {
    return res.status(400).json({ message: 'La requête de recherche est requise.' });
  }
  const history = await SearchHistory.create({
    user: req.user.id,
    query: normalized,
    metadata
  });
  res.status(201).json(history);
});

export const getSearchHistory = asyncHandler(async (req, res) => {
  const { limit, search, groupByDate } = req.query;
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  
  let query = { user: req.user.id };
  
  // Search within history
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.query = searchRegex;
  }
  
  const history = await SearchHistory.find(query)
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(limitNum)
    .lean();
  
  // Group by date if requested
  if (groupByDate === 'true') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const grouped = {
      pinned: [],
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };
    
    history.forEach((entry) => {
      const entryDate = new Date(entry.createdAt);
      
      if (entry.isPinned) {
        grouped.pinned.push(entry);
      } else if (entryDate >= today) {
        grouped.today.push(entry);
      } else if (entryDate >= yesterday) {
        grouped.yesterday.push(entry);
      } else if (entryDate >= thisWeek) {
        grouped.thisWeek.push(entry);
      } else {
        grouped.older.push(entry);
      }
    });
    
    return res.json(grouped);
  }
  
  res.json(history);
});

export const deleteSearchHistoryEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const entry = await SearchHistory.findOne({ _id: id, user: req.user.id });
  if (!entry) {
    return res.status(404).json({ message: 'Historique introuvable.' });
  }
  await entry.deleteOne();
  res.json({ success: true, id });
});

export const clearSearchHistory = asyncHandler(async (req, res) => {
  const { dateRange } = req.body || {};
  
  let query = { user: req.user.id };
  
  // Clear by date range if provided
  if (dateRange) {
    const now = new Date();
    let startDate;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query.createdAt = { $gte: startDate };
        break;
      case 'yesterday':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: yesterday, $lt: today };
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: startDate };
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: startDate };
        break;
      case 'all':
        // No date filter, delete all
        break;
      default:
        // Invalid range, return error
        return res.status(400).json({ message: 'Plage de dates invalide.' });
    }
  }
  
  const { deletedCount } = await SearchHistory.deleteMany(query);
  res.json({ success: true, deletedCount: Number(deletedCount || 0) });
});

// Pin/unpin search history entry
export const togglePinSearchHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const entry = await SearchHistory.findOne({ _id: id, user: req.user.id });
  
  if (!entry) {
    return res.status(404).json({ message: 'Historique introuvable.' });
  }
  
  entry.isPinned = !entry.isPinned;
  entry.pinnedAt = entry.isPinned ? new Date() : null;
  await entry.save();
  
  res.json(entry);
});

// Export search history
export const exportSearchHistory = asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query;
  
  const history = await SearchHistory.find({ user: req.user.id })
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();
  
  if (format === 'csv') {
    const csvHeader = 'Query,Type,Date,Pinned\n';
    const csvRows = history.map((entry) => {
      const type = entry.metadata?.type || 'product';
      const date = new Date(entry.createdAt).toLocaleDateString('fr-FR');
      const pinned = entry.isPinned ? 'Yes' : 'No';
      const query = `"${entry.query.replace(/"/g, '""')}"`;
      return `${query},${type},${date},${pinned}`;
    }).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="search-history-${Date.now()}.csv"`);
    res.send(csvHeader + csvRows);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="search-history-${Date.now()}.json"`);
    res.json(history);
  }
});

export const addProductView = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  if (!Object.keys(query).length) {
    return res.status(400).json({ message: 'Identifiant produit invalide.' });
  }
  const product = await Product.findOne(query).select('_id category status');
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non publié.' });
  }

  const view = await ProductView.findOneAndUpdate(
    { user: req.user.id, product: product._id },
    {
      $set: {
        category: product.category || '',
        lastViewedAt: new Date()
      },
      $inc: { viewsCount: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({
    id: String(view.product),
    category: view.category || '',
    visitedAt: view.lastViewedAt ? view.lastViewedAt.getTime() : Date.now()
  });
});

export const getProductViews = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const views = await ProductView.find({ user: req.user.id })
    .sort('-lastViewedAt')
    .limit(limit)
    .lean();
  res.json(
    views.map((view) => ({
      id: String(view.product),
      category: view.category || '',
      visitedAt: view.lastViewedAt ? new Date(view.lastViewedAt).getTime() : 0
    }))
  );
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const {
    name,
    email,
    phone,
    accountType,
    shopName,
    shopAddress,
    city,
    gender,
    address,
    shopDescription,
    shopHours
  } = req.body;
  const hasShopHoursField = Object.prototype.hasOwnProperty.call(req.body, 'shopHours');

  if (email && email !== user.email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    user.email = email;
  }

  if (typeof phone !== 'undefined') {
    const normalizedPhone =
      typeof phone === 'string'
        ? phone.trim()
        : phone !== null && phone !== undefined
        ? String(phone).trim()
        : '';
    const currentPhone = typeof user.phone === 'string' ? user.phone.trim() : user.phone;
    if (normalizedPhone && normalizedPhone !== currentPhone) {
      return res.status(400).json({ message: 'Le numéro de téléphone ne peut pas être modifié.' });
    }
  }

  if (name) user.name = name;

  if (accountType) {
    user.accountType = accountType === 'shop' ? 'shop' : 'person';
  }

  if (typeof address !== 'undefined') {
    const trimmed = address.toString().trim();
    if (!trimmed) {
      return res.status(400).json({ message: "L'adresse est requise." });
    }
    user.address = trimmed;
  }

  if (city && ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].includes(city)) {
    user.city = city;
  }

  if (gender && ['homme', 'femme'].includes(gender)) {
    user.gender = gender;
  }

  user.country = 'République du Congo';

  if (typeof shopAddress !== 'undefined') {
    user.shopAddress = shopAddress;
  }
  if (typeof shopDescription !== 'undefined') {
    user.shopDescription = shopDescription.toString().trim();
  }

  if (user.accountType === 'shop') {
    const logoFile = req.files?.shopLogo?.[0] || req.file || null;
    const bannerFile = req.files?.shopBanner?.[0] || null;

    user.shopName = user.shopName || shopName;
    user.shopAddress = user.shopAddress || shopAddress;
    const rawShopName = typeof shopName !== 'undefined' ? shopName : user.shopName;
    const normalizedShopName = rawShopName ? rawShopName.toString().trim() : '';
    user.shopName = normalizedShopName;
    if (!normalizedShopName) {
      return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
    }
    if (!user.shopAddress) {
      return res.status(400).json({ message: "L'adresse de la boutique est requise." });
    }
    if (!user.shopDescription || !user.shopDescription.trim()) {
      return res.status(400).json({ message: 'Veuillez ajouter une description pour votre boutique.' });
    }
    if (typeof shopDescription === 'undefined' && !user.shopDescription) {
      user.shopDescription = '';
    }
    if (bannerFile && !user.shopVerified) {
      return res.status(403).json({
        message: 'La bannière est réservée aux boutiques certifiées.'
      });
    }

    if (!isCloudinaryConfigured() && (logoFile || bannerFile)) {
      return res
        .status(503)
        .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
    }
    if (normalizedShopName) {
      const regex = new RegExp(`^${normalizedShopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const conflict = await User.findOne({
        _id: { $ne: user._id },
        accountType: 'shop',
        shopName: { $regex: regex }
      });
      if (conflict) {
        return res.status(400).json({ message: 'Ce nom de boutique est déjà utilisé.' });
      }
    }

    if (logoFile) {
      try {
        const folder = getCloudinaryFolder(['shops', 'logos']);
        const uploaded = await uploadToCloudinary({
          buffer: logoFile.buffer,
          resourceType: 'image',
          folder
        });
        user.shopLogo = uploaded.secure_url || uploaded.url;
      } catch (error) {
        return res.status(500).json({ message: 'Erreur lors de l’upload du logo.' });
      }
    } else if (!user.shopLogo) {
      return res.status(400).json({ message: 'Le logo de la boutique est requis.' });
    }

    if (bannerFile) {
      try {
        const folder = getCloudinaryFolder(['shops', 'banners']);
        const uploaded = await uploadToCloudinary({
          buffer: bannerFile.buffer,
          resourceType: 'image',
          folder
        });
        user.shopBanner = uploaded.secure_url || uploaded.url;
      } catch (error) {
        return res.status(500).json({ message: 'Erreur lors de l’upload de la bannière.' });
      }
    }
    if (hasShopHoursField) {
      user.shopHours = hydrateShopHours(shopHours);
    }
  } else {
    user.shopName = undefined;
    user.shopAddress = undefined;
    user.shopLogo = undefined;
    user.shopBanner = undefined;
    user.shopDescription = '';
    user.shopHours = [];
  }

  await user.save();

  if (city && ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].includes(city)) {
    await Product.updateMany({ user: user._id }, { city, country: user.country });
  }

  res.json(sanitizeUser(user));
});

export const sendPasswordChangeCode = asyncHandler(async (req, res) => {
  // In production: skip sending verification email to facilitate testing
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const user = await User.findById(req.user.id).select('email');
    if (!user || !user.email) {
      return res.status(404).json({ message: 'Utilisateur introuvable ou email manquant.' });
    }
    return res.json({ message: 'En production, changement de mot de passe possible sans code pour les tests.' });
  }
  if (!isEmailConfigured()) {
    return res.status(503).json({
      message:
        "Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD."
    });
  }
  const user = await User.findById(req.user.id).select('email');
  if (!user || !user.email) {
    return res.status(404).json({ message: 'Utilisateur introuvable ou email manquant.' });
  }
  await sendVerificationCode(user.email, 'password_change');
  res.json({ message: 'Code de vérification envoyé par email.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { verificationCode, newPassword } = req.body;
  // In production: skip email verification check to facilitate testing
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && !isEmailConfigured()) {
    return res.status(503).json({
      message:
        "Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD."
    });
  }
  const user = await User.findById(req.user.id).select('email');
  if (!user || !user.email) {
    return res.status(404).json({ message: 'Utilisateur introuvable ou email manquant.' });
  }
  if (!isProduction) {
    const verificationCheck = await checkVerificationCode(user.email, verificationCode, 'password_change');
    if (verificationCheck?.status !== 'approved') {
      return res.status(400).json({ 
        message: verificationCheck?.message || 'Code de vérification invalide.' 
      });
    }
  }
  user.password = newPassword;
  user.phoneVerified = true;
  await user.save();
  res.json({ message: 'Mot de passe mis à jour.' });
});

export const getNotifications = asyncHandler(async (req, res) => {
  const [notifications, userDoc] = await Promise.all([
    Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('product', 'title status slug')
      .populate('shop', 'shopName name')
      .populate('actor', 'name email'),
    User.findById(req.user.id).select('notificationPreferences')
  ]);

  if (!userDoc) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  const alerts = notifications.map((notification) => {
    const actor = notification.actor
      ? {
          _id: notification.actor._id,
          name: notification.actor.name,
          email: notification.actor.email
        }
      : null;
    const product = notification.product
      ? {
          _id: notification.product._id,
          slug: notification.product.slug,
          title: notification.product.title,
          status: notification.product.status
        }
      : null;
    const metadata = notification.metadata || {};
    const shopInfo = notification.shop
      ? {
          _id: notification.shop._id,
          shopName: notification.shop.shopName,
          name: notification.shop.name
        }
      : null;
    const actorName = actor?.name || 'Un utilisateur';
    const productLabel = product?.title ? ` "${product.title}"` : '';
    const rawSnippet =
      typeof metadata.message === 'string'
        ? metadata.message
        : typeof metadata.comment === 'string'
        ? metadata.comment
        : '';
    const snippet =
      rawSnippet.length > 180
        ? `${rawSnippet.slice(0, 177)}...`
        : rawSnippet;

    let message;
    switch (notification.type) {
      case 'product_comment':
        message = snippet
          ? `${actorName} a commenté votre annonce${productLabel} : ${snippet}`
          : `${actorName} a laissé un commentaire sur votre annonce${productLabel}.`;
        break;
      case 'reply':
        message = snippet
          ? `${actorName} a répondu à votre commentaire${productLabel} : ${snippet}`
          : `${actorName} a répondu à votre commentaire${productLabel}.`;
        break;
      case 'favorite':
        message = `${actorName} a ajouté votre annonce${productLabel} à ses favoris.`;
        break;
      case 'rating':
        message = metadata.value
          ? `${actorName} a noté votre annonce${productLabel} (${metadata.value}/5).`
          : `${actorName} a noté votre annonce${productLabel}.`;
        break;
      case 'product_approval':
        message = `${actorName} a approuvé votre annonce${productLabel}. Elle est désormais visible pour les acheteurs.`;
        break;
      case 'product_rejection':
        message = `${actorName} a rejeté votre annonce${productLabel}. Contactez l'équipe support pour plus d'informations.`;
        break;
      case 'product_certified':
        message = `${actorName} a certifié votre annonce${productLabel}.`;
        break;
      case 'promotional': {
        const discountValue = Number(metadata.discount ?? 0);
        const hasDiscount = Number.isFinite(discountValue) && discountValue > 0;
        message = hasDiscount
          ? `${actorName} a appliqué une remise de ${discountValue}% sur votre annonce${productLabel}.`
          : `${actorName} a mis en avant votre annonce${productLabel} avec une nouvelle promotion.`;
        break;
      }
      case 'shop_follow': {
        const shopLabel = shopInfo?.shopName || metadata.shopName || 'votre boutique';
        message = `${actorName} a commencé à suivre ${shopLabel}.`;
        break;
      }
      case 'shop_review': {
        const shopLabel = shopInfo?.shopName || shopInfo?.name || metadata.shopName || 'votre boutique';
        const ratingValue = Number(metadata.rating || 0);
        const ratingText = Number.isFinite(ratingValue) && ratingValue > 0 ? ` (${ratingValue}/5)` : '';
        message = snippet
          ? `${actorName} a laissé un avis sur ${shopLabel}${ratingText} : ${snippet}`
          : `${actorName} a laissé un avis sur ${shopLabel}${ratingText}.`;
        break;
      }
      case 'shop_verified': {
        const shopLabel = shopInfo?.shopName || shopInfo?.name || metadata.shopName || 'votre boutique';
        message = `${actorName} a vérifié ${shopLabel}.`;
        break;
      }
      case 'complaint_resolved': {
        const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
        message = `${actorName} a marqué votre réclamation${subjectLabel} comme résolue.`;
        break;
      }
      case 'feedback_read': {
        const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
        message = `${actorName} a lu votre avis d’amélioration${subjectLabel}. Merci pour votre retour.`;
        break;
      }
      case 'complaint_created': {
        const subjectLabel = metadata.subject ? ` : ${metadata.subject}` : '';
        message = `${actorName} a déposé une réclamation${subjectLabel}. Consultez la section Réclamations pour la traiter.`;
        break;
      }
      case 'improvement_feedback_created': {
        const subjectLabel = metadata.subject ? ` : ${metadata.subject}` : '';
        message = `${actorName} a déposé un avis d'amélioration${subjectLabel}. Consultez la section Avis pour le lire.`;
        break;
      }
      case 'admin_broadcast': {
        message = metadata.message && String(metadata.message).trim() ? String(metadata.message).trim() : 'Message de l\'équipe HDMarket.';
        break;
      }
      case 'account_restriction': {
        const restrictionLabel = metadata.restrictionLabel || 'restriction';
        const fallback = `${actorName} a appliqué une restriction "${restrictionLabel}".`;
        message = metadata.message && String(metadata.message).trim()
          ? String(metadata.message).trim()
          : fallback;
        break;
      }
      case 'account_restriction_lifted': {
        const restrictionLabel = metadata.restrictionLabel || 'restriction';
        const fallback = `${actorName} a levé la restriction "${restrictionLabel}".`;
        message = metadata.message && String(metadata.message).trim()
          ? String(metadata.message).trim()
          : fallback;
        break;
      }
      case 'payment_pending': {
        const amountValue = Number(metadata.amount || 0);
        const amountText = Number.isFinite(amountValue) && amountValue > 0
          ? ` (${amountValue.toLocaleString('fr-FR')} FCFA)`
          : '';
        const waitingCount = Number(metadata.waitingCount || 0);
        const waitingSuffix =
          waitingCount > 1 ? ` · ${waitingCount} paiements en attente` : '';
        const productText = productLabel || '';
        message = `${actorName} a soumis une preuve de paiement${productText}${amountText}. Consultez la section "Vérification des paiements"${waitingSuffix}.`;
        break;
      }
      case 'order_created': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
        let action = 'créé';
        if (metadata.status === 'confirmed') {
          action = 'confirmé';
        } else if (metadata.status === 'pending') {
          action = 'mis en attente';
        }
        message = `${actorName} a ${action} votre commande ${orderId}${city}. Nous vous tiendrons informé des étapes de livraison.`;
        break;
      }
      case 'order_received': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const itemCount = Number(metadata.itemCount || 0);
        const itemsLabel = itemCount > 1 ? `${itemCount} articles` : itemCount === 1 ? '1 article' : 'des articles';
        const totalValue = Number(metadata.totalAmount || 0);
        const totalText =
          Number.isFinite(totalValue) && totalValue > 0
            ? ` (${totalValue.toLocaleString('fr-FR')} FCFA)`
            : '';
        message = `${actorName} a passé une commande ${orderId} pour ${itemsLabel}${totalText}.`;
        break;
      }
      case 'order_reminder': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
        message = `${actorName} vous rappelle d'accélérer la commande ${orderId}${city}.`;
        break;
      }
      case 'order_delivering': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
        message = `Votre commande ${orderId} est en cours de livraison${city}.`;
        break;
      }
      case 'order_delivered': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const address = metadata.deliveryAddress ? ` à ${metadata.deliveryAddress}` : '';
        const city = metadata.deliveryCity ? ` (${metadata.deliveryCity})` : '';
        const deliveredAtDate = metadata.deliveredAt ? new Date(metadata.deliveredAt) : null;
        const deliveredAt = deliveredAtDate && !Number.isNaN(deliveredAtDate.getTime())
          ? ` le ${deliveredAtDate.toLocaleDateString('fr-FR')}`
          : '';
        message = `${actorName} a marqué la commande ${orderId} comme livrée${address}${city}${deliveredAt}. Merci pour votre confiance.`;
        break;
      }
      case 'review_reminder': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const productCount = metadata.productCount || 1;
        const productText = productCount === 1 ? 'produit' : 'produits';
        const productLabel = productCount > 1 ? `vos ${productCount} ${productText}` : 'votre produit';
        message = `Votre commande ${orderId} a été livrée il y a plus d'une heure. Partagez votre expérience en notant ${productLabel} !`;
        break;
      }
      case 'order_address_updated': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        message = `L'adresse de livraison de la commande ${orderId} a été modifiée par le client.`;
        break;
      }
      case 'order_message': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        message = `${actorName} vous a envoyé un message concernant la commande ${orderId}.`;
        break;
      }
      default:
        message = `${actorName} a interagi avec votre annonce${productLabel}.`;
    }

    const isNew = !notification.readAt;
    const parent =
      notification.type === 'reply' && metadata.parentMessage
        ? { message: metadata.parentMessage }
        : null;

    const displayActor =
      notification.type === 'admin_broadcast' && actor
        ? { ...actor, name: 'HDMarketCG' }
        : actor;

    return {
      _id: notification._id,
      type: notification.type,
      message,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt,
      product,
      user: displayActor,
      actor: displayActor,
      shop: shopInfo,
      metadata,
      parent,
      isNew
    };
  });

  const unreadCount = alerts.filter((alert) => alert.isNew).length;
  const preferences = mergeNotificationPreferences(userDoc.notificationPreferences);

  res.json({
    commentAlerts: unreadCount,
    unreadCount,
    preferences,
    alerts
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const { notificationIds } = req.body || {};
  const now = new Date();

  if (Array.isArray(notificationIds) && notificationIds.length) {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, user: req.user.id, readAt: null },
      { $set: { readAt: now } }
    );
    return res.json({ success: true, updated: result.modifiedCount });
  }

  await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: now } });

  const user = await User.findById(req.user.id);
  if (user) {
    user.notificationsReadAt = now;
    await user.save();
  }

  res.json({ success: true, readAt: now });
});

export const streamNotifications = (req, res) => {
  registerNotificationStream(req.user.id, res);
};

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('notificationPreferences');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json({ preferences: mergeNotificationPreferences(user.notificationPreferences) });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const updates = {};
  Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[`notificationPreferences.${key}`] = Boolean(req.body[key]);
    }
  });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'Aucune préférence à mettre à jour.' });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, select: 'notificationPreferences' }
  );
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  res.json({ preferences: mergeNotificationPreferences(user.notificationPreferences) });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id
  });
  if (!deleted) {
    return res.status(404).json({ message: 'Notification introuvable.' });
  }
  res.json({ success: true });
});

export const getFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('favorites');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const favoriteIds = user.favorites || [];
  if (!favoriteIds.length) {
    return res.json([]);
  }

  const productsRaw = await Product.find({
    _id: { $in: favoriteIds },
    status: { $ne: 'disabled' }
  })
    .lean()
    .exec();
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

  const orderMap = new Map(favoriteIds.map((id, index) => [String(id), index]));

  const items = productsRaw
    .map((item) => {
      const commentCount = commentMap.get(String(item._id)) || 0;
      const rating = ratingMap.get(String(item._id)) || { average: 0, count: 0 };
      return {
        ...item,
        commentCount,
        ratingAverage: rating.average,
        ratingCount: rating.count
      };
    })
    .sort((a, b) => {
      const ai = orderMap.get(String(a._id)) ?? 0;
      const bi = orderMap.get(String(b._id)) ?? 0;
      return ai - bi;
    });

  res.json(items);
});

export const addFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: 'Product ID requis.' });
  }

  const product = await Product.findOne({ _id: productId, status: { $ne: 'disabled' } }).select(
    '_id user title'
  );
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable ou désactivé.' });
  }

  const user = await User.findById(req.user.id).select('favorites restrictions');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  if (isRestricted(user, 'canAddFavorites')) {
    return res.status(403).json({
      message: getRestrictionMessage('canAddFavorites'),
      restrictionType: 'canAddFavorites'
    });
  }

  const exists = user.favorites.some((fav) => fav.toString() === productId);
  if (!exists) {
    user.favorites.unshift(productId);
    await Promise.all([
      user.save(),
      Product.findByIdAndUpdate(productId, { $inc: { favoritesCount: 1 } }).exec()
    ]);

    if (product.user && String(product.user) !== req.user.id) {
      await createNotification({
        userId: product.user,
        actorId: req.user.id,
        productId: product._id,
        type: 'favorite',
        metadata: {
          productTitle: product.title || ''
        }
      });
    }
  }

  res.json({ favorites: user.favorites });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user.id).select('favorites');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const before = user.favorites.length;
  user.favorites = user.favorites.filter((fav) => fav.toString() !== id);
  if (user.favorites.length !== before) {
    await Promise.all([
      user.save(),
      Product.findOneAndUpdate(
        { _id: id, favoritesCount: { $gt: 0 } },
        { $inc: { favoritesCount: -1 } }
      ).exec()
    ]);
  }

  res.json({ favorites: user.favorites });
});
