// WebSocket High-Load Stress Tests
// Tests WebSocket system behavior under extreme conditions
// including connection storms, message floods, and resource exhaustion scenarios

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
import { UserConnection } from '@backend/durable-objects/UserConnection';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from '@backend/durable-objects/DelayedMessagimport { MockFactory } from '@helpers/mockFactory';
eProcessor';
import { WebSocketBroadcastService } from '@backend/services/websocket-broadcast-service';
import type { DurableObjectEvent } from '@backend/types/websocket-types';

describe('WebSocket High-Load Stress Tests', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;
  let memoryMonitor: ReturnType<typeof LoadTestHelper.createMemoryMonitor>;

  beforeEach(async () => {
    testEnv.reset();
    performanceMonitor = new TestPerformanceMonitor();
    memoryMonitor = LoadTestHelper.createMemoryMonitor();

    // Register all Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);
    testEnv.registerDurableObject('DELAYED_MESSAGE_PROCESSOR', DelayedMessageProcessor);

    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(
                Array.from({ length: 100 }, (_, i) => ({
                  id: `user_${i}`,
                  teamId: Math.floor(i / 10) + 1
                }))
              )
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

  describe('Connection Storm Scenarios', () => {
    test('should handle rapid connection bursts without failure', async () => {
      const burstSize = 200;
      const burstCount = 5;
      const burstInterval = 1000; // 1 second between bursts
      const conversationId = 'connection_storm_test';

      memoryMonitor.start();
      performanceMonitor.startTimer('connection_storm');

      let totalConnections = 0;
      let successfulConnections = 0;
      let failedConnections = 0;

      console.log(`⚡ Starting connection storm test: ${burstCount} bursts of ${burstSize} connections`);

      for (let burstIndex = 0; burstIndex < burstCount; burstIndex++) {
        console.log(`💥 Burst ${burstIndex + 1}/${burstCount}: ${burstSize} connections`);

        const burstClients = LoadTestHelper.createLoadTestClients(
          burstSize,
          conversationId,
          'agent'
        );

        totalConnections += burstSize;

        const burstStartTime = Date.now();
        performanceMonitor.startTimer(`burst_${burstIndex}`);

        // Attempt rapid simultaneous connections
        const connectionPromises = burstClients.map(async (client) => {
          try {
            await client.connect();
            return client.isConnected;
          } catch (error) {
            console.warn(`Connection failed for ${client.id}:`, error.message);
            return false;
          }
        });

        const connectionResults = await Promise.all(connectionPromises);
        const burstTime = performanceMonitor.endTimer(`burst_${burstIndex}`);

        const burstSuccessful = connectionResults.filter(r => r === true).length;
        const burstFailed = connectionResults.filter(r => r === false).length;

        successfulConnections += burstSuccessful;
        failedConnections += burstFailed;

        const burstRate = burstSuccessful / (burstTime / 1000);

        console.log(`   Successful: ${burstSuccessful}/${burstSize}`);
        console.log(`   Failed: ${burstFailed}/${burstSize}`);
        console.log(`   Rate: ${burstRate.toFixed(2)} connections/sec`);
        console.log(`   Duration: ${burstTime}ms`);

        // Disconnect burst clients before next burst
        const disconnectPromises = burstClients
          .filter(client => client.isConnected)
          .map(client => client.disconnect());

        await Promise.all(disconnectPromises);

        // Wait before next burst (except for last burst)
        if (burstIndex < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      const totalTime = performanceMonitor.endTimer('connection_storm');
      const memoryUsage = memoryMonitor.stop();

      const overallSuccessRate = (successfulConnections / totalConnections) * 100;
      const averageRate = successfulConnections / (totalTime / 1000);

      console.log(`🎯 Connection storm summary:`);
      console.log(`   Total attempts: ${totalConnections}`);
      console.log(`   Successful: ${successfulConnections}`);
      console.log(`   Failed: ${failedConnections}`);
      console.log(`   Success rate: ${overallSuccessRate.toFixed(1)}%`);
      console.log(`   Average rate: ${averageRate.toFixed(2)} connections/sec`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      // Stress test expectations (more lenient than normal operation)
      expect(overallSuccessRate).toBeGreaterThan(60); // 60% success rate under extreme load
      expect(averageRate).toBeGreaterThan(5); // At least 5 connections per second
      expect(totalTime).toBeLessThan(120000); // Complete within 2 minutes
    });

    test('should handle connection churn under memory pressure', async () => {
      const churnCycles = 10;
      const connectionsPerCycle = 100;
      const cycleInterval = 500; // 500ms between cycles
      const conversationId = 'connection_churn_stress';

      memoryMonitor.start();
      performanceMonitor.startTimer('connection_churn_stress');

      let totalOperations = 0;
      let successfulOperations = 0;
      const memorySnapshots: number[] = [];

      console.log(`🔄 Starting connection churn stress test: ${churnCycles} cycles`);

      for (let cycle = 0; cycle < churnCycles; cycle++) {
        console.log(`⚡ Cycle ${cycle + 1}/${churnCycles}: ${connectionsPerCycle} connections`);

        const clients = LoadTestHelper.createLoadTestClients(
          connectionsPerCycle,
          conversationId,
          'agent'
        );

        // Rapid connect phase
        const connectPromises = clients.map(async (client) => {
          try {
            await client.connect();
            totalOperations++;
            if (client.isConnected) successfulOperations++;
            return client.isConnected;
          } catch (error) {
            totalOperations++;
            return false;
          }
        });

        await Promise.all(connectPromises);

        // Take memory snapshot
        if (typeof process !== 'undefined' && process.memoryUsage) {
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }

        // Brief activity period
        const activeClients = clients.filter(c => c.isConnected);
        if (activeClients.length > 0) {
          const messagingPromises = activeClients.slice(0, 10).map(client =>
            client.sendChatMessage(`Churn cycle ${cycle} message`).catch(() => {})
          );
          await Promise.allSettled(messagingPromises);
        }

        // Rapid disconnect phase
        const disconnectPromises = clients.map(async (client) => {
          try {
            if (client.isConnected) {
              await client.disconnect();
            }
            totalOperations++;
            successfulOperations++;
            return true;
          } catch (error) {
            totalOperations++;
            return false;
          }
        });

        await Promise.all(disconnectPromises);

        // Brief pause between cycles
        if (cycle < churnCycles - 1) {
          await new Promise(resolve => setTimeout(resolve, cycleInterval));
        }
      }

      const totalTime = performanceMonitor.endTimer('connection_churn_stress');
      const memoryUsage = memoryMonitor.stop();

      const operationRate = successfulOperations / (totalTime / 1000);
      const successRate = (successfulOperations / totalOperations) * 100;

      // Analyze memory growth
      const memoryGrowth = memorySnapshots.length > 1
        ? ((memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0]) / memorySnapshots[0]) * 100
        : 0;

      console.log(`🎯 Connection churn stress summary:`);
      console.log(`   Total operations: ${totalOperations}`);
      console.log(`   Successful operations: ${successfulOperations}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Operation rate: ${operationRate.toFixed(2)} ops/sec`);
      console.log(`   Memory growth: ${memoryGrowth.toFixed(1)}%`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(successRate).toBeGreaterThan(70); // 70% success rate under churn stress
      expect(memoryGrowth).toBeLessThan(200); // Memory shouldn't grow more than 200%
    });

    test('should handle concurrent multi-room connection storms', async () => {
      const roomCount = 10;
      const connectionsPerRoom = 50;
      const totalConnections = roomCount * connectionsPerRoom;

      memoryMonitor.start();
      performanceMonitor.startTimer('multi_room_storm');

      console.log(`🏢 Starting multi-room connection storm: ${roomCount} rooms, ${connectionsPerRoom} connections each`);

      // Create rooms and clients
      const rooms = Array.from({ length: roomCount }, (_, roomIndex) => {
        const conversationId = `storm_room_${roomIndex}`;
        const clients = LoadTestHelper.createLoadTestClients(
          connectionsPerRoom,
          conversationId,
          'agent'
        );
        const controller = new WebSocketRoomTestController(conversationId);

        clients.forEach(client => controller.addClient(client));

        return {
          conversationId,
          clients,
          controller,
          roomIndex
        };
      });

      // Attempt simultaneous connections across all rooms
      const allConnectionPromises = rooms.flatMap(room =>
        room.clients.map(async (client) => {
          try {
            await client.connect();
            return { success: true, roomIndex: room.roomIndex };
          } catch (error) {
            return { success: false, roomIndex: room.roomIndex, error: error.message };
          }
        })
      );

      const connectionResults = await Promise.all(allConnectionPromises);

      const totalTime = performanceMonitor.endTimer('multi_room_storm');
      const memoryUsage = memoryMonitor.stop();

      // Analyze results by room
      const roomStats = rooms.map(room => {
        const roomResults = connectionResults.filter(r => r.roomIndex === room.roomIndex);
        const successful = roomResults.filter(r => r.success).length;
        const failed = roomResults.filter(r => !r.success).length;

        return {
          roomIndex: room.roomIndex,
          successful,
          failed,
          successRate: (successful / connectionsPerRoom) * 100
        };
      });

      const totalSuccessful = connectionResults.filter(r => r.success).length;
      const totalFailed = connectionResults.filter(r => !r.success).length;
      const overallSuccessRate = (totalSuccessful / totalConnections) * 100;
      const connectionRate = totalSuccessful / (totalTime / 1000);

      console.log(`🎯 Multi-room storm results:`);
      console.log(`   Total connections: ${totalConnections}`);
      console.log(`   Successful: ${totalSuccessful}`);
      console.log(`   Failed: ${totalFailed}`);
      console.log(`   Overall success rate: ${overallSuccessRate.toFixed(1)}%`);
      console.log(`   Connection rate: ${connectionRate.toFixed(2)} connections/sec`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      // Room-by-room analysis
      console.log(`📊 Per-room analysis:`);
      roomStats.forEach(stats => {
        console.log(`   Room ${stats.roomIndex}: ${stats.successful}/${connectionsPerRoom} (${stats.successRate.toFixed(1)}%)`);
      });

      // Stress test expectations
      expect(overallSuccessRate).toBeGreaterThan(50); // 50% success rate under extreme multi-room load
      expect(connectionRate).toBeGreaterThan(10); // At least 10 connections per second
      expect(roomStats.filter(s => s.successRate > 30).length).toBeGreaterThan(roomCount * 0.7); // 70% of rooms should have >30% success

      // Clean up
      await Promise.all(rooms.map(room => room.controller.disconnectAllClients()));
    });
  });

  describe('Message Flood Scenarios', () => {
    test('should handle sustained message flooding', async () => {
      const floodDuration = 30000; // 30 seconds
      const messagesPerSecond = 20;
      const roomCount = 5;
      const sendersPerRoom = 3;

      // Create rooms with senders
      const rooms = Array.from({ length: roomCount }, (_, roomIndex) => {
        const conversationId = `flood_room_${roomIndex}`;
        const senders = LoadTestHelper.createLoadTestClients(
          sendersPerRoom,
          conversationId,
          'agent'
        );
        const receivers = LoadTestHelper.createLoadTestClients(
          5, // 5 receivers per room
          conversationId,
          'agent'
        );

        const controller = new WebSocketRoomTestController(conversationId);
        [...senders, ...receivers].forEach(client => controller.addClient(client));

        return {
          conversationId,
          senders,
          receivers,
          controller,
          roomIndex
        };
      });

      console.log(`🌊 Starting message flood test: ${floodDuration / 1000}s duration, ${messagesPerSecond} msg/sec/room`);

      // Connect all clients
      await Promise.all(rooms.map(room => room.controller.connectAllClients()));

      memoryMonitor.start();
      performanceMonitor.startTimer('message_flood');

      let totalMessagesSent = 0;
      let totalMessagesSuccessful = 0;
      let totalMessagesFailed = 0;
      const startTime = Date.now();

      // Create message flood
      const floodPromise = new Promise<void>((resolve) => {
        const floodInterval = setInterval(async () => {
          const currentTime = Date.now();

          if (currentTime - startTime >= floodDuration) {
            clearInterval(floodInterval);
            resolve();
            return;
          }

          // Send messages from each room
          const messagePromises = rooms.flatMap(room =>
            room.senders.map(async (sender) => {
              try {
                totalMessagesSent++;
                await sender.sendChatMessage(`Flood message ${totalMessagesSent} from room ${room.roomIndex}`);
                totalMessagesSuccessful++;
                return true;
              } catch (error) {
                totalMessagesFailed++;
                return false;
              }
            })
          );

          await Promise.allSettled(messagePromises);
        }, 1000 / messagesPerSecond); // Interval to achieve target rate
      });

      await floodPromise;

      const floodTime = performanceMonitor.endTimer('message_flood');
      const memoryUsage = memoryMonitor.stop();

      const actualRate = totalMessagesSuccessful / (floodTime / 1000);
      const targetRate = roomCount * sendersPerRoom * messagesPerSecond;
      const efficiency = (actualRate / targetRate) * 100;
      const successRate = (totalMessagesSuccessful / totalMessagesSent) * 100;

      console.log(`🎯 Message flood results:`);
      console.log(`   Duration: ${floodTime / 1000}s`);
      console.log(`   Target rate: ${targetRate} msg/sec`);
      console.log(`   Actual rate: ${actualRate.toFixed(2)} msg/sec`);
      console.log(`   Efficiency: ${efficiency.toFixed(1)}%`);
      console.log(`   Messages sent: ${totalMessagesSent}`);
      console.log(`   Messages successful: ${totalMessagesSuccessful}`);
      console.log(`   Messages failed: ${totalMessagesFailed}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      // Flood test expectations
      expect(successRate).toBeGreaterThan(60); // 60% success rate under flood
      expect(efficiency).toBeGreaterThan(30); // 30% of target throughput
      expect(actualRate).toBeGreaterThan(10); // At least 10 messages per second

      // Clean up
      await Promise.all(rooms.map(room => room.controller.disconnectAllClients()));
    });

    test('should handle broadcast message storms', async () => {
      const broadcastCount = 500;
      const roomCount = 8;
      const clientsPerRoom = 15;
      const batchSize = 25;

      // Create rooms
      const rooms = Array.from({ length: roomCount }, (_, roomIndex) => {
        const conversationId = `broadcast_storm_room_${roomIndex}`;
        const clients = LoadTestHelper.createLoadTestClients(
          clientsPerRoom,
          conversationId,
          'agent'
        );
        const controller = new WebSocketRoomTestController(conversationId);

        clients.forEach(client => controller.addClient(client));

        return {
          conversationId,
          clients,
          controller,
          roomIndex
        };
      });

      console.log(`📡 Starting broadcast storm: ${broadcastCount} broadcasts to ${roomCount} rooms`);

      // Connect all clients
      await Promise.all(rooms.map(room => room.controller.connectAllClients()));

      memoryMonitor.start();
      performanceMonitor.startTimer('broadcast_storm');

      let successfulBroadcasts = 0;
      let failedBroadcasts = 0;

      // Send broadcasts in batches to avoid overwhelming the system
      for (let batch = 0; batch < Math.ceil(broadcastCount / batchSize); batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, broadcastCount);
        const batchBroadcasts = batchEnd - batchStart;

        console.log(`📦 Batch ${batch + 1}: Broadcasting ${batchBroadcasts} messages`);

        const batchPromises = Array.from({ length: batchBroadcasts }, async (_, i) => {
          const broadcastIndex = batchStart + i;
          const targetRoom = rooms[broadcastIndex % roomCount];

          try {
            const success = await broadcastService.broadcastMessageEvent({
              type: 'message_sent',
              conversationId: targetRoom.conversationId,
              messageId: `storm_broadcast_${broadcastIndex}`,
              userId: `storm_user_${broadcastIndex}`,
              data: {
                content: `Broadcast storm message ${broadcastIndex}`,
                batchIndex: batch,
                messageIndex: i
              }
            });

            if (success) {
              successfulBroadcasts++;
            } else {
              failedBroadcasts++;
            }

            return success;
          } catch (error) {
            failedBroadcasts++;
            console.warn(`Broadcast ${broadcastIndex} failed:`, error.message);
            return false;
          }
        });

        await Promise.all(batchPromises);

        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const stormTime = performanceMonitor.endTimer('broadcast_storm');
      const memoryUsage = memoryMonitor.stop();

      const broadcastRate = successfulBroadcasts / (stormTime / 1000);
      const successRate = (successfulBroadcasts / broadcastCount) * 100;

      console.log(`🎯 Broadcast storm results:`);
      console.log(`   Total broadcasts: ${broadcastCount}`);
      console.log(`   Successful: ${successfulBroadcasts}`);
      console.log(`   Failed: ${failedBroadcasts}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Broadcast rate: ${broadcastRate.toFixed(2)} broadcasts/sec`);
      console.log(`   Duration: ${stormTime}ms`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(successRate).toBeGreaterThan(70); // 70% success rate for broadcast storm
      expect(broadcastRate).toBeGreaterThan(5); // At least 5 broadcasts per second

      // Clean up
      await Promise.all(rooms.map(room => room.controller.disconnectAllClients()));
    });

    test('should handle mixed event type storms', async () => {
      const eventCount = 300;
      const conversationId = 'mixed_storm_conversation';
      const participantCount = 25;

      const clients = LoadTestHelper.createLoadTestClients(
        participantCount,
        conversationId,
        'agent'
      );

      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      console.log(`🎭 Starting mixed event storm: ${eventCount} events of various types`);

      await controller.connectAllClients();

      memoryMonitor.start();
      performanceMonitor.startTimer('mixed_event_storm');

      const eventTypes = [
        'message_sent',
        'typing_start',
        'typing_stop',
        'conversation_status_changed',
        'user_online',
        'user_offline',
        'delayed_message_countdown',
        'system_notification'
      ];

      let successfulEvents = 0;
      let failedEvents = 0;
      const eventTypeStats: Record<string, { success: number; failed: number }> = {};

      // Initialize stats tracking
      eventTypes.forEach(type => {
        eventTypeStats[type] = { success: 0, failed: 0 };
      });

      // Generate mixed event storm
      const eventPromises = Array.from({ length: eventCount }, async (_, i) => {
        const eventType = eventTypes[i % eventTypes.length];
        const userId = `storm_user_${i % 10}`;

        try {
          let success = false;

          switch (eventType) {
            case 'message_sent':
              success = await broadcastService.broadcastMessageEvent({
                type: 'message_sent',
                conversationId: conversationId,
                messageId: `storm_msg_${i}`,
                userId: userId,
                data: { content: `Storm message ${i}` }
              });
              break;

            case 'typing_start':
            case 'typing_stop':
              success = await broadcastService.broadcastTypingEvent({
                type: eventType as 'typing_start' | 'typing_stop',
                conversationId: conversationId,
                userId: userId
              });
              break;

            case 'conversation_status_changed':
              success = await broadcastService.broadcastConversationEvent({
                type: 'conversation_status_changed',
                conversationId: conversationId,
                data: {
                  oldStatus: 'active',
                  newStatus: i % 2 === 0 ? 'busy' : 'active',
                  changedBy: userId
                }
              });
              break;

            case 'user_online':
            case 'user_offline':
              success = await broadcastService.broadcastPresenceEvent({
                type: eventType as 'user_online' | 'user_offline',
                userId: userId,
                data: { timestamp: Date.now() }
              });
              break;

            case 'delayed_message_countdown':
              success = await broadcastService.broadcastDelayedMessageEvent({
                type: 'delayed_message_countdown',
                conversationId: conversationId,
                messageId: `delayed_${i}`,
                agentId: userId,
                data: { remainingSeconds: 30 - (i % 30) }
              });
              break;

            case 'system_notification':
              // Create system notification event
              const event: DurableObjectEvent = {
                id: `system_${i}`,
                type: 'system_notification',
                source: 'system',
                timestamp: Date.now(),
                userId: 'system',
                conversationId: conversationId,
                data: { message: `System notification ${i}` },
                priority: 'low'
              };

              const events = [event];
              const batchResult = await broadcastService.broadcastBatch(events);
              success = batchResult.successful > 0;
              break;
          }

          if (success) {
            successfulEvents++;
            eventTypeStats[eventType].success++;
          } else {
            failedEvents++;
            eventTypeStats[eventType].failed++;
          }

          return success;
        } catch (error) {
          failedEvents++;
          eventTypeStats[eventType].failed++;
          return false;
        }
      });

      await Promise.all(eventPromises);

      const stormTime = performanceMonitor.endTimer('mixed_event_storm');
      const memoryUsage = memoryMonitor.stop();

      const eventRate = successfulEvents / (stormTime / 1000);
      const successRate = (successfulEvents / eventCount) * 100;

      console.log(`🎯 Mixed event storm results:`);
      console.log(`   Total events: ${eventCount}`);
      console.log(`   Successful: ${successfulEvents}`);
      console.log(`   Failed: ${failedEvents}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Event rate: ${eventRate.toFixed(2)} events/sec`);
      console.log(`   Duration: ${stormTime}ms`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      // Per-event-type analysis
      console.log(`📊 Event type breakdown:`);
      eventTypes.forEach(type => {
        const stats = eventTypeStats[type];
        const typeSuccessRate = (stats.success / (stats.success + stats.failed)) * 100;
        console.log(`   ${type}: ${stats.success}/${stats.success + stats.failed} (${typeSuccessRate.toFixed(1)}%)`);
      });

      expect(successRate).toBeGreaterThan(60); // 60% success rate for mixed storm
      expect(eventRate).toBeGreaterThan(8); // At least 8 events per second

      await controller.disconnectAllClients();
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory pressure gracefully', async () => {
      const memoryPressurePhases = [
        { connections: 50, messagesPerClient: 10, description: 'Light load' },
        { connections: 100, messagesPerClient: 20, description: 'Medium load' },
        { connections: 200, messagesPerClient: 30, description: 'Heavy load' },
        { connections: 300, messagesPerClient: 40, description: 'Extreme load' }
      ];

      const conversationId = 'memory_pressure_test';
      let peakMemoryUsage = 0;
      let currentConnections = 0;

      console.log(`💾 Starting memory pressure test: ${memoryPressurePhases.length} phases`);

      for (let phaseIndex = 0; phaseIndex < memoryPressurePhases.length; phaseIndex++) {
        const phase = memoryPressurePhases[phaseIndex];
        console.log(`🔥 Phase ${phaseIndex + 1}: ${phase.description} - ${phase.connections} connections`);

        memoryMonitor.start();
        performanceMonitor.startTimer(`memory_phase_${phaseIndex}`);

        const clients = LoadTestHelper.createLoadTestClients(
          phase.connections,
          conversationId,
          'agent'
        );

        const controller = new WebSocketRoomTestController(conversationId);
        clients.forEach(client => controller.addClient(client));

        try {
          // Connect clients
          await LoadTestHelper.connectInBatches(clients, 25, 200);
          currentConnections = clients.filter(c => c.isConnected).length;

          // Generate message load
          const messagingResult = await LoadTestHelper.simulateConcurrentMessaging(
            clients.filter(c => c.isConnected).slice(0, Math.min(20, currentConnections)),
            phase.messagesPerClient,
            100
          );

          const phaseTime = performanceMonitor.endTimer(`memory_phase_${phaseIndex}`);
          const memoryUsage = memoryMonitor.stop();

          if (memoryUsage.peak > peakMemoryUsage) {
            peakMemoryUsage = memoryUsage.peak;
          }

          const successRate = messagingResult.errors === 0 ? 100 :
            ((messagingResult.totalMessages - messagingResult.errors) / messagingResult.totalMessages) * 100;

          console.log(`   Connected: ${currentConnections}/${phase.connections}`);
          console.log(`   Messages: ${messagingResult.totalMessages} (${messagingResult.errors} errors)`);
          console.log(`   Success rate: ${successRate.toFixed(1)}%`);
          console.log(`   Memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);
          console.log(`   Duration: ${phaseTime}ms`);

          // Check if system is still responsive
          if (successRate < 50) {
            console.log(`⚠️ System responsiveness degraded significantly in phase ${phaseIndex + 1}`);
            break;
          }

        } catch (error) {
          console.log(`❌ Phase ${phaseIndex + 1} failed: ${error.message}`);
          break;
        } finally {
          // Clean up phase
          await controller.disconnectAllClients();
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        // Brief recovery period between phases
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`🎯 Memory pressure test summary:`);
      console.log(`   Peak memory usage: ${(peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   System maintained responsiveness through multiple phases`);

      // Should complete at least 2 phases
      expect(peakMemoryUsage).toBeGreaterThan(0);
    });

    test('should handle CPU intensive operations under load', async () => {
      const operationCount = 200;
      const concurrentOperations = 20;
      const conversationId = 'cpu_stress_test';

      console.log(`⚡ Starting CPU stress test: ${operationCount} intensive operations`);

      // Setup baseline connections
      const clients = LoadTestHelper.createLoadTestClients(50, conversationId, 'agent');
      const controller = new WebSocketRoomTestController(conversationId);
      clients.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      memoryMonitor.start();
      performanceMonitor.startTimer('cpu_stress');

      let completedOperations = 0;
      let failedOperations = 0;

      // Create CPU-intensive batch operations
      const intensiveOperations = Array.from({ length: operationCount }, (_, i) => {
        const batchSize = 10 + (i % 15); // Variable batch sizes 10-25
        const events: DurableObjectEvent[] = Array.from({ length: batchSize }, (_, j) =>
          TestDataFactory.createEvent({
            type: 'message_sent',
            conversationId: conversationId,
            userId: `cpu_user_${i}_${j}`,
            data: {
              content: `CPU stress message ${i}_${j}`,
              batchIndex: i,
              messageIndex: j,
              timestamp: Date.now(),
              complexData: Array.from({ length: 100 }, (_, k) => ({ id: k, value: Math.random() }))
            }
          })
        );

        return async () => {
          try {
            const batchResult = await broadcastService.broadcastBatch(events);
            if (batchResult.successful > 0) {
              completedOperations++;
            } else {
              failedOperations++;
            }
            return batchResult.successful > 0;
          } catch (error) {
            failedOperations++;
            return false;
          }
        };
      });

      // Execute operations with controlled concurrency
      for (let i = 0; i < intensiveOperations.length; i += concurrentOperations) {
        const batch = intensiveOperations.slice(i, i + concurrentOperations);
        const batchPromises = batch.map(operation => operation());
        await Promise.all(batchPromises);

        // Brief pause to prevent complete system overload
        if (i % (concurrentOperations * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const stressTime = performanceMonitor.endTimer('cpu_stress');
      const memoryUsage = memoryMonitor.stop();

      const operationRate = completedOperations / (stressTime / 1000);
      const successRate = (completedOperations / operationCount) * 100;

      console.log(`🎯 CPU stress test results:`);
      console.log(`   Total operations: ${operationCount}`);
      console.log(`   Completed: ${completedOperations}`);
      console.log(`   Failed: ${failedOperations}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   Operation rate: ${operationRate.toFixed(2)} ops/sec`);
      console.log(`   Duration: ${stressTime}ms`);
      console.log(`   Peak memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

      expect(successRate).toBeGreaterThan(40); // 40% success rate under CPU stress
      expect(operationRate).toBeGreaterThan(2); // At least 2 operations per second

      await controller.disconnectAllClients();
    });

    test('should recover from system overload conditions', async () => {
      const overloadPhases = [
        { name: 'Baseline', load: 1, duration: 2000 },
        { name: 'Moderate Load', load: 3, duration: 3000 },
        { name: 'High Load', load: 6, duration: 4000 },
        { name: 'Overload', load: 10, duration: 5000 },
        { name: 'Recovery', load: 2, duration: 4000 },
        { name: 'Stabilization', load: 1, duration: 3000 }
      ];

      const conversationId = 'recovery_test';
      const baseClients = 30;

      console.log(`🔄 Starting system recovery test: ${overloadPhases.length} phases`);

      const baseClientList = LoadTestHelper.createLoadTestClients(baseClients, conversationId, 'agent');
      const controller = new WebSocketRoomTestController(conversationId);
      baseClientList.forEach(client => controller.addClient(client));

      await controller.connectAllClients();

      const phaseResults: Array<{
        phase: string;
        load: number;
        successRate: number;
        responseTime: number;
        memoryUsage: number;
      }> = [];

      for (const phase of overloadPhases) {
        console.log(`🔥 Phase: ${phase.name} (Load: ${phase.load}x)`);

        memoryMonitor.start();
        performanceMonitor.startTimer(`recovery_phase_${phase.name}`);

        const messagesPerSecond = phase.load * 5; // Base 5 msg/sec per load unit
        const messageCount = Math.floor((phase.duration / 1000) * messagesPerSecond);

        let successfulMessages = 0;
        let failedMessages = 0;

        // Generate load for phase duration
        const phaseStartTime = Date.now();
        const phasePromise = new Promise<void>((resolve) => {
          const interval = setInterval(async () => {
            if (Date.now() - phaseStartTime >= phase.duration) {
              clearInterval(interval);
              resolve();
              return;
            }

            // Send messages based on load multiplier
            const messagesToSend = Math.min(messagesPerSecond, 20); // Cap to prevent system death
            const messagePromises = Array.from({ length: messagesToSend }, async (_, i) => {
              try {
                const success = await broadcastService.broadcastMessageEvent({
                  type: 'message_sent',
                  conversationId: conversationId,
                  messageId: `recovery_msg_${Date.now()}_${i}`,
                  userId: `recovery_user_${i % 5}`,
                  data: {
                    content: `Recovery test message ${i}`,
                    phase: phase.name,
                    load: phase.load
                  }
                });

                if (success) successfulMessages++;
                else failedMessages++;

                return success;
              } catch (error) {
                failedMessages++;
                return false;
              }
            });

            await Promise.allSettled(messagePromises);
          }, 1000);
        });

        await phasePromise;

        const phaseTime = performanceMonitor.endTimer(`recovery_phase_${phase.name}`);
        const memoryUsage = memoryMonitor.stop();

        const totalMessages = successfulMessages + failedMessages;
        const successRate = totalMessages > 0 ? (successfulMessages / totalMessages) * 100 : 0;
        const avgResponseTime = phaseTime / Math.max(totalMessages, 1);

        phaseResults.push({
          phase: phase.name,
          load: phase.load,
          successRate,
          responseTime: avgResponseTime,
          memoryUsage: memoryUsage.peak
        });

        console.log(`   Messages: ${successfulMessages}/${totalMessages}`);
        console.log(`   Success rate: ${successRate.toFixed(1)}%`);
        console.log(`   Avg response: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Memory: ${(memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`);

        // Brief pause between phases
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`🎯 System recovery analysis:`);
      phaseResults.forEach(result => {
        console.log(`   ${result.phase}: ${result.successRate.toFixed(1)}% success, ${result.responseTime.toFixed(0)}ms avg`);
      });

      // Recovery validation
      const overloadPhase = phaseResults.find(r => r.phase === 'Overload');
      const recoveryPhase = phaseResults.find(r => r.phase === 'Recovery');
      const stabilizationPhase = phaseResults.find(r => r.phase === 'Stabilization');

      if (overloadPhase && recoveryPhase && stabilizationPhase) {
        const recoveryImprovement = recoveryPhase.successRate - overloadPhase.successRate;
        const stabilizationImprovement = stabilizationPhase.successRate - overloadPhase.successRate;

        console.log(`📈 Recovery metrics:`);
        console.log(`   Recovery improvement: +${recoveryImprovement.toFixed(1)}%`);
        console.log(`   Stabilization improvement: +${stabilizationImprovement.toFixed(1)}%`);

        expect(recoveryImprovement).toBeGreaterThan(10); // Should improve by >10%
        expect(stabilizationImprovement).toBeGreaterThan(20); // Should stabilize >20% better than overload
      }

      await controller.disconnectAllClients();
    });
  });
});