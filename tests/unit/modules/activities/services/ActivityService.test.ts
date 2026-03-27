// ActivityService Unit Tests

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
  count: (...args: any[]) => ({ type: 'count', args }),
  gte: (...args: any[]) => ({ type: 'gte', args }),
  lte: (...args: any[]) => ({ type: 'lte', args }),
  lt: (...args: any[]) => ({ type: 'lt', args }),
  between: (...args: any[]) => ({ type: 'between', args }),
  like: (...args: any[]) => ({ type: 'like', args }),
}));

vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn() }));
vi.mock('@/utils/timestamp', () => ({ nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z') }));

// Mock schema
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

// Mock validators so we can control validation outcomes
vi.mock('@modules/activities/utils/validators', () => ({
  ActivityValidator: {
    validateCreateRequest: vi.fn(() => []),
    validateQueryParams: vi.fn(() => []),
    validateCleanupParams: vi.fn(() => []),
  },
}));

// Mock constants (real values needed for ACTIONS/RESOURCE_TYPES statics)
vi.mock('@modules/activities/constants/actions', () => ({
  ACTIVITY_ACTIONS: { TEAM_CREATE: 'team_create', USER_LOGIN: 'user_login' },
}));
vi.mock('@modules/activities/constants/resources', () => ({
  RESOURCE_TYPES: { TEAM: 'team', USER: 'user' },
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

function createInsertChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) =>
    Promise.resolve(returnValue ?? [{ id: 42 }]).then(resolve);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createDeleteChain() {
  const chain: Record<string, any> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

// Queued results for sequential select calls
let selectResultsQueue: any[] = [];

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    const result = selectResultsQueue.shift();
    return createSelectChain(result);
  }),
  insert: vi.fn().mockImplementation(() => createInsertChain()),
  update: vi.fn().mockImplementation(() => createUpdateChain()),
  delete: vi.fn().mockImplementation(() => createDeleteChain()),
  run: vi.fn().mockResolvedValue({ results: [] }),
};

import { createDbClient } from '@/db/drizzle-factory';
vi.mocked(createDbClient).mockReturnValue(mockDb);

import { ActivityService } from '@modules/activities/services/ActivityService';
import { ActivityValidator } from '@modules/activities/utils/validators';

describe('ActivityService', () => {
  let service: ActivityService;
  const mockDatabase = {} as any;

  const validRequest = {
    userId: 'user-1',
    userName: 'Alice',
    userRole: 'admin',
    action: 'team_create',
    resourceType: 'team',
    resourceId: '10',
    details: { teamName: 'Support Team' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectResultsQueue = [];
    vi.mocked(createDbClient).mockReturnValue(mockDb);
    vi.mocked(ActivityValidator.validateCreateRequest).mockReturnValue([]);
    vi.mocked(ActivityValidator.validateQueryParams).mockReturnValue([]);
    vi.mocked(ActivityValidator.validateCleanupParams).mockReturnValue([]);
    mockDb.run.mockResolvedValue({ results: [] });
    service = new ActivityService(mockDatabase);
  });

  // =========================================================================
  // logActivity
  // =========================================================================
  describe('logActivity', () => {
    it('should insert activity and return ActivityLog on success', async () => {
      mockDb.insert.mockImplementationOnce(() => createInsertChain([{ id: 99 }]));

      const result = await service.logActivity(validRequest);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(99);
      expect(result?.userId).toBe('user-1');
      expect(result?.userName).toBe('Alice');
      expect(result?.action).toBe('team_create');
      expect(result?.createdAt).toBe('2026-03-27T00:00:00.000Z');
    });

    it('should return null when validation fails', async () => {
      vi.mocked(ActivityValidator.validateCreateRequest).mockReturnValueOnce([
        { field: 'userId', message: 'User ID is required' },
      ]);

      const result = await service.logActivity({ ...validRequest, userId: '' });

      expect(result).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should return null when DB throws an error', async () => {
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.logActivity(validRequest);

      expect(result).toBeNull();
    });

    it('should set resourceId and details to null when omitted', async () => {
      const req = { userId: 'u1', userName: 'Bob', userRole: 'agent', action: 'user_login', resourceType: 'user' };
      mockDb.insert.mockImplementationOnce(() => createInsertChain([{ id: 1 }]));

      const result = await service.logActivity(req);

      expect(result).not.toBeNull();
      expect(result?.resourceId).toBeUndefined();
      expect(result?.details).toBeUndefined();
    });
  });

  // =========================================================================
  // getActivities
  // =========================================================================
  describe('getActivities', () => {
    it('should return paginated activity list', async () => {
      const mockRow = {
        id: 1, userId: 'u1', userName: 'Alice', userRole: 'admin',
        action: 'team_create', resourceType: 'team',
        resourceId: null, details: null, ipAddress: null, userAgent: null,
        createdAt: '2026-03-27T00:00:00.000Z',
      };
      // First select: count query, second: list query
      selectResultsQueue = [
        [{ count: 1 }],
        [mockRow],
      ];

      const result = await service.getActivities({ page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);
    });

    it('should throw when query params are invalid', async () => {
      vi.mocked(ActivityValidator.validateQueryParams).mockReturnValueOnce([
        { field: 'page', message: 'Page must be a positive integer' },
      ]);

      await expect(service.getActivities({ page: -1 })).rejects.toThrow('Invalid query parameters');
    });

    it('should return empty list when no activities', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [],
      ];

      const result = await service.getActivities();

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.totalPages).toBe(0);
    });

    it('should parse JSON details from DB row', async () => {
      const mockRow = {
        id: 5, userId: 'u2', userName: 'Bob', userRole: 'agent',
        action: 'team_create', resourceType: 'team',
        resourceId: '10', details: '{"teamName":"Support"}',
        ipAddress: '127.0.0.1', userAgent: 'Mozilla',
        createdAt: '2026-03-27T00:00:00.000Z',
      };
      selectResultsQueue = [[{ count: 1 }], [mockRow]];

      const result = await service.getActivities();

      expect(result.items[0].details).toEqual({ teamName: 'Support' });
      expect(result.items[0].ipAddress).toBe('127.0.0.1');
    });
  });

  // =========================================================================
  // getUserActivityStats
  // =========================================================================
  describe('getUserActivityStats', () => {
    it('should return aggregated stats for user', async () => {
      // getUserActivityStats calls:
      // 1. select count (total actions)
      // 2. db.run (action breakdown)
      // 3. getActivities internally -> 2 selects (count + list)
      selectResultsQueue = [
        [{ count: 5 }],            // total actions
        // getActivities calls:
        [{ count: 2 }],            // count query inside getActivities
        [                          // list query inside getActivities
          {
            id: 1, userId: 'u1', userName: 'Alice', userRole: 'admin',
            action: 'team_create', resourceType: 'team',
            resourceId: null, details: null, ipAddress: null, userAgent: null,
            createdAt: '2026-03-27T00:00:00.000Z',
          },
        ],
      ];
      mockDb.run.mockResolvedValueOnce({
        results: [{ action: 'team_create', count: 3 }, { action: 'user_login', count: 2 }],
      });

      const result = await service.getUserActivityStats('u1', 30);

      expect(result.totalActions).toBe(5);
      expect(result.actionsByType).toEqual({ team_create: 3, user_login: 2 });
      expect(result.recentActions).toHaveLength(1);
    });

    it('should return empty stats when no activities', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [{ count: 0 }],
        [],
      ];
      mockDb.run.mockResolvedValueOnce({ results: [] });

      const result = await service.getUserActivityStats('u-none', 30);

      expect(result.totalActions).toBe(0);
      expect(result.actionsByType).toEqual({});
      expect(result.recentActions).toHaveLength(0);
    });
  });

  // =========================================================================
  // cleanupOldActivities
  // =========================================================================
  describe('cleanupOldActivities', () => {
    it('should delete old activities and return count', async () => {
      selectResultsQueue = [[{ count: 15 }]];

      const deletedCount = await service.cleanupOldActivities(90);

      expect(deletedCount).toBe(15);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw when cleanup params are invalid', async () => {
      vi.mocked(ActivityValidator.validateCleanupParams).mockReturnValueOnce([
        { field: 'daysToKeep', message: 'Must keep at least 30 days' },
      ]);

      await expect(service.cleanupOldActivities(5)).rejects.toThrow('Invalid cleanup parameters');
    });

    it('should return 0 when no old activities exist', async () => {
      selectResultsQueue = [[{ count: 0 }]];

      const result = await service.cleanupOldActivities(90);

      expect(result).toBe(0);
    });
  });

  // =========================================================================
  // logBatchActivities
  // =========================================================================
  describe('logBatchActivities', () => {
    it('should insert multiple activities and return all results', async () => {
      mockDb.insert
        .mockImplementationOnce(() => createInsertChain([{ id: 1 }]))
        .mockImplementationOnce(() => createInsertChain([{ id: 2 }]));

      const requests = [
        { ...validRequest },
        { ...validRequest, userId: 'user-2', userName: 'Bob' },
      ];

      const results = await service.logBatchActivities(requests);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(2);
    });

    it('should skip failed activities and return only successful ones', async () => {
      vi.mocked(ActivityValidator.validateCreateRequest)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ field: 'userId', message: 'User ID is required' }]);

      mockDb.insert.mockImplementationOnce(() => createInsertChain([{ id: 1 }]));

      const requests = [
        { ...validRequest },
        { ...validRequest, userId: '' },
      ];

      const results = await service.logBatchActivities(requests);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1);
    });

    it('should return empty array for empty input', async () => {
      const results = await service.logBatchActivities([]);
      expect(results).toHaveLength(0);
    });
  });

  // =========================================================================
  // activityExists
  // =========================================================================
  describe('activityExists', () => {
    it('should return true when activity found', async () => {
      selectResultsQueue = [[{ id: 5 }]];
      const result = await service.activityExists(5);
      expect(result).toBe(true);
    });

    it('should return false when activity not found', async () => {
      selectResultsQueue = [[]];
      const result = await service.activityExists(999);
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // getActivityById
  // =========================================================================
  describe('getActivityById', () => {
    it('should return ActivityLog when found', async () => {
      const mockRow = {
        id: 7, userId: 'u1', userName: 'Alice', userRole: 'admin',
        action: 'team_create', resourceType: 'team',
        resourceId: null, details: '{"teamName":"Dev"}',
        ipAddress: null, userAgent: null,
        createdAt: '2026-03-27T00:00:00.000Z',
      };
      selectResultsQueue = [[mockRow]];

      const result = await service.getActivityById(7);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(7);
      expect(result?.details).toEqual({ teamName: 'Dev' });
    });

    it('should return null when activity not found', async () => {
      selectResultsQueue = [[]];

      const result = await service.getActivityById(999);

      expect(result).toBeNull();
    });
  });
});
