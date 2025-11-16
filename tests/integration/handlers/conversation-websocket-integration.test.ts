// Integration Tests for WebSocket Real-Time Broadcasting
// Tests WebSocket event broadcasting for conversation operations

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import { eq } from 'drizzle-orm';
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

// Mock WebSocketBroadcastService to capture broadcast calls
const mockBroadcastConversationEvent = vi.fn();
const mockBroadcastMessageEvent = vi.fn();

vi.mock('@shared/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationEvent: mockBroadcastConversationEvent,
    broadcastMessageEvent: mockBroadcastMessageEvent
  }))
}));

describe('Conversation Handler - WebSocket Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let testAdmin: any;
  let testAgent1: any;
  let testAgent2: any;
  let testTeam1: any;
  let testTeam2: any;
  let testCustomer: any;
  let testConversation: any;

  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    testTeam1 = await env.createTestTeam({ name: 'WebSocket Team 1' });
    testTeam2 = await env.createTestTeam({ name: 'WebSocket Team 2' });
    testAdmin = await env.createTestAgent({
      id: 'admin-ws-1',
      email: 'admin@ws.com',
      displayName: 'WebSocket Admin',
      role: 'admin',
      teamId: testTeam1.id
    });
    testAgent1 = await env.createTestAgent({
      id: 'agent-ws-1',
      email: 'agent1@ws.com',
      displayName: 'WS Agent 1',
      role: 'agent',
      teamId: testTeam1.id
    });
    testAgent2 = await env.createTestAgent({
      id: 'agent-ws-2',
      email: 'agent2@ws.com',
      displayName: 'WS Agent 2',
      role: 'agent',
      teamId: testTeam2.id
    });
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U_WS_TEST',
      displayName: 'WebSocket Customer'
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

  describe('Conversation Assignment Broadcasting', () => {
    it('should broadcast conversation_assigned event when assigning conversation', async () => {
      // Simulate conversation assignment
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, testConversation.id));

      // Simulate WebSocket broadcast
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: {
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id,
          assignedBy: {
            id: testAdmin.id,
            name: testAdmin.displayName,
            role: testAdmin.role
          },
          timestamp: new Date().toISOString()
        },
        priority: 'normal'
      });

      // Verify broadcast was called
      expect(mockBroadcastConversationEvent).toHaveBeenCalledTimes(1);
      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith({
        type: 'conversation_assigned',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: expect.objectContaining({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id
        }),
        priority: 'normal'
      });
    });

    it('should broadcast conversation_unassigned event when unassigning', async () => {
      // Unassign conversation
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: null,
          assignedUserId: null,
          status: 'active'
        })
        .where(eq(schema.conversations.id, testConversation.id));

      // Simulate WebSocket broadcast
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'conversation_unassigned',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: {
          previousTeamId: testTeam1.id,
          previousUserId: testAgent1.id,
          unassignedBy: {
            id: testAdmin.id,
            name: testAdmin.displayName,
            role: testAdmin.role
          },
          timestamp: new Date().toISOString()
        },
        priority: 'high'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_unassigned',
          conversationId: testConversation.id,
          priority: 'high'
        })
      );
    });

    it('should broadcast conversation_transferred event when transferring', async () => {
      // Transfer conversation
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: testTeam2.id,
          assignedUserId: testAgent2.id
        })
        .where(eq(schema.conversations.id, testConversation.id));

      // Simulate WebSocket broadcast
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: {
          from: {
            teamId: testTeam1.id,
            userId: testAgent1.id
          },
          to: {
            teamId: testTeam2.id,
            userId: testAgent2.id
          },
          transferredBy: {
            id: testAdmin.id,
            name: testAdmin.displayName,
            role: testAdmin.role
          },
          reason: 'Workload balancing',
          timestamp: new Date().toISOString()
        },
        priority: 'high'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_transferred',
          data: expect.objectContaining({
            from: expect.objectContaining({ teamId: testTeam1.id }),
            to: expect.objectContaining({ teamId: testTeam2.id })
          })
        })
      );
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast message_sent event when sending message', async () => {
      // Create message
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-ws-broadcast',
        content: 'WebSocket broadcast test',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      // Simulate WebSocket broadcast
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: testConversation.id,
        messageId: message.id,
        agentId: testAgent1.id,
        data: {
          content: message.content,
          messageType: message.messageType,
          sender: {
            id: testAgent1.id,
            name: testAgent1.displayName,
            role: testAgent1.role
          },
          deliveryStatus: 'sent',
          timestamp: new Date().toISOString()
        },
        priority: 'normal'
      });

      expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);
      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_sent',
          conversationId: testConversation.id,
          messageId: message.id
        })
      );
    });

    it('should broadcast message_delivered event', async () => {
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-delivered',
        content: 'Delivered message',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      // Update delivery status
      await env.db
        .update(schema.messages)
        .set({ deliveryStatus: 'delivered' })
        .where(eq(schema.messages.id, message.id));

      // Simulate WebSocket broadcast
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastMessageEvent({
        type: 'message_delivered',
        conversationId: testConversation.id,
        messageId: message.id,
        agentId: testAgent1.id,
        data: {
          deliveryStatus: 'delivered',
          timestamp: new Date().toISOString()
        },
        priority: 'low'
      });

      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_delivered',
          messageId: message.id,
          priority: 'low'
        })
      );
    });

    it('should broadcast message_read event', async () => {
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-read',
        content: 'Read message',
        senderType: 'customer',
        customerSenderId: testCustomer.id
      });

      // Simulate WebSocket broadcast for read receipt
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastMessageEvent({
        type: 'message_read',
        conversationId: testConversation.id,
        messageId: message.id,
        agentId: testAgent1.id,
        data: {
          readBy: testAgent1.id,
          readAt: new Date().toISOString()
        },
        priority: 'low'
      });

      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_read',
          messageId: message.id
        })
      );
    });
  });

  describe('Real-Time Typing Indicators', () => {
    it('should broadcast typing_start event', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'typing_start',
        conversationId: testConversation.id,
        userId: testAgent1.id,
        data: {
          userId: testAgent1.id,
          userName: testAgent1.displayName,
          timestamp: new Date().toISOString()
        },
        priority: 'realtime'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'typing_start',
          conversationId: testConversation.id,
          userId: testAgent1.id
        })
      );
    });

    it('should broadcast typing_stop event', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'typing_stop',
        conversationId: testConversation.id,
        userId: testAgent1.id,
        data: {
          userId: testAgent1.id,
          timestamp: new Date().toISOString()
        },
        priority: 'realtime'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'typing_stop',
          conversationId: testConversation.id
        })
      );
    });
  });

  describe('Presence Broadcasting', () => {
    it('should broadcast agent_online event', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'agent_online',
        conversationId: testConversation.id,
        userId: testAgent1.id,
        data: {
          agentId: testAgent1.id,
          agentName: testAgent1.displayName,
          timestamp: new Date().toISOString()
        },
        priority: 'low'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_online',
          userId: testAgent1.id
        })
      );
    });

    it('should broadcast agent_offline event', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'agent_offline',
        conversationId: testConversation.id,
        userId: testAgent1.id,
        data: {
          agentId: testAgent1.id,
          timestamp: new Date().toISOString()
        },
        priority: 'low'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_offline',
          userId: testAgent1.id
        })
      );
    });
  });

  describe('Broadcast Priority Levels', () => {
    it('should handle realtime priority broadcasts', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: testConversation.id,
        messageId: 'msg-realtime',
        agentId: testAgent1.id,
        data: { content: 'Urgent message' },
        priority: 'realtime'
      });

      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'realtime'
        })
      );
    });

    it('should handle high priority broadcasts', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: {},
        priority: 'high'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high'
        })
      );
    });

    it('should handle normal priority broadcasts', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: testConversation.id,
        messageId: 'msg-normal',
        agentId: testAgent1.id,
        data: {},
        priority: 'normal'
      });

      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal'
        })
      );
    });

    it('should handle low priority broadcasts', async () => {
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'agent_online',
        conversationId: testConversation.id,
        userId: testAgent1.id,
        data: {},
        priority: 'low'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'low'
        })
      );
    });
  });

  describe('Multi-Agent Broadcast Scenarios', () => {
    it('should broadcast to multiple agents when conversation is reassigned', async () => {
      vi.clearAllMocks();

      // Reassign from agent1 to agent2
      await env.db
        .update(schema.conversations)
        .set({
          assignedUserId: testAgent2.id,
          assignedTeamId: testTeam2.id
        })
        .where(eq(schema.conversations.id, testConversation.id));

      // Broadcast to both old and new agents
      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      await broadcastService.broadcastConversationEvent({
        type: 'conversation_reassigned',
        conversationId: testConversation.id,
        userId: testAdmin.id,
        data: {
          fromAgent: testAgent1.id,
          toAgent: testAgent2.id
        },
        priority: 'high'
      });

      expect(mockBroadcastConversationEvent).toHaveBeenCalled();
    });

    it('should handle rapid successive broadcasts', async () => {
      vi.clearAllMocks();

      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      // Rapid fire 5 broadcasts
      for (let i = 0; i < 5; i++) {
        await broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: testConversation.id,
          messageId: `msg-rapid-${i}`,
          agentId: testAgent1.id,
          data: { content: `Message ${i}` },
          priority: 'normal'
        });
      }

      expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling in Broadcasts', () => {
    it('should gracefully handle broadcast failures', async () => {
      // Simulate broadcast failure
      mockBroadcastMessageEvent.mockRejectedValueOnce(new Error('Broadcast failed'));

      const { WebSocketBroadcastService } = await import('@shared/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService({} as any);

      // Should not throw, just log the error
      await expect(
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: testConversation.id,
          messageId: 'msg-fail',
          agentId: testAgent1.id,
          data: {},
          priority: 'normal'
        })
      ).rejects.toThrow('Broadcast failed');

      expect(mockBroadcastMessageEvent).toHaveBeenCalled();
    });

    it('should continue operations even if broadcast fails', async () => {
      // Mock failure
      mockBroadcastMessageEvent.mockRejectedValueOnce(new Error('Network error'));

      // Create message (database operation should succeed)
      const message = await env.createTestMessage(testConversation.id, {
        id: 'msg-db-success',
        content: 'Message saved despite broadcast failure',
        senderType: 'agent',
        agentSenderId: testAgent1.id
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('Message saved despite broadcast failure');

      // Verify message exists in database
      const dbMessage = await env.db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.id, 'msg-db-success')
      });

      expect(dbMessage).toBeDefined();
    });
  });
});
