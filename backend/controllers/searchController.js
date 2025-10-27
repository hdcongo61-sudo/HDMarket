import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.json({ products: [] });
  }

  const regex = new RegExp(q.trim(), 'i');

  const shopUsers = await User.find({
    accountType: 'shop',
    shopName: regex
  })
    .select('_id name shopName shopLogo shopAddress')
    .lean();

  const shopUserIds = shopUsers.map((user) => user._id);

  const orFilters = [
    { title: regex },
    { description: regex },
    { category: regex }
  ];

  if (shopUserIds.length) {
    orFilters.push({ user: { $in: shopUserIds } });
  }

  const products = await Product.find({
    status: { $ne: 'disabled' },
    $or: orFilters
  })
    .populate('user', 'name shopName accountType')
    .sort('-createdAt')
    .limit(8)
    .lean();

  const formattedProducts = products.map((product) => ({
    _id: product._id,
    title: product.title,
    category: product.category,
    price: product.price,
    image: product.images?.[0] || null,
    shopName: product.user?.shopName || (product.user?.accountType === 'shop' ? product.user?.name : null),
    shopLogo: product.user?.shopLogo || null,
    shopAddress: product.user?.shopAddress || null,
    type:
      product.category && regex.test(product.category)
        ? 'category'
        : 'product'
  }));

  const formattedShops = shopUsers.map((shop) => ({
    _id: shop._id,
    title: shop.shopName || shop.name,
    category: 'Boutique',
    price: null,
    image: shop.shopLogo || null,
    shopName: shop.shopName || shop.name,
    shopAddress: shop.shopAddress || null,
    type: 'shop'
  }));

  res.json({ products: [...formattedShops, ...formattedProducts].slice(0, 10) });
});
