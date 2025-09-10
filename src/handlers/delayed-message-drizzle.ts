// 使用 Drizzle ORM 的延遲訊息處理器
import { Hono } from 'hono';
// import { v4 as uuidv4 } from 'uuid'; // 暫時未使用
import { eq, and, desc } from 'drizzle-orm';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import * as schema from '../db/schema';
import type { HonoContext } from '../types/bindings';

const delayedMessages = new Hono<HonoContext>();

// Apply middleware
delayedMessages.use('*', databaseMiddleware);
delayedMessages.use('*', authMiddleware);

interface DelayedSendRequest {
  conversationId: string;
  content: string;
  delaySeconds: number; // 1-120 秒
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  metadata?: any;
}

// 發送延遲訊息
delayedMessages.post('/send', async (c) => {
  try {
    const agent = c.get('agent');
    const { conversationId, content, delaySeconds, messageType = 'text', metadata } = await c.req.json() as DelayedSendRequest;

    // 驗證輸入
    if (!content || content.trim().length === 0) {
      return c.json({ 
        success: false, 
        error: 'Content is required' 
      }, 400);
    }

    if (delaySeconds < 1 || delaySeconds > 120) {
      return c.json({ 
        success: false, 
        error: 'Delay must be between 1 and 120 seconds' 
      }, 400);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({ 
        success: false, 
        error: 'Conversation not found' 
      }, 404);
    }

    // 計算發送時間
    const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const recallDeadline = new Date(Date.now() + (delaySeconds - 5) * 1000).toISOString(); // 5秒前可撤回

    // 建立延遲訊息
    const delayedMessage = await dbService.createDelayedMessage({
      conversationId,
      agentId: agent!.id,
      content,
      messageType,
      scheduledAt,
      metadata: JSON.stringify({
        ...metadata,
        recallDeadline,
        originalDelaySeconds: delaySeconds,
      }),
    });

    // 加入到 Queue 中
    await c.env.AGENT_QUEUE.send({
      type: 'delayed_message',
      messageId: delayedMessage[0]?.id || '',
      scheduledAt,
    }, {
      delaySeconds,
    });

    return c.json({
      success: true,
      data: {
        messageId: delayedMessage[0]?.id || '',
        canRecall: true,
        recallDeadline,
        delaySeconds,
        scheduledSendTime: scheduledAt,
      }
    });

  } catch (error) {
    console.error('Send delayed message error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 撤回延遲訊息
delayedMessages.post('/recall/:messageId', async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 獲取延遲訊息
    const delayedMessage = await db.select().from(schema.delayedMessages)
      .where(eq(schema.delayedMessages.id, messageId))
      .get();

    if (!delayedMessage) {
      return c.json({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }

    // 檢查權限
    if (delayedMessage.agentId !== agent!.id && agent!.role !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'Permission denied' 
      }, 403);
    }

    // 檢查是否還能撤回
    const metadata = delayedMessage.metadata ? JSON.parse(delayedMessage.metadata) : {};
    const recallDeadline = new Date(metadata.recallDeadline || delayedMessage.scheduledAt);
    
    if (new Date() > recallDeadline) {
      return c.json({ 
        success: false, 
        error: 'Recall deadline has passed' 
      }, 400);
    }

    // 檢查狀態
    if (delayedMessage.status !== 'pending') {
      return c.json({ 
        success: false, 
        error: `Message is already ${delayedMessage.status}` 
      }, 400);
    }

    // 更新狀態為已取消
    await dbService.updateDelayedMessageStatus(messageId, 'cancelled');

    return c.json({
      success: true,
      data: {
        messageId,
        recalled: true,
        recalledAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Recall message error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 獲取待發送訊息列表
delayedMessages.get('/pending', async (c) => {
  try {
    const agent = c.get('agent');
    const { page = '1', pageSize = '20', status = 'pending' } = c.req.query();
    
    const pageNum = Math.max(parseInt(page), 1);
    const pageSizeNum = Math.min(parseInt(pageSize), 100);
    const offset = (pageNum - 1) * pageSizeNum;

    const db = c.get('db');
    // const kv = c.get('kv'); // 暫時未使用

    // 根據角色決定查詢範圍
    let whereCondition;
    if (agent!.role === 'admin') {
      whereCondition = eq(schema.delayedMessages.status, status);
    } else {
      whereCondition = and(
        eq(schema.delayedMessages.agentId, agent!.id),
        eq(schema.delayedMessages.status, status)
      );
    }

    // 獲取延遲訊息列表
    const messages = await db.select({
      id: schema.delayedMessages.id,
      conversationId: schema.delayedMessages.conversationId,
      content: schema.delayedMessages.content,
      messageType: schema.delayedMessages.messageType,
      scheduledAt: schema.delayedMessages.scheduledAt,
      status: schema.delayedMessages.status,
      metadata: schema.delayedMessages.metadata,
      createdAt: schema.delayedMessages.createdAt,
      agentName: schema.agents.displayName,
    })
    .from(schema.delayedMessages)
    .leftJoin(schema.agents, eq(schema.delayedMessages.agentId, schema.agents.id))
    .where(whereCondition)
    .orderBy(desc(schema.delayedMessages.scheduledAt))
    .limit(pageSizeNum)
    .offset(offset);

    // 計算是否還能撤回
    const items = messages.map(msg => {
      const metadata = msg.metadata ? JSON.parse(msg.metadata) : {};
      const recallDeadline = new Date(metadata.recallDeadline || msg.scheduledAt);
      const canRecall = new Date() < recallDeadline && msg.status === 'pending';

      return {
        ...msg,
        canRecall,
        recallDeadline: recallDeadline.toISOString(),
        delaySeconds: metadata.originalDelaySeconds,
      };
    });

    return c.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: items.length, // 簡化版本，實際應該查詢總數
        }
      }
    });

  } catch (error) {
    console.error('Get pending messages error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 處理佇列中的延遲訊息 (由 Queue Consumer 調用)
delayedMessages.post('/process', async (c) => {
  try {
    const { messageId } = await c.req.json();

    if (!messageId) {
      return c.json({ 
        success: false, 
        error: 'Message ID is required' 
      }, 400);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 獲取延遲訊息
    const delayedMessage = await db.select().from(schema.delayedMessages)
      .where(eq(schema.delayedMessages.id, messageId))
      .get();

    if (!delayedMessage) {
      return c.json({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }

    // 檢查狀態
    if (delayedMessage.status === 'cancelled') {
      return c.json({
        success: true,
        data: { skipped: true, reason: 'Message was cancelled' }
      });
    }

    if (delayedMessage.status !== 'pending') {
      return c.json({ 
        success: false, 
        error: `Message is already ${delayedMessage.status}` 
      }, 400);
    }

    try {
      // 建立實際訊息
      const message = await dbService.createMessage({
        conversationId: delayedMessage.conversationId,
        senderId: parseInt(delayedMessage.agentId) || 0,
        senderType: 'agent',
        messageType: delayedMessage.messageType,
        content: delayedMessage.content,
        metadata: delayedMessage.metadata,
      });

      // 更新延遲訊息狀態
      await dbService.updateDelayedMessageStatus(messageId, 'sent');

      // TODO: 發送到實際平台 (LINE, Facebook 等)
      // await sendToPlatform(message, conversation);

      return c.json({
        success: true,
        data: {
          messageId,
          actualMessageId: message?.id || '',
          status: 'sent',
          sentAt: new Date().toISOString(),
        }
      });

    } catch (sendError) {
      console.error('Failed to send message:', sendError);
      
      // 更新狀態為失敗
      await dbService.updateDelayedMessageStatus(messageId, 'failed');
      
      return c.json({ 
        success: false, 
        error: 'Failed to send message' 
      }, 500);
    }

  } catch (error) {
    console.error('Process queue message error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

export default delayedMessages;