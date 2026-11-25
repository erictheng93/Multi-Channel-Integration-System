// agent-crud.ts Unit Tests
// Focused on createAgent and deleteAgent (high-risk paths)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql' }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
}));

// Track all DB operations in order
let dbOperations: string[] = [];
const mockGet = vi.fn();

function createSelectChain() {
  const chain: Record<string, any> = {};
  const methods = ['from', 'where', 'leftJoin', 'innerJoin', 'orderBy', 'limit', 'offset', 'groupBy'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.get = mockGet;
  chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
    return Promise.resolve([]).then(resolve, reject);
  };
  return chain;
}

function createInsertChain() {
  const chain: Record<string, any> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn().mockResolvedValue({
    id: 'agent-123',
    email: 'test@example.com',
    displayName: 'Test Agent',
    role: 'agent',
    isActive: true,
    passwordHash: 'hashed',
    passwordPolicy: 'changeable',
    createdAt: '2026-03-09T12:00:00Z',
    updatedAt: '2026-03-09T12:00:00Z',
  });
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn().mockResolvedValue({ id: 'agent-123' });
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createDeleteChain() {
  const chain: Record<string, any> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn().mockResolvedValue({ id: 'agent-123' });
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb: any = {
  select: vi.fn().mockImplementation(() => {
    dbOperations.push('select');
    return createSelectChain();
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

// Mock all schema tables with name properties for operation tracking
vi.mock('@/db/schema', () => ({
  agents: { id: { name: 'id' }, email: { name: 'email' }, displayName: { name: 'displayName' }, role: { name: 'role' }, isActive: { name: 'isActive' }, passwordHash: { name: 'passwordHash' }, passwordPolicy: { name: 'passwordPolicy' }, lastActive: { name: 'lastActive' }, lastLoginAt: { name: 'lastLoginAt' }, createdAt: { name: 'createdAt' }, updatedAt: { name: 'updatedAt' }, deletedAt: { name: 'deletedAt' }, name: 'agents' },
  teams: { id: { name: 'id' }, name: { type: 'column', name: 'name' } },
  agentTeams: { agentId: { name: 'agentId' }, teamId: { name: 'teamId' }, isPrimary: { name: 'isPrimary' }, roleInTeam: { name: 'roleInTeam' }, joinedAt: { name: 'joinedAt' }, name: 'agentTeams' },
  messages: { agentSenderId: { name: 'agentSenderId' }, name: 'messages' },
  delayedMessages: { agentId: { name: 'agentId' }, name: 'delayedMessages' },
  notifications: { userId: { name: 'userId' }, name: 'notifications' },
  tags: { createdBy: { name: 'createdBy' }, name: 'tags' },
  customerTags: { assignedBy: { name: 'assignedBy' }, name: 'customerTags' },
  conversationTags: { assignedBy: { name: 'assignedBy' }, name: 'conversationTags' },
  messageRecallLogs: { userId: { name: 'userId' }, name: 'messageRecallLogs' },
  conversationTransfers: { transferredBy: { name: 'transferredBy' }, name: 'conversationTransfers' },
  fileAttachments: { uploadedBy: { name: 'uploadedBy' }, name: 'fileAttachments' },
  activities: { userId: { name: 'userId' }, name: 'activities' },
  reports: { createdBy: { name: 'createdBy' }, name: 'reports' },
  scheduledReports: { createdBy: { name: 'createdBy' }, name: 'scheduledReports' },
  reportDownloadHistory: { downloadedBy: { name: 'downloadedBy' }, name: 'reportDownloadHistory' },
  reportTemplates: { createdBy: { name: 'createdBy' }, name: 'reportTemplates' },
  channelIntegrations: { configuredBy: { name: 'configuredBy' }, name: 'channelIntegrations' },
  customerFeedback: { agentId: { name: 'agentId' }, name: 'customerFeedback' },
}));

vi.mock('@/utils/id-generator', () => ({
  generateId: vi.fn(() => 'agent-123'),
}));

vi.mock('@/utils/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-09T12:00:00.000Z'),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { AgentService } from '@modules/agents/services/agent-crud';
import {
  AgentAlreadyExistsError,
  InvalidAgentDataError,
} from '@modules/agents/types/agent-types';

/** Values passed to the Nth db.insert(...).values(...) call. */
function insertedValues(n: number): Record<string, unknown> {
  const chain = mockDb.insert.mock.results[n]?.value;
  return chain?.values.mock.calls[0]?.[0];
}

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbOperations = [];
    service = new AgentService(mockDb);
  });

  // =========================================================================
  // createAgent
  // =========================================================================
  describe('createAgent', () => {
    it('should create agent with email uniqueness check', async () => {
      // Email check: no existing
      mockGet.mockResolvedValueOnce(undefined);

      const result = await service.createAgent({
        email: 'new@example.com',
        displayName: 'New Agent',
      });

      expect(result).toEqual(expect.objectContaining({
        id: 'agent-123',
        email: 'test@example.com',
      }));
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(insertedValues(0)).toMatchObject({
        id: 'agent-123',
        email: 'new@example.com',
        displayName: 'New Agent',
        isActive: true,
        passwordPolicy: 'changeable',
      });
    });

    it('should throw AgentAlreadyExistsError when email exists', async () => {
      mockGet.mockResolvedValueOnce({ id: 'existing-agent', email: 'dup@example.com' });

      await expect(
        service.createAgent({ email: 'dup@example.com', displayName: 'Dup' })
      ).rejects.toThrow(AgentAlreadyExistsError);
    });

    it('should validate team existence when teamId provided', async () => {
      // Email check: no existing
      mockGet.mockResolvedValueOnce(undefined);
      // Team check: not found
      mockGet.mockResolvedValueOnce(undefined);

      await expect(
        service.createAgent({
          email: 'new@example.com',
          displayName: 'Agent',
          teamId: 999,
        })
      ).rejects.toThrow(InvalidAgentDataError);
    });

    it('should create agent_teams membership when teamId valid', async () => {
      // Email check: no existing
      mockGet.mockResolvedValueOnce(undefined);
      // Team check: found
      mockGet.mockResolvedValueOnce({ id: 5, name: 'Team A' });

      await service.createAgent({
        email: 'new@example.com',
        displayName: 'Agent',
        teamId: 5,
      });

      // Should have 2 inserts: agents + agentTeams (primary membership)
      expect(dbOperations.filter(op => op.startsWith('insert:'))).toEqual(['insert:agents', 'insert:agentTeams']);
      expect(insertedValues(1)).toEqual({
        agentId: 'agent-123',
        teamId: 5,
        roleInTeam: 'member',
        isPrimary: true,
        joinedAt: '2026-03-09T12:00:00.000Z',
      });
    });

    it('should hash password when not provided', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      await service.createAgent({
        email: 'new@example.com',
        displayName: 'Agent',
      });

      const { hashPassword } = await import('@/utils/auth');
      expect(hashPassword).toHaveBeenCalledTimes(1);
      expect(insertedValues(0).passwordHash).toBe('hashed-password');
    });

    it('should use provided passwordHash when given', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      await service.createAgent({
        email: 'new@example.com',
        displayName: 'Agent',
        passwordHash: 'pre-hashed',
      });

      // The provided hash wins and no temporary password is hashed
      const { hashPassword } = await import('@/utils/auth');
      expect(hashPassword).not.toHaveBeenCalled();
      expect(insertedValues(0).passwordHash).toBe('pre-hashed');
    });

    it('should default role to agent when not specified', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      await service.createAgent({
        email: 'new@example.com',
        displayName: 'Agent',
      });

      expect(insertedValues(0).role).toBe('agent');
    });

    it('should keep an explicit role and isActive=false', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      await service.createAgent({
        email: 'new@example.com',
        displayName: 'Agent',
        role: 'admin',
        isActive: false,
      });

      expect(insertedValues(0)).toMatchObject({ role: 'admin', isActive: false });
    });
  });

  // =========================================================================
  // deleteAgent — 17-step FK cleanup
  // =========================================================================
  describe('deleteAgent', () => {
    it('should execute all 17 cleanup steps in order', async () => {
      const result = await service.deleteAgent('agent-to-delete');

      expect(result).toBe(true);

      // Verify all operations happened
      // Steps 1, 3: delete (notifications, delayedMessages)
      // Steps 2, 4-16: update (messages, messageRecallLogs, fileAttachments, tags, customerTags, conversationTags, conversationTransfers, activities, reports, scheduledReports, reportDownloadHistory, reportTemplates, channelIntegrations, customerFeedback)
      // Step 17: delete (agents)

      // Total: 3 deletes + 14 updates = 17 operations
      const deleteCount = dbOperations.filter(op => op.startsWith('delete:')).length;
      const updateCount = dbOperations.filter(op => op.startsWith('update:')).length;

      expect(deleteCount).toBe(3); // notifications, delayedMessages, agents
      expect(updateCount).toBe(14); // all the FK nullifications
      // Every RESTRICT FK table is cleaned before the agent row goes
      expect(dbOperations).toEqual([
        'delete:notifications',
        'update:messages',
        'delete:delayedMessages',
        'update:messageRecallLogs',
        'update:fileAttachments',
        'update:tags',
        'update:customerTags',
        'update:conversationTags',
        'update:conversationTransfers',
        'update:activities',
        'update:reports',
        'update:scheduledReports',
        'update:reportDownloadHistory',
        'update:reportTemplates',
        'update:channelIntegrations',
        'update:customerFeedback',
        'delete:agents',
      ]);
    });

    it('should delete notifications first (step 1)', async () => {
      await service.deleteAgent('agent-1');

      expect(dbOperations[0]).toBe('delete:notifications');
    });

    it('should delete agent record last (step 17)', async () => {
      await service.deleteAgent('agent-1');

      expect(dbOperations[dbOperations.length - 1]).toBe('delete:agents');
    });

    it('should return true on successful deletion', async () => {
      const result = await service.deleteAgent('agent-1');
      expect(result).toBe(true);
    });

    it('should return false when agent not found in final delete', async () => {
      // Override the last delete chain to return null
      const originalDelete = mockDb.delete;
      let deleteCallCount = 0;
      mockDb.delete = vi.fn().mockImplementation((table: any) => {
        deleteCallCount++;
        dbOperations.push(`delete:${table?.name || 'unknown'}`);
        const chain = createDeleteChain();
        // Third delete (agents) returns null = not found
        if (deleteCallCount === 3) {
          chain.get = vi.fn().mockResolvedValue(null);
        }
        return chain;
      });

      const result = await service.deleteAgent('nonexistent');

      expect(result).toBe(false);
      mockDb.delete = originalDelete;
    });

    it('should throw when a cleanup step fails', async () => {
      const originalUpdate = mockDb.update;
      mockDb.update = vi.fn().mockImplementation(() => {
        const chain = createUpdateChain();
        chain.then = (_resolve: any, reject: any) =>
          Promise.reject(new Error('FK constraint violation')).catch(reject);
        chain.set = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        return chain;
      });

      await expect(service.deleteAgent('agent-1')).rejects.toThrow(
        'Failed to delete agent'
      );

      mockDb.update = originalUpdate;
    });
  });

  // =========================================================================
  // updateAgent
  // =========================================================================
  describe('updateAgent', () => {
    it('should throw AgentNotFoundError when agent does not exist', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { AgentNotFoundError } = await import('@modules/agents/types/agent-types');
      await expect(
        service.updateAgent('nonexistent', { displayName: 'New Name' })
      ).rejects.toThrow(AgentNotFoundError);
    });

    it('should throw AgentAlreadyExistsError on duplicate email', async () => {
      // Agent exists
      mockGet.mockResolvedValueOnce({ id: 'agent-1', email: 'old@example.com' });
      // Duplicate check: found
      mockGet.mockResolvedValueOnce({ id: 'agent-2', email: 'taken@example.com' });

      await expect(
        service.updateAgent('agent-1', { email: 'taken@example.com' })
      ).rejects.toThrow(AgentAlreadyExistsError);
    });

    it('should update agent_teams when teamId changes', async () => {
      // Agent exists
      mockGet.mockResolvedValueOnce({ id: 'agent-1', email: 'test@example.com' });
      // Team check: found
      mockGet.mockResolvedValueOnce({ id: 5, name: 'New Team' });

      await service.updateAgent('agent-1', { teamId: 5 });

      // Should delete old team + insert new team
      expect(dbOperations).toContain('delete:agentTeams');
      expect(dbOperations).toContain('insert:agentTeams');
      expect(dbOperations.indexOf('delete:agentTeams')).toBeLessThan(dbOperations.indexOf('insert:agentTeams'));
    });

    it('never writes passwordHash through the generic update', async () => {
      mockGet.mockResolvedValueOnce({ id: 'agent-1', email: 'test@example.com' });

      await service.updateAgent('agent-1', {
        displayName: 'New Name',
        passwordHash: 'attacker-hash',
      } as Parameters<AgentService['updateAgent']>[1]);

      const setArg = mockDb.update.mock.results[0]?.value.set.mock.calls[0]?.[0];
      expect(setArg).toMatchObject({ displayName: 'New Name' });
      expect(setArg).not.toHaveProperty('passwordHash');
    });

    it('should validate new team exists', async () => {
      mockGet.mockResolvedValueOnce({ id: 'agent-1', email: 'test@example.com' });
      mockGet.mockResolvedValueOnce(undefined); // team not found

      await expect(
        service.updateAgent('agent-1', { teamId: 999 })
      ).rejects.toThrow(InvalidAgentDataError);
    });
  });
});
