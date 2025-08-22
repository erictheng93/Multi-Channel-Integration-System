// 對話管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';

const conversationHandler = new Hono<{ Bindings: Bindings }>();

// 指派對話到團隊/用戶
conversationHandler.post('/:id/assign', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = parseInt(c.req.param('id'));
    const { teamId, userId, reason } = await c.req.json();
    
    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id, 
      'conversation', 
      'assign'
    );
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // 更新對話指派
    await c.env.DB.prepare(`
      UPDATE conversations 
      SET assigned_team_id = ?, assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(teamId, userId, conversationId).run();

    // 記錄轉移歷史
    if (reason) {
      await c.env.DB.prepare(`
        INSERT INTO conversation_transfers 
        (conversation_id, to_team_id, to_user_id, transfer_reason, transferred_by)
        VALUES (?, ?, ?, ?, ?)
      `).bind(conversationId, teamId, userId, reason, user.id).run();
    }
    
    return c.json({
      success: true,
      message: 'Conversation assigned successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Assign conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.ASSIGN_CONVERSATION_FAILED,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 轉移對話
conversationHandler.post('/:id/transfer', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = parseInt(c.req.param('id'));
    const { fromTeamId, toTeamId, fromUserId, toUserId, reason } = await c.req.json();
    
    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id, 
      'conversation', 
      'transfer'
    );
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // 更新對話指派
    await c.env.DB.prepare(`
      UPDATE conversations 
      SET assigned_team_id = ?, assigned_user_id = ?, status = 'transferred', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(toTeamId, toUserId, conversationId).run();

    // 記錄轉移歷史
    await c.env.DB.prepare(`
      INSERT INTO conversation_transfers 
      (conversation_id, from_team_id, to_team_id, from_user_id, to_user_id, transfer_reason, transferred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(conversationId, fromTeamId, toTeamId, fromUserId, toUserId, reason, user.id).run();
    
    return c.json({
      success: true,
      message: 'Conversation transferred successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transfer conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取用戶可見的對話列表
conversationHandler.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const visibleConversationIds = await PermissionService.getVisibleConversations(typeof user.id === 'string' ? parseInt(user.id, 10) : user.id);
    
    // 如果沒有可見對話，返回空列表
    if (visibleConversationIds.length === 0) {
      return c.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    // 構建查詢條件
    const placeholders = visibleConversationIds.map(() => '?').join(',');
    const query = `
      SELECT 
        c.*,
        cu.display_name as customer_name,
        cu.platform,
        cu.platform_user_id,
        t.name as team_name,
        u.display_name as assigned_user_name
      FROM conversations c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN teams t ON c.assigned_team_id = t.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.id IN (${placeholders})
      ORDER BY c.updated_at DESC
    `;

    const conversations = await c.env.DB.prepare(query)
      .bind(...visibleConversationIds)
      .all();

    return c.json({
      success: true,
      data: conversations.results || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取特定對話詳情
conversationHandler.get('/:id', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = parseInt(c.req.param('id'));
    
    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id, 
      'conversation', 
      'read',
      { 
        userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        role: user.role,
        resourceId: conversationId 
      }
    );
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const conversation = await c.env.DB.prepare(`
      SELECT 
        c.*,
        cu.display_name as customer_name,
        cu.platform,
        cu.platform_user_id,
        t.name as team_name,
        u.display_name as assigned_user_name
      FROM conversations c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN teams t ON c.assigned_team_id = t.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.id = ?
    `).bind(conversationId).first();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    return c.json({
      success: true,
      data: conversation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default conversationHandler;