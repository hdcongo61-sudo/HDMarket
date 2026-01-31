# Product Form — Mobile Redesign Proposal

## Summary

This document describes the mobile-focused redesign of the product creation/editing form (ProductForm) and its integration in the User Dashboard. The goal is to make publishing and editing listings more convenient on phones and small screens.

---

## Problems Addressed

1. **Long form in a modal** — On mobile, the form was shown inside a centered modal with limited height, causing lots of scrolling and a cramped feel.
2. **Small touch targets** — Buttons, radios, and upload areas were not consistently sized for touch (44px minimum recommended).
3. **No persistent submit** — Users had to scroll to the bottom to submit, which is easy to miss on long forms.
4. **Crop modal** — The image crop overlay was desktop-sized and not optimized for touch (drag/resize).
5. **Dense sections** — All sections were always visible, making the form feel long and overwhelming on small screens.

---

## Proposed & Implemented Changes

### 1. Full-Screen Experience on Mobile

- **Dashboard modal:** On viewports ≤768px, the product form opens in a **full-screen modal** (no rounded corners, no max-height). The header stays compact with a large close button (min 44px).
- **Result:** The form feels like a dedicated “Publish” screen instead of a small dialog, reducing cognitive load and making better use of the screen.

### 2. Compact Header Inside the Form

- **Mobile:** Single-line header with a small icon (12×12) and title/subtitle. No large centered block.
- **Desktop:** Keeps the existing centered header with large icon.
- **Result:** More vertical space for form content on mobile.

### 3. Collapsible Sections (Mobile Only)

- **Informations du produit** and **Photos du produit** use a toggle (chevron) on mobile. Tapping the section header expands/collapses the block.
- **Desktop:** Sections remain always expanded with the existing static headers.
- **Result:** Users can focus on one part of the form at a time and reduce scrolling.

### 4. Sticky Submit Button (Mobile)

- **Mobile:** A fixed bar at the bottom of the viewport shows the primary action (“Publier l’annonce” / “Mettre à jour l’annonce”). The bar uses safe-area insets for notched devices.
- **Desktop:** Submit stays inline at the end of the form.
- **Result:** Submit is always visible and reachable without scrolling.

### 5. Larger Touch Targets

- **Primary actions:** Sticky submit and crop modal buttons use at least 48px height on mobile and `touch-manipulation` to reduce delay.
- **Condition (Neuf/Occasion):** Radio labels get min-height 44px and larger hit area; radio circles are slightly larger (6×6) on mobile.
- **Upload area:** Photo upload zone has a minimum height and clearer “Appuyez pour ajouter des photos” copy on mobile.
- **Close (modal):** Dashboard modal close button is at least 44×44px on mobile.
- **Result:** Fewer mis-taps and better accessibility.

### 6. Input Tweaks for Mobile

- **Price:** `inputMode="decimal"` so mobile keyboards show a numeric/decimal keypad when appropriate. Input height and font size increased on mobile (min-h 48px, `text-base`).
- **Title:** Slightly larger padding and min-height on mobile for easier tapping and reading.
- **Result:** Faster and more comfortable data entry on phones.

### 7. Image Crop Modal — Mobile & Touch

- **Layout:** On mobile, the crop modal is **full-screen** (no padding, full width/height). Crop area uses a flexible height (e.g. max 60vh) so it fits different screen sizes.
- **Touch:** Touch events are supported for dragging the crop area: `onTouchStart`, `onTouchMove`, `onTouchEnd` with `touch-action: none` to avoid page scroll during drag. Shared logic with mouse via a small helper for pointer offset.
- **Buttons:** “Annuler” and “Confirmer le recadrage” use min-height 48px and safe-area padding at the bottom on mobile.
- **Result:** Cropping is usable with one hand and feels native on phones.

### 8. Safe Areas

- Sticky submit bar and crop modal footer use `env(safe-area-inset-bottom)` (and existing Tailwind safe-area utilities where applicable) so they sit above the home indicator on notched devices.
- Modal header uses safe-area-aware padding where needed.
- **Result:** No overlap with system UI on modern iPhones and similar devices.

---

## Technical Notes

- **Breakpoint:** Mobile behavior uses `useIsMobile(768)` (max-width 768px) in both ProductForm and UserDashboard.
- **editImageCrop:** The previously missing `editImageCrop(index)` was implemented so existing previews can be re-opened for cropping.
- **No new dependencies:** All behavior is done with existing React state, Tailwind, and the current `useIsMobile` hook.

---

## Optional Future Improvements

1. **Stepper / wizard:** Split the form into steps (e.g. “Infos” → “Photos” → “Prix & validation”) on mobile for an even more guided flow.
2. **Draft auto-save:** Save form state to `localStorage` or a draft API so users can leave and resume without losing data.
3. **Camera-first upload:** On mobile, prioritize “Take photo” in addition to “Choose from gallery” when adding images.
4. **Haptic feedback:** Light vibration on section expand/collapse and on successful submit (where supported).

---

## Files Touched

- `frontend/src/components/ProductForm.jsx` — Mobile layout, collapsible sections, sticky submit, crop touch support, `editImageCrop`, input/touch target tweaks.
- `frontend/src/pages/UserDashboard.jsx` — Full-screen product form modal on mobile, `useIsMobile`, larger close button.
- `PRODUCT_FORM_MOBILE_PROPOSAL.md` — This proposal.
