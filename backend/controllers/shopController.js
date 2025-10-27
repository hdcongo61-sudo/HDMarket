import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';

export const getShopProfile = asyncHandler(async (req, res) => {
  const shop = await User.findById(req.params.id).select('name shopName phone accountType createdAt shopLogo shopAddress');
  if (!shop || shop.accountType !== 'shop') {
    return res.status(404).json({ message: 'Boutique introuvable.' });
  }

  const productsRaw = await Product.find({
    user: shop._id,
    status: { $ne: 'disabled' }
  })
    .sort('-createdAt')
    .lean();

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
    shopAddress: shop.shopAddress
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

  res.json({
    shop: {
      _id: shop._id,
      shopName: shop.shopName || shop.name,
      ownerName: shop.name,
      phone: shop.phone,
      createdAt: shop.createdAt,
      productCount: products.length,
      shopLogo: shop.shopLogo || null,
      shopAddress: shop.shopAddress || null
    },
    products
  });
});
