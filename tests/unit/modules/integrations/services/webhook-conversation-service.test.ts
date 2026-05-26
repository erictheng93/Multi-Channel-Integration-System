// webhook-conversation-service.ts Unit Tests
// Tests for findOrCreateConversation, isDuplicateMessage, saveMessage

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  ne: (...args: any[]) => ({ type: 'ne', args }),
}));

// Mock drizzle-factory
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

function createSelectChain() {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

function createInsertChain() {
  const chain: Record<string, any> = {};
  chain.values = mockInsertValues.mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = mockUpdateWhere.mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => createSelectChain()),
  insert: vi.fn().mockImplementation(() => createInsertChain()),
  update: vi.fn().mockImplementation(() => createUpdateChain()),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

vi.mock('@/db/schema', () => ({
  conversations: {
    id: { name: 'id' },
    customerId: { name: 'customerId' },
    assignedTeamId: { name: 'assignedTeamId' },
    status: { name: 'status' },
    priority: { name: 'priority' },
    firstResponseAt: { name: 'firstResponseAt' },
    closedAt: { name: 'closedAt' },
    lastMessageAt: { name: 'lastMessageAt' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
  },
  messages: {
    id: { name: 'id' },
    conversationId: { name: 'conversationId' },
    senderType: { name: 'senderType' },
    customerSenderId: { name: 'customerSenderId' },
    agentSenderId: { name: 'agentSenderId' },
    content: { name: 'content' },
    messageType: { name: 'messageType' },
    platformMessageId: { name: 'platformMessageId' },
    isSent: { name: 'isSent' },
    deliveryStatus: { name: 'deliveryStatus' },
    metadata: { name: 'metadata' },
    senderName: { name: 'senderName' },
    createdAt: { name: 'createdAt' },
  },
  customers: {
    id: { name: 'id' },
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-09T12:00:00.000Z'),
  nowMs: vi.fn(() => 1741521600000),
}));

vi.mock('@/utils/drizzle-converters', () => ({
  convertConversation: vi.fn((c: any) => ({ ...c, converted: true })),
}));

vi.mock('@/utils/notification-trigger', () => ({
  triggerNewConversationNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/workers/latest-message-worker', () => ({
  LatestMessageJobQueue: vi.fn().mockImplementation(() => ({
    updateLatestMessage: vi.fn().mockResolvedValue(undefined),
  })),
}));

import {
  findOrCreateConversation,
  isDuplicateMessage,
  saveMessage,
} from '@modules/integrations/services/webhook-conversation-service';

const mockEnv = { DB: {} } as any;

describe('webhook-conversation-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default implementations after reset
    mockDb.select.mockImplementation(() => createSelectChain());
    mockDb.insert.mockImplementation(() => createInsertChain());
    mockDb.update.mockImplementation(() => createUpdateChain());
  });

  // =========================================================================
  // findOrCreateConversation
  // =========================================================================
  describe('findOrCreateConversation', () => {
    it('should return existing conversation if found', async () => {
      const existingConversation = {
        id: 'conv-123',
        customerId: 1,
        status: 'active',
        assignedTeamId: null,
        lastMessageAt: '2026-03-08T12:00:00Z',
      };

      // First select: find existing conversation
      mockGet.mockResolvedValueOnce(existingConversation);

      const result = await findOrCreateConversation(mockEnv, 1, 'line');

      expect(result).toEqual({ ...existingConversation, converted: true });
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should not update lastMessageAt before a message row is saved', async () => {
      const existingConversation = {
        id: 'conv-123',
        customerId: 1,
        status: 'active',
        assignedTeamId: 5,
      };

      mockGet.mockResolvedValueOnce(existingConversation);

      await findOrCreateConversation(mockEnv, 1, 'line');

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should backfill team assignment on existing conversation without team', async () => {
      const existingConversation = {
        id: 'conv-123',
        customerId: 1,
        status: 'active',
        assignedTeamId: null,
      };

      mockGet.mockResolvedValueOnce(existingConversation);

      const result = await findOrCreateConversation(mockEnv, 1, 'line', {
        assignedTeamId: 7,
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTeamId: 7 })
      );
      expect(result.assignedTeamId).toBe(7);
    });

    it('should NOT overwrite existing team assignment', async () => {
      const existingConversation = {
        id: 'conv-123',
        customerId: 1,
        status: 'active',
        assignedTeamId: 3,
      };

      mockGet.mockResolvedValueOnce(existingConversation);

      await findOrCreateConversation(mockEnv, 1, 'line', {
        assignedTeamId: 7,
      });

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should create new conversation when none exists', async () => {
      // First select: no existing conversation (fast path)
      mockGet.mockResolvedValueOnce(undefined);
      // Double-check inside lock: still no existing
      mockGet.mockResolvedValueOnce(undefined);
      // Re-query after insert: return the new conversation
      const newConversation = {
        id: 'mock-uuid-1234',
        customerId: 1,
        status: 'active',
        assignedTeamId: null,
      };
      mockGet.mockResolvedValueOnce(newConversation);

      const result = await findOrCreateConversation(mockEnv, 1, 'line');

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-1234',
          customerId: 1,
          status: 'active',
          priority: 'normal',
          lastMessageAt: null,
        })
      );
      expect(result).toEqual(expect.objectContaining({ converted: true }));
    });

    it('should trigger notification for new LINE conversation', async () => {
      mockGet.mockResolvedValueOnce(undefined); // no existing (fast path)
      mockGet.mockResolvedValueOnce(undefined); // double-check inside lock
      mockGet.mockResolvedValueOnce({
        id: 'mock-uuid-1234',
        customerId: 1,
        status: 'active',
        assignedTeamId: 5,
      });

      await findOrCreateConversation(mockEnv, 1, 'line', {
        customerDisplayName: 'Test User',
        messageContent: 'Hello',
        assignedTeamId: 5,
      });

      const { triggerNewConversationNotification } = await import(
        '@/utils/notification-trigger'
      );
      expect(triggerNewConversationNotification).toHaveBeenCalledWith(
        mockEnv,
        expect.objectContaining({
          conversationId: 'mock-uuid-1234',
          customerName: 'Test User',
          platform: 'LINE',
          messagePreview: 'Hello',
          teamId: 5,
        })
      );
    });

    it('should throw when re-query after insert fails', async () => {
      mockGet.mockResolvedValueOnce(undefined); // no existing (fast path)
      mockGet.mockResolvedValueOnce(undefined); // double-check inside lock
      mockGet.mockResolvedValueOnce(undefined); // re-query returns null
      mockAll.mockResolvedValueOnce([]); // diagnostic query
      mockGet.mockResolvedValueOnce(null); // db connection test

      await expect(
        findOrCreateConversation(mockEnv, 1, 'line')
      ).rejects.toThrow('Failed to create conversation');
    });

    it('should use assignedTeamId when creating new conversation', async () => {
      mockGet.mockResolvedValueOnce(undefined); // no existing (fast path)
      mockGet.mockResolvedValueOnce(undefined); // double-check inside lock
      mockGet.mockResolvedValueOnce({
        id: 'mock-uuid-1234',
        customerId: 1,
        status: 'active',
        assignedTeamId: 10,
      });

      await findOrCreateConversation(mockEnv, 1, 'facebook', {
        assignedTeamId: 10,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTeamId: 10 })
      );
    });

    it('should use distributed lock when creating new conversation', async () => {
      // Mock lock DO available
      const mockLockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, lockId: 'test-lock-1' }))
      );
      const envWithLock = {
        DB: {},
        DISTRIBUTED_LOCK: {
          idFromName: vi.fn().mockReturnValue('lock-id'),
          get: vi.fn().mockReturnValue({ fetch: mockLockFetch }),
        },
      } as any;

      mockGet.mockResolvedValueOnce(undefined); // fast path: no existing
      mockGet.mockResolvedValueOnce(undefined); // double-check inside lock: still no existing
      mockGet.mockResolvedValueOnce({            // re-query after insert
        id: 'mock-uuid-1234',
        customerId: 1,
        status: 'active',
        assignedTeamId: null,
      });

      await findOrCreateConversation(envWithLock, 1, 'line');

      // Lock should be acquired and released (2 fetch calls: acquire + release)
      expect(mockLockFetch).toHaveBeenCalledTimes(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should return existing conversation found during double-check inside lock', async () => {
      const existingConv = {
        id: 'conv-existing',
        customerId: 1,
        status: 'active',
        assignedTeamId: 3,
      };

      mockGet.mockResolvedValueOnce(undefined);    // fast path: no existing
      mockGet.mockResolvedValueOnce(existingConv);  // double-check inside lock: found!

      const result = await findOrCreateConversation(mockEnv, 1, 'line');

      // Should NOT insert — another request created it
      expect(mockDb.insert).not.toHaveBeenCalled();
      // Should not update timestamps until saveMessage succeeds
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(result).toEqual({ ...existingConv, converted: true });
    });

    it('should backfill team assignment during double-check inside lock', async () => {
      const existingConv = {
        id: 'conv-existing',
        customerId: 1,
        status: 'active',
        assignedTeamId: null,
      };

      mockGet.mockResolvedValueOnce(undefined);    // fast path
      mockGet.mockResolvedValueOnce(existingConv);  // double-check finds it

      const result = await findOrCreateConversation(mockEnv, 1, 'line', {
        assignedTeamId: 7,
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTeamId: 7 })
      );
      expect(result.assignedTeamId).toBe(7);
    });
  });

  // =========================================================================
  // isDuplicateMessage
  // =========================================================================
  describe('isDuplicateMessage', () => {
    it('should return true when message exists', async () => {
      mockGet.mockResolvedValueOnce({ id: 'msg-1' });

      const result = await isDuplicateMessage(mockEnv, 'platform-msg-1', 'line');

      expect(result).toBe(true);
    });

    it('should return false when no duplicate found', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const result = await isDuplicateMessage(mockEnv, 'platform-msg-1', 'line');

      expect(result).toBe(false);
    });

    it('should work for facebook platform', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const result = await isDuplicateMessage(mockEnv, 'fb-msg-1', 'facebook');

      expect(result).toBe(false);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // saveMessage
  // =========================================================================
  describe('saveMessage', () => {
    it('should insert message with correct fields', async () => {
      const result = await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello world',
        'text',
        'platform-msg-1',
        'Test User',
        null,
        'line'
      );

      expect(result).toBe('mock-uuid-1234');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-1234',
          conversationId: 'conv-1',
          senderType: 'customer',
          customerSenderId: 1,
          content: 'Hello world',
          messageType: 'text',
          platformMessageId: 'platform-msg-1',
          isSent: true,
          deliveryStatus: 'delivered',
          metadata: null,
          senderName: 'Test User',
        })
      );
    });

    it('should JSON.stringify mediaData when provided', async () => {
      const mediaData = { url: 'https://example.com/image.jpg', type: 'image' };

      await saveMessage(
        mockEnv,
        'conv-1',
        1,
        '[Image]',
        'image',
        'platform-msg-2',
        'Test User',
        mediaData,
        'line'
      );

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: JSON.stringify(mediaData),
        })
      );
    });

    it('should set senderName to null when displayName is null', async () => {
      await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        null,
        null,
        null,
        'facebook'
      );

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          senderName: null,
          platformMessageId: null,
        })
      );
    });

    it('should trigger cache update after successful save', async () => {
      await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        'msg-1',
        null,
        null,
        'line'
      );

      const { LatestMessageJobQueue } = await import(
        '@/workers/latest-message-worker'
      );
      expect(LatestMessageJobQueue).toHaveBeenCalledWith(mockEnv);
    });

    it('should update conversation timestamps only after message insert succeeds', async () => {
      await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        'msg-1',
        null,
        null,
        'line'
      );

      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledWith({
        lastMessageAt: '2026-03-09T12:00:00.000Z',
        updatedAt: '2026-03-09T12:00:00.000Z',
      });
    });

    it('should not fail when cache update throws', async () => {
      const { LatestMessageJobQueue } = await import(
        '@/workers/latest-message-worker'
      );
      vi.mocked(LatestMessageJobQueue).mockImplementationOnce(() => ({
        updateLatestMessage: vi.fn().mockRejectedValue(new Error('cache fail')),
      }));

      // Should NOT throw
      const result = await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        'msg-1',
        null,
        null,
        'line'
      );

      expect(result).toBe('mock-uuid-1234');
    });

    it('should throw when DB insert fails', async () => {
      mockInsertValues.mockReturnValueOnce({
        then: (_resolve: any, reject: any) =>
          Promise.reject(new Error('DB insert failed')).catch(reject),
      });

      await expect(
        saveMessage(mockEnv, 'conv-1', 1, 'Hello', 'text', 'msg-1', null, null, 'line')
      ).rejects.toThrow('Failed to create message');
    });

    it('should handle UNIQUE constraint violation gracefully', async () => {
      // Simulate UNIQUE constraint failure on insert
      mockInsertValues.mockReturnValueOnce({
        then: (_resolve: any, reject: any) =>
          Promise.reject(new Error('UNIQUE constraint failed: messages.platformMessageId')).catch(reject),
      });

      // Mock the fallback query for existing message
      mockGet.mockResolvedValueOnce({ id: 'existing-msg-id' });

      const result = await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        'duplicate-platform-msg',
        null,
        null,
        'line'
      );

      // Should return the existing message ID, not throw
      expect(result).toBe('existing-msg-id');
    });

    it('should return generated messageId when UNIQUE violation has no platformMessageId', async () => {
      mockInsertValues.mockReturnValueOnce({
        then: (_resolve: any, reject: any) =>
          Promise.reject(new Error('UNIQUE constraint failed')).catch(reject),
      });

      const result = await saveMessage(
        mockEnv,
        'conv-1',
        1,
        'Hello',
        'text',
        null,  // no platformMessageId
        null,
        null,
        'line'
      );

      expect(result).toBe('mock-uuid-1234');
    });

    it('should still throw on non-UNIQUE DB errors', async () => {
      mockInsertValues.mockReturnValueOnce({
        then: (_resolve: any, reject: any) =>
          Promise.reject(new Error('Connection timeout')).catch(reject),
      });

      await expect(
        saveMessage(mockEnv, 'conv-1', 1, 'Hello', 'text', 'msg-1', null, null, 'line')
      ).rejects.toThrow('Failed to create message');
    });
  });
});
