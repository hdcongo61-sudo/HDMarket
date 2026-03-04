# HDMarket Glassmorphism UI Guide

## Core Utility Classes
- `glass-page-shell`: page background with soft gradients and low-opacity glow layers.
- `glass-card`: subtle translucent card (`backdrop-blur`, soft border, readable contrast).
- `soft-card`: base for colored cards with blur and border.
- `soft-card-blue` / `soft-card-purple` / `soft-card-green` / `soft-card-orange` / `soft-card-red`: low-opacity semantic variants.
- `glass-header`: premium blurred header for top sections.
- `floating-glass-button`: floating action button skin with safe tap area.
- `glass-modal-panel` / `glass-modal-backdrop`: modal surface and overlay.
- `glass-skeleton`: shimmer loading state.
- `glass-fade-in`: short entrance animation.
- `glass-content-spacing`: mobile-first horizontal spacing utility.

## Reusable Components
- `GlassCard`: card shell with `variant` support (`glass`, `blue`, `purple`, `green`, `orange`, `red`).
- `SoftColorCard`: semantic card wrapper for highlighted metrics and status blocks.
- `GlassHeader`: sticky/non-sticky high-level header with title/subtitle/actions.
- `FloatingGlassButton`: mobile floating CTA with icon + label.
- `GlassModal`: modal wrapper around existing `BaseModal` preserving behavior.

## Mobile-first Layout Rules
- Container horizontal padding: use `glass-content-spacing` (`px-4` mobile, `px-6` from `sm`).
- Card spacing: `space-y-4` baseline between stacked sections.
- Card radius: `rounded-2xl`.
- Touch targets: minimum `min-h-[44px]` (prefer `48px` for primary actions).
- Keep heavy list surfaces mostly opaque; reserve glass effect for key blocks.

## Performance-safe Blur Rules
- Never apply strong blur to full-page scroll containers.
- Use glass only for headers, key cards, modals, and floating controls.
- Keep blur intensity moderate (`10px` to `18px` range).
- Built-in fallbacks:
  - `@supports not (backdrop-filter)` removes blur and keeps solid readable backgrounds.
  - `prefers-reduced-motion: reduce` disables blur-heavy layers.

## Accessibility Rules
- Light mode text: prefer `text-slate-900` / `text-slate-700`.
- Dark mode text: prefer `dark:text-white` / `dark:text-slate-200`.
- Avoid tiny text on highly transparent backgrounds.
- Preserve focus ring and keyboard navigation from existing system styles.
