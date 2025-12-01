// CustomerConversationDO - Simplified WebSocket Management for Customer Conversations
// Inspired by Chat Project's AuthorizationDurableObject
// Manages WebSocket connections and real-time broadcasting for single customer conversations

import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';

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
 * - Map<userId, WebSocket> for connection tracking
 * - Direct broadcasting (no intermediate hops)
 * - Auto-cleanup on disconnect
 */
export class CustomerConversationDO extends DurableObject<Bindings> {
  private connections = new Map<string, WebSocket>();
  private conversationId: string = '';

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    console.log('🏗️ [CustomerConversationDO] Initialized');
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
      if (session.expiresAt < Date.now()) {
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

        this.conversationId = conversationId;

        return this.clientConnected(sessionId, conversationId);
      }
      return new Response('Expected WebSocket', { status: 400 });
    }

    // Notify about new message endpoint (called by CustomerMessageDO)
    if (url.pathname === '/notify-message' && request.method === 'POST') {
      try {
        const { conversationId, message } = await request.json() as { conversationId: string; message: any };

        console.log(`📬 [CustomerConversationDO] Received notify-message request:`, {
          conversationId,
          messageId: message?.id
        });

        await this.notifyNewMessage(conversationId, message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('❌ [CustomerConversationDO] Error handling notify-message:', error);
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

    console.log(`🔌 [CustomerConversationDO] Client connecting:`, {
      conversationId,
      userId,
      role: validation.session.role
    });

    // Accept the WebSocket FIRST before any operations
    server.accept();

    // Store the server-side socket with the user ID as the key
    this.connections.set(userId, server);

    console.log(`✅ [CustomerConversationDO] Client connected. Total connections: ${this.connections.size}`);

    // Notify other clients about the new connection (agent presence)
    await this.broadcastUserPresence(userId, true);

    // Set up event listeners
    server.addEventListener('message', async (msg) => {
      await this.webSocketMessage(server, msg.data);
    });

    server.addEventListener('close', async () => {
      console.log(`🔌 [CustomerConversationDO] Client disconnected: ${userId}`);
      this.connections.delete(userId);
      await this.broadcastUserPresence(userId, false);
      console.log(`📊 [CustomerConversationDO] Remaining connections: ${this.connections.size}`);
    });

    server.addEventListener('error', async (err) => {
      console.error(`❌ [CustomerConversationDO] WebSocket error for user ${userId}:`, err);
      this.connections.delete(userId);
      await this.broadcastUserPresence(userId, false);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages
   * Currently not used - messages sent via HTTP API then broadcasted
   */
  // P2-6: Added override modifier for strict mode compliance
  override async webSocketMessage(ws: WebSocket, message: any) {
    console.log('[CustomerConversationDO] Received WebSocket message:', message);
    // Future: Handle client-side events (typing indicators, read receipts, etc.)
  }

  /**
   * Broadcast user presence changes to all connected clients
   * Adapted from Chat Project's AuthorizationDO.broadcastUserPresence()
   */
  private async broadcastUserPresence(userId: string, isOnline: boolean) {
    const notification = JSON.stringify({
      type: isOnline ? 'USER_CONNECTED' : 'USER_DISCONNECTED',
      userId,
      timestamp: Date.now()
    });

    console.log(`📡 [CustomerConversationDO] Broadcasting presence:`, {
      userId,
      isOnline,
      totalConnections: this.connections.size
    });

    // Broadcast to all connected clients except the user who triggered the event
    for (const [connectedUserId, socket] of this.connections.entries()) {
      if (connectedUserId !== userId && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(notification);
          console.log(`✉️  [CustomerConversationDO] Sent presence to: ${connectedUserId}`);
        } catch (error) {
          console.error(`❌ [CustomerConversationDO] Failed to send presence to ${connectedUserId}:`, error);
          this.connections.delete(connectedUserId);
        }
      }
    }
  }

  /**
   * Broadcast a new message to all connected clients
   * Called by CustomerMessageDO after message creation
   * Adapted from Chat Project's AuthorizationDO.notifyChannelUpdate()
   */
  public async notifyNewMessage(conversationId: string, message: any): Promise<void> {
    const notification = JSON.stringify({
      type: 'NEW_MESSAGE',
      conversationId,
      message,
      timestamp: Date.now()
    });

    console.log(`📡 [CustomerConversationDO] Broadcasting new message:`, {
      conversationId,
      messageId: message.id,
      totalConnections: this.connections.size,
      connectedUsers: Array.from(this.connections.keys())
    });

    let successCount = 0;
    let failureCount = 0;

    // Broadcast to all connected clients
    for (const [userId, socket] of this.connections.entries()) {
      console.log(`🔍 [CustomerConversationDO] Checking socket for user ${userId}:`, {
        socketState: socket.readyState,
        isOpen: socket.readyState === WebSocket.OPEN
      });

      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(notification);
          successCount++;
          console.log(`✅ [CustomerConversationDO] Message sent to user ${userId}`);
        } catch (error) {
          failureCount++;
          console.error(`❌ [CustomerConversationDO] Failed to send message to ${userId}:`, error);
          // Remove stale connection
          this.connections.delete(userId);
        }
      } else {
        failureCount++;
        console.warn(`⚠️  [CustomerConversationDO] Removing stale connection for user ${userId}`);
        this.connections.delete(userId);
      }
    }

    console.log(`📊 [CustomerConversationDO] Broadcast complete:`, {
      successCount,
      failureCount,
      totalAttempted: this.connections.size + failureCount
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
   * Get list of connected user IDs
   * Useful for debugging
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}
