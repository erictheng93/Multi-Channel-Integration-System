// Room Helpers
// Foundation utilities: shared context type, utility methods for ConversationRoom services

import type {
  WebSocketConnection,
  WebSocketMessage,
} from '../../types/websocket-types';
import type { RealtimeEvent } from '../../types';
import type { WebSocketAuthChallenge } from '../../services/websocket-auth-service';
import type { ConversationRoomConfig } from '../ConversationRoom';
import { testSafeError, getEmojiPrefix } from '../../utils/test-logger';
import { nowMs } from '@/utils/timestamp'

// =================== Shared Types ===================

/**
 * Shard metadata for Week 2: Sharding Implementation
 */
export interface ShardMetadata {
  initialized: boolean;
  shardId?: string;
  shardIndex?: number;
  createdAt?: number;
  maxConnections: number;
}

/**
 * Shared context passed to all ConversationRoom sub-services by reference.
 * All collections (Maps, Sets) are mutable and shared.
 */
export interface RoomContext {
  state: DurableObjectState;
  env: any;
  config: ConversationRoomConfig;

  // Core state (both modes)
  connections: Map<string, WebSocketConnection>;
  participants: Set<string>;
  conversationId: string;
  messageCounter: number;
  lastActivity: number;
  isActive: boolean;

  // Sharding metadata
  shardMetadata: ShardMetadata;
  crossShardBroadcastingEnabled: boolean;

  // Full mode only
  messageHistory: RealtimeEvent[];
  challenges: Map<string, WebSocketAuthChallenge>;

  // Storage optimization
  messageDirty: boolean;
  writeDebounceTimer: any;

  // Configuration constants
  MAX_CONNECTIONS: number;
  MAX_MESSAGE_HISTORY: number;
  INACTIVITY_TIMEOUT: number;
  CHALLENGE_TTL: number;
  STORAGE_WRITE_DEBOUNCE_MS: number;
}

// =================== Helpers Class ===================

/**
 * Foundation utilities for ConversationRoom:
 * - Mode detection helpers
 * - ID generation
 * - WebSocket send/error
 */
export class RoomHelpers {
  constructor(private ctx: RoomContext) {}

  isFullMode(): boolean {
    return this.ctx.config.mode === 'full';
  }

  isSimplifiedMode(): boolean {
    return this.ctx.config.mode === 'simplified';
  }

  generateConnectionId(): string {
    return `conn_${nowMs()}_${crypto.randomUUID().substring(0, 8)}`;
  }

  generateEventId(): string {
    return `event_${nowMs()}_${crypto.randomUUID().substring(0, 8)}`;
  }

  sendMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (connection.websocket.readyState === 1) { // WebSocket.OPEN = 1
          connection.websocket.send(JSON.stringify(message));
          connection.lastActivity = nowMs();
        }
        resolve();
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Send message error for ${connection.connectionId}:`, error);
        resolve();
      }
    });
  }

  sendError(connection: WebSocketConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      error,
      timestamp: nowMs()
    });
  }
}
