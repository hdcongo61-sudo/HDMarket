import { describe, expect, it } from 'vitest';
import { buildAudienceFilter } from './notificationAudienceResolver.js';

const BASE = { isBlocked: { $ne: true }, isActive: { $ne: false } };

describe('buildAudienceFilter', () => {
  it('returns just the base safety filter for an empty audience', () => {
    expect(buildAudienceFilter({})).toEqual(BASE);
  });

  it('treats userTypes:["all"] the same as no userTypes filter', () => {
    expect(buildAudienceFilter({ userTypes: ['all'] })).toEqual(BASE);
  });

  it('filters by role', () => {
    const filter = buildAudienceFilter({ roles: ['delivery_agent'] });
    expect(filter.$and).toContainEqual({ role: { $in: ['delivery_agent'] } });
  });

  it('filters by country/city/commune ids', () => {
    const filter = buildAudienceFilter({
      countryIds: ['64a000000000000000000001'],
      cityIds: ['64a000000000000000000002'],
      communeIds: ['64a000000000000000000003']
    });
    expect(filter.$and).toContainEqual({ countryId: { $in: ['64a000000000000000000001'] } });
    expect(filter.$and).toContainEqual({ cityId: { $in: ['64a000000000000000000002'] } });
    expect(filter.$and).toContainEqual({ communeId: { $in: ['64a000000000000000000003'] } });
  });

  it('maps userTypes to accountType/role combinations', () => {
    const buyers = buildAudienceFilter({ userTypes: ['buyers'] });
    expect(buyers.$and).toContainEqual({ $or: [{ accountType: 'person' }] });

    const sellers = buildAudienceFilter({ userTypes: ['sellers'] });
    expect(sellers.$and).toContainEqual({ $or: [{ accountType: 'shop' }] });

    const delivery = buildAudienceFilter({ userTypes: ['delivery_agents'] });
    expect(delivery.$and).toContainEqual({ $or: [{ role: 'delivery_agent' }] });
  });

  it('filters new_users by a 30-day createdAt window relative to the given "now"', () => {
    const now = new Date('2026-01-31T00:00:00.000Z');
    const filter = buildAudienceFilter({ userTypes: ['new_users'] }, { now });
    const clause = filter.$and[0].$or[0];
    expect(clause.createdAt.$gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('restricts to beta testers when testerGroup is true', () => {
    const filter = buildAudienceFilter({ testerGroup: true });
    expect(filter.$and).toContainEqual({ betaTester: true });
  });

  it('treats specificUserIds as an override, ignoring every other targeting dimension', () => {
    const filter = buildAudienceFilter({
      roles: ['admin'],
      countryIds: ['64a000000000000000000001'],
      specificUserIds: ['64a000000000000000000009']
    });
    expect(filter).toEqual({ ...BASE, _id: { $in: ['64a000000000000000000009'] } });
  });

  it('drops invalid ObjectId strings instead of throwing', () => {
    const filter = buildAudienceFilter({ countryIds: ['not-an-id', '64a000000000000000000001'] });
    expect(filter.$and).toContainEqual({ countryId: { $in: ['64a000000000000000000001'] } });
  });
});
