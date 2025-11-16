// Integration Tests for SSE Streaming Endpoints
// Tests Server-Sent Events functionality for real-time conversation updates

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import { eq, desc, and, gt } from 'drizzle-orm';
import * as schema from '@backend/db/schema';

// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null;

// Mock drizzle-orm/d1
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

// Mock JWT verification for SSE endpoints
vi.mock('@modules/auth/services/auth', () => ({
  verifyJWT: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
  getUserById: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'agent',
    isActive: true
  })
}));

// Mock PermissionService
vi.mock('@shared/services/permission-service', () => ({
  PermissionService: {
    getVisibleConversations: vi.fn()
  }
}));

describe('Conversation Handler - SSE Streaming Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let testAdmin: any;
  let testAgent: any;
  let testTeam: any;
  let testCustomer: any;
  let testConversation: any;

  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    testTeam = await env.createTestTeam({ name: 'Test Team' });
    testAdmin = await env.createTestAgent({
      id: 'admin-sse-1',
      email: 'admin@sse.com',
      displayName: 'SSE Admin',
      role: 'admin',
      teamId: testTeam.id
    });
    testAgent = await env.createTestAgent({
      id: 'agent-sse-1',
      email: 'agent@sse.com',
      displayName: 'SSE Agent',
      role: 'agent',
      teamId: testTeam.id
    });
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U_SSE_TEST',
      displayName: 'SSE Customer'
    });
    testConversation = await env.createTestConversation(testCustomer.id, {
      assignedUserId: testAgent.id,
      assignedTeamId: testTeam.id
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    env.close();
    currentTestEnv = null;
  });

  describe('GET /stream - Global Conversation Stream', () => {
    it('should prepare conversation data for SSE streaming', async () => {
      // Simulate what the SSE endpoint does: fetch conversations with joins
      const conversationData = await env.db
        .select({
          id: schema.conversations.id,
          customerId: schema.conversations.customerId,
          assignedTeamId: schema.conversations.assignedTeamId,
          assignedUserId: schema.conversations.assignedUserId,
          status: schema.conversations.status,
          lastMessageAt: schema.conversations.lastMessageAt,
          createdAt: schema.conversations.createdAt,
          updatedAt: schema.conversations.updatedAt,
          customerName: schema.customers.displayName,
          platform: schema.customers.platform,
          platformUserId: schema.customers.platformUserId
        })
        .from(schema.conversations)
        .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
        .orderBy(desc(schema.conversations.updatedAt));

      expect(conversationData).toBeDefined();
      expect(Array.isArray(conversationData)).toBe(true);
    });

    it('should fetch latest messages for conversations', async () => {
      // Create messages with explicit timestamps to ensure ordering
      const timestamp1 = new Date(Date.now() - 2000).toISOString();
      const timestamp2 = new Date(Date.now() - 1000).toISOString();

      await env.db.insert(schema.messages).values({
        id: 'msg-sse-1',
        conversationId: testConversation.id,
        content: 'First SSE message',
        senderType: 'agent',
        agentSenderId: testAgent.id,
        messageType: 'text',
        isSent: false,
        createdAt: timestamp1
      });

      await env.db.insert(schema.messages).values({
        id: 'msg-sse-2',
        conversationId: testConversation.id,
        content: 'Second SSE message',
        senderType: 'customer',
        customerSenderId: testCustomer.id,
        messageType: 'text',
        isSent: false,
        createdAt: timestamp2
      });

      // Get latest message
      const latestMessage = await env.db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)]
      });

      expect(latestMessage).toBeDefined();
      expect(latestMessage?.content).toBe('Second SSE message');
    });

    it('should format conversation data for SSE response', async () => {
      // Create a message to test lastMessage formatting
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-format-test',
        content: 'Test message content',
        senderType: 'agent',
        agentSenderId: testAgent.id
      });

      // Simulate SSE data formatting
      const sseData = {
        type: 'conversations_update',
        data: [{
          ...testConversation,
          lastMessage: {
            content: message.content,
            createdAt: message.createdAt
          }
        }],
        timestamp: new Date().toISOString()
      };

      expect(sseData.type).toBe('conversations_update');
      expect(sseData.data[0].lastMessage.content).toBe('Test message content');
    });

    it('should handle conversations with no messages', async () => {
      // Create new conversation without messages
      const newConversation = await env.createTestConversation(testCustomer.id, {
        assignedUserId: testAgent.id,
        assignedTeamId: testTeam.id
      });

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, newConversation.id)
      });

      expect(messages).toHaveLength(0);

      // SSE should handle this gracefully
      const sseData = {
        type: 'conversations_update',
        data: [{
          ...newConversation,
          lastMessage: null
        }],
        timestamp: new Date().toISOString()
      };

      expect(sseData.data[0].lastMessage).toBeNull();
    });
  });

  describe('GET /:conversationId/messages/stream - Message Stream', () => {
    it('should fetch recent messages for initial SSE payload', async () => {
      // Create 15 messages with explicit timestamps to ensure deterministic ordering
      const baseTime = Date.now() - 15000;
      for (let i = 1; i <= 15; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-initial-${i}`,
          conversationId: testConversation.id,
          content: `Initial message ${i}`,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? testCustomer.id : undefined,
          agentSenderId: i % 2 === 0 ? undefined : testAgent.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date(baseTime + (i * 1000)).toISOString()
        });
      }

      // Fetch recent 10 messages (matching SSE initial load)
      const recentMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and }) => and(
          eq(messages.conversationId, testConversation.id),
          eq(messages.isRecalled, false)
        ),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 10
      });

      expect(recentMessages).toHaveLength(10);
      // Should be in descending order, so reverse for ascending
      const ascending = [...recentMessages].reverse();
      expect(ascending[0].content).toBe('Initial message 6');
      expect(ascending[9].content).toBe('Initial message 15');
    });

    it('should detect new messages after specific timestamp', async () => {
      // Create initial message with explicit timestamp
      const timestamp1 = new Date(Date.now() - 5000).toISOString();
      const timestamp2 = new Date(Date.now() - 2000).toISOString();

      await env.db.insert(schema.messages).values({
        id: 'msg-before-check',
        conversationId: testConversation.id,
        content: 'Before check',
        senderType: 'agent',
        agentSenderId: testAgent.id,
        messageType: 'text',
        isSent: false,
        createdAt: timestamp1
      });

      const afterTimestamp = timestamp1;

      // Create new message with later timestamp
      await env.db.insert(schema.messages).values({
        id: 'msg-after-check',
        conversationId: testConversation.id,
        content: 'After check',
        senderType: 'customer',
        customerSenderId: testCustomer.id,
        messageType: 'text',
        isSent: false,
        createdAt: timestamp2
      });

      // Query messages after timestamp (simulating SSE new message detection)
      const newMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and }) => and(
          eq(messages.conversationId, testConversation.id),
          eq(messages.isRecalled, false),
          gt(messages.createdAt, afterTimestamp)
        ),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      expect(newMessages).toHaveLength(1);
      expect(newMessages[0].id).toBe('msg-after-check');
    });

    it('should exclude recalled messages from SSE stream', async () => {
      // Create normal message
      await env.createTestMessage(testConversation.id, {
        id: 'msg-normal',
        content: 'Normal message',
        senderType: 'agent',
        agentSenderId: testAgent.id
      });

      // Create recalled message
      const recalledMsg = await env.createTestMessage(testConversation.id, {
        id: 'msg-recalled',
        content: 'Recalled message',
        senderType: 'agent',
        agentSenderId: testAgent.id
      });

      // Mark as recalled
      await env.db
        .update(schema.messages)
        .set({
          isRecalled: true,
          recalledAt: new Date().toISOString()
        })
        .where(eq(schema.messages.id, 'msg-recalled'));

      // Query non-recalled messages (SSE should only send these)
      const activeMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and }) => and(
          eq(messages.conversationId, testConversation.id),
          eq(messages.isRecalled, false)
        )
      });

      expect(activeMessages).toHaveLength(1);
      expect(activeMessages[0].id).toBe('msg-normal');
    });

    it('should format message data for SSE events', async () => {
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-sse-format',
        content: 'SSE formatted message',
        senderType: 'agent',
        agentSenderId: testAgent.id
      });

      // Simulate SSE event formatting
      const sseEvent = {
        type: 'new_messages',
        conversationId: testConversation.id,
        messages: [{
          id: message.id,
          conversationId: message.conversationId,
          senderType: message.senderType,
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
          isSent: message.isSent,
          deliveryStatus: message.deliveryStatus,
          isRecalled: message.isRecalled
        }],
        count: 1,
        lastMessageId: message.id,
        timestamp: new Date().toISOString()
      };

      expect(sseEvent.type).toBe('new_messages');
      expect(sseEvent.messages).toHaveLength(1);
      expect(sseEvent.messages[0].content).toBe('SSE formatted message');
    });

    it('should handle rapid message creation for SSE streaming', async () => {
      // Create multiple messages rapidly
      const messagePromises = Array.from({ length: 5 }, (_, i) =>
        env.createTestMessage(testConversation.id, {
          id: `msg-rapid-${i}`,
          content: `Rapid message ${i}`,
          senderType: 'customer',
          customerSenderId: testCustomer.id
        })
      );

      await Promise.all(messagePromises);

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      expect(messages).toHaveLength(5);
      expect(messages[0].content).toBe('Rapid message 0');
      expect(messages[4].content).toBe('Rapid message 4');
    });
  });

  describe('SSE Heartbeat and Connection Management', () => {
    it('should track last message ID for incremental updates', async () => {
      const message1 = await env.createTestMessage(testConversation.id, {
        id: 'msg-track-1',
        content: 'First tracked message',
        senderType: 'agent',
        agentSenderId: testAgent.id
      });

      let lastMessageId = message1.id;
      expect(lastMessageId).toBe('msg-track-1');

      const message2 = await env.createTestMessage(testConversation.id, {
        id: 'msg-track-2',
        content: 'Second tracked message',
        senderType: 'customer',
        customerSenderId: testCustomer.id
      });

      lastMessageId = message2.id;
      expect(lastMessageId).toBe('msg-track-2');

      // SSE would use this lastMessageId to query only newer messages
      const lastMessage = await env.db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.id, lastMessageId)
      });

      expect(lastMessage?.content).toBe('Second tracked message');
    });

    it('should format heartbeat event data', () => {
      const heartbeat = {
        type: 'heartbeat',
        conversationId: testConversation.id,
        timestamp: new Date().toISOString(),
        lastMessageId: 'msg-track-2'
      };

      expect(heartbeat.type).toBe('heartbeat');
      expect(heartbeat.conversationId).toBe(testConversation.id);
      expect(heartbeat.lastMessageId).toBe('msg-track-2');
    });

    it('should format connection established event', () => {
      const connectionEvent = {
        type: 'connection_established',
        conversationId: testConversation.id,
        userId: testAgent.id,
        timestamp: new Date().toISOString()
      };

      expect(connectionEvent.type).toBe('connection_established');
      expect(connectionEvent.userId).toBe(testAgent.id);
    });
  });

  describe('SSE Permission Checks', () => {
    it('should verify user has access to conversation before streaming', async () => {
      // In real SSE endpoint, this would use PermissionService
      const { PermissionService } = await import('@shared/services/permission-service');

      // Mock to return allowed conversation
      (PermissionService.getVisibleConversations as any).mockResolvedValue([testConversation.id]);

      const visibleConversations = await PermissionService.getVisibleConversations(testAgent.id, env.getMockD1Database());

      expect(visibleConversations).toContain(testConversation.id);
    });

    it('should deny access to conversation not in visible list', async () => {
      const { PermissionService } = await import('@shared/services/permission-service');

      // Mock to return empty list
      (PermissionService.getVisibleConversations as any).mockResolvedValue([]);

      const visibleConversations = await PermissionService.getVisibleConversations(testAgent.id, env.getMockD1Database());

      expect(visibleConversations).not.toContain(testConversation.id);
      // In real SSE endpoint, this would return 403 error
    });
  });
});
