import mongoose from 'mongoose';
import Order from '../../models/orderModel.js';
import SocialClick from '../../models/socialClickModel.js';
import SocialInteraction from '../../models/socialInteractionModel.js';

const SOCIAL_CHANNEL_MATCH = { 'acquisition.channel': { $ne: 'DIRECT' } };

const sinceDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(1, Number(days) || 30));
  return date;
};

/**
 * Real aggregates only — every number here comes from a Mongo query against
 * data HDMarket actually has (clicks, interactions, orders). Never
 * fabricates impression/reach data TikTok/Meta don't expose to us
 * (spec §27).
 */
const buildFunnel = async ({ clickMatch, interactionMatch, orderMatch }) => {
  const [clicks, conversations, orders] = await Promise.all([
    SocialClick.countDocuments(clickMatch),
    SocialInteraction.countDocuments({ ...interactionMatch, direction: 'INBOUND' }),
    Order.countDocuments(orderMatch)
  ]);
  return { clicks, conversations, orders };
};

export const computeSellerSocialAnalytics = async (sellerId, { days = 30 } = {}) => {
  const since = sinceDate(days);
  const sellerObjectId = new mongoose.Types.ObjectId(String(sellerId));

  const clickMatch = { shopId: sellerObjectId, clickedAt: { $gte: since } };
  const interactionMatch = { shopId: sellerObjectId, createdAt: { $gte: since } };
  const orderMatch = {
    ...SOCIAL_CHANNEL_MATCH,
    'items.snapshot.shopId': sellerObjectId,
    createdAt: { $gte: since }
  };

  const [{ clicks, conversations, orders }, revenueAgg, topProducts, topChannels] = await Promise.all([
    buildFunnel({ clickMatch, interactionMatch, orderMatch }),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      { $match: { 'items.snapshot.shopId': sellerObjectId } },
      { $group: { _id: null, revenue: { $sum: '$items.lineTotal' } } }
    ]),
    SocialClick.aggregate([
      { $match: clickMatch },
      { $group: { _id: '$productId', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $project: { productId: '$_id', clicks: 1, title: '$product.title', socialCode: '$product.socialCode' } }
    ]),
    SocialInteraction.aggregate([
      { $match: interactionMatch },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const revenue = revenueAgg[0]?.revenue || 0;
  const conversionRate = clicks > 0 ? Number(((orders / clicks) * 100).toFixed(1)) : 0;

  return {
    period: days,
    clicks,
    conversations,
    orders,
    revenue,
    conversionRate,
    topProducts,
    topChannels: topChannels.map((row) => ({ channel: row._id, count: row.count }))
  };
};

export const computeAdminSocialAnalytics = async ({ days = 30 } = {}) => {
  const since = sinceDate(days);
  const clickMatch = { clickedAt: { $gte: since } };
  const interactionMatch = { createdAt: { $gte: since } };
  const orderMatch = { ...SOCIAL_CHANNEL_MATCH, createdAt: { $gte: since } };

  const [{ clicks, conversations, orders }, revenueAgg, ordersByChannel, topShops] = await Promise.all([
    buildFunnel({ clickMatch, interactionMatch, orderMatch }),
    Order.aggregate([{ $match: orderMatch }, { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }]),
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: '$acquisition.channel', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { orders: -1 } }
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      { $group: { _id: '$items.snapshot.shopId', orders: { $sum: 1 }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'shop' } },
      { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
      { $project: { shopId: '$_id', orders: 1, revenue: 1, shopName: '$shop.shopName' } }
    ])
  ]);

  const revenue = revenueAgg[0]?.revenue || 0;
  const conversionRate = clicks > 0 ? Number(((orders / clicks) * 100).toFixed(1)) : 0;

  return {
    period: days,
    clicks,
    conversations,
    orders,
    revenue,
    conversionRate,
    ordersByChannel: ordersByChannel.map((row) => ({ channel: row._id, orders: row.orders, revenue: row.revenue })),
    topShops
  };
};
