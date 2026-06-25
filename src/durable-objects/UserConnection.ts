// UserConnection Durable Object
// Manages user's global connection state and cross-conversation subscriptions
// Delegates to focused sub-modules for state, subscriptions, and security

import type {
  WebSocketConnection,
  WebSocketMessage,
  WebSocketSubscription,
  DurableObjectEvent
} from '../types/websocket-types';
import { nowISO, nowMs } from '@/utils/timestamp';
import { UserConnectionStateManager } from './user-connection-state';
import { UserSubscriptionManager } from './user-subscription-manager';
import { UserConnectionSecurity } from './user-connection-security';

type UserConnectionEnv = Record<string, unknown> & {
  userId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Architecture Overview:
 *
 * UserConnection Durable Object manages:
 * 1. User's global connection state across all conversations
 * 2. Cross-conversation subscriptions and notifications
 * 3. User presence and availability status
 * 4. Connection multiplexing and load balancing
 * 5. User-specific preferences and settings
 *
 * Each user gets their own Durable Object instance identified by userId
 * This enables efficient user-centric operations and presence management
 *
 * Delegates to:
 * - UserConnectionStateManager: connection lifecycle, presence, preferences, metrics
 * - UserSubscriptionManager: conversation subscriptions, permission checks, broadcaster registration
 * - UserConnectionSecurity: rate limiting, auth verification, message validation
 */

export class UserConnection implements DurableObject {
  private state: DurableObjectState;
  private env: UserConnectionEnv;
  private userId: string;

  // Sub-module delegates
  private readonly stateManager = new UserConnectionStateManager();
  private readonly subscriptionManager = new UserSubscriptionManager();
  private readonly security = new UserConnectionSecurity();

  constructor(state: DurableObjectState, env: UserConnectionEnv) {
    this.state = state;
    this.env = env;
    this.userId = env.userId || 'unknown';
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    this.restoreConnectionsFromHibernation();

    // Initialize from storage
    this.initializeFromStorage();
  }

  // =================== Main Request Handler ===================

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle WebSocket upgrade for user connection
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request);
      }

      // Handle HTTP API requests
      switch (pathname) {
        case '/connect':
          return this.handleConnectToConversation(request);
        case '/disconnect':
          return this.handleDisconnectFromConversation(request);
        case '/subscribe':
          return this.handleSubscribe(request);
        case '/unsubscribe':
          return this.handleUnsubscribe(request);
        case '/presence':
          return this.handlePresenceUpdate(request);
        case '/preferences':
          return this.handlePreferences(request);
        case '/status':
          return this.handleGetStatus(request);
        case '/broadcast':
          return this.handleBroadcastToUser(request);
        case '/batch-events':
          // Phase B4: Handle batch events from MessageBroadcaster for global broadcasts
          return this.handleBatchEvents(request);
        case '/metrics':
          return this.handleGetMetrics(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('[UserConnection] Request handling error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // =================== WebSocket Connection Management ===================

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const token = url.searchParams.get('token');
      const role = url.searchParams.get('role') as 'admin' | 'agent';
      const deviceId = url.searchParams.get('deviceId') || 'unknown';
      // FIX: Get userId from URL params instead of this.userId (always 'unknown')
      const userId = url.searchParams.get('userId');

      if (!token || !role) {
        return new Response('Missing required parameters', { status: 400 });
      }

      if (!userId) {
        console.error('[UserConnection] Missing userId parameter in WebSocket upgrade request');
        return new Response('Missing userId parameter', { status: 400 });
      }

      // Verify authentication
      const isAuthenticated = await this.security.verifyAuthToken(token, userId, this.env);
      if (!isAuthenticated) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Update userId to actual user ID
      this.userId = userId;

      // Check connection limits
      if (this.stateManager.isAtConnectionLimit()) {
        return new Response('Connection limit reached', { status: 429 });
      }

      // Create WebSocket pair
      const [client, server] = Object.values(new WebSocketPair());

      // Type guard to ensure WebSocket objects are valid
      if (!client || !server) {
        throw new Error('Failed to create WebSocket pair');
      }

      const connectionId = this.stateManager.generateConnectionId();
      const tokenExp = Number(url.searchParams.get('tokenExp'));
      const connection: WebSocketConnection = {
        websocket: server,
        userId: this.userId,
        role,
        connectionId,
        lastActivity: nowMs(),
        isActive: true,
        metadata: {
          deviceId,
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP'),
          connectedAt: nowMs(),
          tokenExp: Number.isFinite(tokenExp) && tokenExp > 0 ? tokenExp : undefined
        }
      };

      this.state.acceptWebSocket(server, [userId]);
      this.stateManager.updateConnectionAttachment(connection);

      await this.addConnection(connection);
      this.sendWelcomeMessage(connection);
      await this.scheduleNextTokenExpiryAlarm();

      console.log(`[UserConnection] WebSocket connected: ${connectionId} for user ${this.userId}`);
      return new Response(null, { status: 101, webSocket: client as WebSocket });

    } catch (error) {
      console.error('[UserConnection] WebSocket upgrade error:', error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  }

  private sendWelcomeMessage(connection: WebSocketConnection): void {
    const { connectionId } = connection;

    this.stateManager.sendMessage(connection, {
      type: 'event',
      data: {
        type: 'user_connected',
        userId: this.userId,
        connectionId,
        subscriptions: this.subscriptionManager.subscribedConversations,
        preferences: this.stateManager.currentPreferences,
        stats: this.stateManager.currentStats
      },
      timestamp: nowMs()
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const connection = this.stateManager.findConnectionForSocket(ws);
    if (!connection) {
      console.warn('[UserConnection] Message received for unknown hibernated socket');
      return;
    }

    try {
      const messageText = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const parsedMessage: WebSocketMessage = JSON.parse(messageText);
      await this.handleWebSocketMessage(connection, parsedMessage);
    } catch (error) {
      console.error(`[UserConnection] Message parsing error for ${connection.connectionId}:`, error);
      this.stateManager.sendError(connection, 'Invalid message format');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const connection = this.stateManager.findConnectionForSocket(ws);
    if (!connection) return;

    console.log(`[UserConnection] Connection closed: ${connection.connectionId}, code: ${code}`);
    await this.removeConnection(connection.connectionId);
    await this.scheduleNextTokenExpiryAlarm();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connection = this.stateManager.findConnectionForSocket(ws);
    if (!connection) return;

    console.error(`[UserConnection] WebSocket error for ${connection.connectionId}:`, error);
    await this.removeConnection(connection.connectionId);
    await this.scheduleNextTokenExpiryAlarm();
  }

  private async handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { connectionId } = connection;

    // SECURITY: Rate limiting check
    if (!this.security.checkRateLimit(connectionId)) {
      console.warn(`[UserConnection] Rate limit exceeded for connection ${connectionId}`);
      this.stateManager.sendError(connection, 'Rate limit exceeded. Please slow down.');
      return;
    }

    // SECURITY: Message size validation
    const messageJson = JSON.stringify(message);
    if (this.security.isMessageTooLarge(messageJson)) {
      console.warn(`[UserConnection] Message too large (${messageJson.length} bytes) from ${connectionId}`);
      this.stateManager.sendError(connection, `Message too large. Maximum size is ${this.security.getMaxMessageSize()} bytes.`);
      return;
    }

    // Update activity
    this.stateManager.updateActivity(connection);

    console.log(`[UserConnection] Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.stateManager.sendMessage(connection, { type: 'pong', timestamp: nowMs() });
        break;

      case 'subscribe':
        await this.handleSubscribeMessage(connection, message);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribeMessage(connection, message);
        break;

      case 'message':
        await this.handleChatMessage(connection, message);
        break;

      case 'event':
        await this.handleEventMessage(connection, message);
        break;

      default:
        this.stateManager.sendError(connection, `Unknown message type: ${message.type}`);
    }
  }

  // =================== Connection Lifecycle ===================

  private async addConnection(connection: WebSocketConnection): Promise<void> {
    const { connectionId } = connection;

    // Track if this is the first connection (for registration)
    const wasOffline = this.stateManager.wasOffline();

    // DEBUG: Log connection state before adding
    console.log(`[UserConnection] addConnection called:`, {
      connectionId,
      userId: this.userId,
      wasOffline,
      currentConnectionCount: this.stateManager.connectionCount
    });

    // Add to connections
    this.stateManager.addConnection(connection);

    // Persist connection info
    await this.stateManager.persistConnectionInfo(
      this.state.storage,
      connectionId,
      this.userId,
      connection.metadata?.deviceId
    );

    // Update user state
    await this.updateUserState();

    // Phase B4: Register with MessageBroadcaster for global broadcasts
    // Only register on first connection to avoid duplicate registrations
    console.log(`[UserConnection] Checking registration condition: wasOffline=${wasOffline}, userId=${this.userId}, shouldRegister=${wasOffline && this.userId !== 'unknown'}`);
    if (wasOffline && this.userId !== 'unknown') {
      await this.subscriptionManager.registerWithMessageBroadcaster(this.env, this.userId);
    } else {
      console.log(`[UserConnection] Skipping MessageBroadcaster registration: wasOffline=${wasOffline}, userId=${this.userId}`);
    }

    console.log(`[UserConnection] Connection added: ${connectionId} (Total: ${this.stateManager.connectionCount})`);
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.stateManager.removeConnection(connectionId);
    if (!connection) return;

    // SECURITY: Clean up rate limit state for this connection
    this.security.cleanupRateLimitState(connectionId);

    // If all connections closed, unregister from broadcaster
    if (!this.stateManager.online && this.userId !== 'unknown') {
      await this.subscriptionManager.unregisterFromMessageBroadcaster(this.env, this.userId);
    }

    // Clean up storage
    await this.stateManager.removeConnectionFromStorage(this.state.storage, connectionId);
    await this.updateUserState();

    console.log(`[UserConnection] Connection removed: ${connectionId} (Remaining: ${this.stateManager.connectionCount})`);
  }

  // =================== Simplified Subscription Management ===================

  private async handleConnectToConversation(request: Request): Promise<Response> {
    try {
      const { conversationId } = await request.json() as { conversationId: string };

      // Verify user has permission to join this conversation
      const hasPermission = await this.subscriptionManager.checkConversationPermission(this.env, this.userId, conversationId, 'view');
      if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 });
      }

      // Add to subscriptions
      this.subscriptionManager.addSubscription(conversationId);
      this.stateManager.incrementConversationsJoined();

      // Persist subscription
      await this.subscriptionManager.persistSubscriptions(this.state.storage);

      // Notify all user connections about new subscription
      await this.stateManager.broadcastToAllConnections(
        this.subscriptionManager.buildConversationSubscribedMessage(conversationId)
      );

      console.log(`[UserConnection] User ${this.userId} subscribed to conversation ${conversationId}`);

      return new Response(JSON.stringify({
        success: true,
        conversationId,
        subscriptionCount: this.subscriptionManager.subscriptionCount
      }));

    } catch (error) {
      console.error('[UserConnection] Connect to conversation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to connect to conversation' }), { status: 500 });
    }
  }

  private async handleDisconnectFromConversation(request: Request): Promise<Response> {
    try {
      const { conversationId } = await request.json() as { conversationId: string };

      // Remove from subscriptions
      this.subscriptionManager.removeSubscription(conversationId);

      // Persist subscriptions
      await this.subscriptionManager.persistSubscriptions(this.state.storage);

      // Notify user connections
      await this.stateManager.broadcastToAllConnections(
        this.subscriptionManager.buildConversationUnsubscribedMessage(conversationId)
      );

      console.log(`[UserConnection] User ${this.userId} unsubscribed from conversation ${conversationId}`);

      return new Response(JSON.stringify({
        success: true,
        conversationId,
        subscriptionCount: this.subscriptionManager.subscriptionCount
      }));

    } catch (error) {
      console.error('[UserConnection] Disconnect from conversation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to disconnect from conversation' }), { status: 500 });
    }
  }

  // =================== Message Handling ===================

  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { conversationId } = message;

    if (!conversationId) {
      this.stateManager.sendError(connection, 'Conversation ID required for chat messages');
      return;
    }

    // Check if user is subscribed to this conversation
    if (!this.subscriptionManager.isSubscribed(conversationId)) {
      this.stateManager.sendError(connection, 'Not subscribed to this conversation');
      return;
    }

    // Simplified: Just broadcast to user's connections (room handles actual message processing)
    const responseMessage: WebSocketMessage = {
      type: 'event',
      data: {
        type: 'message_acknowledged',
        messageId: message.id,
        conversationId,
        userId: this.userId
      },
      timestamp: nowMs()
    };

    this.stateManager.sendMessage(connection, responseMessage);
    this.stateManager.incrementMessagesSent();
    console.log(`[UserConnection] Message acknowledged for conversation ${conversationId}`);
  }

  // =================== Subscription Management ===================

  private async handleSubscribeMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { data } = message;
    const subscription = data as WebSocketSubscription;

    if (subscription.type === 'conversation' && typeof subscription.target === 'string') {
      const conversationId = subscription.target;

      // Check permission
      const hasPermission = await this.subscriptionManager.checkConversationPermission(this.env, this.userId, conversationId, 'view');
      if (!hasPermission) {
        this.stateManager.sendError(connection, 'Permission denied to subscribe to this conversation');
        return;
      }

      // Add subscription
      if (this.subscriptionManager.addSubscription(conversationId)) {
        await this.subscriptionManager.persistSubscriptions(this.state.storage);
        this.stateManager.sendMessage(connection, this.subscriptionManager.buildSubscriptionAddedMessage(subscription));
      } else {
        this.stateManager.sendError(connection, 'Maximum subscriptions reached');
      }
    }
  }

  private async handleUnsubscribeMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { data } = message;
    const subscription = data as WebSocketSubscription;

    if (subscription.type === 'conversation' && typeof subscription.target === 'string') {
      const conversationId = subscription.target;

      this.subscriptionManager.removeSubscription(conversationId);
      await this.subscriptionManager.persistSubscriptions(this.state.storage);
      this.stateManager.sendMessage(connection, this.subscriptionManager.buildSubscriptionRemovedMessage(subscription));
    }
  }

  // =================== Presence and Status ===================

  private async updateUserState(): Promise<void> {
    await this.stateManager.persistUserState(this.state.storage, this.userId, new Set(this.subscriptionManager.subscribedConversations));
  }

  // =================== Helper Methods ===================

  private async initializeFromStorage(): Promise<void> {
    await this.stateManager.initializeFromStorage(this.state.storage);
    await this.subscriptionManager.initializeFromStorage(this.state.storage);
    console.log(`[UserConnection] State restored for user ${this.userId}: ${this.subscriptionManager.subscriptionCount} subscriptions`);
  }

  private restoreConnectionsFromHibernation(): void {
    this.stateManager.restoreConnectionsFromAttachments(this.state.getWebSockets());
    const restoredConnection = this.stateManager.getAllConnections()[0];
    if (restoredConnection && this.userId === 'unknown') {
      this.userId = restoredConnection.userId;
    }
  }

  async alarm(): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredConnections = this.stateManager.getAllConnections().filter((connection) => {
      const tokenExp = connection.metadata?.tokenExp;
      return typeof tokenExp === 'number' && tokenExp <= nowSec;
    });

    for (const connection of expiredConnections) {
      try {
        connection.websocket.close(4401, 'Token expired');
      } catch (error) {
        console.warn('[UserConnection] token-expiry close failed', error);
      }
      await this.removeConnection(connection.connectionId);
    }

    await this.scheduleNextTokenExpiryAlarm();
  }

  private async scheduleNextTokenExpiryAlarm(): Promise<void> {
    let nextTokenExp: number | undefined;

    for (const connection of this.stateManager.getAllConnections()) {
      const tokenExp = connection.metadata?.tokenExp;
      if (typeof tokenExp !== 'number') {
        continue;
      }
      if (nextTokenExp === undefined || tokenExp < nextTokenExp) {
        nextTokenExp = tokenExp;
      }
    }

    if (nextTokenExp === undefined) {
      await this.state.storage.deleteAlarm();
      return;
    }

    await this.state.storage.setAlarm(Math.max(Date.now(), nextTokenExp * 1000));
  }

  // =================== HTTP API Handlers ===================

  private async handleSubscribe(request: Request): Promise<Response> {
    return this.handleConnectToConversation(request);
  }

  private async handleUnsubscribe(request: Request): Promise<Response> {
    return this.handleDisconnectFromConversation(request);
  }

  private async handlePresenceUpdate(request: Request): Promise<Response> {
    const { status: _status } = await request.json() as { status?: string };

    // Update user presence
    this.stateManager.updatePresence();
    await this.updateUserState();

    return new Response(JSON.stringify({
      success: true,
      isOnline: this.stateManager.online,
      lastSeen: this.stateManager.currentLastSeen
    }));
  }

  private async handlePreferences(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(this.stateManager.currentPreferences));
    } else if (request.method === 'PUT') {
      const newPreferences = await request.json() as Record<string, unknown>;
      const updated = this.stateManager.updatePreferences(newPreferences);
      await this.updateUserState();
      return new Response(JSON.stringify(updated));
    }

    return new Response('Method not allowed', { status: 405 });
  }

  private async handleGetStatus(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      ...this.stateManager.getStatusSnapshot(this.userId),
      subscriptionCount: this.subscriptionManager.subscriptionCount,
    }));
  }

  private async handleBroadcastToUser(request: Request): Promise<Response> {
    const message = await request.json() as WebSocketMessage;
    await this.stateManager.broadcastToAllConnections(message);
    return new Response(JSON.stringify({ success: true }));
  }

  /**
   * Phase B4: Handle batch events from MessageBroadcaster
   * This enables global broadcasts to reach users viewing the conversation list
   */
  private async handleBatchEvents(request: Request): Promise<Response> {
    try {
      const { events } = await request.json() as { events?: DurableObjectEvent[] };

      // ENHANCED DEBUG: Log received batch events with full details for duplicate tracking
      console.log(`[UserConnection] ===== BATCH EVENTS RECEIVED =====`);
      console.log(`[UserConnection] User: ${this.userId}, Connections: ${this.stateManager.connectionCount}`);
      for (const event of (events || [])) {
        const eventData = isRecord(event.data) ? event.data : {};
        console.log(`[UserConnection] Event detail:`, {
          userId: this.userId,
          eventId: event.id,
          eventType: event.type,
          eventAction: eventData.action,
          conversationId: event.conversationId,
          fromTeamId: eventData.fromTeamId,
          toTeamId: eventData.toTeamId,
          timestamp: nowISO()
        });
      }

      if (!events || !Array.isArray(events)) {
        return new Response(JSON.stringify({ error: 'Invalid events format' }), { status: 400 });
      }

      let deliveredCount = 0;

      for (const event of events) {
        // Convert DurableObjectEvent to WebSocketMessage format
        const message: WebSocketMessage = {
          type: 'event',
          data: event,
          conversationId: event.conversationId,
          timestamp: event.timestamp || nowMs()
        };

        // DEBUG: Log message being broadcast
        console.log(`[UserConnection] Broadcasting to ${this.stateManager.connectionCount} WebSocket connections:`, {
          messageType: message.type,
          conversationId: message.conversationId
        });

        // Broadcast to all user connections
        await this.stateManager.broadcastToAllConnections(message);
        deliveredCount++;
      }

      console.log(`[UserConnection] Batch events delivered: ${deliveredCount} events to user ${this.userId} (${this.stateManager.connectionCount} connections)`);

      return new Response(JSON.stringify({
        success: true,
        deliveredCount,
        userId: this.userId,
        activeConnections: this.stateManager.connectionCount
      }));
    } catch (error) {
      console.error('[UserConnection] Batch events error:', error);
      return new Response(JSON.stringify({ error: 'Failed to process batch events' }), { status: 500 });
    }
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      ...this.stateManager.getMetricsSnapshot(this.userId),
      subscriptions: this.subscriptionManager.subscriptionCount,
    }));
  }

  private async handleEventMessage(_connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const event = message.data as DurableObjectEvent;

    // Simplified event handling - just acknowledge
    switch (event.type) {
      case 'typing_start':
      case 'typing_stop':
        // Simply broadcast to other user connections
        await this.stateManager.broadcastToAllConnections({
          type: 'event',
          data: event,
          timestamp: nowMs()
        });
        break;

      default:
        console.log(`[UserConnection] Event acknowledged: ${event.type}`);
    }
  }
}
