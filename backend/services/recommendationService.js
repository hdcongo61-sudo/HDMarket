import Product from '../models/productModel.js';
import ProductView from '../models/productViewModel.js';
import SearchAnalytics from '../models/searchAnalyticsModel.js';
import SearchHistory from '../models/searchHistoryModel.js';
import { getRedisClient, isRedisReady } from '../config/redisClient.js';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const CACHE_KEY_PREFIX = 'hdm:rec:';

const normalizePositiveInt = (value, fallback, min = 1, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(max, Math.round(parsed));
};

const WEIGHTS = Object.freeze({
  CATEGORY_MATCH: 3.0,
  SAME_CITY: 2.5,
  BOOSTED: 2.0,
  FAVORITES_COUNT: 0.08,   // per favorite, max ~8
  VIEWS_COUNT: 0.02,        // per view, max ~4
  RECENCY_DAYS: 0.3,        // bonus per day of freshness (newer = higher)
  SALES_COUNT: 0.05,        // per sale, max ~5
  DISCOUNT: 0.04,           // per discount %, max ~4
  POPULAR_SEARCH: 1.5,
  SEARCH_HISTORY_MATCH: 1.8
});

const buildScore = (product, signals = {}) => {
  if (!product) return 0;
  let score = 0;

  if (signals.categoryMatch) score += WEIGHTS.CATEGORY_MATCH * signals.categoryMatch;
  if (signals.sameCity) score += WEIGHTS.SAME_CITY;
  if (product.boosted) score += WEIGHTS.BOOSTED;
  if (product.favoritesCount) score += Math.min(8, product.favoritesCount * WEIGHTS.FAVORITES_COUNT);
  if (product.viewsCount) score += Math.min(4, product.viewsCount * WEIGHTS.VIEWS_COUNT);
  if (product.salesCount) score += Math.min(5, product.salesCount * WEIGHTS.SALES_COUNT);
  if (product.discount) score += Math.min(4, (product.discount / 100) * WEIGHTS.DISCOUNT * 100);
  if (signals.searchMatch) score += WEIGHTS.POPULAR_SEARCH;
  if (signals.searchHistoryMatch) score += WEIGHTS.SEARCH_HISTORY_MATCH;

  // Recency bonus: newer products score higher
  if (product.createdAt) {
    const daysAgo = Math.max(0, (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    score += Math.max(0, WEIGHTS.RECENCY_DAYS * Math.max(0, 30 - daysAgo));
  }

  return score;
};

/**
 * Get user's top viewed categories from ProductView
 */
const getUserViewedCategories = async (userId, limit = 8) => {
  const views = await ProductView.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$category', views: { $sum: '$viewsCount' }, lastViewed: { $max: '$lastViewedAt' } } },
    { $sort: { views: -1, lastViewed: -1 } },
    { $limit: limit }
  ]);
  return views.map((v) => ({ category: v._id, views: v.views, lastViewed: v.lastViewed }));
};

/**
 * Get user's top categories from favorited products
 */
const getUserFavoriteCategories = async (userId, limit = 5) => {
  const favs = await Product.aggregate([
    { $match: { user: userId, status: 'approved' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  return favs.map((f) => ({ category: f._id, count: f.count }));
};

/**
 * Get user's recent search terms
 */
const getUserSearchTerms = async (userId, limit = 10) => {
  const history = await SearchHistory.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('query')
    .lean();
  return history.map((h) => h.query).filter(Boolean);
};

/**
 * Get globally popular search terms
 */
const getPopularSearchTerms = async (limit = 10) => {
  const analytics = await SearchAnalytics.find()
    .sort({ count: -1, lastSearchedAt: -1 })
    .limit(limit)
    .select('query count')
    .lean();
  return analytics.map((a) => ({ term: a.query, count: a.count }));
};

/**
 * Main recommendation function
 */
export const getRecommendations = async ({
  userId,
  userCity = '',
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  excludeProductIds = []
}) => {
  const pageNum = normalizePositiveInt(page, 1, 1);
  const limitNum = normalizePositiveInt(limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  // Try cache first
  const cacheKey = `${CACHE_KEY_PREFIX}${String(userId || 'anonymous')}:${pageNum}:${limitNum}`;
  if (isRedisReady()) {
    try {
      const cached = await getRedisClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, continue */ }
  }

  // Gather signals
  const [viewedCategories, favCategories, userSearches, popularSearches] = await Promise.all([
    getUserViewedCategories(userId),
    getUserFavoriteCategories(userId),
    getUserSearchTerms(userId).catch(() => []),
    getPopularSearchTerms().catch(() => [])
  ]);

  // Build category relevance map
  const categoryRelevance = new Map();

  // Viewed categories (highest weight)
  viewedCategories.forEach((vc, idx) => {
    categoryRelevance.set(vc.category, {
      score: 1.0 / (idx + 1),
      source: 'view'
    });
  });

  // Favorite categories (medium weight)
  favCategories.forEach((fc, idx) => {
    const existing = categoryRelevance.get(fc.category);
    const score = 0.7 / (idx + 1);
    if (existing) {
      existing.score = Math.max(existing.score, score);
    } else {
      categoryRelevance.set(fc.category, { score, source: 'favorite' });
    }
  });

  // If no personal signals, fall back to popular searches
  if (categoryRelevance.size === 0 && popularSearches.length > 0) {
    popularSearches.forEach((ps, idx) => {
      categoryRelevance.set(ps.term, {
        score: 0.4 / (idx + 1),
        source: 'popular'
      });
    });
  }

  // Build search term relevance
  const searchTerms = new Set([...userSearches.map((s) => s.toLowerCase())]);
  const popularTerms = new Set(popularSearches.map((p) => p.term.toLowerCase()));

  // Get already-viewed product IDs to exclude
  const viewedProductIds = new Set(
    (await ProductView.find({ user: userId }).select('product').lean())
      .map((v) => String(v.product))
  );
  excludeProductIds.forEach((id) => viewedProductIds.add(String(id)));

  // Build query: approved products, not the user's own
  const baseQuery = {
    status: 'approved',
    user: { $ne: userId }
  };

  const topCategories = [...categoryRelevance.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([cat]) => cat);

  // If we have categories, filter by them
  if (topCategories.length > 0) {
    baseQuery.category = { $in: topCategories };
  }

  const excludedIds = [...viewedProductIds].filter(Boolean);
  if (excludedIds.length > 0) {
    baseQuery._id = { $nin: excludedIds };
  }

  // Fetch candidates
  let products = await Product.find(baseQuery)
    .sort({ boosted: -1, boostScore: -1, viewsCount: -1, createdAt: -1 })
    .limit(limitNum * 4)
    .populate('user', 'shopName name city commune shopVerified accountType')
    .lean();

  // Score each product
  const scored = products.map((product) => {
    const signals = {
      categoryMatch: categoryRelevance.has(product.category)
        ? categoryRelevance.get(product.category).score
        : 0,
      sameCity: Boolean(
        userCity &&
        product.city &&
        product.city.toLowerCase() === userCity.toLowerCase()
      ),
      searchMatch: popularTerms.has(String(product.title || '').toLowerCase()),
      searchHistoryMatch: searchTerms.has(String(product.title || '').toLowerCase())
    };
    return {
      ...product,
      _score: buildScore(product, signals)
    };
  });

  // Sort by score
  scored.sort((a, b) => b._score - a._score);

  // Paginate
  const total = scored.length;
  const totalPages = Math.max(1, Math.ceil(total / limitNum));
  const offset = (pageNum - 1) * limitNum;
  const items = scored.slice(offset, offset + limitNum);

  // Strip internal score
  const result = {
    items: items.map(({ _score, ...item }) => item),
    total,
    totalPages,
    page: pageNum,
    hasMore: pageNum < totalPages
  };

  // Cache result
  if (isRedisReady()) {
    try {
      await getRedisClient().set(cacheKey, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
    } catch { /* cache write failed, continue */ }
  }

  return result;
};

/**
 * Invalidate recommendation cache for a user
 */
export const invalidateRecommendationCache = async (userId) => {
  if (!isRedisReady() || !userId) return;
  try {
    const client = getRedisClient();
    const pattern = `${CACHE_KEY_PREFIX}${String(userId)}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch { /* ignore */ }
};

export default getRecommendations;
