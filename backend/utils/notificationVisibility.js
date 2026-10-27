// The inbox and badge must describe the same set, including timed visibility.
export const buildVisibleNotificationFilter = (userId, now = new Date()) => ({
  user: userId,
  deletedAt: null,
  'delivery.status': { $ne: 'suppressed' },
  $and: [
    { $or: [{ channels: 'IN_APP' }, { channels: { $exists: false } }] },
    { $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }] },
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }
  ]
});

export const buildUnreadNotificationFilter = (userId, now = new Date()) => ({
  ...buildVisibleNotificationFilter(userId, now),
  readAt: null
});
