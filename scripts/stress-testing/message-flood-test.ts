#!/usr/bin/env node
/**
 * Message Flood Stress Test
 * 專案名稱：Multi-Channel Support MVP - Stress Testing
 *
 * Tests system behavior under extreme message volume loads
 * Validates message processing, queue management, and system stability
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// =================== Configuration ===================

interface MessageFloodConfig {
  targetUrl: string;
  websocketUrl: string;
  authToken?: string;
  totalMessages: number;
  messagesPerSecond: number;
  concurrentConnections: number;
  messageSize: number;
  burstIntervals: boolean;
  burstMultiplier: number;
  messageTypes: string[];
  testDurationMs: number;
  includeDelayedMessages: boolean;
  includeBroadcasts: boolean;
  measureDeliveryTime: boolean;
  outputFile?: string;
}

const DEFAULT_FLOOD_CONFIG: MessageFloodConfig = {
  targetUrl: 'https://localhost:8787',
  websocketUrl: 'wss://localhost:8787/api/websocket/connect',
  totalMessages: 10000,
  messagesPerSecond: 100,
  concurrentConnections: 50,
  messageSize: 1024, // 1KB
  burstIntervals: true,
  burstMultiplier: 5,
  messageTypes: ['text', 'typing', 'system', 'delayed'],
  testDurationMs: 300000, // 5 minutes
  includeDelayedMessages: true,
  includeBroadcasts: true,
  measureDeliveryTime: true
};

// =================== Test Results ===================

interface MessageFloodResults {
  summary: {
    totalMessagesSent: number;
    totalMessagesReceived: number;
    messagesSentPerSecond: number;
    messagesReceivedPerSecond: number;
    testDuration: number;
    deliveryRate: number;
    averageLatency: number;
    peakLatency: number;
    systemOverloaded: boolean;
  };
  performance: {
    latencies: number[];
    throughputHistory: ThroughputSnapshot[];
    errorRates: number[];
    queueDepths: number[];
    memoryUsage: number[];
  };
  messageTypes: {
    [messageType: string]: {
      sent: number;
      received: number;
      averageLatency: number;
      errorRate: number;
    };
  };
  systemBehavior: {
    backpressure: boolean;
    queueOverflow: boolean;
    connectionDrops: boolean;
    latencySpikes: boolean;
    memoryLeaks: boolean;
  };
  recommendations: string[];
}

interface ThroughputSnapshot {
  timestamp: number;
  messagesSent: number;
  messagesReceived: number;
  activeConnections: number;
  queueDepth: number;
  systemLatency: number;
}

interface MessageResult {
  id: string;
  type: string;
  sentAt: number;
  receivedAt?: number;
  delivered: boolean;
  latency?: number;
  error?: string;
  connectionId?: string;
}

interface ConnectionContext {
  websocket: WebSocket;
  connectionId: string;
  userId: string;
  conversationId: string;
  messagesSent: number;
  messagesReceived: number;
  lastActivity: number;
  isActive: boolean;
}

// =================== Message Flood Tester ===================

export class MessageFloodTester {
  private config: MessageFloodConfig;
  private results: MessageFloodResults;
  private connections: Map<string, ConnectionContext> = new Map();
  private messageResults: Map<string, MessageResult> = new Map();
  private throughputHistory: ThroughputSnapshot[] = [];
  private testStartTime: number = 0;
  private messageCounter: number = 0;
  private isRunning: boolean = false;

  constructor(config: Partial<MessageFloodConfig> = {}) {
    this.config = { ...DEFAULT_FLOOD_CONFIG, ...config };
    this.results = this.initializeResults();
  }

  async runMessageFlood(): Promise<MessageFloodResults> {
    console.log('🌊 Starting Message Flood Test');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.testStartTime = performance.now();
    this.isRunning = true;

    try {
      // Phase 1: Establish connections
      await this.establishConnections();

      // Phase 2: Start monitoring
      this.startThroughputMonitoring();

      // Phase 3: Execute message flood
      await this.executeMessageFlood();

      // Phase 4: Wait for message delivery
      await this.waitForMessageDelivery();

      // Phase 5: Analyze results
      this.analyzeResults();

    } catch (error) {
      console.error('❌ Message flood test error:', error);
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }

    return this.results;
  }

  private async establishConnections(): Promise<void> {
    console.log(`🔗 Establishing ${this.config.concurrentConnections} connections`);

    const connectionPromises = [];
    for (let i = 0; i < this.config.concurrentConnections; i++) {
      connectionPromises.push(this.createFloodConnection(i));
    }

    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    console.log(`✅ Established ${successful}/${this.config.concurrentConnections} connections`);

    if (successful === 0) {
      throw new Error('Failed to establish any connections');
    }
  }

  private async createFloodConnection(index: number): Promise<void> {
    const connectionId = `flood_conn_${index}`;
    const userId = `flood_user_${index}`;
    const conversationId = `flood_room_${Math.floor(index / 10)}`; // 10 users per room

    try {
      // Build WebSocket URL
      const url = new URL(this.config.websocketUrl);
      url.searchParams.set('userId', userId);
      url.searchParams.set('conversationId', conversationId);
      url.searchParams.set('deviceId', 'flood-test');

      const headers: any = {};
      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      }

      // Create WebSocket
      const ws = new WebSocket(url.toString(), { headers });

      // Set up connection context
      const context: ConnectionContext = {
        websocket: ws,
        connectionId,
        userId,
        conversationId,
        messagesSent: 0,
        messagesReceived: 0,
        lastActivity: Date.now(),
        isActive: false
      };

      // Set up event handlers
      this.setupConnectionHandlers(context);

      // Wait for connection
      await this.waitForConnection(ws);
      context.isActive = true;

      this.connections.set(connectionId, context);

      console.log(`✅ Flood connection established: ${connectionId}`);

    } catch (error) {
      console.error(`❌ Failed to create flood connection ${connectionId}:`, error);
      throw error;
    }
  }

  private setupConnectionHandlers(context: ConnectionContext): void {
    const { websocket, connectionId } = context;

    websocket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleReceivedMessage(context, message);
      } catch (error) {
        console.error(`❌ Message parsing error for ${connectionId}:`, error);
      }
    });

    websocket.on('close', (code, reason) => {
      console.warn(`🔌 Connection closed: ${connectionId} (${code}: ${reason})`);
      context.isActive = false;
    });

    websocket.on('error', (error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error);
      context.isActive = false;
    });
  }

  private handleReceivedMessage(context: ConnectionContext, message: any): void {
    context.messagesReceived++;
    context.lastActivity = Date.now();

    // Track message delivery if we sent this message
    if (message.id && this.messageResults.has(message.id)) {
      const messageResult = this.messageResults.get(message.id)!;
      messageResult.receivedAt = Date.now();
      messageResult.delivered = true;
      messageResult.latency = messageResult.receivedAt - messageResult.sentAt;
      messageResult.connectionId = context.connectionId;
    }
  }

  private async waitForConnection(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private startThroughputMonitoring(): void {
    console.log('📊 Starting throughput monitoring');

    const monitoringInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(monitoringInterval);
        return;
      }

      this.captureThroughputSnapshot();
    }, 1000); // Every second
  }

  private captureThroughputSnapshot(): void {
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isActive).length;
    const totalSent = Array.from(this.connections.values()).reduce((sum, c) => sum + c.messagesSent, 0);
    const totalReceived = Array.from(this.connections.values()).reduce((sum, c) => sum + c.messagesReceived, 0);

    const snapshot: ThroughputSnapshot = {
      timestamp: Date.now(),
      messagesSent: totalSent,
      messagesReceived: totalReceived,
      activeConnections,
      queueDepth: this.estimateQueueDepth(),
      systemLatency: this.calculateCurrentLatency()
    };

    this.throughputHistory.push(snapshot);

    // Keep only recent history to prevent memory issues
    if (this.throughputHistory.length > 1000) {
      this.throughputHistory.shift();
    }

    // Log progress periodically
    if (this.throughputHistory.length % 10 === 0) {
      console.log(`📈 Progress: ${totalSent} sent, ${totalReceived} received, ${activeConnections} active connections`);
    }
  }

  private async executeMessageFlood(): Promise<void> {
    console.log(`🌊 Starting message flood: ${this.config.totalMessages} messages at ${this.config.messagesPerSecond} msg/s`);

    const messageInterval = 1000 / this.config.messagesPerSecond; // ms between messages
    let messagesSent = 0;
    const startTime = Date.now();

    while (messagesSent < this.config.totalMessages && this.isRunning) {
      const currentTime = Date.now();

      // Check if we should send burst of messages
      const shouldBurst = this.config.burstIntervals &&
                         (currentTime - startTime) % 30000 < 5000; // 5 second burst every 30 seconds

      const currentRate = shouldBurst ?
        this.config.messagesPerSecond * this.config.burstMultiplier :
        this.config.messagesPerSecond;

      const actualInterval = 1000 / currentRate;

      // Send a batch of messages
      const batchSize = Math.min(10, this.config.totalMessages - messagesSent);
      const sendPromises = [];

      for (let i = 0; i < batchSize; i++) {
        sendPromises.push(this.sendFloodMessage());
        messagesSent++;
      }

      await Promise.allSettled(sendPromises);

      // Rate limiting
      await this.sleep(actualInterval);

      // Safety check for test duration
      if (currentTime - this.testStartTime > this.config.testDurationMs) {
        console.log('⏰ Test duration reached, stopping message flood');
        break;
      }
    }

    console.log(`✅ Message flood complete: ${messagesSent} messages sent`);
  }

  private async sendFloodMessage(): Promise<void> {
    const messageType = this.selectMessageType();
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isActive);

    if (activeConnections.length === 0) {
      console.warn('⚠️ No active connections for message sending');
      return;
    }

    // Select random connection
    const connection = activeConnections[Math.floor(Math.random() * activeConnections.length)];

    try {
      let messageResult: MessageResult;

      switch (messageType) {
        case 'text':
          messageResult = await this.sendTextMessage(connection);
          break;
        case 'typing':
          messageResult = await this.sendTypingMessage(connection);
          break;
        case 'system':
          messageResult = await this.sendSystemMessage(connection);
          break;
        case 'delayed':
          messageResult = await this.sendDelayedMessage(connection);
          break;
        default:
          messageResult = await this.sendTextMessage(connection);
      }

      this.messageResults.set(messageResult.id, messageResult);
      connection.messagesSent++;

    } catch (error) {
      console.error(`❌ Failed to send ${messageType} message:`, error);
    }
  }

  private selectMessageType(): string {
    const types = this.config.messageTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  private async sendTextMessage(connection: ConnectionContext): Promise<MessageResult> {
    const messageId = `msg_${++this.messageCounter}`;
    const content = this.generateMessageContent();

    const message = {
      type: 'message',
      id: messageId,
      data: {
        content,
        messageType: 'text',
        senderName: `FloodUser_${connection.userId}`,
        metadata: {
          floodTest: true,
          size: content.length
        }
      },
      timestamp: Date.now()
    };

    const sentAt = performance.now();

    if (connection.websocket.readyState === WebSocket.OPEN) {
      connection.websocket.send(JSON.stringify(message));
    } else {
      throw new Error('Connection not open');
    }

    return {
      id: messageId,
      type: 'text',
      sentAt,
      delivered: false
    };
  }

  private async sendTypingMessage(connection: ConnectionContext): Promise<MessageResult> {
    const messageId = `typing_${++this.messageCounter}`;
    const isStart = Math.random() > 0.5;

    const message = {
      type: 'event',
      data: {
        type: isStart ? 'typing_start' : 'typing_stop',
        userId: connection.userId,
        conversationId: connection.conversationId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    const sentAt = performance.now();

    if (connection.websocket.readyState === WebSocket.OPEN) {
      connection.websocket.send(JSON.stringify(message));
    } else {
      throw new Error('Connection not open');
    }

    return {
      id: messageId,
      type: 'typing',
      sentAt,
      delivered: false
    };
  }

  private async sendSystemMessage(connection: ConnectionContext): Promise<MessageResult> {
    const messageId = `system_${++this.messageCounter}`;

    const message = {
      type: 'event',
      data: {
        type: 'system_notification',
        message: 'Flood test system message',
        priority: 'normal',
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    const sentAt = performance.now();

    if (connection.websocket.readyState === WebSocket.OPEN) {
      connection.websocket.send(JSON.stringify(message));
    } else {
      throw new Error('Connection not open');
    }

    return {
      id: messageId,
      type: 'system',
      sentAt,
      delivered: false
    };
  }

  private async sendDelayedMessage(connection: ConnectionContext): Promise<MessageResult> {
    if (!this.config.includeDelayedMessages) {
      return this.sendTextMessage(connection);
    }

    const messageId = `delayed_${++this.messageCounter}`;
    const delaySeconds = Math.floor(Math.random() * 30) + 1; // 1-30 seconds

    try {
      const response = await fetch(`${this.config.targetUrl}/api/delayed-messages/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : ''
        },
        body: JSON.stringify({
          messageId,
          delaySeconds,
          event: {
            type: 'delayed_message',
            conversationId: connection.conversationId,
            data: {
              content: 'Delayed flood test message',
              originalTimestamp: Date.now()
            }
          }
        })
      });

      const sentAt = performance.now();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        id: messageId,
        type: 'delayed',
        sentAt,
        delivered: false
      };

    } catch (error) {
      throw new Error(`Delayed message failed: ${error.message}`);
    }
  }

  private generateMessageContent(): string {
    const targetSize = this.config.messageSize;
    const baseMessage = 'This is a flood test message with controlled size for performance testing. ';
    let content = baseMessage;

    while (content.length < targetSize) {
      content += `${Math.random().toString(36).substring(2)} `;
    }

    return content.substring(0, targetSize);
  }

  private async waitForMessageDelivery(): Promise<void> {
    console.log('⏳ Waiting for message delivery...');

    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // Check every second
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      const deliveredMessages = Array.from(this.messageResults.values()).filter(m => m.delivered).length;
      const totalMessages = this.messageResults.size;
      const deliveryRate = totalMessages > 0 ? deliveredMessages / totalMessages : 0;

      console.log(`📬 Delivery progress: ${deliveredMessages}/${totalMessages} (${(deliveryRate * 100).toFixed(1)}%)`);

      if (deliveryRate > 0.95) { // 95% delivery rate
        console.log('✅ Message delivery threshold reached');
        break;
      }

      await this.sleep(checkInterval);
      waitTime += checkInterval;
    }
  }

  private estimateQueueDepth(): number {
    // In a real implementation, this would query actual system queue depth
    const undeliveredMessages = Array.from(this.messageResults.values()).filter(m => !m.delivered).length;
    return undeliveredMessages;
  }

  private calculateCurrentLatency(): number {
    const recentDelivered = Array.from(this.messageResults.values())
      .filter(m => m.delivered && m.latency)
      .slice(-100); // Last 100 delivered messages

    if (recentDelivered.length === 0) return 0;

    const totalLatency = recentDelivered.reduce((sum, m) => sum + (m.latency || 0), 0);
    return totalLatency / recentDelivered.length;
  }

  private analyzeResults(): void {
    console.log('🔍 Analyzing message flood results');

    const testDuration = performance.now() - this.testStartTime;
    const deliveredMessages = Array.from(this.messageResults.values()).filter(m => m.delivered);
    const totalMessagesSent = this.messageResults.size;
    const totalMessagesReceived = deliveredMessages.length;

    // Calculate delivery rate and latencies
    const deliveryRate = totalMessagesSent > 0 ? totalMessagesReceived / totalMessagesSent : 0;
    const latencies = deliveredMessages.map(m => m.latency!).filter(l => l !== undefined);

    // Update summary
    this.results.summary = {
      totalMessagesSent,
      totalMessagesReceived,
      messagesSentPerSecond: (totalMessagesSent / testDuration) * 1000,
      messagesReceivedPerSecond: (totalMessagesReceived / testDuration) * 1000,
      testDuration,
      deliveryRate,
      averageLatency: latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0,
      peakLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      systemOverloaded: deliveryRate < 0.8 // System overloaded if delivery rate < 80%
    };

    // Analyze by message type
    this.analyzeMessageTypes();

    // Analyze system behavior
    this.analyzeSystemBehavior();

    // Update performance metrics
    this.updatePerformanceMetrics();

    // Generate recommendations
    this.generateRecommendations();
  }

  private analyzeMessageTypes(): void {
    const typeStats: { [type: string]: any } = {};

    for (const messageType of this.config.messageTypes) {
      const messagesOfType = Array.from(this.messageResults.values()).filter(m => m.type === messageType);
      const deliveredOfType = messagesOfType.filter(m => m.delivered);
      const latenciesOfType = deliveredOfType.map(m => m.latency!).filter(l => l !== undefined);

      typeStats[messageType] = {
        sent: messagesOfType.length,
        received: deliveredOfType.length,
        averageLatency: latenciesOfType.length > 0 ? latenciesOfType.reduce((sum, l) => sum + l, 0) / latenciesOfType.length : 0,
        errorRate: messagesOfType.length > 0 ? (messagesOfType.length - deliveredOfType.length) / messagesOfType.length : 0
      };
    }

    this.results.messageTypes = typeStats;
  }

  private analyzeSystemBehavior(): void {
    const throughputData = this.throughputHistory;
    const latencyData = Array.from(this.messageResults.values())
      .filter(m => m.delivered && m.latency)
      .map(m => m.latency!);

    // Check for backpressure (increasing queue depth)
    const backpressure = throughputData.length > 10 &&
      throughputData.slice(-5).some(snapshot => snapshot.queueDepth > 1000);

    // Check for latency spikes
    const latencySpikes = latencyData.some(latency => latency > 5000); // 5 second spikes

    // Check for connection drops
    const initialConnections = this.config.concurrentConnections;
    const finalConnections = Array.from(this.connections.values()).filter(c => c.isActive).length;
    const connectionDrops = (initialConnections - finalConnections) / initialConnections > 0.1; // 10% drop

    this.results.systemBehavior = {
      backpressure,
      queueOverflow: backpressure && throughputData.some(s => s.queueDepth > 10000),
      connectionDrops,
      latencySpikes,
      memoryLeaks: false // Would need actual memory monitoring
    };
  }

  private updatePerformanceMetrics(): void {
    const deliveredMessages = Array.from(this.messageResults.values()).filter(m => m.delivered);
    const latencies = deliveredMessages.map(m => m.latency!).filter(l => l !== undefined);

    this.results.performance = {
      latencies,
      throughputHistory: this.throughputHistory,
      errorRates: this.throughputHistory.map(s => {
        const sent = s.messagesSent;
        const received = s.messagesReceived;
        return sent > 0 ? (sent - received) / sent : 0;
      }),
      queueDepths: this.throughputHistory.map(s => s.queueDepth),
      memoryUsage: [] // Would be populated from actual monitoring
    };
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Delivery rate recommendations
    if (this.results.summary.deliveryRate < 0.9) {
      recommendations.push('📈 Improve message delivery rate - consider increasing queue capacity');
      recommendations.push('📈 Implement message prioritization to handle high-priority messages first');
    }

    // Latency recommendations
    if (this.results.summary.averageLatency > 1000) {
      recommendations.push('⚡ Optimize message processing pipeline to reduce latency');
      recommendations.push('⚡ Consider implementing message batching for better throughput');
    }

    // System behavior recommendations
    if (this.results.systemBehavior.backpressure) {
      recommendations.push('🚦 Implement flow control mechanisms to prevent backpressure');
      recommendations.push('🚦 Add automatic scaling based on queue depth');
    }

    if (this.results.systemBehavior.connectionDrops) {
      recommendations.push('🔗 Improve connection stability under high load');
      recommendations.push('🔗 Implement connection pooling and reuse strategies');
    }

    if (this.results.systemBehavior.latencySpikes) {
      recommendations.push('📊 Implement circuit breakers to prevent cascading failures');
      recommendations.push('📊 Add load shedding mechanisms for extreme load scenarios');
    }

    // General recommendations
    recommendations.push('📋 Implement real-time monitoring for message queue health');
    recommendations.push('📋 Set up alerts for message delivery rate degradation');
    recommendations.push('🔄 Consider implementing message replay mechanisms for failed deliveries');

    this.results.recommendations = recommendations;
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up flood test connections');

    const closePromises = Array.from(this.connections.values()).map(async (context) => {
      try {
        if (context.websocket.readyState === WebSocket.OPEN) {
          context.websocket.close(1000, 'Flood test cleanup');
        }
      } catch (error) {
        console.warn(`❌ Cleanup error for ${context.connectionId}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.connections.clear();

    console.log('✅ Flood test cleanup complete');
  }

  private initializeResults(): MessageFloodResults {
    return {
      summary: {
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        messagesSentPerSecond: 0,
        messagesReceivedPerSecond: 0,
        testDuration: 0,
        deliveryRate: 0,
        averageLatency: 0,
        peakLatency: 0,
        systemOverloaded: false
      },
      performance: {
        latencies: [],
        throughputHistory: [],
        errorRates: [],
        queueDepths: [],
        memoryUsage: []
      },
      messageTypes: {},
      systemBehavior: {
        backpressure: false,
        queueOverflow: false,
        connectionDrops: false,
        latencySpikes: false,
        memoryLeaks: false
      },
      recommendations: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =================== Results Export ===================

  async saveResults(): Promise<string | null> {
    if (!this.config.outputFile) return null;

    try {
      const fs = require('fs').promises;
      await fs.writeFile(this.config.outputFile, JSON.stringify(this.results, null, 2));
      return this.config.outputFile;
    } catch (error) {
      console.error('❌ Error saving results:', error);
      return null;
    }
  }
}

// =================== CLI Interface ===================

if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<MessageFloodConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'url') config.targetUrl = value;
    else if (key === 'websocket-url') config.websocketUrl = value;
    else if (key === 'messages') config.totalMessages = parseInt(value);
    else if (key === 'rate') config.messagesPerSecond = parseInt(value);
    else if (key === 'connections') config.concurrentConnections = parseInt(value);
    else if (key === 'size') config.messageSize = parseInt(value);
    else if (key === 'duration') config.testDurationMs = parseInt(value) * 1000;
    else if (key === 'token') config.authToken = value;
    else if (key === 'output') config.outputFile = value;
  }

  async function runMessageFlood() {
    const tester = new MessageFloodTester(config);

    try {
      const results = await tester.runMessageFlood();

      console.log('\n🌊 Message Flood Test Results:');
      console.log('='.repeat(60));
      console.log('Summary:', JSON.stringify(results.summary, null, 2));
      console.log('\n🚨 System Behavior:', JSON.stringify(results.systemBehavior, null, 2));
      console.log('\n💡 Recommendations:');
      results.recommendations.forEach(rec => console.log(`- ${rec}`));

      // Save results if output file specified
      const savedFile = await tester.saveResults();
      if (savedFile) {
        console.log(`\n📁 Detailed results saved to: ${savedFile}`);
      }

    } catch (error) {
      console.error('❌ Message flood test failed:', error);
      process.exit(1);
    }
  }

  runMessageFlood();
}

export { MessageFloodTester, MessageFloodConfig, MessageFloodResults };