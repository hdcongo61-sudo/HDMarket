# HDMarket Admin Order Command Center

## Overview
This extension layers intelligent admin operations on top of the existing order lifecycle without replacing current business logic.

### Added capabilities
- Global command-center metrics for orders
- Delay detection and severity classification
- Automated reminders with anti-spam guards
- Admin alert center with priority sorting
- Seller performance and user risk monitoring
- Manual admin actions and timeline visibility

## Architecture

```text
[React Admin Dashboard]
        |
        v
[Express Admin APIs: /orders/admin/*]
        |
        +--> [MongoDB Orders]
        |       - order status + extension fields
        |       - timeline / notes / delay / reminder state
        |
        +--> [Notification Service]
        |       - in-app + socket + push via existing dispatcher
        |
        +--> [BullMQ Queue: order-automation]
                - detect-delays
                - seller-reminders
                - buyer-confirmation-reminders
                - review-reminders
                - experience-reminders
                - escalation-reminders
                        |
                        v
                  [Order Automation Worker]
                        |
                        v
                  [Mongo updates + notifications + admin cache invalidation]
```

## Order model extension
Added non-breaking fields to `Order`:
- `expectedDeliveryDate`
- `delayStatus` (`on_time|delayed|resolved|overridden`)
- `delaySeverity` (`none|slight|moderate|critical`)
- `delayDetectedAt`, `delayDays`, `delayOverride`
- `reviewRequested`, `reviewGiven`, `confirmationGiven`
- `reminderSentCount`, `lastReminderDate`, `reminderState.*`
- `adminPriority` (`LOW|MEDIUM|HIGH|CRITICAL`)
- `adminRiskScore`
- `statusStuckSince`
- `adminNotes[]`
- `timeline[]`

## Delay detection algorithm
Order is delayed when:
- status is not terminal (`cancelled|completed|confirmed_by_client`)
- `now > (expectedDeliveryDate || deliveryDate)`

Severity:
- `slight`: 1-2 days
- `moderate`: 3-5 days
- `critical`: 6+ days

Priority mapping:
- slight -> MEDIUM
- moderate -> HIGH
- critical -> CRITICAL

## Reminder safety rules
- `MAX_REMINDERS_PER_ORDER` (default 2)
- `MIN_REMINDER_INTERVAL_HOURS` (default 12)
- per-type reminder timestamps in `reminderState`
- reminders stop once terminal states or confirmation/review flags are satisfied

## Automated reminder jobs
Queue name: `order-automation`

Scheduled jobs:
- `detect-delays` every 15 min
- `seller-reminders` every 60 min
- `buyer-confirmation-reminders` every 60 min
- `review-reminders` every 6h
- `experience-reminders` every 12h
- `escalation-reminders` every 60 min

## Admin APIs
Mounted under `/orders/admin` (admin/manager protected):
- `GET /command-center`
- `GET /alerts`
- `GET /seller-performance`
- `GET /user-risk`
- `GET /:id/timeline`
- `POST /:id/actions`
- `POST /automation/detect-delays`
- `POST /automation/reminder-sweep`

## Filters supported
Across command-center/listing logic:
- status
- city
- shop/shopId
- dateFrom/dateTo
- deliveryMode
- paymentType
- delayed
- priority
- search (order id, user, shop, phone, code, address)

## Admin actions
`POST /orders/admin/:id/actions`
Body:
- `action`
  - `force_mark_delivered`
  - `force_close_order`
  - `trigger_manual_reminder`
  - `override_delay_status`
  - `add_admin_note`
- `note` (optional)
- `reminderType` (for manual reminder)
- `delaySeverity` (for override)

## Frontend integration notes
Recommended Admin page modules:
1. KPI header (global counters)
2. alert panel (priority buckets)
3. order grid with advanced filters/search
4. seller performance table
5. risk users table
6. order timeline drawer with admin actions

## Rollout strategy
1. Deploy backend extensions with `ORDER_AUTOMATION_ENABLED=false`.
2. Validate APIs from admin dashboard.
3. Enable queue in staging with Redis + BullMQ worker.
4. Monitor reminder volume and tune env thresholds.
5. Enable in production and watch alert/reminder metrics.
