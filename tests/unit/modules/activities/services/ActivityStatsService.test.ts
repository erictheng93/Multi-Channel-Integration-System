// ActivityStatsService Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  or: (...args: any[]) => ({ type: 'or', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  asc: (...args: any[]) => ({ type: 'asc', args }),
  isNull: (...args: any[]) => ({ type: 'isNull', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql', as: () => ({ type: 'sql_alias' }) }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
  count: (...args: any[]) => ({ type: 'count', args, as: (_alias: string) => ({ type: 'count_alias' }) }),
  gte: (...args: any[]) => ({ type: 'gte', args }),
  lte: (...args: any[]) => ({ type: 'lte', args }),
  lt: (...args: any[]) => ({ type: 'lt', args }),
  between: (...args: any[]) => ({ type: 'between', args }),
  like: (...args: any[]) => ({ type: 'like', args }),
}));

vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn() }));
vi.mock('@/utils/timestamp', () => ({ nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z') }));

vi.mock('@/db/schema', () => ({
  activities: {
    id: { name: 'id' },
    userId: { name: 'userId' },
    userName: { name: 'userName' },
    userRole: { name: 'userRole' },
    action: { name: 'action' },
    resourceType: { name: 'resourceType' },
    resourceId: { name: 'resourceId' },
    details: { name: 'details' },
    ipAddress: { name: 'ipAddress' },
    userAgent: { name: 'userAgent' },
    createdAt: { name: 'createdAt' },
    name: 'activities',
  },
}));

vi.mock('@modules/activities/utils/formatters', () => ({
  ActivityFormatter: {
    formatResourceType: vi.fn((rt: string) => rt),
    formatUserRole: vi.fn((role: string) => role),
  },
}));

// ---- Chain builders ----

function createSelectChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) =>
    Promise.resolve(returnValue ?? []).then(resolve, reject);
  return chain;
}

// Queued select results
let selectResultsQueue: any[] = [];

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    const result = selectResultsQueue.shift();
    return createSelectChain(result);
  }),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  run: vi.fn().mockResolvedValue({ results: [] }),
};

import { createDbClient } from '@/db/drizzle-factory';
vi.mocked(createDbClient).mockReturnValue(mockDb);

import { ActivityStatsService } from '@modules/activities/services/ActivityStatsService';

describe('ActivityStatsService', () => {
  let service: ActivityStatsService;
  const mockDatabase = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    selectResultsQueue = [];
    vi.mocked(createDbClient).mockReturnValue(mockDb);
    mockDb.run.mockResolvedValue({ results: [] });
    service = new ActivityStatsService(mockDatabase);
  });

  // =========================================================================
  // getOverview
  // =========================================================================
  describe('getOverview', () => {
    it('should return correct structure with populated stats', async () => {
      // getOverview makes 4 select queries: total, actionStats, userStats, dailyStats
      selectResultsQueue = [
        [{ count: 50 }],
        [{ action: 'team_create', count: 30 }, { action: 'user_login', count: 20 }],
        [{ userName: 'Alice', userRole: 'admin', count: 35 }, { userName: 'Bob', userRole: 'agent', count: 15 }],
        [{ date: '2026-03-27', count: 25 }, { date: '2026-03-26', count: 25 }],
      ];

      const result = await service.getOverview(7);

      expect(result.totalActivities).toBe(50);
      expect(result.actionStats).toEqual({ team_create: 30, user_login: 20 });
      expect(result.topUsers).toHaveLength(2);
      expect(result.topUsers[0].userName).toBe('Alice');
      expect(result.dailyStats).toHaveLength(2);
      expect(result.period.days).toBe(7);
      expect(result.period.endDate).toBe('2026-03-27T00:00:00.000Z');
    });

    it('should return zero totals and empty arrays when no data', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [],
        [],
        [],
      ];

      const result = await service.getOverview(7);

      expect(result.totalActivities).toBe(0);
      expect(result.actionStats).toEqual({});
      expect(result.topUsers).toHaveLength(0);
      expect(result.dailyStats).toHaveLength(0);
    });

    it('should default to 7 days when no argument provided', async () => {
      selectResultsQueue = [[{ count: 0 }], [], [], []];

      const result = await service.getOverview();

      expect(result.period.days).toBe(7);
    });
  });

  // =========================================================================
  // getResourceTypeStats
  // =========================================================================
  describe('getResourceTypeStats', () => {
    it('should compute percentage for each resource type', async () => {
      selectResultsQueue = [
        [
          { resourceType: 'team', count: 60 },
          { resourceType: 'user', count: 40 },
        ],
      ];

      const result = await service.getResourceTypeStats(30);

      expect(result).toHaveLength(2);
      expect(result[0].resourceType).toBe('team');
      expect(result[0].count).toBe(60);
      expect(result[0].percentage).toBe(60);
      expect(result[1].percentage).toBe(40);
    });

    it('should return empty array when no activities', async () => {
      selectResultsQueue = [[]];

      const result = await service.getResourceTypeStats(30);

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // getUserRoleStats
  // =========================================================================
  describe('getUserRoleStats', () => {
    it('should compute percentage for each user role', async () => {
      selectResultsQueue = [
        [
          { userRole: 'admin', count: 80 },
          { userRole: 'agent', count: 20 },
        ],
      ];

      const result = await service.getUserRoleStats(30);

      expect(result).toHaveLength(2);
      expect(result[0].userRole).toBe('admin');
      expect(result[0].percentage).toBe(80);
      expect(result[1].percentage).toBe(20);
    });
  });

  // =========================================================================
  // getActivityTrends
  // =========================================================================
  describe('getActivityTrends', () => {
    it('should return daily array with action breakdown', async () => {
      selectResultsQueue = [
        [
          { date: '2026-03-26', count: 10 },
          { date: '2026-03-27', count: 20 },
        ],
      ];
      mockDb.run.mockResolvedValueOnce({
        results: [
          { date: '2026-03-26', action: 'team_create', count: 5 },
          { date: '2026-03-26', action: 'user_login', count: 5 },
          { date: '2026-03-27', action: 'team_create', count: 20 },
        ],
      });

      const result = await service.getActivityTrends(30);

      expect(result).toHaveLength(2);
      const day1 = result.find(r => r.date === '2026-03-26');
      expect(day1?.count).toBe(10);
      expect(day1?.actions?.team_create).toBe(5);
      expect(day1?.actions?.user_login).toBe(5);

      const day2 = result.find(r => r.date === '2026-03-27');
      expect(day2?.count).toBe(20);
      expect(day2?.actions?.team_create).toBe(20);
    });

    it('should return empty array when no activities', async () => {
      selectResultsQueue = [[]];
      mockDb.run.mockResolvedValueOnce({ results: [] });

      const result = await service.getActivityTrends(30);

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // getActivityHeatmap
  // =========================================================================
  describe('getActivityHeatmap', () => {
    it('should return date x hour matrix with intensity levels', async () => {
      mockDb.run.mockResolvedValueOnce({
        results: [
          { date: '2026-03-27', hour: 9, count: 5 },
          { date: '2026-03-27', hour: 14, count: 25 },
          { date: '2026-03-27', hour: 18, count: 60 },
        ],
      });

      const result = await service.getActivityHeatmap(7);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2026-03-27', hour: 9, count: 5, intensity: 'low' });
      expect(result[1]).toEqual({ date: '2026-03-27', hour: 14, count: 25, intensity: 'medium' });
      expect(result[2]).toEqual({ date: '2026-03-27', hour: 18, count: 60, intensity: 'high' });
    });

    it('should return empty array when no data', async () => {
      mockDb.run.mockResolvedValueOnce({ results: [] });

      const result = await service.getActivityHeatmap(7);

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // getPerformanceMetrics
  // =========================================================================
  describe('getPerformanceMetrics', () => {
    it('should calculate avgActivitiesPerDay and mostActiveUser', async () => {
      // getPerformanceMetrics calls getOverview (4 selects) then getActivityHeatmap (1 run)
      selectResultsQueue = [
        [{ count: 70 }],
        [{ action: 'team_create', count: 70 }],
        [{ userName: 'Alice', userRole: 'admin', count: 70 }],
        [],
      ];
      mockDb.run.mockResolvedValueOnce({
        results: [{ date: '2026-03-27', hour: 10, count: 70 }],
      });

      const result = await service.getPerformanceMetrics(7);

      expect(result.avgActivitiesPerDay).toBe(10); // 70 / 7
      expect(result.mostActiveUser).toBe('Alice');
      expect(result.mostCommonAction).toBe('team_create');
      expect(result.peakHour).toBe(10);
      expect(result.systemLoad).toBe('low');
    });

    it('should return null for mostActiveUser when no users', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [],
        [],
        [],
      ];
      mockDb.run.mockResolvedValueOnce({ results: [] });

      const result = await service.getPerformanceMetrics(7);

      expect(result.mostActiveUser).toBeNull();
      expect(result.mostCommonAction).toBeNull();
      expect(result.avgActivitiesPerDay).toBe(0);
      expect(result.systemLoad).toBe('low');
    });

    it('should set systemLoad to high when avgActivitiesPerDay > 1000', async () => {
      selectResultsQueue = [
        [{ count: 7001 }], // 7001/7 = 1000.14... -> 1000 rounds down = low, so use 14000
        [],
        [],
        [],
      ];
      // Reset: use 14000/7 = 2000 avg
      selectResultsQueue = [
        [{ count: 14000 }],
        [],
        [],
        [],
      ];
      mockDb.run.mockResolvedValueOnce({ results: [] });

      const result = await service.getPerformanceMetrics(7);

      expect(result.systemLoad).toBe('high');
    });
  });

  // =========================================================================
  // getCustomPeriodStats
  // =========================================================================
  describe('getCustomPeriodStats', () => {
    it('should return overview for custom period', async () => {
      selectResultsQueue = [
        [{ count: 100 }],
        [{ action: 'team_create', count: 100 }],
        [{ userName: 'Alice', userRole: 'admin', count: 100 }],
        [{ date: '2026-03-20', count: 50 }, { date: '2026-03-21', count: 50 }],
      ];

      const result = await service.getCustomPeriodStats(
        '2026-03-20T00:00:00.000Z',
        '2026-03-27T00:00:00.000Z'
      );

      expect(result.totalActivities).toBe(100);
      expect(result.actionStats).toEqual({ team_create: 100 });
      expect(result.topUsers).toHaveLength(1);
      expect(result.dailyStats).toHaveLength(2);
      expect(result.period.days).toBeGreaterThan(0);
    });
  });
});
