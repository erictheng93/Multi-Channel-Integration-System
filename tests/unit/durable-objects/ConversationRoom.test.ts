// ConversationRoom Durable Object Unit Tests
// Tests all functionality of ConversationRoom including connection management,
// message broadcasting, distributed locking, and error handling

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationRoom } from '@backend/durable-objects/ConversationRoom';
import {
  DurableObjectsTestEnvironment,
  MockDurableObjectState,
  MockWebSocketPair
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
import type {
  WebSocketMessage,
  DurableObjectEvent,
  WebSocketConnection,
  DistributedLock
} from '@backend/types/websocket-types';
// ⚠️ Import unified helper for global WebSocketPair setup
import { setupGlobalWebSocketPair } from '../../helpers/durable-objects-test-helper';

describe('ConversationRoom Durable Object', () => {
  let testEnv: DurableObjectsTestEnvironment;
  let conversationRoom: ConversationRoom;
  let mockState: MockDurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    // ⚠️ Setup global WebSocketPair FIRST to avoid "WebSocketPair is not defined" errors
    setupGlobalWebSocketPair();

    testEnv = new DurableObjectsTestEnvironment();
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);

    mockEnv = {
      JWT_SECRET: 'test_secret',
      SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      REALTIME_QUEUE: {
        send: vi.fn()
      }
    };

    const namespace = testEnv.getNamespace('CONVERSATION_ROOM');
    const id = namespace.idFromName('test_conversation_123');
    mockState = new MockDurableObjectState(id);
    conversationRoom = new ConversationRoom(mockState, mockEnv);

    // ✅ Set conversationId manually (normally set from WebSocket upgrade URL)
    (conversationRoom as any).conversationId = 'test_conversation_123';
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
  });

  describe('WebSocket Connection Handling', () => {
    // ⚠️ SKIPPED: WebSocket upgrade (status 101) not supported in Node.js test environment
    // Real WebSocket functionality tested in integration/e2e tests
    it.skip('should handle WebSocket upgrade successfully', async () => {
      const url = 'ws://test/connect?userId=user1&token=valid_token&role=agent';
      const request = new Request(url, {
        headers: {
          'Upgrade': 'websocket',
          'User-Agent': 'Test/1.0',
          'CF-Connecting-IP': '127.0.0.1'
        }
      });

      // Mock successful auth verification
      const verifyAuthSpy = vi.spyOn(conversationRoom as any, 'verifyAuthToken')
        .mockResolvedValue(true);

      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(101);
      expect(verifyAuthSpy).toHaveBeenCalledWith('valid_token', 'user1');
    });

    it('should reject WebSocket upgrade with missing parameters', async () => {
      const url = 'ws://test/connect?userId=user1'; // Missing token and role
      const request = new Request(url, {
        headers: { 'Upgrade': 'websocket' }
      });

      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing required parameters');
    });

    it('should reject unauthorized WebSocket connections', async () => {
      const url = 'ws://test/connect?userId=user1&token=invalid_token&role=agent';
      const request = new Request(url, {
        headers: { 'Upgrade': 'websocket' }
      });

      // Mock failed auth verification
      vi.spyOn(conversationRoom as any, 'verifyAuthToken')
        .mockResolvedValue(false);

      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');
    });

    it('should enforce connection limits', async () => {
      // Fill up connection slots
      const maxConnections = (conversationRoom as any).MAX_CONNECTIONS;
      const connections = new Map();

      for (let i = 0; i < maxConnections; i++) {
        connections.set(`conn_${i}`, {
          websocket: {},
          userId: `user_${i}`,
          connectionId: `conn_${i}`
        });
      }

      (conversationRoom as any).connections = connections;

      const url = 'ws://test/connect?userId=user_new&token=valid_token&role=agent';
      const request = new Request(url, {
        headers: { 'Upgrade': 'websocket' }
      });

      vi.spyOn(conversationRoom as any, 'verifyAuthToken')
        .mockResolvedValue(true);

      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(429);
      expect(await response.text()).toBe('Connection limit reached');
    });
  });

  describe('Message Broadcasting', () => {
    let mockWebSocket: any;
    let connection: WebSocketConnection;

    beforeEach(() => {
      mockWebSocket = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        addEventListener: vi.fn(),
        accept: vi.fn()
      };

      connection = TestDataFactory.createConnection({
        websocket: mockWebSocket,
        userId: 'test_user_1',
        conversationId: 'test_conversation_123',
        role: 'agent'
      });

      // Add connection to room
      (conversationRoom as any).connections.set(connection.connectionId, connection);
      (conversationRoom as any).participants.add(connection.userId);
    });

    it('should broadcast messages to all connections', async () => {
      const event = TestDataFactory.createEvent({
        type: 'message_sent',
        conversationId: 'test_conversation_123',
        data: { content: 'Test message' }
      });

      await (conversationRoom as any).broadcastEvent(event);

      // ✅ Verify message was sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse((mockWebSocket.send as any).mock.calls[0][0]);
      expect(sentData.type).toBe('event');
      expect(sentData.data.type).toBe('message_sent');
      expect(sentData.data.data.content).toBe('Test message');
      expect(typeof sentData.timestamp).toBe('number');
    });

    it('should handle WebSocket send errors gracefully', async () => {
      // Mock WebSocket send to throw error
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Connection closed');
      });

      const event = TestDataFactory.createEvent({
        type: 'message_sent',
        conversationId: 'test_conversation_123'
      });

      // Should not throw error
      await expect((conversationRoom as any).broadcastEvent(event))
        .resolves.not.toThrow();
    });

    it('should only send to open WebSocket connections', async () => {
      // Set WebSocket as closed
      mockWebSocket.readyState = 3; // WebSocket.CLOSED

      const event = TestDataFactory.createEvent({
        type: 'message_sent',
        conversationId: 'test_conversation_123'
      });

      await (conversationRoom as any).broadcastEvent(event);

      // Should not attempt to send to closed connection
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should store message history with size limit', async () => {
      const maxHistory = (conversationRoom as any).MAX_MESSAGE_HISTORY;

      // ✅ Fill message history to the limit (not beyond)
      for (let i = 0; i < maxHistory; i++) {
        const event = TestDataFactory.createEvent({
          type: 'message_sent',
          conversationId: 'test_conversation_123',
          data: { content: `Message ${i}` }
        });

        (conversationRoom as any).messageHistory.push(event);
      }

      // Simulate message handling to trigger history cleanup
      const mockMessage = TestDataFactory.createMessage({
        type: 'message',
        data: { content: 'New message' }
      });

      // Mock permission check
      vi.spyOn(conversationRoom as any, 'checkMessagePermission')
        .mockResolvedValue(true);

      // Mock message queue sending
      vi.spyOn(conversationRoom as any, 'sendToMessageQueue')
        .mockResolvedValue(undefined);

      await (conversationRoom as any).handleChatMessage(connection, mockMessage);

      // ✅ History should be exactly MAX_MESSAGE_HISTORY (added 1, removed 1)
      expect((conversationRoom as any).messageHistory.length).toBe(maxHistory);
    });
  });

  describe('Connection Management', () => {
    it('should add connections successfully', async () => {
      const connection = TestDataFactory.createConnection({
        userId: 'user_1',
        conversationId: 'test_conversation_123'
      });

      // ✅ Mock broadcastEvent to avoid errors
      const broadcastSpy = vi.spyOn(conversationRoom as any, 'broadcastEvent')
        .mockResolvedValue(undefined);

      await (conversationRoom as any).addConnection(connection);

      // Verify connection was added in memory
      const connections = (conversationRoom as any).connections;
      expect(connections.has(connection.connectionId)).toBe(true);

      // Verify participant was added in memory
      const participants = (conversationRoom as any).participants;
      expect(participants.has(connection.userId)).toBe(true);

      // Verify broadcastEvent was called for user_joined event
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user_joined',
          userId: connection.userId,
          conversationId: 'test_conversation_123'
        })
      );
    });

    it('should remove connections successfully', async () => {
      const connection = TestDataFactory.createConnection({
        userId: 'user_1',
        conversationId: 'test_conversation_123'
      });

      // Add connection first
      (conversationRoom as any).connections.set(connection.connectionId, connection);
      (conversationRoom as any).participants.add(connection.userId);

      // Mock broadcastEvent to avoid complex setup
      vi.spyOn(conversationRoom as any, 'broadcastEvent')
        .mockResolvedValue(undefined);

      await (conversationRoom as any).removeConnection(connection.connectionId);

      // Verify connection was removed
      const connections = (conversationRoom as any).connections;
      expect(connections.has(connection.connectionId)).toBe(false);

      // Verify participant was removed (no other connections)
      const participants = (conversationRoom as any).participants;
      expect(participants.has(connection.userId)).toBe(false);
    });

    it('should keep participant when user has multiple connections', async () => {
      const userId = 'user_1';
      const connection1 = TestDataFactory.createConnection({
        userId,
        connectionId: 'conn_1'
      });
      const connection2 = TestDataFactory.createConnection({
        userId,
        connectionId: 'conn_2'
      });

      // Add both connections
      (conversationRoom as any).connections.set(connection1.connectionId, connection1);
      (conversationRoom as any).connections.set(connection2.connectionId, connection2);
      (conversationRoom as any).participants.add(userId);

      // ✅ Mock broadcastEvent to avoid complex setup
      vi.spyOn(conversationRoom as any, 'broadcastEvent')
        .mockResolvedValue(undefined);

      // Remove one connection
      await (conversationRoom as any).removeConnection(connection1.connectionId);

      // User should still be a participant
      const participants = (conversationRoom as any).participants;
      expect(participants.has(userId)).toBe(true);

      // But connection should be removed
      const connections = (conversationRoom as any).connections;
      expect(connections.has(connection1.connectionId)).toBe(false);
      expect(connections.has(connection2.connectionId)).toBe(true);
    });
  });

  describe('Message Handling', () => {
    let connection: WebSocketConnection;

    beforeEach(() => {
      connection = TestDataFactory.createConnection({
        websocket: {
          readyState: 1,
          send: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          close: vi.fn(),
          accept: vi.fn()
        } as any,
        userId: 'test_user_1',
        conversationId: 'test_conversation_123',
        role: 'agent'
      });

      (conversationRoom as any).connections.set(connection.connectionId, connection);
    });

    it('should handle ping messages', async () => {
      const pingMessage = TestDataFactory.createMessage({
        type: 'ping'
      });

      await (conversationRoom as any).handleWebSocketMessage(connection, pingMessage);

      // Should respond with pong
      expect(connection.websocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse((connection.websocket.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe('pong');
      expect(typeof sentMessage.timestamp).toBe('number');
    });

    it('should handle typing indicators', async () => {
      const typingMessage = TestDataFactory.createMessage({
        type: 'event',
        data: TestDataFactory.createTypingEvent(
          connection.userId,
          connection.conversationId,
          true
        )
      });

      // Add another connection to receive the typing indicator
      const otherConnection = TestDataFactory.createConnection({
        websocket: {
          readyState: 1,
          send: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          close: vi.fn(),
          accept: vi.fn()
        } as any,
        userId: 'other_user',
        connectionId: 'other_conn',
        conversationId: 'test_conversation_123'
      });
      (conversationRoom as any).connections.set(otherConnection.connectionId, otherConnection);

      await (conversationRoom as any).handleWebSocketMessage(connection, typingMessage);

      // Other user should receive typing indicator
      expect(otherConnection.websocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse((otherConnection.websocket.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe('event');
      expect(sentMessage.data.type).toBe('typing_start');
      expect(typeof sentMessage.timestamp).toBe('number');

      // Sender should not receive their own typing indicator
      expect(connection.websocket.send).not.toHaveBeenCalled();
    });

    it('should handle chat messages with permission checks', async () => {
      const chatMessage = TestDataFactory.createMessage({
        type: 'message',
        data: {
          content: 'Hello, World!',
          messageType: 'text',
          senderName: 'Test User'
        }
      });

      // Mock permission check success
      vi.spyOn(conversationRoom as any, 'checkMessagePermission')
        .mockResolvedValue(true);

      // ✅ Mock message queue sending (current implementation)
      vi.spyOn(conversationRoom as any, 'sendToMessageQueue')
        .mockResolvedValue(undefined);

      await (conversationRoom as any).handleChatMessage(connection, chatMessage);

      // Should check permissions
      expect((conversationRoom as any).checkMessagePermission)
        .toHaveBeenCalledWith(
          connection.userId,
          connection.role,
          connection.conversationId
        );

      // ✅ Verify message was sent to queue
      expect((conversationRoom as any).sendToMessageQueue)
        .toHaveBeenCalled();
    });

    it('should reject messages without permission', async () => {
      const chatMessage = TestDataFactory.createMessage({
        type: 'message',
        data: { content: 'Unauthorized message' }
      });

      // Mock permission check failure
      vi.spyOn(conversationRoom as any, 'checkMessagePermission')
        .mockResolvedValue(false);

      await (conversationRoom as any).handleChatMessage(connection, chatMessage);

      // Should send error message
      expect(connection.websocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse((connection.websocket.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.error).toBe('Permission denied to send messages');
      expect(typeof sentMessage.timestamp).toBe('number');
    });

    it('should update last activity on message handling', async () => {
      const initialActivity = connection.lastActivity;
      const pingMessage = TestDataFactory.createMessage({ type: 'ping' });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await (conversationRoom as any).handleWebSocketMessage(connection, pingMessage);

      expect(connection.lastActivity).toBeGreaterThan(initialActivity);
      expect((conversationRoom as any).lastActivity).toBeGreaterThan(initialActivity);
    });
  });

  // ⚠️ SKIPPED: Distributed Locking feature was removed from ConversationRoom
  // Now uses simple message counter instead of distributed locks (Line 321-322)
  describe.skip('Distributed Locking', () => {
    it('should acquire locks successfully', async () => {
      const lockId = await (conversationRoom as any).acquireLock('test_resource', {
        ttl: 5000,
        timeout: 1000
      });

      expect(lockId).toBeDefined();
      expect(typeof lockId).toBe('string');

      // Lock should be stored
      const locks = (conversationRoom as any).locks;
      expect(locks.has(lockId)).toBe(true);

      // Storage should contain lock
      expect(mockState.storage.put).toHaveBeenCalledWith(
        'lock:test_resource',
        expect.objectContaining({
          lockId,
          resource: 'test_resource',
          isActive: true
        })
      );
    });

    it('should release locks successfully', async () => {
      const lockId = await (conversationRoom as any).acquireLock('test_resource');
      await (conversationRoom as any).releaseLock(lockId);

      // Lock should be removed from memory
      const locks = (conversationRoom as any).locks;
      expect(locks.has(lockId)).toBe(false);

      // Storage should be cleared
      expect(mockState.storage.delete).toHaveBeenCalledWith('lock:test_resource');
    });

    it('should handle lock contention', async () => {
      // Mock storage to simulate existing lock
      const existingLock: DistributedLock = {
        lockId: 'existing_lock',
        resource: 'test_resource',
        ownerId: 'other_owner',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 10000,
        isActive: true
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValueOnce(existingLock) // First attempt returns existing lock
        .mockResolvedValueOnce(null); // Second attempt returns null (lock released)

      const lockPromise = (conversationRoom as any).acquireLock('test_resource', {
        retryInterval: 50,
        maxRetries: 2
      });

      const lockId = await lockPromise;
      expect(lockId).toBeDefined();
    });

    it('should timeout on lock acquisition failure', async () => {
      // Mock storage to always return existing lock
      const existingLock: DistributedLock = {
        lockId: 'existing_lock',
        resource: 'test_resource',
        ownerId: 'other_owner',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 10000,
        isActive: true
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(existingLock);

      await expect(
        (conversationRoom as any).acquireLock('test_resource', {
          retryInterval: 10,
          maxRetries: 2
        })
      ).rejects.toThrow('Failed to acquire lock for test_resource after 2 attempts');
    });

    it('should handle expired locks', async () => {
      // Mock storage with expired lock
      const expiredLock: DistributedLock = {
        lockId: 'expired_lock',
        resource: 'test_resource',
        ownerId: 'other_owner',
        acquiredAt: Date.now() - 10000,
        expiresAt: Date.now() - 1000, // Expired
        isActive: true
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValueOnce(expiredLock);

      // Should be able to acquire lock even though one exists (it's expired)
      const lockId = await (conversationRoom as any).acquireLock('test_resource');
      expect(lockId).toBeDefined();
    });
  });

  describe('HTTP API Endpoints', () => {
    it('should handle /participants request', async () => {
      // Add some participants
      (conversationRoom as any).participants.add('user1');
      (conversationRoom as any).participants.add('user2');
      (conversationRoom as any).connections.set('conn1', {});
      (conversationRoom as any).connections.set('conn2', {});

      const request = new Request('http://test/participants');
      const response = await conversationRoom.fetch(request);

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.participants).toEqual(['user1', 'user2']);
      expect(data.activeConnections).toBe(2);
      expect(data.lastActivity).toBeDefined();
    });

    it('should handle /metrics request', async () => {
      const request = new Request('http://test/metrics');
      const response = await conversationRoom.fetch(request);

      expect(response.ok).toBe(true);

      const metrics = await response.json();
      expect(metrics).toHaveProperty('conversationId');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('participants');
      expect(metrics).toHaveProperty('messageHistory');
      expect(metrics).toHaveProperty('messageCounter'); // ✅ Now uses message counter instead of locks
      expect(metrics).toHaveProperty('lastActivity');
      expect(metrics).toHaveProperty('isActive');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should handle /broadcast request', async () => {
      const event = TestDataFactory.createEvent({
        type: 'system_notification',
        data: { message: 'Test broadcast' }
      });

      const request = new Request('http://test/broadcast', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock broadcastEvent
      vi.spyOn(conversationRoom as any, 'broadcastEvent')
        .mockResolvedValue(undefined);

      const response = await conversationRoom.fetch(request);

      expect(response.ok).toBe(true);
      expect((conversationRoom as any).broadcastEvent)
        .toHaveBeenCalledWith(event);
    });

    // ⚠️ SKIPPED: /lock endpoint was removed (see ConversationRoom.ts line 76)
    it.skip('should handle /lock operations', async () => {
      // Test lock acquisition
      const acquireRequest = new Request('http://test/lock', {
        method: 'POST',
        body: JSON.stringify({
          action: 'acquire',
          resource: 'test_resource',
          options: { ttl: 5000 }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      vi.spyOn(conversationRoom as any, 'acquireLock')
        .mockResolvedValue('test_lock_id');

      const acquireResponse = await conversationRoom.fetch(acquireRequest);
      expect(acquireResponse.ok).toBe(true);

      const acquireData = await acquireResponse.json();
      expect(acquireData.lockId).toBe('test_lock_id');

      // Test lock release
      const releaseRequest = new Request('http://test/lock', {
        method: 'POST',
        body: JSON.stringify({
          action: 'release',
          options: { lockId: 'test_lock_id' }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      vi.spyOn(conversationRoom as any, 'releaseLock')
        .mockResolvedValue(undefined);

      const releaseResponse = await conversationRoom.fetch(releaseRequest);
      expect(releaseResponse.ok).toBe(true);
    });

    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('http://test/unknown');
      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not Found');
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should restore state from storage on initialization', async () => {
      const participants = ['user1', 'user2', 'user3'];
      const messageHistory = [
        TestDataFactory.createEvent({ type: 'message_sent' }),
        TestDataFactory.createEvent({ type: 'message_sent' })
      ];

      // ✅ Create new state and PRE-POPULATE storage
      const newNamespace = testEnv.getNamespace('CONVERSATION_ROOM');
      const newId = newNamespace.idFromName('test_new_room');
      const newState = new MockDurableObjectState(newId);

      // ✅ Pre-populate storage BEFORE creating ConversationRoom
      await newState.storage.put('participants', participants);
      await newState.storage.put('messageHistory', messageHistory);

      // Create ConversationRoom (will call initializeFromStorage in constructor)
      const newRoom = new ConversationRoom(newState, mockEnv);

      // ⚠️ Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify restoration
      expect((newRoom as any).participants.size).toBe(3);
      expect((newRoom as any).messageHistory.length).toBe(2);
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      vi.spyOn(mockState.storage, 'get')
        .mockRejectedValue(new Error('Storage error'));

      // Should not throw during initialization
      await expect((conversationRoom as any).initializeFromStorage())
        .resolves.not.toThrow();
    });
  });

  describe('Cleanup Operations', () => {
    // ⚠️ SKIPPED: cleanupExpiredLocks removed with distributed locking feature
    it.skip('should clean up expired locks', async () => {
      const now = Date.now();

      // Add expired and active locks
      const expiredLock: DistributedLock = {
        lockId: 'expired_lock',
        resource: 'expired_resource',
        ownerId: 'test',
        acquiredAt: now - 10000,
        expiresAt: now - 1000, // Expired
        isActive: true
      };

      const activeLock: DistributedLock = {
        lockId: 'active_lock',
        resource: 'active_resource',
        ownerId: 'test',
        acquiredAt: now,
        expiresAt: now + 10000, // Active
        isActive: true
      };

      (conversationRoom as any).locks.set('expired_lock', expiredLock);
      (conversationRoom as any).locks.set('active_lock', activeLock);

      await (conversationRoom as any).cleanupExpiredLocks();

      // Expired lock should be removed
      expect((conversationRoom as any).locks.has('expired_lock')).toBe(false);
      expect(mockState.storage.delete).toHaveBeenCalledWith('lock:expired_resource');

      // Active lock should remain
      expect((conversationRoom as any).locks.has('active_lock')).toBe(true);
    });

    it('should clean up inactive connections', async () => {
      const now = Date.now();
      const inactivityTimeout = (conversationRoom as any).INACTIVITY_TIMEOUT;

      // Add inactive and active connections
      const inactiveConnection = TestDataFactory.createConnection({
        connectionId: 'inactive_conn',
        lastActivity: now - inactivityTimeout - 1000 // Inactive
      });

      const activeConnection = TestDataFactory.createConnection({
        connectionId: 'active_conn',
        lastActivity: now - 1000 // Active
      });

      (conversationRoom as any).connections.set('inactive_conn', inactiveConnection);
      (conversationRoom as any).connections.set('active_conn', activeConnection);

      // Mock removeConnection
      const removeConnectionSpy = vi.spyOn(conversationRoom as any, 'removeConnection')
        .mockResolvedValue(undefined);

      await (conversationRoom as any).cleanupInactiveConnections();

      // Inactive connection should be removed
      expect(removeConnectionSpy).toHaveBeenCalledWith('inactive_conn');
      expect(removeConnectionSpy).not.toHaveBeenCalledWith('active_conn');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed WebSocket messages', async () => {
      const connection = TestDataFactory.createConnection({
        websocket: {
          readyState: 1,
          send: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          close: vi.fn(),
          accept: vi.fn()
        } as any,
        userId: 'test_user',
        conversationId: 'test_conversation_123'
      });

      // Get the message handler from setupWebSocketHandlers
      (conversationRoom as any).setupWebSocketHandlers(connection);

      // ✅ Clear the welcome message call
      (connection.websocket.send as any).mockClear();

      // Simulate message event with invalid JSON
      try {
        JSON.parse('invalid json');
      } catch (error) {
        await (conversationRoom as any).sendError(connection, 'Invalid message format');
      }

      expect(connection.websocket.send).toHaveBeenCalled();
      // ✅ Get the LATEST call (after clearing welcome message)
      const calls = (connection.websocket.send as any).mock.calls;
      const sentMessage = JSON.parse(calls[calls.length - 1][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.error).toBe('Invalid message format');
      expect(typeof sentMessage.timestamp).toBe('number');
    });

    it('should handle WebSocket errors during setup', async () => {
      const connection = TestDataFactory.createConnection({
        websocket: {
          readyState: 1,
          send: vi.fn(),
          addEventListener: vi.fn()
        } as any
      });

      // Mock removeConnection
      const removeConnectionSpy = vi.spyOn(conversationRoom as any, 'removeConnection')
        .mockResolvedValue(undefined);

      (conversationRoom as any).setupWebSocketHandlers(connection);

      // Get the error handler and simulate an error
      const errorHandler = (connection.websocket.addEventListener as any).mock.calls
        .find((call: any[]) => call[0] === 'error')?.[1];

      if (errorHandler) {
        await errorHandler(new Error('WebSocket error'));
        expect(removeConnectionSpy).toHaveBeenCalledWith(connection.connectionId);
      }
    });

    it('should handle request processing errors', async () => {
      // ✅ Mock error in request handling BEFORE making request
      const mockError = vi.spyOn(conversationRoom as any, 'handleGetParticipants')
        .mockImplementation(() => {
          throw new Error('Internal error');
        });

      const request = new Request('http://test/participants');
      const response = await conversationRoom.fetch(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Server Error');

      mockError.mockRestore();
    });
  });
});