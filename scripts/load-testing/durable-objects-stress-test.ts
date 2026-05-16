#!/usr/bin/env node
/**
 * Durable Objects Stress Testing Script
 * 專案名稱：Multi-Channel Support MVP - Load Testing Suite
 *
 * Stress tests for Durable Objects performance under high load
 * Tests ConversationRoom, MessageBroadcaster, UserConnection, and DelayedMessageProcessor
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

type JsonRecord = Record<string, unknown>;

// =================== Configuration ===================

interface StressTestConfig {
  workerUrl: string;
  authToken?: string;
  conversationRooms: number;
  userConnections: number;
  messagesPerRoom: number;
  delayedMessages: number;
  broadcastEvents: number;
  testDurationMs: number;
  concurrentRequests: number;
  requestTimeoutMs: number;
  enableDistributedLocks: boolean;
  enableCrossRoomEvents: boolean;
  messageSize: number;
}

const DEFAULT_STRESS_CONFIG: StressTestConfig = {
  workerUrl: 'https://localhost:8787',
  conversationRooms: 100,
  userConnections: 1000,
  messagesPerRoom: 500,
  delayedMessages: 1000,
  broadcastEvents: 5000,
  testDurationMs: 600000, // 10 minutes
  concurrentRequests: 100,
  requestTimeoutMs: 30000,
  enableDistributedLocks: true,
  enableCrossRoomEvents: true,
  messageSize: 512
};

// =================== Test Metrics ===================

interface DurableObjectMetrics {
  objectType: string;
  objectId: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  latencies: number[];
  memoryUsage?: number;
  lockContentions: number;
  throughput: number;
}

interface StressTestResults {
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    testDurationMs: number;
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
  };
  durableObjects: {
    conversationRooms: DurableObjectMetrics[];
    userConnections: DurableObjectMetrics[];
    messageBroadcaster: DurableObjectMetrics;
    delayedMessageProcessor: DurableObjectMetrics;
  };
  performance: {
    lockContention: {
      totalLockRequests: number;
      failedLockAcquisitions: number;
      averageLockTime: number;
      maxLockTime: number;
    };
    messageDelivery: {
      averageDeliveryTime: number;
      deliverySuccessRate: number;
      broadcastFanout: number;
    };
    memory: {
      peakUsage: number;
      averageUsage: number;
      memoryLeaks: boolean;
    };
  };
  errors: {
    byType: Record<string, number>;
    byDurableObject: Record<string, number>;
    timeoutErrors: number;
    connectionErrors: number;
  };
}

// =================== Stress Test Engine ===================

class DurableObjectsStressTester {
  private config: StressTestConfig;
  private metrics: Map<string, DurableObjectMetrics> = new Map();
  private testStartTime: number = 0;
  private testEndTime: number = 0;
  private requestCounter: number = 0;
  private activeRequests: Set<string> = new Set();
  private errors: Map<string, number> = new Map();

  constructor(config: Partial<StressTestConfig> = {}) {
    this.config = { ...DEFAULT_STRESS_CONFIG, ...config };
  }

  async runStressTest(): Promise<StressTestResults> {
    console.log(' Starting Durable Objects Stress Test');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.testStartTime = performance.now();

    try {
      // Run stress tests in parallel
      await Promise.all([
        this.stressTestConversationRooms(),
        this.stressTestUserConnections(),
        this.stressTestMessageBroadcaster(),
        this.stressTestDelayedMessageProcessor(),
        this.stressTestDistributedLocks(),
        this.stressTestCrossRoomEvents()
      ]);

    } catch (error) {
      console.error(' Stress test error:', error);
    } finally {
      this.testEndTime = performance.now();
    }

    return this.generateResults();
  }

  private async stressTestConversationRooms(): Promise<void> {
    console.log(' Stress testing ConversationRooms');

    const promises = [];
    for (let roomIndex = 0; roomIndex < this.config.conversationRooms; roomIndex++) {
      promises.push(this.stressConversationRoom(`room_${roomIndex}`));
    }

    await Promise.allSettled(promises);
  }

  private async stressConversationRoom(roomId: string): Promise<void> {
    const metrics: DurableObjectMetrics = {
      objectType: 'ConversationRoom',
      objectId: roomId,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      latencies: [],
      lockContentions: 0,
      throughput: 0
    };

    this.metrics.set(`conversation_${roomId}`, metrics);

    // Test scenarios for ConversationRoom
    const scenarios = [
      () => this.testRoomParticipants(roomId, metrics),
      () => this.testRoomMessaging(roomId, metrics),
      () => this.testRoomBroadcasting(roomId, metrics),
      () => this.testRoomLocking(roomId, metrics),
      () => this.testRoomMetrics(roomId, metrics)
    ];

    // Run scenarios concurrently
    const scenarioPromises = scenarios.map(scenario =>
      this.runScenarioWithRetry(scenario, 3)
    );

    await Promise.allSettled(scenarioPromises);
  }

  private async testRoomParticipants(roomId: string, metrics: DurableObjectMetrics): Promise<void> {
    const participantCount = Math.floor(Math.random() * 50) + 10; // 10-60 participants

    for (let i = 0; i < participantCount; i++) {
      await this.performRequest(
        `/api/conversation-rooms/${roomId}/connect`,
        'POST',
        {
          userId: `user_${i}`,
          role: 'agent',
          metadata: { deviceId: `device_${i}` }
        },
        metrics
      );

      // Random delay to simulate realistic connections
      if (Math.random() < 0.1) {
        await this.sleep(Math.random() * 100);
      }
    }
  }

  private async testRoomMessaging(roomId: string, metrics: DurableObjectMetrics): Promise<void> {
    const messagePromises = [];

    for (let msgIndex = 0; msgIndex < this.config.messagesPerRoom; msgIndex++) {
      messagePromises.push(
        this.performRequest(
          `/api/conversation-rooms/${roomId}/broadcast`,
          'POST',
          {
            event: {
              id: `msg_${msgIndex}`,
              type: 'message_sent',
              source: 'websocket',
              timestamp: Date.now(),
              userId: `user_${msgIndex % 10}`,
              conversationId: roomId,
              data: {
                messageId: `msg_${msgIndex}`,
                content: this.generateLargeMessage(),
                messageType: 'text'
              },
              priority: Math.random() < 0.1 ? 'high' : 'normal'
            }
          },
          metrics
        )
      );

      // Batch requests to avoid overwhelming
      if (messagePromises.length >= this.config.concurrentRequests) {
        await Promise.allSettled(messagePromises.splice(0, this.config.concurrentRequests));
      }
    }

    // Process remaining requests
    if (messagePromises.length > 0) {
      await Promise.allSettled(messagePromises);
    }
  }

  private async testRoomBroadcasting(roomId: string, metrics: DurableObjectMetrics): Promise<void> {
    const broadcastTypes = ['user_joined', 'user_left', 'typing_start', 'typing_stop', 'system_notification'];

    const broadcastPromises = [];
    for (let i = 0; i < 100; i++) {
      const eventType = broadcastTypes[Math.floor(Math.random() * broadcastTypes.length)];

      broadcastPromises.push(
        this.performRequest(
          `/api/conversation-rooms/${roomId}/broadcast`,
          'POST',
          {
            event: {
              id: `broadcast_${i}`,
              type: eventType,
              source: 'system',
              timestamp: Date.now(),
              data: { message: `Broadcast event ${i}` },
              priority: 'normal'
            }
          },
          metrics
        )
      );
    }

    await Promise.allSettled(broadcastPromises);
  }

  private async testRoomLocking(roomId: string, metrics: DurableObjectMetrics): Promise<void> {
    if (!this.config.enableDistributedLocks) return;

    const lockPromises = [];
    for (let i = 0; i < 50; i++) {
      lockPromises.push(this.testLockAcquisition(roomId, `resource_${i % 5}`, metrics));
    }

    await Promise.allSettled(lockPromises);
  }

  private async testLockAcquisition(roomId: string, resource: string, metrics: DurableObjectMetrics): Promise<void> {
    try {
      // Acquire lock
      const lockResponse = await this.performRequest(
        `/api/conversation-rooms/${roomId}/lock`,
        'POST',
        {
          action: 'acquire',
          resource,
          options: { ttl: 5000, timeout: 2000 }
        },
        metrics
      );

      const lockId = typeof lockResponse.lockId === 'string' ? lockResponse.lockId : undefined;
      if (lockId) {
        // Hold lock briefly
        await this.sleep(Math.random() * 1000);

        // Release lock
        await this.performRequest(
          `/api/conversation-rooms/${roomId}/lock`,
          'POST',
          {
            action: 'release',
            options: { lockId }
          },
          metrics
        );
      }
    } catch (error) {
      metrics.lockContentions++;
    }
  }

  private async testRoomMetrics(roomId: string, metrics: DurableObjectMetrics): Promise<void> {
    // Periodically check room metrics
    const metricsPromises = [];
    for (let i = 0; i < 10; i++) {
      metricsPromises.push(
        this.performRequest(
          `/api/conversation-rooms/${roomId}/metrics`,
          'GET',
          null,
          metrics
        )
      );
      await this.sleep(100);
    }

    await Promise.allSettled(metricsPromises);
  }

  private async stressTestUserConnections(): Promise<void> {
    console.log(' Stress testing UserConnections');

    const promises = [];
    for (let userIndex = 0; userIndex < this.config.userConnections; userIndex++) {
      promises.push(this.stressUserConnection(`user_${userIndex}`));
    }

    await Promise.allSettled(promises);
  }

  private async stressUserConnection(userId: string): Promise<void> {
    const metrics: DurableObjectMetrics = {
      objectType: 'UserConnection',
      objectId: userId,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      latencies: [],
      lockContentions: 0,
      throughput: 0
    };

    this.metrics.set(`user_${userId}`, metrics);

    // Test multiple connections per user
    const connectionPromises = [];
    const connectionsPerUser = Math.floor(Math.random() * 3) + 1; // 1-3 connections

    for (let connIndex = 0; connIndex < connectionsPerUser; connIndex++) {
      connectionPromises.push(
        this.performRequest(
          `/api/user-connections/${userId}/connect`,
          'POST',
          {
            connectionId: `conn_${connIndex}`,
            deviceId: `device_${connIndex}`,
            metadata: { userAgent: 'StressTester/1.0' }
          },
          metrics
        )
      );
    }

    await Promise.allSettled(connectionPromises);

    // Test user-specific messaging
    await this.testUserMessaging(userId, metrics);

    // Test user status updates
    await this.testUserStatusUpdates(userId, metrics);
  }

  private async testUserMessaging(userId: string, metrics: DurableObjectMetrics): Promise<void> {
    const messagingPromises = [];
    for (let i = 0; i < 20; i++) {
      messagingPromises.push(
        this.performRequest(
          `/api/user-connections/${userId}/batch-events`,
          'POST',
          {
            events: [{
              id: `user_msg_${i}`,
              type: 'direct_message',
              timestamp: Date.now(),
              data: { content: `User message ${i}` }
            }]
          },
          metrics
        )
      );
    }

    await Promise.allSettled(messagingPromises);
  }

  private async testUserStatusUpdates(userId: string, metrics: DurableObjectMetrics): Promise<void> {
    const statusPromises = [];
    const statuses = ['online', 'away', 'busy', 'offline'];

    for (const status of statuses) {
      statusPromises.push(
        this.performRequest(
          `/api/user-connections/${userId}/status`,
          'POST',
          { status, timestamp: Date.now() },
          metrics
        )
      );
      await this.sleep(50);
    }

    await Promise.allSettled(statusPromises);
  }

  private async stressTestMessageBroadcaster(): Promise<void> {
    console.log(' Stress testing MessageBroadcaster');

    const metrics: DurableObjectMetrics = {
      objectType: 'MessageBroadcaster',
      objectId: 'global',
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      latencies: [],
      lockContentions: 0,
      throughput: 0
    };

    this.metrics.set('message_broadcaster', metrics);

    // Test high-volume broadcasting
    await this.testBroadcastVolume(metrics);

    // Test different target types
    await this.testBroadcastTargeting(metrics);

    // Test queue management
    await this.testBroadcastQueuing(metrics);
  }

  private async testBroadcastVolume(metrics: DurableObjectMetrics): Promise<void> {
    const broadcastPromises = [];

    for (let i = 0; i < this.config.broadcastEvents; i++) {
      const event = {
        id: `broadcast_${i}`,
        type: 'system_broadcast',
        source: 'stress_test',
        timestamp: Date.now(),
        data: {
          message: this.generateLargeMessage(),
          sequenceNumber: i
        },
        priority: Math.random() < 0.2 ? 'high' : 'normal'
      };

      const targets = [
        {
          type: 'global',
          targets: ['all']
        }
      ];

      broadcastPromises.push(
        this.performRequest(
          '/api/message-broadcaster/broadcast',
          'POST',
          { event, targets },
          metrics
        )
      );

      // Control concurrency
      if (broadcastPromises.length >= this.config.concurrentRequests) {
        await Promise.allSettled(broadcastPromises.splice(0, this.config.concurrentRequests));
      }
    }

    if (broadcastPromises.length > 0) {
      await Promise.allSettled(broadcastPromises);
    }
  }

  private async testBroadcastTargeting(metrics: DurableObjectMetrics): Promise<void> {
    const targetTypes = ['conversation', 'user', 'team'];
    const targetingPromises = [];

    for (let i = 0; i < 100; i++) {
      const targetType = targetTypes[Math.floor(Math.random() * targetTypes.length)];
      const event = {
        id: `targeted_${i}`,
        type: 'targeted_broadcast',
        source: 'stress_test',
        timestamp: Date.now(),
        data: { targetType, message: `Targeted message ${i}` },
        priority: 'normal'
      };

      let targets;
      if (targetType === 'conversation') {
        targets = [{
          type: 'conversation',
          targets: [`room_${Math.floor(Math.random() * 10)}`]
        }];
      } else if (targetType === 'user') {
        targets = [{
          type: 'user',
          targets: [`user_${Math.floor(Math.random() * 100)}`]
        }];
      } else {
        targets = [{
          type: 'team',
          targets: [`team_${Math.floor(Math.random() * 5)}`]
        }];
      }

      targetingPromises.push(
        this.performRequest(
          '/api/message-broadcaster/broadcast',
          'POST',
          { event, targets },
          metrics
        )
      );
    }

    await Promise.allSettled(targetingPromises);
  }

  private async testBroadcastQueuing(metrics: DurableObjectMetrics): Promise<void> {
    // Test queue flushing
    const flushPromises = [];
    for (let i = 0; i < 10; i++) {
      flushPromises.push(
        this.performRequest(
          '/api/message-broadcaster/flush-queue',
          'POST',
          { priority: Math.random() < 0.5 ? 'high' : 'normal' },
          metrics
        )
      );
      await this.sleep(100);
    }

    await Promise.allSettled(flushPromises);
  }

  private async stressTestDelayedMessageProcessor(): Promise<void> {
    console.log(' Stress testing DelayedMessageProcessor');

    const metrics: DurableObjectMetrics = {
      objectType: 'DelayedMessageProcessor',
      objectId: 'global',
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      latencies: [],
      lockContentions: 0,
      throughput: 0
    };

    this.metrics.set('delayed_message_processor', metrics);

    // Test scheduling many delayed messages
    const schedulePromises = [];
    for (let i = 0; i < this.config.delayedMessages; i++) {
      const delaySeconds = Math.floor(Math.random() * 120) + 1; // 1-120 seconds

      schedulePromises.push(
        this.performRequest(
          '/api/delayed-messages/schedule',
          'POST',
          {
            messageId: `delayed_${i}`,
            delaySeconds,
            event: {
              type: 'delayed_message',
              data: {
                content: `Delayed message ${i}`,
                originalTimestamp: Date.now()
              }
            }
          },
          metrics
        )
      );

      // Control concurrency
      if (schedulePromises.length >= 50) {
        await Promise.allSettled(schedulePromises.splice(0, 50));
      }
    }

    if (schedulePromises.length > 0) {
      await Promise.allSettled(schedulePromises);
    }

    // Test recall functionality
    await this.testMessageRecall(metrics);
  }

  private async testMessageRecall(metrics: DurableObjectMetrics): Promise<void> {
    const recallPromises = [];
    for (let i = 0; i < 50; i++) {
      recallPromises.push(
        this.performRequest(
          '/api/delayed-messages/recall',
          'POST',
          { messageId: `delayed_${i}` },
          metrics
        )
      );
    }

    await Promise.allSettled(recallPromises);
  }

  private async stressTestDistributedLocks(): Promise<void> {
    if (!this.config.enableDistributedLocks) return;

    console.log(' Stress testing Distributed Locks');

    // Test lock contention scenarios
    const lockResources = ['resource_a', 'resource_b', 'resource_c'];
    const contentionPromises = [];

    for (let i = 0; i < 200; i++) {
      const resource = lockResources[Math.floor(Math.random() * lockResources.length)];
      contentionPromises.push(this.testLockContention(resource));
    }

    await Promise.allSettled(contentionPromises);
  }

  private async testLockContention(resource: string): Promise<void> {
    const roomId = `room_${Math.floor(Math.random() * 10)}`;
    try {
      const lockResponse = await this.makeRequest(
        'POST',
        `/api/conversation-rooms/${roomId}/lock`,
        {
          action: 'acquire',
          resource,
          options: { ttl: 2000, timeout: 1000 }
        }
      );

      const lockId = typeof lockResponse.lockId === 'string' ? lockResponse.lockId : undefined;
      if (lockId) {
        await this.sleep(Math.random() * 500);
        await this.makeRequest(
          'POST',
          `/api/conversation-rooms/${roomId}/lock`,
          {
            action: 'release',
            options: { lockId }
          }
        );
      }
    } catch (error) {
      // Lock contention expected
    }
  }

  private async stressTestCrossRoomEvents(): Promise<void> {
    if (!this.config.enableCrossRoomEvents) return;

    console.log(' Stress testing Cross-Room Events');

    const crossRoomPromises = [];
    for (let i = 0; i < 100; i++) {
      const sourceRoom = `room_${Math.floor(Math.random() * 10)}`;
      const targetRooms = Array.from({ length: 3 }, () =>
        `room_${Math.floor(Math.random() * 10)}`
      );

      crossRoomPromises.push(
        this.makeRequest(
          'POST',
          '/api/message-broadcaster/broadcast',
          {
            event: {
              id: `cross_room_${i}`,
              type: 'cross_room_event',
              source: sourceRoom,
              timestamp: Date.now(),
              data: { message: `Cross-room event ${i}` },
              priority: 'normal'
            },
            targets: [{
              type: 'conversation',
              targets: targetRooms
            }]
          }
        )
      );
    }

    await Promise.allSettled(crossRoomPromises);
  }

  private async performRequest(
    endpoint: string,
    method: string,
    body: unknown,
    metrics: DurableObjectMetrics
  ): Promise<JsonRecord> {
    const requestId = `req_${++this.requestCounter}`;
    this.activeRequests.add(requestId);

    const startTime = performance.now();
    metrics.requestCount++;

    try {
      const result = await this.makeRequest(method, endpoint, body);
      const latency = performance.now() - startTime;

      metrics.successCount++;
      metrics.latencies.push(latency);
      metrics.maxLatency = Math.max(metrics.maxLatency, latency);
      metrics.minLatency = Math.min(metrics.minLatency, latency);

      return result;
    } catch (error) {
      metrics.errorCount++;
      const errorType = error instanceof Error ? error.message : 'Unknown error';
      this.errors.set(errorType, (this.errors.get(errorType) || 0) + 1);
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private async makeRequest(method: string, endpoint: string, body?: unknown): Promise<JsonRecord> {
    const url = `${this.config.workerUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeout: this.config.requestTimeoutMs
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return typeof json === 'object' && json !== null ? json as JsonRecord : {};
  }

  private async runScenarioWithRetry(
    scenario: () => Promise<void>,
    maxRetries: number
  ): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await scenario();
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(` Scenario failed after ${maxRetries} attempts:`, error);
        }
        await this.sleep(1000 * (attempt + 1)); // Exponential backoff
      }
    }
  }

  private generateLargeMessage(): string {
    const baseMessage = 'This is a stress test message with substantial content to test memory and throughput.';
    const targetSize = this.config.messageSize;
    let message = baseMessage;

    while (message.length < targetSize) {
      message += ' ' + Math.random().toString(36).substring(2, 10);
    }

    return message.substring(0, targetSize);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateResults(): StressTestResults {
    const testDurationMs = this.testEndTime - this.testStartTime;
    const allMetrics = Array.from(this.metrics.values());

    // Calculate aggregate statistics
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const successfulRequests = allMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const failedRequests = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);

    const allLatencies = allMetrics.flatMap(m => m.latencies);
    const averageLatency = allLatencies.length > 0 ?
      allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length : 0;

    // Update individual metrics
    allMetrics.forEach(metrics => {
      if (metrics.latencies.length > 0) {
        metrics.averageLatency = metrics.latencies.reduce((sum, l) => sum + l, 0) / metrics.latencies.length;
        metrics.throughput = (metrics.successCount / testDurationMs) * 1000;
      }
    });

    // Categorize metrics by Durable Object type
    const conversationRooms = allMetrics.filter(m => m.objectType === 'ConversationRoom');
    const userConnections = allMetrics.filter(m => m.objectType === 'UserConnection');
    const messageBroadcaster = allMetrics.find(m => m.objectType === 'MessageBroadcaster')!;
    const delayedMessageProcessor = allMetrics.find(m => m.objectType === 'DelayedMessageProcessor')!;

    const results: StressTestResults = {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        testDurationMs,
        requestsPerSecond: (totalRequests / testDurationMs) * 1000,
        averageLatency,
        errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0
      },
      durableObjects: {
        conversationRooms,
        userConnections,
        messageBroadcaster,
        delayedMessageProcessor
      },
      performance: {
        lockContention: {
          totalLockRequests: allMetrics.reduce((sum, m) => sum + m.lockContentions, 0),
          failedLockAcquisitions: 0, // Would need more detailed tracking
          averageLockTime: 0, // Would need lock-specific timing
          maxLockTime: 0
        },
        messageDelivery: {
          averageDeliveryTime: averageLatency,
          deliverySuccessRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
          broadcastFanout: messageBroadcaster?.successCount || 0
        },
        memory: {
          peakUsage: 0, // Would need memory monitoring
          averageUsage: 0,
          memoryLeaks: false
        }
      },
      errors: {
        byType: Object.fromEntries(this.errors),
        byDurableObject: {},
        timeoutErrors: this.errors.get('timeout') || 0,
        connectionErrors: this.errors.get('connection') || 0
      }
    };

    return results;
  }
}

// =================== CLI Interface ===================

const args = process.argv.slice(2);
const config: Partial<StressTestConfig> = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];

  if (key === 'url') config.workerUrl = value;
  else if (key === 'rooms') config.conversationRooms = parseInt(value);
  else if (key === 'users') config.userConnections = parseInt(value);
  else if (key === 'messages') config.messagesPerRoom = parseInt(value);
  else if (key === 'duration') config.testDurationMs = parseInt(value) * 1000;
  else if (key === 'concurrency') config.concurrentRequests = parseInt(value);
  else if (key === 'token') config.authToken = value;
}

async function runStressTest() {
  const tester = new DurableObjectsStressTester(config);

  try {
    const results = await tester.runStressTest();

    console.log('\n Stress Test Results:');
    console.log('='.repeat(60));
    console.log('Summary:', JSON.stringify(results.summary, null, 2));
    console.log('\n Performance:', JSON.stringify(results.performance, null, 2));
    console.log('\n Errors:', JSON.stringify(results.errors, null, 2));

    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `stress-test-results-${timestamp}.json`;

    const fs = require('fs');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n Detailed results saved to: ${resultsFile}`);

  } catch (error) {
    console.error(' Stress test failed:', error);
    process.exit(1);
  }
}

runStressTest();

export { DurableObjectsStressTester, StressTestConfig, StressTestResults };
