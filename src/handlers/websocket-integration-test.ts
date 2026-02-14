// WebSocket Integration Test Handler
// Tests the WebSocket Broadcasting Service integration with existing handlers
// Provides endpoints for testing real-time functionality

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { WebSocketBroadcastService } from '../services/websocket-broadcast-service';
import { jwtAuth } from '../middleware/auth';
import { createDbClient } from '../db/drizzle-factory';
import { conversations, customers } from '../db/schema';
import { eq } from 'drizzle-orm';

const websocketTestHandler = new Hono<{ Bindings: Bindings }>();

// =================== Test Endpoints ===================

/**
 * Test message broadcasting
 */
websocketTestHandler.post('/test-message-broadcast', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId, messageType = 'test', content = 'Test message broadcast' } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);

    // Test message sent event
    const messageId = crypto.randomUUID();
    const success = await broadcastService.broadcastMessageEvent({
      type: 'message_sent',
      conversationId,
      messageId,
      agentId: String(user.id),
      data: {
        content,
        messageType,
        sender: {
          id: String(user.id),
          name: user.displayName,
          role: user.role
        },
        platform: 'test',
        deliveryStatus: 'sent',
        timestamp: new Date().toISOString(),
        isTest: true
      },
      priority: 'normal'
    });

    return c.json({
      success: true,
      data: {
        messageId,
        broadcastSuccess: success,
        conversationId,
        testType: 'message_broadcast'
      }
    });

  } catch (error) {
    console.error('Test message broadcast error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Test typing indicators
 */
websocketTestHandler.post('/test-typing-indicator', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId, action = 'start' } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!['start', 'stop'].includes(action)) {
      return c.json({ error: 'action must be "start" or "stop"' }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);

    const success = await broadcastService.broadcastTypingEvent({
      type: action === 'start' ? 'typing_start' : 'typing_stop',
      conversationId,
      userId: String(user.id),
      userName: user.displayName,
      data: {
        timestamp: Date.now(),
        isTest: true
      }
    });

    return c.json({
      success: true,
      data: {
        broadcastSuccess: success,
        conversationId,
        action,
        testType: 'typing_indicator'
      }
    });

  } catch (error) {
    console.error('Test typing indicator error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Test conversation events
 */
websocketTestHandler.post('/test-conversation-event', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const {
      conversationId,
      eventType = 'conversation_assigned',
      toTeamId,
      toUserId
    } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const validEvents = [
      'conversation_assigned',
      'conversation_transferred',
      'conversation_status_changed',
      'participant_joined',
      'participant_left'
    ];

    if (!validEvents.includes(eventType)) {
      return c.json({
        error: `eventType must be one of: ${validEvents.join(', ')}`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);

    const success = await broadcastService.broadcastConversationEvent({
      type: eventType as any,
      conversationId,
      userId: String(user.id),
      data: {
        assignedTeamId: toTeamId,
        assignedUserId: toUserId,
        changedBy: {
          id: String(user.id),
          name: user.displayName,
          role: user.role
        },
        timestamp: new Date().toISOString(),
        isTest: true
      },
      priority: 'normal'
    });

    return c.json({
      success: true,
      data: {
        broadcastSuccess: success,
        conversationId,
        eventType,
        testType: 'conversation_event'
      }
    });

  } catch (error) {
    console.error('Test conversation event error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Test delayed message events
 */
websocketTestHandler.post('/test-delayed-message-event', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const {
      conversationId,
      eventType = 'delayed_message_countdown',
      delaySeconds = 30,
      content = 'Test delayed message'
    } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const validEvents = [
      'delayed_message_countdown',
      'delayed_message_sent',
      'delayed_message_recalled',
      'delayed_message_failed'
    ];

    if (!validEvents.includes(eventType)) {
      return c.json({
        error: `eventType must be one of: ${validEvents.join(', ')}`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);
    const messageId = crypto.randomUUID();

    const success = await broadcastService.broadcastDelayedMessageEvent({
      type: eventType as any,
      conversationId,
      messageId,
      agentId: String(user.id),
      data: {
        content: content.substring(0, 100),
        messageType: 'text',
        delaySeconds,
        scheduledSendTime: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        recallDeadline: new Date(Date.now() + (delaySeconds - 5) * 1000).toISOString(),
        countdownStarted: eventType === 'delayed_message_countdown',
        remainingSeconds: delaySeconds,
        canRecall: eventType === 'delayed_message_countdown',
        scheduledBy: {
          id: String(user.id),
          name: user.displayName,
          role: user.role
        },
        timestamp: new Date().toISOString(),
        isTest: true
      },
      priority: 'normal'
    });

    return c.json({
      success: true,
      data: {
        messageId,
        broadcastSuccess: success,
        conversationId,
        eventType,
        testType: 'delayed_message_event'
      }
    });

  } catch (error) {
    console.error('Test delayed message event error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Test presence events
 */
websocketTestHandler.post('/test-presence-event', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const {
      eventType = 'agent_available',
      teamId
    } = await c.req.json();

    const validEvents = [
      'user_online',
      'user_offline',
      'user_away',
      'agent_available',
      'agent_busy',
      'agent_offline'
    ];

    if (!validEvents.includes(eventType)) {
      return c.json({
        error: `eventType must be one of: ${validEvents.join(', ')}`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);

    const success = await broadcastService.broadcastPresenceEvent({
      type: eventType as any,
      userId: String(user.id),
      teamId: teamId || user.primaryTeamId,
      data: {
        userName: user.displayName,
        role: user.role,
        timestamp: Date.now(),
        isTest: true
      }
    });

    return c.json({
      success: true,
      data: {
        broadcastSuccess: success,
        userId: String(user.id),
        eventType,
        testType: 'presence_event'
      }
    });

  } catch (error) {
    console.error('Test presence event error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Test batch broadcasting
 */
websocketTestHandler.post('/test-batch-broadcast', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId, eventCount = 3 } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (eventCount > 10) {
      return c.json({ error: 'eventCount cannot exceed 10' }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);

    // Create multiple test events
    const events = Array.from({ length: eventCount }, (_, i) => ({
      id: crypto.randomUUID(),
      type: 'system_notification' as const,
      source: 'system' as const,
      timestamp: Date.now(),
      userId: String(user.id),
      conversationId,
      data: {
        message: `Batch test event ${i + 1}`,
        batchIndex: i + 1,
        totalEvents: eventCount,
        isTest: true
      },
      priority: 'low' as const,
      deliveryOptions: {
        broadcast: true,
        targets: [
          {
            type: 'conversation' as const,
            targets: [conversationId],
            priority: 'low' as const
          }
        ],
        persistent: false,
        ttl: 60000
      }
    }));

    const result = await broadcastService.broadcastBatch(events);

    return c.json({
      success: true,
      data: {
        eventCount,
        ...result,
        testType: 'batch_broadcast'
      }
    });

  } catch (error) {
    console.error('Test batch broadcast error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Service Health and Status ===================

/**
 * Get broadcasting service health
 */
websocketTestHandler.get('/health', async (c) => {
  try {
    const broadcastService = new WebSocketBroadcastService(c.env);
    const health = await broadcastService.getHealthStatus();

    return c.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Check if WebSocket is available
 */
websocketTestHandler.get('/websocket-status', async (c) => {
  try {
    const broadcastService = new WebSocketBroadcastService(c.env);
    const isAvailable = await broadcastService.isWebSocketAvailable();

    return c.json({
      success: true,
      data: {
        websocketAvailable: isAvailable,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('WebSocket status check error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Send test event to specific target
 */
websocketTestHandler.post('/send-test-event', jwtAuth, async (c) => {
  try {
    const { targetType, targetId } = await c.req.json();

    if (!targetType || !targetId) {
      return c.json({ error: 'targetType and targetId are required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const validTargetTypes = ['conversation', 'user', 'team', 'global'];
    if (!validTargetTypes.includes(targetType)) {
      return c.json({
        error: `targetType must be one of: ${validTargetTypes.join(', ')}`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);
    const success = await broadcastService.sendTestEvent({
      type: targetType,
      id: targetId
    });

    return c.json({
      success: true,
      data: {
        testEventSent: success,
        targetType,
        targetId,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Send test event error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test event failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Integration Test Scenarios ===================

/**
 * Run comprehensive integration test
 */
websocketTestHandler.post('/run-integration-test', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId } = await c.req.json();

    if (!conversationId) {
      return c.json({ error: 'conversationId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const broadcastService = new WebSocketBroadcastService(c.env);
    const testResults: any[] = [];

    // Test 1: Message broadcast
    try {
      const messageSuccess = await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId,
        messageId: crypto.randomUUID(),
        agentId: String(user.id),
        data: {
          content: 'Integration test message',
          messageType: 'text',
          sender: { id: String(user.id), name: user.displayName, role: user.role },
          platform: 'test',
          deliveryStatus: 'sent',
          timestamp: new Date().toISOString(),
          isIntegrationTest: true
        }
      });
      testResults.push({ test: 'message_broadcast', success: messageSuccess });
    } catch (error) {
      testResults.push({ test: 'message_broadcast', success: false, error: error instanceof Error ? error.message : String(error) });
    }

    // Test 2: Typing indicator
    try {
      const typingSuccess = await broadcastService.broadcastTypingEvent({
        type: 'typing_start',
        conversationId,
        userId: String(user.id),
        userName: user.displayName,
        data: { timestamp: Date.now(), isIntegrationTest: true }
      });
      testResults.push({ test: 'typing_indicator', success: typingSuccess });
    } catch (error) {
      testResults.push({ test: 'typing_indicator', success: false, error: error instanceof Error ? error.message : String(error) });
    }

    // Test 3: Conversation event
    try {
      const conversationSuccess = await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId,
        userId: String(user.id),
        data: {
          status: 'active',
          changedBy: { id: String(user.id), name: user.displayName, role: user.role },
          timestamp: new Date().toISOString(),
          isIntegrationTest: true
        }
      });
      testResults.push({ test: 'conversation_event', success: conversationSuccess });
    } catch (error) {
      testResults.push({ test: 'conversation_event', success: false, error: error instanceof Error ? error.message : String(error) });
    }

    // Test 4: Delayed message event
    try {
      const delayedSuccess = await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_countdown',
        conversationId,
        messageId: crypto.randomUUID(),
        agentId: String(user.id),
        data: {
          content: 'Integration test delayed message',
          delaySeconds: 30,
          countdownStarted: true,
          scheduledBy: { id: String(user.id), name: user.displayName, role: user.role },
          timestamp: new Date().toISOString(),
          isIntegrationTest: true
        }
      });
      testResults.push({ test: 'delayed_message_event', success: delayedSuccess });
    } catch (error) {
      testResults.push({ test: 'delayed_message_event', success: false, error: error instanceof Error ? error.message : String(error) });
    }

    // Test 5: Presence event
    try {
      const presenceSuccess = await broadcastService.broadcastPresenceEvent({
        type: 'agent_available',
        userId: String(user.id),
        ...(user.primaryTeamId && { teamId: user.primaryTeamId }),
        data: {
          userName: user.displayName,
          role: user.role,
          timestamp: Date.now(),
          isIntegrationTest: true
        }
      });
      testResults.push({ test: 'presence_event', success: presenceSuccess });
    } catch (error) {
      testResults.push({ test: 'presence_event', success: false, error: error instanceof Error ? error.message : String(error) });
    }

    // Calculate overall success
    const successfulTests = testResults.filter(r => r.success).length;
    const totalTests = testResults.length;
    const overallSuccess = successfulTests === totalTests;

    return c.json({
      success: overallSuccess,
      data: {
        overallSuccess,
        successfulTests,
        totalTests,
        successRate: Math.round((successfulTests / totalTests) * 100),
        testResults,
        conversationId,
        testedBy: {
          id: String(user.id),
          name: user.displayName,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Integration test error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Integration test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * Get test conversation data for testing
 */
websocketTestHandler.get('/test-conversations', jwtAuth, async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);

    // Get a few conversations for testing
    const testConversations = await drizzleDb
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        status: conversations.status,
        customerName: customers.displayName,
        platform: customers.platform
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .limit(5);

    return c.json({
      success: true,
      data: {
        conversations: testConversations,
        count: testConversations.length,
        note: 'Use these conversation IDs for testing WebSocket broadcasting'
      }
    });

  } catch (error) {
    console.error('Get test conversations error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get test conversations'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default websocketTestHandler;