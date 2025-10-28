import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const toAdminUserResponse = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountType: user.accountType,
  shopName: user.shopName || '',
  shopAddress: user.shopAddress || '',
  shopLogo: user.shopLogo || '',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  isBlocked: Boolean(user.isBlocked),
  blockedAt: user.blockedAt || null,
  blockedReason: user.blockedReason || ''
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalUsers,
    totalShops,
    totalAdmins,
    newUsersLast30Days,
    totalProducts,
    productsPending,
    productsApproved,
    productsRejected,
    productsDisabled,
    totalPayments,
    paymentsWaiting,
    paymentsVerified,
    paymentsRejected,
    totalRevenueAgg,
    revenueLast30Agg,
    favoritesAgg,
    totalComments,
    totalRatings,
    topCategoriesRaw,
    recentUsersRaw,
    recentProductsRaw,
    latestPaymentsRaw,
    usersByMonthRaw,
    productsByMonthRaw,
    revenueByMonthRaw
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountType: 'shop' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Product.countDocuments(),
    Product.countDocuments({ status: 'pending' }),
    Product.countDocuments({ status: 'approved' }),
    Product.countDocuments({ status: 'rejected' }),
    Product.countDocuments({ status: 'disabled' }),
    Payment.countDocuments(),
    Payment.countDocuments({ status: 'waiting' }),
    Payment.countDocuments({ status: 'verified' }),
    Payment.countDocuments({ status: 'rejected' }),
    Payment.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Payment.aggregate([
      { $match: { status: 'verified', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Product.aggregate([{ $group: { _id: null, total: { $sum: '$favoritesCount' } } }]),
    Comment.countDocuments(),
    Rating.countDocuments(),
    Product.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email accountType role createdAt')
      .lean(),
    Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title price status createdAt')
      .populate('user', 'name')
      .lean(),
    Payment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('payerName amount status operator createdAt')
      .populate('product', 'title')
      .populate('user', 'name')
      .lean(),
    User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      }
    ]),
    Product.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      }
    ]),
    Payment.aggregate([
      { $match: { status: 'verified', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;
  const revenueLast30Days = revenueLast30Agg[0]?.total || 0;
  const totalFavorites = favoritesAgg[0]?.total || 0;

  const topCategories = topCategoriesRaw.map((item) => ({
    category: item._id || 'Autres',
    listings: item.count,
    avgPrice: item.avgPrice || 0
  }));

  const recentUsers = recentUsersRaw.map((user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    role: user.role,
    createdAt: user.createdAt
  }));

  const recentProducts = recentProductsRaw.map((product) => ({
    id: product._id,
    title: product.title,
    price: product.price,
    status: product.status,
    owner: product.user ? product.user.name : null,
    createdAt: product.createdAt
  }));

  const latestPayments = latestPaymentsRaw.map((payment) => ({
    id: payment._id,
    payerName: payment.payerName,
    amount: payment.amount,
    status: payment.status,
    operator: payment.operator,
    product: payment.product ? payment.product.title : null,
    user: payment.user ? payment.user.name : null,
    createdAt: payment.createdAt
  }));

  const buildMonthMap = (items, field) => {
    const map = new Map();
    items.forEach((item) => {
      if (!item?._id) return;
      map.set(monthKey(item._id.year, item._id.month), item[field] || 0);
    });
    return map;
  };

  const usersByMonth = buildMonthMap(usersByMonthRaw, 'count');
  const productsByMonth = buildMonthMap(productsByMonthRaw, 'count');
  const revenueByMonth = buildMonthMap(revenueByMonthRaw, 'total');

  const monthly = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date.getFullYear(), date.getMonth() + 1);
    monthly.push({
      month: key,
      newUsers: usersByMonth.get(key) || 0,
      newProducts: productsByMonth.get(key) || 0,
      revenue: revenueByMonth.get(key) || 0
    });
  }

  res.json({
    generatedAt: now,
    users: {
      total: totalUsers,
      shops: totalShops,
      admins: totalAdmins,
      newLast30Days: newUsersLast30Days
    },
    products: {
      total: totalProducts,
      pending: productsPending,
      approved: productsApproved,
      rejected: productsRejected,
      disabled: productsDisabled
    },
    payments: {
      total: totalPayments,
      waiting: paymentsWaiting,
      verified: paymentsVerified,
      rejected: paymentsRejected,
      revenue: totalRevenue,
      revenueLast30Days
    },
    engagement: {
      favorites: totalFavorites,
      comments: totalComments,
      ratings: totalRatings
    },
    topCategories,
    monthly,
    recent: {
      users: recentUsers,
      products: recentProducts,
      payments: latestPayments
    }
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { search = '', accountType, limit = 25 } = req.query;

  const query = {};
  if (accountType && ['person', 'shop'].includes(accountType)) {
    query.accountType = accountType;
  }

  if (search) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const numericLimit = Number(limit) || 25;
  const safeLimit = Math.min(Math.max(numericLimit, 1), 100);

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .select(
      'name email phone role accountType shopName shopAddress shopLogo createdAt updatedAt isBlocked blockedAt blockedReason'
    );

  res.json(users.map(toAdminUserResponse));
});

export const updateUserAccountType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { accountType, shopName, shopAddress, shopLogo } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  if (accountType === 'shop') {
    if (!shopName || !shopAddress) {
      return res
        .status(400)
        .json({ message: 'Veuillez renseigner le nom et l’adresse de la boutique.' });
    }
    user.accountType = 'shop';
    user.shopName = shopName;
    user.shopAddress = shopAddress;
    if (typeof shopLogo !== 'undefined') {
      user.shopLogo = shopLogo || '';
    }
  } else if (accountType === 'person') {
    user.accountType = 'person';
    user.shopName = undefined;
    user.shopAddress = undefined;
    user.shopLogo = undefined;
  } else {
    return res.status(400).json({ message: 'Type de compte invalide.' });
  }

  await user.save();

  res.json(toAdminUserResponse(user));
});

export const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reasonRaw = req.body?.reason ?? '';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de suspendre un administrateur.' });
  }

  if (req.user?.id && user._id.equals(req.user.id)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas suspendre votre propre compte.' });
  }

  user.isBlocked = true;
  user.blockedAt = new Date();
  const trimmed = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  user.blockedReason = trimmed.slice(0, 500);

  await user.save();

  res.json(toAdminUserResponse(user));
});

export const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  user.isBlocked = false;
  user.blockedAt = undefined;
  user.blockedReason = undefined;

  await user.save();

  res.json(toAdminUserResponse(user));
});
