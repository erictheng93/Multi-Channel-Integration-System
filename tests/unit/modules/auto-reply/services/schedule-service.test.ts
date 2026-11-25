// tests/unit/modules/auto-reply/services/schedule-service.test.ts
// Unit tests for schedule-service — timezone-aware business hours checking

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ==================== Mocks ====================

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
}));

// Mock schema
vi.mock('@/db/schema', () => ({
  autoReplySchedules: {
    teamId: { name: 'team_id' },
    isActive: { name: 'is_active' },
    dayOfWeek: { name: 'day_of_week' },
    name: 'auto_reply_schedules',
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Drizzle factory mock — return value controlled per test
const mockSelectResult: any[] = [];
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult)),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => mockSelectChain),
  })),
}));

// KV mock
const kvStore = new Map<string, string>();
const mockKV = {
  get: vi.fn(async (key: string, format?: string) => {
    const val = kvStore.get(key);
    if (!val) return null;
    return format === 'json' ? JSON.parse(val) : val;
  }),
  put: vi.fn(async (key: string, value: string) => {
    kvStore.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
};

function createMockEnv() {
  return {
    DB: {} as any,
    CACHE: mockKV,
  } as any;
}

// ==================== Import after mocks ====================

import { isWithinBusinessHours, invalidateScheduleCache } from '@modules/auto-reply/services/schedule-service';

// ==================== Helpers ====================

function everyDay(startTime: string, endTime: string, timezone = 'Asia/Taipei') {
  return Array.from({ length: 7 }, (_, i) => ({
    id: i + 1, teamId: 1, dayOfWeek: i, startTime, endTime, timezone, isActive: true,
  }));
}

// ==================== Tests ====================

describe('schedule-service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockSelectResult.length = 0;
  });

  // ───────────── No Schedule Defined ─────────────

  describe('no schedule defined', () => {
    it('should return true (always business hours) when no schedules exist', async () => {
      const env = createMockEnv();
      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(true);
    });
  });

  // ───────────── KV Cache ─────────────

  describe('KV caching', () => {
    it('should use cached schedules from KV', async () => {
      const env = createMockEnv();

      // Pre-populate KV with schedules that cover all days 00:00-23:59
      const cachedSchedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        teamId: 1,
        dayOfWeek: i,
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'Asia/Taipei',
        isActive: true,
      }));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(cachedSchedules));

      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(true);

      // D1 should NOT be called since KV had data
      const { createDbClient } = await import('@/db/drizzle-factory');
      expect(createDbClient).not.toHaveBeenCalled();
    });

    it('should fall through to D1 when KV cache misses', async () => {
      const env = createMockEnv();
      // Empty KV, empty D1 result → no schedules → return true
      await isWithinBusinessHours(1, env);

      const { createDbClient } = await import('@/db/drizzle-factory');
      expect(createDbClient).toHaveBeenCalled();
    });
  });

  // ───────────── Business Hours Logic ─────────────

  describe('business hours evaluation', () => {
    it('should return true when current time is within business hours', async () => {
      const env = createMockEnv();

      // Create schedule for every day: 00:00-23:59 (always within hours)
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        teamId: 1,
        dayOfWeek: i,
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'Asia/Taipei',
        isActive: true,
      }));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(true);
    });

    it('should return false when no schedule exists for current day', async () => {
      const env = createMockEnv();
      // 2026-10-29T02:00Z = Thursday 10:00 in Taipei; only Monday is scheduled
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-29T02:00:00.000Z'));
      kvStore.set('auto-reply:schedule:1', JSON.stringify([everyDay('09:00', '18:00')[1]]));

      expect(await isWithinBusinessHours(1, env)).toBe(false);
    });
  });

  // ───────────── Clock-pinned evaluation ─────────────

  describe('clock-pinned evaluation (Asia/Taipei = UTC+8)', () => {
    async function at(isoUtc: string, schedules: ReturnType<typeof everyDay>) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(isoUtc));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));
      return isWithinBusinessHours(1, createMockEnv());
    }

    it('daytime 09:00-17:00: open at 15:00, closed at 08:59 and 17:01, boundaries inclusive', async () => {
      const day = everyDay('09:00', '17:00');
      expect(await at('2026-10-29T07:00:00.000Z', day)).toBe(true); // 15:00
      expect(await at('2026-10-29T00:59:00.000Z', day)).toBe(false); // 08:59
      expect(await at('2026-10-29T09:01:00.000Z', day)).toBe(false); // 17:01
      expect(await at('2026-10-29T01:00:00.000Z', day)).toBe(true); // 09:00
      expect(await at('2026-10-29T09:00:00.000Z', day)).toBe(true); // 17:00
    });

    it('overnight 22:00-06:00: open at 23:00 and 03:00, closed at 12:00', async () => {
      const night = everyDay('22:00', '06:00');
      expect(await at('2026-10-29T15:00:00.000Z', night)).toBe(true); // 23:00
      expect(await at('2026-10-28T19:00:00.000Z', night)).toBe(true); // 03:00
      expect(await at('2026-10-29T04:00:00.000Z', night)).toBe(false); // 12:00
    });

    it('evaluates the clock in the timezone stored on the schedule, not UTC', async () => {
      // 02:00Z is 10:00 in Taipei (open) but 02:00 in UTC (closed)
      expect(await at('2026-10-29T02:00:00.000Z', everyDay('09:00', '18:00', 'Asia/Taipei'))).toBe(true);
      expect(await at('2026-10-29T02:00:00.000Z', everyDay('09:00', '18:00', 'UTC'))).toBe(false);
    });

    it('uses the Taipei weekday, not the UTC weekday', async () => {
      // 2026-10-28T22:00Z is Wednesday in UTC but Thursday 06:00 in Taipei
      const thursdayOnly = [everyDay('05:00', '07:00')[4]];
      expect(await at('2026-10-28T22:00:00.000Z', thursdayOnly)).toBe(true);
    });
  });

  // ───────────── Default Timezone ─────────────

  describe('default timezone', () => {
    it('should default to Asia/Taipei when timezone is empty string', async () => {
      const env = createMockEnv();
      // 02:00Z is 10:00 in Taipei (open) and 02:00 in UTC (closed)
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-29T02:00:00.000Z'));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(everyDay('09:00', '18:00', '')));

      expect(await isWithinBusinessHours(1, env)).toBe(true);
    });
  });

  // ───────────── Null TeamId (Global Schedules) ─────────────

  describe('null teamId (global schedules)', () => {
    it('should load any available schedules for null teamId via getAnySchedules', async () => {
      const env = createMockEnv();
      // getAnySchedules uses 'auto-reply:schedule:global' KV key
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1, teamId: 1, dayOfWeek: i,
        startTime: '00:00', endTime: '23:59',
        timezone: 'Asia/Taipei', isActive: true,
      }));
      kvStore.set('auto-reply:schedule:global', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(null, env);
      expect(result).toBe(true);
    });

    it('should return true when no global schedules exist', async () => {
      const env = createMockEnv();
      // No schedules at all → return true (always business hours)
      const result = await isWithinBusinessHours(null, env);
      expect(result).toBe(true);
    });
  });

  // ───────────── All Days Disabled ─────────────

  describe('all days disabled', () => {
    it('should return false when all days have isActive=false', async () => {
      const env = createMockEnv();
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1, teamId: 1, dayOfWeek: i,
        startTime: '09:00', endTime: '18:00',
        timezone: 'Asia/Taipei', isActive: false,
      }));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(1, env);
      // schedules.length > 0 but no active schedule for today → false
      expect(result).toBe(false);
    });
  });

  // ───────────── Error Handling ─────────────

  describe('error handling', () => {
    it('should return true (safe default) when KV and D1 both fail', async () => {
      const env = createMockEnv();

      // Make KV throw
      mockKV.get.mockRejectedValueOnce(new Error('KV error'));

      // Make D1 throw via drizzle mock
      mockSelectChain.where.mockImplementationOnce(() => {
        throw new Error('D1 error');
      });

      const result = await isWithinBusinessHours(1, env);
      // On error, should default to true (assume business hours)
      expect(result).toBe(true);
    });
  });

  // ───────────── Cache Invalidation ─────────────

  describe('invalidateScheduleCache', () => {
    it('should delete KV cache key for team', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:schedule:42', JSON.stringify([]));

      await invalidateScheduleCache(42, env);

      expect(mockKV.delete).toHaveBeenCalledWith('auto-reply:schedule:42');
    });
  });
});
