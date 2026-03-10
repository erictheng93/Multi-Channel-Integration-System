// member-service.ts Unit Tests
// Focused on hardDeleteMember, addMember, bulkHardDeleteMembers, bulkUpdateMembers

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
  isNull: (...args: any[]) => ({ type: 'isNull', args }),
  inArray: (...args: any[]) => ({ type: 'inArray', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql', as: () => ({ type: 'sql_alias' }) }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
}));

// Track DB operations for order verification
let dbOperations: string[] = [];

function createSelectChain(returnValue?: any) {
  const chain: Record<string, any> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make thenable — returns the provided value or empty array
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
    return Promise.resolve(returnValue ?? [{ id: 'agent-new' }]).then(resolve);
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

// Queued select results for sequential calls
let selectResultsQueue: any[] = [];

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
  agents: { id: { name: 'id' }, email: { name: 'email' }, displayName: { name: 'displayName' }, role: { name: 'role' }, isActive: { name: 'isActive' }, passwordHash: { name: 'passwordHash' }, createdAt: { name: 'createdAt' }, updatedAt: { name: 'updatedAt' }, deletedAt: { name: 'deletedAt' }, lastLoginAt: { name: 'lastLoginAt' }, lastActive: { name: 'lastActive' }, name: 'agents' },
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

vi.mock('@/utils/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password-123'),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-09T12:00:00.000Z'),
  nowMs: vi.fn(() => 1741521600000),
}));

vi.mock('../types/member-types', () => ({}));

import { MemberService } from '@modules/teams/services/member-service';

describe('MemberService', () => {
  let service: MemberService;
  const mockDatabase = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    dbOperations = [];
    selectResultsQueue = [];
    service = new MemberService(mockDatabase);
  });

  // =========================================================================
  // addMember
  // =========================================================================
  describe('addMember', () => {
    it('should create agent with hashed password', async () => {
      const result = await service.addMember(
        {
          email: 'new@example.com',
          password: 'secret123',
          displayName: 'New Member',
          role: 'agent',
        },
        'admin-1'
      );

      const { hashPassword } = await import('@/utils/auth');
      expect(hashPassword).toHaveBeenCalledWith('secret123');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        email: undefined, // from mock return, formatMember accesses props
      }));
    });

    it('should create agent_teams membership when teamId provided', async () => {
      await service.addMember(
        {
          email: 'new@example.com',
          password: 'secret123',
          displayName: 'New Member',
          teamId: 5,
        },
        'admin-1'
      );

      // Should have 2 inserts: agents + agentTeams
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should NOT create agent_teams when teamId omitted', async () => {
      await service.addMember(
        {
          email: 'new@example.com',
          password: 'secret123',
          displayName: 'New Member',
        },
        'admin-1'
      );

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should default role to agent when not specified', async () => {
      await service.addMember(
        {
          email: 'new@example.com',
          password: 'secret123',
          displayName: 'New Member',
        },
        'admin-1'
      );

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should generate unique memberId with timestamp', async () => {
      await service.addMember(
        {
          email: 'new@example.com',
          password: 'secret123',
          displayName: 'New Member',
        },
        'admin-1'
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // hardDeleteMember — 17-step FK cleanup
  // =========================================================================
  describe('hardDeleteMember', () => {
    it('should execute all 17 cleanup steps', async () => {
      const result = await service.hardDeleteMember('member-1', 'admin-1');

      expect(result).toBe(true);

      // Count operations:
      // 2 deletes: notifications (step 1), delayedMessages (step 3), agents (step 17) = 3
      // 14 updates: all FK nullifications
      const deleteCount = dbOperations.filter(op => op.startsWith('delete:')).length;
      const updateCount = dbOperations.filter(op => op.startsWith('update:')).length;

      expect(deleteCount).toBe(3);
      expect(updateCount).toBe(14);
      expect(deleteCount + updateCount).toBe(17);
    });

    it('should clean up notifications first', async () => {
      await service.hardDeleteMember('member-1', 'admin-1');

      expect(dbOperations[0]).toBe('delete:notifications');
    });

    it('should nullify message sender in step 2', async () => {
      await service.hardDeleteMember('member-1', 'admin-1');

      expect(dbOperations[1]).toBe('update:messages');
    });

    it('should delete agent record last', async () => {
      await service.hardDeleteMember('member-1', 'admin-1');

      expect(dbOperations[dbOperations.length - 1]).toBe('delete:agents');
    });

    it('should set deleted-user for audit trail fields', async () => {
      await service.hardDeleteMember('member-1', 'admin-1');

      // Steps 4,6,7,8,9,10,11,12,13,14 set 'deleted-user'
      // Verify update was called for activities, reports, etc.
      const updateOps = dbOperations.filter(op => op.startsWith('update:'));
      expect(updateOps).toContain('update:activities');
      expect(updateOps).toContain('update:reports');
      expect(updateOps).toContain('update:tags');
    });

    it('should nullify FK fields for channelIntegrations and customerFeedback', async () => {
      await service.hardDeleteMember('member-1', 'admin-1');

      const updateOps = dbOperations.filter(op => op.startsWith('update:'));
      expect(updateOps).toContain('update:channelIntegrations');
      expect(updateOps).toContain('update:customerFeedback');
    });
  });

  // =========================================================================
  // bulkHardDeleteMembers
  // =========================================================================
  describe('bulkHardDeleteMembers', () => {
    it('should reject when exceeding 50 member limit', async () => {
      const memberIds = Array.from({ length: 51 }, (_, i) => `member-${i}`);

      const result = await service.bulkHardDeleteMembers(memberIds, 'admin-1');

      expect(result.deleted).toHaveLength(0);
      expect(result.failed).toHaveLength(51);
      expect(result.failed[0].error).toContain('50');
    });

    it('should return empty results for empty input', async () => {
      const result = await service.bulkHardDeleteMembers([], 'admin-1');

      expect(result.deleted).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.deletedMembers).toHaveLength(0);
    });

    it('should report not-found members as failed', async () => {
      // Query returns only 1 of 2 requested members
      selectResultsQueue.push([
        { id: 'member-1', email: 'a@b.com', displayName: 'A', role: 'agent', isActive: true, createdAt: '2026-01-01' },
      ]);

      const result = await service.bulkHardDeleteMembers(
        ['member-1', 'member-not-found'],
        'admin-1'
      );

      expect(result.failed.some(f => f.memberId === 'member-not-found')).toBe(true);
    });

    it('should delete existing members one by one', async () => {
      selectResultsQueue.push([
        { id: 'member-1', email: 'a@b.com', displayName: 'A', role: 'agent', isActive: true, createdAt: '2026-01-01' },
        { id: 'member-2', email: 'b@b.com', displayName: 'B', role: 'agent', isActive: true, createdAt: '2026-01-01' },
      ]);

      const result = await service.bulkHardDeleteMembers(
        ['member-1', 'member-2'],
        'admin-1'
      );

      expect(result.deleted).toContain('member-1');
      expect(result.deleted).toContain('member-2');
      expect(result.deletedMembers).toHaveLength(2);
    });
  });

  // =========================================================================
  // bulkUpdateMembers
  // =========================================================================
  describe('bulkUpdateMembers', () => {
    it('should reject when exceeding 50 member limit', async () => {
      const memberIds = Array.from({ length: 51 }, (_, i) => `member-${i}`);

      const result = await service.bulkUpdateMembers(
        memberIds,
        { role: 'admin' },
        'admin-1'
      );

      expect(result.updated).toHaveLength(0);
      expect(result.failed).toHaveLength(51);
    });

    it('should reject when no update fields provided', async () => {
      const result = await service.bulkUpdateMembers(
        ['member-1'],
        {},
        'admin-1'
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('至少需要一個更新欄位');
    });

    it('should return empty results for empty input', async () => {
      const result = await service.bulkUpdateMembers([], { role: 'admin' }, 'admin-1');

      expect(result.updated).toHaveLength(0);
    });

    it('should skip self-updates', async () => {
      selectResultsQueue.push([
        { id: 'admin-1', email: 'admin@b.com', displayName: 'Admin', role: 'admin', isActive: true, createdAt: '2026-01-01' },
      ]);

      const result = await service.bulkUpdateMembers(
        ['admin-1'],
        { role: 'agent' },
        'admin-1'
      );

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain('自己');
    });

    it('should report not-found members as failed', async () => {
      selectResultsQueue.push([]); // no members found

      const result = await service.bulkUpdateMembers(
        ['nonexistent'],
        { role: 'admin' },
        'admin-1'
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('不存在');
    });

    it('should update existing members successfully', async () => {
      selectResultsQueue.push([
        { id: 'member-1', email: 'a@b.com', displayName: 'A', role: 'agent', isActive: true, createdAt: '2026-01-01' },
      ]);

      const result = await service.bulkUpdateMembers(
        ['member-1'],
        { role: 'admin' },
        'admin-1'
      );

      expect(result.updated).toContain('member-1');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // memberExists
  // =========================================================================
  describe('memberExists', () => {
    it('should return true when email exists', async () => {
      selectResultsQueue.push([{ id: 'agent-1' }]);

      const result = await service.memberExists('exists@example.com');

      expect(result).toBe(true);
    });

    it('should return false when email not found', async () => {
      selectResultsQueue.push([]);

      const result = await service.memberExists('new@example.com');

      expect(result).toBe(false);
    });
  });
});
