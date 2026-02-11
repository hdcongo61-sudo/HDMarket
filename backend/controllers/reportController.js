import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import Order from '../models/orderModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import ImprovementFeedback from '../models/improvementFeedbackModel.js';
import Complaint from '../models/complaintModel.js';
import AccountTypeChange from '../models/accountTypeChangeModel.js';

const getPeriodDates = (period, startDate, endDate) => {
  const now = new Date();
  let start, end, label;

  switch (period) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      label = 'Aujourd\'hui';
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      label = 'Cette semaine';
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      label = 'Ce mois';
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      label = 'Cette année';
      break;
    case 'custom':
      if (!startDate || !endDate) {
        throw new Error('Dates de début et de fin requises pour une période personnalisée.');
      }
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      label = `Du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
      break;
    default:
      throw new Error('Période invalide.');
  }

  return { start, end, label, type: period };
};

export const generateReport = asyncHandler(async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;
  const { start, end, label, type } = getPeriodDates(period, startDate, endDate);

  // Users stats
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
    AccountTypeChange.countDocuments({ newAccountType: 'shop', createdAt: { $gte: start, $lte: end } }),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ phoneVerified: true })
  ]);

  const usersByGenderMap = usersByGender.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

  const usersByCityMap = usersByCity.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

  // Orders stats
  const [
    totalOrders,
    newOrders,
    ordersByStatus,
    ordersValue
  ] = await Promise.all([
    Order.countDocuments({ isDraft: { $ne: true } }),
    Order.countDocuments({ isDraft: { $ne: true }, createdAt: { $gte: start, $lte: end } }),
    Order.aggregate([
      { $match: { isDraft: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
    ]),
    Order.aggregate([
      { $match: { isDraft: { $ne: true } } },
      { $group: { _id: null, totalValue: { $sum: { $ifNull: ['$totalAmount', 0] } }, avgValue: { $avg: { $ifNull: ['$totalAmount', 0] } } } }
    ])
  ]);

  const ordersByStatusMap = ordersByStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const totalOrderValue = ordersValue[0]?.totalValue || 0;
  const avgOrderValue = ordersValue[0]?.avgValue || 0;

  // Products stats
  const [
    totalProducts,
    newProducts,
    productsByStatus,
    productsByCategory,
    productsWithPayment
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Product.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    Product.countDocuments({ payment: { $exists: true, $ne: null } })
  ]);

  const productsByStatusMap = productsByStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const productsByCategoryMap = productsByCategory.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  // Payments stats
  const [
    totalPayments,
    newPayments,
    paymentsValue,
    paymentsByOperator,
    paymentsByStatus,
    verifiedPayments
  ] = await Promise.all([
    Payment.countDocuments(),
    Payment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Payment.aggregate([
      { $group: { _id: null, totalValue: { $sum: '$amount' }, avgValue: { $avg: '$amount' } } }
    ]),
    Payment.aggregate([
      { $group: { _id: '$operator', count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Payment.countDocuments({ status: 'verified' })
  ]);

  const totalPaymentValue = paymentsValue[0]?.totalValue || 0;
  const avgPaymentValue = paymentsValue[0]?.avgValue || 0;
  const verificationRate = totalPayments > 0 ? ((verifiedPayments / totalPayments) * 100).toFixed(2) : 0;

  const paymentsByOperatorMap = paymentsByOperator.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

  const paymentsByStatusMap = paymentsByStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  // Feedback stats
  const [
    totalFeedback,
    newFeedback,
    readFeedback
  ] = await Promise.all([
    ImprovementFeedback.countDocuments(),
    ImprovementFeedback.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ImprovementFeedback.countDocuments({ readAt: { $ne: null } })
  ]);

  // Complaints stats
  const [
    totalComplaints,
    newComplaints,
    complaintsByStatus
  ] = await Promise.all([
    Complaint.countDocuments(),
    Complaint.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Complaint.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const complaintsByStatusMap = complaintsByStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  // Shops stats
  const totalShops = await User.countDocuments({ accountType: 'shop' });
  const verifiedShops = await User.countDocuments({ accountType: 'shop', shopVerified: true });
  const shopConversionRate = totalUsers > 0 ? ((totalShops / totalUsers) * 100).toFixed(2) : 0;

  // Top shops
  const topShops = await User.find({ accountType: 'shop' })
    .sort({ followersCount: -1 })
    .limit(5)
    .select('name followersCount')
    .lean();

  // Content metrics
  const [
    avgPhotosPerListing,
    avgDescriptionLength
  ] = await Promise.all([
    Product.aggregate([
      { $match: { status: 'approved' } },
      { $project: { photoCount: { $size: { $ifNull: ['$images', []] } } } },
      { $group: { _id: null, avg: { $avg: '$photoCount' } } }
    ]),
    Product.aggregate([
      { $match: { status: 'approved' } },
      { $project: { descLength: { $strLenCP: { $ifNull: ['$description', ''] } } } },
      { $group: { _id: null, avg: { $avg: '$descLength' } } }
    ])
  ]);

  // Metrics
  const approvalRate = totalProducts > 0 ? ((productsByStatusMap.approved || 0) / totalProducts * 100).toFixed(2) : 0;

  // Growth rates (simplified - comparing current period to previous period)
  const prevStart = new Date(start);
  const prevEnd = new Date(end);
  const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  prevStart.setDate(prevStart.getDate() - periodDays);
  prevEnd.setDate(prevEnd.getDate() - periodDays);

  const [
    prevNewUsers,
    prevNewProducts,
    prevNewOrders,
    prevNewPayments
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
    Product.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
    Order.countDocuments({ isDraft: { $ne: true }, createdAt: { $gte: prevStart, $lte: prevEnd } }),
    Payment.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } })
  ]);

  const calculateGrowthRate = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return (((current - previous) / previous) * 100).toFixed(2);
  };

  res.json({
    period: {
      type,
      start,
      end,
      label
    },
    generatedAt: new Date(),
    users: {
      total: totalUsers,
      new: newUsers,
      byGender: usersByGenderMap,
      byCity: usersByCityMap,
      convertedToShop,
      suspended: suspendedUsers,
      verified: verifiedUsers
    },
    orders: {
      total: totalOrders,
      new: newOrders,
      byStatus: ordersByStatusMap,
      totalValue,
      averageValue: avgOrderValue
    },
    products: {
      total: totalProducts,
      new: newProducts,
      byStatus: productsByStatusMap,
      byCategory: productsByCategoryMap,
      withPayment: productsWithPayment
    },
    payments: {
      total: totalPayments,
      new: newPayments,
      totalValue: totalPaymentValue,
      averageValue: avgPaymentValue,
      byOperator: paymentsByOperatorMap,
      byStatus: paymentsByStatusMap,
      verificationRate: parseFloat(verificationRate)
    },
    feedback: {
      total: totalFeedback,
      new: newFeedback,
      read: readFeedback,
      unread: totalFeedback - readFeedback
    },
    complaints: {
      total: totalComplaints,
      new: newComplaints,
      byStatus: complaintsByStatusMap
    },
    shops: {
      total: totalShops,
      verified: verifiedShops,
      conversionRate: parseFloat(shopConversionRate),
      topShops: topShops.map(s => ({ name: s.name, followers: s.followersCount || 0 }))
    },
    metrics: {
      approvalRate: parseFloat(approvalRate),
      verificationRate: parseFloat(verificationRate),
      shopConversionRate: parseFloat(shopConversionRate),
      averageOrderValue: avgOrderValue,
      averagePaymentValue: avgPaymentValue
    },
    growth: {
      monthlyGrowthRate: {
        users: parseFloat(calculateGrowthRate(newUsers, prevNewUsers)),
        products: parseFloat(calculateGrowthRate(newProducts, prevNewProducts)),
        orders: parseFloat(calculateGrowthRate(newOrders, prevNewOrders)),
        payments: parseFloat(calculateGrowthRate(newPayments, prevNewPayments))
      }
    },
    content: {
      avgPhotosPerListing: avgPhotosPerListing[0]?.avg || 0,
      avgDescriptionLength: Math.round(avgDescriptionLength[0]?.avg || 0),
      avgPriceByCategory: productsByCategory.reduce((acc, item) => {
        acc[item._id] = item.avgPrice || 0;
        return acc;
      }, {})
    }
  });
});
