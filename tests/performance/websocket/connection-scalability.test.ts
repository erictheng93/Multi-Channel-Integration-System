// WebSocket Connection Scalability Performance Tests
// Tests WebSocket system performance under various load conditions
// including connection limits, memory usage, and throughput measurements

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DurableObjectsTestEnvironment,
  testEnv,
  TestPerformanceMonitor
} from '../../helpers/websocket/durable-objects-test-env';
import {
  WebSocketTestClient,
  WebSocketRoomTestController,
  WebSocketTestClientFactory
} from '../../helpers/websocket/websocket-test-client';
import {
  LoadTestHelper,
  TestAssertions
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '@backend/durable-objects/ConversationRoom';
import { UserConnection } from '@backend/durable-objects/UserConnection';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import { WebSocketBroadcastService } from '@backend/services/websocket-broadcast-service';

describe('WebSocket Connection Scalability Performance', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;
  let memoryMonitor: ReturnType<typeof LoadTestHelper.createMemoryMonitor>;

  beforeEach(async () => {
    testEnv.reset();
    performanceMonitor = new TestPerformanceMonitor();
    memoryMonitor = LoadTestHelper.createMemoryMonitor();

    // Register Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);

    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([])
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      }
    };

    broadcastService = new WebSocketBroadcastService(mockEnv);
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Connection Throughput', () => {
    it('should handle 100 concurrent connections efficiently', async () => {
      const connectionCount = 100;
      const conversationId = 'perf_test_conversation_100';

      memoryMonitor.start();
      performanceMonitor.startTimer('connection_100');

      // Create clients
      const clients = LoadTestHelper.createLoadTestClients(
        connectionCount,
        conversationId,
        'agent'
      );

      // Connect in batches to simulate realistic load
      await LoadTestHelper.connectInBatches(clients, 10, 100);

      const connectionTime = performanceMonitor.endTimer('connection_100');
      const memoryUsage = memoryMonitor.stop();

      // Performance assertions
      expect(connectionTime).toBeLessThan(15000); // Should connect within 15 seconds

      const connectionRate = connectionCount / (connectionTime / 1000);
      expect(connectionRate).toBeGreaterThan(5); // At least 5 connections per second

      // Memory usage should be reasonable
      expect(memoryUsage.peak).toBeLessThan(100 * 1024 * 1024); // Less than 100MB peak

      // Verify all connections are active
      const connectedCount = clients.filter(c => c.isConnected).length;
      expect(connectedCount).toBe(connectionCount);

      console.log(`✅ Connected ${connectionCount} clients in ${connectionTime}ms`);
      console.log(`📊 Connection rate: ${connectionRate.toFixed(2)} connections/sec`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle 500 concurrent connections with acceptable performance', async () => {
      const connectionCount = 500;
      const conversationId = 'perf_test_conversation_500';

      memoryMonitor.start();
      performanceMonitor.startTimer('connection_500');

      const clients = LoadTestHelper.createLoadTestClients(
        connectionCount,
        conversationId,
        'agent'
      );

      // Connect in larger batches for efficiency
      await LoadTestHelper.connectInBatches(clients, 25, 200);

      const connectionTime = performanceMonitor.endTimer('connection_500');
      const memoryUsage = memoryMonitor.stop();

      // More lenient performance requirements for larger scale
      expect(connectionTime).toBeLessThan(60000); // Should connect within 1 minute

      const connectionRate = connectionCount / (connectionTime / 1000);
      expect(connectionRate).toBeGreaterThan(8); // At least 8 connections per second

      // Memory should scale reasonably
      expect(memoryUsage.peak).toBeLessThan(500 * 1024 * 1024); // Less than 500MB peak

      const connectedCount = clients.filter(c => c.isConnected).length;
      expect(connectedCount).toBe(connectionCount);

      console.log(`✅ Connected ${connectionCount} clients in ${connectionTime}ms`);
      console.log(`📊 Connection rate: ${connectionRate.toFixed(2)} connections/sec`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should maintain connection performance across multiple rooms', async () => {
      const roomCount = 10;
      const clientsPerRoom = 20;
      const totalClients = roomCount * clientsPerRoom;

      memoryMonitor.start();
      performanceMonitor.startTimer('multi_room_connections');

      const roomControllers: WebSocketRoomTestController[] = [];

      // Create multiple rooms with clients
      for (let roomIndex = 0; roomIndex < roomCount; roomIndex++) {
        const conversationId = `perf_room_${roomIndex}`;
        const controller = new WebSocketRoomTestController(conversationId);

        const clients = LoadTestHelper.createLoadTestClients(
          clientsPerRoom,
          conversationId,
          'agent'
        );

        clients.forEach(client => controller.addClient(client));
        roomControllers.push(controller);
      }

      // Connect all rooms concurrently
      const connectionPromises = roomControllers.map(controller =>
        controller.connectAllClients()
      );

      await Promise.all(connectionPromises);

      const connectionTime = performanceMonitor.endTimer('multi_room_connections');
      const memoryUsage = memoryMonitor.stop();

      // Verify all connections
      const totalConnectedClients = roomControllers.reduce(
        (total, controller) => total + controller.getRoomStats().connectedClients,
        0
      );

      expect(totalConnectedClients).toBe(totalClients);
      expect(connectionTime).toBeLessThan(30000); // Within 30 seconds

      const connectionRate = totalClients / (connectionTime / 1000);
      expect(connectionRate).toBeGreaterThan(5);

      console.log(`✅ Connected ${totalClients} clients across ${roomCount} rooms`);
      console.log(`📊 Connection rate: ${connectionRate.toFixed(2)} connections/sec`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle connection churn efficiently', async () => {
      const conversationId = 'churn_test_conversation';
      const batchSize = 50;
      const churnCycles = 5;

      performanceMonitor.startTimer('connection_churn');
      memoryMonitor.start();

      for (let cycle = 0; cycle < churnCycles; cycle++) {
        console.log(`🔄 Churn cycle ${cycle + 1}/${churnCycles}`);

        // Create and connect clients
        const clients = LoadTestHelper.createLoadTestClients(
          batchSize,
          conversationId,
          'agent'
        );

        const controller = new WebSocketRoomTestController(conversationId);
        clients.forEach(client => controller.addClient(client));

        // Connect all
        await controller.connectAllClients();

        // Verify connections
        const stats = controller.getRoomStats();
        expect(stats.connectedClients).toBe(batchSize);

        // Disconnect all
        await controller.disconnectAllClients();

        // Verify disconnections
        const finalStats = controller.getRoomStats();
        expect(finalStats.connectedClients).toBe(0);

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const churnTime = performanceMonitor.endTimer('connection_churn');
      const memoryUsage = memoryMonitor.stop();

      const totalOperations = batchSize * churnCycles * 2; // Connect + disconnect
      const operationRate = totalOperations / (churnTime / 1000);

      expect(operationRate).toBeGreaterThan(10); // At least 10 operations per second
      expect(churnTime).toBeLessThan(60000); // Within 1 minute

      console.log(`✅ Completed ${churnCycles} churn cycles with ${batchSize} clients each`);
      console.log(`📊 Operation rate: ${operationRate.toFixed(2)} ops/sec`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Message Throughput Performance', () => {
    it('should handle high-frequency message broadcasting', async () => {
      const clientCount = 25;
      const messagesPerClient = 20;
      const totalMessages = clientCount * messagesPerClient;
      const conversationId = 'throughput_test_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        clientCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      memoryMonitor.start();
      performanceMonitor.startTimer('message_throughput');

      // Simulate concurrent messaging
      const messagingResult = await LoadTestHelper.simulateConcurrentMessaging(
        clients,
        messagesPerClient,
        50 // 50ms interval between messages
      );

      const throughputTime = performanceMonitor.endTimer('message_throughput');
      const memoryUsage = memoryMonitor.stop();

      expect(messagingResult.totalMessages).toBe(totalMessages);
      expect(messagingResult.errors).toBe(0);

      const messageRate = messagingResult.totalMessages / (messagingResult.duration / 1000);
      expect(messageRate).toBeGreaterThan(15); // At least 15 messages per second

      console.log(`✅ Processed ${messagingResult.totalMessages} messages`);
      console.log(`📊 Message rate: ${messageRate.toFixed(2)} messages/sec`);
      console.log(`⏱️ Total duration: ${messagingResult.duration}ms`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should maintain performance under sustained load', async () => {
      const clientCount = 15;
      const sustainedDuration = 30000; // 30 seconds
      const messageInterval = 1000; // 1 message per second per client
      const conversationId = 'sustained_load_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        clientCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      memoryMonitor.start();
      performanceMonitor.startTimer('sustained_load');

      let totalMessagesSent = 0;
      let errors = 0;
      const startTime = Date.now();

      // Create sustained messaging load
      const messagingPromises = clients.map(async (client) => {
        let messageCount = 0;
        const clientInterval = setInterval(async () => {
          try {
            await client.sendChatMessage(`Sustained message ${messageCount++} from ${client.userId}`);
            totalMessagesSent++;
          } catch (error) {
            errors++;
            console.error(`Error sending message from ${client.userId}:`, error);
          }
        }, messageInterval);

        // Stop after sustained duration
        setTimeout(() => {
          clearInterval(clientInterval);
        }, sustainedDuration);

        // Wait for duration plus buffer
        await new Promise(resolve => setTimeout(resolve, sustainedDuration + 1000));
      });

      await Promise.all(messagingPromises);

      const actualDuration = Date.now() - startTime;
      const sustainedTime = performanceMonitor.endTimer('sustained_load');
      const memoryUsage = memoryMonitor.stop();

      const averageRate = totalMessagesSent / (actualDuration / 1000);
      const expectedMessages = clientCount * (sustainedDuration / messageInterval);

      // Should maintain consistent message rate
      expect(averageRate).toBeGreaterThan(clientCount * 0.8); // At least 80% of target rate
      expect(errors / totalMessagesSent).toBeLessThan(0.05); // Less than 5% error rate

      console.log(`✅ Sustained load test completed`);
      console.log(`📊 Average message rate: ${averageRate.toFixed(2)} messages/sec`);
      console.log(`📈 Total messages sent: ${totalMessagesSent}/${expectedMessages.toFixed(0)} expected`);
      console.log(`❌ Error rate: ${((errors / totalMessagesSent) * 100).toFixed(2)}%`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle broadcast distribution efficiently', async () => {
      const roomCount = 5;
      const clientsPerRoom = 15;
      const broadcastCount = 50;
      const totalClients = roomCount * clientsPerRoom;

      // Create multiple rooms
      const roomControllers: WebSocketRoomTestController[] = [];
      for (let i = 0; i < roomCount; i++) {
        const conversationId = `broadcast_perf_room_${i}`;
        const controller = new WebSocketRoomTestController(conversationId);

        const clients = LoadTestHelper.createLoadTestClients(
          clientsPerRoom,
          conversationId,
          'agent'
        );

        clients.forEach(client => controller.addClient(client));
        roomControllers.push(controller);
      }

      // Connect all clients
      await Promise.all(roomControllers.map(controller => controller.connectAllClients()));

      memoryMonitor.start();
      performanceMonitor.startTimer('broadcast_distribution');

      // Send broadcasts to all rooms
      const broadcastPromises: Promise<boolean>[] = [];

      for (let i = 0; i < broadcastCount; i++) {
        // Broadcast to random room
        const randomRoomIndex = i % roomCount;
        const conversationId = `broadcast_perf_room_${randomRoomIndex}`;

        const promise = broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `perf_broadcast_${i}`,
          userId: 'perf_test_user',
          data: {
            content: `Performance broadcast ${i}`,
            broadcastIndex: i
          }
        });

        broadcastPromises.push(promise);
      }

      const results = await Promise.all(broadcastPromises);

      const distributionTime = performanceMonitor.endTimer('broadcast_distribution');
      const memoryUsage = memoryMonitor.stop();

      const successfulBroadcasts = results.filter(r => r === true).length;
      const broadcastRate = successfulBroadcasts / (distributionTime / 1000);

      expect(successfulBroadcasts).toBe(broadcastCount);
      expect(broadcastRate).toBeGreaterThan(5); // At least 5 broadcasts per second

      console.log(`✅ Distributed ${broadcastCount} broadcasts to ${totalClients} clients`);
      console.log(`📊 Broadcast rate: ${broadcastRate.toFixed(2)} broadcasts/sec`);
      console.log(`⏱️ Total distribution time: ${distributionTime}ms`);
      console.log(`💾 Memory usage: Peak ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain reasonable memory usage with many connections', async () => {
      const connectionCount = 200;
      const conversationId = 'memory_test_conversation';

      memoryMonitor.start();

      const clients = LoadTestHelper.createLoadTestClients(
        connectionCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      // Connect in batches
      await LoadTestHelper.connectInBatches(clients, 20, 100);

      // Send some messages to create state
      await LoadTestHelper.simulateConcurrentMessaging(
        clients.slice(0, 10), // Only first 10 clients send messages
        5,
        200
      );

      // Measure memory after activity
      const memoryUsage = memoryMonitor.stop();

      // Memory usage should be reasonable per connection
      const memoryPerConnection = memoryUsage.peak / connectionCount;
      expect(memoryPerConnection).toBeLessThan(1024 * 1024); // Less than 1MB per connection

      // Total memory should be reasonable
      expect(memoryUsage.peak).toBeLessThan(800 * 1024 * 1024); // Less than 800MB total

      console.log(`💾 Memory usage for ${connectionCount} connections:`);
      console.log(`   Peak: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Per connection: ${(memoryPerConnection / 1024).toFixed(2)}KB`);
      console.log(`   Final: ${(memoryUsage.final / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should properly cleanup disconnected clients', async () => {
      const connectionCount = 100;
      const conversationId = 'cleanup_test_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        connectionCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      memoryMonitor.start();

      // Connect all clients
      await controller.connectAllClients();

      // Verify connections
      let stats = controller.getRoomStats();
      expect(stats.connectedClients).toBe(connectionCount);

      // Disconnect half the clients
      const clientsToDisconnect = clients.slice(0, connectionCount / 2);
      await Promise.all(clientsToDisconnect.map(client => client.disconnect()));

      // Verify disconnections
      stats = controller.getRoomStats();
      expect(stats.connectedClients).toBe(connectionCount / 2);

      // Disconnect remaining clients
      await controller.disconnectAllClients();

      // Verify all disconnected
      stats = controller.getRoomStats();
      expect(stats.connectedClients).toBe(0);

      const memoryUsage = memoryMonitor.stop();

      // Memory should be cleaned up
      const memoryReduction = memoryUsage.peak - memoryUsage.final;
      expect(memoryReduction).toBeGreaterThan(0); // Some memory should be freed

      console.log(`🧹 Memory cleanup after disconnections:`);
      console.log(`   Peak: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final: ${(memoryUsage.final / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Freed: ${(memoryReduction / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory pressure gracefully', async () => {
      const connectionCount = 150;
      const messageCount = 30;
      const conversationId = 'memory_pressure_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        connectionCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      memoryMonitor.start();
      performanceMonitor.startTimer('memory_pressure');

      // Connect clients
      await LoadTestHelper.connectInBatches(clients, 25, 50);

      // Generate memory pressure with many messages
      const messagingPromises = clients.slice(0, 20).map(client =>
        LoadTestHelper.simulateConcurrentMessaging([client], messageCount, 50)
      );

      const messagingResults = await Promise.all(messagingPromises);

      const pressureTime = performanceMonitor.endTimer('memory_pressure');
      const memoryUsage = memoryMonitor.stop();

      // Calculate total messages processed
      const totalMessages = messagingResults.reduce(
        (total, result) => total + result.totalMessages,
        0
      );

      const totalErrors = messagingResults.reduce(
        (total, result) => total + result.errors,
        0
      );

      // Should handle pressure without excessive errors
      const errorRate = totalErrors / totalMessages;
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate

      // Memory usage should stabilize
      expect(memoryUsage.final).toBeLessThan(memoryUsage.peak * 1.2); // Within 20% of peak

      console.log(`🔥 Memory pressure test results:`);
      console.log(`   Processed ${totalMessages} messages with ${totalErrors} errors`);
      console.log(`   Error rate: ${(errorRate * 100).toFixed(2)}%`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final memory: ${(memoryUsage.final / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Latency Performance', () => {
    it('should maintain low latency under load', async () => {
      const clientCount = 50;
      const messageCount = 10;
      const conversationId = 'latency_test_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        clientCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      const latencyMeasurements: number[] = [];

      // Measure message broadcast latency
      for (let i = 0; i < messageCount; i++) {
        const sender = clients[i % clientCount];
        const receivers = clients.filter(c => c !== sender);

        performanceMonitor.startTimer(`message_latency_${i}`);

        // Send message
        const messageId = await sender.sendChatMessage(`Latency test message ${i}`);

        // Wait for first receiver to get the message
        if (receivers.length > 0) {
          await TestAssertions.assertEventReceived(receivers[0], 'message_sent', 5000);
        }

        const latency = performanceMonitor.endTimer(`message_latency_${i}`);
        latencyMeasurements.push(latency);

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze latency metrics
      const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
      const maxLatency = Math.max(...latencyMeasurements);
      const minLatency = Math.min(...latencyMeasurements);

      const sortedLatencies = latencyMeasurements.sort((a, b) => a - b);
      const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

      // Latency assertions
      expect(avgLatency).toBeLessThan(500); // Average < 500ms
      expect(p95Latency).toBeLessThan(1000); // P95 < 1s
      expect(p99Latency).toBeLessThan(2000); // P99 < 2s

      console.log(`⚡ Latency performance results:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min: ${minLatency.toFixed(2)}ms`);
      console.log(`   Max: ${maxLatency.toFixed(2)}ms`);
      console.log(`   P95: ${p95Latency.toFixed(2)}ms`);
      console.log(`   P99: ${p99Latency.toFixed(2)}ms`);
    });

    it('should maintain consistent performance across time', async () => {
      const clientCount = 30;
      const testDuration = 15000; // 15 seconds
      const measurementInterval = 1000; // Every second
      const conversationId = 'consistency_test_conversation';

      const clients = LoadTestHelper.createLoadTestClients(
        clientCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      const performanceMeasurements: Array<{
        timestamp: number;
        latency: number;
        throughput: number;
      }> = [];

      const startTime = Date.now();
      let messageCounter = 0;

      // Measure performance consistently over time
      const measurementPromise = new Promise<void>((resolve) => {
        const measurementTimer = setInterval(async () => {
          const currentTime = Date.now();

          if (currentTime - startTime >= testDuration) {
            clearInterval(measurementTimer);
            resolve();
            return;
          }

          // Measure latency with a test message
          const sender = clients[messageCounter % clientCount];
          const receiver = clients[(messageCounter + 1) % clientCount];

          performanceMonitor.startTimer(`consistency_${messageCounter}`);

          await sender.sendChatMessage(`Consistency test ${messageCounter}`);
          await TestAssertions.assertEventReceived(receiver, 'message_sent', 3000);

          const latency = performanceMonitor.endTimer(`consistency_${messageCounter}`);

          // Calculate throughput (messages processed in this interval)
          const throughput = 1000 / measurementInterval; // 1 message per interval

          performanceMeasurements.push({
            timestamp: currentTime - startTime,
            latency,
            throughput
          });

          messageCounter++;
        }, measurementInterval);
      });

      await measurementPromise;

      // Analyze consistency
      const latencies = performanceMeasurements.map(m => m.latency);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const latencyStdDev = Math.sqrt(
        latencies.reduce((sum, lat) => sum + Math.pow(lat - avgLatency, 2), 0) / latencies.length
      );

      const latencyVariation = (latencyStdDev / avgLatency) * 100;

      // Performance should be consistent
      expect(latencyVariation).toBeLessThan(50); // Less than 50% variation
      expect(avgLatency).toBeLessThan(500); // Average latency acceptable

      console.log(`📊 Performance consistency over ${testDuration / 1000}s:`);
      console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Latency std dev: ${latencyStdDev.toFixed(2)}ms`);
      console.log(`   Latency variation: ${latencyVariation.toFixed(2)}%`);
      console.log(`   Measurements taken: ${performanceMeasurements.length}`);
    });
  });

  describe('Scalability Limits', () => {
    it('should identify connection limits gracefully', async () => {
      const conversationId = 'limits_test_conversation';
      const maxAttempts = 1000; // Try to connect up to 1000 clients
      const batchSize = 50;

      let successfulConnections = 0;
      let lastSuccessfulBatch = 0;

      memoryMonitor.start();

      for (let batch = 0; batch < maxAttempts / batchSize; batch++) {
        const clients = LoadTestHelper.createLoadTestClients(
          batchSize,
          conversationId,
          'agent'
        );

        try {
          performanceMonitor.startTimer(`batch_${batch}`);

          await LoadTestHelper.connectInBatches(clients, 10, 50);

          const batchTime = performanceMonitor.endTimer(`batch_${batch}`);
          const connectedCount = clients.filter(c => c.isConnected).length;

          successfulConnections += connectedCount;

          if (connectedCount === batchSize) {
            lastSuccessfulBatch = batch;
            console.log(`✅ Batch ${batch}: ${connectedCount}/${batchSize} connected (${batchTime}ms)`);
          } else {
            console.log(`⚠️ Batch ${batch}: Only ${connectedCount}/${batchSize} connected`);
            break; // Stop if we can't connect a full batch
          }

          // Check if performance is degrading significantly
          if (batchTime > 10000) { // More than 10 seconds per batch
            console.log(`⚠️ Performance degraded, stopping at batch ${batch}`);
            break;
          }

        } catch (error) {
          console.log(`❌ Batch ${batch} failed: ${error}`);
          break;
        }
      }

      const memoryUsage = memoryMonitor.stop();

      console.log(`🎯 Scalability limits identified:`);
      console.log(`   Successful connections: ${successfulConnections}`);
      console.log(`   Last successful batch: ${lastSuccessfulBatch}`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory per connection: ${(memoryUsage.peak / successfulConnections / 1024).toFixed(2)}KB`);

      // Should handle at least 100 connections
      expect(successfulConnections).toBeGreaterThan(100);
    });

    it('should handle gradual performance degradation', async () => {
      const conversationId = 'degradation_test_conversation';
      const initialClients = 25;
      const incrementSize = 25;
      const maxIncrements = 8;

      const performanceResults: Array<{
        clientCount: number;
        connectionTime: number;
        messageLatency: number;
        memoryUsage: number;
      }> = [];

      for (let increment = 0; increment < maxIncrements; increment++) {
        const clientCount = initialClients + (increment * incrementSize);
        console.log(`📈 Testing with ${clientCount} clients...`);

        memoryMonitor.start();
        performanceMonitor.startTimer(`degradation_${clientCount}`);

        const clients = LoadTestHelper.createLoadTestClients(
          clientCount,
          conversationId,
          'agent'
        );

        const controller = new WebSocketRoomTestController(conversationId);
        clients.forEach(client => controller.addClient(client));

        // Connect clients
        await LoadTestHelper.connectInBatches(clients, 10, 100);

        const connectionTime = performanceMonitor.endTimer(`degradation_${clientCount}`);

        // Measure message latency
        performanceMonitor.startTimer(`latency_${clientCount}`);

        const sender = clients[0];
        const receiver = clients[1];
        await sender.sendChatMessage(`Degradation test with ${clientCount} clients`);
        await TestAssertions.assertEventReceived(receiver, 'message_sent', 5000);

        const messageLatency = performanceMonitor.endTimer(`latency_${clientCount}`);
        const memoryUsage = memoryMonitor.stop();

        performanceResults.push({
          clientCount,
          connectionTime,
          messageLatency,
          memoryUsage: memoryUsage.peak
        });

        // Disconnect all clients before next iteration
        await controller.disconnectAllClients();

        console.log(`   Connection time: ${connectionTime}ms`);
        console.log(`   Message latency: ${messageLatency}ms`);
        console.log(`   Memory usage: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      }

      // Analyze degradation patterns
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];

      const connectionTimeDegradation = lastResult.connectionTime / firstResult.connectionTime;
      const latencyDegradation = lastResult.messageLatency / firstResult.messageLatency;
      const memoryGrowth = lastResult.memoryUsage / firstResult.memoryUsage;

      console.log(`📉 Performance degradation analysis:`);
      console.log(`   Connection time: ${connectionTimeDegradation.toFixed(2)}x slower`);
      console.log(`   Message latency: ${latencyDegradation.toFixed(2)}x slower`);
      console.log(`   Memory usage: ${memoryGrowth.toFixed(2)}x larger`);

      // Degradation should be reasonable
      expect(connectionTimeDegradation).toBeLessThan(5); // No more than 5x slower
      expect(latencyDegradation).toBeLessThan(3); // No more than 3x slower
      expect(memoryGrowth).toBeGreaterThan(1); // Memory should grow with connections
    });
  });
});