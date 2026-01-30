import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Unified storage utility that works on both web and mobile
 * Uses Capacitor Preferences on native platforms and localStorage on web
 */
class UnifiedStorage {
  constructor() {
    try {
      this.isNative = Capacitor.isNativePlatform();
    } catch (error) {
      this.isNative = false;
    }
    this.maxLocalStorageSize = 5 * 1024 * 1024; // 5MB limit for localStorage
  }
  
  _useNativeStorage() {
    return this.isNative;
  }

  /**
   * Get value from storage
   * Handles both JSON stringified values and plain strings
   * This is important for backward compatibility with values stored directly in localStorage
   */
  async get(key) {
    try {
      const useNative = this._useNativeStorage();
      let rawValue = null;
      
      if (useNative) {
        const result = await Preferences.get({ key });
        rawValue = result?.value;
      } else {
        rawValue = localStorage.getItem(key);
      }
      
      if (!rawValue || rawValue === 'null') return null;
      
      // Try to parse as JSON, but fallback to raw value if it fails
      // This handles cases where values were stored as plain strings (like JWT tokens)
      // or were double-stringified
      try {
        // First, try to parse as JSON
        const parsed = JSON.parse(rawValue);
        return parsed;
      } catch (parseError) {
        // If JSON.parse fails, the value is likely stored as a plain string
        // This can happen with legacy data or when values were stored directly
        // Return the raw value as-is (it's already a string)
        return rawValue;
      }
    } catch (error) {
      // Silently handle errors to prevent breaking the app
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Storage get error for key ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * Set value in storage
   */
  async set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      const useNative = this._useNativeStorage();
      
      if (useNative) {
        await Preferences.set({ key, value: serialized });
        return true;
      } else {
        // Check size for localStorage
        const size = new Blob([serialized]).size;
        if (size > this.maxLocalStorageSize) {
          console.warn(`Value too large for localStorage (${size} bytes). Consider using IndexedDB.`);
          return false;
        }
        localStorage.setItem(key, serialized);
        return true;
      }
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded. Cleaning up old entries...');
        await this.cleanup();
        try {
          const useNative = this._useNativeStorage();
          if (useNative) {
            await Preferences.set({ key, value: JSON.stringify(value) });
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }
          return true;
        } catch (retryError) {
          console.error('Storage set error after cleanup:', retryError);
          return false;
        }
      }
      console.error(`Storage set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove value from storage
   */
  async remove(key) {
    try {
      const useNative = this._useNativeStorage();
      if (useNative) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error(`Storage remove error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage
   */
  async clear() {
    try {
      const useNative = this._useNativeStorage();
      if (useNative) {
        await Preferences.clear();
      } else {
        localStorage.clear();
      }
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * Get all keys
   */
  async keys() {
    try {
      const useNative = this._useNativeStorage();
      if (useNative) {
        const { keys } = await Preferences.keys();
        return keys;
      } else {
        return Object.keys(localStorage);
      }
    } catch (error) {
      console.error('Storage keys error:', error);
      return [];
    }
  }

  /**
   * Check if key exists
   */
  async has(key) {
    try {
      const useNative = this._useNativeStorage();
      if (useNative) {
        const { value } = await Preferences.get({ key });
        return value !== null;
      } else {
        return localStorage.getItem(key) !== null;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup old entries (helper for quota management)
   */
  async cleanup() {
    // This will be implemented by the cache manager
    return true;
  }
}

// Export singleton instance
export const storage = new UnifiedStorage();
export default storage;
