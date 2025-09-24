// MessageBroadcaster Durable Object
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 處理全域事件分發和廣播邏輯

import type {
  DurableObjectEvent,
  BroadcastTarget,
  WebSocketSubscription,
  DistributedLock,
  LockAcquisitionOptions
} from '../types/websocket-types';

/**
 * Architecture Overview:
 *
 * MessageBroadcaster Durable Object manages:
 * 1. Global event distribution across all conversation rooms and user connections
 * 2. Intelligent message routing based on subscriptions and permissions
 * 3. Event batching and prioritization for efficiency
 * 4. Cross-room communication and coordination
 * 5. System-wide notifications and broadcasts
 *
 * This is the central hub for all real-time communication, ensuring
 * efficient delivery of events to the right destinations
 */

export class MessageBroadcaster implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  // Event queues and processing
  private eventQueue: DurableObjectEvent[] = [];
  // private _processingQueue: DurableObjectEvent[] = []; // Reserved for future batch optimization
  private highPriorityQueue: DurableObjectEvent[] = [];
  // private batchedEvents: Map<string, DurableObjectEvent[]> = new Map(); // Reserved for future optimization

  // Connection tracking
  private activeConnections = 0;
  private conversationRooms = new Map<string, DurableObjectStub>(); // conversationId -> stub
  private userConnections = new Map<string, DurableObjectStub>(); // userId -> stub
  private targetFilters = new Map<string, WebSocketSubscription[]>(); // target -> subscriptions

  // Statistics and metrics
  private distributionStats = {
    totalEvents: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    lastProcessed: Date.now(),
    eventsPerSecond: 0,
    averageLatency: 0,
    queueDepth: 0
  };

  // Configuration
  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly BATCH_SIZE = 100;
  // private readonly BATCH_TIMEOUT = 1000; // Reserved for future batch processing
  private readonly HIGH_PRIORITY_BATCH_SIZE = 10;
  private readonly HIGH_PRIORITY_TIMEOUT = 100; // 100ms
  private readonly PROCESSING_INTERVAL = 500; // 500ms
  private readonly METRICS_INTERVAL = 10000; // 10 seconds

  // Locks for coordination
  private locks = new Map<string, DistributedLock>();
  private readonly LOCK_TTL = 30000; // 30 seconds

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Initialize from storage
    this.initializeFromStorage();

    // Set up processing loops
    this.setupProcessingLoops();
  }

  // =================== Main Request Handler ===================

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      switch (pathname) {
        case '/broadcast':
          return this.handleBroadcast(request);
        case '/register-connection':
          return this.handleRegisterConnection(request);
        case '/unregister-connection':
          return this.handleUnregisterConnection(request);
        case '/update-filters':
          return this.handleUpdateFilters(request);
        case '/queue-event':
          return this.handleQueueEvent(request);
        case '/flush-queue':
          return this.handleFlushQueue(request);
        case '/metrics':
          return this.handleGetMetrics(request);
        case '/status':
          return this.handleGetStatus(request);
        case '/system-broadcast':
          return this.handleSystemBroadcast(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [MessageBroadcaster] Request handling error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // =================== Event Broadcasting ===================

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const { event, targets, options } = await request.json() as { event: DurableObjectEvent; targets: BroadcastTarget[]; options?: any };
      const broadcastEvent = event as DurableObjectEvent;
      const broadcastTargets = targets as BroadcastTarget[];

      // Validate event
      if (!this.validateEvent(broadcastEvent)) {
        return new Response(JSON.stringify({ error: 'Invalid event format' }), { status: 400 });
      }

      // Add to appropriate queue based on priority
      await this.queueEvent(broadcastEvent, broadcastTargets, options);

      return new Response(JSON.stringify({
        success: true,
        eventId: broadcastEvent.id,
        queuedAt: Date.now(),
        queueDepth: this.eventQueue.length
      }));

    } catch (error) {
      console.error('❌ [MessageBroadcaster] Broadcast error:', error);
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  private async queueEvent(event: DurableObjectEvent, targets: BroadcastTarget[], options: any = {}): Promise<void> {
    // Add metadata for processing
    const enrichedEvent = {
      ...event,
      targets,
      options,
      queuedAt: Date.now(),
      retryCount: 0
    };

    // Route to appropriate queue based on priority
    if (event.priority === 'urgent' || event.priority === 'high') {
      this.highPriorityQueue.push(enrichedEvent);
    } else {
      this.eventQueue.push(enrichedEvent);
    }

    // Prevent queue overflow
    if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
      // Remove oldest low priority events
      const removedEvents = this.eventQueue.splice(0, this.BATCH_SIZE);
      console.warn(`🚫 [MessageBroadcaster] Queue overflow, removed ${removedEvents.length} events`);
    }

    // Update metrics
    this.distributionStats.totalEvents++;
    this.distributionStats.queueDepth = this.eventQueue.length + this.highPriorityQueue.length;

    // Persist queue state
    await this.persistQueueState();

    console.log(`📋 [MessageBroadcaster] Event queued: ${event.id} (Priority: ${event.priority})`);
  }

  // =================== Event Processing ===================

  private setupProcessingLoops(): void {
    // High priority queue processor (fast)
    setInterval(async () => {
      await this.processHighPriorityQueue();
    }, this.HIGH_PRIORITY_TIMEOUT);

    // Normal priority queue processor
    setInterval(async () => {
      await this.processEventQueue();
    }, this.PROCESSING_INTERVAL);

    // Metrics and health monitoring
    setInterval(async () => {
      await this.updateMetrics();
    }, this.METRICS_INTERVAL);

    // Cleanup expired locks
    setInterval(async () => {
      await this.cleanupExpiredLocks();
    }, 60000); // 1 minute
  }

  private async processHighPriorityQueue(): Promise<void> {
    if (this.highPriorityQueue.length === 0) return;

    const lockId = await this.acquireLock('high_priority_processing', { ttl: 5000 });

    try {
      const batch = this.highPriorityQueue.splice(0, this.HIGH_PRIORITY_BATCH_SIZE);
      await this.processBatch(batch, 'high_priority');
    } finally {
      await this.releaseLock(lockId);
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const lockId = await this.acquireLock('normal_processing', { ttl: 10000 });

    try {
      const batch = this.eventQueue.splice(0, this.BATCH_SIZE);
      await this.processBatch(batch, 'normal');
    } finally {
      await this.releaseLock(lockId);
    }
  }

  private async processBatch(events: any[], batchType: string): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    console.log(`⚡ [MessageBroadcaster] Processing ${batchType} batch: ${events.length} events`);

    // Group events by target for efficient delivery
    const targetGroups = this.groupEventsByTarget(events);

    // Process each target group
    const processingPromises = Array.from(targetGroups.entries()).map(async ([target, targetEvents]) => {
      try {
        const deliveryCount = await this.deliverToTarget(target, targetEvents);
        successCount += deliveryCount;
      } catch (error) {
        console.error(`❌ [MessageBroadcaster] Failed to deliver to target ${target}:`, error);
        failureCount += targetEvents.length;

        // Retry mechanism for failed events
        await this.retryFailedEvents(targetEvents);
      }
    });

    await Promise.allSettled(processingPromises);

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.distributionStats.successfulDeliveries += successCount;
    this.distributionStats.failedDeliveries += failureCount;
    this.distributionStats.lastProcessed = Date.now();
    this.distributionStats.averageLatency =
      (this.distributionStats.averageLatency + processingTime) / 2;

    console.log(`✅ [MessageBroadcaster] Batch processed: ${successCount} success, ${failureCount} failed, ${processingTime}ms`);
  }

  private groupEventsByTarget(events: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const event of events) {
      const targets = event.targets as BroadcastTarget[];

      for (const target of targets) {
        if (target.type === 'conversation') {
          for (const conversationId of target.targets) {
            const key = `conversation:${conversationId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'user') {
          for (const userId of target.targets) {
            const key = `user:${userId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'team') {
          for (const teamId of target.targets) {
            const key = `team:${teamId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'global') {
          const key = 'global:broadcast';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(event);
        }
      }
    }

    return groups;
  }

  private async deliverToTarget(target: string, events: any[]): Promise<number> {
    const [targetType, targetId] = target.split(':');
    let deliveredCount = 0;

    if (!targetId && targetType !== 'global') {
      console.warn(`⚠️ [MessageBroadcaster] Invalid target format: ${target}`);
      return 0;
    }

    switch (targetType) {
      case 'conversation':
        deliveredCount = await this.deliverToConversation(targetId!, events);
        break;
      case 'user':
        deliveredCount = await this.deliverToUser(targetId!, events);
        break;
      case 'team':
        deliveredCount = await this.deliverToTeam(targetId!, events);
        break;
      case 'global':
        deliveredCount = await this.deliverGlobalBroadcast(events);
        break;
      default:
        console.warn(`⚠️ [MessageBroadcaster] Unknown target type: ${targetType}`);
    }

    return deliveredCount;
  }

  // =================== Target-Specific Delivery ===================

  private async deliverToConversation(conversationId: string, events: any[]): Promise<number> {
    try {
      let roomStub = this.conversationRooms.get(conversationId);

      if (!roomStub) {
        const id = this.env.CONVERSATION_ROOM.idFromName(conversationId);
        roomStub = this.env.CONVERSATION_ROOM.get(id);
        if (roomStub) {
          this.conversationRooms.set(conversationId, roomStub);
        }
      }

      if (!roomStub) {
        throw new Error(`Failed to get conversation room stub for ${conversationId}`);
      }

      // Send batch of events to conversation room
      const response = await roomStub.fetch(new Request('https://conversation-room/batch-events', {
        method: 'POST',
        body: JSON.stringify({ events }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as { deliveredCount?: number };
        return result.deliveredCount || events.length;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ [MessageBroadcaster] Conversation delivery error (${conversationId}):`, error);
      throw error;
    }
  }

  private async deliverToUser(userId: string, events: any[]): Promise<number> {
    try {
      let userStub = this.userConnections.get(userId);

      if (!userStub) {
        const id = this.env.USER_CONNECTION.idFromName(userId);
        userStub = this.env.USER_CONNECTION.get(id);
        if (userStub) {
          this.userConnections.set(userId, userStub);
        }
      }

      if (!userStub) {
        throw new Error(`Failed to get user connection stub for ${userId}`);
      }

      // Send batch of events to user connection
      const response = await userStub.fetch(new Request('https://user-connection/batch-events', {
        method: 'POST',
        body: JSON.stringify({ events }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as { deliveredCount?: number };
        return result.deliveredCount || events.length;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ [MessageBroadcaster] User delivery error (${userId}):`, error);
      throw error;
    }
  }

  private async deliverToTeam(teamId: string, events: any[]): Promise<number> {
    try {
      // Get team members from database
      const teamMembers = await this.getTeamMembers(teamId);
      let totalDelivered = 0;

      // Deliver to each team member
      const deliveryPromises = teamMembers.map(async (userId: string) => {
        try {
          const delivered = await this.deliverToUser(userId, events);
          return delivered;
        } catch (error) {
          console.error(`❌ [MessageBroadcaster] Team member delivery error (${userId}):`, error);
          return 0;
        }
      });

      const results = await Promise.allSettled(deliveryPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          totalDelivered += result.value;
        }
      });

      return totalDelivered;
    } catch (error) {
      console.error(`❌ [MessageBroadcaster] Team delivery error (${teamId}):`, error);
      throw error;
    }
  }

  private async deliverGlobalBroadcast(events: any[]): Promise<number> {
    try {
      let totalDelivered = 0;

      // Broadcast to all active conversation rooms
      const conversationPromises = Array.from(this.conversationRooms.entries()).map(async ([conversationId, _stub]) => {
        try {
          return await this.deliverToConversation(conversationId, events);
        } catch (error) {
          console.error(`❌ [MessageBroadcaster] Global conversation delivery error (${conversationId}):`, error);
          return 0;
        }
      });

      // Broadcast to all active user connections
      const userPromises = Array.from(this.userConnections.entries()).map(async ([userId, _stub]) => {
        try {
          return await this.deliverToUser(userId, events);
        } catch (error) {
          console.error(`❌ [MessageBroadcaster] Global user delivery error (${userId}):`, error);
          return 0;
        }
      });

      const allResults = await Promise.allSettled([...conversationPromises, ...userPromises]);
      allResults.forEach(result => {
        if (result.status === 'fulfilled') {
          totalDelivered += result.value;
        }
      });

      return totalDelivered;
    } catch (error) {
      console.error(`❌ [MessageBroadcaster] Global broadcast error:`, error);
      throw error;
    }
  }

  // =================== Connection Management ===================

  private async handleRegisterConnection(request: Request): Promise<Response> {
    try {
      const { type, id } = await request.json() as { type: string; id: string };

      if (type === 'conversation') {
        // Register conversation room
        if (!this.conversationRooms.has(id)) {
          const doId = this.env.CONVERSATION_ROOM.idFromName(id);
          const stub = this.env.CONVERSATION_ROOM.get(doId);
          this.conversationRooms.set(id, stub);
        }
      } else if (type === 'user') {
        // Register user connection
        if (!this.userConnections.has(id)) {
          const doId = this.env.USER_CONNECTION.idFromName(id);
          const stub = this.env.USER_CONNECTION.get(doId);
          this.userConnections.set(id, stub);
        }
      }

      this.activeConnections++;

      console.log(`📝 [MessageBroadcaster] Registered ${type} connection: ${id}`);

      return new Response(JSON.stringify({
        success: true,
        activeConnections: this.activeConnections
      }));
    } catch (error) {
      console.error('❌ [MessageBroadcaster] Connection registration error:', error);
      return new Response(JSON.stringify({ error: 'Registration failed' }), { status: 500 });
    }
  }

  private async handleUnregisterConnection(request: Request): Promise<Response> {
    try {
      const { type, id } = await request.json() as { type: string; id: string };

      if (type === 'conversation') {
        this.conversationRooms.delete(id);
      } else if (type === 'user') {
        this.userConnections.delete(id);
      }

      this.activeConnections = Math.max(0, this.activeConnections - 1);

      console.log(`📝 [MessageBroadcaster] Unregistered ${type} connection: ${id}`);

      return new Response(JSON.stringify({
        success: true,
        activeConnections: this.activeConnections
      }));
    } catch (error) {
      console.error('❌ [MessageBroadcaster] Connection unregistration error:', error);
      return new Response(JSON.stringify({ error: 'Unregistration failed' }), { status: 500 });
    }
  }

  // =================== Helper Methods ===================

  private validateEvent(event: DurableObjectEvent): boolean {
    return !!(event.id && event.type && event.timestamp && event.data);
  }

  private async retryFailedEvents(events: any[]): Promise<void> {
    // Implement retry logic for failed events
    const retryableEvents = events.filter(event =>
      (event.retryCount || 0) < 3 &&
      event.priority !== 'low'
    );

    for (const event of retryableEvents) {
      event.retryCount = (event.retryCount || 0) + 1;
      event.retryAt = Date.now() + (event.retryCount * 1000); // Exponential backoff

      // Re-queue for retry
      this.eventQueue.push(event);
    }

    if (retryableEvents.length > 0) {
      console.log(`🔄 [MessageBroadcaster] Queued ${retryableEvents.length} events for retry`);
    }
  }

  private async getTeamMembers(_teamId: string): Promise<string[]> {
    // Integration with existing database to get team members
    // This would query the agents table for team members
    try {
      // Placeholder - would integrate with existing database service
      return []; // Return array of user IDs
    } catch (error) {
      console.error('❌ [MessageBroadcaster] Error getting team members:', error);
      return [];
    }
  }

  private async persistQueueState(): Promise<void> {
    try {
      await this.state.storage.put('eventQueue', this.eventQueue);
      await this.state.storage.put('highPriorityQueue', this.highPriorityQueue);
      await this.state.storage.put('distributionStats', this.distributionStats);
    } catch (error) {
      console.error('❌ [MessageBroadcaster] Error persisting queue state:', error);
    }
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      const eventQueue = await this.state.storage.get('eventQueue') as any[];
      if (eventQueue) this.eventQueue = eventQueue;

      const highPriorityQueue = await this.state.storage.get('highPriorityQueue') as any[];
      if (highPriorityQueue) this.highPriorityQueue = highPriorityQueue;

      const distributionStats = await this.state.storage.get('distributionStats') as any;
      if (distributionStats) this.distributionStats = { ...this.distributionStats, ...distributionStats };

      console.log(`📂 [MessageBroadcaster] State restored: ${this.eventQueue.length} events in queue`);
    } catch (error) {
      console.error('❌ [MessageBroadcaster] State restoration error:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.distributionStats.lastProcessed;

    if (timeSinceLastUpdate > 0) {
      this.distributionStats.eventsPerSecond =
        this.distributionStats.totalEvents / (timeSinceLastUpdate / 1000);
    }

    this.distributionStats.queueDepth =
      this.eventQueue.length + this.highPriorityQueue.length;

    await this.state.storage.put('distributionStats', this.distributionStats);
  }

  // =================== Distributed Locking ===================

  private async acquireLock(resource: string, options: LockAcquisitionOptions = {}): Promise<string> {
    const {
      ttl = this.LOCK_TTL,
      timeout: _timeout = 5000, // Reserved for future timeout implementation
      retryInterval = 100,
      maxRetries = 50
    } = options;

    const lockId = this.generateLockId();
    const expiresAt = Date.now() + ttl;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const existingLock = await this.state.storage.get(`lock:${resource}`);

        if (!existingLock || (existingLock as DistributedLock).expiresAt < Date.now()) {
          const lock: DistributedLock = {
            lockId,
            resource,
            ownerId: 'MessageBroadcaster',
            acquiredAt: Date.now(),
            expiresAt,
            isActive: true
          };

          await this.state.storage.put(`lock:${resource}`, lock);
          this.locks.set(lockId, lock);

          return lockId;
        }

        await this.sleep(retryInterval);
      } catch (error) {
        console.error(`❌ [MessageBroadcaster] Lock acquisition error:`, error);
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock for ${resource}`);
  }

  private async releaseLock(lockId: string): Promise<void> {
    try {
      const lock = this.locks.get(lockId);
      if (!lock) return;

      await this.state.storage.delete(`lock:${lock.resource}`);
      this.locks.delete(lockId);
    } catch (error) {
      console.error(`❌ [MessageBroadcaster] Lock release error:`, error);
    }
  }

  private async cleanupExpiredLocks(): Promise<void> {
    const now = Date.now();
    const expiredLocks = Array.from(this.locks.entries())
      .filter(([_, lock]) => lock.expiresAt < now);

    for (const [lockId, lock] of expiredLocks) {
      await this.state.storage.delete(`lock:${lock.resource}`);
      this.locks.delete(lockId);
    }

    if (expiredLocks.length > 0) {
      console.log(`🧹 [MessageBroadcaster] Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =================== HTTP API Handlers ===================

  private async handleQueueEvent(request: Request): Promise<Response> {
    return this.handleBroadcast(request);
  }

  private async handleFlushQueue(request: Request): Promise<Response> {
    const { priority } = await request.json() as { priority?: string };

    if (priority === 'high') {
      await this.processHighPriorityQueue();
    } else {
      await this.processEventQueue();
    }

    return new Response(JSON.stringify({
      success: true,
      remainingEvents: this.eventQueue.length + this.highPriorityQueue.length
    }));
  }

  private async handleUpdateFilters(request: Request): Promise<Response> {
    const { target, subscriptions } = await request.json() as { target: string; subscriptions: any };
    this.targetFilters.set(target, subscriptions);

    return new Response(JSON.stringify({ success: true }));
  }

  private async handleSystemBroadcast(request: Request): Promise<Response> {
    const { message, priority = 'normal' } = await request.json() as { message: string; priority?: 'low' | 'high' | 'urgent' | 'normal' };

    const systemEvent: DurableObjectEvent = {
      id: this.generateEventId(),
      type: 'system_notification',
      source: 'system',
      timestamp: Date.now(),
      data: message,
      priority,
      deliveryOptions: {
        broadcast: true,
        targets: [{ type: 'global', targets: ['all'] }]
      }
    };

    await this.queueEvent(systemEvent, [{ type: 'global', targets: ['all'] }]);

    return new Response(JSON.stringify({
      success: true,
      eventId: systemEvent.id
    }));
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    const metrics = {
      ...this.distributionStats,
      activeConnections: this.activeConnections,
      conversationRooms: this.conversationRooms.size,
      userConnections: this.userConnections.size,
      eventQueueDepth: this.eventQueue.length,
      highPriorityQueueDepth: this.highPriorityQueue.length,
      activeLocks: this.locks.size,
      uptime: Date.now() - (this.distributionStats.lastProcessed - 3600000)
    };

    return new Response(JSON.stringify(metrics));
  }

  private async handleGetStatus(_request: Request): Promise<Response> {
    const status = {
      isHealthy: this.eventQueue.length < this.MAX_QUEUE_SIZE * 0.8,
      queueDepth: this.distributionStats.queueDepth,
      processingRate: this.distributionStats.eventsPerSecond,
      lastProcessed: this.distributionStats.lastProcessed,
      activeConnections: this.activeConnections
    };

    return new Response(JSON.stringify(status));
  }

  private generateEventId(): string {
    return `broadcast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}