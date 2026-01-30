import storage from './storage.js';

/**
 * Search Cache Utility
 * Provides client-side caching for search results with TTL and size limits
 */

const CACHE_PREFIX = 'hdmarket:search-cache:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50; // Maximum number of cached searches
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Build cache key from search query and filters
 */
const buildCacheKey = (query, filters = {}) => {
  const normalizedQuery = (query || '').trim().toLowerCase();
  const filterString = JSON.stringify(filters);
  return `${CACHE_PREFIX}${normalizedQuery}:${filterString}`;
};

/**
 * Get cached search result
 */
export const getCachedSearch = async (query, filters = {}) => {
  try {
    const key = buildCacheKey(query, filters);
    const cached = await storage.get(key);
    
    if (!cached) return null;
    
    // Check if cache is expired
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      // Remove expired cache
      await storage.remove(key);
      return null;
    }
    
    // Update access time for LRU
    cached.lastAccessed = Date.now();
    await storage.set(key, cached);
    
    return cached.data;
  } catch (error) {
    console.error('Error getting cached search:', error);
    return null;
  }
};

/**
 * Set cached search result
 */
export const setCachedSearch = async (query, filters = {}, data) => {
  try {
    const key = buildCacheKey(query, filters);
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      query: query.trim(),
      filters
    };
    
    await storage.set(key, cacheEntry);
    
    // Cleanup old entries if cache is too large
    await cleanupCache();
    
    return true;
  } catch (error) {
    console.error('Error setting cached search:', error);
    return false;
  }
};

/**
 * Cleanup old cache entries (LRU eviction)
 */
const cleanupCache = async () => {
  try {
    const keys = await storage.keys();
    const searchCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    if (searchCacheKeys.length <= MAX_CACHE_SIZE) {
      return;
    }
    
    // Get all cache entries with metadata
    const entries = [];
    for (const key of searchCacheKeys) {
      const cached = await storage.get(key);
      if (cached) {
        entries.push({
          key,
          lastAccessed: cached.lastAccessed || cached.timestamp,
          age: Date.now() - cached.timestamp
        });
      }
    }
    
    // Sort by last accessed (LRU)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const entry of toRemove) {
      await storage.remove(entry.key);
    }
    
    // Also remove entries older than MAX_CACHE_AGE
    const now = Date.now();
    for (const entry of entries) {
      if (entry.age > MAX_CACHE_AGE) {
        await storage.remove(entry.key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
};

/**
 * Clear all search cache
 */
export const clearSearchCache = async () => {
  try {
    const keys = await storage.keys();
    const searchCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    for (const key of searchCacheKeys) {
      await storage.remove(key);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing search cache:', error);
    return false;
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    const keys = await storage.keys();
    const searchCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    let totalSize = 0;
    let oldestEntry = null;
    let newestEntry = null;
    
    for (const key of searchCacheKeys) {
      const cached = await storage.get(key);
      if (cached) {
        const size = JSON.stringify(cached).length;
        totalSize += size;
        
        if (!oldestEntry || cached.timestamp < oldestEntry.timestamp) {
          oldestEntry = cached;
        }
        if (!newestEntry || cached.timestamp > newestEntry.timestamp) {
          newestEntry = cached;
        }
      }
    }
    
    return {
      count: searchCacheKeys.length,
      totalSize,
      oldestEntry: oldestEntry ? new Date(oldestEntry.timestamp) : null,
      newestEntry: newestEntry ? new Date(newestEntry.timestamp) : null
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      count: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    };
  }
};

/**
 * Prefetch popular searches
 * Makes API calls in background to cache results
 */
export const prefetchPopularSearches = async (popularSearches = [], apiClient = null) => {
  if (!apiClient) {
    // If no API client provided, just return
    return false;
  }
  
  try {
    // Limit to top 5 popular searches to avoid too many requests
    const topSearches = popularSearches.slice(0, 5);
    
    // Prefetch in background (don't await, fire and forget)
    topSearches.forEach(async (search) => {
      try {
        const query = typeof search === 'string' ? search : (search.query || '');
        if (!query.trim()) return;
        
        // Check if already cached
        const cached = await getCachedSearch(query);
        if (cached) {
          // Already cached, skip
          return;
        }
        
        // Make API call to prefetch
        const { data } = await apiClient.get(`/search?q=${encodeURIComponent(query)}`);
        
        // Cache the results
        if (data) {
          const results = {
            products: Array.isArray(data?.products) ? data.products : [],
            shops: Array.isArray(data?.shops) ? data.shops : [],
            categories: Array.isArray(data?.categories) ? data.categories : [],
            totals: data?.totals || { products: 0, shops: 0, categories: 0, total: 0 }
          };
          await setCachedSearch(query, {}, results);
        }
      } catch (error) {
        // Silently fail for prefetch - don't log errors
        // This is background prefetching, errors are expected
      }
    });
    
    return true;
  } catch (error) {
    // Silently fail - prefetching shouldn't break the app
    return false;
  }
};
