# Apple Design System - HDMarket

Design tokens and guidelines following Apple's Human Interface Guidelines (HIG).

## Principles
- **Clarity**: Legible text, precise icons, obvious functionality
- **Deference**: Content is primary; UI supports without competing
- **Depth**: Layers, motion, and hierarchy convey meaning

## Design Tokens

### Colors (System)
| Token | Light | Usage |
|-------|-------|-------|
| Apple Blue | `#007AFF` | Primary actions, links |
| Apple Blue Hover | `#0051D5` | Primary hover state |
| Apple Green | `#34C759` | Success, confirm |
| Apple Red | `#FF3B30` | Destructive, error |
| Apple Gray 6 | `#F2F2F7` | Page background |
| Apple Gray 5 | `#E5E5EA` | Separators |
| Apple Gray 4 | `#D1D1D6` | Borders |
| Apple Gray 3 | `#C7C7CC` | Disabled |
| Apple Gray 2 | `#AEAEB2` | Placeholder |
| Apple Gray 1 | `#8E8E93` | Secondary text |

### Radius
- `--radius-apple-sm`: 8px
- `--radius-apple-md`: 12px
- `--radius-apple-lg`: 16px
- `--radius-apple-xl`: 20px
- `--radius-apple-full`: 9999px (pill buttons)

### Typography
- **Large Title**: 28px, semibold
- **Title**: 22px, bold
- **Headline**: 17px, semibold
- **Body**: 17px, regular
- **Callout**: 16px, regular
- **Subhead**: 15px, regular
- **Footnote**: 13px, regular
- **Caption**: 12px, regular

## Utility Classes

### Components
- `.apple-card` - Elevated card with rounded corners
- `.apple-inset-group` - List-style grouped content
- `.apple-glass` - Blurred glass material
- `.apple-input` - Inset-style form input
- `.apple-btn-primary` - Primary (blue) button
- `.apple-btn-secondary` - Secondary button
- `.apple-section-title` - Section heading
- `.apple-section-caption` - Section description

### Touch & Feedback
- `.tap-feedback` - Scale 0.98 on active
- `.touch-target` - Min 44×44px
- `.touch-target-lg` - Min 48×48px

### Button Styles (JS)
Import from `utils/appleButtonStyles.js`:
```js
import { getAppleButtonClasses } from '../utils/appleButtonStyles';
const classes = getAppleButtonClasses('primary', false);
```

## Usage Examples
```jsx
<div className="apple-card p-6">
  <h2 className="apple-section-title">Section Title</h2>
  <p className="apple-section-caption">Description text</p>
  <input className="apple-input w-full" placeholder="..." />
  <button className="apple-btn-primary">Action</button>
</div>
```
