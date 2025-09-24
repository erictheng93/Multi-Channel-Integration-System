// 延遲訊息處理器 - 主要實現（使用 MessageRecallService）
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { MessageRecallService } from '../services/message-recall-service';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';
import { WebSocketBroadcastService } from '../services/websocket-broadcast-service';

const delayedMessageHandler = new Hono<{ Bindings: Bindings }>();

// 發送延遲訊息
delayedMessageHandler.post('/send', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId, content, platform, recipientPlatformId, delaySeconds, messageType } = await c.req.json();
    
    if (!conversationId || !content || !platform || !recipientPlatformId || delaySeconds === undefined) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 驗證延遲時間範圍 (1-120 秒)
    if (delaySeconds < 1 || delaySeconds > 120) {
      return c.json({ error: 'Delay seconds must be between 1 and 120' }, 400);
    }

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id, // ✅ agents表ID是TEXT類型，保持字符串
      'message', 
      'send', 
      { 
        userId: Number(user.id), // 轉換為數字以符合 PermissionContext
        role: user.role,
        resourceId: conversationId 
      }
    );
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const messageRecallService = new MessageRecallService(c.env);
    const result = await messageRecallService.sendDelayedMessage({
      conversationId,
      senderId: user.id.toString(),
      content,
      recipientPlatformId,
      platform,
      delaySeconds,
      messageType: messageType || 'text'
    });

    // 🚀 WebSocket Broadcasting: Delayed Message Scheduled
    if (result.success && result.messageId) {
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_countdown',
          conversationId,
          messageId: result.messageId,
          agentId: String(user.id),
          data: {
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            messageType: messageType || 'text',
            platform,
            delaySeconds,
            scheduledSendTime: result.scheduledSendTime,
            recallDeadline: result.recallDeadline,
            countdownStarted: true,
            remainingSeconds: delaySeconds,
            canRecall: true,
            scheduledBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            timestamp: new Date().toISOString()
          },
          priority: 'normal'
        });
        console.log('✅ [WebSocket] Delayed message countdown started broadcast');

        // Start countdown updates (we can implement this in DelayedMessageProcessor DO)
        // This will send periodic countdown updates until the message is sent or recalled
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Delayed message countdown broadcast failed:', broadcastError);
      }
    }

    return c.json({
      success: result.success,
      data: result.success ? {
        messageId: result.messageId,
        scheduledSendTime: result.scheduledSendTime,
        recallDeadline: result.recallDeadline
      } : null,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Send delayed message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send delayed message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 撤回延遲訊息
delayedMessageHandler.post('/recall/:messageId', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const messageId = c.req.param('messageId');
    
    if (!messageId) {
      return c.json({ error: 'Message ID is required' }, 400);
    }
    
    const messageRecallService = new MessageRecallService(c.env);
    const result = await messageRecallService.recallMessage(messageId, user.id.toString());

    // 🚀 WebSocket Broadcasting: Message Recall Event
    if (result.success && result.messageId) {
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);

        // Use conversationId from query parameter or request
        const conversationId = c.req.query('conversationId') || 'unknown';

        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_recalled',
          conversationId,
          messageId: result.messageId,
          agentId: String(user.id),
          data: {
            recalledBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            recalledAt: new Date().toISOString(),
            originalContent: 'Content recalled',
            originalMessageType: 'text',
            wasSuccessful: true,
            reason: 'manual_recall',
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
        console.log('✅ [WebSocket] Message recall success broadcasted');
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Message recall broadcast failed:', broadcastError);
      }
    } else if (!result.success) {
      // Broadcast recall failure
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_failed',
          conversationId: 'unknown', // We don't have conversation context for failed recalls
          messageId: messageId,
          agentId: String(user.id),
          data: {
            failureReason: result.error || 'Recall failed',
            attemptedBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            failedAt: new Date().toISOString(),
            operation: 'recall',
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
        console.log('✅ [WebSocket] Message recall failure broadcasted');
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Message recall failure broadcast failed:', broadcastError);
      }
    }

    return c.json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : null,
      error: result.error,
      timestamp: new Date().toISOString()
    }, result.success ? 200 : 400);

  } catch (error) {
    console.error('Recall delayed message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recall message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取待發送訊息列表
delayedMessageHandler.get('/pending', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    
    const messageRecallService = new MessageRecallService(c.env);
    const result = await messageRecallService.getPendingMessages(user.id.toString(), page, pageSize);
    
    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get pending messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pending messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 處理延遲訊息佇列 (內部API，供Queue Consumer使用)
delayedMessageHandler.post('/process', async (c) => {
  try {
    // 這個端點供Queue Consumer內部使用，通常不需要JWT驗證
    // 但可以添加內部token驗證以增加安全性
    const { messageId } = await c.req.json();
    
    if (!messageId) {
      return c.json({ error: 'Message ID is required' }, 400);
    }
    
    const messageRecallService = new MessageRecallService(c.env);
    const result = await messageRecallService.processQueueMessage(messageId);

    // 🚀 WebSocket Broadcasting: Queue Message Processing Result
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);

      if (result.success && !result.skipped) {
        // Get conversationId from request context
        const conversationId = c.req.query('conversationId') || 'unknown';

        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_sent',
          conversationId: conversationId || 'unknown',
          messageId: messageId,
          agentId: 'system',
          data: {
            content: 'Message processed successfully',
            messageType: 'text',
            platform: 'unknown',
            processedAt: new Date().toISOString(),
            deliveryStatus: 'sent',
            delayCompleted: true,
            originalScheduledTime: new Date().toISOString(),
            actualSentTime: new Date().toISOString(),
            queueProcessingId: crypto.randomUUID(),
            timestamp: new Date().toISOString()
          },
          priority: 'normal'
        });
        console.log('✅ [WebSocket] Delayed message sent event broadcasted');
      } else if (result.skipped) {
        // Message was skipped (likely cancelled)
        // Get conversationId from request context
        const conversationId = c.req.query('conversationId') || 'unknown';

        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_recalled',
          conversationId: conversationId || 'unknown',
          messageId: messageId,
          agentId: 'system',
          data: {
            skippedReason: 'Message was cancelled before processing',
            processedAt: new Date().toISOString(),
            wasSkipped: true,
            originalScheduledTime: new Date().toISOString(),
            timestamp: new Date().toISOString()
          },
          priority: 'low'
        });
        console.log('✅ [WebSocket] Delayed message skip event broadcasted');
      } else if (!result.success) {
        // Processing failed
        // Get conversationId from request context
        const conversationId = c.req.query('conversationId') || 'unknown';

        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_failed',
          conversationId: conversationId || 'unknown',
          messageId: messageId,
          agentId: 'system',
          data: {
            failureReason: result.error || 'Queue processing failed',
            processedAt: new Date().toISOString(),
            operation: 'queue_processing',
            deliveryStatus: 'failed',
            originalScheduledTime: new Date().toISOString(),
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
        console.log('✅ [WebSocket] Delayed message processing failure broadcasted');
      }
    } catch (broadcastError) {
      console.warn('⚠️ [WebSocket] Queue processing broadcast failed:', broadcastError);
    }

    return c.json({
      success: result.success,
      data: {
        messageId,
        processed: result.success,
        skipped: result.skipped || false
      },
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Process queue message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process queue message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default delayedMessageHandler;