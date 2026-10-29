// Broadcaster Helpers
// Foundation utilities: shared context type, validation, DB queries, persistence, metrics

import type {
  DurableObjectEvent,
  WebSocketSubscription,
  DistributedLock
} from '../../types/websocket-types';
import { createContextLogger } from '../../utils/logger';
import { nowMs } from '@/utils/timestamp'

const log = createContextLogger('MessageBroadcaster');

// =================== Shared Types ===================

export interface DistributionStats {
  totalEvents: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastProcessed: number;
  eventsPerSecond: number;
  averageLatency: number;
  queueDepth: number;
  evictedEvents: number;
  activeConnections: number;
}

export interface MetricsSample {
  ts: number;
  eventsIn: number;
  eventsOut: number;
  success: number;
  failed: number;
}

export interface MetricsWindow {
  /** Seconds covered by the delta; 0 when there was no reference sample. */
  windowSeconds: number;
  eventsInPerSecond: number | null;
  eventsOutPerSecond: number | null;
  /** failed / (success + failed) deliveries inside the window; null when there is no window. */
  errorRate: number | null;
}

const METRICS_MIN_WINDOW_MS = 30_000;
const METRICS_SAMPLE_SPACING_MS = 30_000;
const METRICS_SAMPLE_RETENTION_MS = 15 * 60_000;
const METRICS_MAX_SAMPLES = 12;

export interface BroadcasterConfig {
  MAX_QUEUE_SIZE: number;
  BATCH_SIZE: number;
  HIGH_PRIORITY_BATCH_SIZE: number;
  HIGH_PRIORITY_TIMEOUT: number;
  PROCESSING_INTERVAL: number;
  METRICS_INTERVAL: number;
  DELIVERY_BATCH_SIZE: number;
  MAX_PARALLEL_BATCHES: number;
  BATCH_RETRY_LIMIT: number;
  LOCK_TTL: number;
}

export interface BroadcasterEnv {
  DB?: D1Database;
  USER_CONNECTION?: DurableObjectNamespace;
  CONVERSATION_ROOM?: DurableObjectNamespace;
}

/**
 * Shared context passed to all broadcaster sub-services by reference.
 * All collections (Maps, Arrays, stats object) are mutable and shared.
 */
export interface BroadcasterContext {
  state: DurableObjectState;
  env: BroadcasterEnv;
  eventQueue: unknown[];
  highPriorityQueue: unknown[];
  conversationRooms: Map<string, DurableObjectStub>;
  userConnections: Map<string, DurableObjectStub>;
  /** Bumped on every /register-connection for a user; lets stale-entry pruning detect a re-registration without swapping the stub. */
  userRegistrationGen: Map<string, number>;
  targetFilters: Map<string, WebSocketSubscription[]>;
  locks: Map<string, DistributedLock>;
  stats: DistributionStats;
  config: BroadcasterConfig;
}

// =================== Helpers Class ===================

/**
 * Foundation utilities for MessageBroadcaster:
 * - Event validation
 * - Database queries (team members, admin users)
 * - State persistence and restoration
 * - Metrics updates
 */
export class BroadcasterHelpers {
  private samples: MetricsSample[] = [];
  private samplesLoaded = false;

  constructor(private ctx: BroadcasterContext) {}

  validateEvent(event: DurableObjectEvent | undefined): boolean {
    return !!(event?.id && event.type && event.timestamp && event.data);
  }

  async getTeamMembers(teamId: string): Promise<string[]> {
    try {
      if (!this.ctx.env.DB) {
        log.warn(' [MessageBroadcaster] Database not available');
        return [];
      }

      // Team membership lives exclusively in agent_teams.
      const result = await this.ctx.env.DB.prepare(`
        SELECT DISTINCT a.id
        FROM agents a
        INNER JOIN agent_teams at ON a.id = at.agent_id
        WHERE at.team_id = ?
          AND a.is_active = 1
          AND a.deleted_at IS NULL
      `).bind(teamId).all<{ id: string }>();

      return (result.results || []).map((member) => member.id);
    } catch (error) {
      log.error(' [MessageBroadcaster] Error getting team members:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  async getConversationRecipients(conversationId: string): Promise<Set<string> | null> {
    if (!this.ctx.env.DB) return null;
    const result = await this.ctx.env.DB.prepare(`
      SELECT a.id
      FROM conversations c
      LEFT JOIN agents a ON a.is_active = 1 AND a.deleted_at IS NULL
        AND a.role IN ('agent', 'admin')
        AND (a.role = 'admin' OR c.assigned_team_id IS NULL OR EXISTS (
          SELECT 1 FROM agent_teams at
          WHERE at.agent_id = a.id AND at.team_id = c.assigned_team_id
        ))
      WHERE c.id = ?
    `).bind(conversationId).all<{ id: string | null }>();
    if (!result.results?.length) return null;
    return new Set(result.results.flatMap(row => row.id === null ? [] : [String(row.id)]));
  }

  /**
   * Security: Get all admin users for broadcasting
   * Admins have access to all team conversations
   */
  async getAdminUsers(): Promise<string[]> {
    try {
      if (!this.ctx.env.DB) {
        log.warn(' [MessageBroadcaster] Database not available');
        return [];
      }

      const result = await this.ctx.env.DB.prepare(`
        SELECT id FROM agents
        WHERE role = 'admin'
          AND is_active = 1
          AND deleted_at IS NULL
      `).all<{ id: string }>();

      const adminIds = (result.results || []).map((admin) => admin.id);
      log.debug('Found admin users', { count: adminIds.length });
      return adminIds;
    } catch (error) {
      log.error(' [MessageBroadcaster] Error getting admin users:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  updateAverageLatency(processingTime: number): void {
    if (this.ctx.stats.averageLatency === 0) {
      this.ctx.stats.averageLatency = processingTime;
    } else {
      // 70% weight to existing average, 30% weight to new measurement
      this.ctx.stats.averageLatency =
        (this.ctx.stats.averageLatency * 0.7) + (processingTime * 0.3);
    }
  }

  async persistQueueState(): Promise<void> {
    try {
      await this.ctx.state.storage.put('eventQueue', this.ctx.eventQueue);
      await this.ctx.state.storage.put('highPriorityQueue', this.ctx.highPriorityQueue);
      await this.ctx.state.storage.put('distributionStats', this.ctx.stats);

      // Persist connection IDs for restoration after DO restart
      const userConnectionIds = Array.from(this.ctx.userConnections.keys());
      const conversationRoomIds = Array.from(this.ctx.conversationRooms.keys());
      await this.ctx.state.storage.put('userConnectionIds', userConnectionIds);
      await this.ctx.state.storage.put('conversationRoomIds', conversationRoomIds);
    } catch (error) {
      log.error(' [MessageBroadcaster] Error persisting queue state:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Phase B4 Fix: Persist only connection IDs (lightweight operation)
   */
  async persistConnectionIds(): Promise<void> {
    try {
      const userConnectionIds = Array.from(this.ctx.userConnections.keys());
      const conversationRoomIds = Array.from(this.ctx.conversationRooms.keys());
      await this.ctx.state.storage.put('userConnectionIds', userConnectionIds);
      await this.ctx.state.storage.put('conversationRoomIds', conversationRoomIds);
    } catch (error) {
      log.error(' [MessageBroadcaster] Error persisting connection IDs:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async initializeFromStorage(): Promise<void> {
    try {
      const eventQueue = await this.ctx.state.storage.get('eventQueue') as unknown[];
      if (eventQueue) {
        this.ctx.eventQueue.length = 0;
        this.ctx.eventQueue.push(...eventQueue);
      }

      const highPriorityQueue = await this.ctx.state.storage.get('highPriorityQueue') as unknown[];
      if (highPriorityQueue) {
        this.ctx.highPriorityQueue.length = 0;
        this.ctx.highPriorityQueue.push(...highPriorityQueue);
      }

      const distributionStats = await this.ctx.state.storage.get('distributionStats') as Partial<DistributionStats> | undefined;
      if (distributionStats) {
        Object.assign(this.ctx.stats, distributionStats);
      }

      // Phase B4 Fix: Restore connection stubs from persisted IDs
      const userConnectionIds = await this.ctx.state.storage.get('userConnectionIds') as string[];
      if (userConnectionIds && Array.isArray(userConnectionIds) && this.ctx.env.USER_CONNECTION) {
        for (const userId of userConnectionIds) {
          try {
            const doId = this.ctx.env.USER_CONNECTION.idFromName(userId);
            const stub = this.ctx.env.USER_CONNECTION.get(doId);
            this.ctx.userConnections.set(userId, stub);
          } catch (error) {
            log.warn('Failed to restore user connection stub', { userId, error: error instanceof Error ? error.message : String(error) });
          }
        }
        console.log(`[MessageBroadcaster] Restored ${this.ctx.userConnections.size} user connections`);
      }

      const conversationRoomIds = await this.ctx.state.storage.get('conversationRoomIds') as string[];
      if (conversationRoomIds && Array.isArray(conversationRoomIds) && this.ctx.env.CONVERSATION_ROOM) {
        for (const conversationId of conversationRoomIds) {
          try {
            const doId = this.ctx.env.CONVERSATION_ROOM.idFromName(conversationId);
            const stub = this.ctx.env.CONVERSATION_ROOM.get(doId);
            this.ctx.conversationRooms.set(conversationId, stub);
          } catch (error) {
            log.warn('Failed to restore conversation room stub', { conversationId, error: error instanceof Error ? error.message : String(error) });
          }
        }
        console.log(`[MessageBroadcaster] Restored ${this.ctx.conversationRooms.size} conversation rooms`);
      }

      // Update activeConnections count
      this.ctx.stats.activeConnections = this.ctx.userConnections.size + this.ctx.conversationRooms.size;

      console.log(`[MessageBroadcaster] State restored: ${this.ctx.eventQueue.length} events in queue, ${this.ctx.stats.activeConnections} connections`);
    } catch (error) {
      log.error(' [MessageBroadcaster] State restoration error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Refresh derived metrics. Rates are a real delta between the current counters and the
   * newest stored sample that is at least METRICS_MIN_WINDOW_MS old. There is no timer or alarm:
   * a sample is taken only when somebody reads the metrics (the star-slash-5 cron plus ad-hoc
   * admin reads). With no usable reference sample the window is 0 and every rate is null
   * (unknown, not zero).
   */
  async updateMetrics(): Promise<MetricsWindow> {
    const now = nowMs();
    const stats = this.ctx.stats;
    const current: MetricsSample = {
      ts: now,
      eventsIn: stats.totalEvents,
      eventsOut: stats.successfulDeliveries + stats.failedDeliveries,
      success: stats.successfulDeliveries,
      failed: stats.failedDeliveries
    };

    if (!this.samplesLoaded) {
      this.samplesLoaded = true;
      try {
        const saved = await this.ctx.state.storage.get('metricsSamples') as MetricsSample[] | undefined;
        if (Array.isArray(saved)) this.samples = saved;
      } catch (error) {
        log.warn('Failed to load metrics samples', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    let reference: MetricsSample | undefined;
    for (let i = this.samples.length - 1; i >= 0; i--) {
      if (now - this.samples[i].ts >= METRICS_MIN_WINDOW_MS) {
        reference = this.samples[i];
        break;
      }
    }

    let window: MetricsWindow = {
      windowSeconds: 0,
      eventsInPerSecond: null,
      eventsOutPerSecond: null,
      errorRate: null
    };
    // A counter below the reference means the DO state was reset in between: the delta is meaningless.
    if (reference && current.eventsIn >= reference.eventsIn && current.eventsOut >= reference.eventsOut) {
      const seconds = (now - reference.ts) / 1000;
      const deliveries = (current.success - reference.success) + (current.failed - reference.failed);
      window = {
        windowSeconds: Math.round(seconds),
        eventsInPerSecond: (current.eventsIn - reference.eventsIn) / seconds,
        eventsOutPerSecond: (current.eventsOut - reference.eventsOut) / seconds,
        errorRate: deliveries > 0 ? (current.failed - reference.failed) / deliveries : 0
      };
    }

    const last = this.samples[this.samples.length - 1];
    if (!last || now - last.ts >= METRICS_SAMPLE_SPACING_MS) {
      this.samples = [...this.samples, current]
        .filter(sample => now - sample.ts <= METRICS_SAMPLE_RETENTION_MS)
        .slice(-METRICS_MAX_SAMPLES);
      try {
        await this.ctx.state.storage.put('metricsSamples', this.samples);
      } catch (error) {
        log.warn('Failed to persist metrics samples', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    stats.eventsPerSecond = window.eventsInPerSecond ?? 0;
    stats.queueDepth = this.ctx.eventQueue.length + this.ctx.highPriorityQueue.length;
    return window;
  }

  generateEventId(): string {
    return `broadcast_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
