import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn() }));
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { evaluateBusinessHours } from '@modules/auto-reply/services/schedule-service';
import { taipeiDayStartISO } from '@/utils/taipei-time';

const day = (dayOfWeek: number, startTime = '09:00', endTime = '18:00', timezone = 'Asia/Taipei') => ({
  id: dayOfWeek, teamId: 1, dayOfWeek, startTime, endTime, timezone, isActive: true,
});

// 2026-10-29 is a Thursday (4) in Taipei
const weekdays = [1, 2, 3, 4, 5].map((d) => day(d));

describe('evaluateBusinessHours', () => {
  it('is open with the closing time during hours, evaluated in the schedule timezone', () => {
    // 02:00Z = 10:00 Taipei Thursday
    const status = evaluateBusinessHours(weekdays, new Date('2026-10-29T02:00:00.000Z'));

    expect(status).toEqual({ hasSchedule: true, isOpen: true, timezone: 'Asia/Taipei', closesAt: '18:00', opensAt: null });
  });

  it('is closed before opening and reports today opening', () => {
    // 22:00Z Wednesday = 06:00 Taipei Thursday: the UTC clock would say Wednesday evening
    const status = evaluateBusinessHours(weekdays, new Date('2026-10-28T22:00:00.000Z'));

    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toEqual({ dayOfWeek: 4, time: '09:00' });
  });

  it('is closed after hours on Friday and reopens Monday', () => {
    // 2026-10-30 12:00Z = 20:00 Taipei Friday
    const status = evaluateBusinessHours(weekdays, new Date('2026-10-30T12:00:00.000Z'));

    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toEqual({ dayOfWeek: 1, time: '09:00' });
  });

  it('uses the timezone stored on the schedule', () => {
    const tokyo = [1, 2, 3, 4, 5].map((d) => day(d, '09:00', '18:00', 'Asia/Tokyo'));
    // 00:30Z = 09:30 Tokyo Thursday (open), but 08:30 Taipei (closed in a Taipei schedule)
    const now = new Date('2026-10-29T00:30:00.000Z');

    expect(evaluateBusinessHours(tokyo, now)).toMatchObject({ isOpen: true, timezone: 'Asia/Tokyo' });
    expect(evaluateBusinessHours(weekdays, now).isOpen).toBe(false);
  });

  it('treats no schedule as always open and defaults the timezone', () => {
    expect(evaluateBusinessHours([], new Date())).toEqual({
      hasSchedule: false, isOpen: true, timezone: 'Asia/Taipei', closesAt: null, opensAt: null,
    });
  });
});

describe('taipeiDayStartISO', () => {
  it('returns the UTC instant of Taipei midnight', () => {
    expect(taipeiDayStartISO(Date.parse('2026-10-29T02:00:00.000Z'))).toBe('2026-10-28T16:00:00.000Z');
    // 15:59Z is still the same Taipei day, 16:00Z starts the next one
    expect(taipeiDayStartISO(Date.parse('2026-10-29T15:59:59.000Z'))).toBe('2026-10-28T16:00:00.000Z');
    expect(taipeiDayStartISO(Date.parse('2026-10-29T16:00:00.000Z'))).toBe('2026-10-29T16:00:00.000Z');
  });

  it('shifts by whole days', () => {
    expect(taipeiDayStartISO(Date.parse('2026-10-29T02:00:00.000Z'), -1)).toBe('2026-10-27T16:00:00.000Z');
  });
});
