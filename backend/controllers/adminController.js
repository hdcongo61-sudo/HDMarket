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
  shopVerified: Boolean(user.shopVerified),
  shopVerifiedBy: user.shopVerifiedBy
    ? {
        id: user.shopVerifiedBy._id.toString(),
        name: user.shopVerifiedBy.name,
        email: user.shopVerifiedBy.email
      }
    : null,
  shopVerifiedAt: user.shopVerifiedAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  isBlocked: Boolean(user.isBlocked),
  blockedAt: user.blockedAt || null,
  blockedReason: user.blockedReason || ''
});

const ensureAdminRole = (req) => {
  if (req.user?.role !== 'admin') {
    const error = new Error('Seuls les administrateurs peuvent accéder à cette ressource.');
    error.status = 403;
    throw error;
  }
};

const suspendUserProducts = async (userId) => {
  const products = await Product.find({ user: userId, status: { $ne: 'disabled' } }).select(
    '_id status'
  );
  if (!products.length) return;

  const operations = products.map((product) => ({
    updateOne: {
      filter: { _id: product._id },
      update: {
        $set: {
          lastStatusBeforeDisable: product.status,
          status: 'disabled',
          disabledByAdmin: true,
          disabledBySuspension: true
        }
      }
    }
  }));

  if (operations.length) {
    await Product.bulkWrite(operations);
  }
};

const restoreSuspendedProducts = async (userId) => {
  const products = await Product.find({
    user: userId,
    status: 'disabled',
    disabledBySuspension: true
  }).select('_id lastStatusBeforeDisable');

  if (!products.length) return;

  const allowedStatuses = new Set(['pending', 'approved', 'rejected']);

  const operations = products.map((product) => {
    let restoredStatus = product.lastStatusBeforeDisable;
    if (!restoredStatus || !allowedStatuses.has(restoredStatus)) {
      restoredStatus = 'approved';
    }

    return {
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            status: restoredStatus,
            lastStatusBeforeDisable: null,
            disabledByAdmin: false,
            disabledBySuspension: false
          }
        }
      }
    };
  });

  if (operations.length) {
    await Product.bulkWrite(operations);
  }
};

export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalUsers,
    totalShops,
    totalAdmins,
    totalManagers,
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
    revenueByMonthRaw,
    cityStatsRaw,
    genderStatsRaw,
    cityStatsRawProducts,
    genderStatsRawProducts
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountType: 'shop' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'manager' }),
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
      .select('payerName amount status operator createdAt validatedAt')
      .populate('product', 'title')
      .populate('user', 'name')
      .populate('validatedBy', 'name')
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
    ]),
    User.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]),
    User.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]),
    Product.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]),
    Product.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'owner',
          pipeline: [{ $project: { gender: 1 } }]
        }
      },
      { $unwind: '$owner' },
      {
        $group: {
          _id: '$owner.gender',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } }
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
    validator: payment.validatedBy ? payment.validatedBy.name : null,
    validatedAt: payment.validatedAt || null,
    createdAt: payment.createdAt
  }));

  const cityStats = cityStatsRaw.map((item) => ({
    city: item._id || 'Non renseignée',
    count: item.count || 0
  }));

  const genderStats = genderStatsRaw.map((item) => ({
    gender: item._id || 'Non renseigné',
    count: item.count || 0
  }));
  const productCityStats = cityStatsRawProducts.map((item) => ({
    city: item._id || 'Non renseignée',
    count: item.count || 0
  }));
  const productGenderStats = genderStatsRawProducts.map((item) => ({
    gender: item._id || 'Non renseigné',
    count: item.count || 0
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
      managers: totalManagers,
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
    demographics: {
      cities: cityStats,
      genders: genderStats,
      productCities: productCityStats,
      productGenders: productGenderStats
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
  ensureAdminRole(req);
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
      'name email phone role accountType shopName shopAddress shopLogo shopVerified shopVerifiedBy shopVerifiedAt createdAt updatedAt isBlocked blockedAt blockedReason'
    )
    .populate('shopVerifiedBy', 'name email');

  res.json(users.map(toAdminUserResponse));
});

export const updateUserAccountType = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
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
    user.shopVerified = false;
    user.shopVerifiedBy = null;
    user.shopVerifiedAt = null;
  } else if (accountType === 'person') {
    user.accountType = 'person';
    user.shopName = undefined;
    user.shopAddress = undefined;
    user.shopLogo = undefined;
    user.shopVerified = false;
    user.shopVerifiedBy = null;
    user.shopVerifiedAt = null;
  } else {
    return res.status(400).json({ message: 'Type de compte invalide.' });
  }

  await user.save();

  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json(toAdminUserResponse(populated));
});

export const blockUser = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
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
  await suspendUserProducts(user._id);
  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json(toAdminUserResponse(populated));
});

export const unblockUser = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
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
  await restoreSuspendedProducts(user._id);

  res.json(toAdminUserResponse(user));
});

export const updateShopVerification = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;
  const { verified } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  if (user.accountType !== 'shop') {
    return res.status(400).json({ message: 'Cet utilisateur n’est pas une boutique.' });
  }

  user.shopVerified = Boolean(verified);
  user.shopVerifiedBy = verified ? req.user.id : null;
  user.shopVerifiedAt = verified ? new Date() : null;
  await user.save();
  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json(toAdminUserResponse(populated));
});

export const updateUserRole = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;
  const { role } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  if (!['user', 'manager'].includes(role)) {
    return res.status(400).json({ message: 'Rôle non autorisé.' });
  }

  if (req.user?.id && id === req.user.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas modifier votre propre rôle.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier le rôle d’un administrateur.' });
  }

  user.role = role;
  await user.save();

  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json(toAdminUserResponse(populated));
});

export const listVerifiedShopsAdmin = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const shops = await User.find({ accountType: 'shop', shopVerified: true })
    .select(
      'shopName shopAddress shopLogo shopVerifiedAt shopVerifiedBy phone city country'
    )
    .populate('shopVerifiedBy', 'name email');

  res.json(
    shops.map((shop) => ({
      id: shop._id,
      shopName: shop.shopName || '',
      shopAddress: shop.shopAddress || '',
      shopLogo: shop.shopLogo || '',
      shopVerifiedAt: shop.shopVerifiedAt,
      shopVerifiedBy: shop.shopVerifiedBy
        ? {
            id: shop.shopVerifiedBy._id,
            name: shop.shopVerifiedBy.name,
            email: shop.shopVerifiedBy.email
          }
        : null
    }))
  );
});
