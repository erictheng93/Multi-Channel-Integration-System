// DelayedMessageProcessor Durable Object
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 處理延遲訊息的批量處理和調度

import type {
  ScheduledMessage,
  DurableObjectEvent,
  DistributedLock,
  LockAcquisitionOptions
} from '../types/websocket-types';
import type { Bindings } from '../types/bindings';

/**
 * Architecture Overview:
 *
 * DelayedMessageProcessor Durable Object manages:
 * 1. Batch processing of scheduled/delayed messages
 * 2. Efficient message scheduling and execution
 * 3. Message cancellation and recall capabilities
 * 4. Integration with existing delayed message system
 * 5. Reliable delivery with retry mechanisms
 *
 * This replaces the existing delayed message queue with a more sophisticated
 * batch processing system that can handle large volumes of scheduled messages
 */

export class DelayedMessageProcessor implements DurableObject {
  private state: DurableObjectState;
  private env: Bindings;

  // Message queues organized by execution time
  private pendingMessages = new Map<string, ScheduledMessage>();
  private processingQueue: string[] = []; // Message IDs sorted by scheduledAt
  private retryQueue = new Map<string, ScheduledMessage>();
  private cancelledMessages = new Set<string>();

  // Batch processing configuration
  private batchSize = 50;
  private processingInterval = 5000; // 5 seconds
  private retryDelays = [30000, 60000, 300000]; // 30s, 1m, 5m
  private maxRetries = 3;

  // Processing state
  private isProcessing = false;
  private lastProcessed = Date.now();
  private nextScheduledTime = 0;

  // Statistics
  private stats = {
    totalProcessed: 0,
    successfulSends: 0,
    failedSends: 0,
    cancelledMessages: 0,
    averageProcessingTime: 0,
    lastBatchSize: 0,
    queueDepth: 0
  };

  // Locks for coordination
  private locks = new Map<string, DistributedLock>();
  private readonly LOCK_TTL = 30000; // 30 seconds

  constructor(state: DurableObjectState, env: Bindings) {
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
        case '/schedule':
          return this.handleScheduleMessage(request);
        case '/cancel':
          return this.handleCancelMessage(request);
        case '/reschedule':
          return this.handleRescheduleMessage(request);
        case '/process-batch':
          return this.handleProcessBatch(request);
        case '/get-scheduled':
          return this.handleGetScheduledMessages(request);
        case '/metrics':
          return this.handleGetMetrics(request);
        case '/status':
          return this.handleGetStatus(request);
        case '/cleanup':
          return this.handleCleanup(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Request handling error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // =================== Message Scheduling ===================

  private async handleScheduleMessage(request: Request): Promise<Response> {
    try {
      const messageData = await request.json();
      const scheduledMessage = this.createScheduledMessage(messageData);

      // Validate message
      if (!this.validateScheduledMessage(scheduledMessage)) {
        return new Response(JSON.stringify({ error: 'Invalid message data' }), { status: 400 });
      }

      // Check if scheduling time is reasonable (not too far in the future)
      const maxScheduleTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      if (scheduledMessage.scheduledAt > maxScheduleTime) {
        return new Response(JSON.stringify({ error: 'Schedule time too far in future' }), { status: 400 });
      }

      // Add to pending messages
      await this.scheduleMessage(scheduledMessage);

      return new Response(JSON.stringify({
        success: true,
        messageId: scheduledMessage.id,
        scheduledAt: scheduledMessage.scheduledAt,
        queuePosition: this.processingQueue.length
      }));

    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Schedule message error:', error);
      return new Response(JSON.stringify({ error: 'Failed to schedule message' }), { status: 500 });
    }
  }

  private async scheduleMessage(message: ScheduledMessage): Promise<void> {
    const lockId = await this.acquireLock('schedule_message', { ttl: 5000 });

    try {
      // Add to pending messages
      this.pendingMessages.set(message.id, message);

      // Insert into processing queue (sorted by scheduledAt)
      this.insertIntoProcessingQueue(message.id);

      // Update next scheduled time
      this.updateNextScheduledTime();

      // Persist state
      await this.persistProcessorState();

      console.log(`⏰ [DelayedMessageProcessor] Message scheduled: ${message.id} for ${new Date(message.scheduledAt).toISOString()}`);
    } finally {
      await this.releaseLock(lockId);
    }
  }

  private insertIntoProcessingQueue(messageId: string): void {
    const message = this.pendingMessages.get(messageId);
    if (!message) return;

    // Binary search to find insertion point
    let left = 0;
    let right = this.processingQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midMessage = this.pendingMessages.get(this.processingQueue[mid]!);

      if (!midMessage || midMessage.scheduledAt > message.scheduledAt) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }

    this.processingQueue.splice(left, 0, messageId);
  }

  // =================== Message Cancellation ===================

  private async handleCancelMessage(request: Request): Promise<Response> {
    try {
      const { messageId, reason } = await request.json() as { messageId: string; reason?: string };

      if (!messageId) {
        return new Response(JSON.stringify({ error: 'Message ID required' }), { status: 400 });
      }

      const success = await this.cancelMessage(messageId, reason);

      if (success) {
        return new Response(JSON.stringify({
          success: true,
          messageId,
          cancelledAt: Date.now()
        }));
      } else {
        return new Response(JSON.stringify({
          error: 'Message not found or already processed'
        }), { status: 404 });
      }

    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Cancel message error:', error);
      return new Response(JSON.stringify({ error: 'Failed to cancel message' }), { status: 500 });
    }
  }

  private async cancelMessage(messageId: string, reason?: string): Promise<boolean> {
    const lockId = await this.acquireLock('cancel_message', { ttl: 5000 });

    try {
      const message = this.pendingMessages.get(messageId);
      if (!message || message.status !== 'pending') {
        return false;
      }

      // Mark as cancelled
      message.status = 'cancelled';
      message.metadata = { ...message.metadata, cancelReason: reason, cancelledAt: Date.now() };

      // Remove from processing queue
      const queueIndex = this.processingQueue.indexOf(messageId);
      if (queueIndex !== -1) {
        this.processingQueue.splice(queueIndex, 1);
      }

      // Add to cancelled set
      this.cancelledMessages.add(messageId);

      // Update statistics
      this.stats.cancelledMessages++;

      // Persist state
      await this.persistProcessorState();

      // Create cancellation event
      await this.createCancellationEvent(message, reason);

      console.log(`❌ [DelayedMessageProcessor] Message cancelled: ${messageId}`);
      return true;

    } finally {
      await this.releaseLock(lockId);
    }
  }

  // =================== Batch Processing ===================

  private setupProcessingLoops(): void {
    // Main processing loop
    setInterval(async () => {
      await this.processPendingMessages();
    }, this.processingInterval);

    // Retry processing loop (less frequent)
    setInterval(async () => {
      await this.processRetryQueue();
    }, this.processingInterval * 2);

    // Cleanup loop (hourly)
    setInterval(async () => {
      await this.cleanupOldMessages();
    }, 3600000); // 1 hour

    // Metrics update loop
    setInterval(async () => {
      await this.updateMetrics();
    }, 60000); // 1 minute
  }

  private async processPendingMessages(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    const lockId = await this.acquireLock('process_messages', { ttl: 30000 });

    try {
      this.isProcessing = true;
      const now = Date.now();
      const batch = this.getReadyMessages(now);

      if (batch.length === 0) {
        return;
      }

      console.log(`⚡ [DelayedMessageProcessor] Processing batch: ${batch.length} messages`);

      const results = await this.processBatch(batch);
      await this.handleBatchResults(results);

      this.stats.lastBatchSize = batch.length;
      this.lastProcessed = now;

    } finally {
      this.isProcessing = false;
      await this.releaseLock(lockId);
    }
  }

  private getReadyMessages(currentTime: number): ScheduledMessage[] {
    const readyMessages: ScheduledMessage[] = [];
    const readyIds: string[] = [];

    // Get messages that are ready to be sent
    for (let i = 0; i < this.processingQueue.length && readyMessages.length < this.batchSize; i++) {
      const messageId = this.processingQueue[i]!;
      const message = this.pendingMessages.get(messageId);

      if (!message) {
        readyIds.push(messageId!); // Mark for removal
        continue;
      }

      if (message.scheduledAt <= currentTime && message.status === 'pending') {
        readyMessages.push(message);
        readyIds.push(messageId!);
      } else if (message.scheduledAt > currentTime) {
        // Since queue is sorted, no more ready messages
        break;
      }
    }

    // Remove processed IDs from queue
    this.processingQueue = this.processingQueue.filter(id => !readyIds.includes(id));

    return readyMessages;
  }

  private async processBatch(messages: ScheduledMessage[]): Promise<Map<string, { success: boolean; error?: string }>> {
    const results = new Map<string, { success: boolean; error?: string }>();
    const startTime = Date.now();

    // Process messages in parallel (with concurrency limit)
    const concurrencyLimit = 10;
    const batches = this.chunkArray(messages, concurrencyLimit);

    for (const batch of batches) {
      const batchPromises = batch.map(async (message) => {
        try {
          const success = await this.sendMessage(message);
          return { messageId: message.id, success, error: undefined };
        } catch (error) {
          console.error(`❌ [DelayedMessageProcessor] Error sending message ${message.id}:`, error);
          return {
            messageId: message.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.set(result.value.messageId, {
            success: result.value.success,
            ...(result.value.error && { error: result.value.error })
          });
        } else {
          // This shouldn't happen with our error handling, but just in case
          console.error('❌ [DelayedMessageProcessor] Batch processing error:', result.reason);
        }
      });
    }

    const processingTime = Date.now() - startTime;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;

    return results;
  }

  private async handleBatchResults(results: Map<string, { success: boolean; error?: string }>): Promise<void> {
    for (const [messageId, result] of results) {
      const message = this.pendingMessages.get(messageId);
      if (!message) continue;

      if (result.success) {
        // Mark as sent
        message.status = 'sent';
        message.metadata = { ...message.metadata, sentAt: Date.now() };
        this.stats.successfulSends++;

        // Create success event
        await this.createMessageSentEvent(message);
      } else {
        // Handle failure
        message.retryCount++;
        this.stats.failedSends++;

        if (message.retryCount < message.maxRetries) {
          // Schedule for retry
          const retryDelay = this.retryDelays[Math.min(message.retryCount - 1, this.retryDelays.length - 1)] || 5000;
          message.scheduledAt = Date.now() + retryDelay;
          message.status = 'pending';

          this.retryQueue.set(messageId, message);
          console.log(`🔄 [DelayedMessageProcessor] Message ${messageId} scheduled for retry ${message.retryCount}/${message.maxRetries}`);
        } else {
          // Mark as failed
          message.status = 'failed';
          message.metadata = { ...message.metadata, failedAt: Date.now(), lastError: result.error };

          // Create failure event
          await this.createMessageFailedEvent(message, result.error);
        }
      }

      this.stats.totalProcessed++;
    }

    // Update next scheduled time
    this.updateNextScheduledTime();

    // Persist state
    await this.persistProcessorState();
  }

  // =================== Message Sending ===================

  private async sendMessage(message: ScheduledMessage): Promise<boolean> {
    try {
      // Mark as processing
      message.status = 'processing';

      // Get conversation and customer info
      const conversationInfo = await this.getConversationInfo(message.conversationId);
      if (!conversationInfo) {
        throw new Error('Conversation not found');
      }

      // Send via appropriate platform
      let success = false;

      if (conversationInfo.platform === 'line') {
        success = await this.sendLineMessage(message, conversationInfo);
      } else if (conversationInfo.platform === 'facebook') {
        success = await this.sendFacebookMessage(message, conversationInfo);
      } else {
        throw new Error(`Unsupported platform: ${conversationInfo.platform}`);
      }

      if (success) {
        // Store message in database
        await this.storeMessageInDatabase(message, conversationInfo);

        // Broadcast real-time event
        await this.broadcastMessageEvent(message, conversationInfo);
      }

      return success;

    } catch (error) {
      console.error(`❌ [DelayedMessageProcessor] Send message error for ${message.id}:`, error);
      throw error;
    }
  }

  private async sendLineMessage(message: ScheduledMessage, conversationInfo: any): Promise<boolean> {
    try {
      const { pushLineMessage, createTextMessage } = await import('../utils/line');

      const messages = [createTextMessage(message.content)];
      return await pushLineMessage(
        this.env.LINE_CHANNEL_ACCESS_TOKEN,
        conversationInfo.platformUserId,
        messages
      );
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] LINE message send error:', error);
      return false;
    }
  }

  private async sendFacebookMessage(_message: ScheduledMessage, _conversationInfo: any): Promise<boolean> {
    try {
      // TODO: Implement Facebook message sending
      console.log('📤 [DelayedMessageProcessor] Facebook message sending not implemented yet');
      return false;
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Facebook message send error:', error);
      return false;
    }
  }

  // =================== Database Integration ===================

  private async getConversationInfo(conversationId: string): Promise<any> {
    try {
      // Integration with existing database to get conversation and customer info
      // This would use the existing Drizzle setup
      const drizzle = (await import('drizzle-orm/d1')).drizzle;
      const { eq } = await import('drizzle-orm');
      const { conversations, customers } = await import('../db/schema');

      const db = drizzle(this.env.DB);

      const result = await db
        .select({
          id: conversations.id,
          customerId: conversations.customerId,
          platform: customers.platform,
          platformUserId: customers.platformUserId,
          customerName: customers.displayName
        })
        .from(conversations)
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, conversationId))
        .get();

      return result;
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Error getting conversation info:', error);
      return null;
    }
  }

  private async storeMessageInDatabase(message: ScheduledMessage, _conversationInfo: any): Promise<void> {
    try {
      const drizzle = (await import('drizzle-orm/d1')).drizzle;
      const { messages } = await import('../db/schema');

      const db = drizzle(this.env.DB);

      await db.insert(messages).values({
        id: crypto.randomUUID(),
        conversationId: message.conversationId,
        senderType: 'agent',
        agentSenderId: message.agentId,
        content: message.content,
        messageType: message.messageType,
        isSent: true,
        deliveryStatus: 'sent',
        sentAt: new Date().toISOString(),
        metadata: JSON.stringify({
          ...message.metadata,
          delayedMessageId: message.id,
          originallyScheduledAt: message.scheduledAt
        }),
        createdAt: new Date().toISOString()
      });

      console.log(`💾 [DelayedMessageProcessor] Message stored in database for ${message.conversationId}`);
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Error storing message in database:', error);
    }
  }

  // =================== Event Broadcasting ===================

  private async broadcastMessageEvent(message: ScheduledMessage, _conversationInfo: any): Promise<void> {
    try {
      // Send to MessageBroadcaster for real-time distribution
      const broadcasterStub = this.getBroadcasterStub();
      if (!broadcasterStub) {
        console.warn('❌ [DelayedMessageProcessor] MessageBroadcaster not available');
        return;
      }

      const event: DurableObjectEvent = {
        id: `delayed_msg_${message.id}`,
        type: 'message_sent',
        source: 'queue',
        timestamp: Date.now(),
        userId: message.agentId,
        conversationId: message.conversationId,
        data: {
          messageId: message.id,
          content: message.content,
          messageType: message.messageType,
          senderName: 'Agent',
          isDelayed: true,
          originalScheduledAt: message.scheduledAt
        },
        priority: 'normal'
      };

      await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          event,
          targets: [{
            type: 'conversation',
            targets: [message.conversationId]
          }]
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Error broadcasting message event:', error);
    }
  }

  private async createMessageSentEvent(_message: ScheduledMessage): Promise<void> {
    // Create audit log event for successful message send
    // This would integrate with the existing activity service
  }

  private async createMessageFailedEvent(_message: ScheduledMessage, _error?: string): Promise<void> {
    // Create audit log event for failed message send
    // This would integrate with the existing activity service
  }

  private async createCancellationEvent(_message: ScheduledMessage, _reason?: string): Promise<void> {
    // Create audit log event for message cancellation
    // This would integrate with the existing activity service
  }

  // =================== Helper Methods ===================

  private createScheduledMessage(data: any): ScheduledMessage {
    return {
      id: data.id || crypto.randomUUID(),
      conversationId: data.conversationId,
      agentId: data.agentId,
      content: data.content,
      messageType: data.messageType || 'text',
      scheduledAt: data.scheduledAt,
      priority: data.priority || 'normal',
      retryCount: 0,
      maxRetries: data.maxRetries || this.maxRetries,
      status: 'pending',
      metadata: data.metadata || {}
    };
  }

  private validateScheduledMessage(message: ScheduledMessage): boolean {
    return !!(
      message.id &&
      message.conversationId &&
      message.agentId &&
      message.content &&
      message.scheduledAt &&
      message.scheduledAt > Date.now()
    );
  }

  private updateNextScheduledTime(): void {
    if (this.processingQueue.length > 0) {
      const nextMessageId = this.processingQueue[0];
      if (nextMessageId) {
        const nextMessage = this.pendingMessages.get(nextMessageId);
        this.nextScheduledTime = nextMessage?.scheduledAt || 0;
      }
    } else {
      this.nextScheduledTime = 0;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private getBroadcasterStub(): DurableObjectStub | null {
    const id = this.env.MESSAGE_BROADCASTER?.idFromName('global');
    if (!id || !this.env.MESSAGE_BROADCASTER) return null;
    return this.env.MESSAGE_BROADCASTER.get(id);
  }

  // =================== State Persistence ===================

  private async persistProcessorState(): Promise<void> {
    try {
      await Promise.all([
        this.state.storage.put('pendingMessages', Array.from(this.pendingMessages.entries())),
        this.state.storage.put('processingQueue', this.processingQueue),
        this.state.storage.put('retryQueue', Array.from(this.retryQueue.entries())),
        this.state.storage.put('cancelledMessages', Array.from(this.cancelledMessages)),
        this.state.storage.put('stats', this.stats),
        this.state.storage.put('nextScheduledTime', this.nextScheduledTime)
      ]);
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Error persisting state:', error);
    }
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      // Restore pending messages
      const pendingMessages = await this.state.storage.get('pendingMessages') as [string, ScheduledMessage][];
      if (pendingMessages) {
        this.pendingMessages = new Map(pendingMessages);
      }

      // Restore processing queue
      const processingQueue = await this.state.storage.get('processingQueue') as string[];
      if (processingQueue) {
        this.processingQueue = processingQueue;
      }

      // Restore retry queue
      const retryQueue = await this.state.storage.get('retryQueue') as [string, ScheduledMessage][];
      if (retryQueue) {
        this.retryQueue = new Map(retryQueue);
      }

      // Restore cancelled messages
      const cancelledMessages = await this.state.storage.get('cancelledMessages') as string[];
      if (cancelledMessages) {
        this.cancelledMessages = new Set(cancelledMessages);
      }

      // Restore stats
      const stats = await this.state.storage.get('stats') as any;
      if (stats) {
        this.stats = { ...this.stats, ...stats };
      }

      // Restore next scheduled time
      const nextScheduledTime = await this.state.storage.get('nextScheduledTime') as number;
      if (nextScheduledTime) {
        this.nextScheduledTime = nextScheduledTime;
      }

      console.log(`📂 [DelayedMessageProcessor] State restored: ${this.pendingMessages.size} pending, ${this.processingQueue.length} in queue`);
    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] State restoration error:', error);
    }
  }

  // =================== Cleanup and Maintenance ===================

  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.size === 0) return;

    const lockId = await this.acquireLock('process_retries', { ttl: 10000 });

    try {
      const now = Date.now();
      const readyRetries: ScheduledMessage[] = [];

      for (const [_messageId, message] of this.retryQueue) {
        if (message.scheduledAt <= now) {
          readyRetries.push(message);
        }
      }

      if (readyRetries.length === 0) return;

      // Move ready retries back to processing queue
      for (const message of readyRetries) {
        this.retryQueue.delete(message.id);
        this.pendingMessages.set(message.id, message);
        this.insertIntoProcessingQueue(message.id);
      }

      console.log(`🔄 [DelayedMessageProcessor] Moved ${readyRetries.length} messages from retry queue to processing queue`);

    } finally {
      await this.releaseLock(lockId);
    }
  }

  private async cleanupOldMessages(): Promise<void> {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;

    // Clean up old completed/failed messages
    for (const [messageId, message] of this.pendingMessages) {
      if ((message.status === 'sent' || message.status === 'failed') &&
          message.scheduledAt < cutoffTime) {
        this.pendingMessages.delete(messageId);
        cleanedCount++;
      }
    }

    // Clean up old cancelled messages
    const oldCancelled = Array.from(this.cancelledMessages).slice(0, -1000); // Keep last 1000
    oldCancelled.forEach(id => this.cancelledMessages.delete(id));

    if (cleanedCount > 0) {
      await this.persistProcessorState();
      console.log(`🧹 [DelayedMessageProcessor] Cleaned up ${cleanedCount} old messages`);
    }
  }

  private async updateMetrics(): Promise<void> {
    this.stats.queueDepth = this.processingQueue.length + this.retryQueue.size;
    await this.state.storage.put('stats', this.stats);
  }

  // =================== Distributed Locking ===================

  private async acquireLock(resource: string, options: LockAcquisitionOptions = {}): Promise<string> {
    const {
      ttl = this.LOCK_TTL,
      timeout: _timeout = 5000, // Keeping for API compatibility
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
            ownerId: 'DelayedMessageProcessor',
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
        console.error(`❌ [DelayedMessageProcessor] Lock acquisition error:`, error);
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
      console.error(`❌ [DelayedMessageProcessor] Lock release error:`, error);
    }
  }

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =================== HTTP API Handlers ===================

  private async handleRescheduleMessage(request: Request): Promise<Response> {
    try {
      const data = await request.json() as { messageId: string; newScheduledAt: number };
      const { messageId, newScheduledAt } = data;

      const message = this.pendingMessages.get(messageId);
      if (!message || message.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'Message not found or not reschedulable' }), { status: 404 });
      }

      // Update scheduled time
      message.scheduledAt = newScheduledAt;

      // Re-sort processing queue
      const queueIndex = this.processingQueue.indexOf(messageId);
      if (queueIndex !== -1) {
        this.processingQueue.splice(queueIndex, 1);
        this.insertIntoProcessingQueue(messageId);
      }

      await this.persistProcessorState();

      return new Response(JSON.stringify({
        success: true,
        messageId,
        newScheduledAt
      }));

    } catch (error) {
      console.error('❌ [DelayedMessageProcessor] Reschedule message error:', error);
      return new Response(JSON.stringify({ error: 'Failed to reschedule message' }), { status: 500 });
    }
  }

  private async handleProcessBatch(_request: Request): Promise<Response> {
    await this.processPendingMessages();
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleGetScheduledMessages(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const conversationId = url.searchParams.get('conversationId');

    const messages = Array.from(this.pendingMessages.values())
      .filter(message => {
        if (agentId && message.agentId !== agentId) return false;
        if (conversationId && message.conversationId !== conversationId) return false;
        return message.status === 'pending';
      })
      .sort((a, b) => a.scheduledAt - b.scheduledAt);

    return new Response(JSON.stringify({
      success: true,
      messages,
      count: messages.length
    }));
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    const metrics = {
      ...this.stats,
      pendingMessages: this.pendingMessages.size,
      processingQueueLength: this.processingQueue.length,
      retryQueueSize: this.retryQueue.size,
      cancelledMessagesCount: this.cancelledMessages.size,
      nextScheduledTime: this.nextScheduledTime,
      isProcessing: this.isProcessing,
      lastProcessed: this.lastProcessed
    };

    return new Response(JSON.stringify(metrics));
  }

  private async handleGetStatus(_request: Request): Promise<Response> {
    const status = {
      isHealthy: this.stats.queueDepth < 1000, // Arbitrary health threshold
      isProcessing: this.isProcessing,
      queueDepth: this.stats.queueDepth,
      nextScheduledTime: this.nextScheduledTime,
      successRate: this.stats.totalProcessed > 0 ?
        (this.stats.successfulSends / this.stats.totalProcessed) * 100 : 0,
      lastProcessed: this.lastProcessed
    };

    return new Response(JSON.stringify(status));
  }

  private async handleCleanup(_request: Request): Promise<Response> {
    await this.cleanupOldMessages();
    return new Response(JSON.stringify({ success: true }));
  }
}