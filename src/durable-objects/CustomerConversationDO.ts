// CustomerConversationDO - Simplified WebSocket Management for Customer Conversations
// Inspired by Chat Project's AuthorizationDurableObject
// Manages WebSocket connections and real-time broadcasting for single customer conversations

import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { nowMs } from '@/utils/timestamp'

/**
 * Session data structure for validation
 */
interface SessionData {
  userId: string;
  displayName: string;
  role?: 'admin' | 'agent' | 'customer';
  expiresAt: number;
}

/**
 * Session validation result
 */
interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
}

interface CustomerMessageNotification {
  id?: string;
  content?: unknown;
  messageType?: string;
  senderType?: string;
  senderId?: string;
  platform?: string;
}

/**
 * Connection info - stores WebSocket and associated user data
 * FIX: Now using connectionId as key to support multiple connections per user
 */
interface ConnectionInfo {
  socket: WebSocket;
  userId: string;
  displayName: string;
  role: string;
  connectedAt: number;
}

/**
 * CustomerConversationDO
 *
 * Purpose: Manage WebSocket connections for a single customer conversation
 * Responsibilities:
 * 1. WebSocket connection lifecycle management
 * 2. Real-time message broadcasting to all connected agents
 * 3. Agent presence tracking (online/offline)
 * 4. Connection cleanup and error handling
 *
 * Architecture Pattern (from Chat Project):
 * - One DO instance per conversation (identified by conversationId)
 * -  FIX: Map<connectionId, ConnectionInfo> for connection tracking
 * - Supports multiple connections from the same user (different tabs/browsers)
 * - Direct broadcasting (no intermediate hops)
 * - Auto-cleanup on disconnect
 */
export class CustomerConversationDO extends DurableObject<Bindings> {
  // FIX: Changed from Map<userId, WebSocket> to Map<connectionId, ConnectionInfo>
  // This allows multiple connections from the same user (e.g., multiple browser tabs)
  private connections = new Map<string, ConnectionInfo>();
  private conversationId: string = '';

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    console.log('[CustomerConversationDO] Initialized');
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Validate session against KV store
   * Uses the same session key format as KVSessionService
   */
  private async validateSession(sessionId: string): Promise<SessionValidationResult> {
    if (!sessionId) {
      return { valid: false, error: 'Session ID is required' };
    }

    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.env.SESSIONS.get(sessionKey, 'text');

      if (!sessionData) {
        return { valid: false, error: 'Session not found' };
      }

      const session: SessionData = JSON.parse(sessionData);

      // Check expiration
      if (session.expiresAt < nowMs()) {
        return { valid: false, error: 'Session expired' };
      }

      return { valid: true, session };
    } catch (error) {
      console.error('[CustomerConversationDO] Session validation error:', error);
      return { valid: false, error: 'Invalid session format' };
    }
  }

  /**
   * Handle incoming HTTP requests
   * Routes:
   * - /ws - WebSocket upgrade endpoint
   * - /notify-message - Notify about new message (for broadcasting)
   */
  // P2-6: Added override modifier for strict mode compliance
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade endpoint
    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade') === 'websocket') {
        const sessionId = url.searchParams.get('sessionId') ?? '';
        const conversationId = url.searchParams.get('conversationId') ?? '';

        // Check if user was already validated by index.ts (preferred path)
        const validated = url.searchParams.get('validated') === 'true';
        const validatedUserId = url.searchParams.get('validatedUserId');
        const validatedRole = url.searchParams.get('validatedRole');
        const validatedDisplayName = url.searchParams.get('validatedDisplayName');

        this.conversationId = conversationId;

        // If already validated by index.ts, skip redundant KV validation
        if (validated && validatedUserId) {
          return this.clientConnectedValidated(
            validatedUserId,
            validatedRole || 'agent',
            validatedDisplayName || 'User',
            conversationId
          );
        }

        // Fallback: validate session if not pre-validated (for direct DO access)
        return this.clientConnected(sessionId, conversationId);
      }
      return new Response('Expected WebSocket', { status: 400 });
    }

    // Notify about new message endpoint (called by CustomerMessageDO)
    if (url.pathname === '/notify-message' && request.method === 'POST') {
      try {
        const { conversationId, message } = await request.json() as {
          conversationId: string;
          message: CustomerMessageNotification;
        };

        // DEBUG: Log detailed connection info
        const connectionDetails = this.getConnectionDetails();
        console.log(`[CustomerConversationDO] Received notify-message request:`, {
          conversationId,
          messageId: message?.id,
          doConversationId: this.conversationId,
          totalConnections: this.connections.size,
          connectionDetails: connectionDetails
        });

        await this.notifyNewMessage(conversationId, message);

        // DEBUG: Return connection info in response
        return new Response(JSON.stringify({
          success: true,
          debug: {
            totalConnections: this.connections.size,
            connectedUsers: this.getConnectedUsers(),
            doConversationId: this.conversationId
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[CustomerConversationDO] Error handling notify-message:', error);
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Notify about message update (called after media processing completes)
    if (url.pathname === '/notify-message-updated' && request.method === 'POST') {
      try {
        const { conversationId, messageId, data } = await request.json() as {
          conversationId: string;
          messageId: string;
          data: { file_attachments?: unknown[] };
        };

        console.log(`[CustomerConversationDO] Received notify-message-updated:`, {
          conversationId,
          messageId,
          attachmentCount: data?.file_attachments?.length || 0,
          totalConnections: this.connections.size
        });

        await this.notifyMessageUpdated(conversationId, messageId, data);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[CustomerConversationDO] Error handling notify-message-updated:', error);
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle WebSocket connection establishment
   * Adapted from Chat Project's AuthorizationDurableObject.clientConnected()
   */
  async clientConnected(sessionId: string, conversationId: string): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!sessionId) {
      server.close(1008, 'Session ID is required');
      return new Response('Session ID is required', { status: 400 });
    }

    // Validate session against KV store
    const validation = await this.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      const errorMessage = validation.error || 'Invalid session';
      server.close(1008, errorMessage);
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = validation.session.userId;
    const displayName = validation.session.displayName;
    const role = validation.session.role || 'agent';

    // FIX: Generate unique connectionId to support multiple connections per user
    const connectionId = this.generateConnectionId();

    console.log(`[CustomerConversationDO] Client connecting:`, {
      connectionId,
      conversationId,
      userId,
      role
    });

    // Accept the WebSocket FIRST before any operations
    server.accept();

    // FIX: Store with connectionId as key, allowing multiple connections per user
    this.connections.set(connectionId, {
      socket: server,
      userId,
      displayName,
      role,
      connectedAt: nowMs()
    });

    console.log(`[CustomerConversationDO] Client connected. Total connections: ${this.connections.size}, Unique users: ${this.getUniqueUserCount()}`);

    // Notify other clients about the new connection (agent presence)
    await this.broadcastUserPresence(userId, true, connectionId);

    // Set up event listeners
    server.addEventListener('message', async (msg) => {
      await this.webSocketMessage(server, msg.data);
    });

    // FIX: Use connectionId for cleanup
    server.addEventListener('close', async () => {
      console.log(`[CustomerConversationDO] Connection closed: ${connectionId} (user: ${userId})`);
      this.connections.delete(connectionId);

      // Only broadcast offline if user has no more connections
      if (!this.isUserConnected(userId)) {
        await this.broadcastUserPresence(userId, false, connectionId);
      }
      console.log(`[CustomerConversationDO] Remaining connections: ${this.connections.size}`);
    });

    server.addEventListener('error', async (err) => {
      console.error(`[CustomerConversationDO] WebSocket error for connection ${connectionId}:`, err);
      this.connections.delete(connectionId);

      // Only broadcast offline if user has no more connections
      if (!this.isUserConnected(userId)) {
        await this.broadcastUserPresence(userId, false, connectionId);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket connection with pre-validated user info
   * Called when index.ts has already validated the JWT token
   * This skips redundant KV session validation for better performance
   */
  async clientConnectedValidated(
    userId: string,
    role: string,
    displayName: string,
    conversationId: string
  ): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // FIX: Generate unique connectionId to support multiple connections per user
    const connectionId = this.generateConnectionId();

    console.log(`[CustomerConversationDO] Client connecting (pre-validated):`, {
      connectionId,
      conversationId,
      userId,
      role,
      displayName
    });

    // Accept the WebSocket FIRST before any operations
    server.accept();

    // FIX: Store with connectionId as key, allowing multiple connections per user
    this.connections.set(connectionId, {
      socket: server,
      userId,
      displayName,
      role,
      connectedAt: nowMs()
    });

    console.log(`[CustomerConversationDO] Client connected (pre-validated). Total connections: ${this.connections.size}, Unique users: ${this.getUniqueUserCount()}`);

    // Notify other clients about the new connection (agent presence)
    await this.broadcastUserPresence(userId, true, connectionId);

    // Set up event listeners
    server.addEventListener('message', async (msg) => {
      await this.webSocketMessage(server, msg.data);
    });

    // FIX: Use connectionId for cleanup
    server.addEventListener('close', async () => {
      console.log(`[CustomerConversationDO] Connection closed: ${connectionId} (user: ${userId})`);
      this.connections.delete(connectionId);

      // Only broadcast offline if user has no more connections
      if (!this.isUserConnected(userId)) {
        await this.broadcastUserPresence(userId, false, connectionId);
      }
      console.log(`[CustomerConversationDO] Remaining connections: ${this.connections.size}`);
    });

    server.addEventListener('error', async (err) => {
      console.error(`[CustomerConversationDO] WebSocket error for connection ${connectionId}:`, err);
      this.connections.delete(connectionId);

      // Only broadcast offline if user has no more connections
      if (!this.isUserConnected(userId)) {
        await this.broadcastUserPresence(userId, false, connectionId);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages
   * Currently not used - messages sent via HTTP API then broadcasted
   */
  // P2-6: Added override modifier for strict mode compliance
  override async webSocketMessage(_ws: WebSocket, message: unknown) {
    console.log('[CustomerConversationDO] Received WebSocket message:', message);
    // Future: Handle client-side events (typing indicators, read receipts, etc.)
  }

  /**
   * Check if a user has any active connections
   */
  private isUserConnected(userId: string): boolean {
    for (const conn of this.connections.values()) {
      if (conn.userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get count of unique connected users
   */
  private getUniqueUserCount(): number {
    const userIds = new Set<string>();
    for (const conn of this.connections.values()) {
      userIds.add(conn.userId);
    }
    return userIds.size;
  }

  /**
   * Broadcast user presence changes to all connected clients
   * Adapted from Chat Project's AuthorizationDO.broadcastUserPresence()
   *
   * FIX: Now broadcasts to ALL connections, not just other users
   * This ensures all tabs/windows of the same user receive updates
   */
  private async broadcastUserPresence(userId: string, isOnline: boolean, excludeConnectionId?: string) {
    const notification = JSON.stringify({
      type: isOnline ? 'USER_CONNECTED' : 'USER_DISCONNECTED',
      userId,
      timestamp: nowMs()
    });

    console.log(`[CustomerConversationDO] Broadcasting presence:`, {
      userId,
      isOnline,
      totalConnections: this.connections.size,
      uniqueUsers: this.getUniqueUserCount()
    });

    // FIX: Broadcast to ALL connections except the one that triggered the event
    for (const [connId, conn] of this.connections.entries()) {
      // Skip the connection that triggered this event
      if (connId === excludeConnectionId) {
        continue;
      }

      if (conn.socket.readyState === WebSocket.OPEN) {
        try {
          conn.socket.send(notification);
          console.log(`  [CustomerConversationDO] Sent presence to connection: ${connId} (user: ${conn.userId})`);
        } catch (error) {
          console.error(`[CustomerConversationDO] Failed to send presence to ${connId}:`, error);
          this.connections.delete(connId);
        }
      }
    }
  }

  /**
   * Broadcast a new message to all connected clients
   * Called by CustomerMessageDO after message creation
   * Adapted from Chat Project's AuthorizationDO.notifyChannelUpdate()
   *
   * FIX: Now broadcasts to ALL connections, including multiple tabs from same user
   */
  public async notifyNewMessage(conversationId: string, message: CustomerMessageNotification): Promise<void> {
    // FIX: Use lowercase 'new_message' to match frontend WebSocketEventRouter
    // The frontend expects lowercase event types for routing to channels
    const notification = JSON.stringify({
      type: 'new_message',
      conversationId,
      // FIX: Include message data at top level for frontend compatibility
      data: {
        conversationId,
        content: message.content,
        messageType: message.messageType,
        senderType: message.senderType,
        senderId: message.senderId,
        platform: message.platform || 'line',
        timestamp: nowMs()
      },
      message, // Keep original message for backward compatibility
      timestamp: nowMs()
    });

    // Get unique user IDs for logging
    const uniqueUserIds = new Set<string>();
    for (const conn of this.connections.values()) {
      uniqueUserIds.add(conn.userId);
    }

    console.log(`[CustomerConversationDO] Broadcasting new message:`, {
      conversationId,
      messageId: message.id,
      totalConnections: this.connections.size,
      uniqueUsers: uniqueUserIds.size,
      connectedUserIds: Array.from(uniqueUserIds)
    });

    let successCount = 0;
    let failureCount = 0;

    // FIX: Broadcast to ALL connections (including multiple tabs from same user)
    for (const [connId, conn] of this.connections.entries()) {
      console.log(`[CustomerConversationDO] Checking connection ${connId} (user: ${conn.userId}):`, {
        socketState: conn.socket.readyState,
        isOpen: conn.socket.readyState === WebSocket.OPEN
      });

      if (conn.socket.readyState === WebSocket.OPEN) {
        try {
          conn.socket.send(notification);
          successCount++;
          console.log(`[CustomerConversationDO] Message sent to connection ${connId} (user: ${conn.userId})`);
        } catch (error) {
          failureCount++;
          console.error(`[CustomerConversationDO] Failed to send message to ${connId}:`, error);
          // Remove stale connection
          this.connections.delete(connId);
        }
      } else {
        failureCount++;
        console.warn(`  [CustomerConversationDO] Removing stale connection: ${connId}`);
        this.connections.delete(connId);
      }
    }

    console.log(`[CustomerConversationDO] Broadcast complete:`, {
      successCount,
      failureCount,
      remainingConnections: this.connections.size
    });
  }

  /**
   * Broadcast a message_updated event to all connected clients
   * Called after deferred media processing completes (e.g., R2 upload done, file_attachments ready)
   */
  public async notifyMessageUpdated(
    conversationId: string,
    messageId: string,
    data: { file_attachments?: unknown[] }
  ): Promise<void> {
    const notification = JSON.stringify({
      type: 'message_updated',
      conversationId,
      data: {
        conversationId,
        messageId,
        ...data
      },
      timestamp: nowMs()
    });

    let successCount = 0;
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.socket.readyState === WebSocket.OPEN) {
        try {
          conn.socket.send(notification);
          successCount++;
        } catch (error) {
          console.error(`[CustomerConversationDO] Failed to send update to ${connId}:`, error);
          this.connections.delete(connId);
        }
      } else {
        this.connections.delete(connId);
      }
    }

    console.log(`[CustomerConversationDO] message_updated broadcast:`, {
      messageId,
      successCount,
      remainingConnections: this.connections.size
    });
  }

  /**
   * Get current connection count
   * Useful for monitoring and debugging
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get list of connected user IDs (unique)
   * Useful for debugging
   */
  public getConnectedUsers(): string[] {
    const userIds = new Set<string>();
    for (const conn of this.connections.values()) {
      userIds.add(conn.userId);
    }
    return Array.from(userIds);
  }

  /**
   * Get detailed connection info for debugging
   */
  public getConnectionDetails(): Array<{ connectionId: string; userId: string; connectedAt: number }> {
    const details: Array<{ connectionId: string; userId: string; connectedAt: number }> = [];
    for (const [connId, conn] of this.connections.entries()) {
      details.push({
        connectionId: connId,
        userId: conn.userId,
        connectedAt: conn.connectedAt
      });
    }
    return details;
  }
}
