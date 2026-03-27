// team-service.ts Unit Tests
// Focused on createTeam, getTeam, updateTeam, deleteTeam (cascade), softDeleteTeam, listTeams, transferMembers

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
  // deleteTeam — CASCADE (most critical)
  // =========================================================================
  describe('deleteTeam', () => {
    it('should return true on successful cascade delete', async () => {
      // Step 2: QR codes select (returns empty — no QR codes for this team)
      selectResultsQueue.push([]);

      const result = await service.deleteTeam(42);

      expect(result).toBe(true);
    });

    it('should execute cascade delete in correct order when no QR codes exist', async () => {
      // QR codes select → empty array (no QR codes)
      selectResultsQueue.push([]);

      await service.deleteTeam(42);

      // Expected order:
      // 1. delete:agent_teams
      // 2. select (QR codes fetch)
      // 3. update:conversations (set assignedTeamId=null)
      // 4. update:customers (set sourceTeamId=null)
      // 5. delete:teams

      expect(dbOperations[0]).toBe('delete:agent_teams');
      expect(dbOperations[1]).toBe('select');
      expect(dbOperations[2]).toBe('update:conversations');
      expect(dbOperations[3]).toBe('update:customers');
      expect(dbOperations[4]).toBe('delete:teams');
    });

    it('should delete QR scans before QR codes when team has QR codes', async () => {
      // QR codes select → returns 2 QR codes
      selectResultsQueue.push([{ id: 'qr-1' }, { id: 'qr-2' }]);

      await service.deleteTeam(42);

      // Expected order with QR codes present:
      // 1. delete:agent_teams
      // 2. select (QR codes fetch)
      // 3. delete:qr_code_scans
      // 4. delete:qr_codes
      // 5. update:conversations
      // 6. update:customers
      // 7. delete:teams

      expect(dbOperations[0]).toBe('delete:agent_teams');
      expect(dbOperations[1]).toBe('select');
      expect(dbOperations[2]).toBe('delete:qr_code_scans');
      expect(dbOperations[3]).toBe('delete:qr_codes');
      expect(dbOperations[4]).toBe('update:conversations');
      expect(dbOperations[5]).toBe('update:customers');
      expect(dbOperations[6]).toBe('delete:teams');
    });

    it('should delete teams table last', async () => {
      selectResultsQueue.push([]);

      await service.deleteTeam(42);

      const lastOp = dbOperations[dbOperations.length - 1];
      expect(lastOp).toBe('delete:teams');
    });

    it('should update conversations to null assignedTeamId before deleting teams', async () => {
      selectResultsQueue.push([]);

      await service.deleteTeam(42);

      const updateConvIdx = dbOperations.indexOf('update:conversations');
      const deleteTeamIdx = dbOperations.indexOf('delete:teams');

      expect(updateConvIdx).toBeGreaterThanOrEqual(0);
      expect(updateConvIdx).toBeLessThan(deleteTeamIdx);
    });

    it('should update customers to null sourceTeamId before deleting teams', async () => {
      selectResultsQueue.push([]);

      await service.deleteTeam(42);

      const updateCustIdx = dbOperations.indexOf('update:customers');
      const deleteTeamIdx = dbOperations.indexOf('delete:teams');

      expect(updateCustIdx).toBeGreaterThanOrEqual(0);
      expect(updateCustIdx).toBeLessThan(deleteTeamIdx);
    });

    it('should return false when an error occurs during delete', async () => {
      // Make delete throw an error
      mockDb.delete.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.deleteTeam(42);

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // listTeams
  // =========================================================================
  describe('listTeams', () => {
    it('should return paginated team list', async () => {
      const teamRows = [
        {
          team: makeTeam({ id: 1, name: 'Alpha' }),
          memberCount: 5,
          activeMembers: 3,
          conversationCount: 20,
        },
        {
          team: makeTeam({ id: 2, name: 'Beta' }),
          memberCount: 2,
          activeMembers: 2,
          conversationCount: 5,
        },
      ];
      selectResultsQueue.push(teamRows);       // main query
      selectResultsQueue.push([{ total: 2 }]); // count query

      const result = await service.listTeams({ page: 1, limit: 20 });

      expect(result.teams).toHaveLength(2);
      expect(result.teams[0].name).toBe('Alpha');
      expect(result.teams[1].name).toBe('Beta');
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should apply search filter and use 2 selects', async () => {
      const teamRows = [
        {
          team: makeTeam({ id: 1, name: 'Support Alpha' }),
          memberCount: 1,
          activeMembers: 1,
          conversationCount: 0,
        },
      ];
      selectResultsQueue.push(teamRows);
      selectResultsQueue.push([{ total: 1 }]);

      const result = await service.listTeams({ search: 'Alpha', page: 1, limit: 20 });

      expect(result.teams).toHaveLength(1);
      expect(dbOperations.filter(op => op === 'select').length).toBe(2);
    });

    it('should respect includeInactive=false by default', async () => {
      selectResultsQueue.push([]);
      selectResultsQueue.push([{ total: 0 }]);

      const result = await service.listTeams({ includeInactive: false });

      expect(result.teams).toHaveLength(0);
    });

    it('should cap limit at 100', async () => {
      selectResultsQueue.push([]);
      selectResultsQueue.push([{ total: 0 }]);

      const result = await service.listTeams({ limit: 500, page: 1 });

      expect(result.pagination.limit).toBe(100);
    });

    it('should return empty teams and total 0 when no results', async () => {
      selectResultsQueue.push([]);
      selectResultsQueue.push([{ total: 0 }]);

      const result = await service.listTeams({});

      expect(result.teams).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should set qrCodeScans to 0 for all teams', async () => {
      const teamRows = [
        {
          team: makeTeam({ id: 1 }),
          memberCount: 1,
          activeMembers: 1,
          conversationCount: 1,
        },
      ];
      selectResultsQueue.push(teamRows);
      selectResultsQueue.push([{ total: 1 }]);

      const result = await service.listTeams({});

      expect(result.teams[0].qrCodeScans).toBe(0);
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

  // =========================================================================
  // searchTeams
  // =========================================================================
  describe('searchTeams', () => {
    it('should return matching active teams', async () => {
      const teams = [makeTeam({ id: 1, name: 'Support' })];
      selectResultsQueue.push(teams);

      const result = await service.searchTeams('Support');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Support');
    });

    it('should return empty array when no matches', async () => {
      selectResultsQueue.push([]);

      const result = await service.searchTeams('nonexistent');

      expect(result).toHaveLength(0);
    });
  });
});
