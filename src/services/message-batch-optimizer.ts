/**
 * Message Batch Optimizer
 * 專案名稱：Multi-Channel Support MVP - Performance Optimizations
 *
 * Intelligent message batching and optimization for high-throughput scenarios
 * Reduces overhead, improves latency, and optimizes resource usage
 */

import type {
  DurableObjectEvent,
  BroadcastTarget,
  MessageBatch,
  BatchingStrategy,
  OptimizationMetrics
} from '../types/websocket-types';
import { nowMs } from '@/utils/timestamp'

// =================== Configuration ===================

interface BatchOptimizerConfig {
  maxBatchSize: number;
  maxBatchDelayMs: number;
  priorityLevels: string[];
  adaptiveBatching: boolean;
  compressionEnabled: boolean;
  deduplicationEnabled: boolean;
  maxMemoryUsageMB: number;
  metricsCollectionEnabled: boolean;
  strategySwitchThreshold: number;
}

const DEFAULT_BATCH_CONFIG: BatchOptimizerConfig = {
  maxBatchSize: 100,
  maxBatchDelayMs: 100,
  priorityLevels: ['urgent', 'high', 'normal', 'low'],
  adaptiveBatching: true,
  compressionEnabled: true,
  deduplicationEnabled: true,
  maxMemoryUsageMB: 50,
  metricsCollectionEnabled: true,
  strategySwitchThreshold: 0.8 // 80% efficiency threshold
};

// =================== Batch Strategies ===================

abstract class BaseBatchingStrategy {
  protected config: BatchOptimizerConfig;
  protected metrics: OptimizationMetrics;

  constructor(config: BatchOptimizerConfig) {
    this.config = config;
    this.metrics = {
      batchesProcessed: 0,
      averageBatchSize: 0,
      averageLatency: 0,
      throughputPerSecond: 0,
      compressionRatio: 0,
      memoryUsageMB: 0,
      errorRate: 0,
      lastUpdated: nowMs(),
      // Additional properties
      totalMessages: 0,
      batchedMessages: 0,
      deduplicationSavings: 0,
      processingLatency: 0,
      memoryUsage: 0,
      efficiency: 0
    };
  }

  abstract shouldFlushBatch(batch: MessageBatch): boolean;
  abstract optimizeBatch(messages: DurableObjectEvent[]): DurableObjectEvent[];
  abstract calculatePriority(message: DurableObjectEvent): number;

  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }
}

class TimeBasedBatchingStrategy extends BaseBatchingStrategy implements BatchingStrategy {
  name = 'time-based';
  maxBatchSize: number;
  maxDelayMs: number;
  private batchStartTime: number = 0;

  constructor(config: BatchOptimizerConfig) {
    super(config);
    this.maxBatchSize = config.maxBatchSize;
    this.maxDelayMs = config.maxBatchDelayMs;
  }

  shouldBatch(message: DurableObjectEvent): boolean {
    return message.priority !== 'urgent';
  }

  createBatch(messages: DurableObjectEvent[]): MessageBatch {
    return {
      id: `batch_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`,
      messages,
      priority: 'normal',
      createdAt: nowMs(),
      targetUsers: [],
      estimatedSize: messages.length
    };
  }

  optimize(batch: MessageBatch): MessageBatch {
    const optimizedMessages = this.optimizeBatch(batch.messages);
    return {
      ...batch,
      messages: optimizedMessages
    };
  }

  shouldFlushBatch(batch: MessageBatch): boolean {
    const now = nowMs();

    // Initialize batch start time if needed
    if (this.batchStartTime === 0 && batch.messages.length > 0) {
      this.batchStartTime = now;
    }

    // Flush if batch is full
    if (batch.messages.length >= this.config.maxBatchSize) {
      this.resetBatchTimer();
      return true;
    }

    // Flush if batch has been waiting too long
    if (now - this.batchStartTime >= this.config.maxBatchDelayMs) {
      this.resetBatchTimer();
      return true;
    }

    // Flush if urgent messages are present
    const hasUrgentMessages = batch.messages.some((msg: DurableObjectEvent) => msg.priority === 'urgent');
    if (hasUrgentMessages && batch.messages.length >= 5) {
      this.resetBatchTimer();
      return true;
    }

    return false;
  }

  private resetBatchTimer(): void {
    this.batchStartTime = 0;
  }

  optimizeBatch(messages: DurableObjectEvent[]): DurableObjectEvent[] {
    let optimized = messages;

    // Sort by priority and timestamp
    optimized = this.sortByPriority(optimized);

    // Apply deduplication if enabled
    if (this.config.deduplicationEnabled) {
      optimized = this.deduplicateMessages(optimized);
    }

    // Update metrics
    this.updateOptimizationMetrics(messages, optimized);

    return optimized;
  }

  calculatePriority(message: DurableObjectEvent): number {
    const priorityMap = {
      'urgent': 1000,
      'high': 100,
      'normal': 10,
      'low': 1
    };

    const basePriority = priorityMap[message.priority as keyof typeof priorityMap] || 10;
    const agePenalty = Math.max(0, Date.now() - message.timestamp) / 1000; // Age in seconds

    return basePriority + agePenalty;
  }

  private sortByPriority(messages: DurableObjectEvent[]): DurableObjectEvent[] {
    return messages.sort((a, b) => {
      const priorityDiff = this.calculatePriority(b) - this.calculatePriority(a);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // Secondary sort by timestamp
    });
  }

  private deduplicateMessages(messages: DurableObjectEvent[]): DurableObjectEvent[] {
    const seen = new Set<string>();
    const deduplicated: DurableObjectEvent[] = [];

    for (const message of messages) {
      const key = this.generateDeduplicationKey(message);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(message);
      }
    }

    const savingsRatio = (messages.length - deduplicated.length) / Math.max(1, messages.length);
    this.metrics.deduplicationSavings = savingsRatio;

    return deduplicated;
  }

  private generateDeduplicationKey(message: DurableObjectEvent): string {
    // Create a key for deduplication based on message content
    if (message.type === 'typing_start' || message.type === 'typing_stop') {
      return `${message.type}:${message.userId}:${message.conversationId}`;
    }

    if (message.type === 'user_joined' || message.type === 'user_left') {
      return `${message.type}:${message.userId}:${message.conversationId}`;
    }

    if (message.type === 'message_sent') {
      return `${message.type}:${message.id || 'unknown'}`;
    }

    return `${message.type}:${message.id || 'unknown'}:${message.timestamp || nowMs()}`;
  }

  private updateOptimizationMetrics(original: DurableObjectEvent[], optimized: DurableObjectEvent[]): void {
    if (this.metrics.totalMessages !== undefined) {
      this.metrics.totalMessages += original.length;
    }
    if (this.metrics.batchedMessages !== undefined) {
      this.metrics.batchedMessages += optimized.length;
    }
    if (this.metrics.totalMessages !== undefined && this.metrics.batchedMessages !== undefined) {
      this.metrics.averageBatchSize = this.metrics.batchedMessages / Math.max(1, this.metrics.totalMessages / original.length);
    }

    const compressionRatio = original.length > 0 ? optimized.length / original.length : 1;
    this.metrics.compressionRatio = (this.metrics.compressionRatio + compressionRatio) / 2;
  }
}

class AdaptiveBatchingStrategy extends TimeBasedBatchingStrategy {
  private recentLatencies: number[] = [];
  private recentBatchSizes: number[] = [];
  private currentOptimalBatchSize: number;

  constructor(config: BatchOptimizerConfig) {
    super(config);
    this.currentOptimalBatchSize = Math.floor(config.maxBatchSize / 2);
  }

  override shouldFlushBatch(batch: MessageBatch): boolean {
    // Adaptive logic: adjust based on recent performance
    this.adaptBatchingParameters();

    // Use current optimal batch size instead of configured max
    if (batch.messages.length >= this.currentOptimalBatchSize) {
      return true;
    }

    // Fall back to time-based logic
    return super.shouldFlushBatch(batch);
  }

  private adaptBatchingParameters(): void {
    if (this.recentLatencies.length < 10) return; // Need sufficient data

    const avgLatency = this.recentLatencies.reduce((sum, l) => sum + l, 0) / this.recentLatencies.length;
    const avgBatchSize = this.recentBatchSizes.reduce((sum, s) => sum + s, 0) / this.recentBatchSizes.length;

    // If latency is increasing with batch size, reduce optimal batch size
    if (avgLatency > 50 && avgBatchSize > this.currentOptimalBatchSize) {
      this.currentOptimalBatchSize = Math.max(10, this.currentOptimalBatchSize * 0.8);
    }
    // If latency is acceptable, try to increase batch size for better throughput
    else if (avgLatency < 20 && avgBatchSize === this.currentOptimalBatchSize) {
      this.currentOptimalBatchSize = Math.min(this.config.maxBatchSize, this.currentOptimalBatchSize * 1.2);
    }

    // Keep recent metrics limited
    if (this.recentLatencies.length > 20) {
      this.recentLatencies.shift();
      this.recentBatchSizes.shift();
    }
  }

  recordBatchPerformance(batchSize: number, latency: number): void {
    this.recentLatencies.push(latency);
    this.recentBatchSizes.push(batchSize);
    this.metrics.processingLatency = latency;
  }
}

// =================== Message Batch Optimizer ===================

export class MessageBatchOptimizer {
  private config: BatchOptimizerConfig;
  private strategy: BatchingStrategy;
  private activeBatches: Map<string, MessageBatch> = new Map(); // target -> batch
  private batchTimers: Map<string, NodeJS.Timeout> = new Map(); // target -> timer
  private messageQueue: Map<string, DurableObjectEvent[]> = new Map(); // priority -> messages
  private compressionCache: Map<string, any> = new Map();
  private optimizerMetrics: OptimizationMetrics;

  constructor(config: Partial<BatchOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.strategy = this.createBatchingStrategy();
    this.optimizerMetrics = {
      batchesProcessed: 0,
      averageBatchSize: 0,
      averageLatency: 0,
      throughputPerSecond: 0,
      compressionRatio: 1,
      memoryUsageMB: 0,
      errorRate: 0,
      lastUpdated: nowMs(),
      totalMessages: 0,
      batchedMessages: 0,
      deduplicationSavings: 0,
      efficiency: 0
    };
  }

  // =================== Public API ===================

  async queueMessage(
    message: DurableObjectEvent,
    targets: BroadcastTarget[]
  ): Promise<void> {
    const priority = message.priority || 'normal';

    // Add message to priority queue
    if (!this.messageQueue.has(priority)) {
      this.messageQueue.set(priority, []);
    }
    this.messageQueue.get(priority)!.push(message);

    // Process batches for each target
    for (const target of targets) {
      await this.processBatchForTarget(target, message);
    }

    // Check if we should flush any batches immediately
    await this.checkImmediateFlush();
  }

  async flushAllBatches(): Promise<MessageBatch[]> {
    const flushedBatches: MessageBatch[] = [];

    for (const [targetKey, batch] of this.activeBatches) {
      if (batch.messages.length > 0) {
        const optimizedBatch = await this.optimizeBatch(batch);
        flushedBatches.push(optimizedBatch);
        this.clearBatch(targetKey);
      }
    }

    return flushedBatches;
  }

  async flushBatchForTarget(target: BroadcastTarget): Promise<MessageBatch | null> {
    const targetKey = this.generateTargetKey(target);
    const batch = this.activeBatches.get(targetKey);

    if (!batch || batch.messages.length === 0) {
      return null;
    }

    const optimizedBatch = await this.optimizeBatch(batch);
    this.clearBatch(targetKey);

    return optimizedBatch;
  }

  getMetrics(): OptimizationMetrics {
    return {
      ...this.optimizerMetrics,
      memoryUsageMB: this.calculateMemoryUsage()
    };
  }

  // =================== Batch Processing ===================

  private async processBatchForTarget(
    target: BroadcastTarget,
    message: DurableObjectEvent
  ): Promise<void> {
    const targetKey = this.generateTargetKey(target);

    // Get or create batch for target
    let batch = this.activeBatches.get(targetKey);
    if (!batch) {
      batch = {
        id: `batch_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`,
        target,
        messages: [],
        createdAt: nowMs(),
        priority: message.priority || 'normal',
        estimatedSize: 0,
        targetUsers: [] // Required property
      };
      this.activeBatches.set(targetKey, batch);
    }

    // Add message to batch
    batch.messages.push(message);
    batch.estimatedSize += this.estimateMessageSize(message);

    // Update batch priority if message has higher priority
    if (this.getPriorityLevel(message.priority || 'normal') >
        this.getPriorityLevel(batch.priority)) {
      batch.priority = message.priority || 'normal';
    }

    // Set flush timer if not already set
    if (!this.batchTimers.has(targetKey)) {
      const timer = setTimeout(() => {
        this.flushBatchForTarget(target);
      }, this.config.maxBatchDelayMs);
      this.batchTimers.set(targetKey, timer);
    }

    // Check if batch should be flushed immediately
    const shouldFlush = batch.messages.length >= this.config.maxBatchSize ||
                       batch.messages.some(msg => msg.priority === 'urgent');
    if (shouldFlush) {
      await this.flushBatchForTarget(target);
    }
  }

  private async checkImmediateFlush(): Promise<void> {
    const urgentMessages = this.messageQueue.get('urgent') || [];

    if (urgentMessages.length > 0) {
      // Flush all batches that contain urgent messages
      for (const [, batch] of this.activeBatches) {
        const hasUrgentMessage = batch.messages.some((msg: DurableObjectEvent) => msg.priority === 'urgent');
        if (hasUrgentMessage) {
          if (batch.target) {
            await this.flushBatchForTarget(batch.target);
          }
        }
      }
    }

    // Check memory usage
    if (this.isMemoryUsageHigh()) {
      console.warn('[BatchOptimizer] High memory usage, flushing batches');
      await this.flushAllBatches();
    }
  }

  private async optimizeBatch(batch: MessageBatch): Promise<MessageBatch> {
    const startTime = performance.now();

    // Apply strategy-specific optimizations
    const optimizedBatch = this.strategy.optimize(batch);
    const optimizedMessages = optimizedBatch.messages;

    // Apply compression if enabled
    let compressedData = optimizedMessages;
    if (this.config.compressionEnabled) {
      compressedData = await this.compressMessages(optimizedMessages);
    }

    const finalBatch: MessageBatch = {
      ...batch,
      messages: compressedData,
      optimizedAt: nowMs(),
      compressionRatio: optimizedMessages.length / batch.messages.length,
      // originalMessageCount removed - not in MessageBatch interface
    };

    // Record performance metrics
    const processingTime = performance.now() - startTime;
    if (this.strategy instanceof AdaptiveBatchingStrategy) {
      this.strategy.recordBatchPerformance(batch.messages.length, processingTime);
    }

    return finalBatch;
  }

  private async compressMessages(messages: DurableObjectEvent[]): Promise<DurableObjectEvent[]> {
    // Simple compression: group similar message types
    const grouped = new Map<string, DurableObjectEvent[]>();

    for (const message of messages) {
      const groupKey = this.getCompressionGroupKey(message);
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(message);
    }

    const compressed: DurableObjectEvent[] = [];

    for (const [, groupMessages] of grouped) {
      if (groupMessages.length === 1) {
        const firstMessage = groupMessages[0];
        if (firstMessage) compressed.push(firstMessage);
      } else {
        // Create a compressed batch message
        const batchMessage: DurableObjectEvent = {
          id: `batch_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`,
          type: 'batch_message',
          source: 'batch_optimizer',
          timestamp: nowMs(),
          data: {
            messageType: groupMessages[0]?.type,
            batchSize: groupMessages.length,
            messages: groupMessages
          },
          priority: this.getHighestPriority(groupMessages.map(m => m.priority as 'low' | 'normal' | 'high' | 'urgent' || 'normal'))
        };

        compressed.push(batchMessage);
      }
    }

    return compressed;
  }

  // =================== Utility Methods ===================

  private createBatchingStrategy(): BatchingStrategy {
    if (this.config.adaptiveBatching) {
      return new AdaptiveBatchingStrategy(this.config) as BatchingStrategy;
    } else {
      return new TimeBasedBatchingStrategy(this.config) as BatchingStrategy;
    }
  }

  private generateTargetKey(target: BroadcastTarget): string {
    const targetIds = Array.isArray(target.targets) ? target.targets.join(',') : target.targets;
    return `${target.type}:${targetIds}`;
  }

  private estimateMessageSize(message: DurableObjectEvent): number {
    // Rough estimation of message size in bytes
    const serialized = JSON.stringify(message);
    return new Blob([serialized]).size;
  }

  private getPriorityLevel(priority: string): number {
    const index = this.config.priorityLevels.indexOf(priority);
    return index >= 0 ? this.config.priorityLevels.length - index : 0;
  }

  private getCompressionGroupKey(message: DurableObjectEvent): string {
    // Group messages by type and target for compression
    return `${message.type}:${message.conversationId || 'global'}`;
  }

  private getHighestPriority(priorities: ('low' | 'normal' | 'high' | 'urgent')[]): 'low' | 'normal' | 'high' | 'urgent' {
    let highest: 'low' | 'normal' | 'high' | 'urgent' = 'low';
    let highestLevel = 0;

    for (const priority of priorities) {
      const level = this.getPriorityLevel(priority);
      if (level > highestLevel) {
        highest = priority;
        highestLevel = level;
      }
    }

    return highest;
  }

  private clearBatch(targetKey: string): void {
    const timer = this.batchTimers.get(targetKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(targetKey);
    }
    this.activeBatches.delete(targetKey);
  }

  private isMemoryUsageHigh(): boolean {
    const memoryUsage = this.calculateMemoryUsage();
    return memoryUsage > this.config.maxMemoryUsageMB;
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;

    // Calculate size of active batches
    for (const batch of this.activeBatches.values()) {
      totalSize += batch.estimatedSize;
    }

    // Calculate size of message queue
    for (const messages of this.messageQueue.values()) {
      for (const message of messages) {
        totalSize += this.estimateMessageSize(message);
      }
    }

    return totalSize / (1024 * 1024); // Convert to MB
  }

  // private calculateCacheHitRate(): number {
  // // This would be implemented with actual cache statistics
  // return 0.85; // Placeholder
  // }

  // =================== Configuration Management ===================

  updateConfig(newConfig: Partial<BatchOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate strategy if adaptive batching setting changed
    if (newConfig.adaptiveBatching !== undefined) {
      this.strategy = this.createBatchingStrategy();
    }
  }

  getConfig(): BatchOptimizerConfig {
    return { ...this.config };
  }

  // =================== Cleanup ===================

  shutdown(): void {
    console.log('[BatchOptimizer] Shutting down message batch optimizer');

    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all data structures
    this.activeBatches.clear();
    this.batchTimers.clear();
    this.messageQueue.clear();
    this.compressionCache.clear();
  }
}

// =================== Singleton Instance ===================

let globalBatchOptimizer: MessageBatchOptimizer | null = null;

export function getMessageBatchOptimizer(config?: Partial<BatchOptimizerConfig>): MessageBatchOptimizer {
  if (!globalBatchOptimizer) {
    globalBatchOptimizer = new MessageBatchOptimizer(config);
  }
  return globalBatchOptimizer;
}