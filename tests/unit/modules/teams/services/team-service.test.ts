// team-service.ts Unit Tests
// Focused on createTeam, getTeam, updateTeam, transferMembers (listTeams/searchTeams run against real SQL in team-service-list.test.ts)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  or: (...args: any[]) => ({ type: 'or', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  like: (...args: any[]) => ({ type: 'like', args }),
  count: (...args: any[]) => ({ type: 'count', args }),
  inArray: (...args: any[]) => ({ type: 'inArray', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql', as: () => ({ type: 'sql_alias' }) }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
}));

// Track DB operations for order verification
let dbOperations: string[] = [];

// Queue of results for sequential select calls
let selectResultsQueue: any[] = [];

function createSelectChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'leftJoin', 'groupBy'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
    return Promise.resolve(returnValue ?? []).then(resolve, reject);
  };
  return chain;
}

function createInsertChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => {
    return Promise.resolve(returnValue ?? []).then(resolve);
  };
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

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    dbOperations.push('select');
    const result = selectResultsQueue.shift();
    return createSelectChain(result);
  }),
  insert: vi.fn().mockImplementation((table: any) => {
    dbOperations.push(`insert:${table?.name || 'unknown'}`);
    return createInsertChain();
  }),
  update: vi.fn().mockImplementation((table: any) => {
    dbOperations.push(`update:${table?.name || 'unknown'}`);
    return createUpdateChain();
  }),
  delete: vi.fn().mockImplementation((table: any) => {
    dbOperations.push(`delete:${table?.name || 'unknown'}`);
    return createDeleteChain();
  }),
};

// Override drizzle to return our mock
import { drizzle } from 'drizzle-orm/d1';
vi.mocked(drizzle).mockReturnValue(mockDb);

// Mock schema tables
vi.mock('@/db/schema', () => ({
  teams: Object.assign(
    {
      id: { name: 'id' },
      teamName: { name: 'name' },
      description: { name: 'description' },
      qrCode: { name: 'qrCode' },
      isActive: { name: 'isActive' },
      createdAt: { name: 'createdAt' },
      updatedAt: { name: 'updatedAt' },
      deletedAt: { name: 'deletedAt' },
    },
    { name: 'teams' }
  ),
  agents: {
    id: { name: 'id' },
    displayName: { name: 'displayName' },
    email: { name: 'email' },
    role: { name: 'role' },
    isActive: { name: 'isActive' },
    deletedAt: { name: 'deletedAt' },
    lastActive: { name: 'lastActive' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
    name: 'agents',
  },
  agentTeams: {
    id: { name: 'id' },
    agentId: { name: 'agentId' },
    teamId: { name: 'teamId' },
    roleInTeam: { name: 'roleInTeam' },
    isPrimary: { name: 'isPrimary' },
    joinedAt: { name: 'joinedAt' },
    createdAt: { name: 'createdAt' },
    name: 'agent_teams',
  },
  qrCodes: {
    id: { name: 'id' },
    teamId: { name: 'teamId' },
    code: { name: 'code' },
    name: 'qr_codes',
  },
  qrCodeScans: {
    id: { name: 'id' },
    qrCodeId: { name: 'qrCodeId' },
    name: 'qr_code_scans',
  },
  conversations: {
    id: { name: 'id' },
    assignedTeamId: { name: 'assignedTeamId' },
    updatedAt: { name: 'updatedAt' },
    name: 'conversations',
  },
  customers: {
    id: { name: 'id' },
    sourceTeamId: { name: 'sourceTeamId' },
    primaryTeamId: { name: 'primaryTeamId' },
    updatedAt: { name: 'updatedAt' },
    name: 'customers',
  },
  messages: {
    id: { name: 'id' },
    conversationId: { name: 'conversationId' },
    name: 'messages',
  },
  channelIntegrations: {
    id: { name: 'id' },
    name: 'channel_integrations',
  },
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z'),
}));

import { TeamService } from '@modules/teams/services/team-service';

// ======================================================================
// Helpers
// ======================================================================

function makeTeam(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Support Team',
    description: 'Test team',
    qrCode: null,
    isActive: true,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

// ======================================================================
// Tests
// ======================================================================

describe('TeamService', () => {
  let service: TeamService;
  const mockDatabase = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    dbOperations = [];
    selectResultsQueue = [];
    service = new TeamService(mockDatabase);
  });

  // =========================================================================
  // createTeam
  // =========================================================================
  describe('createTeam', () => {
    it('should successfully create a team without QR code', async () => {
      const newTeam = makeTeam({ id: 10, name: 'New Team', qrCode: null });
      // No QR duplicate check needed; just post-insert select
      selectResultsQueue.push([newTeam]);

      const result = await service.createTeam({
        name: 'New Team',
        description: 'A new team',
      });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(dbOperations).toContain('insert:teams');
      expect(result.name).toBe('New Team');
      expect(result.id).toBe(10);
    });

    it('should check for duplicate QR code before inserting', async () => {
      // First select (QR dup check) returns empty
      selectResultsQueue.push([]);
      // Second select (post-insert fetch) returns new team
      const newTeam = makeTeam({ id: 11, name: 'QR Team', qrCode: 'abc-123' });
      selectResultsQueue.push([newTeam]);

      const result = await service.createTeam({
        name: 'QR Team',
        qrCode: 'abc-123',
      });

      expect(result.qrCode).toBe('abc-123');
      // Should have done 2 selects: dup check + post-insert fetch
      expect(dbOperations.filter(op => op === 'select').length).toBe(2);
    });

    it('should throw DUPLICATE_QR_CODE when QR code already exists', async () => {
      // QR dup check returns existing team
      selectResultsQueue.push([makeTeam({ qrCode: 'existing-qr' })]);

      await expect(
        service.createTeam({ name: 'Team X', qrCode: 'existing-qr' })
      ).rejects.toThrow('DUPLICATE_QR_CODE');

      // No insert should have been called
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw when team not found after insert', async () => {
      // No QR code provided; post-insert select returns empty
      selectResultsQueue.push([]);

      await expect(
        service.createTeam({ name: 'Ghost Team' })
      ).rejects.toThrow('Failed to create team');
    });
  });

  // =========================================================================
  // getTeam
  // =========================================================================
  describe('getTeam', () => {
    it('should return team with stats when found', async () => {
      const team = makeTeam({ id: 5 });
      // 1: team fetch
      selectResultsQueue.push([team]);
      // 2: memberCount
      selectResultsQueue.push([{ memberCount: 3 }]);
      // 3: activeMembers
      selectResultsQueue.push([{ activeMembers: 2 }]);
      // 4: conversationCount
      selectResultsQueue.push([{ conversationCount: 10 }]);

      const result = await service.getTeam(5);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
      expect(result!.memberCount).toBe(3);
      expect(result!.activeMembers).toBe(2);
      expect(result!.conversationCount).toBe(10);
      expect(result!.qrCodeScans).toBe(0);
    });

    it('should return null when team not found', async () => {
      // team fetch returns empty
      selectResultsQueue.push([]);

      const result = await service.getTeam(999);

      expect(result).toBeNull();
      // Only one select — no stats queries should run
      expect(dbOperations.filter(op => op === 'select').length).toBe(1);
    });

    it('should default stats to 0 when count results are empty', async () => {
      const team = makeTeam({ id: 7 });
      selectResultsQueue.push([team]);
      selectResultsQueue.push([{}]); // memberCount missing
      selectResultsQueue.push([{}]); // activeMembers missing
      selectResultsQueue.push([{}]); // conversationCount missing

      const result = await service.getTeam(7);

      expect(result!.memberCount).toBe(0);
      expect(result!.activeMembers).toBe(0);
      expect(result!.conversationCount).toBe(0);
    });
  });

  // =========================================================================
  // updateTeam
  // =========================================================================
  describe('updateTeam', () => {
    it('should update team and return updated record', async () => {
      const updated = makeTeam({ id: 3, name: 'Updated Name', description: 'New desc' });
      selectResultsQueue.push([updated]);

      const result = await service.updateTeam(3, { name: 'Updated Name', description: 'New desc' });

      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(dbOperations).toContain('update:teams');
      expect(result.name).toBe('Updated Name');
    });

    it('should throw when team not found after update', async () => {
      selectResultsQueue.push([]); // post-update fetch returns empty

      await expect(
        service.updateTeam(999, { name: 'Ghost' })
      ).rejects.toThrow('Team not found after update');
    });
  });

  // =========================================================================
  // transferMembers
  // =========================================================================
  describe('transferMembers', () => {
    it('should transfer valid members from source to destination team', async () => {
      // select for valid memberships
      selectResultsQueue.push([
        { agentId: 'agent-1', isPrimary: false },
        { agentId: 'agent-2', isPrimary: true },
      ]);

      const result = await service.transferMembers({
        fromTeamId: 1,
        toTeamId: 2,
        agentIds: ['agent-1', 'agent-2'],
      });

      expect(result.success).toBe(true);
      expect(result.transferredAgents).toEqual(expect.arrayContaining(['agent-1', 'agent-2']));
      expect(result.failedTransfers).toHaveLength(0);

      // delete old memberships + insert new ones
      expect(dbOperations).toContain('delete:agent_teams');
      expect(dbOperations).toContain('insert:agent_teams');
    });

    it('should report invalid agents not in source team', async () => {
      // Only agent-1 is in the source team
      selectResultsQueue.push([{ agentId: 'agent-1', isPrimary: false }]);

      const result = await service.transferMembers({
        fromTeamId: 1,
        toTeamId: 2,
        agentIds: ['agent-1', 'agent-999'],
      });

      expect(result.transferredAgents).toContain('agent-1');
      expect(result.failedTransfers).toHaveLength(1);
      expect(result.failedTransfers[0].agentId).toBe('agent-999');
      expect(result.success).toBe(false);
    });

    it('should return success=false and all failed on exception', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('DB connection error');
      });

      const result = await service.transferMembers({
        fromTeamId: 1,
        toTeamId: 2,
        agentIds: ['agent-1'],
      });

      expect(result.success).toBe(false);
      expect(result.transferredAgents).toHaveLength(0);
      expect(result.failedTransfers).toHaveLength(1);
      expect(result.failedTransfers[0].agentId).toBe('agent-1');
    });
  });
});
