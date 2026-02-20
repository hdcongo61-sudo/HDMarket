import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';
import User from '../models/userModel.js';
import Rating from '../models/ratingModel.js';
import SearchAnalytics from '../models/searchAnalyticsModel.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';

export const globalSearch = asyncHandler(async (req, res) => {
  const { 
    q,
    category: categoryFilter,
    minPrice,
    maxPrice,
    city: cityFilter,
    shopVerified: shopVerifiedFilter,
    condition: conditionFilter
  } = req.query;

  if (!q || !q.trim()) {
    return res.json({ 
      products: [],
      shops: [],
      categories: [],
      totals: {
        products: 0,
        shops: 0,
        categories: 0,
        total: 0
      }
    });
  }

  const regex = new RegExp(q.trim(), 'i');
  const query = q.trim();

  // Build base product filter
  const baseProductFilter = { status: 'approved' };

  // Apply category filter
  if (categoryFilter && categoryFilter.trim()) {
    baseProductFilter.category = new RegExp(`^${categoryFilter.trim()}$`, 'i');
  }

  // Apply city filter
  if (cityFilter && cityFilter.trim()) {
    baseProductFilter.city = cityFilter.trim();
  }

  // Apply condition filter
  if (conditionFilter && conditionFilter.trim()) {
    const normalizedCondition = conditionFilter.trim().toLowerCase();
    if (['new', 'used'].includes(normalizedCondition)) {
      baseProductFilter.condition = normalizedCondition;
    }
  }

  // Apply price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    baseProductFilter.price = {};
    if (minPrice !== undefined) {
      const min = Number(minPrice);
      if (!Number.isNaN(min) && min >= 0) {
        baseProductFilter.price.$gte = min;
      }
    }
    if (maxPrice !== undefined) {
      const max = Number(maxPrice);
      if (!Number.isNaN(max) && max >= 0) {
        baseProductFilter.price.$lte = max;
      }
    }
  }

  // Find shops matching the search query
  let shopFilter = {
    accountType: 'shop',
    shopName: regex
  };

  // Apply shop verification filter
  if (shopVerifiedFilter === 'true' || shopVerifiedFilter === true) {
    shopFilter.shopVerified = true;
  }

  const shopUsers = await User.find(shopFilter)
    .select('_id name shopName shopLogo shopAddress shopVerified slug')
    .lean();

  const shopUserIds = shopUsers.map((user) => user._id);

  // Find products matching the search query
  const orFilters = [
    { title: regex },
    { description: regex }
  ];

  // Only add category to OR if not already filtered
  if (!categoryFilter || !categoryFilter.trim()) {
    orFilters.push({ category: regex });
  }

  if (shopUserIds.length) {
    orFilters.push({ user: { $in: shopUserIds } });
  }

  // Combine base filter with OR filters
  const productFilter = {
    ...baseProductFilter,
    $or: orFilters
  };

  const [products, productCount] = await Promise.all([
    Product.find(productFilter)
      .populate('user', 'name shopName accountType shopVerified shopLogo shopAddress slug')
      .sort('-createdAt')
      .limit(10)
      .lean(),
    Product.countDocuments(productFilter)
  ]);

  await ensureModelSlugsForItems({ Model: Product, items: products, sourceValueKey: 'title' });

  // Get product IDs for rating aggregation
  const productIds = products.map((p) => p._id);

  // Get ratings for products
  const ratingStats = productIds.length > 0 ? await Rating.aggregate([
    { $match: { product: { $in: productIds } } },
    {
      $group: {
        _id: '$product',
        average: { $avg: '$value' },
        count: { $sum: 1 }
      }
    }
  ]) : [];

  const ratingMap = new Map(
    ratingStats.map((stat) => [
      String(stat._id),
      { average: Number(stat.average?.toFixed(2) ?? 0), count: stat.count }
    ])
  );

  // Get product counts for shops
  const shopProductCounts = shopUserIds.length > 0 ? await Product.aggregate([
    {
      $match: {
        user: { $in: shopUserIds },
        status: { $ne: 'disabled' }
      }
    },
    {
      $group: {
        _id: '$user',
        count: { $sum: 1 }
      }
    }
  ]) : [];

  const shopProductCountMap = new Map(
    shopProductCounts.map((stat) => [String(stat._id), stat.count])
  );

  // Filter products by shop verification if requested
  let filteredProducts = products;
  if (shopVerifiedFilter === 'true' || shopVerifiedFilter === true) {
    filteredProducts = products.filter((product) => product.user?.shopVerified === true);
  }

  // Format products with ratings
  const formattedProducts = filteredProducts
    .filter((product) => {
      // Separate actual products from category matches
      const isCategoryMatch = product.category && regex.test(product.category);
      return !isCategoryMatch;
    })
    .map((product) => {
      const rating = ratingMap.get(String(product._id)) || { average: 0, count: 0 };
      return {
        _id: product._id,
        slug: product.slug,
        title: product.title,
        category: product.category,
        price: product.price,
        discount: product.discount || 0,
        condition: product.condition || 'new',
        status: product.status,
        city: product.city,
        image: product.images?.[0] || null,
        shopName: product.user?.shopName || (product.user?.accountType === 'shop' ? product.user?.name : null),
        shopLogo: product.user?.shopLogo || null,
        shopAddress: product.user?.shopAddress || null,
        shopVerified: Boolean(product.user?.shopVerified),
        shopSlug: product.user?.slug || null,
        rating: rating.average,
        ratingCount: rating.count,
        type: 'product'
      };
    });

  // Format shops with product counts
  const formattedShops = shopUsers.map((shop) => ({
    _id: shop._id,
    slug: shop.slug,
    title: shop.shopName || shop.name,
    category: 'Boutique',
    image: shop.shopLogo || null,
    shopName: shop.shopName || shop.name,
    shopAddress: shop.shopAddress || null,
    shopVerified: Boolean(shop.shopVerified),
    productCount: shopProductCountMap.get(String(shop._id)) || 0,
    type: 'shop'
  }));

  // Extract unique categories from products
  const categoryMatches = products
    .filter((product) => product.category && regex.test(product.category))
    .map((product) => product.category)
    .filter((value, index, self) => self.indexOf(value) === index)
    .slice(0, 5)
    .map((category) => ({
      _id: `category-${category}`,
      title: category,
      type: 'category',
      query: query
    }));

  const totals = {
    products: formattedProducts.length,
    shops: formattedShops.length,
    categories: categoryMatches.length,
    total: formattedProducts.length + formattedShops.length + categoryMatches.length
  };

  // Track search analytics (async, don't wait for it)
  if (query && query.trim()) {
    SearchAnalytics.incrementSearch(query).catch((err) => {
      console.error('Error tracking search analytics:', err);
    });
  }

  res.json({
    products: formattedProducts,
    shops: formattedShops,
    categories: categoryMatches,
    totals
  });
});

// Get available categories for filter dropdown
export const getSearchCategories = asyncHandler(async (req, res) => {
  const activeNodes = await Category.find({
    isDeleted: false,
    isActive: true,
    level: { $in: [0, 1] }
  })
    .select('slug level')
    .sort({ level: 1, order: 1, name: 1 })
    .lean();

  if (activeNodes.length) {
    const slugs = activeNodes
      .filter((node) => node.level === 1)
      .map((node) => node.slug)
      .filter(Boolean);
    const fallbackRoots = activeNodes
      .filter((node) => node.level === 0)
      .map((node) => node.slug)
      .filter(Boolean);
    const categories = slugs.length ? slugs : fallbackRoots;
    return res.json(Array.from(new Set(categories)).sort());
  }

  const legacyCategories = await Product.distinct('category', { status: 'approved' });
  const sortedLegacyCategories = legacyCategories.filter(Boolean).sort();
  return res.json(sortedLegacyCategories);
});

/** Quick filters for search/nav (e.g. Nouveaux produits, Meilleures offres, Boutiques vérifiées, Tendances) */
export const getQuickFilters = asyncHandler(async (req, res) => {
  const filters = [
    { id: 'new_products', label: 'Nouveaux produits', path: '/products?sort=new', icon: 'sparkles', order: 1 },
    { id: 'top_deals', label: 'Meilleures offres', path: '/products?sort=price_asc', icon: 'flame', order: 2 },
    { id: 'verified_shops', label: 'Boutiques vérifiées', path: '/shops/verified', icon: 'shield-check', order: 3 },
    { id: 'trending', label: 'Tendances', path: '/products?sort=popular', icon: 'trending-up', order: 4 }
  ];
  res.json(filters);
});

// Get popular searches
export const getPopularSearches = asyncHandler(async (req, res) => {
  const { limit = 10, period = 'week' } = req.query;
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  
  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const popularSearches = await SearchAnalytics.find({
    lastSearchedAt: { $gte: startDate }
  })
    .sort({ count: -1, lastSearchedAt: -1 })
    .limit(limitNum)
    .select('query count lastSearchedAt resultClicks')
    .lean();

  const formatted = popularSearches.map((item) => ({
    query: item.query,
    count: item.count || 0,
    lastSearchedAt: item.lastSearchedAt,
    resultClicks: item.resultClicks || 0
  }));

  res.json(formatted);
});

// Track search analytics (for result clicks/views)
export const trackSearchAnalytics = asyncHandler(async (req, res) => {
  const { query, type, selectedResultId, action = 'click' } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const normalizedQuery = query.trim().toLowerCase();

  try {
    if (action === 'click' && selectedResultId) {
      await SearchAnalytics.incrementResultClick(normalizedQuery);
    } else if (action === 'view') {
      await SearchAnalytics.incrementResultView(normalizedQuery);
    } else {
      // Just increment search count
      await SearchAnalytics.incrementSearch(normalizedQuery);
    }

    res.json({ message: 'Analytics tracked successfully' });
  } catch (error) {
    console.error('Error tracking search analytics:', error);
    res.status(500).json({ message: 'Error tracking analytics' });
  }
});
