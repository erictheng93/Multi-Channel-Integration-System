// UserConnection State Management
// Manages user preferences, metrics/stats, storage persistence, and initialization

import type { WebSocketConnection, WebSocketMessage } from '../types/websocket-types';
import { nowMs } from '@/utils/timestamp';

export interface UserPreferences {
  notificationSettings: {
    newMessage: boolean;
    messageRecall: boolean;
    conversationAssignment: boolean;
    systemNotifications: boolean;
  };
}

export interface UserStats {
  totalConnections: number;
  messagesSent: number;
  messagesReceived: number;
  conversationsJoined: number;
  lastActivity: number;
}

export interface UserStateSnapshot {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
  connectionCount: number;
  subscriptions: string[];
  preferences: UserPreferences;
  stats: UserStats;
}

/**
 * Manages connection state, presence, preferences, and metrics for a user.
 * Delegates storage operations to the Durable Object's state.storage.
 */
export class UserConnectionStateManager {
  private connections = new Map<string, WebSocketConnection>();
  private isOnline = false;
  private lastSeen = nowMs();
  private preferences: UserPreferences = {
    notificationSettings: {
      newMessage: true,
      messageRecall: true,
      conversationAssignment: true,
      systemNotifications: true,
    },
  };
  private stats: UserStats = {
    totalConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    conversationsJoined: 0,
    lastActivity: nowMs(),
  };

  // Configuration
  readonly MAX_CONNECTIONS_PER_USER = 5;
  readonly CONNECTION_CLEANUP_INTERVAL = 300000; // 5 minutes

  get connectionCount(): number {
    return this.connections.size;
  }

  get online(): boolean {
    return this.isOnline;
  }

  get currentLastSeen(): number {
    return this.lastSeen;
  }

  get currentPreferences(): UserPreferences {
    return this.preferences;
  }

  get currentStats(): UserStats {
    return { ...this.stats };
  }

  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  isAtConnectionLimit(): boolean {
    return this.connections.size >= this.MAX_CONNECTIONS_PER_USER;
  }

  wasOffline(): boolean {
    return this.connections.size === 0;
  }

  addConnection(connection: WebSocketConnection): void {
    this.connections.set(connection.connectionId, connection);
    this.isOnline = true;
    this.stats.totalConnections++;
  }

  removeConnection(connectionId: string): WebSocketConnection | undefined {
    const connection = this.connections.get(connectionId);
    if (!connection) return undefined;

    this.connections.delete(connectionId);
    this.isOnline = this.connections.size > 0;
    if (!this.isOnline) {
      this.lastSeen = nowMs();
    }
    return connection;
  }

  updateActivity(connection?: WebSocketConnection): void {
    const now = nowMs();
    if (connection) {
      connection.lastActivity = now;
    }
    this.lastSeen = now;
    this.stats.lastActivity = now;
  }

  incrementMessagesSent(): void {
    this.stats.messagesSent++;
  }

  incrementConversationsJoined(): void {
    this.stats.conversationsJoined++;
  }

  updatePresence(): void {
    this.lastSeen = nowMs();
    this.isOnline = true;
  }

  updatePreferences(newPreferences: Record<string, unknown>): UserPreferences {
    this.preferences = { ...this.preferences, ...newPreferences } as UserPreferences;
    return this.preferences;
  }

  generateConnectionId(): string {
    return `user_conn_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // =================== Storage Operations ===================

  async initializeFromStorage(storage: DurableObjectStorage): Promise<void> {
    try {
      const userState = (await storage.get('userState')) as UserStateSnapshot | undefined;
      if (userState) {
        this.isOnline = userState.isOnline || false;
        this.lastSeen = userState.lastSeen || nowMs();
        this.preferences = { ...this.preferences, ...userState.preferences };
        this.stats = { ...this.stats, ...userState.stats };
      }
    } catch (error) {
      console.error('[UserConnectionState] State restoration error:', error);
    }
  }

  async persistConnectionInfo(
    storage: DurableObjectStorage,
    connectionId: string,
    userId: string,
    deviceId?: unknown
  ): Promise<void> {
    await storage.put(`connection:${connectionId}`, {
      userId,
      connectedAt: nowMs(),
      deviceId,
      lastActivity: nowMs(),
    });
  }

  async removeConnectionFromStorage(storage: DurableObjectStorage, connectionId: string): Promise<void> {
    await storage.delete(`connection:${connectionId}`);
  }

  async persistUserState(storage: DurableObjectStorage, userId: string, subscriptions: Set<string>): Promise<void> {
    const state: UserStateSnapshot = {
      userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connectionCount: this.connections.size,
      subscriptions: Array.from(subscriptions),
      preferences: this.preferences,
      stats: { ...this.stats },
    };
    await storage.put('userState', state);
  }

  // =================== Messaging Utilities ===================

  sendMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (connection.websocket.readyState === 1) {
          // WebSocket.OPEN = 1
          connection.websocket.send(JSON.stringify(message));
          connection.lastActivity = nowMs();
        }
        resolve();
      } catch (error) {
        console.error(`[UserConnectionState] Send message error for ${connection.connectionId}:`, error);
        resolve();
      }
    });
  }

  sendError(connection: WebSocketConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      error,
      timestamp: nowMs(),
    });
  }

  async broadcastToAllConnections(message: WebSocketMessage): Promise<void> {
    const broadcasts = Array.from(this.connections.values()).map((connection) => {
      return this.sendMessage(connection, message);
    });
    await Promise.allSettled(broadcasts);
    console.log(`[UserConnectionState] Message broadcast to ${this.connections.size} connections`);
  }

  // =================== Cleanup ===================

  async cleanupInactiveConnections(removeConnectionFn: (connectionId: string) => Promise<void>): Promise<void> {
    const now = nowMs();
    const inactiveThreshold = 600000; // 10 minutes

    const inactiveConnections = Array.from(this.connections.entries()).filter(
      ([_, connection]) => now - connection.lastActivity > inactiveThreshold
    );

    for (const [connectionId] of inactiveConnections) {
      console.log(`[UserConnectionState] Removing inactive connection: ${connectionId}`);
      await removeConnectionFn(connectionId);
    }
  }

  getStatusSnapshot(userId: string): Record<string, unknown> {
    return {
      userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connectionCount: this.connections.size,
      stats: this.stats,
    };
  }

  getMetricsSnapshot(userId: string): Record<string, unknown> {
    return {
      userId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connections: this.connections.size,
      stats: this.stats,
      uptime: Date.now() - (this.stats.lastActivity - 3600000),
    };
  }
}
