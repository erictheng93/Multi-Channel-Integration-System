// AgentTeamsService Unit Tests
// Multi-team management: add/remove agents, primary team, bulk ops, statistics

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  or: (...args: any[]) => ({ type: 'or', args }),
  inArray: (...args: any[]) => ({ type: 'inArray', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql', as: () => ({ type: 'sql_alias' }) }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
}));

vi.mock('@/utils/timestamp', () => ({ nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z') }));

// Track DB operations for order verification
let dbOperations: string[] = [];

function createSelectChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  const methods = ['from', 'where', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy'];
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

function createUpdateChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => {
    return Promise.resolve(returnValue ?? undefined).then(resolve);
  };
  return chain;
}

function createDeleteChain() {
  const chain: Record<string, any> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

// Queued select results for sequential calls
let selectResultsQueue: any[] = [];
let insertResultsQueue: any[] = [];
let updateResultsQueue: any[] = [];

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    dbOperations.push('select');
    const result = selectResultsQueue.shift();
    return createSelectChain(result);
  }),
  insert: vi.fn().mockImplementation((table: any) => {
    dbOperations.push(`insert:${table?.name || 'unknown'}`);
    const result = insertResultsQueue.shift();
    return createInsertChain(result);
  }),
  update: vi.fn().mockImplementation((table: any) => {
    dbOperations.push(`update:${table?.name || 'unknown'}`);
    const result = updateResultsQueue.shift();
    return createUpdateChain(result);
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
  agents: {
    id: { name: 'id' },
    email: { name: 'email' },
    displayName: { name: 'displayName' },
    role: { name: 'role' },
    isActive: { name: 'isActive' },
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
  teams: {
    id: { name: 'id' },
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
    name: { colName: 'name' },
    description: { colName: 'description' },
    isActive: { colName: 'isActive' },
  },
}));

import { AgentTeamsService } from '@/modules/teams/services/agent-teams-service';

const NOW = '2026-03-27T00:00:00.000Z';
const MOCK_D1 = {} as any;

describe('AgentTeamsService', () => {
  let service: AgentTeamsService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbOperations = [];
    selectResultsQueue = [];
    insertResultsQueue = [];
    updateResultsQueue = [];
    service = new AgentTeamsService(MOCK_D1);
  });

  // ---------------------------------------------------------------------------
  // getAgentTeams
  // ---------------------------------------------------------------------------
  describe('getAgentTeams', () => {
    it('returns all team memberships for an agent', async () => {
      selectResultsQueue.push([
        {
          id: 1,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: 'member',
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
          teamName: 'Support',
          teamDescription: 'Support team',
          teamIsActive: true,
        },
        {
          id: 2,
          agentId: 'agent-1',
          teamId: 20,
          roleInTeam: 'lead',
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
          teamName: 'Sales',
          teamDescription: null,
          teamIsActive: true,
        },
      ]);

      const result = await service.getAgentTeams('agent-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        agentId: 'agent-1',
        teamId: 10,
        isPrimary: true,
        teamName: 'Support',
      });
      expect(result[1]).toMatchObject({
        teamId: 20,
        isPrimary: false,
        teamName: 'Sales',
        teamDescription: undefined,
      });
    });

    it('returns empty array for agent with no teams', async () => {
      selectResultsQueue.push([]);

      const result = await service.getAgentTeams('agent-none');

      expect(result).toEqual([]);
    });

    it('defaults missing roleInTeam to "member"', async () => {
      selectResultsQueue.push([
        {
          id: 1,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: null,
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      const result = await service.getAgentTeams('agent-1');

      expect(result[0].roleInTeam).toBe('member');
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentTeamMembership
  // ---------------------------------------------------------------------------
  describe('getAgentTeamMembership', () => {
    it('returns membership when it exists', async () => {
      selectResultsQueue.push([
        {
          id: 5,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: 'lead',
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      const result = await service.getAgentTeamMembership('agent-1', 10);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(5);
      expect(result?.isPrimary).toBe(true);
      expect(result?.roleInTeam).toBe('lead');
    });

    it('returns null when membership does not exist', async () => {
      selectResultsQueue.push([]);

      const result = await service.getAgentTeamMembership('agent-1', 999);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // addAgentToTeam
  // ---------------------------------------------------------------------------
  describe('addAgentToTeam', () => {
    it('creates a membership record and returns it', async () => {
      insertResultsQueue.push([
        {
          id: 10,
          agentId: 'agent-1',
          teamId: 5,
          roleInTeam: 'member',
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      const result = await service.addAgentToTeam({
        agentId: 'agent-1',
        teamId: 5,
        roleInTeam: 'member',
        isPrimary: false,
      });

      expect(result.agentId).toBe('agent-1');
      expect(result.teamId).toBe(5);
      expect(result.isPrimary).toBe(false);
      expect(dbOperations).toContain('insert:agent_teams');
    });

    it('unsets other primary flags before inserting when isPrimary is true', async () => {
      insertResultsQueue.push([
        {
          id: 11,
          agentId: 'agent-1',
          teamId: 7,
          roleInTeam: 'supervisor',
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      await service.addAgentToTeam({
        agentId: 'agent-1',
        teamId: 7,
        roleInTeam: 'supervisor',
        isPrimary: true,
      });

      // update (unset primary) should happen before insert
      const updateIdx = dbOperations.indexOf('update:agent_teams');
      const insertIdx = dbOperations.indexOf('insert:agent_teams');
      expect(updateIdx).toBeGreaterThanOrEqual(0);
      expect(insertIdx).toBeGreaterThan(updateIdx);
    });

    it('does not unset primary flags when isPrimary is false', async () => {
      insertResultsQueue.push([
        {
          id: 12,
          agentId: 'agent-2',
          teamId: 3,
          roleInTeam: 'member',
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      await service.addAgentToTeam({
        agentId: 'agent-2',
        teamId: 3,
        isPrimary: false,
      });

      expect(dbOperations).not.toContain('update:agent_teams');
      expect(dbOperations).toContain('insert:agent_teams');
    });
  });

  // ---------------------------------------------------------------------------
  // removeAgentFromTeam
  // ---------------------------------------------------------------------------
  describe('removeAgentFromTeam', () => {
    it('deletes the membership record', async () => {
      // SELECT to check isPrimary
      selectResultsQueue.push([{ isPrimary: false }]);

      await service.removeAgentFromTeam('agent-1', 10);

      expect(dbOperations).toContain('delete:agent_teams');
    });

    it('promotes next team as primary when removing the primary team', async () => {
      // SELECT to check isPrimary — returns primary: true
      selectResultsQueue.push([{ isPrimary: true }]);
      // SELECT next remaining team
      selectResultsQueue.push([{ teamId: 20 }]);

      await service.removeAgentFromTeam('agent-1', 10);

      expect(dbOperations).toContain('delete:agent_teams');
      expect(dbOperations).toContain('update:agent_teams');
      // Two selects: one for membership check, one for next team
      expect(dbOperations.filter(op => op === 'select')).toHaveLength(2);
    });

    it('does not promote any team if no remaining memberships after removal', async () => {
      // SELECT to check isPrimary — returns primary: true
      selectResultsQueue.push([{ isPrimary: true }]);
      // SELECT next remaining team — empty
      selectResultsQueue.push([]);

      await service.removeAgentFromTeam('agent-1', 10);

      expect(dbOperations).toContain('delete:agent_teams');
      // No update since there's no next team
      expect(dbOperations).not.toContain('update:agent_teams');
    });
  });

  // ---------------------------------------------------------------------------
  // updateAgentTeamRole
  // ---------------------------------------------------------------------------
  describe('updateAgentTeamRole', () => {
    it('updates roleInTeam without touching primary flag', async () => {
      updateResultsQueue.push([
        {
          id: 1,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: 'lead',
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      const result = await service.updateAgentTeamRole('agent-1', 10, { roleInTeam: 'lead' });

      expect(result.roleInTeam).toBe('lead');
      expect(dbOperations).toContain('update:agent_teams');
      // No extra unset-primary update
      expect(dbOperations.filter(op => op === 'update:agent_teams')).toHaveLength(1);
    });

    it('unsets other primaries then updates when setting isPrimary true', async () => {
      // First update: unset all primaries; second update: the actual set
      updateResultsQueue.push(undefined); // unset
      updateResultsQueue.push([
        {
          id: 1,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: 'member',
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      const result = await service.updateAgentTeamRole('agent-1', 10, { isPrimary: true });

      expect(result.isPrimary).toBe(true);
      expect(dbOperations.filter(op => op === 'update:agent_teams')).toHaveLength(2);
    });

    it('throws when membership not found', async () => {
      updateResultsQueue.push([]); // returning() yields empty

      await expect(
        service.updateAgentTeamRole('agent-x', 99, { roleInTeam: 'lead' })
      ).rejects.toThrow('Membership not found');
    });
  });

  // ---------------------------------------------------------------------------
  // setPrimaryTeam
  // ---------------------------------------------------------------------------
  describe('setPrimaryTeam', () => {
    it('updates primary team flags correctly', async () => {
      // SELECT inside getAgentTeamMembership
      selectResultsQueue.push([
        {
          id: 1,
          agentId: 'agent-1',
          teamId: 10,
          roleInTeam: 'member',
          isPrimary: false,
          joinedAt: NOW,
          createdAt: NOW,
        },
      ]);

      await service.setPrimaryTeam('agent-1', 10);

      // Should have two updates: unset all, then set specific
      expect(dbOperations.filter(op => op === 'update:agent_teams')).toHaveLength(2);
    });

    it('throws when agent is not a member of the team', async () => {
      // getAgentTeamMembership returns null
      selectResultsQueue.push([]);

      await expect(service.setPrimaryTeam('agent-1', 99)).rejects.toThrow(
        'Agent is not a member of this team'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // addAgentToMultipleTeams
  // ---------------------------------------------------------------------------
  describe('addAgentToMultipleTeams', () => {
    it('returns empty result immediately for empty teamIds array', async () => {
      const result = await service.addAgentToMultipleTeams('agent-1', []);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(dbOperations).toHaveLength(0);
    });

    it('adds new teams and skips already-existing memberships', async () => {
      // Existing memberships: agent is already in team 10
      selectResultsQueue.push([{ teamId: 10 }]);

      const result = await service.addAgentToMultipleTeams('agent-1', [10, 20, 30]);

      expect(result.skipped).toContain(10);
      expect(result.added).toEqual(expect.arrayContaining([20, 30]));
      expect(result.errors).toHaveLength(0);
      expect(dbOperations).toContain('insert:agent_teams');
    });

    it('skips all teams when all memberships already exist', async () => {
      selectResultsQueue.push([{ teamId: 5 }, { teamId: 6 }]);

      const result = await service.addAgentToMultipleTeams('agent-1', [5, 6]);

      expect(result.skipped).toEqual(expect.arrayContaining([5, 6]));
      expect(result.added).toHaveLength(0);
      // No insert needed
      expect(dbOperations).not.toContain('insert:agent_teams');
    });

    it('records errors when batch insert fails', async () => {
      // SELECT succeeds (no existing memberships)
      selectResultsQueue.push([]);
      // Force insert to throw by overriding mockDb.insert temporarily
      const originalInsert = mockDb.insert;
      mockDb.insert = vi.fn().mockImplementationOnce(() => {
        const chain: Record<string, any> = {};
        chain.values = vi.fn().mockReturnValue(chain);
        chain.then = (_resolve: any, reject: any) =>
          Promise.reject(new Error('DB write failure')).then(_resolve, reject);
        return chain;
      });

      const result = await service.addAgentToMultipleTeams('agent-1', [10, 20]);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBe('DB write failure');

      // Restore
      mockDb.insert = originalInsert;
    });
  });

  // ---------------------------------------------------------------------------
  // addMembersToTeam
  // ---------------------------------------------------------------------------
  describe('addMembersToTeam', () => {
    it('returns empty result immediately for empty agentIds array', async () => {
      const result = await service.addMembersToTeam(10, []);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('adds new members and skips already-existing ones', async () => {
      // Existing memberships: agent-2 is already a member
      selectResultsQueue.push([{ agentId: 'agent-2' }]);

      const result = await service.addMembersToTeam(10, ['agent-1', 'agent-2', 'agent-3']);

      expect(result.skipped).toContain('agent-2');
      expect(result.added).toEqual(expect.arrayContaining(['agent-1', 'agent-3']));
      expect(result.errors).toHaveLength(0);
      expect(dbOperations).toContain('insert:agent_teams');
    });
  });

  // ---------------------------------------------------------------------------
  // getTeamMemberCount
  // ---------------------------------------------------------------------------
  describe('getTeamMemberCount', () => {
    it('returns the count for a team', async () => {
      selectResultsQueue.push([{ count: 5 }]);

      const count = await service.getTeamMemberCount(10);

      expect(count).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // getTeamMemberCounts
  // ---------------------------------------------------------------------------
  describe('getTeamMemberCounts', () => {
    it('returns empty Map for empty teamIds array', async () => {
      const result = await service.getTeamMemberCounts([]);

      expect(result.size).toBe(0);
    });

    it('returns counts for each team, defaulting to 0 for teams with no members', async () => {
      selectResultsQueue.push([{ teamId: 1, count: 3 }, { teamId: 2, count: 7 }]);

      const result = await service.getTeamMemberCounts([1, 2, 3]);

      expect(result.get(1)).toBe(3);
      expect(result.get(2)).toBe(7);
      expect(result.get(3)).toBe(0); // default for team with no row
    });
  });

  // ---------------------------------------------------------------------------
  // getPrimaryTeamForAgent
  // ---------------------------------------------------------------------------
  describe('getPrimaryTeamForAgent', () => {
    it('returns primary team id and role when primary exists', async () => {
      selectResultsQueue.push([{ teamId: 10, roleInTeam: 'lead' }]);

      const result = await service.getPrimaryTeamForAgent('agent-1');

      expect(result).toEqual({ teamId: 10, roleInTeam: 'lead' });
    });

    it('returns null when agent has no primary team', async () => {
      selectResultsQueue.push([]);

      const result = await service.getPrimaryTeamForAgent('agent-1');

      expect(result).toBeNull();
    });
  });
});
