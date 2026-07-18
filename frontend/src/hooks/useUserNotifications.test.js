import { describe, expect, it } from 'vitest';
import { mergeNotificationSnapshot } from './useUserNotifications.js';

describe('mergeNotificationSnapshot', () => {
  it('does not let a late stale refresh make a read notification unread again', () => {
    const previousState = {
      alerts: [{ _id: 'notification-1', isNew: false, readAt: '2026-07-18T10:00:00.000Z' }],
      unreadCount: 0,
      commentAlerts: 0,
      preferences: {}
    };
    const staleServerState = {
      alerts: [{ _id: 'notification-1', isNew: true, readAt: null }],
      unreadCount: 1,
      commentAlerts: 1,
      preferences: {}
    };

    expect(mergeNotificationSnapshot(previousState, staleServerState)).toMatchObject({
      alerts: [
        {
          _id: 'notification-1',
          isNew: false,
          readAt: '2026-07-18T10:00:00.000Z'
        }
      ],
      unreadCount: 0,
      commentAlerts: 0
    });
  });

  it('still accepts genuinely new unread notifications from the server', () => {
    const previousState = {
      alerts: [{ _id: 'notification-1', isNew: false }],
      unreadCount: 0,
      commentAlerts: 0,
      preferences: {}
    };
    const serverState = {
      alerts: [
        { _id: 'notification-2', isNew: true },
        { _id: 'notification-1', isNew: false }
      ],
      unreadCount: 1,
      commentAlerts: 1,
      preferences: {}
    };

    const result = mergeNotificationSnapshot(previousState, serverState);
    expect(result.alerts[0].isNew).toBe(true);
    expect(result.unreadCount).toBe(1);
  });
});
