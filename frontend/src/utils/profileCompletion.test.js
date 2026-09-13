import { describe, expect, it } from 'vitest';
import { getProfileCompletion } from './profileCompletion';

describe('getProfileCompletion', () => {
  it('scores a simple user across the six common fields', () => {
    const result = getProfileCompletion({
      user: { accountType: 'person', email: 'a@b.c', profileImage: 'img.png' },
      form: { name: 'Ali', phone: '0612345678', city: 'Brazzaville' }
    });
    expect(result.percent).toBe(83); // 5/6
    expect(result.isComplete).toBe(false);
    expect(result.remaining.map((item) => item.id)).toEqual(['gender']);
  });

  it('is complete when every common field is filled', () => {
    const result = getProfileCompletion({
      user: { accountType: 'person', email: 'a@b.c', profileImage: 'img.png' },
      form: { name: 'Ali', phone: '0612345678', city: 'Brazzaville', gender: 'male' }
    });
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.remaining).toHaveLength(0);
  });

  it('adds shop fields for shop accounts', () => {
    const result = getProfileCompletion({
      user: { accountType: 'shop' },
      form: {}
    });
    expect(result.total).toBe(9);
    expect(result.checks.some((check) => check.id === 'shopName')).toBe(true);
    expect(result.percent).toBe(0);
  });

  it('counts a shop as complete only when shop fields are present too', () => {
    const result = getProfileCompletion({
      user: {
        accountType: 'shop',
        email: 'a@b.c',
        profileImage: 'img.png',
        shopLogo: 'logo.png'
      },
      form: {
        name: 'Ali',
        phone: '0612345678',
        city: 'Brazzaville',
        gender: 'male',
        shopName: 'Ali Store',
        shopDescription: 'Vêtements'
      }
    });
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it('handles missing data safely', () => {
    const result = getProfileCompletion({});
    expect(result.percent).toBe(0);
    expect(result.total).toBe(6);
  });
});
