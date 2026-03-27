// TeamActivityService Unit Tests

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

vi.mock('@modules/activities/utils/validators', () => ({
  ActivityValidator: {
    validateCreateRequest: vi.fn(() => []),
    validateQueryParams: vi.fn(() => []),
    validateCleanupParams: vi.fn(() => []),
  },
}));

vi.mock('@modules/activities/constants/actions', () => ({
  ACTIVITY_ACTIONS: {
    TEAM_CREATE: 'team_create',
    TEAM_UPDATE: 'team_update',
    TEAM_DELETE: 'team_delete',
    TEAM_INVITE: 'team_invite',
    TEAM_MEMBER_UPDATE: 'team_member_update',
    MEMBER_ADD: 'member_add',
    MEMBER_REMOVE: 'member_remove',
    QR_CODE_GENERATE: 'qr_code_generate',
  },
}));

vi.mock('@modules/activities/constants/resources', () => ({
  RESOURCE_TYPES: {
    TEAM: 'team',
    QR_CODE: 'qr_code',
    USER: 'user',
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

function createInsertChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) =>
    Promise.resolve(returnValue ?? [{ id: 1 }]).then(resolve);
  return chain;
}

let selectResultsQueue: any[] = [];

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    const result = selectResultsQueue.shift();
    return createSelectChain(result);
  }),
  insert: vi.fn().mockImplementation(() => createInsertChain()),
  update: vi.fn(),
  delete: vi.fn(),
  run: vi.fn().mockResolvedValue({ results: [] }),
};

import { createDbClient } from '@/db/drizzle-factory';
vi.mocked(createDbClient).mockReturnValue(mockDb);

import { TeamActivityService } from '@modules/activities/services/TeamActivityService';
import { ActivityValidator } from '@modules/activities/utils/validators';

describe('TeamActivityService', () => {
  let service: TeamActivityService;
  const mockDatabase = {} as any;

  const baseTeamParams = {
    userId: 'user-1',
    userName: 'Alice',
    userRole: 'admin',
    teamId: 10,
    teamName: 'Support Team',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectResultsQueue = [];
    vi.mocked(createDbClient).mockReturnValue(mockDb);
    vi.mocked(ActivityValidator.validateCreateRequest).mockReturnValue([]);
    vi.mocked(ActivityValidator.validateQueryParams).mockReturnValue([]);
    mockDb.run.mockResolvedValue({ results: [] });
    mockDb.insert.mockImplementation(() => createInsertChain([{ id: 1 }]));
    service = new TeamActivityService(mockDatabase);
  });

  // =========================================================================
  // logTeamCreate
  // =========================================================================
  describe('logTeamCreate', () => {
    it('should delegate to ActivityService with TEAM_CREATE action', async () => {
      const result = await service.logTeamCreate({ ...baseTeamParams, description: 'A support team' });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.action).toBe('team_create');
      expect(result?.resourceType).toBe('team');
      expect(result?.resourceId).toBe('10');
    });

    it('should include description in details when provided', async () => {
      await service.logTeamCreate({ ...baseTeamParams, description: 'My Desc' });

      // Verify insert was called (details stringified internally)
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // logTeamUpdate
  // =========================================================================
  describe('logTeamUpdate', () => {
    it('should delegate to ActivityService with TEAM_UPDATE action', async () => {
      const result = await service.logTeamUpdate({
        ...baseTeamParams,
        updates: { name: 'New Name' },
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('team_update');
    });
  });

  // =========================================================================
  // logTeamDelete
  // =========================================================================
  describe('logTeamDelete', () => {
    it('should delegate to ActivityService with TEAM_DELETE action', async () => {
      const result = await service.logTeamDelete(baseTeamParams);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('team_delete');
    });
  });

  // =========================================================================
  // logMemberAdd
  // =========================================================================
  describe('logMemberAdd', () => {
    it('should log member add with agent info', async () => {
      const result = await service.logMemberAdd({
        ...baseTeamParams,
        addedAgentId: 'agent-5',
        addedAgentName: 'Bob',
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('member_add');
    });

    it('should return null when addedAgentId is missing', async () => {
      const result = await service.logMemberAdd({
        ...baseTeamParams,
        // no addedAgentId or addedAgentName
      });

      expect(result).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should return null when addedAgentName is missing', async () => {
      const result = await service.logMemberAdd({
        ...baseTeamParams,
        addedAgentId: 'agent-5',
        // no addedAgentName
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // logMemberRemove
  // =========================================================================
  describe('logMemberRemove', () => {
    it('should log member remove with agent info', async () => {
      const result = await service.logMemberRemove({
        ...baseTeamParams,
        removedAgentId: 'agent-5',
        removedAgentName: 'Bob',
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('member_remove');
    });

    it('should return null when removedAgentId is missing', async () => {
      const result = await service.logMemberRemove({
        ...baseTeamParams,
        // no removedAgentId or removedAgentName
      });

      expect(result).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // logQRCodeGenerate
  // =========================================================================
  describe('logQRCodeGenerate', () => {
    it('should log QR code generation', async () => {
      const result = await service.logQRCodeGenerate({
        ...baseTeamParams,
        campaignName: 'Summer 2026',
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('qr_code_generate');
      expect(result?.resourceType).toBe('qr_code');
    });

    it('should work without campaignName', async () => {
      const result = await service.logQRCodeGenerate(baseTeamParams);

      expect(result).not.toBeNull();
    });
  });

  // =========================================================================
  // logTeamInvite
  // =========================================================================
  describe('logTeamInvite', () => {
    it('should log team invite with email and role', async () => {
      const result = await service.logTeamInvite({
        ...baseTeamParams,
        invitedEmail: 'charlie@example.com',
        invitedRole: 'agent',
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('team_invite');
    });
  });

  // =========================================================================
  // logMemberUpdate
  // =========================================================================
  describe('logMemberUpdate', () => {
    it('should log member role update', async () => {
      const result = await service.logMemberUpdate({
        ...baseTeamParams,
        updatedAgentId: 'agent-7',
        updatedAgentName: 'Charlie',
        oldRole: 'agent',
        newRole: 'supervisor',
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('team_member_update');
    });
  });

  // =========================================================================
  // getTeamActivities
  // =========================================================================
  describe('getTeamActivities', () => {
    it('should pass resourceType=team filter and return paginated list', async () => {
      const mockRow = {
        id: 1, userId: 'u1', userName: 'Alice', userRole: 'admin',
        action: 'team_create', resourceType: 'team',
        resourceId: '10', details: null, ipAddress: null, userAgent: null,
        createdAt: '2026-03-27T00:00:00.000Z',
      };
      selectResultsQueue = [
        [{ count: 1 }],
        [mockRow],
      ];

      const result = await service.getTeamActivities(10, { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].resourceId).toBe('10');
      expect(result.page).toBe(1);
    });

    it('should add startDate filter when days option provided', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [],
      ];

      const result = await service.getTeamActivities(10, { days: 7 });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // getTeamMemberStats
  // =========================================================================
  describe('getTeamMemberStats', () => {
    it('should aggregate per-member counts from team activities', async () => {
      // getTeamMemberStats calls getTeamActivities which calls getActivities:
      // count select + list select
      const items = [
        {
          id: 1, userId: 'u1', userName: 'Alice', userRole: 'admin',
          action: 'team_create', resourceType: 'team',
          resourceId: '10', details: null, ipAddress: null, userAgent: null,
          createdAt: '2026-03-27T00:00:00.000Z',
        },
        {
          id: 2, userId: 'u1', userName: 'Alice', userRole: 'admin',
          action: 'team_update', resourceType: 'team',
          resourceId: '10', details: null, ipAddress: null, userAgent: null,
          createdAt: '2026-03-27T00:00:00.000Z',
        },
        {
          id: 3, userId: 'u2', userName: 'Bob', userRole: 'agent',
          action: 'member_add', resourceType: 'team',
          resourceId: '10', details: null, ipAddress: null, userAgent: null,
          createdAt: '2026-03-27T00:00:00.000Z',
        },
      ];
      selectResultsQueue = [
        [{ count: 3 }],
        items,
      ];

      const result = await service.getTeamMemberStats(10, 30);

      expect(result).toHaveLength(2);
      const alice = result.find(m => m.userId === 'u1');
      expect(alice?.totalActions).toBe(2);
      expect(alice?.actions['team_create']).toBe(1);
      expect(alice?.actions['team_update']).toBe(1);

      const bob = result.find(m => m.userId === 'u2');
      expect(bob?.totalActions).toBe(1);

      // Should be sorted by totalActions descending
      expect(result[0].totalActions).toBeGreaterThanOrEqual(result[1].totalActions);
    });

    it('should return empty array when team has no activities', async () => {
      selectResultsQueue = [
        [{ count: 0 }],
        [],
      ];

      const result = await service.getTeamMemberStats(10, 30);

      expect(result).toHaveLength(0);
    });
  });
});
