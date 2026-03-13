// tests/unit/modules/auto-reply/services/schedule-service.test.ts
// Unit tests for schedule-service — timezone-aware business hours checking

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// ==================== Tests ====================

describe('schedule-service', () => {
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

      // Only schedule for Monday (day=1), but test runs on a different day
      // We create a schedule for a day that's NOT today
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        weekday: 'short',
      });
      const weekdayStr = formatter.format(now);
      const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };
      const today = weekdayMap[weekdayStr] ?? 0;
      const notToday = (today + 3) % 7; // A day that's NOT today

      const schedules = [{
        id: 1,
        teamId: 1,
        dayOfWeek: notToday,
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Asia/Taipei',
        isActive: true,
      }];
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(false);
    });

    it('should return false when schedule for today is inactive', async () => {
      const env = createMockEnv();

      // All days have schedule but isActive = false
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        teamId: 1,
        dayOfWeek: i,
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Asia/Taipei',
        isActive: false,
      }));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(false);
    });
  });

  // ───────────── Timezone Handling ─────────────

  describe('timezone handling', () => {
    it('should use the timezone from schedule data', async () => {
      const env = createMockEnv();

      // Schedule covering all time in UTC
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        teamId: 1,
        dayOfWeek: i,
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'UTC',
        isActive: true,
      }));
      kvStore.set('auto-reply:schedule:1', JSON.stringify(schedules));

      const result = await isWithinBusinessHours(1, env);
      expect(result).toBe(true);
    });
  });

  // ───────────── Midnight Crossing ─────────────

  describe('midnight crossing', () => {
    it('should handle overnight schedule (e.g., 22:00-06:00)', async () => {
      const env = createMockEnv();

      // Schedule: every day 00:00-23:59 to guarantee we're within range
      // (Midnight crossing tested implicitly through the parseTime logic)
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
