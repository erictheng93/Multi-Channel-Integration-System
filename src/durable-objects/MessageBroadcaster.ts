// MessageBroadcaster Durable Object — Facade
// Central hub for all real-time communication event distribution.
// Delegates to focused sub-services for delivery, connections, locks, and HTTP handling.

import type {
  WebSocketSubscription,
  DistributedLock
} from '../types/websocket-types';
import { createContextLogger } from '../utils/logger';

import {
  BroadcasterHelpers,
  type BroadcasterContext,
  type DistributionStats
} from './services/broadcaster-helpers';
import { BroadcasterLockService } from './services/broadcaster-lock-service';
import { BroadcasterDeliveryService } from './services/broadcaster-delivery-service';
import { BroadcasterConnectionRegistry } from './services/broadcaster-connection-registry';
import { BroadcasterHttpHandlers } from './handlers/broadcaster-http-handlers';

const log = createContextLogger('MessageBroadcaster');

/**
 * MessageBroadcaster Durable Object
 *
 * Manages:
 * 1. Global event distribution across all conversation rooms and user connections
 * 2. Intelligent message routing based on subscriptions and permissions
 * 3. Event batching and prioritization for efficiency
 * 4. Cross-room communication and coordination
 * 5. System-wide notifications and broadcasts
 */
export class MessageBroadcaster implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  // Shared mutable state (passed by reference to all sub-services)
  private eventQueue: any[] = [];
  private highPriorityQueue: any[] = [];
  private conversationRooms = new Map<string, DurableObjectStub>();
  private userConnections = new Map<string, DurableObjectStub>();
  private targetFilters = new Map<string, WebSocketSubscription[]>();
  private locks = new Map<string, DistributedLock>();
  private distributionStats: DistributionStats = {
    totalEvents: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    lastProcessed: Date.now(),
    eventsPerSecond: 0,
    averageLatency: 0,
    queueDepth: 0,
    evictedEvents: 0,
    activeConnections: 0
  };

  // Configuration
  private static readonly CONFIG = {
    MAX_QUEUE_SIZE: 10000,
    BATCH_SIZE: 100,
    HIGH_PRIORITY_BATCH_SIZE: 10,
    HIGH_PRIORITY_TIMEOUT: 100,
    PROCESSING_INTERVAL: 500,
    METRICS_INTERVAL: 10000,
    DELIVERY_BATCH_SIZE: 10,
    MAX_PARALLEL_BATCHES: 5,
    BATCH_RETRY_LIMIT: 2,
    LOCK_TTL: 30000
  };

  // Sub-services
  private helpers: BroadcasterHelpers;
  private lockService: BroadcasterLockService;
  private delivery: BroadcasterDeliveryService;
  private connections: BroadcasterConnectionRegistry;
  private httpHandlers: BroadcasterHttpHandlers;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Build shared context — all collections are passed by reference
    const ctx: BroadcasterContext = {
      state: this.state,
      env: this.env,
      eventQueue: this.eventQueue,
      highPriorityQueue: this.highPriorityQueue,
      conversationRooms: this.conversationRooms,
      userConnections: this.userConnections,
      targetFilters: this.targetFilters,
      locks: this.locks,
      stats: this.distributionStats,
      config: MessageBroadcaster.CONFIG
    };

    // Initialize sub-services (order matters: helpers/locks first, then delivery, then registry/handlers)
    this.helpers = new BroadcasterHelpers(ctx);
    this.lockService = new BroadcasterLockService(ctx);
    this.delivery = new BroadcasterDeliveryService(ctx, this.helpers, this.lockService);
    this.connections = new BroadcasterConnectionRegistry(ctx, this.helpers);
    this.httpHandlers = new BroadcasterHttpHandlers(ctx, this.delivery, this.helpers);

    // Restore persisted state and start processing loops
    this.helpers.initializeFromStorage();
    this.setupProcessingLoops();
  }

  // =================== Main Request Router ===================

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      switch (pathname) {
        // Broadcast endpoints
        case '/broadcast':
          return this.httpHandlers.handleBroadcast(request);
        case '/broadcast-to-conversations':
          return this.httpHandlers.handleBroadcastToConversations(request);
        case '/broadcast-to-users':
          return this.httpHandlers.handleBroadcastToUsers(request);
        case '/broadcast-to-teams':
          return this.httpHandlers.handleBroadcastToTeams(request);
        case '/broadcast-to-teams-and-admins':
          return this.httpHandlers.handleBroadcastToTeamsAndAdmins(request);
        case '/broadcast-global':
          return this.httpHandlers.handleBroadcastGlobal(request);
        case '/batch-broadcast':
          return this.httpHandlers.handleBatchBroadcast(request);

        // Connection management
        case '/register-connection':
          return this.connections.handleRegisterConnection(request);
        case '/unregister-connection':
          return this.connections.handleUnregisterConnection(request);

        // Queue and filter management
        case '/update-filters':
          return this.httpHandlers.handleUpdateFilters(request);
        case '/queue-event':
          return this.httpHandlers.handleQueueEvent(request);
        case '/flush-queue':
          return this.httpHandlers.handleFlushQueue(request);

        // Monitoring
        case '/metrics':
          return this.httpHandlers.handleGetMetrics(request);
        case '/status':
        case '/health':
          return this.httpHandlers.handleGetStatus(request);

        // System
        case '/system-broadcast':
          return this.httpHandlers.handleSystemBroadcast(request);

        // Debug
        case '/debug-connections':
          return new Response(JSON.stringify({
            registeredUsers: Array.from(this.userConnections.keys()),
            registeredConversations: Array.from(this.conversationRooms.keys()),
            activeConnections: this.distributionStats.activeConnections,
            timestamp: Date.now()
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      log.error('❌ [MessageBroadcaster] Request handling error:', { error: error instanceof Error ? error.message : String(error) });
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // =================== Processing Loop Setup ===================

  private setupProcessingLoops(): void {
    // High priority queue processor (fast)
    setInterval(async () => {
      await this.delivery.processHighPriorityQueue();
    }, MessageBroadcaster.CONFIG.HIGH_PRIORITY_TIMEOUT);

    // Normal priority queue processor
    setInterval(async () => {
      await this.delivery.processEventQueue();
    }, MessageBroadcaster.CONFIG.PROCESSING_INTERVAL);

    // Metrics and health monitoring
    setInterval(async () => {
      await this.helpers.updateMetrics();
    }, MessageBroadcaster.CONFIG.METRICS_INTERVAL);

    // Cleanup expired locks
    setInterval(async () => {
      await this.lockService.cleanupExpiredLocks();
    }, 60000);
  }
}
