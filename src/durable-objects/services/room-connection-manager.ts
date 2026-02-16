// Room Connection Manager
// Connection add/remove, WebSocket handler setup, participant tracking

import type {
  WebSocketConnection,
  WebSocketMessage,
  DurableObjectEvent
} from '../../types/websocket-types';
import type { RoomContext, RoomHelpers } from './room-helpers';
import type { RoomMessageService } from './room-message-service';
import type { RoomStorageService } from './room-storage-service';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../../utils/test-logger';

/**
 * Manages WebSocket connections for ConversationRoom:
 * - Connection add/remove with storage persistence
 * - WebSocket event handler setup
 * - WebSocket message routing
 * - Participant tracking
 * - Inactive connection cleanup
 * - HTTP API handlers for connect/disconnect/participants/metrics
 */
export class RoomConnectionManager {
  constructor(
    private ctx: RoomContext,
    private helpers: RoomHelpers,
    private messageService: RoomMessageService,
    private storageService: RoomStorageService
  ) {}

  setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { websocket, connectionId } = connection;

    websocket.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(connection, message);
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Message parsing error for ${connectionId}:`, error);
        this.helpers.sendError(connection, 'Invalid message format');
      }
    });

    websocket.addEventListener('close', async (event) => {
      testSafeLog(`[ConversationRoom] Connection closed: ${connectionId}, code: ${event.code}`);
      await this.removeConnection(connectionId);
    });

    websocket.addEventListener('error', async (event) => {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] WebSocket error for ${connectionId}:`, event);
      await this.removeConnection(connectionId);
    });

    // Send welcome message with serverLastMessageAt for reconnection sync
    this.helpers.sendMessage(connection, {
      type: 'event',
      data: {
        type: 'connection_established',
        conversationId: this.ctx.conversationId,
        connectionId,
        participants: Array.from(this.ctx.participants),
        mode: this.ctx.config.mode, // Inform client of room mode
        serverLastMessageAt: this.messageService.getLastMessageTimestamp() // 🔧 重連同步：伺服器最後訊息時間戳
      },
      timestamp: Date.now()
    });
  }

  async handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { connectionId } = connection;

    // Update last activity
    connection.lastActivity = Date.now();
    this.ctx.lastActivity = Date.now();

    testSafeLog(`[ConversationRoom] Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.helpers.sendMessage(connection, { type: 'pong', timestamp: Date.now() });
        break;

      case 'subscribe':
        if (this.helpers.isFullMode()) {
          await this.handleSubscribe(connection, message);
        }
        break;

      case 'unsubscribe':
        if (this.helpers.isFullMode()) {
          await this.handleUnsubscribe(connection, message);
        }
        break;

      case 'message':
        await this.messageService.handleChatMessage(connection, message);
        break;

      case 'event':
        if (this.helpers.isFullMode()) {
          await this.handleEventMessage(connection, message);
        }
        break;

      // 🔧 重連同步：處理客戶端的同步請求
      case 'sync_request':
        if (this.helpers.isFullMode()) {
          await this.messageService.handleSyncRequest(connection, message);
        }
        break;

      default:
        this.helpers.sendError(connection, `Unknown message type: ${message.type}`);
    }
  }

  // =================== Connection Management ===================

  async addConnection(connection: WebSocketConnection): Promise<void> {
    const { connectionId, userId } = connection;

    // Add connection
    this.ctx.connections.set(connectionId, connection);
    this.ctx.participants.add(userId);

    // Store in Durable Object storage for persistence
    await this.ctx.state.storage.put(`connection:${connectionId}`, {
      userId,
      conversationId: this.ctx.conversationId,
      role: connection.role,
      connectedAt: Date.now(),
      lastActivity: connection.lastActivity
    });

    // Update participant list
    await this.ctx.state.storage.put('participants', Array.from(this.ctx.participants));

    // Broadcast user joined event
    await this.messageService.broadcastEvent({
      id: this.helpers.generateEventId(),
      type: 'user_joined',
      source: 'websocket',
      timestamp: Date.now(),
      userId,
      conversationId: this.ctx.conversationId,
      data: {
        userId,
        connectionId,
        role: connection.role,
        participantCount: this.ctx.participants.size
      },
      priority: 'normal'
    });

    testSafeLog(`${getEmojiPrefix('CHECK')}[ConversationRoom] Connection added: ${connectionId} (User: ${userId})`);
  }

  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.ctx.connections.get(connectionId);
    if (!connection) return;

    const { userId } = connection;

    // Remove connection
    this.ctx.connections.delete(connectionId);

    // Check if user has other connections
    const hasOtherConnections = Array.from(this.ctx.connections.values())
      .some(conn => conn.userId === userId);

    if (!hasOtherConnections) {
      this.ctx.participants.delete(userId);
    }

    // Remove from storage
    await this.ctx.state.storage.delete(`connection:${connectionId}`);
    await this.ctx.state.storage.put('participants', Array.from(this.ctx.participants));

    // Broadcast user left event (only if no other connections)
    if (!hasOtherConnections) {
      await this.messageService.broadcastEvent({
        id: this.helpers.generateEventId(),
        type: 'user_left',
        source: 'websocket',
        timestamp: Date.now(),
        userId,
        conversationId: this.ctx.conversationId,
        data: {
          userId,
          connectionId,
          participantCount: this.ctx.participants.size
        },
        priority: 'normal'
      });
    }

    testSafeLog(`[ConversationRoom] Connection removed: ${connectionId} (User: ${userId})`);
  }

  // =================== Cleanup Tasks ===================

  setupCleanupTasks(): void {
    // Clean up inactive connections every 5 minutes (full mode only)
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);

    // Week 3-4: Periodic force storage write every 30 seconds
    // This ensures messages are persisted even if debounce doesn't trigger
    // (e.g., if message rate is very low or DO is idle for extended periods)
    setInterval(async () => {
      if (this.ctx.messageDirty) {
        await this.storageService.forceStorageWrite();
      }
    }, 30000); // 30 seconds
  }

  async cleanupInactiveConnections(): Promise<void> {
    const now = Date.now();
    const inactiveConnections = Array.from(this.ctx.connections.entries())
      .filter(([_, connection]) => now - connection.lastActivity > this.ctx.INACTIVITY_TIMEOUT);

    for (const [connectionId, _connection] of inactiveConnections) {
      testSafeLog(`[ConversationRoom] Removing inactive connection: ${connectionId}`);
      await this.removeConnection(connectionId);
    }
  }

  // =================== WebSocket Message Handlers (Subscribe/Unsubscribe/Event) ===================

  async handleSubscribe(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    testSafeLog(`[ConversationRoom] Subscription request from ${connection.connectionId}:`, message.data);
  }

  async handleUnsubscribe(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    testSafeLog(`[ConversationRoom] Unsubscription request from ${connection.connectionId}:`, message.data);
  }

  async handleEventMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const event = message.data as DurableObjectEvent;

    if (event.type === 'typing_start' || event.type === 'typing_stop') {
      // Broadcast typing indicators to other participants
      const broadcastMessage: WebSocketMessage = {
        type: 'event',
        data: event,
        timestamp: Date.now()
      };

      const otherConnections = Array.from(this.ctx.connections.values())
        .filter(conn => conn.connectionId !== connection.connectionId);

      const broadcasts = otherConnections.map(conn => this.helpers.sendMessage(conn, broadcastMessage));
      await Promise.allSettled(broadcasts);
    }
  }

  // =================== HTTP API Handlers ===================

  async handleConnect(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: true,
      conversationId: this.ctx.conversationId,
      activeConnections: this.ctx.connections.size,
      mode: this.ctx.config.mode
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleDisconnect(request: Request): Promise<Response> {
    const { connectionId } = await request.json() as { connectionId: string };
    await this.removeConnection(connectionId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleBroadcast(request: Request): Promise<Response> {
    const event = await request.json() as DurableObjectEvent;
    await this.messageService.broadcastEvent(event);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleGetParticipants(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      participants: Array.from(this.ctx.participants),
      activeConnections: this.ctx.connections.size,
      lastActivity: this.ctx.lastActivity
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleGetMetrics(_request: Request): Promise<Response> {
    const baseMetrics = {
      conversationId: this.ctx.conversationId,
      mode: this.ctx.config.mode,
      activeConnections: this.ctx.connections.size,
      participants: this.ctx.participants.size,
      messageCounter: this.ctx.messageCounter,
      lastActivity: this.ctx.lastActivity,
      isActive: this.ctx.isActive
    };

    const fullMetrics = this.helpers.isFullMode() ? {
      ...baseMetrics,
      messageHistory: this.ctx.messageHistory.length,
      uptime: Date.now() - (this.ctx.lastActivity - 300000)
    } : baseMetrics;

    return new Response(JSON.stringify(fullMetrics), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
