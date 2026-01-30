# Caching Improvements Implementation

## Overview
This document describes the caching improvements implemented for better mobile (iOS/Android) support and offline functionality.

## Changes Made

### 1. Unified Storage Utility (`src/utils/storage.js`)
- **Purpose**: Provides a unified storage interface that works on both web and mobile
- **Features**:
  - Uses Capacitor Preferences on native platforms (iOS/Android)
  - Falls back to localStorage on web
  - Handles quota exceeded errors gracefully
  - Automatic cleanup of old entries

### 2. IndexedDB Manager (`src/utils/indexedDB.js`)
- **Purpose**: Stores larger datasets that exceed localStorage limits
- **Features**:
  - Stores product listings, search results, and shop data
  - TTL-based expiration
  - Automatic cleanup of expired entries
  - Used for datasets > 100KB

### 3. Updated API Service (`src/services/api.js`)
- **Changes**:
  - Replaced localStorage with unified storage utility
  - Added IndexedDB support for large datasets
  - Automatic selection between storage types based on data size
  - Async/await support for all storage operations

### 4. Service Worker (`public/sw.js`)
- **Purpose**: Enables PWA offline functionality
- **Features**:
  - Caches API responses for offline access
  - Caches static assets
  - Cache-first strategy for better performance
  - Automatic cache cleanup

### 5. Service Worker Registration (`src/utils/serviceWorker.js`)
- **Purpose**: Manages service worker lifecycle
- **Features**:
  - Registers service worker on app load
  - Handles updates
  - Provides cache clearing utilities

### 6. Updated AuthContext (`src/context/AuthContext.jsx`)
- **Changes**:
  - Uses unified storage instead of localStorage
  - Async operations for better mobile compatibility
  - Loading state during initialization

## Installation Required

Before running the app, install the Capacitor Preferences plugin:

```bash
cd frontend
npm install @capacitor/preferences
```

Then sync with native platforms:

```bash
# For iOS
npm run build:ios

# For Android
npm run build:android
```

## Benefits

### Mobile (iOS/Android)
- ✅ Better storage persistence using native storage APIs
- ✅ No storage quota issues
- ✅ Data persists across app restarts
- ✅ Works offline with cached data

### Web
- ✅ Maintains localStorage compatibility
- ✅ Falls back gracefully if IndexedDB unavailable
- ✅ PWA support with service worker
- ✅ Offline functionality

### Performance
- ✅ Faster data access with intelligent caching
- ✅ Reduced API calls
- ✅ Better offline experience
- ✅ Automatic cache cleanup prevents storage bloat

## Storage Strategy

1. **Small data (< 100KB)**: Uses unified storage (Capacitor Preferences / localStorage)
2. **Large data (> 100KB)**: Uses IndexedDB
3. **API responses**: Cached with TTL-based expiration
4. **Static assets**: Cached by service worker

## Cache TTL Configuration

Default TTL values (in `src/services/api.js`):
- Products: 3 minutes
- Shops: 5 minutes
- Settings: 10 minutes
- Search: 2 minutes
- Categories/Cities: 30 minutes
- User stats: 2 minutes
- Admin stats: 1 minute

## Testing

To test the caching improvements:

1. **Mobile Testing**:
   - Install on iOS/Android device
   - Use app offline
   - Verify cached data is accessible

2. **Web Testing**:
   - Open DevTools > Application > Storage
   - Check localStorage and IndexedDB
   - Test service worker in Application > Service Workers

3. **Cache Invalidation**:
   - Test that cache clears on logout
   - Verify cache updates after data changes

## Troubleshooting

If you encounter issues:

1. **Storage not working on mobile**:
   - Ensure @capacitor/preferences is installed
   - Run `npx cap sync` after installation

2. **Service worker not registering**:
   - Check browser console for errors
   - Ensure app is served over HTTPS (required for service workers)

3. **Cache not clearing**:
   - Use `clearAllCache()` from api.js
   - Clear service worker cache via DevTools
