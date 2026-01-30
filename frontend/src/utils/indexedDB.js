/**
 * IndexedDB utility for storing larger datasets
 * Used for product listings, search results, and other large data
 */

const DB_NAME = 'HDMarketDB';
const DB_VERSION = 1;
const STORES = {
  PRODUCTS: 'products',
  SEARCH_RESULTS: 'searchResults',
  SHOP_DATA: 'shopData',
  CACHE: 'cache'
};

class IndexedDBManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Products store
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          productStore.createIndex('slug', 'slug', { unique: true });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Search results store
        if (!db.objectStoreNames.contains(STORES.SEARCH_RESULTS)) {
          const searchStore = db.createObjectStore(STORES.SEARCH_RESULTS, { keyPath: 'query' });
          searchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Shop data store
        if (!db.objectStoreNames.contains(STORES.SHOP_DATA)) {
          const shopStore = db.createObjectStore(STORES.SHOP_DATA, { keyPath: 'id' });
          shopStore.createIndex('slug', 'slug', { unique: true });
          shopStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // General cache store
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get value from IndexedDB
   */
  async get(storeName, key) {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          // Check if expired
          if (result.expiry && Date.now() > result.expiry) {
            this.delete(storeName, key);
            resolve(null);
          } else {
            resolve(result.data);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Set value in IndexedDB
   */
  async set(storeName, key, data, ttl = null) {
    await this.init();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const value = {
        key: typeof key === 'object' ? key.id || key.slug || key.query : key,
        data,
        timestamp: Date.now(),
        expiry: ttl ? Date.now() + ttl : null
      };

      const request = store.put(value);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete value from IndexedDB
   */
  async delete(storeName, key) {
    await this.init();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data from a store
   */
  async clear(storeName) {
    await this.init();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(storeName) {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      const request = index.openCursor();
      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const value = cursor.value;
          if (value.expiry && Date.now() > value.expiry) {
            cursor.delete();
            deleted++;
          }
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all keys from a store
   */
  async getAllKeys(storeName) {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const indexedDB = new IndexedDBManager();
export { STORES };
export default indexedDB;
