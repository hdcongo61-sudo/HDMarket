# HDMarket — App Store Readiness & Mobile Excellence Audit

**Date:** June 6, 2026  
**Auditor:** Automated scan of full codebase  
**Scope:** iOS App Store submission readiness, mobile UX, performance, crash resilience  

---

## 🚨 BLOCKERS — Will Cause App Store Rejection

### 1. ❌ Missing `PrivacyInfo.xcprivacy`

Apple **requires** a privacy manifest for all apps submitted after May 1, 2024. The app has **none**. This is an **automatic rejection**.

**APIs used that must be declared:**
- `UserDefaults` — Capacitor Preferences (`@capacitor/preferences`) uses it
- Firebase Cloud Messaging — push notifications

**Fix:** Create `frontend/ios/App/App/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

---

### 2. ❌ Missing Privacy Descriptions in `Info.plist`

The app uses camera, photo library, and geolocation but has **zero** usage description strings. These are **required by Apple** and will cause rejection.

**Files using these features:**

| Feature | Required Key | Source Files |
|---------|-------------|-------------|
| Camera | `NSCameraUsageDescription` | `ProductForm.jsx`, `Profile.jsx`, `DeliveryProofUpload.jsx` |
| Photo Library | `NSPhotoLibraryUsageDescription` | Same as above |
| Location | `NSLocationWhenInUseUsageDescription` | `DeliveryProofUpload.jsx`, `ShopProfile.jsx`, `AdminUsers.jsx`, `DeliveryProfile.jsx` |

**Fix:** Add to `frontend/ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>HDMarket utilise la caméra pour prendre des photos de vos produits et justificatifs de livraison.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>HDMarket accède à vos photos pour illustrer vos annonces et votre profil.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>HDMarket utilise votre position pour vérifier les livraisons et afficher les boutiques proches de vous.</string>
```

---

### 3. ❌ Missing Push Notification Entitlements

`UIBackgroundModes` has `remote-notification` in `Info.plist`, but there is **no `.entitlements` file** with `aps-environment`. Push notifications will silently fail on iOS.

**Fix:** Create `frontend/ios/App/App/App.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
</dict>
</plist>
```

---

### 4. ⚠️ In-App Purchase (IAP) Risk — Payment Flow Audit

HDMarket sells **physical goods** (marketplace products), which is exempt from Apple's IAP requirement. However:

- Any **digital goods, premium features, boosts, subscriptions** sold inside the app **must** use Apple IAP (30% commission)
- The `boostController.js` (shop boosts), promotion features, and promo codes could be flagged by reviewers
- Manual payment proof uploads (Orange Money, MTN Money, Airtel Money) are acceptable for physical goods
- The wallet system (`walletController.js`) must only hold funds from physical goods transactions

**Action:** Document in App Review notes that all transactions are exclusively for physical goods. If boosts/promotions are sold, they must either go through IAP or be purchasable only outside the app (website).

---

### 5. ⚠️ Outdated `armv7` Architecture

`UIRequiredDeviceCapabilities` in `Info.plist` lists `armv7`. iOS 11+ (2017) dropped support for 32-bit armv7. This should be `arm64` only.

**Fix:** Change `armv7` → `arm64` in `Info.plist`:
```xml
<key>UIRequiredDeviceCapabilities</key>
<array>
    <string>arm64</string>
</array>
```

---

## 🔴 CRITICAL — High Crash / Bad UX Risk

### 6. JS Bundle is 5.97 MB (6 MB)

| Chunk | Size | Notes |
|-------|------|-------|
| `exceljs.min.js` | 937 KB | Excel export — admin only |
| `index.js` (main app) | 710 KB | Core bundle |
| `xlsx.js` | 429 KB | Spreadsheet — admin only |
| `recharts (BarChart)` | 393 KB | Charts — admin reports only |
| **Total** | **5.97 MB** | |

**Impact on Congo mobile networks (~1 Mbps 3G):** ~48 seconds first load time. Apple requires apps to display content within seconds.

**Fix:** Lazy-load all admin-only libraries:
```js
// AdminReports.jsx
const BarChart = React.lazy(() => import('recharts').then(m => ({ default: m.BarChart })));

// Export utilities
const exportExcel = async (data) => {
  const ExcelJS = await import('exceljs');
  // ...
};
```

---

### 7. 171 `<img>` Tags Without `loading="lazy"`

Every product image, shop logo, and banner loads eagerly on mount. On a product listing page with 20+ products, this blocks the main thread on older iPhones (iPhone SE, iPhone 8).

**Affected files (top offenders):**
- `ProductCard.jsx` (product grid images)
- `ProductDetails.jsx` (gallery)
- `ShopProfile.jsx` (banner + products)
- `UserOrders.jsx` (order item thumbnails)

**Fix:** Add `loading="lazy"` and explicit `width`/`height` to all `<img>` tags:
```jsx
<img src={product.image} loading="lazy" width="300" height="300" alt={product.name} />
```

---

### 8. 146 `<img>` Tags Without `alt` Text

Accessibility violation. Apple's Human Interface Guidelines require all images to have descriptive alt text. This can be flagged during App Review under accessibility standards.

---

### 9. 211 Bare `catch {}` Blocks That Swallow Errors

Errors are silently discarded across 211 locations. When something fails on mobile (network timeout, memory pressure, JSON parse error), the app silently shows stale data or freezes.

**Pattern to fix:**
```js
// ❌ Bad — user sees nothing
try { await api.get('/orders'); } catch {}

// ✅ Good — user sees error state
try { await api.get('/orders'); } catch (err) {
  console.error('[Orders]', err);
  setError('Impossible de charger vos commandes. Vérifiez votre connexion.');
}
```

---

### 10. `setInterval` Without Cleanup in 10+ Components

| File | Interval | Risk |
|------|----------|------|
| `Navbar.jsx:347` | `fetchOrders` every 60s | Leaks on navigation away |
| `Navbar.jsx:380` | `fetchSellerOrders` every 60s | Leaks on navigation away |
| `ProductCard.jsx:130` | Carousel rotation every 3s | Leaks when card unmounts |
| `ProductCard.jsx:155` | Same (second instance) | Leaks when card unmounts |
| `CountdownTimer.jsx:40` | Countdown every 1s | Leaks on unmount |
| `CancellationTimer.jsx:18` | Timer every 1s | Leaks on unmount |
| `SplashScreen.jsx:18` | Countdown every 1s | One-time, benign |
| `OrderChat.jsx:872` | Polling every N ms | Leaks on page leave |
| `InstallmentReminder.jsx:31` | Clock every 60s | Leaks on unmount |
| `ProductForm.jsx:796` | Upload progress interval | Leaks on cancel |

**Fix:** Wrap all intervals in `useEffect` cleanup:
```js
useEffect(() => {
  const id = setInterval(fetchOrders, 60000);
  return () => clearInterval(id);
}, []);
```

---

## 🟡 IMPORTANT — Performance & UX

### 11. `localStorage` Used in 10 Files Instead of Capacitor Preferences

iOS can evict `localStorage` when storage is low. Capacitor's `@capacitor/preferences` API survives storage pressure.

**Files bypassing the storage wrapper:**
- `recentViews.js`
- `chatEncryption.js`
- `networkMetrics.js`
- `priceFormatter.js`
- `clearUserDataOnLogout.js`
- `settingsRefresh.js`
- `AdminLayout.jsx`
- `shopProfileHelpers.js`
- `ChatBox.jsx`

**Fix:** Route all persistent storage through `storage.js` which already wraps `@capacitor/preferences`. For truly ephemeral data, use `sessionStorage` or in-memory state.

---

### 12. `window.confirm()` / `window.prompt()` Used on Mobile

`AdminUsers.jsx` uses `window.prompt('Nom de la boutique :', ...)` and `window.confirm('Êtes-vous sûr...')`. These native browser dialogs look terrible on iOS and cannot be styled. Apple may flag this as poor UX.

**Fix:** Use the existing `<AlertDialog>` component from `@radix-ui/react-alert-dialog` for confirms, and a simple `<input>` modal for prompts.

---

### 13. No `LaunchScreen.storyboard`

`Info.plist` references `UILaunchStoryboardName` → `LaunchScreen` but the file does not exist. iOS shows a black screen for 1-2 seconds on cold start. Apple provides LaunchScreen to show a branded splash immediately.

**Fix:** Create a simple `LaunchScreen.storyboard` with the HDMarket logo centered on `#FF6A00` background.

---

### 14. `theme_color` Mismatch

`public/manifest.webmanifest` declares `"theme_color": "#6366f1"` (indigo) but the app's brand color is `#FF6A00` (orange). The PWA/status bar tint color will be wrong on Android and iOS Safari.

**Fix:** Change to:
```json
{
  "theme_color": "#FF6A00",
  "background_color": "#fff8f1"
}
```

---

### 15. `NSAppTransportSecurity` Exceptions in Production

The `Info.plist` has ATS exceptions for `localhost` and `127.0.0.1`:

```xml
<key>NSExceptionAllowsInsecureHTTPLoads</key>
<true/>
```

This is fine for development but Apple **may question it** during review. Production apps should not have localhost ATS exceptions.

**Fix:** Either remove before submission, or document in review notes that these are for development only and the production API uses HTTPS.

---

### 16. No Offline Mode or Caching Strategy

While the app has `AppOfflineDiagnosticsCard` and `NetworkStatusBanner`, there is no service worker or offline-first strategy. If the user opens the app with no signal, they see errors or stale data.

**Recommendations:**
- Cache the home page products and categories for offline display
- Show a "You're offline — some features limited" banner consistently
- Queue mutations (add to cart, favorite) and replay when online

---

## 🟢 NICE-TO-HAVE — Polish for a Great App

### 17. No Haptic Feedback

iOS users expect `UIImpactFeedback` on button taps, swipe-to-delete, pull-to-refresh, and toggle switches. Capacitor has `@capacitor/haptics` for this.

**Priority interactions to add haptics:**
- Add to cart → `impactLight`
- Swipe to delete → `impactMedium`
- Order confirmed → `notificationSuccess`
- Toggle favorite → `impactLight`

```js
import { Haptics, ImpactStyle } from '@capacitor/haptics';
await Haptics.impact({ style: ImpactStyle.Light });
```

---

### 18. No Deep Linking / Universal Links

Sharing a product link (`https://hdmarket.cg/product/some-slug`) opens in the browser instead of the native app. Apple expects apps to support universal links.

**Fix:**
1. Create `apple-app-site-association` file on the server
2. Add `associatedDomains` entitlement to the app
3. Handle incoming URLs in `AppDelegate.swift` (already has the stub)

---

### 19. No `SKStoreReviewController` Integration

There is no in-app rating prompt. Users never get asked to review the app, resulting in fewer App Store ratings.

**Fix:** Use `@capacitor/rate-app` or call `SKStoreReviewController.requestReview()` after positive moments (5th completed order, successful delivery).

---

### 20. No `navigator.share()` for Product Sharing

Users copy-paste product URLs instead of getting the native iOS share sheet (Messages, WhatsApp, Mail, etc.).

**Files that would benefit:**
- `ProductDetails.jsx` — share product
- `ShopProfile.jsx` — share shop

```js
await navigator.share({
  title: product.name,
  text: `${product.name} — ${product.priceFormatted} FCFA`,
  url: `https://hdmarket.cg/product/${product.slug}`
});
```

---

### 21. 731 Click Handlers, No Touch Optimization

On mobile, click events have a **300ms delay** on iOS Safari unless you add `touch-action: manipulation` to interactive elements. Capacitor's WKWebView may not have this delay, but it's good practice.

**Fix:** Add to global CSS:
```css
button, a, [role="button"], input, select, textarea {
  touch-action: manipulation;
}
```

---

### 22. No `@capacitor/status-bar` Plugin

The status bar text color cannot adapt to light/dark backgrounds. On pages with dark headers, the status bar text becomes invisible on iOS.

**Fix:** Install `@capacitor/status-bar` and set the style per-page.

---

### 23. No Pull-to-Refresh on Key Pages

Users expect to pull down to refresh on:
- Product listings
- Orders list (`UserOrders.jsx`)
- Messages (`ChatBox.jsx`)
- Notifications
- Shop products

**Fix:** Implement pull-to-refresh using `react-router-dom`'s `useRevalidator` or TanStack Query's `refetch`.

---

### 24. 7 `console.log` Statements in Production

Small, but should be stripped for production to avoid leaking data. Use `vite build`'s `drop_console: true` or a custom logger that is disabled in production.

```js
// vite.config.js
export default defineConfig({
  build: { minify: 'terser', terserOptions: { compress: { drop_console: true } } }
});
```

---

### 25. GoogleService-Info.plist in Repository

The Firebase configuration file contains the API key and is tracked in version control. While Firebase API keys for mobile apps are designed to be public (they're restricted by bundle ID), best practice is to `.gitignore` this file and provide it via CI/CD.

---

### 26. No `@capacitor/splash-screen` Plugin

On cold start, there is a flash of white before React renders the custom splash screen. Capacitor's `@capacitor/splash-screen` plugin shows a native splash immediately and hides it when the web view is ready.

---

## 📊 Summary Statistics

| Metric | Current | Target |
|--------|---------|--------|
| JS bundle size | 5.97 MB | < 2 MB (lazy load admin) |
| First load time (3G) | ~48s | < 5s |
| `<img>` w/ lazy loading | 0 / 171 | 100% |
| `<img>` w/ alt text | 25 / 171 | 100% |
| Bare catch blocks | 211 | 0 (all must log) |
| `setInterval` without cleanup | 10+ | 0 |
| Privacy descriptions | 0 | 3 required |
| Privacy manifest | ❌ Missing | Required |
| Push entitlements | ❌ Missing | Required |
| `console.log` in prod | 7 | 0 |
| Haptics calls | 0 | 10+ |

---

## 📋 Priority Action Plan

### WEEK 1 — App Store Readiness (BLOCKERS)
- [ ] 1. Create `PrivacyInfo.xcprivacy`
- [ ] 2. Add `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`
- [ ] 3. Create `App.entitlements` with `aps-environment`
- [ ] 4. Document physical goods exemption for IAP
- [ ] 5. Fix `armv7` → `arm64` in Info.plist

### WEEK 2 — Stability (CRITICAL)
- [ ] 6. Lazy-load `exceljs`, `xlsx`, `jspdf`, `recharts`
- [ ] 7. Add `loading="lazy"` + `width`/`height` to all `<img>` tags
- [ ] 8. Add `alt` text to all images
- [ ] 9. Fix all `setInterval` leaks (add cleanup)
- [ ] 10. Add error logging to bare `catch {}` blocks

### WEEK 3 — UX Polish (IMPORTANT)
- [ ] 11. Route all storage through Capacitor Preferences wrapper
- [ ] 12. Replace `window.confirm()`/`window.prompt()` with custom dialogs
- [ ] 13. Create `LaunchScreen.storyboard`
- [ ] 14. Fix `theme_color` in manifest → `#FF6A00`
- [ ] 15. Remove or document ATS exceptions
- [ ] 16. Add basic offline caching

### WEEK 4 — Launch Polish (NICE-TO-HAVE)
- [ ] 17. Add haptic feedback to key interactions
- [ ] 18. Set up universal links / deep linking
- [ ] 19. Add in-app rating prompt
- [ ] 20. Add native share sheet for products
- [ ] 21. Add `touch-action: manipulation` globally
- [ ] 22. Install and configure `@capacitor/status-bar`
- [ ] 23. Add pull-to-refresh on key pages
- [ ] 24. Strip `console.log` in production build
- [ ] 26. Install `@capacitor/splash-screen`

---

## 🔧 Useful Capacitor Plugins to Install

```bash
npm install @capacitor/haptics
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/share
npm install @capacitor/rate-app
```

---

*Report generated by automated codebase scan. Prioritize BLOCKERS first — they will cause App Store rejection.*
