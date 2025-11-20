// WebSocket Connection Lifecycle Integration Tests
// Tests end-to-end WebSocket connection flows including authentication,
// subscription management, and graceful disconnection

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DurableObjectsTestEnvironment,
  testEnv
} from '../../helpers/websocket/durable-objects-test-env';
import {
  WebSocketTestClient,
  WebSocketRoomTestController,
  WebSocketTestClientFactory
} from '../../helpers/websocket/websocket-test-client';
import {
  TestDataFactory,
  TestAssertions,
  TestScenarios
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '@backend/durable-objects/ConversationRoom';
import { UserConnection } from '@backend/durable-objects/UserConnection';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import { WebSocketBroadcasimport { MockFactory } from '@helpers/mockFactory';
tService } from '@backend/services/websocket-broadcast-service';
import type {
  WebSocketMessage,
  DurableObjectEvent,
  MigrationConfig
} from '@backend/types/websocket-types';

describe('WebSocket Connection Lifecycle Integration', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let conversationId: string;
  let roomController: WebSocketRoomTestController;

  beforeEach(async () => {
    // Reset test environment
    testEnv.reset();

    // Register Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);

    // Setup mock environment
    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([])
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      }
    };

    // Set migration config
    const migrationConfig = TestDataFactory.createMigrationConfig({
      enableWebSocket: true,
      rolloutPercentage: 100
    });

    mockEnv.SESSIONS.get.mockImplementation((key: string) => {
      if (key === 'websocket_migration_config') {
        return JSON.stringify(migrationConfig);
      }
      return null;
    });

    broadcastService = new WebSocketBroadcastService(mockEnv);
    conversationId = 'test_conversation_integration';
    roomController = new WebSocketRoomTestController(conversationId);
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
  });

  describe('Connection Establishment', () => {
    test('should establish WebSocket connections successfully', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);

      await client.connect();

      TestAssertions.assertClientConnected(client);

      // Should receive welcome message
      const welcomeEvent = await TestAssertions.assertEventReceived(
        client,
        'connection_established',
        2000
      );

      expect(welcomeEvent.conversationId).toBe(conversationId);
      expect(welcomeEvent.connectionId).toBe(client.id);
    });

    test('should handle authentication during connection', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin'
      });

      // Configure client with authentication metadata
      client.metadata.authToken = 'valid_jwt_token';
      client.metadata.userId = client.userId;

      roomController.addClient(client);

      await client.connect();

      TestAssertions.assertClientConnected(client);
      expect(client.role).toBe('admin');
    });

    test('should handle connection failures gracefully', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      // Configure client to simulate connection errors
      client.configure({
        simulateErrors: true,
        errorRate: 1.0 // 100% error rate
      });

      roomController.addClient(client);

      await expect(client.connect()).rejects.toThrow('Simulated connection error');
      TestAssertions.assertClientDisconnected(client);
    });

    test('should manage multiple concurrent connections', async () => {
      const clientCount = 10;
      const clients = WebSocketTestClientFactory.createClients(clientCount, {
        conversationId,
        role: 'agent',
        userIdPrefix: 'concurrent_user'
      });

      clients.forEach(client => roomController.addClient(client));

      // Connect all clients concurrently
      const connectionPromises = clients.map(client => client.connect());
      await Promise.all(connectionPromises);

      // All clients should be connected
      clients.forEach(client => {
        TestAssertions.assertClientConnected(client);
      });

      const roomStats = roomController.getRoomStats();
      expect(roomStats.totalClients).toBe(clientCount);
      expect(roomStats.connectedClients).toBe(clientCount);
    });

    test('should handle role-based connection limits', async () => {
      // Create many agent connections
      const agentCount = 15;
      const agents = WebSocketTestClientFactory.createClients(agentCount, {
        conversationId,
        role: 'agent'
      });

      agents.forEach(client => roomController.addClient(client));

      // Connect all agents
      await roomController.connectAllClients();

      // All should connect successfully (no role-based limits in test)
      const roomStats = roomController.getRoomStats();
      expect(roomStats.connectedClients).toBe(agentCount);
    });
  });

  describe('Subscription Management', () => {
    test('should handle conversation subscriptions', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);
      await client.connect();

      // Subscribe to conversation events
      await client.sendMessage({
        type: 'subscribe',
        data: {
          type: 'conversation_events',
          conversationId: conversationId
        }
      });

      // Send a conversation event through broadcast service
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: {
          status: 'active',
          agentId: 'agent_123'
        }
      });

      // Client should receive the event
      const event = await TestAssertions.assertEventReceived(
        client,
        'conversation_status_changed',
        2000
      );

      expect(event.conversationId).toBe(conversationId);
      expect(event.data.status).toBe('active');
    });

    test('should handle user-specific subscriptions', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);
      await client.connect();

      // Subscribe to user notifications
      await client.sendMessage({
        type: 'subscribe',
        data: {
          type: 'user_notifications',
          userId: client.userId
        }
      });

      // Send a user-specific event
      await broadcastService.broadcastPresenceEvent({
        type: 'agent_available',
        userId: client.userId,
        data: {
          availability: 'online',
          timestamp: Date.now()
        }
      });

      // Client should receive the presence event
      const event = await TestAssertions.assertEventReceived(
        client,
        'agent_available',
        2000
      );

      expect(event.userId).toBe(client.userId);
      expect(event.data.availability).toBe('online');
    });

    test('should handle subscription cleanup on disconnect', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);
      await client.connect();

      // Subscribe to events
      await client.sendMessage({
        type: 'subscribe',
        data: {
          type: 'conversation_events',
          conversationId: conversationId
        }
      });

      // Disconnect client
      await client.disconnect();
      TestAssertions.assertClientDisconnected(client);

      // Send event after disconnect
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: { status: 'inactive' }
      });

      // Client should not receive events (they're disconnected)
      const eventCount = client.getEventsByType('conversation_status_changed').length;
      expect(eventCount).toBe(0);
    });

    test('should handle unsubscription requests', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);
      await client.connect();

      // Subscribe first
      await client.sendMessage({
        type: 'subscribe',
        data: {
          type: 'conversation_events',
          conversationId: conversationId
        }
      });

      // Then unsubscribe
      await client.sendMessage({
        type: 'unsubscribe',
        data: {
          type: 'conversation_events',
          conversationId: conversationId
        }
      });

      // Send event after unsubscribe
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: { status: 'closed' }
      });

      // Wait a bit to ensure no events are received
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Client should not receive events after unsubscribe
      const eventCount = client.getEventsByType('conversation_status_changed').length;
      expect(eventCount).toBe(0);
    });
  });

  describe('Message Broadcasting Flow', () => {
    test('should broadcast messages to conversation participants', async () => {
      const { controller, admin, team, agents } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      await controller.connectAllClients();

      // Agent sends a message
      const messageId = await agents[0].sendChatMessage('Hello from agent!');

      // All participants should receive the message event
      const events = await Promise.all([
        TestAssertions.assertEventReceived(admin, 'message_sent'),
        TestAssertions.assertEventReceived(team, 'message_sent'),
        TestAssertions.assertEventReceived(agents[1], 'message_sent'),
        TestAssertions.assertEventReceived(agents[2], 'message_sent')
      ]);

      // Verify all events have the same message ID
      events.forEach(event => {
        expect(event.data.messageId).toBe(messageId);
        expect(event.data.content).toBe('Hello from agent!');
        expect(event.userId).toBe(agents[0].userId);
      });

      // Sender should not receive their own message back
      TestAssertions.assertEventCount(agents[0], 'message_sent', 0);
    });

    test('should handle typing indicators correctly', async () => {
      const client1 = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'agent_1'
      });

      const client2 = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'agent_2'
      });

      roomController.addClient(client1);
      roomController.addClient(client2);

      await Promise.all([
        client1.connect(),
        client2.connect()
      ]);

      // Client1 starts typing
      await client1.sendTyping(true);

      // Client2 should receive typing start event
      const startEvent = await TestAssertions.assertEventReceived(
        client2,
        'typing_start',
        1000
      );

      expect(startEvent.userId).toBe(client1.userId);

      // Client1 stops typing
      await client1.sendTyping(false);

      // Client2 should receive typing stop event
      const stopEvent = await TestAssertions.assertEventReceived(
        client2,
        'typing_stop',
        1000
      );

      expect(stopEvent.userId).toBe(client1.userId);

      // Client1 should not receive their own typing events
      TestAssertions.assertEventCount(client1, 'typing_start', 0);
      TestAssertions.assertEventCount(client1, 'typing_stop', 0);
    });

    test('should handle broadcast service failures with fallback', async () => {
      // Mock broadcast service to fail
      vi.spyOn(broadcastService, 'broadcastMessageEvent')
        .mockResolvedValue(false); // Simulate failure

      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);
      await client.connect();

      // Send message - should fall back to alternative delivery
      const messageId = await client.sendChatMessage('Fallback test message');

      // Even with broadcast failure, message should be processed
      expect(messageId).toBeDefined();
    });
  });

  describe('Real-time Event Distribution', () => {
    test('should distribute conversation assignment events', async () => {
      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin'
      });

      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(admin);
      roomController.addClient(agent);

      await Promise.all([
        admin.connect(),
        agent.connect()
      ]);

      // Broadcast assignment event
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId: conversationId,
        data: {
          assignedTo: agent.userId,
          assignedBy: admin.userId,
          timestamp: Date.now()
        }
      });

      // Both should receive assignment event
      const [adminEvent, agentEvent] = await Promise.all([
        TestAssertions.assertEventReceived(admin, 'conversation_assigned'),
        TestAssertions.assertEventReceived(agent, 'conversation_assigned')
      ]);

      expect(adminEvent.data.assignedTo).toBe(agent.userId);
      expect(agentEvent.data.assignedTo).toBe(agent.userId);
    });

    test('should handle delayed message countdown events', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(agent);
      await agent.connect();

      // Broadcast countdown event
      await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_countdown',
        conversationId: conversationId,
        messageId: 'delayed_123',
        agentId: agent.userId,
        data: {
          remainingSeconds: 30,
          content: 'Scheduled message'
        }
      });

      // Agent should receive countdown event
      const countdownEvent = await TestAssertions.assertEventReceived(
        agent,
        'delayed_message_countdown',
        1000
      );

      expect(countdownEvent.data.messageId).toBe('delayed_123');
      expect(countdownEvent.data.remainingSeconds).toBe(30);
    });

    test('should handle message recall events', async () => {
      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      const observer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      roomController.addClient(agent);
      roomController.addClient(observer);

      await Promise.all([
        agent.connect(),
        observer.connect()
      ]);

      // Broadcast recall event
      await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_recalled',
        conversationId: conversationId,
        messageId: 'recall_123',
        agentId: agent.userId,
        data: {
          recallReason: 'User requested',
          recallTime: Date.now()
        }
      });

      // Both should receive recall event
      const [agentEvent, observerEvent] = await Promise.all([
        TestAssertions.assertEventReceived(agent, 'delayed_message_recalled'),
        TestAssertions.assertEventReceived(observer, 'delayed_message_recalled')
      ]);

      expect(agentEvent.data.messageId).toBe('recall_123');
      expect(observerEvent.data.messageId).toBe('recall_123');
    });

    test('should handle presence updates', async () => {
      const teamMember = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team'
      });

      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin'
      });

      roomController.addClient(teamMember);
      roomController.addClient(admin);

      await Promise.all([
        teamMember.connect(),
        admin.connect()
      ]);

      // Broadcast presence event
      await broadcastService.broadcastPresenceEvent({
        type: 'agent_available',
        userId: teamMember.userId,
        teamId: 1,
        data: {
          status: 'available',
          capacity: 5
        }
      });

      // Admin should receive presence update
      const presenceEvent = await TestAssertions.assertEventReceived(
        admin,
        'agent_available',
        1000
      );

      expect(presenceEvent.userId).toBe(teamMember.userId);
      expect(presenceEvent.data.status).toBe('available');
    });
  });

  describe('Connection Recovery and Resilience', () => {
    test('should handle connection drops and reconnection', async () => {
      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);

      // Initial connection
      await client.connect();
      TestAssertions.assertClientConnected(client);

      // Simulate connection drop
      await client.disconnect();
      TestAssertions.assertClientDisconnected(client);

      // Reconnect
      await client.connect();
      TestAssertions.assertClientConnected(client);

      // Should receive new welcome message
      const welcomeEvent = await TestAssertions.assertEventReceived(
        client,
        'connection_established',
        1000
      );

      expect(welcomeEvent.connectionId).toBe(client.id);
    });

    test('should maintain message ordering during reconnection', async () => {
      const sender = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'sender'
      });

      const receiver = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'receiver'
      });

      roomController.addClient(sender);
      roomController.addClient(receiver);

      await Promise.all([
        sender.connect(),
        receiver.connect()
      ]);

      // Send first message
      const msg1Id = await sender.sendChatMessage('Message 1');

      // Receiver disconnects
      await receiver.disconnect();

      // Send second message while receiver is offline
      const msg2Id = await sender.sendChatMessage('Message 2');

      // Receiver reconnects
      await receiver.connect();

      // Send third message after reconnection
      const msg3Id = await sender.sendChatMessage('Message 3');

      // Receiver should get the third message immediately
      const msg3Event = await TestAssertions.assertEventReceived(
        receiver,
        'message_sent',
        1000
      );

      expect(msg3Event.data.messageId).toBe(msg3Id);

      // Message ordering should be maintained in what receiver gets
      const allEvents = receiver.getEventsByType('message_sent');
      expect(allEvents.length).toBe(1); // Only got message 3
      expect(allEvents[0].data.content).toBe('Message 3');
    });

    test('should handle partial connection failures', async () => {
      const clients = WebSocketTestClientFactory.createClients(5, {
        conversationId,
        role: 'agent'
      });

      clients.forEach(client => roomController.addClient(client));

      // Connect first 3 clients successfully
      await Promise.all([
        clients[0].connect(),
        clients[1].connect(),
        clients[2].connect()
      ]);

      // Configure last 2 clients to fail connection
      clients[3].configure({ simulateErrors: true, errorRate: 1.0 });
      clients[4].configure({ simulateErrors: true, errorRate: 1.0 });

      // Attempt to connect failing clients
      await expect(clients[3].connect()).rejects.toThrow();
      await expect(clients[4].connect()).rejects.toThrow();

      // Send message from successful client
      const messageId = await clients[0].sendChatMessage('Partial failure test');

      // Only connected clients should receive message
      const events = await Promise.all([
        TestAssertions.assertEventReceived(clients[1], 'message_sent'),
        TestAssertions.assertEventReceived(clients[2], 'message_sent')
      ]);

      events.forEach(event => {
        expect(event.data.messageId).toBe(messageId);
      });

      // Failed clients should not receive anything
      expect(clients[3].receivedMessages.length).toBe(0);
      expect(clients[4].receivedMessages.length).toBe(0);
    });
  });

  describe('Feature Flag Integration', () => {
    test('should respect WebSocket feature flags', async () => {
      // Disable WebSocket in migration config
      const disabledConfig = TestDataFactory.createMigrationConfig({
        enableWebSocket: false,
        enableSSE: true
      });

      mockEnv.SESSIONS.get.mockImplementation((key: string) => {
        if (key === 'websocket_migration_config') {
          return JSON.stringify(disabledConfig);
        }
        return null;
      });

      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      // Should fall back to SSE (simulated by not establishing WebSocket)
      const isAvailable = await broadcastService.isWebSocketAvailable();
      expect(isAvailable).toBe(false);
    });

    test('should handle gradual rollout', async () => {
      // Configure 50% rollout
      const gradualConfig = TestDataFactory.createMigrationConfig({
        enableWebSocket: true,
        migrationStrategy: 'gradual',
        rolloutPercentage: 50
      });

      mockEnv.SESSIONS.get.mockImplementation((key: string) => {
        if (key === 'websocket_migration_config') {
          return JSON.stringify(gradualConfig);
        }
        return null;
      });

      // Create broadcast service with updated config
      const testBroadcastService = new WebSocketBroadcastService(mockEnv);

      // Should still be available but with gradual rollout
      const isAvailable = await testBroadcastService.isWebSocketAvailable();
      expect(isAvailable).toBe(true);
    });

    test('should handle feature flag updates', async () => {
      let webSocketEnabled = true;

      mockEnv.SESSIONS.get.mockImplementation((key: string) => {
        if (key === 'websocket_migration_config') {
          return JSON.stringify(TestDataFactory.createMigrationConfig({
            enableWebSocket: webSocketEnabled
          }));
        }
        return null;
      });

      const client = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent'
      });

      roomController.addClient(client);

      // Initially WebSocket is enabled
      let isAvailable = await broadcastService.isWebSocketAvailable();
      expect(isAvailable).toBe(true);

      // Disable WebSocket
      webSocketEnabled = false;

      // Create new service instance to pick up change
      const updatedService = new WebSocketBroadcastService(mockEnv);
      isAvailable = await updatedService.isWebSocketAvailable();
      expect(isAvailable).toBe(false);
    });
  });
});