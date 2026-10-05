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
import { WebSocketAuthService } from '@/services/websocket-auth-service';
import type { Bindings } from '@/types';

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
      if (websocket.readyState !== 1) continue;
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

    if (websocket.readyState !== 1) return null;

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

    // Track direct room sockets even if the user has no global socket/subscription.
    // Best effort: a tracking outage must not block joins; the room's own
    // five-minute access alarm still revokes untracked sockets.
    await this.trackUserRoom(connection, true).catch(error =>
      testSafeError('[ConversationRoom] Room registration failed:', error));

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

  async removeConnection(
    connectionId: string,
    connection = this.ctx.connections.get(connectionId)
  ): Promise<void> {
    if (!connection) return;

    const { userId } = connection;

    // Remove connection
    this.ctx.connections.delete(connectionId);

    // Avoid a UserConnection -> room eviction -> UserConnection RPC cycle.
    const untrack = this.trackUserRoom(connection, false).catch(error =>
      testSafeError('[ConversationRoom] Room unregistration failed:', error));
    if (typeof this.ctx.state.waitUntil === 'function') this.ctx.state.waitUntil(untrack);

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

  private async trackUserRoom(connection: WebSocketConnection, connected: boolean): Promise<void> {
    const { userId, connectionId } = connection;
    const namespace = (this.ctx.env as Bindings).USER_CONNECTION;
    if (!namespace) return;
    const response = await namespace.get(namespace.idFromName(userId)).fetch(
      new Request('https://internal/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, connectionId, conversationId: this.ctx.conversationId, connected })
      })
    );
    if (!response.ok) throw new Error(`Room tracking returned ${response.status}`);
  }

  /**
   * Closes sockets whose user definitely lost access. When D1 cannot answer
   * for a user, that user's sockets stay open and the access check is retried
   * in 30s, so a transient outage never mass-evicts the room.
   */
  async evictUnauthorizedConnections(userIds?: string[]): Promise<{ evicted: number; deferred: boolean }> {
    this.restoreHibernatedConnections();
    const auth = new WebSocketAuthService(this.ctx.env as Bindings);
    const decisions = new Map<string, boolean>();
    const revoked: WebSocketConnection[] = [];
    let deferred = false;
    for (const connection of this.ctx.connections.values()) {
      if (userIds && !userIds.includes(connection.userId)) continue;
      if (!decisions.has(connection.userId)) {
        try {
          decisions.set(connection.userId, await auth.hasLiveConversationAccess(
            connection.userId, this.ctx.conversationId
          ));
        } catch (error) {
          testSafeError('[ConversationRoom] Access check unavailable, retrying later:', error);
          decisions.set(connection.userId, true);
          deferred = true;
        }
      }
      if (!decisions.get(connection.userId)) revoked.push(connection);
    }
    if (deferred) {
      this.ctx.accessCheckDeadline = Date.now() + 30000;
      await this.ctx.state.storage.put('accessCheckDeadline', this.ctx.accessCheckDeadline);
    }
    // Close every revoked device before removeConnection emits any user_left events.
    for (const connection of revoked) {
      try { connection.websocket.serializeAttachment(null); }
      catch (error) { testSafeError('[ConversationRoom] Clearing revoked attachment failed:', error); }
      try { connection.websocket.close(4403, 'Access revoked'); }
      catch (error) { testSafeError('[ConversationRoom] Access-revocation close failed:', error); }
      this.ctx.connections.delete(connection.connectionId);
    }
    for (const connection of revoked) {
      await this.removeConnection(connection.connectionId, connection);
    }
    return { evicted: revoked.length, deferred };
  }

  async handleEvict(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response('Invalid eviction request', { status: 400 });
    }
    const { userIds } = body as { userIds?: unknown };
    if (userIds !== undefined && (!Array.isArray(userIds) ||
        !userIds.every(id => typeof id === 'string' && id.length > 0))) {
      return new Response('Invalid userIds', { status: 400 });
    }
    const { evicted, deferred } = await this.evictUnauthorizedConnections(userIds as string[] | undefined);
    // Report surviving sockets so UserConnection can prune stale room registrations.
    const connectionIds = Array.from(this.ctx.connections.values())
      .filter(connection => !userIds || (userIds as string[]).includes(connection.userId))
      .map(connection => connection.connectionId);
    return Response.json({ success: !deferred, evicted, connectionIds }, { status: deferred ? 503 : 200 });
  }

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
