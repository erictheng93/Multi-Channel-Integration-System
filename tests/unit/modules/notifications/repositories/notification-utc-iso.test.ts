import { describe, expect, it } from 'vitest';
import { utcIso } from '@modules/notifications/repositories/notification-repository';

// SQLite datetime('now') text has no zone; a browser in Taipei parsed it as local time and showed every
// notification as 8 hours old (seen on production 2026-11-23).
describe('utcIso', () => {
  it('turns SQLite UTC text into ISO-8601 UTC, so it parses to the same instant in any zone', () => {
    expect(utcIso('2026-11-23 07:15:46')).toBe('2026-11-23T07:15:46Z');
    expect(Date.parse(utcIso('2026-11-23 07:15:46'))).toBe(Date.UTC(2026, 10, 23, 7, 15, 46));
  });

  it('leaves ISO values, empty strings and undefined alone', () => {
    expect(utcIso('2026-11-30T07:15:46.073Z')).toBe('2026-11-30T07:15:46.073Z');
    expect(utcIso('')).toBe('');
    expect(utcIso(undefined)).toBeUndefined();
  });
});
