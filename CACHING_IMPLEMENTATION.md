# Caching Implementation Guide

## Overview

This document describes the comprehensive caching implementation for the HDMarket application, designed to improve performance and reduce server load.

## Architecture

### Frontend Caching
- **Location**: `frontend/src/services/api.js`
- **Storage**: Browser localStorage
- **Scope**: All platforms (web and native)
- **TTL**: Configurable per endpoint (2-30 minutes)

### Backend Caching
- **Location**: `backend/utils/cache.js`
- **Storage**: In-memory cache (Map-based)
- **Scope**: Server-side response caching
- **TTL**: Configurable per endpoint (1-30 minutes)

## Frontend Caching

### Features
1. **Automatic Caching**: GET requests to allowed endpoints are automatically cached
2. **TTL Management**: Different cache durations for different endpoints
3. **Cache Cleanup**: Automatic cleanup of expired entries
4. **Storage Management**: Handles localStorage quota limits gracefully

### Configuration

```javascript
// Cache TTL configuration (in milliseconds)
const CACHE_CONFIG = {
  '/products/public': 3 * 60 * 1000,      // 3 minutes
  '/shops': 5 * 60 * 1000,                 // 5 minutes
  '/settings': 10 * 60 * 1000,             // 10 minutes
  '/categories': 30 * 60 * 1000,           // 30 minutes
  '/cities': 30 * 60 * 1000,               // 30 minutes
  '/users/notifications': 1 * 60 * 1000,   // 1 minute
  '/users/profile/stats': 2 * 60 * 1000,    // 2 minutes
  '/admin/dashboard/stats': 1 * 60 * 1000,  // 1 minute
};
```

### Usage

#### Standard API Calls
```javascript
import api from '../services/api';

// Automatically cached (if endpoint is in CACHE_ALLOW_PREFIXES)
const { data } = await api.get('/products/public', { params: { city: 'Brazzaville' } });

// Skip cache for this request
const { data } = await api.get('/products/public', { 
  params: { city: 'Brazzaville' },
  skipCache: true 
});
```

#### Cache Management
```javascript
import api, { clearCache, clearAllCache } from '../services/api';

// Clear cache for specific endpoint pattern
clearCache('/products/public');

// Clear all cache
clearAllCache();
```

#### Using React Hooks
```javascript
import { useCachedData, useCachedPaginatedData } from '../hooks/useCachedData';

// Simple cached data fetching
function MyComponent() {
  const { data, loading, error, refetch } = useCachedData('/products/public', {
    params: { city: 'Brazzaville' },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{/* Render data */}</div>;
}

// Paginated cached data
function ProductsList() {
  const { items, page, totalPages, loading, goToPage } = useCachedPaginatedData(
    '/products/public',
    {
      pageSize: 12,
      params: { category: 'electronics' },
    }
  );

  return <div>{/* Render paginated items */}</div>;
}
```

## Backend Caching

### Features
1. **Response Caching**: Caches GET request responses
2. **Smart Key Generation**: Includes URL, query params, and user ID
3. **Automatic Invalidation**: Cache invalidation on data mutations
4. **HTTP Headers**: Sets Cache-Control and X-Cache headers

### Configuration

```javascript
// Cache TTL configuration (in milliseconds)
const CACHE_CONFIG = {
  '/api/products/public': 180000,    // 3 minutes
  '/api/shops': 300000,               // 5 minutes
  '/api/users/profile/stats': 120000, // 2 minutes
  '/api/admin/dashboard/stats': 60000, // 1 minute
  '/api/settings': 1800000,          // 30 minutes
};
```

### Usage

#### Applying Cache Middleware
```javascript
import { cacheMiddleware } from '../utils/cache.js';
import express from 'express';

const router = express.Router();

// Apply caching to route
router.get('/public', cacheMiddleware({ ttl: 180000 }), getPublicProducts);

// Custom cache key generator
router.get('/custom', cacheMiddleware({
  keyGenerator: (req) => `custom:${req.user.id}`,
  condition: (req) => req.user?.role === 'admin',
}), getCustomData);
```

#### Cache Invalidation
```javascript
import { 
  invalidateProductCache, 
  invalidateShopCache, 
  invalidateUserCache,
  clearAllCache 
} from '../utils/cache.js';

// Invalidate product cache after mutation
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create({ /* ... */ });
  invalidateProductCache(); // Clear all product-related cache
  res.json(product);
});

// Invalidate specific shop cache
export const updateShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findByIdAndUpdate(req.params.id, req.body);
  invalidateShopCache(shop._id); // Clear cache for this shop
  res.json(shop);
});

// Invalidate user-specific cache
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body);
  invalidateUserCache(user._id); // Clear cache for this user
  res.json(user);
});
```

## Cached Endpoints

### Frontend
- `/products/public` - Product listings (3 min)
- `/shops` - Shop listings (5 min)
- `/settings` - App settings (10 min)
- `/categories` - Categories (30 min)
- `/cities` - Cities (30 min)
- `/users/notifications` - User notifications (1 min)
- `/users/profile/stats` - User statistics (2 min)
- `/admin/dashboard/stats` - Admin dashboard (1 min)

### Backend
- `GET /api/products/public` - Product listings (3 min)
- `GET /api/products/public/highlights` - Product highlights (5 min)
- `GET /api/products/public/top-sales` - Top sales (5 min)
- `GET /api/products/public/:id` - Product details (5 min)
- `GET /api/products/public/:id/comments` - Product comments (2 min)
- `GET /api/products/public/:id/ratings` - Product ratings (2 min)

## Cache Invalidation Strategy

### Automatic Invalidation
Cache is automatically invalidated when:
1. **Product Mutations**: Create, update, delete, enable, disable
2. **Shop Mutations**: Update shop profile
3. **User Mutations**: Update user profile or stats

### Manual Invalidation
```javascript
// Frontend
import { clearCache } from '../services/api';
clearCache('/products/public'); // Clear specific pattern

// Backend
import { invalidateProductCache } from '../utils/cache';
invalidateProductCache(); // Clear all product cache
```

## Performance Benefits

### Frontend
- **Reduced API Calls**: Cached responses eliminate redundant requests
- **Faster Load Times**: Instant responses from cache
- **Offline Support**: Cached data available when offline
- **Bandwidth Savings**: Less data transfer

### Backend
- **Reduced Database Queries**: Cached responses skip DB queries
- **Lower Server Load**: Fewer requests processed
- **Faster Response Times**: Cached responses are instant
- **Better Scalability**: Handles more concurrent users

## Best Practices

### 1. Cache Appropriate Data
- ✅ Cache read-heavy, rarely-changing data
- ✅ Cache expensive queries (aggregations, joins)
- ❌ Don't cache user-specific sensitive data
- ❌ Don't cache real-time data (chat, live updates)

### 2. Set Appropriate TTLs
- **Short TTL (1-2 min)**: Frequently changing data (stats, notifications)
- **Medium TTL (3-5 min)**: Moderately changing data (products, shops)
- **Long TTL (30+ min)**: Rarely changing data (categories, cities, settings)

### 3. Invalidate on Mutations
Always invalidate relevant cache when data changes:
```javascript
// ✅ Good
await product.save();
invalidateProductCache();

// ❌ Bad
await product.save();
// Cache not invalidated - stale data!
```

### 4. Use Cache Headers
Backend automatically sets:
- `X-Cache: HIT` - Response served from cache
- `X-Cache: MISS` - Response fetched fresh
- `Cache-Control` - Browser caching hints

### 5. Monitor Cache Performance
```javascript
// Backend cache stats
import { getCacheStats } from '../utils/cache';
const stats = getCacheStats();
console.log('Cache hits:', stats.hits);
console.log('Cache misses:', stats.misses);
console.log('Hit rate:', stats.hits / (stats.hits + stats.misses));
```

## Troubleshooting

### Cache Not Working
1. Check if endpoint is in `CACHE_ALLOW_PREFIXES`
2. Verify request is GET method
3. Check if `skipCache` is not set
4. Verify TTL hasn't expired

### Stale Data
1. Ensure cache invalidation is called after mutations
2. Check TTL is appropriate for data change frequency
3. Verify cache key includes all relevant parameters

### Storage Quota Exceeded
- Frontend automatically cleans up expired entries
- Reduce cache TTL for less important data
- Consider using sessionStorage for temporary data

## Future Enhancements

1. **Redis Integration**: Replace in-memory cache with Redis for distributed caching
2. **Cache Warming**: Pre-populate cache for frequently accessed data
3. **Cache Compression**: Compress cached data to save storage
4. **Analytics**: Track cache hit rates and performance metrics
5. **Smart Invalidation**: Invalidate related cache entries automatically

## Migration Notes

### From Old Caching
The old caching system only worked on native platforms. The new system:
- ✅ Works on all platforms (web + native)
- ✅ Better TTL management
- ✅ Automatic cleanup
- ✅ Backend caching support

### Breaking Changes
None - the new caching is backward compatible. Old cache entries will be automatically cleaned up.

---

**Last Updated**: 2024  
**Version**: 1.0
