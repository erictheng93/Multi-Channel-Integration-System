// 延遲訊息處理器 - 主要實現（使用 MessageRecallService）
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { MessageRecallService } from '../services/message-recall-service';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';

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