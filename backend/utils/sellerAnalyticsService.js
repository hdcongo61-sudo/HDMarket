import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductView from '../models/productViewModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import Dispute from '../models/disputeModel.js';
import { getSettingsValues, SETTING_KEYS } from './settingsResolver.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const REVENUE_STATUSES = Object.freeze([
  'paid',
  'ready_for_delivery',
  'out_for_delivery',
  'delivery_proof_submitted',
  'confirmed_by_client',
  'confirmed',
  'delivering',
  'delivered',
  'completed'
]);

const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  viewWeight: 0.1,
  conversionWeight: 2,
  revenueWeight: 0.001,
  refundPenalty: 5
});

const clampPositive = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const toDateStartUtc = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );
};

const toDateEndUtc = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999)
  );
};

export const buildAnalyticsRange = ({ dateFrom, dateTo, maxDays = 365 } = {}) => {
  const endDate = dateTo ? toDateEndUtc(dateTo) : toDateEndUtc(new Date());
  if (!endDate) {
    const error = new Error('dateTo invalide.');
    error.status = 400;
    throw error;
  }

  const defaultStart = new Date(endDate.getTime() - 29 * DAY_MS);
  const startDate = dateFrom ? toDateStartUtc(dateFrom) : toDateStartUtc(defaultStart);
  if (!startDate) {
    const error = new Error('dateFrom invalide.');
    error.status = 400;
    throw error;
  }

  if (startDate > endDate) {
    const error = new Error('dateFrom doit être antérieure à dateTo.');
    error.status = 400;
    throw error;
  }

  const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime() + 1) / DAY_MS);
  if (rangeDays > maxDays) {
    const error = new Error(`La plage est limitée à ${maxDays} jours.`);
    error.status = 400;
    throw error;
  }

  const rangeDurationMs = endDate.getTime() - startDate.getTime() + 1;
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - rangeDurationMs + 1);

  return {
    startDate,
    endDate,
    rangeDays,
    previousStartDate,
    previousEndDate
  };
};

const getScoringWeights = async () => {
  const settings = await getSettingsValues([
    SETTING_KEYS.ANALYTICS_VIEW_WEIGHT,
    SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT,
    SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT,
    SETTING_KEYS.ANALYTICS_REFUND_PENALTY
  ]);

  return {
    viewWeight: clampPositive(
      settings[SETTING_KEYS.ANALYTICS_VIEW_WEIGHT],
      DEFAULT_SCORING_WEIGHTS.viewWeight
    ),
    conversionWeight: clampPositive(
      settings[SETTING_KEYS.ANALYTICS_CONVERSION_WEIGHT],
      DEFAULT_SCORING_WEIGHTS.conversionWeight
    ),
    revenueWeight: clampPositive(
      settings[SETTING_KEYS.ANALYTICS_REVENUE_WEIGHT],
      DEFAULT_SCORING_WEIGHTS.revenueWeight
    ),
    refundPenalty: clampPositive(
      settings[SETTING_KEYS.ANALYTICS_REFUND_PENALTY],
      DEFAULT_SCORING_WEIGHTS.refundPenalty
    )
  };
};

const lineRevenueExpr = {
  $multiply: [{ $ifNull: ['$items.snapshot.price', 0] }, { $ifNull: ['$items.quantity', 0] }]
};

const buildCoreMetrics = async ({ sellerObjectId, productIds, startDate, endDate }) => {
  if (!productIds.length) {
    return {
      revenue: 0,
      orders: 0,
      views: 0,
      conversionRate: 0
    };
  }

  const [orderSummary, viewSummary] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: lineRevenueExpr },
          orderIds: { $addToSet: '$_id' }
        }
      }
    ]),
    ProductView.aggregate([
      {
        $match: {
          product: { $in: productIds },
          lastViewedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          views: { $sum: { $ifNull: ['$viewsCount', 0] } }
        }
      }
    ])
  ]);

  const revenue = Number(orderSummary[0]?.totalRevenue || 0);
  const orders = Array.isArray(orderSummary[0]?.orderIds) ? orderSummary[0].orderIds.length : 0;
  const views = Number(viewSummary[0]?.views || 0);
  const conversionRate = views > 0 ? Number(((orders / views) * 100).toFixed(2)) : 0;

  return {
    revenue,
    orders,
    views,
    conversionRate
  };
};

const classifyProduct = ({ views, conversionRate, revenue, orderCount, averages }) => {
  const highViewsThreshold = Math.max(20, averages.views * 1.2);
  const lowViewsThreshold = Math.max(10, averages.views * 0.6);
  const highRevenueThreshold = Math.max(50000, averages.revenue * 1.2);

  if (views >= highViewsThreshold && conversionRate < 2) return 'high_potential';
  if (revenue >= highRevenueThreshold && conversionRate >= 3) return 'high_performer';
  if (views <= lowViewsThreshold && orderCount <= 1) return 'low_performer';
  return 'stable';
};

const buildSuggestions = ({
  revenueByCity = [],
  topProducts = [],
  installment = {},
  boost = {},
  promo = {},
  summary = {}
}) => {
  const suggestions = [];
  const safePush = (type, message, priority = 'medium') => {
    suggestions.push({ type, message, priority });
  };

  const highPotentialProduct = topProducts.find((item) => item.classification === 'high_potential');
  if (highPotentialProduct) {
    safePush(
      'promo_opportunity',
      `Le produit "${highPotentialProduct.title}" est très vu mais convertit peu. Ajoutez un code promo ciblé.`,
      'high'
    );
  }

  const highPerformer = topProducts.find((item) => item.classification === 'high_performer');
  if (highPerformer) {
    safePush(
      'boost_opportunity',
      `Le produit "${highPerformer.title}" convertit bien. Le booster peut accélérer son chiffre d’affaires.`,
      'high'
    );
  }

  if (summary.revenue > 0) {
    const topCity = revenueByCity[0];
    if (topCity) {
      const share = (Number(topCity.revenue || 0) / Number(summary.revenue || 1)) * 100;
      if (share >= 60) {
        safePush(
          'city_focus',
          `La ville "${topCity.city}" génère ${share.toFixed(1)}% de votre revenu. Concentrez vos campagnes dessus.`,
          'high'
        );
      }
    }
  }

  const installmentShare =
    summary.revenue > 0 ? (Number(installment.amountPaidSoFar || 0) / Number(summary.revenue || 1)) * 100 : 0;
  if (installmentShare >= 20) {
    safePush(
      'installment_highlight',
      "Vos ventes par tranche performent. Mettez l'option tranche en avant dans vos descriptions.",
      'medium'
    );
  }

  if (Number(boost.impressions || 0) > 0 && Number(boost.ctr || 0) < 1) {
    safePush(
      'boost_ctr',
      "Vos boosts ont un CTR faible. Testez des visuels plus clairs et des prix d’appel.",
      'medium'
    );
  }

  if (Number(promo.usageCount || 0) === 0 && highPotentialProduct) {
    safePush(
      'promo_activation',
      "Vous avez des produits à potentiel mais aucun usage promo sur la période. Lancez une campagne flash.",
      'medium'
    );
  }

  if (Number(installment.overdueCount || 0) > 0) {
    safePush(
      'installment_risk',
      "Des tranches sont en retard. Renforcez les rappels et vérifiez l’éligibilité avant validation.",
      'high'
    );
  }

  return suggestions.slice(0, 8);
};

const toPercentDelta = (current, previous) => {
  const curr = Number(current || 0);
  const prev = Number(previous || 0);
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return 0;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(2));
};

export const computeSellerAnalytics = async ({ sellerId, dateFrom, dateTo, maxDays = 365 }) => {
  const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
  const range = buildAnalyticsRange({ dateFrom, dateTo, maxDays });
  const weights = await getScoringWeights();

  const products = await Product.find({ user: sellerObjectId })
    .select('_id title price whatsappClicks views images city status')
    .lean();
  const productIds = products.map((item) => item._id);

  const [
    summaryAgg,
    revenueByCityAgg,
    installmentAgg,
    promoAgg,
    productViewAgg,
    productOrderAgg,
    disputeByProductAgg,
    boostRequests
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: lineRevenueExpr },
          orderIds: { $addToSet: '$_id' }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      {
        $group: {
          _id: { $ifNull: ['$deliveryCity', 'Non précisée'] },
          revenue: { $sum: lineRevenueExpr },
          orderIds: { $addToSet: '$_id' }
        }
      },
      { $sort: { revenue: -1 } }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          paymentType: 'installment',
          createdAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      {
        $addFields: {
          lineRevenue: lineRevenueExpr,
          safeTotalAmount: {
            $cond: [{ $gt: [{ $ifNull: ['$totalAmount', 0] }, 0] }, '$totalAmount', 1]
          }
        }
      },
      {
        $addFields: {
          lineShare: { $divide: ['$lineRevenue', '$safeTotalAmount'] },
          isOverdue: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'overdue_installment'] },
                  { $gt: [{ $ifNull: ['$installmentPlan.overdueCount', 0] }, 0] }
                ]
              },
              1,
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          orderIds: { $addToSet: '$_id' },
          amountPaidSoFar: {
            $sum: { $multiply: [{ $ifNull: ['$installmentPlan.amountPaid', 0] }, '$lineShare'] }
          },
          remainingAmount: {
            $sum: { $multiply: [{ $ifNull: ['$installmentPlan.remainingAmount', 0] }, '$lineShare'] }
          },
          overdueOrderIds: {
            $addToSet: { $cond: [{ $eq: ['$isOverdue', 1] }, '$_id', '$$REMOVE'] }
          }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          createdAt: { $gte: range.startDate, $lte: range.endDate },
          'appliedPromoCode.code': { $exists: true, $ne: '' }
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      {
        $addFields: {
          lineRevenue: lineRevenueExpr,
          safeTotalAmount: {
            $cond: [{ $gt: [{ $ifNull: ['$totalAmount', 0] }, 0] }, '$totalAmount', 1]
          },
          isSellerPromo: {
            $cond: [
              {
                $or: [
                  { $eq: ['$appliedPromoCode.boutiqueId', sellerObjectId] },
                  { $eq: ['$appliedPromoCode.productId', '$items.product'] }
                ]
              },
              1,
              0
            ]
          }
        }
      },
      { $match: { isSellerPromo: 1 } },
      {
        $addFields: {
          discountShare: {
            $multiply: [
              { $ifNull: ['$appliedPromoCode.discountAmount', 0] },
              { $divide: ['$lineRevenue', '$safeTotalAmount'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: { code: '$appliedPromoCode.code', orderId: '$_id' },
          grossRevenue: { $sum: '$lineRevenue' },
          discountAmount: { $sum: '$discountShare' }
        }
      },
      {
        $group: {
          _id: '$_id.code',
          usageCount: { $sum: 1 },
          grossRevenue: { $sum: '$grossRevenue' },
          discountAmount: { $sum: '$discountAmount' }
        }
      },
      { $sort: { usageCount: -1, discountAmount: -1 } }
    ]),
    ProductView.aggregate([
      {
        $match: {
          product: { $in: productIds },
          lastViewedAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      {
        $group: {
          _id: '$product',
          views: { $sum: { $ifNull: ['$viewsCount', 0] } },
          uniqueViewers: { $addToSet: '$user' }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          isDraft: { $ne: true },
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.snapshot.shopId': sellerObjectId,
          'items.product': { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$items.product',
          orderIds: { $addToSet: '$_id' },
          revenue: { $sum: lineRevenueExpr },
          soldUnits: { $sum: { $ifNull: ['$items.quantity', 0] } }
        }
      }
    ]),
    Dispute.aggregate([
      {
        $match: {
          sellerId: sellerObjectId,
          createdAt: { $gte: range.startDate, $lte: range.endDate }
        }
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order'
        }
      },
      { $unwind: '$order' },
      { $unwind: '$order.items' },
      {
        $match: {
          'order.items.snapshot.shopId': sellerObjectId,
          'order.items.product': { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$order.items.product',
          disputeCount: { $sum: 1 }
        }
      }
    ]),
    BoostRequest.find({
      sellerId: sellerObjectId,
      createdAt: { $gte: range.startDate, $lte: range.endDate }
    })
      .select('boostType city status totalPrice impressions clicks productIds')
      .lean()
  ]);

  const summaryRaw = summaryAgg[0] || { totalRevenue: 0, orderIds: [] };
  const totalRevenue = Number(summaryRaw.totalRevenue || 0);
  const totalOrders = Array.isArray(summaryRaw.orderIds) ? summaryRaw.orderIds.length : 0;

  const revenueByCity = revenueByCityAgg.map((item) => ({
    city: item?._id || 'Non précisée',
    revenue: Number(item?.revenue || 0),
    orders: Array.isArray(item?.orderIds) ? item.orderIds.length : 0
  }));

  const installmentRaw = installmentAgg[0] || {};
  const installment = {
    totalInstallmentOrders: Array.isArray(installmentRaw.orderIds) ? installmentRaw.orderIds.length : 0,
    amountPaidSoFar: Number(installmentRaw.amountPaidSoFar || 0),
    remainingAmount: Number(installmentRaw.remainingAmount || 0),
    overdueCount: Array.isArray(installmentRaw.overdueOrderIds) ? installmentRaw.overdueOrderIds.length : 0
  };

  const promoCodes = promoAgg.map((item) => {
    const usage = Number(item?.usageCount || 0);
    const grossRevenue = Number(item?.grossRevenue || 0);
    const discountAmount = Number(item?.discountAmount || 0);
    return {
      code: item?._id || '',
      usageCount: usage,
      grossRevenue,
      discountAmount,
      netRevenue: grossRevenue - discountAmount
    };
  });
  const promo = {
    usageCount: promoCodes.reduce((sum, item) => sum + item.usageCount, 0),
    totalDiscountAmount: promoCodes.reduce((sum, item) => sum + item.discountAmount, 0),
    netRevenueAfterDiscount: promoCodes.reduce((sum, item) => sum + item.netRevenue, 0),
    codes: promoCodes.slice(0, 8)
  };

  const boost = {
    totalBoostSpend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    boostedOrders: 0,
    boostedRevenue: 0,
    boostedViewToOrderConversion: 0,
    clickToOrderConversion: 0,
    byType: {},
    byCity: {}
  };

  const boostedProductIdsSet = new Set();
  boostRequests.forEach((item) => {
    const spendEligible = ['APPROVED', 'ACTIVE', 'EXPIRED'].includes(item.status);
    if (spendEligible) {
      boost.totalBoostSpend += Number(item.totalPrice || 0);
    }
    const impressions = Number(item.impressions || 0);
    const clicks = Number(item.clicks || 0);
    boost.impressions += impressions;
    boost.clicks += clicks;

    const typeKey = item.boostType || 'UNKNOWN';
    if (!boost.byType[typeKey]) {
      boost.byType[typeKey] = { spend: 0, impressions: 0, clicks: 0 };
    }
    if (spendEligible) {
      boost.byType[typeKey].spend += Number(item.totalPrice || 0);
    }
    boost.byType[typeKey].impressions += impressions;
    boost.byType[typeKey].clicks += clicks;

    const cityKey = item.city || 'Tous';
    if (!boost.byCity[cityKey]) {
      boost.byCity[cityKey] = { spend: 0, impressions: 0, clicks: 0 };
    }
    if (spendEligible) {
      boost.byCity[cityKey].spend += Number(item.totalPrice || 0);
    }
    boost.byCity[cityKey].impressions += impressions;
    boost.byCity[cityKey].clicks += clicks;

    if (Array.isArray(item.productIds)) {
      item.productIds.forEach((id) => boostedProductIdsSet.add(String(id)));
    }
  });
  boost.ctr = boost.impressions > 0 ? Number(((boost.clicks / boost.impressions) * 100).toFixed(2)) : 0;
  boost.byType = Object.entries(boost.byType).map(([type, values]) => ({
    type,
    spend: Number(values.spend || 0),
    impressions: Number(values.impressions || 0),
    clicks: Number(values.clicks || 0),
    ctr:
      Number(values.impressions || 0) > 0
        ? Number((((Number(values.clicks || 0) / Number(values.impressions || 1)) * 100)).toFixed(2))
        : 0
  }));
  boost.byCity = Object.entries(boost.byCity).map(([city, values]) => ({
    city,
    spend: Number(values.spend || 0),
    impressions: Number(values.impressions || 0),
    clicks: Number(values.clicks || 0),
    ctr:
      Number(values.impressions || 0) > 0
        ? Number((((Number(values.clicks || 0) / Number(values.impressions || 1)) * 100)).toFixed(2))
        : 0
  }));

  const boostedProductIds = Array.from(boostedProductIdsSet)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (boostedProductIds.length) {
    const [boostedOrdersAgg, boostedViewsAgg] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            isDraft: { $ne: true },
            status: { $in: REVENUE_STATUSES },
            createdAt: { $gte: range.startDate, $lte: range.endDate }
          }
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.snapshot.shopId': sellerObjectId,
            'items.product': { $in: boostedProductIds }
          }
        },
        {
          $group: {
            _id: null,
            orderIds: { $addToSet: '$_id' },
            revenue: { $sum: lineRevenueExpr }
          }
        }
      ]),
      ProductView.aggregate([
        {
          $match: {
            product: { $in: boostedProductIds },
            lastViewedAt: { $gte: range.startDate, $lte: range.endDate }
          }
        },
        {
          $group: {
            _id: null,
            views: { $sum: { $ifNull: ['$viewsCount', 0] } }
          }
        }
      ])
    ]);

    const boostedOrders = Array.isArray(boostedOrdersAgg[0]?.orderIds)
      ? boostedOrdersAgg[0].orderIds.length
      : 0;
    const boostedRevenue = Number(boostedOrdersAgg[0]?.revenue || 0);
    const boostedViews = Number(boostedViewsAgg[0]?.views || 0);
    boost.boostedOrders = boostedOrders;
    boost.boostedRevenue = boostedRevenue;
    boost.boostedViewToOrderConversion =
      boostedViews > 0 ? Number(((boostedOrders / boostedViews) * 100).toFixed(2)) : 0;
    boost.clickToOrderConversion =
      boost.clicks > 0 ? Number(((boostedOrders / boost.clicks) * 100).toFixed(2)) : 0;
  }

  const productViewsMap = new Map(
    productViewAgg.map((item) => [String(item._id), { views: Number(item.views || 0), unique: item.uniqueViewers?.length || 0 }])
  );
  const productOrdersMap = new Map(
    productOrderAgg.map((item) => [
      String(item._id),
      {
        orderCount: Array.isArray(item.orderIds) ? item.orderIds.length : 0,
        revenue: Number(item.revenue || 0),
        soldUnits: Number(item.soldUnits || 0)
      }
    ])
  );
  const productDisputesMap = new Map(
    disputeByProductAgg.map((item) => [String(item._id), Number(item.disputeCount || 0)])
  );

  const rawTopProducts = products.map((product) => {
    const productId = String(product._id);
    const viewData = productViewsMap.get(productId) || {};
    const orderData = productOrdersMap.get(productId) || {};
    const disputeCount = Number(productDisputesMap.get(productId) || 0);
    const views = Number(viewData.views || 0);
    const orderCount = Number(orderData.orderCount || 0);
    const revenue = Number(orderData.revenue || 0);
    const conversionRate = views > 0 ? Number(((orderCount / views) * 100).toFixed(2)) : 0;

    const score =
      weights.viewWeight * views +
      weights.conversionWeight * conversionRate +
      weights.revenueWeight * revenue -
      weights.refundPenalty * disputeCount;

    return {
      productId: product._id,
      title: product.title,
      image: Array.isArray(product.images) ? product.images[0] || '' : '',
      price: Number(product.price || 0),
      views,
      clicks: Number(product.whatsappClicks || 0),
      orders: orderCount,
      soldUnits: Number(orderData.soldUnits || 0),
      revenue,
      conversionRate,
      disputeCount,
      score: Number(score.toFixed(2)),
      classification: 'stable'
    };
  });

  const averages = rawTopProducts.reduce(
    (acc, item) => {
      acc.views += item.views;
      acc.revenue += item.revenue;
      acc.count += 1;
      return acc;
    },
    { views: 0, revenue: 0, count: 0 }
  );
  averages.views = averages.count > 0 ? averages.views / averages.count : 0;
  averages.revenue = averages.count > 0 ? averages.revenue / averages.count : 0;

  const topProducts = rawTopProducts
    .map((item) => ({
      ...item,
      classification: classifyProduct({
        views: item.views,
        conversionRate: item.conversionRate,
        revenue: item.revenue,
        orderCount: item.orders,
        averages
      })
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  const totalViews = productViewAgg.reduce((sum, item) => sum + Number(item?.views || 0), 0);
  const conversionRate = totalViews > 0 ? Number(((totalOrders / totalViews) * 100).toFixed(2)) : 0;

  const currentCore = {
    revenue: totalRevenue,
    orders: totalOrders,
    views: totalViews,
    conversionRate
  };

  const previousCore = await buildCoreMetrics({
    sellerObjectId,
    productIds,
    startDate: range.previousStartDate,
    endDate: range.previousEndDate
  });

  const comparison = {
    revenue: {
      current: Number(currentCore.revenue || 0),
      previous: Number(previousCore.revenue || 0),
      deltaPercent: toPercentDelta(currentCore.revenue, previousCore.revenue)
    },
    conversionRate: {
      current: Number(currentCore.conversionRate || 0),
      previous: Number(previousCore.conversionRate || 0),
      deltaPercent: toPercentDelta(currentCore.conversionRate, previousCore.conversionRate)
    },
    orders: {
      current: Number(currentCore.orders || 0),
      previous: Number(previousCore.orders || 0),
      deltaPercent: toPercentDelta(currentCore.orders, previousCore.orders)
    }
  };

  const suggestions = buildSuggestions({
    revenueByCity,
    topProducts,
    installment,
    boost,
    promo,
    summary: currentCore
  });

  return {
    period: {
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      rangeDays: range.rangeDays,
      previousStartDate: range.previousStartDate.toISOString(),
      previousEndDate: range.previousEndDate.toISOString()
    },
    summary: {
      revenue: Number(totalRevenue.toFixed(2)),
      orders: totalOrders,
      views: Number(totalViews || 0),
      conversionRate: Number(conversionRate || 0)
    },
    revenueByCity,
    boost: {
      ...boost,
      totalBoostSpend: Number((boost.totalBoostSpend || 0).toFixed(2)),
      boostedRevenue: Number((boost.boostedRevenue || 0).toFixed(2))
    },
    promo: {
      ...promo,
      totalDiscountAmount: Number((promo.totalDiscountAmount || 0).toFixed(2)),
      netRevenueAfterDiscount: Number((promo.netRevenueAfterDiscount || 0).toFixed(2))
    },
    installment: {
      ...installment,
      amountPaidSoFar: Number((installment.amountPaidSoFar || 0).toFixed(2)),
      remainingAmount: Number((installment.remainingAmount || 0).toFixed(2))
    },
    topProducts,
    scoring: {
      weights,
      formula:
        'score = (viewWeight × views) + (conversionWeight × conversionRate) + (revenueWeight × revenue) - (refundPenalty × disputeCount)'
    },
    suggestions,
    comparison,
    generatedAt: new Date().toISOString()
  };
};

const ensureSpace = (doc, neededHeight = 80) => {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const writeSectionTitle = (doc, title) => {
  ensureSpace(doc, 36);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title);
  doc.moveDown(0.2);
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.4);
};

export const generateSellerAnalyticsPdfBuffer = async ({
  analytics,
  sellerName,
  sellerCity
}) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];

  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
  const formatDate = (value) =>
    new Date(value).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827').text('HDMarket - Rapport vendeur');
  doc.moveDown(0.2);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#475569')
    .text(`Vendeur: ${sellerName || 'Boutique'}`)
    .text(`Ville: ${sellerCity || 'Non précisée'}`)
    .text(
      `Période: ${formatDate(analytics.period.startDate)} - ${formatDate(analytics.period.endDate)} (${analytics.period.rangeDays} jours)`
    )
    .text(`Généré le: ${new Date().toLocaleString('fr-FR')}`);

  writeSectionTitle(doc, 'Résumé KPI');
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Revenu: ${formatMoney(analytics.summary.revenue)}`)
    .text(`Commandes: ${analytics.summary.orders}`)
    .text(`Vues produits: ${analytics.summary.views}`)
    .text(`Conversion: ${analytics.summary.conversionRate.toFixed(2)}%`)
    .text(`Tranches encaissées: ${formatMoney(analytics.installment.amountPaidSoFar)}`)
    .text(`Tranches restantes: ${formatMoney(analytics.installment.remainingAmount)}`);

  writeSectionTitle(doc, 'Revenu par ville');
  const cityRows = Array.isArray(analytics.revenueByCity) ? analytics.revenueByCity.slice(0, 6) : [];
  const maxCityRevenue = Math.max(...cityRows.map((item) => Number(item.revenue || 0)), 1);
  cityRows.forEach((city) => {
    ensureSpace(doc, 28);
    const label = `${city.city}: ${formatMoney(city.revenue)} (${city.orders} cmd)`;
    doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(label);
    const width = Math.max(3, Math.round((Number(city.revenue || 0) / maxCityRevenue) * 420));
    const y = doc.y + 3;
    doc.rect(50, y, 420, 8).fillColor('#e2e8f0').fill();
    doc.rect(50, y, width, 8).fillColor('#4f46e5').fill();
    doc.moveDown(1.2);
  });
  if (!cityRows.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Aucune donnée sur la période.');
  }

  writeSectionTitle(doc, 'Boost / Promo / Tranche');
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Dépense boost: ${formatMoney(analytics.boost.totalBoostSpend)} · CTR: ${analytics.boost.ctr.toFixed(2)}%`)
    .text(
      `Boost click->order: ${Number(analytics.boost.clickToOrderConversion || 0).toFixed(2)}% · Impressions: ${analytics.boost.impressions}`
    )
    .text(
      `Promo: ${analytics.promo.usageCount} usages · Remises: ${formatMoney(
        analytics.promo.totalDiscountAmount
      )} · Net: ${formatMoney(analytics.promo.netRevenueAfterDiscount)}`
    )
    .text(
      `Tranches: ${analytics.installment.totalInstallmentOrders} commandes · Retards: ${analytics.installment.overdueCount}`
    );

  writeSectionTitle(doc, 'Top 5 produits');
  const topRows = Array.isArray(analytics.topProducts) ? analytics.topProducts.slice(0, 5) : [];
  if (topRows.length) {
    topRows.forEach((item, index) => {
      ensureSpace(doc, 30);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(`#${index + 1} ${item.title}`);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text(
          `Vues: ${item.views} · Cmd: ${item.orders} · Revenu: ${formatMoney(
            item.revenue
          )} · Conv: ${item.conversionRate.toFixed(2)}% · Score: ${item.score.toFixed(2)}`
        );
      doc.moveDown(0.4);
    });
  } else {
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Aucun produit à analyser.');
  }

  writeSectionTitle(doc, 'Suggestions intelligentes');
  const suggestions = Array.isArray(analytics.suggestions) ? analytics.suggestions.slice(0, 8) : [];
  if (!suggestions.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Aucune suggestion pour cette période.');
  } else {
    suggestions.forEach((item, index) => {
      ensureSpace(doc, 26);
      const prefix = `${index + 1}.`;
      const priority = (item.priority || 'medium').toUpperCase();
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(`${prefix} [${priority}] ${item.message}`);
      doc.moveDown(0.3);
    });
  }

  doc.end();
  return finished;
};
