# Notifications Page — Design & Feature Improvements

This document describes the Apple-inspired mobile design applied to the Notifications page and proposes future enhancements.

---

## 1. Apple Design Principles Applied

### 1.1 Visual Language
- **Background:** Light gray system background (`#f2f2f7`) on mobile for a native iOS feel, reducing visual noise and focusing attention on content.
- **Typography:** Clear hierarchy with a large, bold title and a subtle subtitle (e.g. unread/total count).
- **Spacing:** Generous padding and consistent insets; list rows use compact but touch-friendly padding (`p-4`).

### 1.2 Header
- **Sticky header** with `backdrop-blur-xl` so content scrolls underneath while the title and actions stay visible.
- **Large title** (“Notifications”) with a small subtitle showing notification counts.
- **Text-style actions** (“Préférences”, “Tout marquer lu”) instead of heavy icon buttons, aligned with iOS Settings/Mail style.

### 1.3 Segmented Control
- **iOS-style segmented control** for “Toutes” and “Non lues” instead of separate filter buttons.
- Single, rounded container with two segments; active segment has distinct background, inactive is subtle.
- Clear selected state and smooth transitions.

### 1.4 Grouped List
- Notifications are presented in **one grouped card** (`rounded-2xl`) rather than many separate cards.
- **List rows** with:
  - Bottom borders between items (no border on last item).
  - **Blue dot** on the left for unread items (replacing the gradient bar used on desktop).
  - Consistent row height and tap targets.
- Removes card clutter and mimics iOS “grouped” table style (e.g. Settings, Mail).

### 1.5 Actions
- **Always-visible actions** (“Marquer lu”, “Supprimer”) so users don’t depend on hover.
- **Pill-shaped buttons** with semantic colors (e.g. indigo for read, red for delete).
- Icons with optional text labels (e.g. “Marquer lu” on larger screens) for clarity and accessibility.

### 1.6 Filters
- **Collapsible “Filtres” row:** tapping expands/collapses filter options instead of a permanent filter bar.
- Keeps the main view clean and puts advanced filtering one tap away.

### 1.7 Responsive Behavior
- **`useIsMobile(768)`** drives layout: Apple-style grouped list, segmented control, and sticky blurred header on mobile; desktop keeps the previous card-based layout.
- Safe-area aware layout so content respects notches and home indicators.

---

## 2. Implemented Features (Summary)

| Feature | Description |
|--------|-------------|
| Mobile-first layout | Conditional layout and styles below 768px. |
| Sticky blurred header | Large title, subtitle (counts), text actions. |
| Segmented control | “Toutes” / “Non lues” with clear active state. |
| Grouped list | Single rounded container, rows with dividers, blue dot for unread. |
| Inline actions | “Marquer lu” and “Supprimer” always visible per row. |
| Collapsible filters | “Filtres” row toggles filter panel. |
| Preferences | Existing preferences modal; entry point from header “Préférences”. |

---

## 3. Feature Improvement Proposals

### 3.1 High Priority

- **Swipe actions (iOS-style)**  
  Swipe left on a row to reveal “Marquer lu” and “Supprimer” (and optionally “Archiver”). Improves one-handed use and matches platform expectations.

- **Pull-to-refresh**  
  Pull down on the list to refresh notifications, with a subtle loading indicator. Standard on iOS and expected in list-based screens.

- **Haptic feedback (where supported)**  
  Light haptic on segment change, mark-as-read, and delete to reinforce actions without adding visual clutter.

- **Empty states**  
  Dedicated empty state when there are no notifications (and when “Non lues” is empty): illustration or icon, short message, and optional CTA (e.g. “Découvrir les annonces”).

### 3.2 Medium Priority

- **Batch actions**  
  “Tout marquer lu” already exists; add “Tout supprimer” (with confirmation) and, if needed, multi-select mode (e.g. checkboxes) for “Marquer comme lus” / “Supprimer” on selected items.

- **Grouping by date**  
  Section headers like “Aujourd’hui”, “Hier”, “Cette semaine”, “Plus ancien” to make scanning easier and align with Mail/Reminders.

- **Notification grouping by type or thread**  
  Option to collapse “3 new comments on Product X” into one row that expands to show the list, reducing list length and cognitive load.

- **Deep linking**  
  Ensure every notification opens the correct screen (product, order, conversation, etc.) and, when applicable, restores scroll position or opens the relevant tab.

### 3.3 Lower Priority / Polish

- **Skeleton loading**  
  Replace generic spinner with skeleton rows that mirror the final list layout for a smoother perceived performance.

- **Animations**  
  Subtle list animations (e.g. when marking as read or deleting): fade/slide out and list reflow to feel responsive and polished.

- **Badge on tab/icon**  
  Show unread count on the app shell’s Notifications tab or icon so users see at a glance that they have new notifications.

- **Sound / vibration**  
  Optional sound or vibration for new notifications (with user preference), especially for high-priority types (e.g. order updates, messages).

- **Accessibility**  
  - Ensure segmented control and list rows have correct roles and labels (e.g. `role="tablist"`, `aria-selected`).  
  - Announce “Marquer lu” / “Supprimer” to screen readers.  
  - Support “Mark as read” / “Delete” via keyboard or switch access where applicable.

---

## 4. Technical Notes

- **Hook:** `useIsMobile(768)` from `frontend/src/hooks/useIsMobile.js` is used to switch between mobile and desktop layouts.
- **Data:** Notifications and preferences come from `useUserNotifications`; filtering is done in the component with `useMemo` (e.g. `filteredAlerts`).
- **Styling:** Tailwind CSS; mobile uses `bg-[#f2f2f7]`, `backdrop-blur-xl`, `rounded-2xl`, and semantic colors for actions. No new dependencies required for the current design.

---

## 5. References

- [Apple HIG — Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- [Apple HIG — Lists and Tables](https://developer.apple.com/design/human-interface-guidelines/lists)
- [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)

---

*Last updated: January 2025*
