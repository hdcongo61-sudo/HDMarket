import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import Order from '../models/orderModel.js';
import ImprovementFeedback from '../models/improvementFeedbackModel.js';
import AccountTypeChange from '../models/accountTypeChangeModel.js';
import AdminAuditLog from '../models/adminAuditLogModel.js';
import { createNotification } from '../utils/notificationService.js';
import { updateProductSalesCount } from '../utils/salesCalculator.js';
import { getRestrictionTypes, formatRestriction, getRestrictionLabel } from '../utils/restrictionCheck.js';

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

  const toAdminUserResponse = (user) => {
    const restrictions = {};
    const restrictionTypes = getRestrictionTypes();
    for (const type of restrictionTypes) {
      restrictions[type] = formatRestriction(user.restrictions?.[type]);
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accountType: user.accountType,
      accountTypeChangedBy: user.accountTypeChangedBy,
      accountTypeChangedAt: user.accountTypeChangedAt,
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
      followersCount: Number(user.followersCount || 0),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isBlocked: Boolean(user.isBlocked),
      blockedAt: user.blockedAt || null,
      blockedReason: user.blockedReason || '',
      restrictions
    };
  };

const ensureAdminRole = (req) => {
  if (req.user?.role !== 'admin') {
    const error = new Error('Seuls les administrateurs peuvent accéder à cette ressource.');
    error.status = 403;
    throw error;
  }
};

/**
 * Create an admin audit log entry
 * @param {Object} params - Log parameters
 * @param {string} params.action - Action type (e.g., 'restriction_applied')
 * @param {string} params.targetUser - Target user ID
 * @param {string} params.performedBy - Admin user ID
 * @param {Object} params.details - Additional details
 * @param {string} [params.ipAddress] - IP address of the admin
 */
const createAuditLog = async ({ action, targetUser, performedBy, details, ipAddress }) => {
  try {
    await AdminAuditLog.create({
      action,
      targetUser,
      performedBy,
      details,
      ipAddress
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't fail the main operation if audit logging fails
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
    orderStatusAgg,
    favoritesAgg,
    totalComments,
    totalRatings,
    unreadFeedback,
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
    Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
          paidAmount: { $sum: { $ifNull: ['$paidAmount', 0] } },
          remainingAmount: { $sum: { $ifNull: ['$remainingAmount', 0] } }
        }
      }
    ]),
    Product.aggregate([{ $group: { _id: null, total: { $sum: '$favoritesCount' } } }]),
    Comment.countDocuments(),
    Rating.countDocuments(),
    ImprovementFeedback.countDocuments({ readAt: null }),
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
  const orderStatuses = ['pending', 'confirmed', 'delivering', 'delivered'];
  const ordersByStatus = orderStatuses.reduce((acc, status) => {
    acc[status] = { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0 };
    return acc;
  }, {});
  orderStatusAgg.forEach((entry) => {
    if (!entry || !ordersByStatus[entry._id]) return;
    const totalAmount = Number(entry.totalAmount || 0);
    const paidAmount = Number(entry.paidAmount || 0);
    const remainingAmount = Number(entry.remainingAmount || 0);
    const isDelivered = entry._id === 'delivered';
    ordersByStatus[entry._id] = {
      count: Number(entry.count || 0),
      totalAmount,
      paidAmount: isDelivered ? totalAmount : paidAmount,
      remainingAmount: isDelivered ? 0 : remainingAmount
    };
  });
  const orderTotals = orderStatuses.reduce(
    (acc, status) => {
      const data = ordersByStatus[status];
      acc.total += Number(data.count || 0);
      acc.totalAmount += Number(data.totalAmount || 0);
      acc.paidAmount += Number(data.paidAmount || 0);
      acc.remainingAmount += Number(data.remainingAmount || 0);
      return acc;
    },
    { total: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0 }
  );

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
    feedback: {
      unread: unreadFeedback
    },
    orders: {
      total: orderTotals.total,
      totalAmount: orderTotals.totalAmount,
      paidAmount: orderTotals.paidAmount,
      remainingAmount: orderTotals.remainingAmount,
      byStatus: ordersByStatus
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

// Analytics endpoints for real-time dashboard
export const getSalesTrends = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { days = 30 } = req.query;
  const daysNum = Number(days);
  const validDays = [7, 30, 90].includes(daysNum) ? daysNum : 30;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - validDays);

  // Get sales data grouped by day
  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: now },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        avgOrderValue: { $avg: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Format data for chart
  const trends = salesData.map((item) => {
    const date = new Date(item._id.year, item._id.month - 1, item._id.day);
    return {
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      orders: item.count,
      revenue: item.totalRevenue || 0,
      avgOrderValue: Math.round(item.avgOrderValue || 0)
    };
  });

  res.json({ period: validDays, trends });
});

export const getOrderHeatmap = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get orders grouped by hour of day
  const heatmapData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo, $lte: now }
      }
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Format for heatmap (24 hours)
  const heatmap = Array.from({ length: 24 }, (_, hour) => {
    const data = heatmapData.find((d) => d._id === hour);
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      count: data?.count || 0,
      revenue: data?.totalRevenue || 0
    };
  });

  res.json({ heatmap });
});

export const getConversionMetrics = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get product views (approximated by viewsCount)
  const totalViews = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$viewsCount' }
      }
    }
  ]);

  // Get unique visitors (users who viewed products)
  const uniqueVisitors = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo }
  });

  // Get orders
  const ordersData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo, $lte: now }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        uniqueCustomers: { $addToSet: '$customer' }
      }
    }
  ]);

  const totalOrders = ordersData[0]?.totalOrders || 0;
  const uniqueCustomers = ordersData[0]?.uniqueCustomers?.length || 0;
  const totalViewsCount = totalViews[0]?.totalViews || 0;

  // Calculate conversion rates
  const visitorToOrderRate = uniqueVisitors > 0
    ? ((uniqueCustomers / uniqueVisitors) * 100).toFixed(2)
    : 0;
  const viewToOrderRate = totalViewsCount > 0
    ? ((totalOrders / totalViewsCount) * 100).toFixed(4)
    : 0;

  // Get conversion funnel data
  const funnel = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo, $lte: now }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    period: 30,
    metrics: {
      totalViews: totalViewsCount,
      uniqueVisitors,
      uniqueCustomers,
      totalOrders,
      visitorToOrderRate: parseFloat(visitorToOrderRate),
      viewToOrderRate: parseFloat(viewToOrderRate)
    },
    funnel: funnel.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  });
});

export const getCohortAnalysis = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // Get users grouped by signup month
  const userCohorts = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        users: { $push: '$_id' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // For each cohort, check retention (users who made orders)
  const cohorts = await Promise.all(
    userCohorts.map(async (cohort) => {
      const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
      const cohortKey = `${cohort._id.year}-${String(cohort._id.month).padStart(2, '0')}`;
      
      // Count users who made at least one order
      const activeUsers = await Order.distinct('customer', {
        customer: { $in: cohort.users },
        createdAt: { $gte: cohortDate }
      });

      // Get orders by month for this cohort
      const ordersByMonth = await Order.aggregate([
        {
          $match: {
            customer: { $in: cohort.users },
            createdAt: { $gte: cohortDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return {
        cohort: cohortKey,
        label: cohortDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        totalUsers: cohort.users.length,
        activeUsers: activeUsers.length,
        retentionRate: cohort.users.length > 0
          ? ((activeUsers.length / cohort.users.length) * 100).toFixed(2)
          : 0,
        ordersByMonth: ordersByMonth.map((item) => ({
          period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          orders: item.count,
          revenue: item.revenue || 0
        }))
      };
    })
  );

  res.json({ cohorts });
});

export const getOrdersByHour = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { hour } = req.query;
  const hourNum = Number(hour);
  
  if (Number.isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
    return res.status(400).json({ message: 'Heure invalide. Doit être entre 0 et 23.' });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get orders created at the specified hour in the last 30 days using aggregation
  const ordersAgg = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: thirtyDaysAgo,
          $lte: now
        }
      }
    },
    {
      $addFields: {
        orderHour: { $hour: '$createdAt' }
      }
    },
    {
      $match: {
        orderHour: hourNum
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $limit: 100
    },
    {
      $lookup: {
        from: 'users',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerData'
      }
    },
    {
      $unwind: { path: '$customerData', preserveNullAndEmptyArrays: true }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productData'
      }
    }
  ]);

  // Populate items with product data
  const orders = await Promise.all(
    ordersAgg.map(async (order) => {
      const customer = order.customerData ? {
        name: order.customerData.name,
        email: order.customerData.email,
        phone: order.customerData.phone
      } : null;

      const items = (order.items || []).map((item) => {
        const productId = item.product?.toString() || item.product;
        const product = order.productData?.find((p) => p._id.toString() === productId);
        
        return {
          product: product ? {
            title: product.title,
            price: product.price,
            image: Array.isArray(product.images) ? product.images[0] : null
          } : item.snapshot,
          quantity: item.quantity || 1
        };
      });

      return {
        id: order._id,
        customer,
        items,
        status: order.status,
        totalAmount: order.totalAmount || 0,
        paidAmount: order.paidAmount || 0,
        remainingAmount: order.remainingAmount || 0,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        deliveryCode: order.deliveryCode,
        createdAt: order.createdAt
      };
    })
  );

  res.json({
    hour: hourNum,
    count: orders.length,
    orders
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
      'name email phone role accountType shopName shopAddress shopLogo shopVerified shopVerifiedBy shopVerifiedAt createdAt updatedAt isBlocked blockedAt blockedReason followersCount restrictions'
    )
    .populate('shopVerifiedBy', 'name email');

  res.json(users.map(toAdminUserResponse));
});

export const updateUserAccountType = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;
  const { accountType, shopName, shopAddress, shopLogo, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  // Store previous state for tracking
  const previousType = user.accountType;
  const previousShopData = {
    shopName: user.shopName || null,
    shopAddress: user.shopAddress || null,
    shopLogo: user.shopLogo || null,
    shopVerified: user.shopVerified || false
  };

  // Check if there's an actual change
  if (previousType === accountType) {
    // Allow updating shop details even if accountType hasn't changed
    if (accountType === 'shop' && (shopName || shopAddress)) {
      user.shopName = shopName || user.shopName;
      user.shopAddress = shopAddress || user.shopAddress;
      if (typeof shopLogo !== 'undefined') {
        user.shopLogo = shopLogo || '';
      }
      user.accountTypeChangedBy = req.user.id;
      user.accountTypeChangedAt = new Date();
      await user.save();
      
      const populated = await user.populate('shopVerifiedBy', 'name email');
      return res.json({
        message: 'Informations de la boutique mises a jour.',
        user: toAdminUserResponse(populated)
      });
    }
    return res.status(400).json({ message: 'Le type de compte est deja ' + accountType + '.' });
  }

  if (accountType === 'shop') {
    if (!shopName || !shopAddress) {
      return res
        .status(400)
        .json({ message: "Veuillez renseigner le nom et l'adresse de la boutique." });
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
    // Keep all shop information and data when reconverting to particulier
    // Only reset verification status since it's shop-specific
    user.shopVerified = false;
    user.shopVerifiedBy = null;
    user.shopVerifiedAt = null;
    // shopName, shopAddress, shopLogo, shopDescription, shopHours, shopBanner are preserved
  } else {
    return res.status(400).json({ message: 'Type de compte invalide.' });
  }

  // Track who made the change and when
  user.accountTypeChangedBy = req.user.id;
  user.accountTypeChangedAt = new Date();

  await user.save();

  // Create change history record
  try {
    await AccountTypeChange.create({
      user: user._id,
      changedBy: req.user.id,
      previousType,
      newType: accountType,
      previousShopData,
      newShopData: {
        shopName: accountType === 'shop' ? shopName : (user.shopName || null),
        shopAddress: accountType === 'shop' ? shopAddress : (user.shopAddress || null),
        shopLogo: accountType === 'shop' ? (shopLogo || '') : (user.shopLogo || null),
        shopDescription: user.shopDescription || null,
        shopBanner: user.shopBanner || null
      },
      reason: reason || ''
    });
  } catch (error) {
    console.error('Failed to create account type change record:', error);
    // Don't fail the request if history tracking fails
  }

  // Create audit log
  try {
    await createAuditLog({
      action: accountType === 'shop' ? 'account_type_changed_to_shop' : 'account_type_changed_to_person',
      targetUser: user._id,
      performedBy: req.user.id,
      details: {
        userName: user.name,
        userEmail: user.email,
        previousType,
        newType: accountType,
        shopName: accountType === 'shop' ? shopName : (user.shopName || null),
        shopAddress: accountType === 'shop' ? shopAddress : (user.shopAddress || null),
        shopLogo: accountType === 'shop' ? (shopLogo || null) : (user.shopLogo || null),
        shopDescription: accountType === 'shop' ? (user.shopDescription || null) : (user.shopDescription || null),
        reason: reason || ''
      },
      ipAddress: req.ip || req.connection?.remoteAddress
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't fail the request if audit log creation fails
  }

  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json({
    message: `Type de compte mis a jour vers : ${accountType === 'shop' ? 'Boutique' : 'Particulier'}.`,
    user: toAdminUserResponse(populated)
  });
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

  // Create audit log
  await createAuditLog({
    action: 'user_blocked',
    targetUser: user._id,
    performedBy: req.user.id,
    details: {
      userName: user.name,
      userEmail: user.email,
      reason: user.blockedReason
    },
    ipAddress: req.ip || req.connection?.remoteAddress
  });

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

  // Create audit log
  await createAuditLog({
    action: 'user_unblocked',
    targetUser: user._id,
    performedBy: req.user.id,
    details: {
      userName: user.name,
      userEmail: user.email
    },
    ipAddress: req.ip || req.connection?.remoteAddress
  });

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

  const previouslyVerified = Boolean(user.shopVerified);
  const shouldVerify = Boolean(verified);
  user.shopVerified = shouldVerify;
  user.shopVerifiedBy = shouldVerify ? req.user.id : null;
  user.shopVerifiedAt = shouldVerify ? new Date() : null;
  await user.save();
  const populated = await user.populate('shopVerifiedBy', 'name email');

  // Create audit log if status changed
  if (previouslyVerified !== shouldVerify) {
    await createAuditLog({
      action: shouldVerify ? 'shop_verified' : 'shop_unverified',
      targetUser: user._id,
      performedBy: req.user.id,
      details: {
        userName: user.name,
        shopName: user.shopName || '',
        previouslyVerified,
        nowVerified: shouldVerify
      },
      ipAddress: req.ip || req.connection?.remoteAddress
    });
  }

  if (shouldVerify && !previouslyVerified) {
    await createNotification({
      userId: user._id,
      actorId: req.user.id,
      type: 'shop_verified',
      metadata: {
        shopName: user.shopName || '',
        verifiedAt: user.shopVerifiedAt
      }
    });
  }
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
    return res.status(400).json({ message: "Impossible de modifier le rôle d'un administrateur." });
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  // Create audit log
  await createAuditLog({
    action: 'role_changed',
    targetUser: user._id,
    performedBy: req.user.id,
    details: {
      userName: user.name,
      userEmail: user.email,
      previousRole,
      newRole: role
    },
    ipAddress: req.ip || req.connection?.remoteAddress
  });

  const populated = await user.populate('shopVerifiedBy', 'name email');
  res.json(toAdminUserResponse(populated));
});

export const updateAllProductSalesCount = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  try {
    const result = await updateProductSalesCount();
    res.json({
      message: 'Mise à jour des ventes réussie',
      updated: result.updated,
      withSales: result.withSales
    });
  } catch (error) {
    res.status(500).json({
      message: 'Erreur lors de la mise à jour des ventes',
      error: error.message
    });
  }
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

export const getUserAccountTypeHistory = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const history = await AccountTypeChange.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('changedBy', 'name email')
    .lean();

  res.json({
    history,
    total: history.length
  });
});

export const listPaymentVerifiers = asyncHandler(async (req, res) => {
  ensureAdminRole(req);

  const verifiers = await User.find({ canVerifyPayments: true })
    .select('_id name email phone canVerifyPayments')
    .sort({ name: 1 })
    .lean();

  const formattedVerifiers = verifiers.map(verifier => ({
    id: verifier._id.toString(),
    name: verifier.name,
    email: verifier.email,
    phone: verifier.phone,
    canVerifyPayments: Boolean(verifier.canVerifyPayments)
  }));

  res.json({ verifiers: formattedVerifiers });
});

export const listBoostManagers = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const managers = await User.find({ canManageBoosts: true })
    .select('_id name email phone canManageBoosts')
    .sort({ name: 1 })
    .lean();
  res.json(
    managers.map((manager) => ({
      _id: manager._id.toString(),
      name: manager.name,
      email: manager.email,
      phone: manager.phone,
      canManageBoosts: Boolean(manager.canManageBoosts)
    }))
  );
});

export const toggleBoostManager = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  
  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier les permissions d\'un administrateur.' });
  }
  
  user.canManageBoosts = !user.canManageBoosts;
  await user.save();
  res.json({
    message: user.canManageBoosts
      ? 'Utilisateur ajouté comme gestionnaire de boosts.'
      : 'Permission de gestion des boosts retirée.',
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      canManageBoosts: user.canManageBoosts
    }
  });
});

export const togglePaymentVerifier = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier les permissions d\'un administrateur.' });
  }

  // Toggle the permission
  user.canVerifyPayments = !user.canVerifyPayments;
  await user.save();

  res.json({
    message: user.canVerifyPayments
      ? 'Utilisateur ajouté comme vérificateur de paiements.'
      : 'Permission de vérificateur de paiements retirée.',
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      canVerifyPayments: user.canVerifyPayments
    }
  });
});

export const listComplaintManagers = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const managers = await User.find({ canManageComplaints: true })
    .select('_id name email phone canManageComplaints')
    .sort({ name: 1 })
    .lean();
  res.json({
    managers: managers.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      email: m.email,
      phone: m.phone,
      canManageComplaints: Boolean(m.canManageComplaints)
    }))
  });
});

export const toggleComplaintManager = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier les permissions d\'un administrateur.' });
  }
  user.canManageComplaints = !user.canManageComplaints;
  await user.save();
  res.json({
    message: user.canManageComplaints
      ? 'Utilisateur ajouté comme responsable des réclamations.'
      : 'Permission responsable réclamations retirée.',
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      canManageComplaints: user.canManageComplaints
    }
  });
});

/** Broadcast a notification to all users (or filtered by accountType). Admin only. */
export const broadcastNotification = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { message, title, target = 'all' } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Le message de la notification est requis.' });
  }
  const filter = { role: { $in: ['user', 'manager'] } };
  if (target === 'person') {
    filter.accountType = 'person';
  } else if (target === 'shop') {
    filter.accountType = 'shop';
  }
  const users = await User.find(filter).select('_id').lean();
  const actorId = req.user.id;
  const trimmedMessage = message.trim();
  const trimmedTitle = title && typeof title === 'string' ? title.trim() : 'HDMarketCG';
  let sent = 0;
  for (const u of users) {
    if (String(u._id) === actorId) continue;
    const created = await createNotification({
      userId: u._id,
      actorId,
      type: 'admin_broadcast',
      metadata: { message: trimmedMessage, title: trimmedTitle }
    });
    if (created) sent++;
  }
  res.json({
    success: true,
    sent,
    total: users.length,
    message: `Notification envoyée à ${sent} utilisateur(s).`
  });
});

/** Export user phone numbers (admin only). Query: target = all | person | shop */
export const exportPhones = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const target = req.query.target || 'all';
  const filter = { role: { $in: ['user', 'manager'] } };
  if (target === 'person') {
    filter.accountType = 'person';
  } else if (target === 'shop') {
    filter.accountType = 'shop';
  }
  const users = await User.find(filter)
    .select('name email phone accountType')
    .sort({ createdAt: 1 })
    .lean();
  const list = users.map((u) => ({
    phone: u.phone || '',
    name: u.name || '',
    email: u.email || '',
    accountType: u.accountType || 'person'
  }));
  res.json({ users: list, total: list.length });
});

// ============================================================================
// USER RESTRICTIONS MANAGEMENT
// ============================================================================

const VALID_RESTRICTION_TYPES = ['canComment', 'canOrder', 'canMessage', 'canAddFavorites', 'canUploadImages', 'canBeViewed'];

/** Get all restrictions for a user */
export const getUserRestrictions = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id).select('restrictions name email');
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  const restrictions = {};
  for (const type of VALID_RESTRICTION_TYPES) {
    restrictions[type] = formatRestriction(user.restrictions?.[type]);
  }

  res.json({ userId: id, restrictions });
});

/** Apply or update a restriction for a user */
export const setUserRestriction = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id, type } = req.params;
  const { restricted, startDate, endDate, reason } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  if (!VALID_RESTRICTION_TYPES.includes(type)) {
    return res.status(400).json({
      message: `Type de restriction invalide. Types valides: ${VALID_RESTRICTION_TYPES.join(', ')}`
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Impossible de restreindre un administrateur.' });
  }

  if (req.user?.id && user._id.equals(req.user.id)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas vous restreindre vous-même.' });
  }

  // Initialize restrictions object if it doesn't exist
  if (!user.restrictions) {
    user.restrictions = {};
  }

  // Parse dates
  let parsedStartDate = null;
  let parsedEndDate = null;

  if (startDate) {
    parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({ message: 'Date de début invalide.' });
    }
  }

  if (endDate) {
    parsedEndDate = new Date(endDate);
    if (isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: 'Date de fin invalide.' });
    }
  }

  if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
    return res.status(400).json({ message: 'La date de fin doit être après la date de début.' });
  }

  // Set the restriction
  const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  const wasRestricted = user.restrictions?.[type]?.restricted || false;

  user.restrictions[type] = {
    restricted: Boolean(restricted),
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    reason: trimmedReason,
    restrictedBy: restricted ? req.user.id : null,
    restrictedAt: restricted ? new Date() : null
  };

  await user.save();

  // Create audit log
  await createAuditLog({
    action: restricted ? 'restriction_applied' : 'restriction_removed',
    targetUser: user._id,
    performedBy: req.user.id,
    details: {
      userName: user.name,
      userEmail: user.email,
      restrictionType: type,
      restrictionLabel: getRestrictionLabel(type),
      wasRestricted,
      isRestricted: Boolean(restricted),
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      reason: trimmedReason
    },
    ipAddress: req.ip || req.connection?.remoteAddress
  });

  // Send notification to user when restriction is applied
  if (restricted) {
    const restrictionLabel = getRestrictionLabel(type);
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

    let dateInfo = '';
    if (parsedStartDate && parsedEndDate) {
      dateInfo = `Du ${parsedStartDate.toLocaleDateString('fr-FR', dateOptions)} au ${parsedEndDate.toLocaleDateString('fr-FR', dateOptions)}`;
    } else if (parsedStartDate) {
      dateInfo = `À partir du ${parsedStartDate.toLocaleDateString('fr-FR', dateOptions)}`;
    } else if (parsedEndDate) {
      dateInfo = `Jusqu'au ${parsedEndDate.toLocaleDateString('fr-FR', dateOptions)}`;
    } else {
      dateInfo = 'Immédiat et permanent';
    }

    const notificationMessage = trimmedReason
      ? `Restriction "${restrictionLabel}" appliquée. ${dateInfo}. Raison: ${trimmedReason}`
      : `Restriction "${restrictionLabel}" appliquée. ${dateInfo}.`;

    await createNotification({
      userId: user._id,
      actorId: req.user.id,
      type: 'account_restriction',
      metadata: {
        restrictionType: type,
        restrictionLabel,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        reason: trimmedReason,
        message: notificationMessage
      }
    });
  } else if (wasRestricted) {
    const restrictionLabel = getRestrictionLabel(type);
    await createNotification({
      userId: user._id,
      actorId: req.user.id,
      type: 'account_restriction_lifted',
      metadata: {
        restrictionType: type,
        restrictionLabel,
        message: `Votre restriction "${restrictionLabel}" a été levée. Vous pouvez à nouveau utiliser cette fonctionnalité.`
      }
    });
  }

  res.json({
    message: restricted
      ? `Restriction "${type}" appliquée avec succès.`
      : `Restriction "${type}" désactivée.`,
    restriction: formatRestriction(user.restrictions[type])
  });
});

/** Remove a restriction from a user */
export const removeUserRestriction = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id, type } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  if (!VALID_RESTRICTION_TYPES.includes(type)) {
    return res.status(400).json({
      message: `Type de restriction invalide. Types valides: ${VALID_RESTRICTION_TYPES.join(', ')}`
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  const wasRestricted = user.restrictions?.[type]?.restricted;

  if (user.restrictions?.[type]) {
    const previousRestriction = { ...user.restrictions[type].toObject?.() || user.restrictions[type] };

    user.restrictions[type] = {
      restricted: false,
      startDate: null,
      endDate: null,
      reason: '',
      restrictedBy: null,
      restrictedAt: null
    };
    await user.save();

    // Create audit log
    if (wasRestricted) {
      await createAuditLog({
        action: 'restriction_removed',
        targetUser: user._id,
        performedBy: req.user.id,
        details: {
          userName: user.name,
          userEmail: user.email,
          restrictionType: type,
          restrictionLabel: getRestrictionLabel(type),
          previousRestriction: {
            startDate: previousRestriction.startDate,
            endDate: previousRestriction.endDate,
            reason: previousRestriction.reason
          }
        },
        ipAddress: req.ip || req.connection?.remoteAddress
      });
    }

    // Send notification if restriction was previously active
    if (wasRestricted) {
      const restrictionLabel = getRestrictionLabel(type);
      await createNotification({
        userId: user._id,
        actorId: req.user.id,
        type: 'account_restriction_lifted',
        metadata: {
          restrictionType: type,
          restrictionLabel,
          message: `Votre restriction "${restrictionLabel}" a été levée. Vous pouvez à nouveau utiliser cette fonctionnalité.`
        }
      });
    }
  }

  res.json({
    message: `Restriction "${type}" supprimée.`,
    restriction: formatRestriction(user.restrictions?.[type])
  });
});

/** Get orders received by a seller (orders containing their products) */
export const getSellerReceivedOrders = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const status = req.query.status || 'all';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const user = await User.findById(id).select('name email accountType shopName');
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  // Find all products owned by this seller
  const sellerProductIds = await Product.find({ user: id }).distinct('_id');

  if (sellerProductIds.length === 0) {
    return res.json({
      seller: { id: user._id, name: user.name, shopName: user.shopName || '' },
      orders: [],
      total: 0,
      page,
      totalPages: 0
    });
  }

  // Build order filter
  const orderFilter = { 'items.product': { $in: sellerProductIds } };
  if (status !== 'all') {
    orderFilter.status = status;
  }

  const total = await Order.countDocuments(orderFilter);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const orders = await Order.find(orderFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name email phone')
    .populate('items.product', 'title images price')
    .lean();

  // Filter items to only show this seller's products
  const formattedOrders = orders.map((order) => ({
    id: order._id.toString(),
    orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
    status: order.status,
    createdAt: order.createdAt,
    buyer: order.user ? {
      id: order.user._id.toString(),
      name: order.user.name,
      email: order.user.email,
      phone: order.user.phone
    } : null,
    items: order.items
      .filter((item) => sellerProductIds.some((pid) => pid.equals(item.product?._id)))
      .map((item) => ({
        product: item.product ? {
          id: item.product._id.toString(),
          title: item.product.title,
          image: item.product.images?.[0] || null,
          price: item.product.price
        } : null,
        quantity: item.quantity,
        price: item.price
      })),
    totalAmount: order.totalAmount,
    address: order.address || null
  }));

  res.json({
    seller: { id: user._id, name: user.name, shopName: user.shopName || '' },
    orders: formattedOrders,
    total,
    page,
    totalPages
  });
});

// ============================================================================
// ADMIN AUDIT LOGS
// ============================================================================

/** List audit logs with filtering and pagination */
export const listAuditLogs = asyncHandler(async (req, res) => {
  ensureAdminRole(req);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const { action, targetUser, performedBy, startDate, endDate } = req.query;

  const filter = {};

  // Filter by action type
  if (action && typeof action === 'string') {
    filter.action = action;
  }

  // Filter by target user
  if (targetUser && mongoose.Types.ObjectId.isValid(targetUser)) {
    filter.targetUser = targetUser;
  }

  // Filter by admin who performed the action
  if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
    filter.performedBy = performedBy;
  }

  // Filter by date range
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        filter.createdAt.$gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        filter.createdAt.$lte = parsedEnd;
      }
    }
  }

  const total = await AdminAuditLog.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const logs = await AdminAuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('targetUser', 'name email phone shopName accountType')
    .populate('performedBy', 'name email')
    .lean();

  const formattedLogs = logs.map((log) => ({
    id: log._id.toString(),
    action: log.action,
    targetUser: log.targetUser ? {
      id: log.targetUser._id.toString(),
      name: log.targetUser.name,
      email: log.targetUser.email,
      shopName: log.targetUser.shopName || '',
      accountType: log.targetUser.accountType
    } : null,
    performedBy: log.performedBy ? {
      id: log.performedBy._id.toString(),
      name: log.performedBy.name,
      email: log.performedBy.email
    } : null,
    details: log.details || {},
    ipAddress: log.ipAddress,
    createdAt: log.createdAt
  }));

  res.json({
    logs: formattedLogs,
    total,
    page,
    totalPages,
    limit
  });
});

/** Get audit logs for a specific user */
export const getUserAuditLogs = asyncHandler(async (req, res) => {
  ensureAdminRole(req);
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { targetUser: id };
  const total = await AdminAuditLog.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  const logs = await AdminAuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('performedBy', 'name email')
    .lean();

  const formattedLogs = logs.map((log) => ({
    id: log._id.toString(),
    action: log.action,
    performedBy: log.performedBy ? {
      id: log.performedBy._id.toString(),
      name: log.performedBy.name,
      email: log.performedBy.email
    } : null,
    details: log.details || {},
    ipAddress: log.ipAddress,
    createdAt: log.createdAt
  }));

  res.json({
    logs: formattedLogs,
    total,
    page,
    totalPages
  });
});
