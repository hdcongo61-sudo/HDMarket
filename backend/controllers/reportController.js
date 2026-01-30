import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import ImprovementFeedback from '../models/improvementFeedbackModel.js';
import Complaint from '../models/complaintModel.js';

// Helper function to get date range
const getDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (period) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'week':
      start = new Date(now.setDate(now.getDate() - 7));
      end = new Date();
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(0);
      end = endDate ? new Date(endDate) : new Date();
      break;
    default:
      start = new Date(0);
      end = new Date();
  }

  return { start, end };
};

// Main report generation endpoint
export const generateReport = asyncHandler(async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;

  // Ensure admin
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé' });
  }

  const { start, end } = getDateRange(period, startDate, endDate);

  // 1. User Statistics
  const [
    totalUsers,
    newUsers,
    usersByGender,
    usersByCity,
    convertedToShop,
    suspendedUsers,
    verifiedUsers
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    User.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]),
    User.aggregate([
      { $group: { _id: '$city', count: { $sum: 1 } } }
    ]),
    User.countDocuments({
      accountType: 'shop',
      accountTypeChangedAt: { $gte: start, $lte: end }
    }),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ phoneVerified: true })
  ]);

  // 2. Order Statistics
  const [
    totalOrders,
    newOrders,
    ordersByStatus,
    ordersValue
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' },
          average: { $avg: '$totalPrice' }
        }
      }
    ])
  ]);

  // 3. Product/Annonce Statistics
  const [
    totalProducts,
    newProducts,
    productsByCategory,
    productsByStatus,
    productsWithPayment
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Product.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Product.countDocuments({ payment: { $exists: true, $ne: null } })
  ]);

  // 4. Payment Statistics
  const [
    totalPayments,
    newPayments,
    paymentsByOperator,
    paymentsByStatus,
    paymentsValue
  ] = await Promise.all([
    Payment.countDocuments(),
    Payment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$operator', count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          average: { $avg: '$amount' }
        }
      }
    ])
  ]);

  // 5. Feedback Statistics
  const [
    totalFeedback,
    newFeedback,
    readFeedback,
    unreadFeedback
  ] = await Promise.all([
    ImprovementFeedback.countDocuments(),
    ImprovementFeedback.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ImprovementFeedback.countDocuments({ isRead: true }),
    ImprovementFeedback.countDocuments({ isRead: false })
  ]);

  // 6. Complaint Statistics
  const [
    totalComplaints,
    newComplaints,
    complaintsByStatus
  ] = await Promise.all([
    Complaint.countDocuments(),
    Complaint.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  // 7. Shop Statistics
  const [
    totalShops,
    verifiedShops,
    topShops
  ] = await Promise.all([
    User.countDocuments({ accountType: 'shop' }),
    User.countDocuments({ accountType: 'shop', shopVerified: true }),
    User.find({ accountType: 'shop' })
      .select('shopName followersCount')
      .sort({ followersCount: -1 })
      .limit(5)
      .lean()
  ]);

  // 8. Top Products
  const topProducts = await Product.find()
    .select('title viewsCount favoritesCount price')
    .sort({ viewsCount: -1 })
    .limit(5)
    .lean();

  // 9. Activity by City
  const ordersByCity = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $group: {
        _id: '$userInfo.city',
        count: { $sum: 1 },
        totalValue: { $sum: '$totalPrice' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // 10. Growth Metrics - Calculate previous period for comparison
  const calculatePreviousPeriod = (currentStart, currentEnd) => {
    const duration = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { previousStart, previousEnd };
  };

  const { previousStart, previousEnd } = calculatePreviousPeriod(start, end);
  
  const [
    previousUsers,
    previousProducts,
    previousOrders,
    previousPayments,
    usersByCityPrevious,
    productsByCityPrevious
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
    Product.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
    Order.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
    Payment.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
    User.aggregate([
      { $match: { createdAt: { $gte: previousStart, $lte: previousEnd } } },
      { $group: { _id: '$city', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      { $match: { createdAt: { $gte: previousStart, $lte: previousEnd } } },
      { $group: { _id: '$city', count: { $sum: 1 } } }
    ])
  ]);

  // Calculate monthly growth rate
  const calculateGrowthRate = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(2);
  };

  const monthlyGrowthRate = {
    users: parseFloat(calculateGrowthRate(newUsers, previousUsers)),
    products: parseFloat(calculateGrowthRate(newProducts, previousProducts)),
    orders: parseFloat(calculateGrowthRate(newOrders, previousOrders)),
    payments: parseFloat(calculateGrowthRate(newPayments, previousPayments))
  };

  // Growth by city - Get current period products by city
  const productsByCityCurrent = await Product.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$city', count: { $sum: 1 } } }
  ]);

  const usersByCityMap = usersByCity.reduce((acc, { _id, count }) => {
    acc[_id || 'non-spécifié'] = count;
    return acc;
  }, {});
  const usersByCityPreviousMap = usersByCityPrevious.reduce((acc, { _id, count }) => {
    acc[_id || 'non-spécifié'] = count;
    return acc;
  }, {});
  const productsByCityMap = productsByCityCurrent.reduce((acc, { _id, count }) => {
    acc[_id || 'non-spécifié'] = count;
    return acc;
  }, {});
  const productsByCityPreviousMap = productsByCityPrevious.reduce((acc, { _id, count }) => {
    acc[_id || 'non-spécifié'] = count;
    return acc;
  }, {});

  const growthByCity = {};
  const allCities = new Set([
    ...Object.keys(usersByCityMap),
    ...Object.keys(usersByCityPreviousMap),
    ...Object.keys(productsByCityMap),
    ...Object.keys(productsByCityPreviousMap)
  ]);

  allCities.forEach(city => {
    const currentUsers = usersByCityMap[city] || 0;
    const previousUsers = usersByCityPreviousMap[city] || 0;
    const currentProducts = productsByCityMap[city] || 0;
    const previousProducts = productsByCityPreviousMap[city] || 0;
    
    growthByCity[city] = {
      users: parseFloat(calculateGrowthRate(currentUsers, previousUsers)),
      products: parseFloat(calculateGrowthRate(currentProducts, previousProducts))
    };
  });

  // Seasonal trends - Group by month for the last 12 months
  const twelveMonthsAgo = new Date(end);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const seasonalTrends = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo, $lte: end } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Product.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo, $lte: end } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo, $lte: end } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
  ]);

  // 11. Content Metrics
  const contentMetrics = await Product.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $project: {
        imagesCount: { $size: { $ifNull: ['$images', []] } },
        descriptionLength: { $strLenCP: { $ifNull: ['$description', ''] } },
        price: 1,
        category: 1
      }
    },
    {
      $group: {
        _id: null,
        avgPhotos: { $avg: '$imagesCount' },
        avgDescriptionLength: { $avg: '$descriptionLength' },
        avgPriceByCategory: {
          $push: {
            category: '$category',
            price: '$price'
          }
        }
      }
    }
  ]);

  // Calculate average price by category
  const avgPriceByCategory = await Product.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$category',
        avgPrice: { $avg: '$price' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const contentMetricsData = {
    avgPhotosPerListing: contentMetrics[0]?.avgPhotos 
      ? Math.round(contentMetrics[0].avgPhotos * 100) / 100 
      : 0,
    avgDescriptionLength: contentMetrics[0]?.avgDescriptionLength 
      ? Math.round(contentMetrics[0].avgDescriptionLength) 
      : 0,
    avgPriceByCategory: avgPriceByCategory.reduce((acc, { _id, avgPrice }) => {
      acc[_id] = Math.round(avgPrice);
      return acc;
    }, {})
  };

  // Calculate metrics
  const verificationRate = totalPayments > 0
    ? ((paymentsByStatus.find(p => p._id === 'verified')?.count || 0) / totalPayments * 100).toFixed(2)
    : 0;

  const approvalRate = totalProducts > 0
    ? ((productsByStatus.find(p => p._id === 'approved')?.count || 0) / totalProducts * 100).toFixed(2)
    : 0;

  const shopConversionRate = totalUsers > 0
    ? (totalShops / totalUsers * 100).toFixed(2)
    : 0;

  // Compile report
  const report = {
    period: {
      type: period,
      start: start.toISOString(),
      end: end.toISOString(),
      label: period === 'custom'
        ? `${new Date(start).toLocaleDateString('fr-FR')} - ${new Date(end).toLocaleDateString('fr-FR')}`
        : period === 'today' ? 'Aujourd\'hui'
        : period === 'week' ? 'Cette semaine'
        : period === 'month' ? 'Ce mois'
        : 'Cette année'
    },
    generatedAt: new Date().toISOString(),

    users: {
      total: totalUsers,
      new: newUsers,
      byGender: usersByGender.reduce((acc, { _id, count }) => {
        acc[_id || 'non-spécifié'] = count;
        return acc;
      }, {}),
      byCity: usersByCity.reduce((acc, { _id, count }) => {
        acc[_id || 'non-spécifié'] = count;
        return acc;
      }, {}),
      convertedToShop,
      suspended: suspendedUsers,
      verified: verifiedUsers
    },

    orders: {
      total: totalOrders,
      new: newOrders,
      byStatus: ordersByStatus.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      totalValue: ordersValue[0]?.total || 0,
      averageValue: ordersValue[0]?.average || 0,
      byCity: ordersByCity.map(({ _id, count, totalValue }) => ({
        city: _id || 'non-spécifié',
        count,
        totalValue
      }))
    },

    products: {
      total: totalProducts,
      new: newProducts,
      byCategory: productsByCategory.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      byStatus: productsByStatus.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      withPayment: productsWithPayment,
      topProducts: topProducts.map(p => ({
        title: p.title,
        views: p.viewsCount || 0,
        favorites: p.favoritesCount || 0,
        price: p.price
      }))
    },

    payments: {
      total: totalPayments,
      new: newPayments,
      byOperator: paymentsByOperator.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      byStatus: paymentsByStatus.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      totalValue: paymentsValue[0]?.total || 0,
      averageValue: paymentsValue[0]?.average || 0,
      verificationRate: parseFloat(verificationRate)
    },

    feedback: {
      total: totalFeedback,
      new: newFeedback,
      read: readFeedback,
      unread: unreadFeedback
    },

    complaints: {
      total: totalComplaints,
      new: newComplaints,
      byStatus: complaintsByStatus.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {})
    },

    shops: {
      total: totalShops,
      verified: verifiedShops,
      conversionRate: parseFloat(shopConversionRate),
      topShops: topShops.map(s => ({
        name: s.shopName,
        followers: s.followersCount || 0
      }))
    },

    metrics: {
      approvalRate: parseFloat(approvalRate),
      verificationRate: parseFloat(verificationRate),
      shopConversionRate: parseFloat(shopConversionRate),
      averageOrderValue: ordersValue[0]?.average || 0,
      averagePaymentValue: paymentsValue[0]?.average || 0
    },

    growth: {
      monthlyGrowthRate,
      growthByCity,
      seasonalTrends: {
        users: seasonalTrends[0].map(({ _id, count }) => ({
          period: `${_id.year}-${String(_id.month).padStart(2, '0')}`,
          count
        })),
        products: seasonalTrends[1].map(({ _id, count }) => ({
          period: `${_id.year}-${String(_id.month).padStart(2, '0')}`,
          count
        })),
        orders: seasonalTrends[2].map(({ _id, count, totalValue }) => ({
          period: `${_id.year}-${String(_id.month).padStart(2, '0')}`,
          count,
          totalValue
        }))
      }
    },

    content: contentMetricsData
  };

  res.json(report);
});
