// UserConnection Durable Object
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 管理用戶的全域連接狀態和跨對話訂閱

import type {
  WebSocketConnection,
  WebSocketMessage,
  WebSocketSubscription,
  DurableObjectEvent
} from '../types/websocket-types';

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
 */

export class UserConnection implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private userId: string;
  private connections = new Map<string, WebSocketConnection>();
  private subscriptions = new Set<string>(); // conversation IDs
  private isOnline = false;
  private lastSeen = Date.now();
  private preferences = {
    notificationSettings: {
      newMessage: true,
      messageRecall: true,
      conversationAssignment: true,
      systemNotifications: true
    }
  };

  // Metrics
  private stats = {
    totalConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    conversationsJoined: 0,
    lastActivity: Date.now()
  };

  // Configuration
  private readonly MAX_CONNECTIONS_PER_USER = 5; // Reduced from 10
  private readonly MAX_SUBSCRIPTIONS = 50; // Reduced from 100
  private readonly CONNECTION_CLEANUP_INTERVAL = 300000; // 5 minutes

  // SECURITY: Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
  private readonly RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per second
  private readonly RATE_LIMIT_MAX_MESSAGE_SIZE = 10240; // 10KB max message size
  private rateLimitState = new Map<string, { count: number; windowStart: number }>();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.userId = env.userId || 'unknown';

    // Initialize from storage
    this.initializeFromStorage();

    // Set up periodic tasks
    this.setupPeriodicTasks();
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
        case '/metrics':
          return this.handleGetMetrics(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [UserConnection] Request handling error:', error);
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
      // 🔧 FIX: 從 URL 參數獲取 userId，而不是使用 this.userId (永遠是 'unknown')
      // websocket-main.ts 在轉發請求時已經將 userId 添加到 URL 參數中
      const userId = url.searchParams.get('userId');

      if (!token || !role) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // 🔧 FIX: 驗證 userId 參數存在
      if (!userId) {
        console.error('❌ [UserConnection] Missing userId parameter in WebSocket upgrade request');
        return new Response('Missing userId parameter', { status: 400 });
      }

      // Verify authentication
      // 🔧 FIX: 使用從 URL 參數獲取的 userId，而不是 this.userId
      const isAuthenticated = await this.verifyAuthToken(token, userId);
      if (!isAuthenticated) {
        return new Response('Unauthorized', { status: 401 });
      }

      // 🔧 FIX: 更新 this.userId 為實際的用戶 ID
      this.userId = userId;

      // Check connection limits
      if (this.connections.size >= this.MAX_CONNECTIONS_PER_USER) {
        return new Response('Connection limit reached', { status: 429 });
      }

      // Create WebSocket pair
      const [client, server] = Object.values(new WebSocketPair());

      // Type guard to ensure WebSocket objects are valid
      if (!client || !server) {
        throw new Error('Failed to create WebSocket pair');
      }

      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        websocket: server,
        userId: this.userId,
        role,
        connectionId,
        lastActivity: Date.now(),
        isActive: true,
        metadata: {
          deviceId,
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP'),
          connectedAt: Date.now()
        }
      };

      // Set up WebSocket handlers
      this.setupWebSocketHandlers(connection);

      // Add connection
      await this.addConnection(connection);

      // Accept WebSocket
      server.accept();

      console.log(`✅ [UserConnection] WebSocket connected: ${connectionId} for user ${this.userId}`);
      return new Response(null, { status: 101, webSocket: client as WebSocket });

    } catch (error) {
      console.error('❌ [UserConnection] WebSocket upgrade error:', error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  }

  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { websocket, connectionId } = connection;

    websocket.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(connection, message);
      } catch (error) {
        console.error(`❌ [UserConnection] Message parsing error for ${connectionId}:`, error);
        this.sendError(connection, 'Invalid message format');
      }
    });

    websocket.addEventListener('close', async (event) => {
      console.log(`🔌 [UserConnection] Connection closed: ${connectionId}, code: ${event.code}`);
      await this.removeConnection(connectionId);
    });

    websocket.addEventListener('error', async (event) => {
      console.error(`❌ [UserConnection] WebSocket error for ${connectionId}:`, event);
      await this.removeConnection(connectionId);
    });

    // Send welcome message with user state
    this.sendMessage(connection, {
      type: 'event',
      data: {
        type: 'user_connected',
        userId: this.userId,
        connectionId,
        subscriptions: Array.from(this.subscriptions),
        preferences: this.preferences,
        stats: this.stats
      },
      timestamp: Date.now()
    });
  }

  private async handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { connectionId } = connection;

    // SECURITY: Rate limiting check
    if (!this.checkRateLimit(connectionId)) {
      console.warn(`⚠️ [UserConnection] Rate limit exceeded for connection ${connectionId}`);
      this.sendError(connection, 'Rate limit exceeded. Please slow down.');
      return;
    }

    // SECURITY: Message size validation
    const messageSize = JSON.stringify(message).length;
    if (messageSize > this.RATE_LIMIT_MAX_MESSAGE_SIZE) {
      console.warn(`⚠️ [UserConnection] Message too large (${messageSize} bytes) from ${connectionId}`);
      this.sendError(connection, `Message too large. Maximum size is ${this.RATE_LIMIT_MAX_MESSAGE_SIZE} bytes.`);
      return;
    }

    // Update activity
    connection.lastActivity = Date.now();
    this.lastSeen = Date.now();
    this.stats.lastActivity = Date.now();

    console.log(`📨 [UserConnection] Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.sendMessage(connection, { type: 'pong', timestamp: Date.now() });
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
        this.sendError(connection, `Unknown message type: ${message.type}`);
    }
  }

  // =================== Connection Lifecycle ===================

  private async addConnection(connection: WebSocketConnection): Promise<void> {
    const { connectionId } = connection;

    // Add to connections
    this.connections.set(connectionId, connection);
    this.isOnline = true;
    this.stats.totalConnections++;

    // Persist connection info
    await this.state.storage.put(`connection:${connectionId}`, {
      userId: this.userId,
      connectedAt: Date.now(),
      deviceId: connection.metadata?.deviceId,
      lastActivity: connection.lastActivity
    });

    // Update user state
    await this.updateUserState();

    // User came online - simplified notification

    console.log(`✅ [UserConnection] Connection added: ${connectionId} (Total: ${this.connections.size})`);
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove connection
    this.connections.delete(connectionId);

    // SECURITY: Clean up rate limit state for this connection
    this.cleanupRateLimitState(connectionId);

    // Update online status
    this.isOnline = this.connections.size > 0;
    if (!this.isOnline) {
      this.lastSeen = Date.now();
    }

    // Clean up storage
    await this.state.storage.delete(`connection:${connectionId}`);
    await this.updateUserState();

    // User went offline - simplified handling

    console.log(`🔌 [UserConnection] Connection removed: ${connectionId} (Remaining: ${this.connections.size})`);
  }

  // =================== Simplified Subscription Management ===================

  private async handleConnectToConversation(request: Request): Promise<Response> {
    try {
      const { conversationId } = await request.json() as { conversationId: string };

      // Verify user has permission to join this conversation
      const hasPermission = await this.checkConversationPermission(this.userId, conversationId, 'view');
      if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 });
      }

      // Add to subscriptions (simplified - no complex room coordination)
      this.subscriptions.add(conversationId);
      this.stats.conversationsJoined++;

      // Persist subscription
      await this.state.storage.put('subscriptions', Array.from(this.subscriptions));

      // Notify all user connections about new subscription
      await this.broadcastToUserConnections({
        type: 'event',
        data: {
          type: 'conversation_subscribed',
          conversationId,
          subscriptionCount: this.subscriptions.size
        },
        timestamp: Date.now()
      });

      console.log(`🔔 [UserConnection] User ${this.userId} subscribed to conversation ${conversationId}`);

      return new Response(JSON.stringify({
        success: true,
        conversationId,
        subscriptionCount: this.subscriptions.size
      }));

    } catch (error) {
      console.error('❌ [UserConnection] Connect to conversation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to connect to conversation' }), { status: 500 });
    }
  }

  private async handleDisconnectFromConversation(request: Request): Promise<Response> {
    try {
      const { conversationId } = await request.json() as { conversationId: string };

      // Remove from subscriptions (simplified)
      this.subscriptions.delete(conversationId);

      // Persist subscriptions
      await this.state.storage.put('subscriptions', Array.from(this.subscriptions));

      // Notify user connections
      await this.broadcastToUserConnections({
        type: 'event',
        data: {
          type: 'conversation_unsubscribed',
          conversationId,
          subscriptionCount: this.subscriptions.size
        },
        timestamp: Date.now()
      });

      console.log(`🔕 [UserConnection] User ${this.userId} unsubscribed from conversation ${conversationId}`);

      return new Response(JSON.stringify({
        success: true,
        conversationId,
        subscriptionCount: this.subscriptions.size
      }));

    } catch (error) {
      console.error('❌ [UserConnection] Disconnect from conversation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to disconnect from conversation' }), { status: 500 });
    }
  }

  // =================== Message Handling ===================

  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { conversationId } = message;

    if (!conversationId) {
      this.sendError(connection, 'Conversation ID required for chat messages');
      return;
    }

    // Check if user is subscribed to this conversation
    if (!this.subscriptions.has(conversationId)) {
      this.sendError(connection, 'Not subscribed to this conversation');
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
      timestamp: Date.now()
    };

    this.sendMessage(connection, responseMessage);
    this.stats.messagesSent++;
    console.log(`📤 [UserConnection] Message acknowledged for conversation ${conversationId}`);
  }

  private async broadcastToUserConnections(message: WebSocketMessage): Promise<void> {
    const broadcasts = Array.from(this.connections.values()).map(connection => {
      return this.sendMessage(connection, message);
    });

    await Promise.allSettled(broadcasts);
    console.log(`📡 [UserConnection] Message broadcast to ${this.connections.size} connections`);
  }

  private sendMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (connection.websocket.readyState === 1) { // WebSocket.OPEN = 1
          connection.websocket.send(JSON.stringify(message));
          connection.lastActivity = Date.now();
        }
        resolve();
      } catch (error) {
        console.error(`❌ [UserConnection] Send message error for ${connection.connectionId}:`, error);
        resolve();
      }
    });
  }

  private sendError(connection: WebSocketConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  // =================== Subscription Management ===================

  private async handleSubscribeMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { data } = message;
    const subscription = data as WebSocketSubscription;

    if (subscription.type === 'conversation' && typeof subscription.target === 'string') {
      const conversationId = subscription.target;

      // Check permission
      const hasPermission = await this.checkConversationPermission(this.userId, conversationId, 'view');
      if (!hasPermission) {
        this.sendError(connection, 'Permission denied to subscribe to this conversation');
        return;
      }

      // Add subscription
      if (this.subscriptions.size < this.MAX_SUBSCRIPTIONS) {
        this.subscriptions.add(conversationId);
        await this.state.storage.put('subscriptions', Array.from(this.subscriptions));

        this.sendMessage(connection, {
          type: 'event',
          data: {
            type: 'subscription_added',
            subscription,
            subscriptionCount: this.subscriptions.size
          },
          timestamp: Date.now()
        });
      } else {
        this.sendError(connection, 'Maximum subscriptions reached');
      }
    }
  }

  private async handleUnsubscribeMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { data } = message;
    const subscription = data as WebSocketSubscription;

    if (subscription.type === 'conversation' && typeof subscription.target === 'string') {
      const conversationId = subscription.target;

      this.subscriptions.delete(conversationId);

      await this.state.storage.put('subscriptions', Array.from(this.subscriptions));

      this.sendMessage(connection, {
        type: 'event',
        data: {
          type: 'subscription_removed',
          subscription,
          subscriptionCount: this.subscriptions.size
        },
        timestamp: Date.now()
      });
    }
  }

  // =================== Presence and Status ===================

  private async updateUserState(): Promise<void> {
    const state = {
      userId: this.userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connectionCount: this.connections.size,
      subscriptions: Array.from(this.subscriptions),
      preferences: this.preferences,
      stats: { ...this.stats }
    };

    await this.state.storage.put('userState', state);
  }

  // Removed complex room notification methods - simplified presence handling

  // =================== Helper Methods ===================

  private async initializeFromStorage(): Promise<void> {
    try {
      // Restore user state
      const userState = await this.state.storage.get('userState') as any;
      if (userState) {
        this.isOnline = userState.isOnline || false;
        this.lastSeen = userState.lastSeen || Date.now();
        this.preferences = { ...this.preferences, ...userState.preferences };
        this.stats = { ...this.stats, ...userState.stats };
      }

      // Restore subscriptions
      const subscriptions = await this.state.storage.get('subscriptions') as string[];
      if (subscriptions) {
        this.subscriptions = new Set(subscriptions);
      }

      console.log(`📂 [UserConnection] State restored for user ${this.userId}: ${this.subscriptions.size} subscriptions`);
    } catch (error) {
      console.error('❌ [UserConnection] State restoration error:', error);
    }
  }

  private setupPeriodicTasks(): void {
    // Clean up inactive connections only (simplified)
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, this.CONNECTION_CLEANUP_INTERVAL);
  }

  private async cleanupInactiveConnections(): Promise<void> {
    const now = Date.now();
    const inactiveThreshold = 600000; // 10 minutes

    const inactiveConnections = Array.from(this.connections.entries())
      .filter(([_, connection]) => now - connection.lastActivity > inactiveThreshold);

    for (const [connectionId, _connection] of inactiveConnections) {
      console.log(`🧹 [UserConnection] Removing inactive connection: ${connectionId}`);
      await this.removeConnection(connectionId);
    }
  }

  private async verifyAuthToken(token: string, userId: string): Promise<boolean> {
    try {
      // Import JWT verification utility
      const { verifyJWT } = await import('../utils/auth');
      if (!this.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      const payload = await verifyJWT(token, this.env.JWT_SECRET);

      // Verify that the token belongs to the expected user
      if (payload.userId !== userId) {
        console.error(`❌ [UserConnection] Token userId mismatch: expected ${userId}, got ${payload.userId}`);
        return false;
      }

      console.log(`✅ [UserConnection] Token valid for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ [UserConnection] Token validation failed:', error);
      return false;
    }
  }

  private async checkConversationPermission(userId: string, conversationId: string, action: string): Promise<boolean> {
    // Security: Actually validate conversation access through database
    try {
      // Import schema and drizzle for database access
      const { drizzle } = await import('drizzle-orm/d1');
      const { eq, and } = await import('drizzle-orm');
      const schema = await import('../db/schema');

      const db = drizzle(this.env.DB, { schema });

      // Get the conversation
      const conversation = await db
        .select({
          id: schema.conversations.id,
          assignedUserId: schema.conversations.assignedUserId,
          assignedTeamId: schema.conversations.assignedTeamId,
        })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .get();

      if (!conversation) {
        console.warn(`❌ [UserConnection] Conversation ${conversationId} not found`);
        return false;
      }

      // Get the user's role and team
      const user = await db
        .select({
          id: schema.agents.id,
          role: schema.agents.role,
          teamId: schema.agents.teamId,
        })
        .from(schema.agents)
        .where(eq(schema.agents.id, userId))
        .get();

      if (!user) {
        console.warn(`❌ [UserConnection] User ${userId} not found`);
        return false;
      }

      // Admin has full access
      if (user.role === 'admin') {
        return true;
      }

      // For unassigned conversations, allow access (queue management)
      if (!conversation.assignedUserId && !conversation.assignedTeamId) {
        return action === 'read'; // Read-only for unassigned
      }

      // Check if user is assigned to this conversation
      if (conversation.assignedUserId === userId) {
        return true;
      }

      // Check if user is in the assigned team
      if (conversation.assignedTeamId && user.teamId === conversation.assignedTeamId) {
        return true;
      }

      console.warn(`❌ [UserConnection] User ${userId} denied ${action} access to conversation ${conversationId}`);
      return false;
    } catch (error) {
      console.error(`❌ [UserConnection] Permission check failed:`, error);
      return false; // Fail secure - deny access on error
    }
  }

  /**
   * SECURITY: Rate limiting to prevent message flooding and DoS attacks
   * Uses a sliding window approach with per-connection tracking
   */
  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    const state = this.rateLimitState.get(connectionId);

    if (!state) {
      // First message from this connection
      this.rateLimitState.set(connectionId, { count: 1, windowStart: now });
      return true;
    }

    // Check if we're in the same time window
    if (now - state.windowStart < this.RATE_LIMIT_WINDOW_MS) {
      // Still in the same window
      if (state.count >= this.RATE_LIMIT_MAX_MESSAGES) {
        // Rate limit exceeded
        return false;
      }
      state.count++;
      return true;
    } else {
      // New time window - reset the counter
      this.rateLimitState.set(connectionId, { count: 1, windowStart: now });
      return true;
    }
  }

  /**
   * Clean up rate limit state for disconnected connections
   */
  private cleanupRateLimitState(connectionId: string): void {
    this.rateLimitState.delete(connectionId);
  }

  private generateConnectionId(): string {
    return `user_conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // =================== HTTP API Handlers ===================

  private async handleSubscribe(request: Request): Promise<Response> {
    // const { conversationId } = await request.json(); // Reserved for future conversation-specific subscription
    return this.handleConnectToConversation(request);
  }

  private async handleUnsubscribe(request: Request): Promise<Response> {
    // const { conversationId } = await request.json(); // Reserved for future conversation-specific unsubscription
    return this.handleDisconnectFromConversation(request);
  }

  private async handlePresenceUpdate(request: Request): Promise<Response> {
    const { status: _status } = await request.json() as { status?: string };

    // Update user presence
    this.lastSeen = Date.now();
    this.isOnline = true;

    await this.updateUserState();

    return new Response(JSON.stringify({
      success: true,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen
    }));
  }

  private async handlePreferences(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(this.preferences));
    } else if (request.method === 'PUT') {
      const newPreferences = await request.json() as Record<string, any>;
      this.preferences = { ...this.preferences, ...newPreferences };
      await this.updateUserState();
      return new Response(JSON.stringify(this.preferences));
    }

    return new Response('Method not allowed', { status: 405 });
  }

  private async handleGetStatus(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      userId: this.userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connectionCount: this.connections.size,
      subscriptionCount: this.subscriptions.size,
      stats: this.stats
    }));
  }

  private async handleBroadcastToUser(request: Request): Promise<Response> {
    const message = await request.json() as WebSocketMessage;
    await this.broadcastToUserConnections(message);
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    const metrics = {
      userId: this.userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connections: this.connections.size,
      subscriptions: this.subscriptions.size,
      stats: this.stats,
      uptime: Date.now() - (this.stats.lastActivity - 3600000) // Approximate uptime
    };

    return new Response(JSON.stringify(metrics));
  }

  private async handleEventMessage(_connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const event = message.data as DurableObjectEvent;

    // Simplified event handling - just acknowledge
    switch (event.type) {
      case 'typing_start':
      case 'typing_stop':
        // Simply broadcast to other user connections
        await this.broadcastToUserConnections({
          type: 'event',
          data: event,
          timestamp: Date.now()
        });
        break;

      default:
        console.log(`🔔 [UserConnection] Event acknowledged: ${event.type}`);
    }
  }
}