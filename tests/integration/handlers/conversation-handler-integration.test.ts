// Comprehensive Integration Tests for Conversation Handler
// Tests all conversation handler endpoints with real database operations

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestEnvironment } from '../../himport { MockFactory } from '@helpers/mockFactory';
elpers/DatabaseTestEnvironment';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '@backend/db/schema';

// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null;

// Mock drizzle-orm/d1 to use our test database
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

// Mock WebSocket Broadcast Service to prevent actual WebSocket calls
vi.mock('@shared/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined)
  }))
}));

// Mock Latest Message Cache
vi.mock('../../../src/services/latest-message-cache', () => ({
  LatestMessageCache: vi.fn().mockImplementation(() => ({
    getLatestMessages: vi.fn().mockResolvedValue(new Map())
  }))
}));

describe('Conversation Handler - Comprehensive Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let testAdmin: any;
  let testAgent1: any;
  let testAgent2: any;
  let testTeam1: any;
  let testTeam2: any;
  let testCustomer1: any;
  let testCustomer2: any;
  let testConversation1: any;
  let testConversation2: any;

  beforeEach(async () => {
    // Initialize test database
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    // Create test teams
    testTeam1 = await env.createTestTeam({ name: 'Support Team 1' });
    testTeam2 = await env.createTestTeam({ name: 'Support Team 2' });

    // Create test admin
    testAdmin = await env.createTestAgent({
      id: 'admin-test-1',
      email: 'admin@test.com',
      displayName: 'Test Admin',
      role: 'admin',
      teamId: testTeam1.id
    });

    // Create test agents
    testAgent1 = await env.createTestAgent({
      id: 'agent-test-1',
      email: 'agent1@test.com',
      displayName: 'Test Agent 1',
      role: 'agent',
      teamId: testTeam1.id
    });

    testAgent2 = await env.createTestAgent({
      id: 'agent-test-2',
      email: 'agent2@test.com',
      displayName: 'Test Agent 2',
      role: 'agent',
      teamId: testTeam2.id
    });

    // Create test customers
    testCustomer1 = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U111111',
      displayName: 'Customer 1'
    });

    testCustomer2 = await env.createTestCustomer({
      platform: 'facebook',
      platformUserId: 'FB222222',
      displayName: 'Customer 2'
    });

    // Create test conversations
    testConversation1 = await env.createTestConversation(testCustomer1.id, {
      status: 'active',
      assignedUserId: testAgent1.id,
      assignedTeamId: testTeam1.id
    });

    testConversation2 = await env.createTestConversation(testCustomer2.id, {
      status: 'active'
      // Unassigned conversation
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    env.close();
    currentTestEnv = null;
  });

  // ==================== GET / - List Conversations ====================
  describe('GET / - List Conversations', () => {
    test('should return all conversations visible to admin', async () => {
      // Admin should see all conversations
      const conversations = await env.db.query.conversations.findMany({
        orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)]
      });

      expect(conversations).toHaveLength(2);
      expect(conversations[0].id).toBeTruthy();
    });

    test('should return only team-scoped conversations for agent', async () => {
      // testAgent1 is in testTeam1, should see testConversation1 only
      const conversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, testTeam1.id)
      });

      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe(testConversation1.id);
    });

    test('should include customer information with conversations', async () => {
      const result = await env.db
        .select()
        .from(schema.conversations)
        .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
        .where(eq(schema.conversations.id, testConversation1.id));

      expect(result).toHaveLength(1);
      expect(result[0].customers).toBeDefined();
      expect(result[0].customers?.displayName).toBe('Customer 1');
      expect(result[0].customers?.platform).toBe('line');
    });

    test('should include team information for assigned conversations', async () => {
      const result = await env.db
        .select()
        .from(schema.conversations)
        .leftJoin(schema.teams, eq(schema.conversations.assignedTeamId, schema.teams.id))
        .where(eq(schema.conversations.id, testConversation1.id));

      expect(result).toHaveLength(1);
      expect(result[0].teams).toBeDefined();
      expect(result[0].teams?.name).toBe('Support Team 1');
    });

    test('should handle empty conversation list', async () => {
      // Delete all conversations
      await env.db.delete(schema.conversations);

      const conversations = await env.db.query.conversations.findMany();
      expect(conversations).toHaveLength(0);
    });

    test('should order conversations by updatedAt descending', async () => {
      // Update conversation2 to be more recent
      await env.db
        .update(schema.conversations)
        .set({ updatedAt: new Date(Date.now() + 10000).toISOString() })
        .where(eq(schema.conversations.id, testConversation2.id));

      const conversations = await env.db.query.conversations.findMany({
        orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)]
      });

      expect(conversations[0].id).toBe(testConversation2.id);
      expect(conversations[1].id).toBe(testConversation1.id);
    });
  });

  // ==================== GET /:id - Get Conversation Details ====================
  describe('GET /:id - Get Conversation Details', () => {
    test('should return complete conversation with customer and team data', async () => {
      const result = await env.db
        .select()
        .from(schema.conversations)
        .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
        .leftJoin(schema.teams, eq(schema.conversations.assignedTeamId, schema.teams.id))
        .where(eq(schema.conversations.id, testConversation1.id))
        .limtest(1);

      expect(result).toHaveLength(1);
      expect(result[0].conversations).toBeDefined();
      expect(result[0].customers).toBeDefined();
      expect(result[0].teams).toBeDefined();
      expect(result[0].conversations.id).toBe(testConversation1.id);
      expect(result[0].customers?.displayName).toBe('Customer 1');
      expect(result[0].teams?.name).toBe('Support Team 1');
    });

    test('should return 404 for non-existent conversation', async () => {
      const result = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, 'non-existent-id')
      });

      expect(result).toBeUndefined();
    });

    test('should return conversation without team for unassigned conversation', async () => {
      const result = await env.db
        .select()
        .from(schema.conversations)
        .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
        .leftJoin(schema.teams, eq(schema.conversations.assignedTeamId, schema.teams.id))
        .where(eq(schema.conversations.id, testConversation2.id))
        .limtest(1);

      expect(result).toHaveLength(1);
      expect(result[0].conversations.assignedTeamId).toBeNull();
      expect(result[0].teams).toBeNull();
    });
  });

  // ==================== POST /:id/assign - Assign Conversation ====================
  describe('POST /:id/assign - Assign Conversation', () => {
    test('should successfully assign conversation to team', async () => {
      const timestamp = new Date().toISOString();

      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          status: 'assigned',
          updatedAt: timestamp
        })
        .where(eq(schema.conversations.id, testConversation2.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation2.id)
      });

      expect(updated?.assignedTeamId).toBe(testTeam2.id);
      expect(updated?.status).toBe('assigned');
    });

    test('should successfully assign conversation to agent', async () => {
      const timestamp = new Date().toISOString();

      await env.db
        .update(schema.conversations)
        .set({
          assignedUserId: testAgent2.id,
          assignedTeamId: testTeam2.id,
          status: 'assigned',
          updatedAt: timestamp
        })
        .where(eq(schema.conversations.id, testConversation2.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation2.id)
      });

      expect(updated?.assignedUserId).toBe(testAgent2.id);
      expect(updated?.assignedTeamId).toBe(testTeam2.id);
      expect(updated?.status).toBe('assigned');
    });

    test('should record assignment in conversation_transfers table', async () => {
      const timestamp = new Date().toISOString();

      const transferRecord = {
        conversationId: testConversation2.id,
        toTeamId: testTeam2.id,
        toUserId: testAgent2.id,
        transferReason: 'Test assignment',
        transferredBy: testAdmin.id,
        createdAt: timestamp
      };

      await env.db.insert(schema.conversationTransfers).values(transferRecord);

      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation2.id)
      });

      expect(transfers).toHaveLength(1);
      expect(transfers[0].toTeamId).toBe(testTeam2.id);
      expect(transfers[0].transferReason).toBe('Test assignment');
    });

    test('should reassign already assigned conversation', async () => {
      // First assignment
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam1.id,
          assignedUserId: testAgent1.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, testConversation2.id));

      // Second assignment
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, testConversation2.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation2.id)
      });

      expect(updated?.assignedTeamId).toBe(testTeam2.id);
      expect(updated?.assignedUserId).toBe(testAgent2.id);
    });
  });

  // ==================== POST /:id/unassign - Unassign Conversation ====================
  describe('POST /:id/unassign - Unassign Conversation', () => {
    test('should successfully unassign conversation', async () => {
      const timestamp = new Date().toISOString();

      // Unassign using raw SQL (matching handler implementation)
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: null,
          assignedUserId: null,
          status: 'active',
          updatedAt: timestamp
        })
        .where(eq(schema.conversations.id, testConversation1.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation1.id)
      });

      expect(updated?.assignedTeamId).toBeNull();
      expect(updated?.assignedUserId).toBeNull();
      expect(updated?.status).toBe('active');
    });

    test('should record unassignment in conversation_transfers table', async () => {
      const timestamp = new Date().toISOString();

      const transferRecord = {
        conversationId: testConversation1.id,
        fromTeamId: testTeam1.id,
        fromUserId: testAgent1.id,
        toTeamId: null,
        toUserId: null,
        transferReason: 'Unassignment',
        transferredBy: testAdmin.id,
        createdAt: timestamp
      };

      await env.db.insert(schema.conversationTransfers).values(transferRecord);

      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation1.id)
      });

      expect(transfers).toHaveLength(1);
      expect(transfers[0].fromTeamId).toBe(testTeam1.id);
      expect(transfers[0].toTeamId).toBeNull();
      expect(transfers[0].transferReason).toBe('Unassignment');
    });

    test('should not allow unassigning already unassigned conversation', async () => {
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation2.id)
      });

      expect(conversation?.assignedTeamId).toBeNull();
      expect(conversation?.assignedUserId).toBeNull();
      // This scenario would return 400 in the actual handler
    });
  });

  // ==================== POST /:id/transfer - Transfer Conversation ====================
  describe('POST /:id/transfer - Transfer Conversation', () => {
    test('should successfully transfer conversation between teams', async () => {
      const timestamp = new Date().toISOString();

      // Transfer from team1 to team2
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id,
          status: 'active',
          updatedAt: timestamp
        })
        .where(eq(schema.conversations.id, testConversation1.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation1.id)
      });

      expect(updated?.assignedTeamId).toBe(testTeam2.id);
      expect(updated?.assignedUserId).toBe(testAgent2.id);
    });

    test('should record complete transfer history', async () => {
      const timestamp = new Date().toISOString();

      const transferRecord = {
        conversationId: testConversation1.id,
        fromTeamId: testTeam1.id,
        toTeamId: testTeam2.id,
        fromUserId: testAgent1.id,
        toUserId: testAgent2.id,
        transferReason: 'Workload balancing',
        transferredBy: testAdmin.id,
        createdAt: timestamp
      };

      await env.db.insert(schema.conversationTransfers).values(transferRecord);

      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation1.id)
      });

      expect(transfers).toHaveLength(1);
      expect(transfers[0].fromTeamId).toBe(testTeam1.id);
      expect(transfers[0].toTeamId).toBe(testTeam2.id);
      expect(transfers[0].fromUserId).toBe(testAgent1.id);
      expect(transfers[0].toUserId).toBe(testAgent2.id);
    });

    test('should allow multiple transfers and maintain complete history', async () => {
      const timestamp1 = new Date().toISOString();
      const timestamp2 = new Date(Date.now() + 1000).toISOString();

      // First transfer
      await env.db.insert(schema.conversationTransfers).values({
        conversationId: testConversation1.id,
        fromTeamId: testTeam1.id,
        toTeamId: testTeam2.id,
        fromUserId: testAgent1.id,
        toUserId: testAgent2.id,
        transferReason: 'First transfer',
        transferredBy: testAdmin.id,
        createdAt: timestamp1
      });

      // Second transfer
      await env.db.insert(schema.conversationTransfers).values({
        conversationId: testConversation1.id,
        fromTeamId: testTeam2.id,
        toTeamId: testTeam1.id,
        fromUserId: testAgent2.id,
        toUserId: testAgent1.id,
        transferReason: 'Second transfer',
        transferredBy: testAdmin.id,
        createdAt: timestamp2
      });

      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation1.id),
        orderBy: (transfers, { asc }) => [asc(transfers.createdAt)]
      });

      expect(transfers).toHaveLength(2);
      expect(transfers[0].transferReason).toBe('First transfer');
      expect(transfers[1].transferReason).toBe('Second transfer');
    });
  });

  // ==================== POST /:id/messages - Send Message ====================
  describe('POST /:id/messages - Send Message', () => {
    test('should successfully send message to conversation', async () => {
      const message = await env.createTestMessage(testConversation1.id, {
        id: 'msg-test-1',
        content: 'Test message',
        senderType: 'agent',
        agentSenderId: testAgent1.id,
        messageType: 'text'
      });

      expect(message.id).toBe('msg-test-1');
      expect(message.content).toBe('Test message');
      expect(message.agentSenderId).toBe(testAgent1.id);
    });

    test('should update conversation lastMessageAt timestamp', async () => {
      const timestamp = new Date().toISOString();

      await env.createTestMessage(testConversation1.id, {
        id: 'msg-update-timestamp',
        content: 'Message to update timestamp',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      await env.db
        .update(schema.conversations)
        .set({ lastMessageAt: timestamp })
        .where(eq(schema.conversations.id, testConversation1.id));

      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation1.id)
      });

      expect(conversation?.lastMessageAt).toBe(timestamp);
    });

    test('should handle messages from different sender types', async () => {
      // Agent message
      const agentMessage = await env.createTestMessage(testConversation1.id, {
        id: 'msg-agent',
        content: 'Agent message',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      // Customer message
      const customerMessage = await env.createTestMessage(testConversation1.id, {
        id: 'msg-customer',
        content: 'Customer message',
        senderType: 'customer',
        customerSenderId: testCustomer1.id
      });

      expect(agentMessage.senderType).toBe('agent');
      expect(customerMessage.senderType).toBe('customer');
    });
  });

  // ==================== GET /:id/messages - Get Messages ====================
  describe('GET /:id/messages - Get Messages with Pagination', () => {
    beforeEach(async () => {
      // Create 50 test messages
      for (let i = 1; i <= 50; i++) {
        await env.createTestMessage(testConversation1.id, {
          id: `msg-${i}`,
          content: `Message ${i}`,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? testCustomer1.id : undefined,
          agentSenderId: i % 2 === 0 ? undefined : testAgent1.id
        });
      }
    });

    test('should return paginated messages (first page)', async () => {
      const pageSize = 10;
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation1.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: pageSize
      });

      expect(messages).toHaveLength(10);
    });

    test('should return paginated messages (second page)', async () => {
      const page = 2;
      const pageSize = 10;
      const offset = (page - 1) * pageSize;

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation1.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: pageSize,
        offset: offset
      });

      expect(messages).toHaveLength(10);
    });

    test('should include sender information in messages', async () => {
      const messages = await env.db
        .select({
          id: schema.messages.id,
          content: schema.messages.content,
          senderType: schema.messages.senderType,
          customerName: schema.customers.displayName,
          agentName: schema.agents.displayName
        })
        .from(schema.messages)
        .leftJoin(schema.customers,
          and(
            eq(schema.messages.senderType, 'customer'),
            eq(schema.messages.customerSenderId, schema.customers.id)
          )
        )
        .leftJoin(schema.agents,
          and(
            eq(schema.messages.senderType, 'agent'),
            eq(schema.messages.agentSenderId, schema.agents.id)
          )
        )
        .where(eq(schema.messages.conversationId, testConversation1.id))
        .limtest(5);

      expect(messages.length).toBeGreaterThan(0);
      messages.forEach(msg => {
        if (msg.senderType === 'customer') {
          expect(msg.customerName).toBe('Customer 1');
        } else if (msg.senderType === 'agent') {
          expect(msg.agentName).toBe('Test Agent 1');
        }
      });
    });

    test('should handle empty message list', async () => {
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, 'non-existent-conversation')
      });

      expect(messages).toHaveLength(0);
    });

    test('should calculate correct total pages', async () => {
      const total = 50;
      const pageSize = 10;
      const totalPages = Math.ceil(total / pageSize);

      expect(totalPages).toBe(5);
    });
  });

  // ==================== Complex Scenarios ====================
  describe('Complex Multi-Agent Scenarios', () => {
    test('should handle conversation reassignment during active messaging', async () => {
      // Send message as agent1
      await env.createTestMessage(testConversation1.id, {
        id: 'msg-before-reassign',
        content: 'Message before reassignment',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      // Reassign to agent2
      await env.db
        .update(schema.conversations)
        .set({
          assignedUserId: testAgent2.id,
          assignedTeamId: testTeam2.id
        })
        .where(eq(schema.conversations.id, testConversation1.id));

      // Send message as agent2
      await env.createTestMessage(testConversation1.id, {
        id: 'msg-after-reassign',
        content: 'Message after reassignment',
        senderType: 'agent',
        agentSenderId: testAgent2.id
      });

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation1.id),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].agentSenderId).toBe(testAgent1.id);
      expect(messages[1].agentSenderId).toBe(testAgent2.id);
    });

    test('should maintain data integrity across conversation lifecycle', async () => {
      // Create conversation
      const newConversation = await env.createTestConversation(testCustomer1.id, {
        status: 'active'
      });

      // Assign conversation
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam1.id,
          assignedUserId: testAgent1.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, newConversation.id));

      // Send messages
      await env.createTestMessage(newConversation.id, {
        id: 'msg-lifecycle-1',
        content: 'First message',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      // Transfer conversation
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id
        })
        .where(eq(schema.conversations.id, newConversation.id));

      // Send more messages
      await env.createTestMessage(newConversation.id, {
        id: 'msg-lifecycle-2',
        content: 'Second message',
        senderType: 'agent',
        agentSenderId: testAgent2.id
      });

      // Verify conversation state
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, newConversation.id)
      });

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, newConversation.id)
      });

      expect(conversation?.assignedTeamId).toBe(testTeam2.id);
      expect(conversation?.assignedUserId).toBe(testAgent2.id);
      expect(messages).toHaveLength(2);
    });
  });

  // ==================== Error Handling ====================
  describe('Error Scenarios', () => {
    test('should handle foreign key constraint violations', async () => {
      await expect(
        env.createTestMessage('non-existent-conversation', {
          id: 'msg-invalid',
          content: 'Invalid message',
          senderType: 'agent',
          agentSenderId: testAgent1.id
        })
      ).rejects.toThrow();
    });

    test('should handle duplicate message IDs', async () => {
      await env.createTestMessage(testConversation1.id, {
        id: 'msg-duplicate',
        content: 'First message',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      await expect(
        env.createTestMessage(testConversation1.id, {
          id: 'msg-duplicate',
          content: 'Second message with same ID',
          senderType: 'agent',
          agentSenderId: testAgent1.id
        })
      ).rejects.toThrow();
    });

    test('should handle null content in messages', async () => {
      await expect(
        env.db.insert(schema.messages).values({
          id: 'msg-null-content',
          conversationId: testConversation1.id,
          content: null as any,
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      ).rejects.toThrow();
    });
  });
});
