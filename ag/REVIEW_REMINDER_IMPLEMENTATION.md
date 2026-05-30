# Review Reminder Implementation

## Overview
This feature automatically sends notifications to buyers 1 hour after their order is delivered, asking them to review and rate the products they purchased.

## Implementation Details

### 1. Core Functionality (`backend/utils/reviewReminder.js`)
- **`sendReviewReminders()`**: Main function that:
  - Finds orders delivered more than 1 hour ago
  - Checks if buyers have already reviewed products (ratings or comments)
  - Sends notifications for unreviewed products
  - Prevents duplicate notifications

- **`checkOrderReviewReminder()`**: Utility function to check if a specific order needs a reminder

### 2. Scheduled Job (`backend/server.js`)
- Runs automatically every hour
- Checks for delivered orders older than 1 hour
- Sends review reminders to buyers who haven't reviewed yet
- Starts 5 minutes after server startup

### 3. Notification System Updates

#### Notification Model (`backend/models/notificationModel.js`)
- Added `'review_reminder'` to notification types enum

#### Push Service (`backend/utils/pushService.js`)
- Added push notification message for review reminders:
  - Title: "Donnez votre avis"
  - Body: "Votre commande #XXXXXX a été livrée. Partagez votre expérience en notant vos produits !"

#### User Controller (`backend/controllers/userController.js`)
- Added message formatting for review reminder notifications

#### User Model (`backend/models/userModel.js`)
- Added `review_reminder` preference (default: true)
- Users can disable review reminder notifications

### 4. API Endpoints

#### Admin Endpoint
- **POST** `/api/admin/review-reminders/send`
  - Manually trigger review reminder check
  - Admin only
  - Returns: `{ processed, sent }`

#### User Endpoint
- **GET** `/api/orders/:id/review-reminder-check`
  - Check if a specific order needs a review reminder
  - Returns: `{ needsReminder, reason, unreviewedCount, totalProducts }`

### 5. Controller (`backend/controllers/reviewReminderController.js`)
- `triggerReviewReminders`: Admin endpoint handler
- `checkOrderReviewReminderStatus`: User endpoint handler

## How It Works

1. **Order Delivery**: When an order is marked as "delivered", the `deliveredAt` timestamp is set

2. **Scheduled Check**: Every hour, the system:
   - Finds all orders with `status: 'delivered'` and `deliveredAt` older than 1 hour
   - For each order:
     - Checks if a reminder was already sent (prevents duplicates)
     - Checks which products haven't been reviewed (no rating AND no comment)
     - If unreviewed products exist, sends a notification

3. **Notification Content**:
   - Includes order ID
   - Lists up to 3 unreviewed products
   - Provides link to review products

4. **User Preferences**:
   - Users can disable review reminder notifications in their preferences
   - Default is enabled

## Features

✅ **Automatic**: Runs every hour without manual intervention
✅ **Smart**: Only sends reminders for unreviewed products
✅ **No Duplicates**: Checks if reminder was already sent
✅ **Respects Preferences**: Honors user notification preferences
✅ **Push Notifications**: Sends push notifications to mobile apps
✅ **Manual Trigger**: Admins can manually trigger reminders

## Testing

### Manual Testing
1. Create and deliver an order
2. Wait 1 hour (or manually trigger: `POST /api/admin/review-reminders/send`)
3. Check buyer's notifications
4. Verify notification appears

### Check Order Status
```bash
GET /api/orders/{orderId}/review-reminder-check
```

### Manual Trigger (Admin)
```bash
POST /api/admin/review-reminders/send
Authorization: Bearer {admin_token}
```

## Configuration

The reminder check runs:
- **Interval**: Every 1 hour (60 minutes)
- **Delay after delivery**: 1 hour (60 minutes)
- **First run**: 5 minutes after server startup

To modify, edit `backend/server.js`:
```javascript
const REVIEW_REMINDER_INTERVAL = 60 * 60 * 1000; // Change this
```

## Notes

- The system checks for both ratings AND comments - if a user has either, the product is considered reviewed
- Only one reminder is sent per order (checked via existing notifications)
- The notification includes product details to help users remember what to review
- Works with both web and mobile (push notifications)
