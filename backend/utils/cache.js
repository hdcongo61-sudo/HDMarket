// Simple in-memory cache implementation
class SimpleCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes in ms
    this.maxSize = options.maxSize || 1000;
    this.checkInterval = options.checkInterval || 60000; // 1 minute
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), this.checkInterval);
    
    // Stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  set(key, value, ttl = null) {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiry,
      createdAt: Date.now()
    });
    
    this.stats.sets++;
    return true;
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return item.value;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Create cache instance
const cache = new SimpleCache({
  defaultTTL: 300000, // 5 minutes
  maxSize: 1000,
  checkInterval: 60000 // 1 minute
});

// Cache configuration for different endpoints
const CACHE_CONFIG = {
  // Product endpoints
  '/api/products/public': 180000, // 3 minutes
  '/api/products/top': 300000, // 5 minutes
  '/api/products/category': 180000, // 3 minutes
  
  // Shop endpoints
  '/api/shops': 300000, // 5 minutes
  '/api/shops/:id': 600000, // 10 minutes
  
  // User stats
  '/api/users/profile/stats': 120000, // 2 minutes
  
  // Admin dashboard
  '/api/admin/dashboard/stats': 60000, // 1 minute
  
  // Settings and static data
  '/api/settings': 1800000, // 30 minutes
  '/api/categories': 1800000, // 30 minutes
  '/api/cities': 1800000, // 30 minutes
};

// Generate cache key from request
export const generateCacheKey = (req) => {
  const path = req.originalUrl || req.url;
  const method = req.method?.toLowerCase() || 'get';
  
  // Include query parameters in cache key
  const queryString = new URLSearchParams(req.query).toString();
  const queryPart = queryString ? `?${queryString}` : '';
  
  // Include user ID if authenticated (for user-specific data)
  const userId = req.user?.id || req.user?._id;
  const userPart = userId ? `:user:${userId}` : '';
  
  return `${method}:${path}${queryPart}${userPart}`;
};

// Get TTL for a specific path
export const getCacheTTL = (path) => {
  // Try exact match first
  if (CACHE_CONFIG[path]) {
    return CACHE_CONFIG[path];
  }
  
  // Try pattern matching
  for (const [pattern, ttl] of Object.entries(CACHE_CONFIG)) {
    const regex = new RegExp(pattern.replace(/:[^/]+/g, '[^/]+'));
    if (regex.test(path)) {
      return ttl;
    }
  }
  
  return 300000; // Default 5 minutes
};

// Cache middleware
export const cacheMiddleware = (options = {}) => {
  const {
    ttl = null, // Override TTL if provided
    keyGenerator = generateCacheKey,
    condition = () => true, // Additional condition to check
    skipCache = () => false, // Condition to skip caching
  } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method?.toLowerCase() !== 'get') {
      return next();
    }

    // Skip caching if condition is false
    if (skipCache(req)) {
      return next();
    }

    // Check additional condition
    if (!condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);
    const path = req.originalUrl || req.url;
    const cacheTTL = ttl || getCacheTTL(path);

    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(cacheTTL / 2000)}`);
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data) {
        try {
          cache.set(cacheKey, data, cacheTTL);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Cache-Control', `public, max-age=${Math.floor(cacheTTL / 2000)}`);
        } catch (error) {
          console.error('Cache set error:', error);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

// Invalidate cache by pattern
export const invalidateCache = (pattern) => {
  const keys = cache.keys();
  const regex = new RegExp(pattern);
  let invalidated = 0;
  
  keys.forEach((key) => {
    if (regex.test(key)) {
      cache.delete(key);
      invalidated++;
    }
  });
  
  return invalidated;
};

// Invalidate all cache
export const clearAllCache = () => {
  return cache.clear();
};

// Invalidate cache for specific user
export const invalidateUserCache = (userId) => {
  return invalidateCache(`:user:${userId}`);
};

// Invalidate cache for product-related endpoints
export const invalidateProductCache = () => {
  // Invalidate all product-related cache keys
  // Pattern matches: get:/api/products/public, get:/api/products/public/highlights, get:/api/products/top-sales, etc.
  const keys = cache.keys();
  let invalidated = 0;
  
  keys.forEach((key) => {
    // Match any cache key that starts with "get:/api/products"
    if (key.startsWith('get:/api/products')) {
      cache.delete(key);
      invalidated++;
    }
  });
  
  return invalidated;
};

// Invalidate cache for shop-related endpoints
export const invalidateShopCache = (shopId = null) => {
  if (shopId) {
    return invalidateCache(`/api/shops/${shopId}`);
  }
  return invalidateCache('get:/api/shops');
};

// Get cache stats
export const getCacheStats = () => {
  return cache.getStats();
};

export default cache;
