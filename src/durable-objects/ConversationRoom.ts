// Unified ConversationRoom Durable Object
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 管理特定對話的 WebSocket 連接和實時消息傳遞
//
// Mode Configuration:
// - 'full': Complete features including message history, advanced auth, permissions
// - 'simplified': Minimal features for high-traffic rooms with reduced memory footprint
//
// Architecture: Thin facade delegating to 5 service/handler classes:
// - RoomHelpers: Shared context type, utility methods
// - RoomAuthService: Challenge-response auth, JWT verification
// - RoomStorageService: Debounced storage writes, state initialization
// - RoomMessageService: Broadcasting, message ordering, sync
// - RoomConnectionManager: Connection lifecycle, WebSocket handlers, participant tracking
// - RoomShardingHandler: Sharding RPC endpoints

import type { WebSocketConnection } from '../types/websocket-types';
import type { WebSocketAuthChallenge } from '../services/websocket-auth-service';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../utils/test-logger';

// Service imports
import type { RoomContext } from './services/room-helpers';
import { RoomHelpers } from './services/room-helpers';
import { RoomAuthService } from './services/room-auth-service';
import { RoomStorageService } from './services/room-storage-service';
import { RoomMessageService } from './services/room-message-service';
import { RoomConnectionManager } from './services/room-connection-manager';
import { RoomShardingHandler } from './handlers/room-sharding-handler';
import { nowMs } from '@/utils/timestamp'

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
  // Shared context passed to all services by reference
  private roomContext: RoomContext;

  // Service composition
  private helpers: RoomHelpers;
  private authService: RoomAuthService;
  private storageService: RoomStorageService;
  private messageService: RoomMessageService;
  private connectionManager: RoomConnectionManager;
  private shardingHandler: RoomShardingHandler;

  constructor(state: DurableObjectState, env: any, config?: ConversationRoomConfig) {
    const resolvedConfig = config || { mode: 'full' };
    const maxConnections = resolvedConfig.maxConnections || 100;

    /**
     * 重連同步優化: 增加訊息緩存到 50 條
     *
     * Rationale:
     * - 10 條訊息約覆蓋 1-2 分鐘的對話
     * - 50 條訊息可覆蓋 5-10 分鐘的斷線期間
     * - 支援 WebSocket 重連後的訊息同步功能
     * - 記憶體影響極小 (~50KB per DO)
     *
     * 重連同步機制:
     * - 客戶端斷線時記錄 lastMessageTimestamp
     * - 重連後比對 serverLastMessageAt vs clientLastTs
     * - 若 server 有較新訊息，發送 sync_request
     * - 伺服器返回 since 時間後的遺漏訊息
     */
    const maxMessageHistory = resolvedConfig.maxMessageHistory || 50;
    const inactivityTimeout = resolvedConfig.inactivityTimeout || 300000;

    // Build shared mutable context
    this.roomContext = {
      state,
      env,
      config: resolvedConfig,

      // Core state (both modes)
      connections: new Map<string, WebSocketConnection>(),
      participants: new Set<string>(),
      conversationId: 'unknown', // Will be set from request URL
      messageCounter: 0,
      lastActivity: nowMs(),
      isActive: true,

      // Sharding metadata (Week 2: Sharding Implementation)
      shardMetadata: {
        initialized: false,
        maxConnections: maxConnections
      },
      crossShardBroadcastingEnabled: true,

      // Full mode only
      messageHistory: [],
      challenges: new Map<string, WebSocketAuthChallenge>(),

      // Storage optimization
      messageDirty: false,
      writeDebounceTimer: null,

      // Configuration constants
      MAX_CONNECTIONS: maxConnections,
      MAX_MESSAGE_HISTORY: maxMessageHistory,
      INACTIVITY_TIMEOUT: inactivityTimeout,
      CHALLENGE_TTL: 30000, // 30 seconds for challenge expiration
      STORAGE_WRITE_DEBOUNCE_MS: 5000, // 5 second debounce
    };

    // Initialize services with shared context
    this.helpers = new RoomHelpers(this.roomContext);
    this.authService = new RoomAuthService(this.roomContext, this.helpers);
    this.storageService = new RoomStorageService(this.roomContext, this.helpers);
    this.messageService = new RoomMessageService(this.roomContext, this.helpers, this.storageService);
    this.connectionManager = new RoomConnectionManager(this.roomContext, this.helpers, this.messageService, this.storageService);
    this.shardingHandler = new RoomShardingHandler(this.roomContext, this.helpers, this.messageService);

    // Initialize state from storage
    this.storageService.initializeFromStorage();

    // Set up periodic cleanup (full mode only)
    if (this.helpers.isFullMode()) {
      this.connectionManager.setupCleanupTasks();
    }

    testSafeLog(`${getEmojiPrefix('BUILD')}[ConversationRoom] Initialized in ${resolvedConfig.mode} mode (max connections: ${maxConnections})`);
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
        // Week 2: Sharding RPC endpoints
        case '/capacity-check':
          return this.shardingHandler.handleCapacityCheck(request);
        case '/metadata':
          return this.shardingHandler.handleGetShardMetadata(request);
        case '/initialize':
          return this.shardingHandler.handleInitializeShard(request);
        case '/cross-shard-broadcast':
          return this.shardingHandler.handleCrossShardBroadcast(request);

        // Existing endpoints
        case '/challenge':
          // Full mode only
          if (!this.helpers.isFullMode()) {
            return new Response('Challenge endpoint not available in simplified mode', { status: 404 });
          }
          return this.authService.handleGenerateChallenge(request);
        case '/connect':
          return this.connectionManager.handleConnect(request);
        case '/disconnect':
          return this.connectionManager.handleDisconnect(request);
        case '/broadcast':
          return this.connectionManager.handleBroadcast(request);
        case '/participants':
          return this.connectionManager.handleGetParticipants(request);
        case '/metrics':
          return this.connectionManager.handleGetMetrics(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Request handling error:`, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get('conversationId');

      // Set conversationId
      if (conversationId) {
        this.roomContext.conversationId = conversationId;
      }

      let userId: string;
      let role: string;

      // Full mode: Support both token and challenge-response authentication
      // Simplified mode: Only query parameter authentication
      if (this.helpers.isFullMode()) {
        const authResult = await this.authService.authenticateFullMode(url, request);
        if (!authResult.success) {
          return new Response(authResult.error, { status: authResult.status });
        }
        userId = authResult.userId!;
        role = authResult.role!;
      } else {
        const authResult = await this.authService.authenticateSimplifiedMode(url);
        if (!authResult.success) {
          return new Response(authResult.error, { status: authResult.status });
        }
        userId = authResult.userId!;
        role = authResult.role!;
      }

      // Check connection limits
      if (this.roomContext.connections.size >= this.roomContext.MAX_CONNECTIONS) {
        return new Response('Connection limit reached', { status: 429 });
      }

      // Create WebSocket pair
      const [client, server] = Object.values(new WebSocketPair());

      if (!server) {
        throw new Error('Failed to create WebSocket server');
      }

      const connectionId = this.helpers.generateConnectionId();
      const connection: WebSocketConnection = {
        websocket: server,
        userId,
        conversationId: this.roomContext.conversationId,
        role: role as 'admin' | 'agent',
        connectionId,
        lastActivity: nowMs(),
        isActive: true,
        metadata: this.helpers.isFullMode() ? {
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP')
        } : undefined
      };

      // Set up WebSocket event handlers
      this.connectionManager.setupWebSocketHandlers(connection);

      // Add connection to room
      await this.connectionManager.addConnection(connection);

      // Accept the WebSocket connection
      server.accept();

      return new Response(null, { status: 101, webSocket: client as WebSocket });

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] WebSocket upgrade error:`, error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  }
}
