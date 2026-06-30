// Room Connection Manager
// Connection add/remove, WebSocket handler setup, participant tracking

import type {
  WebSocketConnection,
  WebSocketMessage,
  DurableObjectEvent
} from '../../types/websocket-types';
import type { RoomContext, RoomHelpers } from './room-helpers';
import type { RoomConnectionAttachment } from './room-helpers';
import type { RoomMessageService } from './room-message-service';
import type { RoomStorageService } from './room-storage-service';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../../utils/test-logger';
import { nowMs } from '@/utils/timestamp'

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
    _storageService: RoomStorageService
  ) {}

  setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { connectionId } = connection;

    // Send welcome message with serverLastMessageAt for reconnection sync
    this.helpers.sendMessage(connection, {
      type: 'event',
      data: {
        type: 'connection_established',
        conversationId: this.ctx.conversationId,
        connectionId,
        participants: Array.from(this.ctx.participants),
        mode: this.ctx.config.mode, // Inform client of room mode
        serverLastMessageAt: this.messageService.getLastMessageTimestamp() //  重連同步：伺服器最後訊息時間戳
      },
      timestamp: nowMs()
    });
  }

  restoreHibernatedConnections(): void {
    if (typeof this.ctx.state.getWebSockets !== 'function') {
      return;
    }

    for (const websocket of this.ctx.state.getWebSockets()) {
      const socketWithAttachment = websocket as WebSocket & {
        deserializeAttachment?: () => RoomConnectionAttachment | null;
      };
      const attachment = typeof socketWithAttachment.deserializeAttachment === 'function'
        ? socketWithAttachment.deserializeAttachment()
        : null;

      if (!attachment?.connectionId || !attachment.userId) {
        continue;
      }

      const connection = this.helpers.connectionFromSocket(websocket, attachment);
      this.ctx.connections.set(connection.connectionId, connection);
      this.ctx.participants.add(connection.userId);
      if (attachment.conversationId && this.ctx.conversationId === 'unknown') {
        this.ctx.conversationId = attachment.conversationId;
      }
    }
  }

  getConnectionForSocket(websocket: WebSocket): WebSocketConnection | null {
    const socketWithAttachment = websocket as WebSocket & {
      deserializeAttachment?: () => RoomConnectionAttachment | null;
    };
    const attachment = typeof socketWithAttachment.deserializeAttachment === 'function'
      ? socketWithAttachment.deserializeAttachment()
      : null;

    if (!attachment?.connectionId) {
      return null;
    }

    const existingConnection = this.ctx.connections.get(attachment.connectionId);
    if (existingConnection) {
      existingConnection.websocket = websocket;
      return existingConnection;
    }

    const connection = this.helpers.connectionFromSocket(websocket, attachment);
    this.ctx.connections.set(connection.connectionId, connection);
    this.ctx.participants.add(connection.userId);
    if (connection.conversationId && this.ctx.conversationId === 'unknown') {
      this.ctx.conversationId = connection.conversationId;
    }
    return connection;
  }

  async handleRawWebSocketMessage(websocket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    const connection = this.getConnectionForSocket(websocket);
    if (!connection) {
      websocket.close(1008, 'Missing connection state');
      return;
    }

    try {
      const messageText = typeof rawMessage === 'string'
        ? rawMessage
        : new TextDecoder().decode(rawMessage);
      const message: WebSocketMessage = JSON.parse(messageText);
      await this.handleWebSocketMessage(connection, message);
      this.helpers.updateConnectionAttachment(connection);
    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Message parsing error for ${connection.connectionId}:`, error);
      this.helpers.sendError(connection, 'Invalid message format');
    }
  }

  async handleWebSocketClosed(websocket: WebSocket, code: number): Promise<void> {
    const connection = this.getConnectionForSocket(websocket);
    if (!connection) return;

    testSafeLog(`[ConversationRoom] Connection closed: ${connection.connectionId}, code: ${code}`);
    await this.removeConnection(connection.connectionId);
  }

  async handleWebSocketError(websocket: WebSocket, error: unknown): Promise<void> {
    const connection = this.getConnectionForSocket(websocket);
    if (!connection) return;

    testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] WebSocket error for ${connection.connectionId}:`, error);
    await this.removeConnection(connection.connectionId);
  }

  async handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const { connectionId } = connection;

    // Update last activity
    connection.lastActivity = nowMs();
    this.ctx.lastActivity = nowMs();

    testSafeLog(`[ConversationRoom] Message from ${connectionId}:`, message.type);

    switch (message.type) {
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

      // 重連同步：處理客戶端的同步請求
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
      connectedAt: nowMs(),
      lastActivity: connection.lastActivity
    });

    // Update participant list
    await this.ctx.state.storage.put('participants', Array.from(this.ctx.participants));
    this.helpers.updateConnectionAttachment(connection);

    // Broadcast user joined event
    await this.messageService.broadcastEvent({
      id: this.helpers.generateEventId(),
      type: 'user_joined',
      source: 'websocket',
      timestamp: nowMs(),
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
        timestamp: nowMs(),
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
    // Hibernation migration: avoid periodic timers that keep the DO hot.
    // Close/error handlers, token-expiry alarms, and explicit storage flush alarms keep state tidy.
  }

  async cleanupInactiveConnections(): Promise<void> {
    const now = nowMs();
    const inactiveConnections = Array.from(this.ctx.connections.entries())
      .filter(([_, connection]) => now - connection.lastActivity > this.ctx.INACTIVITY_TIMEOUT);

    for (const [connectionId, _connection] of inactiveConnections) {
      testSafeLog(`[ConversationRoom] Removing inactive connection: ${connectionId}`);
      await this.removeConnection(connectionId);
    }
  }

  async closeExpiredTokenConnections(now = Date.now()): Promise<void> {
    const expiredConnectionIds: string[] = [];

    for (const [connectionId, connection] of this.ctx.connections.entries()) {
      const tokenExp = connection.metadata?.tokenExp;
      if (typeof tokenExp === 'number' && Number.isFinite(tokenExp) && tokenExp > 0 && tokenExp * 1000 <= now) {
        try {
          connection.websocket.close(4401, 'Token expired');
        } catch (error) {
          testSafeError('[ConversationRoom] close-at-exp failed:', error);
        }
        expiredConnectionIds.push(connectionId);
      }
    }

    for (const connectionId of expiredConnectionIds) {
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
        timestamp: nowMs()
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
    this.restoreHibernatedConnections();

    return new Response(JSON.stringify({
      participants: Array.from(this.ctx.participants),
      activeConnections: this.ctx.connections.size,
      lastActivity: this.ctx.lastActivity
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleGetMetrics(_request: Request): Promise<Response> {
    this.restoreHibernatedConnections();

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
