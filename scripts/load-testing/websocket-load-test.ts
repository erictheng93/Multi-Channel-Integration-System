#!/usr/bin/env node
/**
 * WebSocket Load Testing Script
 * 專案名稱：Multi-Channel Support MVP - Load Testing Suite
 *
 * Comprehensive load testing for WebSocket + Durable Objects architecture
 * Tests concurrent connections, message throughput, and system stability
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

// =================== Configuration ===================

interface LoadTestConfig {
  targetUrl: string;
  maxConnections: number;
  connectionsPerSecond: number;
  messagesPerConnection: number;
  messageIntervalMs: number;
  testDurationMs: number;
  rampUpTimeMs: number;
  rampDownTimeMs: number;
  concurrentRooms: number;
  messageSize: number;
  includeDelayedMessages: boolean;
  enableTypingIndicators: boolean;
  authToken?: string;
}

const DEFAULT_CONFIG: LoadTestConfig = {
  targetUrl: 'wss://localhost:8787/api/websocket/connect',
  maxConnections: 1000,
  connectionsPerSecond: 50,
  messagesPerConnection: 100,
  messageIntervalMs: 1000,
  testDurationMs: 300000, // 5 minutes
  rampUpTimeMs: 60000,   // 1 minute
  rampDownTimeMs: 30000, // 30 seconds
  concurrentRooms: 10,
  messageSize: 256, // bytes
  includeDelayedMessages: true,
  enableTypingIndicators: true
};

// =================== Test Metrics ===================

interface ConnectionMetrics {
  connectionId: string;
  userId: string;
  conversationId?: string;
  connectedAt: number;
  disconnectedAt?: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  latencies: number[];
  connectionTime: number;
  isActive: boolean;
}

interface TestResults {
  summary: {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalErrors: number;
    testDurationMs: number;
    averageConnectionTime: number;
    connectionsPerSecond: number;
    messagesPerSecond: number;
  };
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    average: number;
  };
  connectionStats: {
    successRate: number;
    errorRate: number;
    averageLifetime: number;
    maxConcurrent: number;
  };
  messageStats: {
    deliveryRate: number;
    throughput: number;
    errorRate: number;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage[];
    cpuUsage: NodeJS.CpuUsage[];
    timestamp: number[];
  };
  connectionMetrics: ConnectionMetrics[];
}

// =================== Load Test Engine ===================

class WebSocketLoadTester extends EventEmitter {
  private config: LoadTestConfig;
  private connections: Map<string, WebSocket> = new Map();
  private metrics: Map<string, ConnectionMetrics> = new Map();
  private testStartTime: number = 0;
  private testEndTime: number = 0;
  private isRunning: boolean = false;
  private connectionCounter: number = 0;
  private messageCounter: number = 0;
  private performanceMetrics: TestResults['performance'] = {
    memoryUsage: [],
    cpuUsage: [],
    timestamp: []
  };

  constructor(config: Partial<LoadTestConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async runLoadTest(): Promise<TestResults> {
    console.log('🚀 Starting WebSocket Load Test');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.testStartTime = performance.now();
    this.isRunning = true;

    // Start performance monitoring
    this.startPerformanceMonitoring();

    try {
      // Phase 1: Ramp up connections
      await this.rampUpPhase();

      // Phase 2: Sustain load
      await this.sustainedLoadPhase();

      // Phase 3: Ramp down
      await this.rampDownPhase();

    } catch (error) {
      console.error('❌ Load test error:', error);
    } finally {
      this.isRunning = false;
      this.testEndTime = performance.now();

      // Clean up all connections
      await this.cleanup();
    }

    return this.generateResults();
  }

  private async rampUpPhase(): Promise<void> {
    console.log('📈 Phase 1: Ramping up connections');

    const rampUpSteps = Math.ceil(this.config.rampUpTimeMs / 1000); // 1 second steps
    const connectionsPerStep = Math.ceil(this.config.maxConnections / rampUpSteps);

    for (let step = 0; step < rampUpSteps && this.isRunning; step++) {
      const connectionsToCreate = Math.min(
        connectionsPerStep,
        this.config.maxConnections - this.connections.size
      );

      // Create connections in parallel batches
      const batchSize = Math.min(connectionsToCreate, this.config.connectionsPerSecond);
      for (let batch = 0; batch < Math.ceil(connectionsToCreate / batchSize); batch++) {
        const startIdx = batch * batchSize;
        const endIdx = Math.min(startIdx + batchSize, connectionsToCreate);

        const promises = [];
        for (let i = startIdx; i < endIdx; i++) {
          promises.push(this.createConnection());
        }

        await Promise.allSettled(promises);

        // Rate limiting
        if (batch < Math.ceil(connectionsToCreate / batchSize) - 1) {
          await this.sleep(1000 / (this.config.connectionsPerSecond / batchSize));
        }
      }

      console.log(`📊 Step ${step + 1}/${rampUpSteps}: ${this.connections.size} connections active`);
      await this.sleep(1000);
    }

    console.log(`✅ Ramp up complete: ${this.connections.size} connections established`);
  }

  private async sustainedLoadPhase(): Promise<void> {
    console.log('🔄 Phase 2: Sustained load testing');

    const sustainDuration = this.config.testDurationMs - this.config.rampUpTimeMs - this.config.rampDownTimeMs;
    const endTime = Date.now() + sustainDuration;

    // Start message sending for all connections
    this.startMessageGeneration();

    // Monitor progress
    const progressInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(progressInterval);
        return;
      }

      const activeConnections = Array.from(this.metrics.values()).filter(m => m.isActive).length;
      const totalMessages = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.messagesSent, 0);
      const totalReceived = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.messagesReceived, 0);

      console.log(`📊 Progress: ${activeConnections} active connections, ${totalMessages} sent, ${totalReceived} received`);
    }, 10000); // Every 10 seconds

    // Wait for sustain phase
    while (Date.now() < endTime && this.isRunning) {
      await this.sleep(1000);
    }

    clearInterval(progressInterval);
    console.log('✅ Sustained load phase complete');
  }

  private async rampDownPhase(): Promise<void> {
    console.log('📉 Phase 3: Ramping down connections');

    const rampDownSteps = Math.ceil(this.config.rampDownTimeMs / 1000);
    const connectionsPerStep = Math.ceil(this.connections.size / rampDownSteps);

    for (let step = 0; step < rampDownSteps && this.connections.size > 0; step++) {
      const connectionsToRemove = Math.min(connectionsPerStep, this.connections.size);
      const connectionIds = Array.from(this.connections.keys()).slice(0, connectionsToRemove);

      // Close connections
      const promises = connectionIds.map(id => this.closeConnection(id));
      await Promise.allSettled(promises);

      console.log(`📊 Step ${step + 1}/${rampDownSteps}: ${this.connections.size} connections remaining`);
      await this.sleep(1000);
    }

    console.log('✅ Ramp down complete');
  }

  private async createConnection(): Promise<void> {
    const connectionId = `conn_${++this.connectionCounter}`;
    const userId = `user_${Math.floor(Math.random() * 1000)}`;
    const conversationId = `conv_${Math.floor(Math.random() * this.config.concurrentRooms)}`;

    const metrics: ConnectionMetrics = {
      connectionId,
      userId,
      conversationId,
      connectedAt: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      latencies: [],
      connectionTime: 0,
      isActive: false
    };

    this.metrics.set(connectionId, metrics);

    try {
      const connectStart = performance.now();

      // Build WebSocket URL with parameters
      const url = new URL(this.config.targetUrl);
      url.searchParams.set('userId', userId);
      url.searchParams.set('conversationId', conversationId);
      url.searchParams.set('deviceId', 'load-test');
      url.searchParams.set('clientVersion', '1.0.0-test');

      // Add auth token if provided
      if (this.config.authToken) {
        url.searchParams.set('token', this.config.authToken);
      }

      const ws = new WebSocket(url.toString(), {
        headers: {
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : undefined,
          'User-Agent': 'WebSocket-Load-Tester/1.0.0'
        }
      });

      const connectPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout

        ws.on('open', () => {
          clearTimeout(timeout);
          const connectTime = performance.now() - connectStart;
          metrics.connectionTime = connectTime;
          metrics.isActive = true;

          console.log(`✅ Connection established: ${connectionId} (${connectTime.toFixed(2)}ms)`);
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          metrics.errors++;
          reject(error);
        });
      });

      // Set up event handlers
      this.setupWebSocketHandlers(ws, metrics);

      // Wait for connection
      await connectPromise;

      this.connections.set(connectionId, ws);

    } catch (error) {
      metrics.errors++;
      console.error(`❌ Connection failed: ${connectionId}`, error);
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, metrics: ConnectionMetrics): void {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        metrics.messagesReceived++;

        // Calculate latency if message has timestamp
        if (message.timestamp) {
          const latency = Date.now() - message.timestamp;
          metrics.latencies.push(latency);
        }

        // Handle specific message types
        if (message.type === 'pong') {
          // Heartbeat response
        } else if (message.type === 'event') {
          // Real-time event received
        }

      } catch (error) {
        metrics.errors++;
        console.error(`❌ Message parsing error for ${metrics.connectionId}:`, error);
      }
    });

    ws.on('close', (code, reason) => {
      metrics.isActive = false;
      metrics.disconnectedAt = Date.now();
      console.log(`🔌 Connection closed: ${metrics.connectionId} (${code}: ${reason})`);
    });

    ws.on('error', (error) => {
      metrics.errors++;
      metrics.isActive = false;
      console.error(`❌ WebSocket error for ${metrics.connectionId}:`, error);
    });
  }

  private startMessageGeneration(): void {
    console.log('📤 Starting message generation');

    for (const [connectionId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        this.startMessagingForConnection(connectionId, ws);
      }
    }
  }

  private startMessagingForConnection(connectionId: string, ws: WebSocket): void {
    const metrics = this.metrics.get(connectionId);
    if (!metrics) return;

    const sendMessage = () => {
      if (!this.isRunning || ws.readyState !== WebSocket.OPEN) return;

      const messageTypes = ['chat', 'typing_start', 'typing_stop'];
      if (this.config.includeDelayedMessages) {
        messageTypes.push('delayed_message');
      }

      const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];

      let messageData: any = {
        type: 'message',
        id: `msg_${++this.messageCounter}`,
        timestamp: Date.now(),
        data: {
          messageType,
          content: this.generateMessageContent(),
          senderName: `User ${metrics.userId}`,
          metadata: {
            loadTest: true,
            connectionId
          }
        }
      };

      // Add specific data for message types
      if (messageType === 'delayed_message') {
        messageData.data.delaySeconds = Math.floor(Math.random() * 10) + 1;
      } else if (messageType.startsWith('typing_')) {
        messageData = {
          type: 'event',
          data: {
            type: messageType,
            userId: metrics.userId,
            conversationId: metrics.conversationId,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        };
      }

      try {
        ws.send(JSON.stringify(messageData));
        metrics.messagesSent++;
      } catch (error) {
        metrics.errors++;
        console.error(`❌ Send error for ${connectionId}:`, error);
      }

      // Schedule next message
      if (this.isRunning && ws.readyState === WebSocket.OPEN &&
          metrics.messagesSent < this.config.messagesPerConnection) {
        setTimeout(sendMessage, this.config.messageIntervalMs + Math.random() * 1000);
      }
    };

    // Start sending messages with random initial delay
    setTimeout(sendMessage, Math.random() * this.config.messageIntervalMs);
  }

  private generateMessageContent(): string {
    const messages = [
      'Hello, this is a test message for load testing.',
      'How are you doing today?',
      'This is message number',
      'Load testing in progress...',
      'Real-time communication test',
      'WebSocket connection active',
      'Durable Objects working well',
      'Performance test message',
      'System under load',
      'Concurrent user simulation'
    ];

    let content = messages[Math.floor(Math.random() * messages.length)];

    // Pad message to reach target size
    const targetSize = this.config.messageSize;
    while (content.length < targetSize) {
      content += ' ' + Math.random().toString(36).substring(2);
    }

    return content.substring(0, targetSize);
  }

  private async closeConnection(connectionId: string): Promise<void> {
    const ws = this.connections.get(connectionId);
    const metrics = this.metrics.get(connectionId);

    if (ws && metrics) {
      try {
        ws.close(1000, 'Load test complete');
        metrics.isActive = false;
        metrics.disconnectedAt = Date.now();
      } catch (error) {
        metrics.errors++;
        console.error(`❌ Close error for ${connectionId}:`, error);
      }
    }

    this.connections.delete(connectionId);
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up connections');

    const closePromises = Array.from(this.connections.keys()).map(id => this.closeConnection(id));
    await Promise.allSettled(closePromises);

    this.connections.clear();
    console.log('✅ Cleanup complete');
  }

  private startPerformanceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(monitorInterval);
        return;
      }

      this.performanceMetrics.memoryUsage.push(process.memoryUsage());
      this.performanceMetrics.cpuUsage.push(process.cpuUsage());
      this.performanceMetrics.timestamp.push(Date.now());

      // Keep only last 100 measurements
      if (this.performanceMetrics.memoryUsage.length > 100) {
        this.performanceMetrics.memoryUsage.shift();
        this.performanceMetrics.cpuUsage.shift();
        this.performanceMetrics.timestamp.shift();
      }
    }, 1000); // Every second
  }

  private generateResults(): TestResults {
    const testDurationMs = this.testEndTime - this.testStartTime;
    const allMetrics = Array.from(this.metrics.values());
    const successfulConnections = allMetrics.filter(m => m.connectionTime > 0);

    // Calculate latencies
    const allLatencies = allMetrics.flatMap(m => m.latencies).sort((a, b) => a - b);
    const latencyStats = {
      p50: this.percentile(allLatencies, 50),
      p90: this.percentile(allLatencies, 90),
      p95: this.percentile(allLatencies, 95),
      p99: this.percentile(allLatencies, 99),
      max: allLatencies[allLatencies.length - 1] || 0,
      min: allLatencies[0] || 0,
      average: allLatencies.length > 0 ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length : 0
    };

    // Calculate summary stats
    const totalMessagesSent = allMetrics.reduce((sum, m) => sum + m.messagesSent, 0);
    const totalMessagesReceived = allMetrics.reduce((sum, m) => sum + m.messagesReceived, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);

    const results: TestResults = {
      summary: {
        totalConnections: allMetrics.length,
        successfulConnections: successfulConnections.length,
        failedConnections: allMetrics.length - successfulConnections.length,
        totalMessagesSent,
        totalMessagesReceived,
        totalErrors,
        testDurationMs,
        averageConnectionTime: successfulConnections.length > 0 ?
          successfulConnections.reduce((sum, m) => sum + m.connectionTime, 0) / successfulConnections.length : 0,
        connectionsPerSecond: (successfulConnections.length / testDurationMs) * 1000,
        messagesPerSecond: (totalMessagesSent / testDurationMs) * 1000
      },
      latency: latencyStats,
      connectionStats: {
        successRate: allMetrics.length > 0 ? successfulConnections.length / allMetrics.length : 0,
        errorRate: totalMessagesSent > 0 ? totalErrors / totalMessagesSent : 0,
        averageLifetime: this.calculateAverageLifetime(allMetrics),
        maxConcurrent: this.calculateMaxConcurrent(allMetrics)
      },
      messageStats: {
        deliveryRate: totalMessagesSent > 0 ? totalMessagesReceived / totalMessagesSent : 0,
        throughput: (totalMessagesReceived / testDurationMs) * 1000,
        errorRate: totalMessagesSent > 0 ? totalErrors / totalMessagesSent : 0
      },
      performance: this.performanceMetrics,
      connectionMetrics: allMetrics
    };

    return results;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private calculateAverageLifetime(metrics: ConnectionMetrics[]): number {
    const completedConnections = metrics.filter(m => m.disconnectedAt && m.connectedAt);
    if (completedConnections.length === 0) return 0;

    const totalLifetime = completedConnections.reduce((sum, m) =>
      sum + (m.disconnectedAt! - m.connectedAt), 0);

    return totalLifetime / completedConnections.length;
  }

  private calculateMaxConcurrent(metrics: ConnectionMetrics[]): number {
    // This is a simplified calculation
    // In practice, you'd need to track concurrent connections over time
    return metrics.filter(m => m.connectionTime > 0).length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =================== CLI Interface ===================

const args = process.argv.slice(2);
const config: Partial<LoadTestConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'websocket-url') config.targetUrl = value;
    else if (key === 'url' && !config.targetUrl) config.targetUrl = value;
    else if (key === 'connections') config.maxConnections = parseInt(value);
    else if (key === 'rate') config.connectionsPerSecond = parseInt(value);
    else if (key === 'messages') config.messagesPerConnection = parseInt(value);
    else if (key === 'duration') config.testDurationMs = parseInt(value) * 1000;
    else if (key === 'rooms') config.concurrentRooms = parseInt(value);
    else if (key === 'token') config.authToken = value;
  }

  async function runTest() {
    const tester = new WebSocketLoadTester(config);

    try {
      const results = await tester.runLoadTest();

      console.log('\n🎉 Load Test Results:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(results.summary, null, 2));
      console.log('\n📊 Latency Statistics:');
      console.log(JSON.stringify(results.latency, null, 2));
      console.log('\n🔗 Connection Statistics:');
      console.log(JSON.stringify(results.connectionStats, null, 2));
      console.log('\n💬 Message Statistics:');
      console.log(JSON.stringify(results.messageStats, null, 2));

      // Save detailed results to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsFile = `load-test-results-${timestamp}.json`;

      const fs = require('fs');
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      console.log(`\n📁 Detailed results saved to: ${resultsFile}`);

    } catch (error) {
      console.error('❌ Load test failed:', error);
      process.exit(1);
    }
  }

  runTest();

export { WebSocketLoadTester, LoadTestConfig, TestResults };