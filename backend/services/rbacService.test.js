import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSIONS } from './rbacService.js';

describe('rbacService — notification campaign permissions', () => {
  it('grants admin the notification campaign and onboarding permissions', () => {
    const admin = { role: 'admin' };
    expect(hasPermission(admin, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.MANAGE_ONBOARDING)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.VIEW_NOTIFICATION_ANALYTICS)).toBe(true);
  });

  it('grants founder every permission regardless of the role permission map', () => {
    const founder = { role: 'founder' };
    expect(hasPermission(founder, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(true);
    expect(hasPermission(founder, PERMISSIONS.MANAGE_ONBOARDING)).toBe(true);
  });

  it('does not grant a buyer (default "user" role) any campaign permission', () => {
    const buyer = { role: 'user' };
    expect(hasPermission(buyer, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(false);
    expect(hasPermission(buyer, PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS)).toBe(false);
    expect(hasPermission(buyer, PERMISSIONS.MANAGE_ONBOARDING)).toBe(false);
  });

  it('does not grant a seller (shop accountType, still role "user") any campaign permission', () => {
    const seller = { role: 'user', accountType: 'shop' };
    expect(hasPermission(seller, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(false);
  });

  it('gives manager view-only analytics access, not campaign management', () => {
    const manager = { role: 'manager' };
    expect(hasPermission(manager, PERMISSIONS.VIEW_NOTIFICATION_ANALYTICS)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(false);
    expect(hasPermission(manager, PERMISSIONS.MANAGE_ONBOARDING)).toBe(false);
  });

  it('does not grant a delivery agent any notification-campaign permission', () => {
    const courier = { role: 'delivery_agent' };
    expect(hasPermission(courier, PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS)).toBe(false);
    expect(hasPermission(courier, PERMISSIONS.MANAGE_ONBOARDING)).toBe(false);
  });
});
