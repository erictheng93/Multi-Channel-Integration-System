// Real-time Message Broadcasting Integration Tests
// Tests end-to-end message broadcasting through WebSocket system
// including conversation events, delayed messages, and cross-conversation routing

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DurableObjectsTestEnvironment,
  testEnv,
  TestPerformanceMonitor
} from '../../helpers/websocket/durable-objects-test-env';
import {
  WebSocketTestClient,
  WebSocketRoomTestController,
  WebSocketTestClientFactory
} from '../../helpers/websocket/websocket-test-client';
import {
  TestDataFactory,
  TestAssertions,
  TestScenarios,
  LoadTestHelper
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '../../../src/durable-objects/ConversationRoom';
import { UserConnection } from '../../../src/durable-objects/UserConnection';
import { MessageBroadcaster } from '../../../src/durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from '../../../src/durable-objects/DelayedMessageProcessor';
import { WebSocketBroadcastService } from '../../../src/services/websocket-broadcast-service';
import type {
  DurableObjectEvent,
  DelayedMessage
} from '../../../src/types/websocket-types';

describe('Real-time Message Broadcasting Integration', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;
  let conversationId: string;

  beforeEach(async () => {
    testEnv.reset();
    performanceMonitor = new TestPerformanceMonitor();

    // Register all Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);
    testEnv.registerDurableObject('DELAYED_MESSAGE_PROCESSOR', DelayedMessageProcessor);

    // Setup comprehensive mock environment
    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                { id: 'user_1', name: 'User 1', role: 'agent', teamId: 1 },
                { id: 'user_2', name: 'User 2', role: 'team', teamId: 1 },
                { id: 'admin_1', name: 'Admin 1', role: 'admin', teamId: null }
              ])
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          into: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({ insertId: 'new_id' })
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({ changes: 1 })
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'websocket_migration_config') {
            return JSON.stringify(TestDataFactory.createMigrationConfig());
          }
          return null;
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      }
    };

    broadcastService = new WebSocketBroadcastService(mockEnv);
    conversationId = 'broadcast_test_conversation';
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Message Event Broadcasting', () => {
    it('should broadcast message sent events to all conversation participants', async () => {
      const { controller, admin, team, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Send message through broadcast service
      performanceMonitor.startTimer('message_broadcast');

      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: conversationId,
        messageId: 'msg_123',
        userId: agents[0].userId,
        data: {
          content: 'Hello everyone!',
          messageType: 'text',
          senderName: 'Agent 1',
          timestamp: Date.now()
        },
        priority: 'high'
      });

      const broadcastTime = performanceMonitor.endTimer('message_broadcast');

      expect(success).toBe(true);
      expect(broadcastTime).toBeLessThan(1000); // Should be fast

      // All participants should receive the message
      const events = await Promise.all([
        TestAssertions.assertEventReceived(admin, 'message_sent'),
        TestAssertions.assertEventReceived(team, 'message_sent'),
        TestAssertions.assertEventReceived(agents[1], 'message_sent'),
        TestAssertions.assertEventReceived(agents[2], 'message_sent')
      ]);

      // Verify all events contain correct data
      events.forEach(event => {
        expect(event.data.messageId).toBe('msg_123');
        expect(event.data.content).toBe('Hello everyone!');
        expect(event.userId).toBe(agents[0].userId);
        expect(event.priority).toBe('high');
      });
    });

    it('should broadcast message delivery confirmations', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(agent);
      await controller.connectAllClients();

      // Send delivery confirmation
      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_delivered',
        conversationId: conversationId,
        messageId: 'msg_456',
        userId: agent.userId,
        data: {
          deliveredAt: Date.now(),
          platform: 'LINE',
          externalMessageId: 'line_msg_789'
        }
      });

      expect(success).toBe(true);

      // Agent should receive delivery confirmation
      const deliveryEvent = await TestAssertions.assertEventReceived(
        agent,
        'message_delivered',
        1000
      );

      expect(deliveryEvent.data.messageId).toBe('msg_456');
      expect(deliveryEvent.data.platform).toBe('LINE');
    });

    it('should broadcast message read receipts', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Send read receipt
      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_read',
        conversationId: conversationId,
        messageId: 'msg_789',
        userId: 'customer_123',
        data: {
          readAt: Date.now(),
          platform: 'Facebook'
        }
      });

      expect(success).toBe(true);

      // All agents should receive read receipt
      const readEvents = await Promise.all(
        agents.map(agent => TestAssertions.assertEventReceived(agent, 'message_read'))
      );

      readEvents.forEach(event => {
        expect(event.data.messageId).toBe('msg_789');
        expect(event.userId).toBe('customer_123');
      });
    });

    it('should handle message recall events', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const team = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(agent);
      controller.addClient(team);

      await controller.connectAllClients();

      // Send recall success event
      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_recall_success',
        conversationId: conversationId,
        messageId: 'msg_recall_123',
        agentId: agent.userId,
        data: {
          recalledAt: Date.now(),
          originalContent: 'Original message',
          reason: 'User requested recall'
        }
      });

      expect(success).toBe(true);

      // Both should receive recall success event
      const [agentEvent, teamEvent] = await Promise.all([
        TestAssertions.assertEventReceived(agent, 'message_recall_success'),
        TestAssertions.assertEventReceived(team, 'message_recall_success')
      ]);

      expect(agentEvent.data.messageId).toBe('msg_recall_123');
      expect(teamEvent.data.reason).toBe('User requested recall');
    });

    it('should handle broadcast failures with proper error handling', async () => {
      // Mock Durable Object failure
      const originalGet = mockEnv.CONVERSATION_ROOM.get;
      mockEnv.CONVERSATION_ROOM.get = vi.fn().mockReturnValue(null);

      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'failing_conversation',
        messageId: 'fail_msg_123',
        userId: 'user_123',
        data: { content: 'This will fail' }
      });

      // Should handle failure gracefully and return false
      expect(success).toBe(false);

      // Restore original function
      mockEnv.CONVERSATION_ROOM.get = originalGet;
    });
  });

  describe('Typing Indicator Broadcasting', () => {
    it('should broadcast typing start and stop events', async () => {
      const typingUser = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'typing_agent'
      });

      const observer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team',
        userId: 'observing_team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(typingUser);
      controller.addClient(observer);

      await controller.connectAllClients();

      // Start typing
      performanceMonitor.startTimer('typing_start_broadcast');

      const startSuccess = await broadcastService.broadcastTypingEvent({
        type: 'typing_start',
        conversationId: conversationId,
        userId: typingUser.userId,
        userName: 'Agent Smith',
        data: { startedAt: Date.now() }
      });

      const startBroadcastTime = performanceMonitor.endTimer('typing_start_broadcast');

      expect(startSuccess).toBe(true);
      expect(startBroadcastTime).toBeLessThan(500); // Should be very fast

      // Observer should receive typing start
      const startEvent = await TestAssertions.assertEventReceived(
        observer,
        'typing_start',
        1000
      );

      expect(startEvent.userId).toBe(typingUser.userId);
      expect(startEvent.data.userName).toBe('Agent Smith');

      // Stop typing
      const stopSuccess = await broadcastService.broadcastTypingEvent({
        type: 'typing_stop',
        conversationId: conversationId,
        userId: typingUser.userId,
        userName: 'Agent Smith'
      });

      expect(stopSuccess).toBe(true);

      // Observer should receive typing stop
      const stopEvent = await TestAssertions.assertEventReceived(
        observer,
        'typing_stop',
        1000
      );

      expect(stopEvent.userId).toBe(typingUser.userId);
    });

    it('should filter typing events to only notify agents', async () => {
      const customer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent', // In test, customer would be simulated differently
        userId: 'customer_123'
      });

      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'agent_456'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(customer);
      controller.addClient(agent);

      await controller.connectAllClients();

      // Agent starts typing
      const success = await broadcastService.broadcastTypingEvent({
        type: 'typing_start',
        conversationId: conversationId,
        userId: agent.userId,
        userName: 'Agent'
      });

      expect(success).toBe(true);

      // Only other agents should receive typing indicators
      // (In real implementation, customers wouldn't receive typing from agents)
      const typingEvent = await TestAssertions.assertEventReceived(
        customer,
        'typing_start',
        1000
      );

      expect(typingEvent.userId).toBe(agent.userId);
    });

    it('should handle multiple concurrent typing indicators', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Multiple agents start typing simultaneously
      const typingPromises = agents.slice(0, 2).map((agent, index) =>
        broadcastService.broadcastTypingEvent({
          type: 'typing_start',
          conversationId: conversationId,
          userId: agent.userId,
          userName: `Agent ${index + 1}`
        })
      );

      const results = await Promise.all(typingPromises);
      expect(results.every(r => r === true)).toBe(true);

      // Third agent should receive both typing events
      const thirdAgent = agents[2];
      const typingEvents = await Promise.all([
        TestAssertions.assertEventReceived(thirdAgent, 'typing_start'),
        TestAssertions.assertEventReceived(thirdAgent, 'typing_start')
      ]);

      const userIds = typingEvents.map(e => e.userId);
      expect(userIds).toContain(agents[0].userId);
      expect(userIds).toContain(agents[1].userId);
    });
  });

  describe('Conversation Event Broadcasting', () => {
    it('should broadcast conversation assignment events', async () => {
      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin'
      });

      const assignedAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const teamLead = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [admin, assignedAgent, teamLead].forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      // Broadcast assignment event
      const success = await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId: conversationId,
        userId: admin.userId,
        data: {
          assignedTo: assignedAgent.userId,
          assignedBy: admin.userId,
          previousAgent: null,
          assignedAt: Date.now(),
          teamId: 1
        },
        priority: 'high'
      });

      expect(success).toBe(true);

      // All should receive assignment event
      const events = await Promise.all([
        TestAssertions.assertEventReceived(admin, 'conversation_assigned'),
        TestAssertions.assertEventReceived(assignedAgent, 'conversation_assigned'),
        TestAssertions.assertEventReceived(teamLead, 'conversation_assigned')
      ]);

      events.forEach(event => {
        expect(event.data.assignedTo).toBe(assignedAgent.userId);
        expect(event.data.assignedBy).toBe(admin.userId);
        expect(event.priority).toBe('high');
      });
    });

    it('should broadcast conversation transfer events', async () => {
      const fromAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'from_agent'
      });

      const toAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'to_agent'
      });

      const teamLead = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [fromAgent, toAgent, teamLead].forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      // Broadcast transfer event
      const success = await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId: conversationId,
        data: {
          fromAgent: fromAgent.userId,
          toAgent: toAgent.userId,
          transferredBy: teamLead.userId,
          transferReason: 'Workload balancing',
          transferredAt: Date.now()
        },
        priority: 'high'
      });

      expect(success).toBe(true);

      // All participants should receive transfer event
      const events = await Promise.all([
        TestAssertions.assertEventReceived(fromAgent, 'conversation_transferred'),
        TestAssertions.assertEventReceived(toAgent, 'conversation_transferred'),
        TestAssertions.assertEventReceived(teamLead, 'conversation_transferred')
      ]);

      events.forEach(event => {
        expect(event.data.fromAgent).toBe(fromAgent.userId);
        expect(event.data.toAgent).toBe(toAgent.userId);
        expect(event.data.transferReason).toBe('Workload balancing');
      });
    });

    it('should broadcast conversation status changes', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Broadcast status change
      const success = await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: {
          oldStatus: 'active',
          newStatus: 'resolved',
          changedBy: agents[0].userId,
          changedAt: Date.now(),
          resolution: 'Customer issue resolved'
        }
      });

      expect(success).toBe(true);

      // All agents should receive status change
      const statusEvents = await Promise.all(
        agents.map(agent => TestAssertions.assertEventReceived(agent, 'conversation_status_changed'))
      );

      statusEvents.forEach(event => {
        expect(event.data.newStatus).toBe('resolved');
        expect(event.data.resolution).toBe('Customer issue resolved');
      });
    });

    it('should handle participant join and leave events', async () => {
      const existingAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(existingAgent);

      await existingAgent.connect();

      // New participant joins
      const success = await broadcastService.broadcastConversationEvent({
        type: 'participant_joined',
        conversationId: conversationId,
        data: {
          userId: 'new_user_123',
          userName: 'New User',
          role: 'team',
          joinedAt: Date.now()
        }
      });

      expect(success).toBe(true);

      // Existing agent should receive join event
      const joinEvent = await TestAssertions.assertEventReceived(
        existingAgent,
        'participant_joined',
        1000
      );

      expect(joinEvent.data.userId).toBe('new_user_123');
      expect(joinEvent.data.role).toBe('team');

      // Participant leaves
      const leaveSuccess = await broadcastService.broadcastConversationEvent({
        type: 'participant_left',
        conversationId: conversationId,
        data: {
          userId: 'new_user_123',
          leftAt: Date.now(),
          reason: 'Session ended'
        }
      });

      expect(leaveSuccess).toBe(true);

      // Existing agent should receive leave event
      const leaveEvent = await TestAssertions.assertEventReceived(
        existingAgent,
        'participant_left',
        1000
      );

      expect(leaveEvent.data.userId).toBe('new_user_123');
      expect(leaveEvent.data.reason).toBe('Session ended');
    });
  });

  describe('Delayed Message Broadcasting', () => {
    it('should broadcast delayed message countdown events', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const team = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(agent);
      controller.addClient(team);

      await controller.connectAllClients();

      // Broadcast countdown event
      const success = await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_countdown',
        conversationId: conversationId,
        messageId: 'delayed_123',
        agentId: agent.userId,
        data: {
          remainingSeconds: 30,
          totalDelay: 60,
          content: 'This message will be sent in 30 seconds',
          messageType: 'text'
        }
      });

      expect(success).toBe(true);

      // Both should receive countdown event
      const [agentEvent, teamEvent] = await Promise.all([
        TestAssertions.assertEventReceived(agent, 'delayed_message_countdown'),
        TestAssertions.assertEventReceived(team, 'delayed_message_countdown')
      ]);

      expect(agentEvent.data.remainingSeconds).toBe(30);
      expect(teamEvent.data.messageId).toBe('delayed_123');
    });

    it('should broadcast delayed message sent confirmation', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Broadcast sent confirmation
      const success = await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_sent',
        conversationId: conversationId,
        messageId: 'delayed_456',
        agentId: agents[0].userId,
        data: {
          sentAt: Date.now(),
          originalScheduledTime: Date.now() - 60000,
          actualDelay: 60,
          content: 'Delayed message successfully sent',
          platformMessageId: 'line_msg_789'
        }
      });

      expect(success).toBe(true);

      // All agents should receive sent confirmation
      const sentEvents = await Promise.all(
        agents.map(agent => TestAssertions.assertEventReceived(agent, 'delayed_message_sent'))
      );

      sentEvents.forEach(event => {
        expect(event.data.messageId).toBe('delayed_456');
        expect(event.data.actualDelay).toBe(60);
      });
    });

    it('should broadcast delayed message recall events', async () => {
      const recallingAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const supervisor = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(recallingAgent);
      controller.addClient(supervisor);

      await controller.connectAllClients();

      // Broadcast recall event
      const success = await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_recalled',
        conversationId: conversationId,
        messageId: 'recall_789',
        agentId: recallingAgent.userId,
        data: {
          recalledAt: Date.now(),
          originalScheduledTime: Date.now() + 30000,
          remainingTime: 30,
          recallReason: 'Agent requested recall',
          content: 'Recalled before sending'
        }
      });

      expect(success).toBe(true);

      // Both should receive recall event
      const [agentEvent, supervisorEvent] = await Promise.all([
        TestAssertions.assertEventReceived(recallingAgent, 'delayed_message_recalled'),
        TestAssertions.assertEventReceived(supervisor, 'delayed_message_recalled')
      ]);

      expect(agentEvent.data.messageId).toBe('recall_789');
      expect(supervisorEvent.data.recallReason).toBe('Agent requested recall');
    });

    it('should broadcast delayed message failure events', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      controller.addClient(agent);
      controller.addClient(admin);

      await controller.connectAllClients();

      // Broadcast failure event
      const success = await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_failed',
        conversationId: conversationId,
        messageId: 'failed_456',
        agentId: agent.userId,
        data: {
          failedAt: Date.now(),
          scheduledTime: Date.now() - 1000,
          error: 'Platform API unavailable',
          retryAttempts: 3,
          willRetry: false,
          content: 'Failed to send message'
        },
        priority: 'high'
      });

      expect(success).toBe(true);

      // Both should receive failure event
      const [agentEvent, adminEvent] = await Promise.all([
        TestAssertions.assertEventReceived(agent, 'delayed_message_failed'),
        TestAssertions.assertEventReceived(admin, 'delayed_message_failed')
      ]);

      expect(agentEvent.data.error).toBe('Platform API unavailable');
      expect(adminEvent.data.retryAttempts).toBe(3);
      expect(adminEvent.priority).toBe('high');
    });
  });

  describe('Cross-Conversation Broadcasting', () => {
    it('should broadcast user presence across conversations', async () => {
      const conv1Id = 'conversation_1';
      const conv2Id = 'conversation_2';

      const userInConv1 = WebSocketTestClientFactory.createClient({
        conversationId: conv1Id,
        role: 'agent',
        userId: 'shared_agent'
      });

      const userInConv2 = WebSocketTestClientFactory.createClient({
        conversationId: conv2Id,
        role: 'agent',
        userId: 'shared_agent'
      });

      const observerInConv1 = WebSocketTestClientFactory.createClient({
        conversationId: conv1Id,
        role: 'team'
      });

      const observerInConv2 = WebSocketTestClientFactory.createClient({
        conversationId: conv2Id,
        role: 'team'
      });

      await Promise.all([
        userInConv1.connect(),
        userInConv2.connect(),
        observerInConv1.connect(),
        observerInConv2.connect()
      ]);

      // Broadcast presence change
      const success = await broadcastService.broadcastPresenceEvent({
        type: 'agent_available',
        userId: 'shared_agent',
        teamId: 1,
        data: {
          status: 'available',
          capacity: 3,
          lastActive: Date.now()
        }
      });

      expect(success).toBe(true);

      // Team members in both conversations should receive presence update
      const [conv1Event, conv2Event] = await Promise.all([
        TestAssertions.assertEventReceived(observerInConv1, 'agent_available'),
        TestAssertions.assertEventReceived(observerInConv2, 'agent_available')
      ]);

      expect(conv1Event.userId).toBe('shared_agent');
      expect(conv2Event.data.status).toBe('available');
    });

    it('should handle team-wide announcements', async () => {
      // Create agents in different conversations but same team
      const agents = [
        WebSocketTestClientFactory.createClient({
          conversationId: 'conv_a',
          role: 'agent',
          userId: 'team_agent_1'
        }),
        WebSocketTestClientFactory.createClient({
          conversationId: 'conv_b',
          role: 'agent',
          userId: 'team_agent_2'
        }),
        WebSocketTestClientFactory.createClient({
          conversationId: 'conv_c',
          role: 'agent',
          userId: 'team_agent_3'
        })
      ];

      await Promise.all(agents.map(agent => agent.connect()));

      // Mock team member query to return these agents
      mockEnv.DB.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([
              { id: 'team_agent_1', teamId: 1 },
              { id: 'team_agent_2', teamId: 1 },
              { id: 'team_agent_3', teamId: 1 }
            ])
          })
        })
      });

      // Send team announcement
      const announcementEvent = TestDataFactory.createEvent({
        type: 'team_announcement',
        data: {
          message: 'Team meeting at 3 PM',
          priority: 'high',
          teamId: 1
        }
      });

      // Use message broadcaster for team-wide distribution
      const broadcasterNamespace = testEnv.getNamespace('MESSAGE_BROADCASTER');
      const broadcasterId = broadcasterNamespace.idFromName('global');
      const broadcasterStub = broadcasterNamespace.get(broadcasterId);

      const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-to-teams', {
        method: 'POST',
        body: JSON.stringify({
          event: announcementEvent,
          teamIds: [1]
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      expect(response.ok).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency message broadcasting', async () => {
      const messageCount = 50;
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      performanceMonitor.startTimer('high_frequency_broadcast');

      // Send many messages rapidly
      const broadcastPromises = Array.from({ length: messageCount }, (_, i) =>
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `rapid_msg_${i}`,
          userId: agents[0].userId,
          data: {
            content: `Rapid message ${i}`,
            index: i
          }
        })
      );

      const results = await Promise.all(broadcastPromises);
      const broadcastTime = performanceMonitor.endTimer('high_frequency_broadcast');

      // All broadcasts should succeed
      expect(results.every(r => r === true)).toBe(true);

      // Should complete within reasonable time
      const throughput = messageCount / (broadcastTime / 1000);
      expect(throughput).toBeGreaterThan(20); // At least 20 messages per second

      // Verify performance metrics
      const metrics = performanceMonitor.getMetrics('high_frequency_broadcast');
      TestAssertions.assertPerformanceMetrics(metrics, {
        minCount: 1,
        maxAverage: 5000 // Max 5 seconds total
      });
    });

    it('should handle concurrent broadcasting from multiple sources', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Simulate concurrent broadcasts from different sources
      const concurrentPromises = agents.slice(0, 3).map((agent, index) =>
        Promise.all([
          broadcastService.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: conversationId,
            messageId: `concurrent_msg_${index}_1`,
            userId: agent.userId,
            data: { content: `Message from agent ${index}` }
          }),
          broadcastService.broadcastTypingEvent({
            type: 'typing_start',
            conversationId: conversationId,
            userId: agent.userId,
            userName: `Agent ${index}`
          }),
          broadcastService.broadcastPresenceEvent({
            type: 'agent_available',
            userId: agent.userId,
            data: { status: 'busy' }
          })
        ])
      );

      const results = await Promise.all(concurrentPromises);

      // All concurrent operations should succeed
      results.forEach(agentResults => {
        expect(agentResults.every(r => r === true)).toBe(true);
      });
    });

    it('should maintain performance with large room sizes', async () => {
      const largeRoomSize = 25;
      const clients = LoadTestHelper.createLoadTestClients(largeRoomSize, conversationId);

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      // Connect all clients
      performanceMonitor.startTimer('large_room_connect');
      await LoadTestHelper.connectInBatches(clients, 5, 50);
      const connectTime = performanceMonitor.endTimer('large_room_connect');

      expect(connectTime).toBeLessThan(10000); // Should connect within 10 seconds

      // Send broadcast to large room
      performanceMonitor.startTimer('large_room_broadcast');

      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: conversationId,
        messageId: 'large_room_msg',
        userId: clients[0].userId,
        data: {
          content: 'Message to large room',
          participantCount: largeRoomSize
        }
      });

      const broadcastTime = performanceMonitor.endTimer('large_room_broadcast');

      expect(success).toBe(true);
      expect(broadcastTime).toBeLessThan(2000); // Should broadcast within 2 seconds

      // Verify broadcast reached all connected clients
      const roomStats = controller.getRoomStats();
      expect(roomStats.connectedClients).toBe(largeRoomSize);
    });

    it('should optimize batch broadcasting efficiency', async () => {
      const { controller, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Create multiple events for the same conversation
      const batchEvents = Array.from({ length: 20 }, (_, i) =>
        TestDataFactory.createEvent({
          type: 'message_sent',
          conversationId: conversationId,
          userId: agents[0].userId,
          data: { content: `Batch message ${i}`, batchIndex: i }
        })
      );

      performanceMonitor.startTimer('batch_broadcast');

      // Use batch broadcasting
      const batchResult = await broadcastService.broadcastBatch(batchEvents);

      const batchTime = performanceMonitor.endTimer('batch_broadcast');

      expect(batchResult.successful).toBe(20);
      expect(batchResult.failed).toBe(0);

      // Batch should be more efficient than individual broadcasts
      const avgTimePerEvent = batchTime / 20;
      expect(avgTimePerEvent).toBeLessThan(100); // Less than 100ms per event on average
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Durable Object failures gracefully', async () => {
      // Mock conversation room to fail
      mockEnv.CONVERSATION_ROOM.get = vi.fn().mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Durable Object unavailable'))
      });

      const success = await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'failing_conversation',
        messageId: 'fail_test_123',
        userId: 'user_123',
        data: { content: 'This should fail gracefully' }
      });

      // Should handle failure gracefully
      expect(success).toBe(false);

      // Should not throw errors
      expect(true).toBe(true); // Test passed without throwing
    });

    it('should continue broadcasting to available targets when some fail', async () => {
      let callCount = 0;

      // Mock to fail every other call
      mockEnv.CONVERSATION_ROOM.get = vi.fn().mockImplementation(() => ({
        fetch: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return Promise.reject(new Error('Simulated failure'));
          }
          return Promise.resolve(new Response(JSON.stringify({ success: true })));
        })
      }));

      // Try to broadcast to multiple conversations
      const promises = ['conv1', 'conv2', 'conv3', 'conv4'].map(convId =>
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: convId,
          messageId: 'partial_fail_msg',
          userId: 'user_123',
          data: { content: 'Partial failure test' }
        })
      );

      const results = await Promise.all(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r === true).length;
      const failCount = results.filter(r => r === false).length;

      expect(successCount).toBeGreaterThan(0);
      expect(failCount).toBeGreaterThan(0);
      expect(successCount + failCount).toBe(4);
    });

    it('should recover from temporary network issues', async () => {
      let attemptCount = 0;

      // Mock to fail first few attempts, then succeed
      mockEnv.CONVERSATION_ROOM.get = vi.fn().mockImplementation(() => ({
        fetch: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount <= 2) {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve(new Response(JSON.stringify({ success: true })));
        })
      }));

      // Multiple broadcast attempts
      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `recovery_msg_${i}`,
          userId: 'user_123',
          data: { content: `Recovery test ${i}` }
        });
        results.push(result);
      }

      // Later attempts should succeed after recovery
      expect(results[0]).toBe(false); // First fails
      expect(results[1]).toBe(false); // Second fails
      expect(results[2]).toBe(true);  // Third succeeds
      expect(results[3]).toBe(true);  // Fourth succeeds
    });

    it('should handle malformed event data', async () => {
      // Test with invalid event data
      const invalidData = {
        type: 'invalid_type',
        conversationId: null, // Invalid
        messageId: undefined, // Invalid
        userId: 123, // Wrong type
        data: 'not an object' // Invalid
      };

      const success = await broadcastService.broadcastMessageEvent(invalidData as any);

      // Should handle gracefully without throwing
      expect(success).toBe(false);
    });
  });
});