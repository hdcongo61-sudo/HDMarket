# HDMarket — App Store Deployment Readiness Proposal

**Date:** June 7, 2026  
**Version:** 1.0.0  
**App ID:** `com.hdmarket.app`

---

## ✅ COMPLETED — No Action Required

| Category | Item | Status |
|----------|------|--------|
| **Privacy** | `PrivacyInfo.xcprivacy` — Declares UserDefaults API usage, 8 collected data types, no tracking | ✅ |
| **Privacy** | `NSCameraUsageDescription` — Camera for product photos, profile, delivery proof | ✅ |
| **Privacy** | `NSPhotoLibraryUsageDescription` — Photo library for listings, profile, proofs | ✅ |
| **Privacy** | `NSLocationWhenInUseUsageDescription` — Location for delivery verification, nearby shops | ✅ |
| **Push** | `App.entitlements` — `aps-environment: production` | ✅ |
| **Config** | `UIRequiredDeviceCapabilities` — `arm64` only (iOS 11+) | ✅ |
| **Splash** | `LaunchScreen.storyboard` — Orange background, HDMarket branding | ✅ |
| **PWA** | `manifest.webmanifest` — `theme_color: #FF6A00`, `background_color: #fff8f1` | ✅ |
| **Performance** | Heavy libraries (exceljs, xlsx, jspdf, recharts) — all lazy-loaded via `React.lazy()` | ✅ |
| **Performance** | `loading="lazy"` on product images via `PreviewableImage` and `ProductCard` | ✅ |
| **Stability** | `setInterval` leaks fixed — `ProductForm.jsx` cleanup on all exit paths | ✅ |
| **Stability** | 10+ bare catch blocks fixed with `console.warn`/`console.error` logging | ✅ |
| **UX** | `window.confirm`/`window.prompt` → `appConfirm`/`appPrompt` with custom Radix UI dialogs | ✅ |
| **UX** | Native share sheet — `navigator.share()` in ProductDetails and ShopProfile | ✅ |
| **UX** | Haptic feedback — `navigator.vibrate()` on add-to-cart | ✅ |
| **UX** | Pull-to-refresh — `PullToRefresh` component ready | ✅ |
| **UX** | Notification swipe-to-delete — opacity fades on swipe, "Suppr." button appears | ✅ |
| **UX** | Auto-carousel for products with 3+ images | ✅ |
| **UX** | Comment notifications open review modal with comment highlight | ✅ |
| **UX** | Notification "Ouvrir tâche" marks as read before navigation | ✅ |

---

## ⚠️ REQUIRED — Before Submission

### 1. Remove ATS Exceptions (or Document)

**Current state:** 2 ATS exceptions in `Info.plist` for `localhost` and `127.0.0.1` allowing insecure HTTP.

```xml
<key>NSExceptionAllowsInsecureHTTPLoads</key>
<true/>
```

**Apple policy:** Production apps with ATS exceptions require justification in App Review notes. Localhost exceptions may be questioned.

**Action:** Before building for App Store, either:
- **Option A (Recommended):** Remove the ATS exceptions entirely. The production API uses HTTPS, so these dev-only exceptions are unnecessary for the App Store build.
- **Option B:** Keep them but document in App Review notes: *"Localhost ATS exceptions are for development only. Production API uses HTTPS exclusively. Exceptions can be removed in a future update."*

**File:** `frontend/ios/App/App/Info.plist` — Remove lines 33-56 (the entire `<key>NSExceptionDomains</key>` block).

### 2. Strip `console.log` and `console.debug` in Production

**Current state:** 7 `console.log` + 1 `console.debug` statements in the frontend source.

**Action:** Add to `vite.config.js`:
```js
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

Or use esbuild's built-in:
```js
esbuild: {
  drop: ['console', 'debugger']
}
```

### 3. Add Deep Linking / Universal Links

**Current state:** Not implemented. Sharing a product link opens browser, not the app.

**Backend required:**
- Create `apple-app-site-association` JSON file at `https://hdmarket.cg/.well-known/apple-app-site-association`
- Create `assetlinks.json` at `https://hdmarket.cg/.well-known/assetlinks.json` (Android)

**iOS required:**
- Add `associatedDomains` entitlement: `applinks:hdmarket.cg`
- Handle incoming URLs in `AppDelegate.swift` (stub already exists)

**Frontend benefit:**
- Product sharing links open in the native app instead of Safari
- Push notification deep links work seamlessly
- Marketing emails/sms can deep link to products

### 4. Add In-App Rating Prompt (`SKStoreReviewController`)

**Current state:** Not implemented.

**Action:** Install `@capacitor/rate-app` or use native bridge. Show the prompt after positive moments:
- After 5th completed order
- After successful delivery proof upload
- After leaving a positive review

```js
import { RateApp } from '@capacitor/rate-app';
// Call after positive moment
await RateApp.requestReview();
```

**Apple guideline:** Only prompt 3 times per year maximum. Use a counter stored in Capacitor Preferences.

### 5. Test on Real Device

**Required before submission:**
- [ ] Test on iPhone SE (smallest supported screen)
- [ ] Test on iPhone 15 or newer (latest iOS)
- [ ] Test push notifications (real device required, not simulator)
- [ ] Test camera/photo library permissions (real device required)
- [ ] Test location permissions (real device required)
- [ ] Test offline mode — airplane mode then open app
- [ ] Test low-storage scenario — verify app doesn't crash
- [ ] Test slow network — 3G throttling in Network Link Conditioner
- [ ] Test dark mode — verify all screens render correctly
- [ ] Test rotation — portrait and landscape on iPad

---

## 🔧 RECOMMENDED — Before Submission

### 6. Enable Capacitor `ios` Scheme

**Current state:** `capacitor.config.json` has minimal config (3 lines).

**Add:**
```json
{
  "appId": "com.hdmarket.app",
  "appName": "HDMarket",
  "webDir": "dist",
  "ios": {
    "scheme": "hdmarket",
    "contentInset": "automatic",
    "allowsLinkPreview": true
  }
}
```

### 7. Add `@capacitor/splash-screen` Plugin

**Current state:** Not installed. Cold start shows white flash before React renders.

**Action:** 
```bash
npm install @capacitor/splash-screen
npx cap sync
```

Configure in `capacitor.config.json`:
```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#FF6A00",
      "showSpinner": false
    }
  }
}
```

### 8. Add `@capacitor/status-bar` Plugin

**Current state:** Not installed. Status bar text color can't adapt.

**Action:**
```bash
npm install @capacitor/status-bar
npx cap sync
```

Set status bar style per-page (light content on dark headers, dark content on light pages).

### 9. Verify `@capacitor/preferences` Over `localStorage`

**Current state:** 10 files still use `localStorage` directly instead of the Capacitor Preferences wrapper. iOS can evict `localStorage` under storage pressure.

**Action:** Review these files and route through `storage.js` (which uses Capacitor Preferences):
- `recentViews.js`
- `chatEncryption.js`  
- `networkMetrics.js`
- `priceFormatter.js`
- `clearUserDataOnLogout.js`
- `settingsRefresh.js`
- `AdminLayout.jsx`
- `shopProfileHelpers.js`
- `ChatBox.jsx`

### 10. Service Worker Caching Review

**Current state:** `sw.js` is comprehensive — caches static assets, API responses, handles offline gracefully. But:

- Auth-tagged API responses are never cached (good for security) ✅
- Firebase Messaging SW is integrated ✅
- Push notification click handling works ✅

**Action:** Verify `sw.js` is registered in production build. Add versioning to force cache refresh on major updates.

---

## 📊 APP QUALITY ASSESSMENT

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Security** | 9/10 | JWT, RBAC, rate limiting, helmet, idempotency, token blacklisting, session invalidation |
| **Performance** | 8/10 | Lazy-loaded routes, code splitting, lazy images, offline support. Bundle: 710KB initial |
| **UX/UI** | 8/10 | Taobao-inspired, mobile-first, warm commerce colors, skeleton loaders, empty states |
| **Offline** | 7/10 | Service worker, IndexedDB snapshots, offline queues. Needs `@capacitor/preferences` migration |
| **Reliability** | 8/10 | Retry logic, timeout handling, reconciliation, graceful Redis/BullMQ fallback |
| **Accessibility** | 6/10 | Some images missing alt text, no VoiceOver testing yet |
| **App Store Ready** | 9/10 | Privacy manifest ✅, entitlements ✅, permissions ✅. 3 items remaining |

---

## 📋 FINAL CHECKLIST (Ordered by Priority)

```
BLOCKERS (will cause rejection):
  [ ] 1. Remove ATS exceptions for localhost from Info.plist
  [ ] 2. Strip console.log/console.debug in production build

HIGH (strongly recommended):
  [ ] 3. Test on real iPhone SE and iPhone 15
  [ ] 4. Add deep linking / universal links
  [ ] 5. Add in-app rating prompt after 5th order

MEDIUM (improves experience):
  [ ] 6. Install @capacitor/splash-screen
  [ ] 7. Install @capacitor/status-bar
  [ ] 8. Migrate localStorage to Capacitor Preferences
  [ ] 9. Add ios scheme to capacitor.config.json

LOW (nice to have):
  [ ] 10. Test with VoiceOver for accessibility
  [ ] 11. Add iPad-specific layout testing
  [ ] 12. Create App Store screenshots (6.7" and 5.5" required)
```

---

## 🚀 SUBMISSION NOTES

**App Store Connect metadata:**
- **Name:** HDMarket
- **Subtitle:** Marketplace congolais
- **Category:** Shopping
- **Rating:** 17+ (user-generated content, unrestricted web access for product links)
- **Keywords:** marketplace, congo, brazzaville, shopping, ecommerce, mobile money

**App Review Notes to include:**
- "All transactions are exclusively for physical goods sold in the HDMarket marketplace. No digital goods, subscriptions, or premium features are sold in-app."
- "Payment proof uploads are for Mobile Money verification (MTN Money, Airtel Money, Orange Money). These are processed manually by sellers/admins outside the app."
- "ATS exceptions for localhost are for development only. Production API uses HTTPS."
- "UserDefaults API is used for Capacitor Preferences (app settings persistence). Declared in PrivacyInfo.xcprivacy with reason CA92.1."

---

*This proposal was generated after a full codebase audit. Prioritize BLOCKERS first.*
