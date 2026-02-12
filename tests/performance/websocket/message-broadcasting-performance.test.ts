// Message Broadcasting Performance Tests
// Tests performance characteristics of the WebSocket broadcasting system
// including throughput, latency, and scalability under various conditions

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
  TestDataFactory,
  LoadTestHelper
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '@backend/durable-objects/ConversationRoom';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import { WebSocketBroadcastService } from '@backend/services/websocket-broadcast-service';
import type { DurableObjectEvent } from '@backend/types/websocket-types';

describe('Message Broadcasting Performance', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;
  let memoryMonitor: ReturnType<typeof LoadTestHelper.createMemoryMonitor>;

  beforeEach(async () => {
    testEnv.reset();
    performanceMonitor = new TestPerformanceMonitor();
    memoryMonitor = LoadTestHelper.createMemoryMonitor();

    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);

    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                { id: 'user_1', teamId: 1 },
                { id: 'user_2', teamId: 1 },
                { id: 'user_3', teamId: 2 }
              ])
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'websocket_migration_config') {
            return JSON.stringify(TestDataFactory.createMigrationConfig());
          }
          return null;
        }),
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

  describe('Single Message Broadcasting Performance', () => {
    test('should broadcast messages with low latency', async () => {
      const roomSizes = [10, 25, 50, 100];
      const latencyResults: Array<{ roomSize: number; avgLatency: number; p95Latency: number }> = [];

      for (const roomSize of roomSizes) {
        console.log(`🎯 Testing broadcast latency with ${roomSize} participants`);

        const conversationId = `latency_test_${roomSize}`;
        const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

        // Add more clients to reach target room size
        const additionalClients = Math.max(0, roomSize - 4); // Account for existing admin, team, agents
        const extraClients = WebSocketTestClientFactory.createClients(additionalClients, {
          conversationId,
          role: 'agent'
        });

        extraClients.forEach(client => controller.addClient(client));
        await controller.connectAllClients();

        const latencies: number[] = [];
        const measurementCount = 10;

        // Measure broadcast latency multiple times
        for (let i = 0; i < measurementCount; i++) {
          performanceMonitor.startTimer(`broadcast_latency_${roomSize}_${i}`);

          const success = await broadcastService.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: conversationId,
            messageId: `latency_msg_${i}`,
            userId: 'test_user',
            data: {
              content: `Latency test message ${i}`,
              timestamp: Date.now()
            }
          });

          const latency = performanceMonitor.endTimer(`broadcast_latency_${roomSize}_${i}`);
          latencies.push(latency);

          expect(success).toBe(true);

          // Small delay between measurements
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const sortedLatencies = latencies.sort((a, b) => a - b);
        const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

        latencyResults.push({ roomSize, avgLatency, p95Latency });

        console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`   P95 latency: ${p95Latency.toFixed(2)}ms`);

        await controller.disconnectAllClients();
      }

      // Analyze latency scaling
      latencyResults.forEach(result => {
        expect(result.avgLatency).toBeLessThan(1000); // < 1 second average
        expect(result.p95Latency).toBeLessThan(2000); // < 2 seconds P95
      });

      console.log(`📊 Latency scaling summary:`);
      latencyResults.forEach(result => {
        console.log(`   ${result.roomSize} participants: ${result.avgLatency.toFixed(2)}ms avg, ${result.p95Latency.toFixed(2)}ms P95`);
      });
    });

    test('should maintain throughput under increasing load', async () => {
      const throughputTests = [
        { messageCount: 50, intervalMs: 100 },
        { messageCount: 100, intervalMs: 50 },
        { messageCount: 200, intervalMs: 25 }
      ];

      const conversationId = 'throughput_test_conversation';
      const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      // Add more participants for realistic load
      const extraClients = WebSocketTestClientFactory.createClients(20, {
        conversationId,
        role: 'agent'
      });

      extraClients.forEach(client => controller.addClient(client));
      await controller.connectAllClients();

      for (const test of throughputTests) {
        console.log(`⚡ Testing throughput: ${test.messageCount} messages, ${test.intervalMs}ms interval`);

        memoryMonitor.start();
        performanceMonitor.startTimer(`throughput_${test.messageCount}_${test.intervalMs}`);

        const promises: Promise<boolean>[] = [];
        let successCount = 0;
        let errorCount = 0;

        // Send messages at specified interval
        for (let i = 0; i < test.messageCount; i++) {
          const promise = broadcastService.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: conversationId,
            messageId: `throughput_msg_${i}`,
            userId: `user_${i % 5}`,
            data: {
              content: `Throughput test message ${i}`,
              testParams: test
            }
          }).then(success => {
            if (success) successCount++;
            else errorCount++;
            return success;
          });

          promises.push(promise);

          // Wait for interval
          if (i < test.messageCount - 1) {
            await new Promise(resolve => setTimeout(resolve, test.intervalMs));
          }
        }

        // Wait for all broadcasts to complete
        await Promise.all(promises);

        const throughputTime = performanceMonitor.endTimer(`throughput_${test.messageCount}_${test.intervalMs}`);
        const memoryUsage = memoryMonitor.stop();

        const actualThroughput = successCount / (throughputTime / 1000);
        const expectedThroughput = 1000 / test.intervalMs; // theoretical max
        const efficiency = (actualThroughput / expectedThroughput) * 100;

        console.log(`   Successful: ${successCount}/${test.messageCount}`);
        console.log(`   Throughput: ${actualThroughput.toFixed(2)} messages/sec`);
        console.log(`   Efficiency: ${efficiency.toFixed(1)}%`);
        console.log(`   Memory peak: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

        // Performance expectations
        expect(successCount / test.messageCount).toBeGreaterThan(0.95); // 95% success rate
        expect(efficiency).toBeGreaterThan(50); // At least 50% efficiency
      }
    });

    test('should handle burst traffic efficiently', async () => {
      const burstSize = 100;
      const burstCount = 5;
      const burstInterval = 2000; // 2 seconds between bursts
      const conversationId = 'burst_test_conversation';

      const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);
      await controller.connectAllClients();

      memoryMonitor.start();
      performanceMonitor.startTimer('burst_traffic');

      const allResults: Array<{ burstIndex: number; successCount: number; duration: number }> = [];

      for (let burstIndex = 0; burstIndex < burstCount; burstIndex++) {
        console.log(`💥 Burst ${burstIndex + 1}/${burstCount}: ${burstSize} messages`);

        const burstStartTime = Date.now();

        // Send burst of messages simultaneously
        const burstPromises = Array.from({ length: burstSize }, (_, i) =>
          broadcastService.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: conversationId,
            messageId: `burst_${burstIndex}_${i}`,
            userId: `burst_user_${i % 3}`,
            data: {
              content: `Burst message ${i}`,
              burstIndex,
              messageIndex: i
            }
          })
        );

        const burstResults = await Promise.all(burstPromises);
        const burstDuration = Date.now() - burstStartTime;

        const successCount = burstResults.filter(r => r === true).length;
        const burstThroughput = successCount / (burstDuration / 1000);

        allResults.push({ burstIndex, successCount, duration: burstDuration });

        console.log(`   Success: ${successCount}/${burstSize}`);
        console.log(`   Duration: ${burstDuration}ms`);
        console.log(`   Throughput: ${burstThroughput.toFixed(2)} messages/sec`);

        // Performance expectations per burst
        expect(successCount / burstSize).toBeGreaterThan(0.9); // 90% success rate
        expect(burstDuration).toBeLessThan(10000); // Complete within 10 seconds

        // Wait before next burst
        if (burstIndex < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      const totalTime = performanceMonitor.endTimer('burst_traffic');
      const memoryUsage = memoryMonitor.stop();

      // Overall performance analysis
      const totalMessages = burstSize * burstCount;
      const totalSuccessful = allResults.reduce((sum, result) => sum + result.successCount, 0);
      const overallThroughput = totalSuccessful / (totalTime / 1000);

      console.log(`🎯 Burst traffic summary:`);
      console.log(`   Total messages: ${totalMessages}`);
      console.log(`   Total successful: ${totalSuccessful}`);
      console.log(`   Overall throughput: ${overallThroughput.toFixed(2)} messages/sec`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(totalSuccessful / totalMessages).toBeGreaterThan(0.9);
    });
  });

  describe('Multi-Room Broadcasting Performance', () => {
    test('should scale broadcast distribution across multiple rooms', async () => {
      const roomCounts = [5, 10, 20];
      const clientsPerRoom = 15;
      const messagesPerRoom = 10;

      const scalingResults: Array<{
        roomCount: number;
        totalClients: number;
        totalMessages: number;
        distributionTime: number;
        throughput: number;
      }> = [];

      for (const roomCount of roomCounts) {
        console.log(`🏢 Testing ${roomCount} rooms with ${clientsPerRoom} clients each`);

        // Create multiple rooms
        const controllers: WebSocketRoomTestController[] = [];
        const conversationIds: string[] = [];

        for (let i = 0; i < roomCount; i++) {
          const conversationId = `multi_room_${roomCount}_${i}`;
          conversationIds.push(conversationId);

          const controller = new WebSocketRoomTestController(conversationId);
          const clients = WebSocketTestClientFactory.createClients(clientsPerRoom, {
            conversationId,
            role: 'agent'
          });

          clients.forEach(client => controller.addClient(client));
          controllers.push(controller);
        }

        // Connect all clients
        await Promise.all(controllers.map(controller => controller.connectAllClients()));

        memoryMonitor.start();
        performanceMonitor.startTimer(`multi_room_${roomCount}`);

        // Broadcast messages to all rooms
        const broadcastPromises: Promise<boolean>[] = [];

        conversationIds.forEach((conversationId, roomIndex) => {
          for (let msgIndex = 0; msgIndex < messagesPerRoom; msgIndex++) {
            const promise = broadcastService.broadcastMessageEvent({
              type: 'message_sent',
              conversationId: conversationId,
              messageId: `multi_room_msg_${roomIndex}_${msgIndex}`,
              userId: `user_${roomIndex}`,
              data: {
                content: `Multi-room message ${msgIndex} for room ${roomIndex}`,
                roomIndex,
                messageIndex: msgIndex
              }
            });

            broadcastPromises.push(promise);
          }
        });

        const results = await Promise.all(broadcastPromises);

        const distributionTime = performanceMonitor.endTimer(`multi_room_${roomCount}`);
        const memoryUsage = memoryMonitor.stop();

        const successfulBroadcasts = results.filter(r => r === true).length;
        const totalMessages = roomCount * messagesPerRoom;
        const totalClients = roomCount * clientsPerRoom;
        const throughput = successfulBroadcasts / (distributionTime / 1000);

        scalingResults.push({
          roomCount,
          totalClients,
          totalMessages,
          distributionTime,
          throughput
        });

        console.log(`   Successful broadcasts: ${successfulBroadcasts}/${totalMessages}`);
        console.log(`   Distribution time: ${distributionTime}ms`);
        console.log(`   Throughput: ${throughput.toFixed(2)} messages/sec`);
        console.log(`   Memory usage: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

        // Performance expectations
        expect(successfulBroadcasts / totalMessages).toBeGreaterThan(0.95);
        expect(distributionTime).toBeLessThan(30000); // Within 30 seconds

        // Disconnect all clients
        await Promise.all(controllers.map(controller => controller.disconnectAllClients()));
      }

      // Analyze scaling characteristics
      console.log(`📈 Multi-room scaling analysis:`);
      scalingResults.forEach((result, index) => {
        console.log(`   ${result.roomCount} rooms: ${result.throughput.toFixed(2)} msg/sec, ${result.distributionTime}ms`);

        if (index > 0) {
          const previousResult = scalingResults[index - 1];
          const scalingFactor = result.roomCount / previousResult.roomCount;
          const performanceRatio = result.throughput / previousResult.throughput;
          console.log(`     Scaling efficiency: ${(performanceRatio / scalingFactor * 100).toFixed(1)}%`);
        }
      });
    });

    test('should efficiently handle cross-room event distribution', async () => {
      const roomCount = 8;
      const clientsPerRoom = 10;
      const crossRoomEvents = 25;

      // Create rooms
      const controllers: WebSocketRoomTestController[] = [];
      const conversationIds: string[] = [];

      for (let i = 0; i < roomCount; i++) {
        const conversationId = `cross_room_${i}`;
        conversationIds.push(conversationId);

        const controller = new WebSocketRoomTestController(conversationId);
        const clients = WebSocketTestClientFactory.createClients(clientsPerRoom, {
          conversationId,
          role: 'agent'
        });

        clients.forEach(client => controller.addClient(client));
        controllers.push(controller);
      }

      await Promise.all(controllers.map(controller => controller.connectAllClients()));

      memoryMonitor.start();
      performanceMonitor.startTimer('cross_room_distribution');

      // Send events that affect multiple rooms
      const eventPromises: Promise<boolean>[] = [];

      for (let i = 0; i < crossRoomEvents; i++) {
        // Presence events (broadcast to multiple rooms)
        const presencePromise = broadcastService.broadcastPresenceEvent({
          type: 'agent_available',
          userId: `cross_room_user_${i}`,
          teamId: 1,
          data: {
            status: 'available',
            capacity: 5,
            eventIndex: i
          }
        });

        eventPromises.push(presencePromise);

        // Team announcements (broadcast to team members across rooms)
        if (i % 3 === 0) {
          const event = TestDataFactory.createEvent({
            type: 'team_announcement',
            data: {
              message: `Cross-room announcement ${i}`,
              teamId: 1,
              priority: 'normal'
            }
          });

          // Use MessageBroadcaster for team-wide distribution
          const broadcasterNamespace = testEnv.getNamespace('MESSAGE_BROADCASTER');
          const broadcasterId = broadcasterNamespace.idFromName('global');
          const broadcasterStub = broadcasterNamespace.get(broadcasterId);

          const teamPromise = broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-to-teams', {
            method: 'POST',
            body: JSON.stringify({
              event,
              teamIds: [1]
            }),
            headers: { 'Content-Type': 'application/json' }
          })).then(response => response.ok);

          eventPromises.push(teamPromise);
        }
      }

      const results = await Promise.all(eventPromises);

      const distributionTime = performanceMonitor.endTimer('cross_room_distribution');
      const memoryUsage = memoryMonitor.stop();

      const successfulEvents = results.filter(r => r === true).length;
      const eventThroughput = successfulEvents / (distributionTime / 1000);

      console.log(`🌐 Cross-room distribution results:`);
      console.log(`   Successful events: ${successfulEvents}/${results.length}`);
      console.log(`   Distribution time: ${distributionTime}ms`);
      console.log(`   Event throughput: ${eventThroughput.toFixed(2)} events/sec`);
      console.log(`   Memory usage: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(successfulEvents / results.length).toBeGreaterThan(0.9);
      expect(distributionTime).toBeLessThan(15000);

      await Promise.all(controllers.map(controller => controller.disconnectAllClients()));
    });
  });

  describe('Batch Broadcasting Performance', () => {
    test('should optimize batch message delivery', async () => {
      const batchSizes = [10, 25, 50, 100];
      const conversationId = 'batch_optimization_test';

      const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      // Add more clients for realistic load
      const extraClients = WebSocketTestClientFactory.createClients(15, {
        conversationId,
        role: 'agent'
      });

      extraClients.forEach(client => controller.addClient(client));
      await controller.connectAllClients();

      const batchResults: Array<{
        batchSize: number;
        processingTime: number;
        throughput: number;
        efficiency: number;
      }> = [];

      for (const batchSize of batchSizes) {
        console.log(`📦 Testing batch delivery: ${batchSize} events`);

        // Create batch of events
        const batchEvents: DurableObjectEvent[] = Array.from({ length: batchSize }, (_, i) =>
          TestDataFactory.createEvent({
            type: 'message_sent',
            conversationId: conversationId,
            userId: `batch_user_${i % 3}`,
            data: {
              content: `Batch message ${i}`,
              batchIndex: i,
              batchSize: batchSize
            }
          })
        );

        memoryMonitor.start();
        performanceMonitor.startTimer(`batch_${batchSize}`);

        // Process batch
        const batchResult = await broadcastService.broadcastBatch(batchEvents);

        const processingTime = performanceMonitor.endTimer(`batch_${batchSize}`);
        const memoryUsage = memoryMonitor.stop();

        const throughput = batchResult.successful / (processingTime / 1000);
        const efficiency = (batchResult.successful / batchSize) * 100;

        batchResults.push({
          batchSize,
          processingTime,
          throughput,
          efficiency
        });

        console.log(`   Successful: ${batchResult.successful}/${batchSize}`);
        console.log(`   Processing time: ${processingTime}ms`);
        console.log(`   Throughput: ${throughput.toFixed(2)} events/sec`);
        console.log(`   Efficiency: ${efficiency.toFixed(1)}%`);
        console.log(`   Memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

        expect(efficiency).toBeGreaterThan(90); // 90% efficiency
        expect(processingTime).toBeLessThan(batchSize * 100); // < 100ms per event
      }

      // Analyze batch optimization
      console.log(`📊 Batch processing optimization:`);
      batchResults.forEach((result, index) => {
        const avgTimePerEvent = result.processingTime / result.batchSize;
        console.log(`   ${result.batchSize} events: ${avgTimePerEvent.toFixed(2)}ms per event`);

        if (index > 0) {
          const previousResult = batchResults[index - 1];
          const prevAvgTime = previousResult.processingTime / previousResult.batchSize;
          const optimization = ((prevAvgTime - avgTimePerEvent) / prevAvgTime * 100);
          if (optimization > 0) {
            console.log(`     ${optimization.toFixed(1)}% faster per event than ${previousResult.batchSize}-batch`);
          }
        }
      });
    });

    test('should handle mixed event type batches efficiently', async () => {
      const batchSize = 50;
      const conversationId = 'mixed_batch_test';

      const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);
      await controller.connectAllClients();

      // Create mixed batch with different event types
      const mixedBatch: DurableObjectEvent[] = [];

      for (let i = 0; i < batchSize; i++) {
        let event: DurableObjectEvent;

        switch (i % 4) {
          case 0:
            event = TestDataFactory.createEvent({
              type: 'message_sent',
              conversationId: conversationId,
              data: { content: `Mixed message ${i}` }
            });
            break;
          case 1:
            event = TestDataFactory.createTypingEvent(
              `user_${i}`,
              conversationId,
              true
            );
            break;
          case 2:
            event = TestDataFactory.createConversationEvent(
              'conversation_status_changed',
              conversationId,
              { status: 'active', changedBy: `user_${i}` }
            );
            break;
          case 3:
            event = TestDataFactory.createDelayedMessageEvent(
              'delayed_message_countdown',
              `msg_${i}`,
              conversationId,
              `agent_${i}`,
              { remainingSeconds: 30 }
            );
            break;
          default:
            event = TestDataFactory.createEvent({
              type: 'system_notification',
              conversationId: conversationId,
              data: { message: `System event ${i}` }
            });
        }

        mixedBatch.push(event);
      }

      memoryMonitor.start();
      performanceMonitor.startTimer('mixed_batch');

      const batchResult = await broadcastService.broadcastBatch(mixedBatch);

      const processingTime = performanceMonitor.endTimer('mixed_batch');
      const memoryUsage = memoryMonitor.stop();

      const throughput = batchResult.successful / (processingTime / 1000);
      const successRate = (batchResult.successful / batchSize) * 100;

      console.log(`🎭 Mixed event batch results:`);
      console.log(`   Batch size: ${batchSize} events`);
      console.log(`   Successful: ${batchResult.successful}`);
      console.log(`   Failed: ${batchResult.failed}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Processing time: ${processingTime}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} events/sec`);
      console.log(`   Memory usage: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(successRate).toBeGreaterThan(85); // 85% success rate for mixed batch
      expect(throughput).toBeGreaterThan(5); // At least 5 events per second
    });
  });

  describe('Performance Under Stress', () => {
    test('should maintain performance during sustained high load', async () => {
      const duration = 30000; // 30 seconds
      const messageRate = 5; // messages per second
      const roomCount = 3;
      const clientsPerRoom = 20;

      // Create multiple rooms
      const controllers: WebSocketRoomTestController[] = [];
      const conversationIds: string[] = [];

      for (let i = 0; i < roomCount; i++) {
        const conversationId = `stress_room_${i}`;
        conversationIds.push(conversationId);

        const controller = new WebSocketRoomTestController(conversationId);
        const clients = WebSocketTestClientFactory.createClients(clientsPerRoom, {
          conversationId,
          role: 'agent'
        });

        clients.forEach(client => controller.addClient(client));
        controllers.push(controller);
      }

      await Promise.all(controllers.map(controller => controller.connectAllClients()));

      memoryMonitor.start();
      performanceMonitor.startTimer('sustained_stress');

      let messageCounter = 0;
      let successfulMessages = 0;
      let failedMessages = 0;
      const startTime = Date.now();

      // Create sustained load
      const stressTest = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          const currentTime = Date.now();

          if (currentTime - startTime >= duration) {
            clearInterval(interval);
            resolve();
            return;
          }

          // Send messages to random rooms
          const promises = Array.from({ length: messageRate }, async () => {
            const roomIndex = messageCounter % roomCount;
            const conversationId = conversationIds[roomIndex];

            try {
              const success = await broadcastService.broadcastMessageEvent({
                type: 'message_sent',
                conversationId: conversationId,
                messageId: `stress_msg_${messageCounter++}`,
                userId: `stress_user_${messageCounter % 5}`,
                data: {
                  content: `Stress test message ${messageCounter}`,
                  timestamp: currentTime
                }
              });

              if (success) successfulMessages++;
              else failedMessages++;
            } catch (error) {
              failedMessages++;
              console.error('Stress test message failed:', error);
            }
          });

          await Promise.all(promises);
        }, 1000); // Every second
      });

      await stressTest;

      const stressTime = performanceMonitor.endTimer('sustained_stress');
      const memoryUsage = memoryMonitor.stop();

      const totalMessages = successfulMessages + failedMessages;
      const actualRate = totalMessages / (stressTime / 1000);
      const successRate = (successfulMessages / totalMessages) * 100;
      const expectedMessages = (duration / 1000) * messageRate;

      console.log(`🔥 Sustained stress test results:`);
      console.log(`   Duration: ${duration / 1000}s`);
      console.log(`   Target rate: ${messageRate} msg/sec`);
      console.log(`   Actual rate: ${actualRate.toFixed(2)} msg/sec`);
      console.log(`   Total messages: ${totalMessages}/${expectedMessages} expected`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final memory: ${(memoryUsage.final / 1024 / 1024).toFixed(2)}MB`);

      // Performance expectations
      expect(successRate).toBeGreaterThan(80); // 80% success rate under stress
      expect(actualRate).toBeGreaterThan(messageRate * 0.7); // 70% of target rate
      expect(memoryUsage.final / memoryUsage.peak).toBeLessThan(1.5); // Memory shouldn't grow too much

      await Promise.all(controllers.map(controller => controller.disconnectAllClients()));
    });

    test('should recover from performance degradation', async () => {
      const conversationId = 'recovery_test_conversation';
      const { controller } = WebSocketTestClientFactory.createMixedRoleRoom(conversationId);

      // Add more clients for stress
      const extraClients = WebSocketTestClientFactory.createClients(30, {
        conversationId,
        role: 'agent'
      });

      extraClients.forEach(client => controller.addClient(client));
      await controller.connectAllClients();

      // Phase 1: Normal operation
      console.log(`📊 Phase 1: Normal operation baseline`);
      performanceMonitor.startTimer('normal_operation');

      const normalPromises = Array.from({ length: 20 }, (_, i) =>
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `normal_msg_${i}`,
          userId: 'normal_user',
          data: { content: `Normal message ${i}` }
        })
      );

      const normalResults = await Promise.all(normalPromises);
      const normalTime = performanceMonitor.endTimer('normal_operation');
      const normalThroughput = normalResults.filter(r => r).length / (normalTime / 1000);

      console.log(`   Normal throughput: ${normalThroughput.toFixed(2)} msg/sec`);

      // Phase 2: High stress to induce degradation
      console.log(`🔥 Phase 2: High stress load`);
      performanceMonitor.startTimer('stress_operation');

      const stressPromises = Array.from({ length: 100 }, (_, i) =>
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `stress_msg_${i}`,
          userId: `stress_user_${i % 10}`,
          data: { content: `Stress message ${i}` }
        })
      );

      const stressResults = await Promise.all(stressPromises);
      const stressTime = performanceMonitor.endTimer('stress_operation');
      const stressThroughput = stressResults.filter(r => r).length / (stressTime / 1000);

      console.log(`   Stress throughput: ${stressThroughput.toFixed(2)} msg/sec`);

      // Phase 3: Recovery period
      console.log(`🔄 Phase 3: Recovery period`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second recovery

      performanceMonitor.startTimer('recovery_operation');

      const recoveryPromises = Array.from({ length: 20 }, (_, i) =>
        broadcastService.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: conversationId,
          messageId: `recovery_msg_${i}`,
          userId: 'recovery_user',
          data: { content: `Recovery message ${i}` }
        })
      );

      const recoveryResults = await Promise.all(recoveryPromises);
      const recoveryTime = performanceMonitor.endTimer('recovery_operation');
      const recoveryThroughput = recoveryResults.filter(r => r).length / (recoveryTime / 1000);

      console.log(`   Recovery throughput: ${recoveryThroughput.toFixed(2)} msg/sec`);

      // Analysis
      const degradationRatio = stressThroughput / normalThroughput;
      const recoveryRatio = recoveryThroughput / normalThroughput;

      console.log(`📈 Performance recovery analysis:`);
      console.log(`   Degradation: ${(degradationRatio * 100).toFixed(1)}% of normal`);
      console.log(`   Recovery: ${(recoveryRatio * 100).toFixed(1)}% of normal`);

      // Should recover to at least 70% of normal performance
      expect(recoveryRatio).toBeGreaterThan(0.7);

      await controller.disconnectAllClients();
    });
  });
});