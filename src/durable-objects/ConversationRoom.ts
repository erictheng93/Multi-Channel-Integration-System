// Unified ConversationRoom Durable Object
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 管理特定對話的 WebSocket 連接和實時消息傳遞
//
// Mode Configuration:
// - 'full': Complete features including message history, advanced auth, permissions
// - 'simplified': Minimal features for high-traffic rooms with reduced memory footprint

import type {
  WebSocketConnection,
  WebSocketMessage,
  DurableObjectEvent
} from '../types/websocket-types';
import type { RealtimeEvent } from '../types';
import type { WebSocketAuthChallenge, WebSocketAuthResponse } from '../services/websocket-auth-service';

/**
 * Configuration for ConversationRoom behavior
 */
export interface ConversationRoomConfig {
  mode: 'full' | 'simplified';
  maxConnections?: number;
  maxMessageHistory?: number;
  inactivityTimeout?: number;
}

/**
 * Architecture Overview:
 *
 * ConversationRoom Durable Object manages:
 * 1. WebSocket connections for a specific conversation
 * 2. Real-time message broadcasting within the conversation
 * 3. Participant management and typing indicators
 * 4. Connection lifecycle and error handling
 * 5. Optional message history (full mode only)
 * 6. Optional advanced authentication (full mode only)
 * 7. Optional permission checking (full mode only)
 *
 * Each conversation gets its own Durable Object instance identified by conversationId
 * This ensures strong consistency for message ordering and participant state
 */

export class ConversationRoom implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private config: ConversationRoomConfig;

  // Core state (both modes)
  private connections = new Map<string, WebSocketConnection>();
  private participants = new Set<string>();
  private conversationId: string;
  private messageCounter = 0;
  private lastActivity = Date.now();
  private isActive = true;

  // Full mode only
  private messageHistory: RealtimeEvent[] = [];
  private challenges = new Map<string, WebSocketAuthChallenge>();

  // Configuration with defaults
  private readonly MAX_CONNECTIONS: number;
  private readonly MAX_MESSAGE_HISTORY: number;
  private readonly INACTIVITY_TIMEOUT: number;
  private readonly CHALLENGE_TTL = 30000; // 30 seconds for challenge expiration

  constructor(state: DurableObjectState, env: any, config?: ConversationRoomConfig) {
    this.state = state;
    this.env = env;
    this.config = config || { mode: 'full' };
    this.conversationId = 'unknown'; // Will be set from request URL

    // Set configuration values
    this.MAX_CONNECTIONS = this.config.maxConnections || 100;
    this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 50;
    this.INACTIVITY_TIMEOUT = this.config.inactivityTimeout || 300000;

    // Initialize state from storage
    this.initializeFromStorage();

    // Set up periodic cleanup (full mode only)
    if (this.isFullMode()) {
      this.setupCleanupTasks();
    }

    console.log(`🏗️ [ConversationRoom] Initialized in ${this.config.mode} mode`);
  }

  // =================== Mode Detection Helpers ===================

  private isFullMode(): boolean {
    return this.config.mode === 'full';
  }

  private isSimplifiedMode(): boolean {
    return this.config.mode === 'simplified';
  }

  // =================== WebSocket Handling ===================

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request);
      }

      // Handle HTTP API requests
      switch (pathname) {
        case '/challenge':
          // Full mode only
          if (!this.isFullMode()) {
            return new Response('Challenge endpoint not available in simplified mode', { status: 404 });
          }
          return this.handleGenerateChallenge(request);
        case '/connect':
          return this.handleConnect(request);
        case '/disconnect':
          return this.handleDisconnect(request);
        case '/broadcast':
          return this.handleBroadcast(request);
        case '/participants':
          return this.handleGetParticipants(request);
        case '/metrics':
          return this.handleGetMetrics(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [ConversationRoom] Request handling error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get('conversationId');

      // Set conversationId
      if (conversationId) {
        this.conversationId = conversationId;
      }

      let userId: string;
      let role: string;

      // Full mode: Support both token and challenge-response authentication
      // Simplified mode: Only query parameter authentication
      if (this.isFullMode()) {
        const authResult = await this.authenticateFullMode(url, request);
        if (!authResult.success) {
          return new Response(authResult.error, { status: authResult.status });
        }
        userId = authResult.userId!;
        role = authResult.role!;
      } else {
        const authResult = await this.authenticateSimplifiedMode(url);
        if (!authResult.success) {
          return new Response(authResult.error, { status: authResult.status });
        }
        userId = authResult.userId!;
        role = authResult.role!;
      }

      // Check connection limits
      if (this.connections.size >= this.MAX_CONNECTIONS) {
        return new Response('Connection limit reached', { status: 429 });
      }

      // Create WebSocket pair
      const [client, server] = Object.values(new WebSocketPair());

      if (!server) {
        throw new Error('Failed to create WebSocket server');
      }

      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        websocket: server,
        userId,
        conversationId: this.conversationId,
        role: role as 'admin' | 'agent',
        connectionId,
        lastActivity: Date.now(),
        isActive: true,
        metadata: this.isFullMode() ? {
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP')
        } : undefined
      };

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(connection);

      // Add connection to room
      await this.addConnection(connection);

      // Accept the WebSocket connection
      server.accept();

      return new Response(null, { status: 101, webSocket: client as WebSocket });

    } catch (error) {
      console.error('❌ [ConversationRoom] WebSocket upgrade error:', error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  }

  /**
   * Full mode authentication: Token-based or Challenge-Response
   */
  private async authenticateFullMode(url: URL, request: Request): Promise<{
    success: boolean;
    userId?: string;
    role?: string;
    error?: string;
    status?: number;
  }> {
    const challengeId = url.searchParams.get('challengeId');
    const signature = url.searchParams.get('signature');
    const token = url.searchParams.get('token');

    // Authentication Method 1: Token-based (recommended, used by frontend)
    if (token) {
      console.log('🔐 [ConversationRoom] Using token authentication');

      try {
        const { verifyJWT } = await import('../utils/auth');
        const jwtSecret = this.env.JWT_SECRET || 'default-secret-key';
        const payload = await verifyJWT(token, jwtSecret);

        console.log(`✅ [ConversationRoom] Token valid for user ${payload.userId} with role ${payload.role}`);
        return {
          success: true,
          userId: String(payload.userId),
          role: payload.role
        };
      } catch (error) {
        console.error('❌ [ConversationRoom] Token validation failed:', error);
        return {
          success: false,
          error: 'Unauthorized - Invalid token',
          status: 401
        };
      }
    }
    // Authentication Method 2: Challenge-Response (backward compatibility)
    else if (challengeId && signature) {
      console.log('🔐 [ConversationRoom] Using challenge-response authentication');

      const authResult = await this.verifyAuthResponse(challengeId, signature);
      if (!authResult.isValid || !authResult.userId || !authResult.role) {
        return {
          success: false,
          error: 'Unauthorized - Invalid challenge response',
          status: 401
        };
      }

      return {
        success: true,
        userId: authResult.userId,
        role: authResult.role
      };
    }
    // No valid authentication method provided
    else {
      return {
        success: false,
        error: 'Missing authentication parameters. Provide either token or challengeId+signature.',
        status: 400
      };
    }
  }

  /**
   * Simplified mode authentication: Query parameters only
   */
  private async authenticateSimplifiedMode(url: URL): Promise<{
    success: boolean;
    userId?: string;
    role?: string;
    error?: string;
    status?: number;
  }> {
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role') as 'admin' | 'agent';

    if (!userId || !token || !role) {
      return {
        success: false,
        error: 'Missing required parameters (userId, token, role)',
        status: 400
      };
    }

    return {
      success: true,
      userId,
      role
    };
  }

  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { websocket, connectionId } = connection;

    websocket.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(connection, message);
      } catch (error) {
        console.error(`❌ [ConversationRoom] Message parsing error for ${connectionId}:`, error);
        this.sendError(connection, 'Invalid message format');
      }
    });

    websocket.addEventListener('close', async (event) => {
      console.log(`🔌 [ConversationRoom] Connection closed: ${connectionId}, code: ${event.code}`);
      await this.removeConnection(connectionId);
    });

    websocket.addEventListener('error', async (event) => {
      console.error(`❌ [ConversationRoom] WebSocket error for ${connectionId}:`, event);
      await this.removeConnection(connectionId);
    });

    // Send welcome message
    this.sendMessage(connection, {
      type: 'event',
      data: {
        type: 'connection_established',
        conversationId: this.conversationId,
        connectionId,
        participants: Array.from(this.participants),
        mode: this.config.mode // Inform client of room mode
      },
      timestamp: Date.now()
    });
  }

  private async handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { connectionId } = connection;

    // Update last activity
    connection.lastActivity = Date.now();
    this.lastActivity = Date.now();

    console.log(`📨 [ConversationRoom] Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.sendMessage(connection, { type: 'pong', timestamp: Date.now() });
        break;

      case 'subscribe':
        if (this.isFullMode()) {
          await this.handleSubscribe(connection, message);
        }
        break;

      case 'unsubscribe':
        if (this.isFullMode()) {
          await this.handleUnsubscribe(connection, message);
        }
        break;

      case 'message':
        await this.handleChatMessage(connection, message);
        break;

      case 'event':
        if (this.isFullMode()) {
          await this.handleEventMessage(connection, message);
        }
        break;

      default:
        this.sendError(connection, `Unknown message type: ${message.type}`);
    }
  }

  // =================== Connection Management ===================

  private async addConnection(connection: WebSocketConnection): Promise<void> {
    const { connectionId, userId } = connection;

    // Add connection
    this.connections.set(connectionId, connection);
    this.participants.add(userId);

    // Store in Durable Object storage for persistence
    await this.state.storage.put(`connection:${connectionId}`, {
      userId,
      conversationId: this.conversationId,
      role: connection.role,
      connectedAt: Date.now(),
      lastActivity: connection.lastActivity
    });

    // Update participant list
    await this.state.storage.put('participants', Array.from(this.participants));

    // Broadcast user joined event
    await this.broadcastEvent({
      id: this.generateEventId(),
      type: 'user_joined',
      source: 'websocket',
      timestamp: Date.now(),
      userId,
      conversationId: this.conversationId,
      data: {
        userId,
        connectionId,
        role: connection.role,
        participantCount: this.participants.size
      },
      priority: 'normal'
    });

    console.log(`✅ [ConversationRoom] Connection added: ${connectionId} (User: ${userId})`);
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { userId } = connection;

    // Remove connection
    this.connections.delete(connectionId);

    // Check if user has other connections
    const hasOtherConnections = Array.from(this.connections.values())
      .some(conn => conn.userId === userId);

    if (!hasOtherConnections) {
      this.participants.delete(userId);
    }

    // Remove from storage
    await this.state.storage.delete(`connection:${connectionId}`);
    await this.state.storage.put('participants', Array.from(this.participants));

    // Broadcast user left event (only if no other connections)
    if (!hasOtherConnections) {
      await this.broadcastEvent({
        id: this.generateEventId(),
        type: 'user_left',
        source: 'websocket',
        timestamp: Date.now(),
        userId,
        conversationId: this.conversationId,
        data: {
          userId,
          connectionId,
          participantCount: this.participants.size
        },
        priority: 'normal'
      });
    }

    console.log(`🔌 [ConversationRoom] Connection removed: ${connectionId} (User: ${userId})`);
  }

  // =================== Message Broadcasting ===================

  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { userId, role } = connection;

    // Check permissions (full mode only)
    if (this.isFullMode()) {
      const hasPermission = await this.checkMessagePermission(userId, role, this.conversationId);
      if (!hasPermission) {
        this.sendError(connection, 'Permission denied to send messages');
        return;
      }
    }

    // Message ordering with counter
    const messageOrder = this.getNextMessageOrder();

    // Type guard for message data
    const messageData = message.data as any;
    const isValidMessageData = messageData && typeof messageData === 'object';

    // Check if this is a typing indicator
    const isTypingMessage = isValidMessageData &&
      (messageData.messageType === 'typing_start' || messageData.messageType === 'typing_stop');

    if (isTypingMessage) {
      // Typing indicators: broadcast to others only (no storage)
      await this.broadcastToOthers(connection, message);
      return;
    }

    // Create real-time event
    const event: DurableObjectEvent = {
      id: this.generateEventId(),
      type: 'message_sent',
      source: 'websocket',
      timestamp: Date.now(),
      userId,
      conversationId: this.conversationId,
      data: {
        messageId: message.id,
        content: isValidMessageData ? messageData.content : '',
        messageType: (isValidMessageData ? messageData.messageType : null) || 'text',
        senderName: isValidMessageData ? messageData.senderName : undefined,
        metadata: { ...(isValidMessageData && messageData.metadata ? messageData.metadata : {}), order: messageOrder }
      },
      priority: 'high'
    };

    // Store in message history (full mode only)
    if (this.isFullMode()) {
      const realtimeEvent: RealtimeEvent = {
        id: event.id,
        type: event.type as any,
        timestamp: event.timestamp.toString(),
        source: event.source,
        data: event.data as any
      };
      this.messageHistory.push(realtimeEvent);
      if (this.messageHistory.length > this.MAX_MESSAGE_HISTORY) {
        this.messageHistory.shift();
      }

      // Persist message history
      await this.state.storage.put('messageHistory', this.messageHistory);
    }

    // Broadcast to all connections in this conversation
    await this.broadcastEvent(event);

    // Send to external message queue for persistence (full mode only)
    if (this.isFullMode()) {
      await this.sendToMessageQueue(event);
    }

    console.log(`📤 [ConversationRoom] Message broadcast: ${event.id} (order: ${messageOrder})`);
  }

  private async broadcastEvent(event: DurableObjectEvent | RealtimeEvent): Promise<void> {
    const message: WebSocketMessage = {
      type: 'event',
      data: event,
      timestamp: typeof event.timestamp === 'string' ? parseInt(event.timestamp) : event.timestamp
    };

    const broadcasts = Array.from(this.connections.values()).map(connection => {
      return this.sendMessage(connection, message);
    });

    await Promise.allSettled(broadcasts);
    console.log(`📡 [ConversationRoom] Event broadcast to ${this.connections.size} connections`);
  }

  private async broadcastToOthers(sender: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const otherConnections = Array.from(this.connections.values())
      .filter(conn => conn.connectionId !== sender.connectionId);

    const broadcasts = otherConnections.map(conn => this.sendMessage(conn, message));
    await Promise.allSettled(broadcasts);
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
        console.error(`❌ [ConversationRoom] Send message error for ${connection.connectionId}:`, error);
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

  // =================== Message Ordering ===================

  private getNextMessageOrder(): number {
    return ++this.messageCounter;
  }

  // =================== Helper Methods ===================

  private async initializeFromStorage(): Promise<void> {
    try {
      // Restore participants
      const participants = await this.state.storage.get('participants') as string[];
      if (participants) {
        this.participants = new Set(participants);
      }

      // Restore message history (full mode only)
      if (this.isFullMode()) {
        const messageHistory = await this.state.storage.get('messageHistory') as RealtimeEvent[];
        if (messageHistory) {
          this.messageHistory = messageHistory;
        }
      }

      console.log(`📂 [ConversationRoom] State restored: ${this.participants.size} participants${this.isFullMode() ? `, ${this.messageHistory.length} messages` : ''}`);
    } catch (error) {
      console.error('❌ [ConversationRoom] State restoration error:', error);
    }
  }

  private setupCleanupTasks(): void {
    // Clean up inactive connections every 5 minutes (full mode only)
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);
  }

  private async cleanupInactiveConnections(): Promise<void> {
    const now = Date.now();
    const inactiveConnections = Array.from(this.connections.entries())
      .filter(([_, connection]) => now - connection.lastActivity > this.INACTIVITY_TIMEOUT);

    for (const [connectionId, _connection] of inactiveConnections) {
      console.log(`🧹 [ConversationRoom] Removing inactive connection: ${connectionId}`);
      await this.removeConnection(connectionId);
    }
  }

  // =================== Full Mode: Challenge-Response Authentication ===================

  /**
   * Generate authentication challenge for WebSocket connection (Full Mode Only)
   * Called via HTTP before WebSocket upgrade
   */
  private async handleGenerateChallenge(request: Request): Promise<Response> {
    try {
      // Verify the request contains a valid JWT token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.substring(7);

      // Verify JWT token
      const { verifyJWT } = await import('../utils/auth');
      const payload = await verifyJWT(token, this.env.JWT_SECRET);

      if (!payload || !payload.userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate challenge
      const challengeId = crypto.randomUUID();
      const challenge: WebSocketAuthChallenge = {
        challengeId,
        expiresAt: Date.now() + this.CHALLENGE_TTL
      };

      // Store challenge in Durable Object storage for persistence
      await this.state.storage.put(`challenge:${challengeId}`, {
        ...challenge,
        userId: payload.userId,
        role: payload.role,
        token
      });

      // Also keep in memory for fast access
      this.challenges.set(challengeId, challenge);

      // Clean up expired challenges
      this.cleanupExpiredChallenges();

      console.log(`🔐 [ConversationRoom] Challenge generated for user ${payload.userId}: ${challengeId}`);

      return new Response(JSON.stringify({
        challengeId,
        expiresAt: challenge.expiresAt,
        ttl: this.CHALLENGE_TTL
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ [ConversationRoom] Challenge generation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate challenge' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Verify authentication response during WebSocket handshake (Full Mode Only)
   */
  private async verifyAuthResponse(challengeId: string, signature: string): Promise<{
    isValid: boolean;
    userId?: string;
    role?: 'admin' | 'agent';
    teamId?: number;
  }> {
    try {
      // Check if challenge exists in storage
      const challengeData = await this.state.storage.get(`challenge:${challengeId}`) as any;

      if (!challengeData) {
        console.log(`❌ [ConversationRoom] Invalid challenge ID: ${challengeId}`);
        return { isValid: false };
      }

      // Check if challenge is expired
      if (Date.now() > challengeData.expiresAt) {
        console.log(`❌ [ConversationRoom] Expired challenge: ${challengeId}`);
        await this.state.storage.delete(`challenge:${challengeId}`);
        this.challenges.delete(challengeId);
        return { isValid: false };
      }

      // Verify signature (HMAC of challengeId + token)
      const expectedSignature = await this.generateSignature(challengeId, challengeData.token);
      if (signature !== expectedSignature) {
        console.log(`❌ [ConversationRoom] Invalid signature for challenge ${challengeId}`);
        return { isValid: false };
      }

      // Clean up used challenge
      await this.state.storage.delete(`challenge:${challengeId}`);
      this.challenges.delete(challengeId);

      console.log(`✅ [ConversationRoom] Authentication successful for user ${challengeData.userId}`);

      return {
        isValid: true,
        userId: String(challengeData.userId),
        role: challengeData.role || 'agent',
        teamId: challengeData.teamId
      };

    } catch (error) {
      console.error('❌ [ConversationRoom] Auth verification error:', error);
      return { isValid: false };
    }
  }

  /**
   * Generate HMAC signature for challenge + token (Full Mode Only)
   */
  private async generateSignature(challengeId: string, token: string): Promise<string> {
    const data = challengeId + ':' + token;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.env.JWT_SECRET);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Clean up expired challenges (Full Mode Only)
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(challengeId);
        this.state.storage.delete(`challenge:${challengeId}`).catch(() => {});
      }
    }
  }

  // =================== Full Mode: Permission Checking ===================

  private async checkMessagePermission(userId: string, role: string, _conversationId: string): Promise<boolean> {
    try {
      const userConnections = Array.from(this.connections.values())
        .filter(conn => conn.userId === userId);

      if (userConnections.length === 0) return false;

      const userRole = userConnections[0]?.role || role;

      // Basic permission checks based on role hierarchy
      return ['admin', 'team', 'agent'].includes(userRole);
    } catch (error) {
      console.error('❌ [ConversationRoom] Permission check failed:', error);
      return false;
    }
  }

  // =================== Full Mode: External Queue Integration ===================

  private async sendToMessageQueue(_event: DurableObjectEvent): Promise<void> {
    // Integration point with existing Cloudflare Queue
    // This would send the event to REALTIME_QUEUE for persistence
  }

  // =================== Utility Methods ===================

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
  }

  // =================== HTTP API Handlers ===================

  private async handleConnect(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: true,
      conversationId: this.conversationId,
      activeConnections: this.connections.size,
      mode: this.config.mode
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleDisconnect(request: Request): Promise<Response> {
    const { connectionId } = await request.json() as { connectionId: string };
    await this.removeConnection(connectionId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const event = await request.json() as DurableObjectEvent;
    await this.broadcastEvent(event);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleGetParticipants(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      participants: Array.from(this.participants),
      activeConnections: this.connections.size,
      lastActivity: this.lastActivity
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    const baseMetrics = {
      conversationId: this.conversationId,
      mode: this.config.mode,
      activeConnections: this.connections.size,
      participants: this.participants.size,
      messageCounter: this.messageCounter,
      lastActivity: this.lastActivity,
      isActive: this.isActive
    };

    const fullMetrics = this.isFullMode() ? {
      ...baseMetrics,
      messageHistory: this.messageHistory.length,
      uptime: Date.now() - (this.lastActivity - 300000)
    } : baseMetrics;

    return new Response(JSON.stringify(fullMetrics), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleSubscribe(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    console.log(`🔔 [ConversationRoom] Subscription request from ${connection.connectionId}:`, message.data);
  }

  private async handleUnsubscribe(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    console.log(`🔕 [ConversationRoom] Unsubscription request from ${connection.connectionId}:`, message.data);
  }

  private async handleEventMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const event = message.data as DurableObjectEvent;

    if (event.type === 'typing_start' || event.type === 'typing_stop') {
      // Broadcast typing indicators to other participants
      const broadcastMessage: WebSocketMessage = {
        type: 'event',
        data: event,
        timestamp: Date.now()
      };

      const otherConnections = Array.from(this.connections.values())
        .filter(conn => conn.connectionId !== connection.connectionId);

      const broadcasts = otherConnections.map(conn => this.sendMessage(conn, broadcastMessage));
      await Promise.allSettled(broadcasts);
    }
  }
}
