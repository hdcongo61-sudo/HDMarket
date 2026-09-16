import { describe, expect, it } from 'vitest';
import { isToolDue } from './founderTools';
describe('founder reminder recurrence', () => {
  const now = Date.parse('2026-09-16T12:00:00Z');
  it('shows new, corrupted or future checks as due', () => {
    for (const value of [undefined, 'invalid', '2027-01-01']) expect(isToolDue(value, 1, now)).toBe(true);
  });
  it('expires daily and weekly checks at their interval', () => {
    expect(isToolDue('2026-09-15T12:00:01Z', 1, now)).toBe(false);
    expect(isToolDue('2026-09-15T12:00:00Z', 1, now)).toBe(true);
    expect(isToolDue('2026-09-10T12:00:00Z', 7, now)).toBe(false);
    expect(isToolDue('2026-09-09T12:00:00Z', 7, now)).toBe(true);
  });
});
