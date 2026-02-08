# Admin User Restrictions System - Proposal

## Overview

This document proposes a granular user restriction system for HDMarket administrators. Instead of full account suspension, admins can apply targeted restrictions to specific user actions with optional start/end dates.

---

## Current State

The current admin system only supports:
- **Full block/unblock**: `isBlocked`, `blockedAt`, `blockedReason`
- Binary state: User is either fully active or fully suspended

---

## Proposed Restriction Types

| Restriction Key | French Label | Description |
|-----------------|--------------|-------------|
| `canComment` | Commentaires | Block user from posting comments on products |
| `canOrder` | Commandes | Block user from placing orders |
| `canMessage` | Messages | Block user from sending messages to sellers |
| `canAddFavorites` | Favoris | Block user from adding products to favorites |
| `canUploadImages` | Images | Block user from uploading images (products, profile) |

---

## Schema Changes

### User Model (`backend/models/userModel.js`)

```javascript
// Add to userSchema
restrictions: {
  canComment: {
    restricted: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    restrictedAt: { type: Date, default: null }
  },
  canOrder: {
    restricted: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    restrictedAt: { type: Date, default: null }
  },
  canMessage: {
    restricted: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    restrictedAt: { type: Date, default: null }
  },
  canAddFavorites: {
    restricted: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    restrictedAt: { type: Date, default: null }
  },
  canUploadImages: {
    restricted: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    restrictedAt: { type: Date, default: null }
  }
}
```

---

## API Endpoints

### 1. Apply/Update Restriction
```
PATCH /api/admin/users/:id/restrictions/:type
Body: {
  restricted: true,
  startDate: "2024-02-01T00:00:00Z" | null,  // null = immediate
  endDate: "2024-03-01T00:00:00Z" | null,    // null = permanent
  reason: "Spam detected"
}
```

### 2. Remove Restriction
```
DELETE /api/admin/users/:id/restrictions/:type
```

### 3. Get User Restrictions
```
GET /api/admin/users/:id/restrictions
Response: {
  canComment: { restricted: true, startDate: null, endDate: "2024-03-01", reason: "..." },
  canOrder: { restricted: false, ... },
  ...
}
```

### 4. View Orders to User's Products (Sellers)
```
GET /api/admin/users/:id/received-orders
Response: {
  orders: [...],
  total: 42,
  page: 1,
  totalPages: 5
}
```

---

## Restriction Enforcement

### Backend Middleware Pattern

```javascript
// utils/restrictionCheck.js
export const isRestricted = (user, restrictionType) => {
  const restriction = user?.restrictions?.[restrictionType];
  if (!restriction?.restricted) return false;

  const now = new Date();
  const start = restriction.startDate ? new Date(restriction.startDate) : null;
  const end = restriction.endDate ? new Date(restriction.endDate) : null;

  // Not yet active
  if (start && now < start) return false;

  // Already expired
  if (end && now > end) return false;

  return true;
};

export const getRestrictionMessage = (restrictionType) => {
  const messages = {
    canComment: "Vous n'êtes pas autorisé à commenter pour le moment.",
    canOrder: "Vous n'êtes pas autorisé à passer des commandes pour le moment.",
    canMessage: "Vous n'êtes pas autorisé à envoyer des messages pour le moment.",
    canAddFavorites: "Vous n'êtes pas autorisé à ajouter des favoris pour le moment.",
    canUploadImages: "Vous n'êtes pas autorisé à uploader des images pour le moment."
  };
  return messages[restrictionType] || "Action non autorisée.";
};
```

### Controller Integration

```javascript
// productController.js - addComment
if (isRestricted(req.user, 'canComment')) {
  return res.status(403).json({
    message: getRestrictionMessage('canComment'),
    restrictionType: 'canComment'
  });
}

// orderController.js - createOrder
if (isRestricted(req.user, 'canOrder')) {
  return res.status(403).json({
    message: getRestrictionMessage('canOrder'),
    restrictionType: 'canOrder'
  });
}

// userController.js - addFavorite
if (isRestricted(req.user, 'canAddFavorites')) {
  return res.status(403).json({
    message: getRestrictionMessage('canAddFavorites'),
    restrictionType: 'canAddFavorites'
  });
}
```

---

## Frontend UI Design

### AdminUsers.jsx - User Row Actions

```
[ Suspendre ] [ Restrictions v ] [ Commandes reçues ] [ Stats ]
                    |
                    +-- Commentaires (toggle + dates)
                    +-- Commandes (toggle + dates)
                    +-- Messages (toggle + dates)
                    +-- Favoris (toggle + dates)
                    +-- Images (toggle + dates)
```

### Restriction Modal

```
+------------------------------------------+
|  Restriction: Commentaires               |
+------------------------------------------+
|                                          |
|  [ ] Activer la restriction              |
|                                          |
|  Date de début (optionnel):              |
|  [________________________] [calendrier] |
|                                          |
|  Date de fin (optionnel):                |
|  [________________________] [calendrier] |
|                                          |
|  Raison (interne):                       |
|  [________________________________]      |
|                                          |
|  [Annuler]              [Appliquer]      |
+------------------------------------------+
```

### Visual Indicators

- Active restriction: Red badge with icon
- Scheduled restriction: Orange badge with clock icon
- Expired restriction: Gray badge (auto-cleared)

---

## "Received Orders" Feature

Allow admins to view orders placed on a seller's products:

### Route
```
GET /api/admin/users/:id/received-orders?page=1&limit=20&status=all
```

### AdminUsers.jsx Integration

Add a "Commandes reçues" button for shop accounts that opens a modal/page showing:
- Order ID, date, buyer info
- Products ordered (from this seller)
- Order status
- Total amount
- Link to full order details

---

## Future Implementations

### Phase 2
1. **Bulk restrictions**: Apply same restriction to multiple users
2. **Restriction templates**: Pre-defined restriction sets (e.g., "Spam Warning", "Payment Fraud")
3. **Auto-restrictions**: Triggered by system events (e.g., too many complaints)
4. **Restriction history**: Log of all restriction changes per user

### Phase 3
1. **Appeal system**: Users can request restriction review
2. **Graduated penalties**: Automatic escalation (warning -> 7 days -> 30 days -> permanent)
3. **IP-based restrictions**: Block actions from specific IPs
4. **Device fingerprinting**: Prevent restriction bypass via new accounts

### Phase 4
1. ~~**Admin audit log**: Track who applied what restrictions when~~ ✅ IMPLEMENTED
2. **Restriction analytics**: Dashboard showing restriction patterns
3. **Automatic expiration cleanup**: Cron job to clear expired restrictions
4. **Email notifications**: Notify users when restrictions are applied/lifted

---

## Implementation Priority

| Priority | Feature | Effort |
|----------|---------|--------|
| P1 | Basic restriction schema | Low |
| P1 | Apply/remove restriction API | Medium |
| P1 | Restriction enforcement in controllers | Medium |
| P1 | Admin UI for restrictions | Medium |
| P2 | Date-based restrictions | Low |
| P2 | "Received orders" view | Medium |
| P3 | Restriction history | Medium |
| P3 | Bulk actions | Medium |

---

## Files to Modify

### Backend
- `backend/models/userModel.js` - Add restrictions schema
- `backend/controllers/adminController.js` - Add restriction endpoints
- `backend/routes/adminRoutes.js` - Register new routes
- `backend/utils/restrictionCheck.js` - New file for restriction helpers
- `backend/controllers/productController.js` - Enforce comment restriction
- `backend/controllers/orderController.js` - Enforce order restriction
- `backend/controllers/userController.js` - Enforce favorites/image restrictions
- `backend/controllers/orderMessageController.js` - Enforce message restriction

### Frontend
- `frontend/src/pages/AdminUsers.jsx` - Add restriction UI
- `frontend/src/components/RestrictionModal.jsx` - New modal component
- `frontend/src/components/ReceivedOrdersModal.jsx` - New modal for seller orders
- `frontend/src/services/api.js` - Add restriction API calls

---

## Security Considerations

1. Only admins can view/modify restrictions
2. Cannot restrict other admins
3. Cannot self-restrict
4. Audit trail for all restriction changes
5. Rate limiting on restriction API endpoints
