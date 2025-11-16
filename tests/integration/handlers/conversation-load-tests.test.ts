// Load Tests for Conversation Handler - High Volume Data Scenarios
// Tests pagination, querying, and performance with 1000+ messages

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '@backend/db/schema';

let currentTestEnv: DatabaseTestEnvironment | null = null;

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

describe('Conversation Handler - Load Tests (High Volume)', () => {
  let env: DatabaseTestEnvironment;
  let testAgent: any;
  let testTeam: any;
  let testCustomer: any;
  let testConversation: any;

  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    testTeam = await env.createTestTeam({ name: 'Load Test Team' });
    testAgent = await env.createTestAgent({
      id: 'agent-load-1',
      email: 'agent@load.com',
      displayName: 'Load Test Agent',
      role: 'agent',
      teamId: testTeam.id
    });
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U_LOAD_TEST',
      displayName: 'Load Test Customer'
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

  describe('Message Pagination - 1000+ Messages', () => {
    it('should handle pagination with 1000 messages', async () => {
      console.log('🔄 Creating 1000 messages...');
      const startTime = Date.now();

      // Create 1000 messages
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-load-${i}`,
          conversationId: testConversation.id,
          content: `Message ${i}`,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? testCustomer.id : undefined,
          agentSenderId: i % 2 === 0 ? undefined : testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });

        // Log progress every 200 messages
        if (i % 200 === 0) {
          console.log(`  ✓ ${i}/1000 messages created`);
        }
      }

      const createTime = Date.now() - startTime;
      console.log(`✅ Created 1000 messages in ${createTime}ms`);

      // Test pagination - Page 1
      const page1 = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 50
      });

      expect(page1).toHaveLength(50);
      expect(page1[0].content).toBe('Message 1000');
      expect(page1[49].content).toBe('Message 951');

      // Test pagination - Page 10
      const page10 = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 50,
        offset: 450
      });

      expect(page10).toHaveLength(50);
      expect(page10[0].content).toBe('Message 550');

      // Verify total count
      const allMessages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });

      expect(allMessages).toHaveLength(1000);
    });

    it('should handle large page sizes efficiently', async () => {
      // Create 500 messages
      const baseTime = Date.now() - 500000;
      for (let i = 1; i <= 500; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-large-page-${i}`,
          conversationId: testConversation.id,
          content: `Large page message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      const startTime = Date.now();

      // Fetch 100 messages at once
      const largePage = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 100
      });

      const queryTime = Date.now() - startTime;

      expect(largePage).toHaveLength(100);
      expect(queryTime).toBeLessThan(500); // Should complete in <500ms
      console.log(`✅ Fetched 100 messages in ${queryTime}ms`);
    });

    it('should handle deep pagination (offset 900+)', async () => {
      // Create 1000 messages
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-deep-${i}`,
          conversationId: testConversation.id,
          content: `Deep pagination message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      // Deep pagination - offset 950
      const deepPage = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 50,
        offset: 950
      });

      expect(deepPage).toHaveLength(50);
      expect(deepPage[0].content).toBe('Deep pagination message 50');
      expect(deepPage[49].content).toBe('Deep pagination message 1');
    });
  });

  describe('Multiple Conversations - High Volume', () => {
    it('should handle 100 conversations with multiple messages each', async () => {
      console.log('🔄 Creating 100 conversations...');

      const conversations = [];
      for (let i = 1; i <= 100; i++) {
        const customer = await env.createTestCustomer({
          platform: 'line',
          platformUserId: `U_MULTI_${i}`,
          displayName: `Customer ${i}`
        });

        const conversation = await env.createTestConversation(customer.id, {
          assignedUserId: testAgent.id,
          assignedTeamId: testTeam.id
        });

        conversations.push(conversation);

        // Create 10 messages per conversation
        for (let j = 1; j <= 10; j++) {
          await env.db.insert(schema.messages).values({
            id: `msg-conv${i}-msg${j}`,
            conversationId: conversation.id,
            content: `Conv ${i} Msg ${j}`,
            senderType: 'agent',
            agentSenderId: testAgent.id,
            messageType: 'text',
            isSent: true,
            createdAt: new Date(Date.now() - (100 - i) * 1000 - j * 100).toISOString()
          });
        }

        if (i % 20 === 0) {
          console.log(`  ✓ ${i}/100 conversations created`);
        }
      }

      console.log(`✅ Created 100 conversations with 1000 total messages`);

      // Query all conversations
      const allConversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, testTeam.id),
        orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)]
      });

      expect(allConversations.length).toBeGreaterThanOrEqual(100);

      // Verify message count
      const allMessages = await env.db.query.messages.findMany();
      expect(allMessages.length).toBeGreaterThanOrEqual(1000);
    });

    it('should efficiently query latest message for multiple conversations', async () => {
      // Create 50 conversations
      const conversationIds = [];
      for (let i = 1; i <= 50; i++) {
        const customer = await env.createTestCustomer({
          platform: 'line',
          platformUserId: `U_LATEST_${i}`,
          displayName: `Latest Customer ${i}`
        });

        const conversation = await env.createTestConversation(customer.id, {
          assignedUserId: testAgent.id,
          assignedTeamId: testTeam.id
        });

        conversationIds.push(conversation.id);

        // Create 5 messages per conversation
        for (let j = 1; j <= 5; j++) {
          await env.db.insert(schema.messages).values({
            id: `msg-latest-conv${i}-${j}`,
            conversationId: conversation.id,
            content: `Latest Conv ${i} Msg ${j}`,
            senderType: 'agent',
            agentSenderId: testAgent.id,
            messageType: 'text',
            isSent: true,
            createdAt: new Date(Date.now() - (50 - i) * 1000 - (5 - j) * 100).toISOString()
          });
        }
      }

      const startTime = Date.now();

      // Get latest message for each conversation
      const latestMessages: any[] = [];
      for (const convId of conversationIds) {
        const latest = await env.db.query.messages.findFirst({
          where: (messages, { eq }) => eq(messages.conversationId, convId),
          orderBy: (messages, { desc }) => [desc(messages.createdAt)]
        });
        if (latest) {
          latestMessages.push(latest);
        }
      }

      const queryTime = Date.now() - startTime;

      expect(latestMessages).toHaveLength(50);
      console.log(`✅ Fetched latest messages for 50 conversations in ${queryTime}ms`);
    });
  });

  describe('Message Filtering - High Volume', () => {
    it('should filter messages by sender type with 1000+ messages', async () => {
      // Create 1000 messages (500 agent, 500 customer)
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-filter-${i}`,
          conversationId: testConversation.id,
          content: `Filter message ${i}`,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? testCustomer.id : undefined,
          agentSenderId: i % 2 === 0 ? undefined : testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      // Filter agent messages only
      const agentMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and }) => and(
          eq(messages.conversationId, testConversation.id),
          eq(messages.senderType, 'agent')
        )
      });

      expect(agentMessages).toHaveLength(500);

      // Filter customer messages only
      const customerMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and }) => and(
          eq(messages.conversationId, testConversation.id),
          eq(messages.senderType, 'customer')
        )
      });

      expect(customerMessages).toHaveLength(500);
    });

    it('should search messages by content pattern in large dataset', async () => {
      // Create 500 messages with various keywords
      const baseTime = Date.now() - 500000;
      for (let i = 1; i <= 500; i++) {
        const keyword = i % 10 === 0 ? 'IMPORTANT' : 'regular';
        await env.db.insert(schema.messages).values({
          id: `msg-search-${i}`,
          conversationId: testConversation.id,
          content: `${keyword} message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      // Search for "IMPORTANT" messages
      const importantMessages = await env.db.query.messages.findMany({
        where: (messages, { eq, and, like }) => and(
          eq(messages.conversationId, testConversation.id),
          like(messages.content, '%IMPORTANT%')
        )
      });

      expect(importantMessages).toHaveLength(50); // Every 10th message
    });
  });

  describe('Performance Benchmarks', () => {
    it('should fetch first page of messages in <100ms', async () => {
      // Create 1000 messages
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-perf-${i}`,
          conversationId: testConversation.id,
          content: `Performance message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      // Benchmark first page query
      const startTime = Date.now();

      const firstPage = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 30
      });

      const queryTime = Date.now() - startTime;

      expect(firstPage).toHaveLength(30);
      expect(queryTime).toBeLessThan(100);
      console.log(`✅ First page query: ${queryTime}ms`);
    });

    it('should count total messages efficiently', async () => {
      // Create 2000 messages
      const baseTime = Date.now() - 2000000;
      for (let i = 1; i <= 2000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-count-${i}`,
          conversationId: testConversation.id,
          content: `Count message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });

        if (i % 500 === 0) {
          console.log(`  ✓ ${i}/2000 messages created`);
        }
      }

      const startTime = Date.now();

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });
      const count = messages.length;

      const countTime = Date.now() - startTime;

      expect(count).toBe(2000);
      expect(countTime).toBeLessThan(500);
      console.log(`✅ Count 2000 messages: ${countTime}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle iterative message processing without memory issues', async () => {
      // Create 1000 messages
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-memory-${i}`,
          conversationId: testConversation.id,
          content: `Memory test message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      // Process in batches of 100
      const batchSize = 100;
      let processedCount = 0;

      for (let offset = 0; offset < 1000; offset += batchSize) {
        const batch = await env.db.query.messages.findMany({
          where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
          limit: batchSize,
          offset: offset
        });

        processedCount += batch.length;
      }

      expect(processedCount).toBe(1000);
    });
  });

  describe('Conversation Assignment with High Message Volume', () => {
    it('should reassign conversation with 1000+ messages efficiently', async () => {
      // Create second agent
      const agent2 = await env.createTestAgent({
        id: 'agent-load-2',
        email: 'agent2@load.com',
        displayName: 'Load Test Agent 2',
        role: 'agent',
        teamId: testTeam.id
      });

      // Create 1000 messages
      const baseTime = Date.now() - 1000000;
      for (let i = 1; i <= 1000; i++) {
        await env.db.insert(schema.messages).values({
          id: `msg-reassign-${i}`,
          conversationId: testConversation.id,
          content: `Reassign message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent.id,
          messageType: 'text',
          isSent: true,
          createdAt: new Date(baseTime + (i * 100)).toISOString()
        });
      }

      const startTime = Date.now();

      // Reassign conversation
      await env.db
        .update(schema.conversations)
        .set({ assignedUserId: agent2.id })
        .where(eq(schema.conversations.id, testConversation.id));

      const updateTime = Date.now() - startTime;

      expect(updateTime).toBeLessThan(100);
      console.log(`✅ Reassigned conversation with 1000 messages in ${updateTime}ms`);

      // Verify reassignment
      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation.id)
      });

      expect(updated?.assignedUserId).toBe(agent2.id);

      // Verify all messages are still accessible
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });

      expect(messages).toHaveLength(1000);
    });
  });
});
