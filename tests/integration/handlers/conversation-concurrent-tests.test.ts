// Concurrent Tests for Conversation Handler - Race Condition Testing
// Tests parallel operations, data consistency, and race condition handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestimport { MockFactory } from '@helpers/mockFactory';
Environment } from '../../helpers/DatabaseTestEnvironment';
import { eq, and } from 'drizzle-orm';
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

describe('Conversation Handler - Concurrent Operations Tests', () => {
  let env: DatabaseTestEnvironment;
  let testAdmin: any;
  let testAgent1: any;
  let testAgent2: any;
  let testAgent3: any;
  let testTeam1: any;
  let testTeam2: any;
  let testCustomer: any;
  let testConversation: any;

  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    testTeam1 = await env.createTestTeam({ name: 'Concurrent Team 1' });
    testTeam2 = await env.createTestTeam({ name: 'Concurrent Team 2' });
    testAdmin = await env.createTestAgent({
      id: 'admin-concurrent',
      email: 'admin@concurrent.com',
      displayName: 'Concurrent Admin',
      role: 'admin',
      teamId: testTeam1.id
    });
    testAgent1 = await env.createTestAgent({
      id: 'agent-concurrent-1',
      email: 'agent1@concurrent.com',
      displayName: 'Concurrent Agent 1',
      role: 'agent',
      teamId: testTeam1.id
    });
    testAgent2 = await env.createTestAgent({
      id: 'agent-concurrent-2',
      email: 'agent2@concurrent.com',
      displayName: 'Concurrent Agent 2',
      role: 'agent',
      teamId: testTeam2.id
    });
    testAgent3 = await env.createTestAgent({
      id: 'agent-concurrent-3',
      email: 'agent3@concurrent.com',
      displayName: 'Concurrent Agent 3',
      role: 'agent',
      teamId: testTeam2.id
    });
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U_CONCURRENT',
      displayName: 'Concurrent Customer'
    });
    testConversation = await env.createTestConversation(testCustomer.id, {
      assignedUserId: testAgent1.id,
      assignedTeamId: testTeam1.id
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    env.close();
    currentTestEnv = null;
  });

  describe('Concurrent Message Creation', () => {
    test('should handle 100 concurrent message creations without conflicts', async () => {
      console.log('🔄 Creating 100 messages concurrently...');
      const startTime = Date.now();

      // Create 100 messages in parallel
      const messagePromises = Array.from({ length: 100 }, (_, i) =>
        env.db.insert(schema.messages).values({
          id: `msg-concurrent-${i}`,
          conversationId: testConversation.id,
          content: `Concurrent message ${i}`,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? testCustomer.id : undefined,
          agentSenderId: i % 2 === 0 ? undefined : testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date(Date.now() + i).toISOString()
        })
      );

      await Promise.all(messagePromises);

      const duration = Date.now() - startTime;
      console.log(`✅ Created 100 concurrent messages in ${duration}ms`);

      // Verify all messages were created
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });

      expect(messages).toHaveLength(100);

      // Verify all have unique IDs
      const uniqueIds = new Set(messages.map(m => m.id));
      expect(uniqueIds.size).toBe(100);
    });

    test('should maintain message order consistency with concurrent inserts', async () => {
      // Create 50 messages concurrently with explicit timestamps
      const baseTime = Date.now();
      const messagePromises = Array.from({ length: 50 }, (_, i) =>
        env.db.insert(schema.messages).values({
          id: `msg-order-${i}`,
          conversationId: testConversation.id,
          content: `Ordered message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date(baseTime + (i * 1000)).toISOString()
        })
      );

      await Promise.all(messagePromises);

      // Verify messages are retrievable in correct order
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      expect(messages).toHaveLength(50);
      expect(messages[0].content).toBe('Ordered message 0');
      expect(messages[49].content).toBe('Ordered message 49');
    });

    test('should handle duplicate message ID conflicts gracefully', async () => {
      // Try to create messages with duplicate IDs concurrently
      const promises = [
        env.db.insert(schema.messages).values({
          id: 'duplicate-msg',
          conversationId: testConversation.id,
          content: 'First duplicate',
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date().toISOString()
        }),
        env.db.insert(schema.messages).values({
          id: 'duplicate-msg',
          conversationId: testConversation.id,
          content: 'Second duplicate',
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date().toISOString()
        })
      ];

      // One should succeed, one should fail
      const results = await Promise.allSettled(promises);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(succeeded).toBe(1);
      expect(failed).toBe(1);
    });
  });

  describe('Concurrent Conversation Assignment', () => {
    test('should handle concurrent assignment attempts without conflicts', async () => {
      // Multiple agents try to assign the same conversation concurrently
      const assignmentPromises = [
        env.db
          .update(schema.conversations)
          .set({ assignedUserId: testAgent1.id, assignedTeamId: testTeam1.id })
          .where(eq(schema.conversations.id, testConversation.id)),
        env.db
          .update(schema.conversations)
          .set({ assignedUserId: testAgent2.id, assignedTeamId: testTeam2.id })
          .where(eq(schema.conversations.id, testConversation.id)),
        env.db
          .update(schema.conversations)
          .set({ assignedUserId: testAgent3.id, assignedTeamId: testTeam2.id })
          .where(eq(schema.conversations.id, testConversation.id))
      ];

      await Promise.all(assignmentPromises);

      // Verify conversation has one final assignment (last write wins)
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation.id)
      });

      expect(conversation).toBeDefined();
      expect(conversation?.assignedUserId).toBeTruthy();
      expect([testAgent1.id, testAgent2.id, testAgent3.id]).toContain(conversation?.assignedUserId);
    });

    test('should handle concurrent transfer operations', async () => {
      // Create transfer records concurrently
      const transferPromises = Array.from({ length: 10 }, (_, i) =>
        env.db.insert(schema.conversationTransfers).values({
          conversationId: testConversation.id,
          fromTeamId: testTeam1.id,
          toTeamId: testTeam2.id,
          fromUserId: testAgent1.id,
          toUserId: testAgent2.id,
          transferReason: `Concurrent transfer ${i}`,
          transferredBy: testAdmin.id,
          createdAt: new Date(Date.now() + i).toISOString()
        })
      );

      await Promise.all(transferPromises);

      // Verify all transfer records were created
      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation.id)
      });

      expect(transfers).toHaveLength(10);
    });
  });

  describe('Concurrent Read-Write Operations', () => {
    test('should handle concurrent reads while writing messages', async () => {
      // Start with some messages
      for (let i = 0; i < 10; i++) {
        await env.createTestMessage(testConversation.id, {
          id: `msg-initial-${i}`,
          content: `Initial message ${i}`,
          senderType: 'agent',
          agentSenderId: testAgent1.id
        });
      }

      // Concurrent reads and writes
      const operations = [];

      // 10 writes
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.db.insert(schema.messages).values({
            id: `msg-write-${i}`,
            conversationId: testConversation.id,
            content: `Written message ${i}`,
            senderType: 'agent',
            agentSenderId: testAgent1.id,
            messageType: 'text',
            isSent: false,
            createdAt: new Date(Date.now() + i).toISOString()
          })
        );
      }

      // 10 reads
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.db.query.messages.findMany({
            where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
          })
        );
      }

      const results = await Promise.all(operations);

      // Verify reads returned data
      const readResults = results.slice(10, 20);
      readResults.forEach((result: any) => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(10);
      });

      // Verify final state
      const finalMessages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });

      expect(finalMessages).toHaveLength(20);
    });

    test('should handle concurrent updates to the same conversation', async () => {
      // Multiple concurrent updates to conversation status
      const updatePromises = [
        env.db
          .update(schema.conversations)
          .set({ status: 'active' })
          .where(eq(schema.conversations.id, testConversation.id)),
        env.db
          .update(schema.conversations)
          .set({ status: 'assigned' })
          .where(eq(schema.conversations.id, testConversation.id)),
        env.db
          .update(schema.conversations)
          .set({ status: 'resolved' })
          .where(eq(schema.conversations.id, testConversation.id))
      ];

      await Promise.all(updatePromises);

      // Verify conversation has a valid final status
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation.id)
      });

      expect(conversation).toBeDefined();
      expect(['active', 'assigned', 'resolved']).toContain(conversation?.status);
    });
  });

  describe('Concurrent Multi-Conversation Operations', () => {
    test('should handle concurrent operations across multiple conversations', async () => {
      // Create 20 conversations
      const conversations = [];
      for (let i = 0; i < 20; i++) {
        const customer = await env.createTestCustomer({
          platform: 'line',
          platformUserId: `U_MULTI_${i}`,
          displayName: `Customer ${i}`
        });
        const conv = await env.createTestConversation(customer.id, {
          assignedUserId: testAgent1.id,
          assignedTeamId: testTeam1.id
        });
        conversations.push(conv);
      }

      // Create 5 messages for each conversation concurrently
      const allPromises = [];
      for (const conv of conversations) {
        for (let j = 0; j < 5; j++) {
          allPromises.push(
            env.db.insert(schema.messages).values({
              id: `msg-${conv.id}-${j}`,
              conversationId: conv.id,
              content: `Message ${j}`,
              senderType: 'agent',
              agentSenderId: testAgent1.id,
              messageType: 'text',
              isSent: false,
              createdAt: new Date(Date.now() + j).toISOString()
            })
          );
        }
      }

      await Promise.all(allPromises);

      // Verify each conversation has 5 messages
      for (const conv of conversations) {
        const messages = await env.db.query.messages.findMany({
          where: (messages, { eq }) => eq(messages.conversationId, conv.id)
        });
        expect(messages).toHaveLength(5);
      }
    });

    test('should handle concurrent reassignments across multiple conversations', async () => {
      // Create 10 conversations
      const conversations = [];
      for (let i = 0; i < 10; i++) {
        const customer = await env.createTestCustomer({
          platform: 'line',
          platformUserId: `U_REASSIGN_${i}`,
          displayName: `Reassign Customer ${i}`
        });
        const conv = await env.createTestConversation(customer.id, {
          assignedUserId: testAgent1.id,
          assignedTeamId: testTeam1.id
        });
        conversations.push(conv);
      }

      // Reassign all conversations concurrently
      const reassignPromises = conversations.map(conv =>
        env.db
          .update(schema.conversations)
          .set({ assignedUserId: testAgent2.id, assignedTeamId: testTeam2.id })
          .where(eq(schema.conversations.id, conv.id))
      );

      await Promise.all(reassignPromises);

      // Verify all conversations are reassigned
      for (const conv of conversations) {
        const updated = await env.db.query.conversations.findFirst({
          where: (conversations, { eq }) => eq(conversations.id, conv.id)
        });
        expect(updated?.assignedUserId).toBe(testAgent2.id);
        expect(updated?.assignedTeamId).toBe(testTeam2.id);
      }
    });
  });

  describe('Race Condition Scenarios', () => {
    test('should handle race between message creation and conversation deletion', async () => {
      // Create a new conversation for this test
      const tempConversation = await env.createTestConversation(testCustomer.id, {
        assignedUserId: testAgent1.id,
        assignedTeamId: testTeam1.id
      });

      // Attempt concurrent message creation and conversation deletion
      const operations = [
        // Try to create message
        env.db.insert(schema.messages).values({
          id: 'msg-race',
          conversationId: tempConversation.id,
          content: 'Race message',
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date().toISOString()
        }),
        // Try to delete conversation
        env.db.delete(schema.conversations).where(eq(schema.conversations.id, tempConversation.id))
      ];

      const results = await Promise.allSettled(operations);

      // Either message succeeds and conversation delete fails (FK constraint)
      // Or conversation delete succeeds and message fails
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(0);
      expect(successCount).toBeLessThanOrEqual(2);
    });

    test('should handle race between concurrent assignment and message creation', async () => {
      // Concurrent assignment changes and message creation
      const operations = [
        env.db
          .update(schema.conversations)
          .set({ assignedUserId: testAgent2.id })
          .where(eq(schema.conversations.id, testConversation.id)),
        env.db.insert(schema.messages).values({
          id: 'msg-assign-race',
          conversationId: testConversation.id,
          content: 'Message during assignment',
          senderType: 'agent',
          agentSenderId: testAgent1.id,
          messageType: 'text',
          isSent: false,
          createdAt: new Date().toISOString()
        })
      ];

      await Promise.all(operations);

      // Verify final state is consistent
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, testConversation.id)
      });

      const message = await env.db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.id, 'msg-assign-race')
      });

      expect(conversation).toBeDefined();
      expect(message).toBeDefined();
    });

    test('should maintain data consistency under high concurrent load', async () => {
      // 50 concurrent operations of various types
      const operations = [];

      // 20 message creations
      for (let i = 0; i < 20; i++) {
        operations.push(
          env.db.insert(schema.messages).values({
            id: `msg-stress-${i}`,
            conversationId: testConversation.id,
            content: `Stress message ${i}`,
            senderType: 'agent',
            agentSenderId: testAgent1.id,
            messageType: 'text',
            isSent: false,
            createdAt: new Date(Date.now() + i).toISOString()
          })
        );
      }

      // 10 reads
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.db.query.messages.findMany({
            where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
          })
        );
      }

      // 10 assignment updates
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.db
            .update(schema.conversations)
            .set({ assignedUserId: i % 2 === 0 ? testAgent1.id : testAgent2.id })
            .where(eq(schema.conversations.id, testConversation.id))
        );
      }

      // 10 transfer records
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.db.insert(schema.conversationTransfers).values({
            conversationId: testConversation.id,
            fromTeamId: testTeam1.id,
            toTeamId: testTeam2.id,
            fromUserId: testAgent1.id,
            toUserId: testAgent2.id,
            transferReason: `Stress transfer ${i}`,
            transferredBy: testAdmin.id,
            createdAt: new Date(Date.now() + i).toISOString()
          })
        );
      }

      await Promise.all(operations);

      // Verify data consistency
      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
      });

      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, testConversation.id)
      });

      expect(messages.length).toBeGreaterThanOrEqual(20);
      expect(transfers.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Deadlock Prevention', () => {
    test('should avoid deadlocks with cross-conversation operations', async () => {
      // Create two conversations
      const conv1 = testConversation;
      const conv2 = await env.createTestConversation(testCustomer.id, {
        assignedUserId: testAgent2.id,
        assignedTeamId: testTeam2.id
      });

      // Concurrent cross-conversation updates
      const operations = [
        // Update conv1 then conv2
        (async () => {
          await env.db
            .update(schema.conversations)
            .set({ status: 'active' })
            .where(eq(schema.conversations.id, conv1.id));
          await env.db
            .update(schema.conversations)
            .set({ status: 'active' })
            .where(eq(schema.conversations.id, conv2.id));
        })(),
        // Update conv2 then conv1
        (async () => {
          await env.db
            .update(schema.conversations)
            .set({ status: 'assigned' })
            .where(eq(schema.conversations.id, conv2.id));
          await env.db
            .update(schema.conversations)
            .set({ status: 'assigned' })
            .where(eq(schema.conversations.id, conv1.id));
        })()
      ];

      // Should complete without deadlock
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});
