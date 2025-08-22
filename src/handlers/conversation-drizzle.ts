// 使用 Drizzle ORM 和 KV 的對話處理器
import { Hono } from 'hono';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import type { HonoContext } from '../types/bindings';

const conversations = new Hono<HonoContext>();

// Apply middleware
conversations.use('*', databaseMiddleware);
conversations.use('*', authMiddleware);

// 獲取對話列表
conversations.get('/', async (c) => {
  try {
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    const { status, limit = '50', page = '1' } = c.req.query();
    const limitNum = Math.min(parseInt(limit), 100);
    const pageNum = Math.max(parseInt(page), 1);
    // const offset = (pageNum - 1) * limitNum; // 暫時未使用

    // 根據角色獲取對話
    let conversationList;
    if (agent!.role === 'admin') {
      // 管理員可以看到所有對話
      conversationList = await dbService.getConversationsByAgentId('', status, limitNum);
    } else {
      // 一般客服只能看到自己的對話
      conversationList = await dbService.getConversationsByAgentId(agent!.id, status, limitNum);
    }

    return c.json({
      success: true,
      data: {
        conversations: conversationList,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: conversationList.length,
        }
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 獲取特定對話
conversations.get('/:id', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 獲取對話資訊
    const conversation = await dbService.getConversationById(conversationId);
    
    if (!conversation) {
      return c.json({ 
        success: false, 
        error: 'Conversation not found' 
      }, 404);
    }

    // 獲取對話中的訊息
    const messages = await dbService.getMessagesByConversationId(conversationId, 100);

    return c.json({
      success: true,
      data: {
        conversation,
        messages: messages.reverse(), // 按時間順序排列
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 發送訊息
conversations.post('/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { content, messageType = 'text' } = await c.req.json();

    if (!content) {
      return c.json({ 
        success: false, 
        error: 'Message content is required' 
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

    // 建立訊息
    const message = await dbService.createMessage({
      conversationId,
      senderId: agent!.id,
      senderType: 'agent',
      messageType,
      content,
    });

    // 如果對話狀態是 pending，更新為 in-progress
    if (conversation.status === 'pending') {
      await dbService.updateConversation(conversationId, {
        status: 'in-progress',
        agentId: agent!.id,
      });
    }

    return c.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 更新對話狀態
conversations.patch('/:id/status', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { status } = await c.req.json();

    if (!['pending', 'in-progress', 'closed'].includes(status)) {
      return c.json({ 
        success: false, 
        error: 'Invalid status' 
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

    // 更新對話狀態
    const updates: any = { status };
    
    // 如果狀態變為 in-progress 且沒有指派客服，指派當前客服
    if (status === 'in-progress' && !conversation.agentId) {
      updates.agentId = agent!.id;
    }

    const updatedConversation = await dbService.updateConversation(conversationId, updates);

    return c.json({
      success: true,
      data: updatedConversation
    });

  } catch (error) {
    console.error('Update conversation status error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 標記訊息為已讀
conversations.post('/:id/mark-read', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    await dbService.markMessagesAsRead(conversationId, agent!.id);

    return c.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

export default conversations;