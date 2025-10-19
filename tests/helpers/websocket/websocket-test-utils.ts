// WebSocket Test Utilities
// Provides test data factories, assertions, and utilities for WebSocket testing

import type { RealtimeEvent, QueueMessage } from '@backend/types';
import type { WebSocketMessage, WebSocketConnection } from '@backend/types/websocket-types';

/**
 * Test Data Factory - Generate test data for WebSocket tests
 */
export class TestDataFactory {
  /**
   * Create a test RealtimeEvent
   */
  static createEvent(overrides?: Partial<RealtimeEvent>): RealtimeEvent {
    return {
      id: `test_event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'message',
      timestamp: new Date().toISOString(),
      source: 'test',
      data: {
        messageId: 'test_message_123',
        content: 'Test message content',
        senderId: 'test_user_1',
        conversationId: 'test_conversation_1'
      },
      ...overrides
    } as RealtimeEvent;
  }

  /**
   * Create a test QueueMessage
   */
  static createQueueMessage(overrides?: Partial<QueueMessage>): QueueMessage {
    const event = this.createEvent(overrides?.event);

    return {
      event,
      targets: {
        conversationId: 'test_conversation_1',
        userIds: [1, 2, 3],
        broadcast: false
      },
      priority: 'normal',
      retryCount: 0,
      maxRetries: 3,
      ...overrides
    };
  }

  /**
   * Create a test WebSocketMessage
   */
  static createWebSocketMessage(overrides?: Partial<WebSocketMessage>): WebSocketMessage {
    return {
      type: 'event',
      event: this.createEvent(),
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a test WebSocketConnection
   */
  static createWebSocketConnection(overrides?: Partial<WebSocketConnection>): WebSocketConnection {
    return {
      id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: 'test_user_1',
      conversationId: 'test_conversation_1',
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metadata: {
        userAgent: 'Test User Agent',
        ipAddress: '127.0.0.1'
      },
      ...overrides
    };
  }

  /**
   * Alias for createWebSocketConnection (backward compatibility)
   */
  static createConnection(overrides?: any): any {
    const baseConnection = {
      connectionId: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: 'test_user_1',
      conversationId: 'test_conversation_1',
      role: 'agent',
      websocket: null,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      metadata: {
        userAgent: 'Test User Agent',
        ipAddress: '127.0.0.1'
      },
      ...overrides
    };
    return baseConnection;
  }

  /**
   * Create a test message
   */
  static createMessage(overrides?: any): any {
    return {
      type: 'event',
      data: {
        content: 'Test message',
        messageType: 'text',
        senderId: 'test_user_1'
      },
      timestamp: Date.now(),
      ...overrides
    };
  }

  /**
   * Create a typing event
   */
  static createTypingEvent(userId: string, conversationId: string, isTyping: boolean): any {
    return {
      type: isTyping ? 'typing_start' : 'typing_stop',
      userId,
      conversationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create multiple test events
   */
  static createEvents(count: number, baseOverrides?: Partial<RealtimeEvent>): RealtimeEvent[] {
    return Array.from({ length: count }, (_, i) =>
      this.createEvent({
        ...baseOverrides,
        id: `test_event_${i}_${Date.now()}`,
        data: {
          ...baseOverrides?.data,
          messageId: `test_message_${i}`
        }
      })
    );
  }

  /**
   * Create a batch of test queue messages
   */
  static createQueueMessageBatch(count: number): QueueMessage[] {
    return Array.from({ length: count }, (_, i) =>
      this.createQueueMessage({
        event: this.createEvent({
          id: `batch_event_${i}`,
          data: { messageId: `batch_message_${i}` }
        })
      })
    );
  }

  /**
   * Create test conversation data
   */
  static createConversation(overrides?: any) {
    return {
      id: 'test_conversation_1',
      title: 'Test Conversation',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create test user data
   */
  static createUser(overrides?: any) {
    return {
      id: 1,
      username: 'test_user',
      displayName: 'Test User',
      email: 'test@example.com',
      role: 'agent',
      ...overrides
    };
  }

  /**
   * Create delayed message data
   */
  static createDelayedMessage(overrides?: any) {
    return {
      id: `delayed_${Date.now()}`,
      conversationId: 'test_conversation_1',
      content: 'Test delayed message',
      delaySeconds: 5,
      scheduledAt: new Date().toISOString(),
      status: 'pending',
      ...overrides
    };
  }
}

/**
 * Test Assertions - Helper methods for asserting WebSocket test conditions
 */
export class TestAssertions {
  /**
   * Assert that an event has required fields
   */
  static assertValidEvent(event: any): void {
    if (!event) {
      throw new Error('Event is null or undefined');
    }
    if (!event.id) {
      throw new Error('Event missing id field');
    }
    if (!event.type) {
      throw new Error('Event missing type field');
    }
    if (!event.timestamp) {
      throw new Error('Event missing timestamp field');
    }
    if (!event.source) {
      throw new Error('Event missing source field');
    }
    if (!event.data) {
      throw new Error('Event missing data field');
    }
  }

  /**
   * Assert that a queue message has required fields
   */
  static assertValidQueueMessage(message: any): void {
    if (!message) {
      throw new Error('Queue message is null or undefined');
    }
    if (!message.event) {
      throw new Error('Queue message missing event field');
    }
    if (!message.targets) {
      throw new Error('Queue message missing targets field');
    }
    if (!message.priority) {
      throw new Error('Queue message missing priority field');
    }

    this.assertValidEvent(message.event);
  }

  /**
   * Assert that a WebSocket message has required fields
   */
  static assertValidWebSocketMessage(message: any): void {
    if (!message) {
      throw new Error('WebSocket message is null or undefined');
    }
    if (!message.type) {
      throw new Error('WebSocket message missing type field');
    }
    if (!message.timestamp) {
      throw new Error('WebSocket message missing timestamp field');
    }
  }

  /**
   * Assert event matches expected values
   */
  static assertEventMatches(actual: RealtimeEvent, expected: Partial<RealtimeEvent>): void {
    this.assertValidEvent(actual);

    if (expected.id && actual.id !== expected.id) {
      throw new Error(`Event id mismatch: expected ${expected.id}, got ${actual.id}`);
    }
    if (expected.type && actual.type !== expected.type) {
      throw new Error(`Event type mismatch: expected ${expected.type}, got ${actual.type}`);
    }
    if (expected.source && actual.source !== expected.source) {
      throw new Error(`Event source mismatch: expected ${expected.source}, got ${actual.source}`);
    }
  }

  /**
   * Assert that an array contains events
   */
  static assertContainsEvents(events: any[], minCount: number = 1): void {
    if (!Array.isArray(events)) {
      throw new Error('Events is not an array');
    }
    if (events.length < minCount) {
      throw new Error(`Expected at least ${minCount} events, got ${events.length}`);
    }

    events.forEach((event, index) => {
      try {
        this.assertValidEvent(event);
      } catch (error) {
        throw new Error(`Invalid event at index ${index}: ${error}`);
      }
    });
  }

  /**
   * Assert performance metrics
   */
  static assertPerformanceMetrics(metrics: any, expectedThresholds: any): void {
    if (expectedThresholds.maxLatency && metrics.latency > expectedThresholds.maxLatency) {
      throw new Error(
        `Latency ${metrics.latency}ms exceeds threshold ${expectedThresholds.maxLatency}ms`
      );
    }

    if (expectedThresholds.minThroughput && metrics.throughput < expectedThresholds.minThroughput) {
      throw new Error(
        `Throughput ${metrics.throughput} below threshold ${expectedThresholds.minThroughput}`
      );
    }

    if (expectedThresholds.maxErrorRate && metrics.errorRate > expectedThresholds.maxErrorRate) {
      throw new Error(
        `Error rate ${metrics.errorRate}% exceeds threshold ${expectedThresholds.maxErrorRate}%`
      );
    }
  }
}

/**
 * Test Utilities - Common utility functions for WebSocket tests
 */
export class TestUtilities {
  /**
   * Wait for a condition to be true with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    checkInterval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await this.delay(checkInterval);
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  /**
   * Delay execution
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry an operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Measure execution time
   */
  static async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;

    return { result, duration };
  }

  /**
   * Generate random string
   */
  static randomString(length: number = 8): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random integer
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Deep clone object
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Compare objects deeply
   */
  static deepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  /**
   * Mock environment bindings for tests
   */
  static createMockEnv(overrides?: any): any {
    return {
      CONVERSATION_ROOM: {
        idFromName: (name: string) => ({ toString: () => name }),
        get: (id: any) => ({
          fetch: async (request: Request) => {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })
      },
      MESSAGE_BROADCASTER: {
        idFromName: (name: string) => ({ toString: () => name }),
        get: (id: any) => ({
          fetch: async (request: Request) => {
            return new Response(JSON.stringify({ success: true, deliveredCount: 1 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })
      },
      USER_CONNECTION: {
        idFromName: (name: string) => ({ toString: () => name }),
        get: (id: any) => ({
          fetch: async (request: Request) => {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })
      },
      SESSIONS: {
        get: async (key: string) => null,
        put: async (key: string, value: string, options?: any) => {},
        delete: async (key: string) => {},
        list: async (options?: any) => ({ keys: [] })
      },
      DB: {
        prepare: (query: string) => ({
          bind: (...params: any[]) => ({
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true })
          })
        })
      },
      ...overrides
    };
  }

  /**
   * Create mock Request for testing
   */
  static createMockRequest(url: string, options?: RequestInit): Request {
    return new Request(url, options);
  }

  /**
   * Parse JSON response safely
   */
  static async parseJsonResponse(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * Batch operation with concurrency control
   */
  static async batchOperation<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(operation));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate statistics from array of numbers
   */
  static calculateStats(numbers: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  } {
    if (numbers.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0 };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((acc, n) => acc + n, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / numbers.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Format duration for display
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${(ms / 60000).toFixed(2)}m`;
    }
  }

  /**
   * Format bytes for display
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)}KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    }
  }
}

/**
 * Load Testing Utilities
 */
export class LoadTestUtilities {
  /**
   * Simulate concurrent connections
   */
  static async simulateConcurrentConnections(
    count: number,
    operation: (index: number) => Promise<void>
  ): Promise<void> {
    const connections = Array.from({ length: count }, (_, i) => operation(i));
    await Promise.all(connections);
  }

  /**
   * Simulate message load
   */
  static async simulateMessageLoad(
    messagesPerSecond: number,
    duration: number,
    sendMessage: () => Promise<void>
  ): Promise<{ sent: number; failed: number; avgLatency: number }> {
    const startTime = Date.now();
    const interval = 1000 / messagesPerSecond;
    let sent = 0;
    let failed = 0;
    const latencies: number[] = [];

    while (Date.now() - startTime < duration) {
      const messageStart = Date.now();

      try {
        await sendMessage();
        sent++;
        latencies.push(Date.now() - messageStart);
      } catch (error) {
        failed++;
      }

      const elapsed = Date.now() - messageStart;
      if (elapsed < interval) {
        await TestUtilities.delay(interval - elapsed);
      }
    }

    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    return { sent, failed, avgLatency };
  }

  /**
   * Monitor system resources during test
   */
  static createResourceMonitor(): {
    start: () => void;
    stop: () => { peakMemory: number; avgCpu: number };
  } {
    let monitoring = false;
    let peakMemory = 0;
    const cpuSamples: number[] = [];

    return {
      start: () => {
        monitoring = true;
        const interval = setInterval(() => {
          if (!monitoring) {
            clearInterval(interval);
            return;
          }

          // Mock resource monitoring (in real environment, would use actual metrics)
          if (typeof process !== 'undefined' && process.memoryUsage) {
            const memory = process.memoryUsage().heapUsed;
            if (memory > peakMemory) {
              peakMemory = memory;
            }
          }
        }, 100);
      },
      stop: () => {
        monitoring = false;
        const avgCpu = cpuSamples.length > 0
          ? cpuSamples.reduce((sum, c) => sum + c, 0) / cpuSamples.length
          : 0;
        return { peakMemory, avgCpu };
      }
    };
  }
}

/**
 * Test Scenarios - Pre-built test scenarios for common cases
 */
export class TestScenarios {
  /**
   * Scenario: New user connects to conversation
   */
  static async newUserConnection(testEnv: any, userId: string, conversationId: string) {
    const connection = TestDataFactory.createConnection({
      userId,
      conversationId,
      role: 'agent'
    });
    return connection;
  }

  /**
   * Scenario: Broadcast message to all users
   */
  static async broadcastMessage(content: string) {
    return TestDataFactory.createEvent({
      type: 'system_announcement',
      data: { content, priority: 'high' }
    });
  }

  /**
   * Scenario: User sends typing indicator
   */
  static async typingIndicator(userId: string, conversationId: string, isTyping: boolean) {
    return TestDataFactory.createTypingEvent(userId, conversationId, isTyping);
  }

  /**
   * Scenario: Load test with N concurrent users
   */
  static async loadTest(userCount: number, messagePerUser: number) {
    const users = Array.from({ length: userCount }, (_, i) =>
      TestDataFactory.createUser({ id: i + 1, username: `user_${i + 1}` })
    );

    const messages = users.flatMap(user =>
      Array.from({ length: messagePerUser }, (_, j) =>
        TestDataFactory.createEvent({
          type: 'message',
          data: {
            senderId: user.id,
            content: `Message ${j + 1} from ${user.username}`
          }
        })
      )
    );

    return { users, messages };
  }
}

// Export all utilities as default
export default {
  TestDataFactory,
  TestAssertions,
  TestUtilities,
  LoadTestUtilities,
  TestScenarios
};
