// src/routes/enhanced-routes.ts
// 增強功能路由配置

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth, requireRole /*, requireTeamAccess*/ } from '../middleware/auth';

// 引入所有處理器
import { customerHandler } from '../handlers/customer';
import { tagHandler } from '../handlers/tag';
import { conversationHandler } from '../handlers/conversation';
import { messageHandler } from '../handlers/message';
import { notificationHandler } from '../handlers/notification';

export function setupEnhancedRoutes(app: Hono<{ Bindings: Bindings }>) {
  
  // ==================== 客戶管理 API ====================
  
  // 客戶列表（支持搜索和篩選）
  app.get('/api/customers', jwtAuth, customerHandler.list);
  
  // 客戶詳情
  app.get('/api/customers/:id', jwtAuth, customerHandler.get);
  
  // 更新客戶資料
  app.put('/api/customers/:id', jwtAuth, customerHandler.update);
  
  // 客戶標籤管理
  app.post('/api/customers/:id/tags', jwtAuth, customerHandler.addTags);
  app.delete('/api/customers/:id/tags', jwtAuth, customerHandler.removeTags);
  
  // 客戶統計
  app.get('/api/customers/stats', jwtAuth, customerHandler.getStats);
  
  // 客戶快速搜索
  app.get('/api/customers/search', jwtAuth, customerHandler.search);

  // ==================== 標籤管理 API ====================
  
  // 標籤列表
  app.get('/api/tags', jwtAuth, tagHandler.list);
  
  // 創建標籤
  app.post('/api/tags', jwtAuth, tagHandler.create);
  
  // 標籤詳情
  app.get('/api/tags/:id', jwtAuth, tagHandler.get);
  
  // 更新標籤
  app.put('/api/tags/:id', jwtAuth, tagHandler.update);
  
  // 刪除標籤（軟刪除）
  app.delete('/api/tags/:id', jwtAuth, tagHandler.delete);
  
  // 標籤使用統計
  app.get('/api/tags/:id/stats', jwtAuth, tagHandler.getUsageStats);
  
  // 批量操作標籤
  app.post('/api/tags/bulk', jwtAuth, requireRole('admin'), tagHandler.bulkOperation);

  // ==================== 對話管理增強 API ====================
  
  // 對話列表（已在 conversation handler 中增強）
  // app.get('/api/conversations', jwtAuth, conversationHandler.list);
  
  // 設定對話優先級
  app.put('/api/conversations/:id/priority', jwtAuth, conversationHandler.setPriority);
  
  // 轉移對話
  app.post('/api/conversations/:id/transfer', jwtAuth, conversationHandler.transfer);
  
  // 對話標籤管理
  app.post('/api/conversations/:id/tags', jwtAuth, conversationHandler.addTags);
  app.delete('/api/conversations/:id/tags', jwtAuth, conversationHandler.removeTags);
  
  // 設定內部備註
  app.put('/api/conversations/:id/notes', jwtAuth, conversationHandler.setNotes);
  
  // 獲取轉移歷史
  app.get('/api/conversations/:id/transfers', jwtAuth, conversationHandler.getTransferHistory);
  
  // 批量操作對話
  app.post('/api/conversations/bulk', jwtAuth, conversationHandler.bulkOperation);
  
  // 自動分配對話
  app.post('/api/conversations/auto-assign', jwtAuth, requireRole('admin'), conversationHandler.autoAssign);

  // ==================== 訊息搜索 API ====================
  
  // 全文搜索訊息
  app.get('/api/messages/search', jwtAuth, messageHandler.search);
  
  // 搜索建議
  app.get('/api/messages/search/suggestions', jwtAuth, messageHandler.searchSuggestions);
  
  // 高級搜索
  app.post('/api/messages/search/advanced', jwtAuth, messageHandler.advancedSearch);

  // ==================== 通知系統 API ====================
  
  // 獲取通知列表
  app.get('/api/notifications', jwtAuth, notificationHandler.list);
  
  // 標記通知為已讀
  app.put('/api/notifications/:id/read', jwtAuth, notificationHandler.markAsRead);
  
  // 批量標記為已讀
  app.put('/api/notifications/read-all', jwtAuth, notificationHandler.markAllAsRead);
  
  // 刪除通知
  app.delete('/api/notifications/:id', jwtAuth, notificationHandler.delete);
  
  // 通知統計
  app.get('/api/notifications/stats', jwtAuth, notificationHandler.getStats);
  
  // 通知設定
  app.get('/api/notifications/settings', jwtAuth, notificationHandler.getSettings);
  app.put('/api/notifications/settings', jwtAuth, notificationHandler.updateSettings);
  
  // 清理過期通知（管理員限定）
  app.delete('/api/notifications/cleanup', jwtAuth, requireRole('admin'), notificationHandler.cleanup);
  
  // Server-Sent Events 即時通知
  app.get('/api/notifications/sse', jwtAuth, notificationHandler.sse);

  // ==================== 儀表板和統計 API ====================
  
  // 綜合儀表板數據
  app.get('/api/dashboard/overview', jwtAuth, async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const today = new Date().toISOString().split('T')[0];
      
      // 並行獲取各種統計數據
      const [
        totalCustomers,
        totalConversations,
        activeConversations,
        unreadNotifications,
        todayMessages,
        recentActivity
      ] = await Promise.all([
        // 總客戶數
        c.env.DB.prepare(`
          SELECT COUNT(DISTINCT c.id) as total
          FROM customers c
          LEFT JOIN conversations conv ON c.id = conv.customer_id
          LEFT JOIN teams t ON conv.assigned_team_id = t.id
          WHERE ${payload?.role !== 'admin' ? 'conv.assigned_team_id = ? OR conv.assigned_team_id IS NULL' : '1=1'}
        `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).first(),

        // 總對話數
        c.env.DB.prepare(`
          SELECT COUNT(*) as total
          FROM conversations c
          WHERE ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
        `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).first(),

        // 活躍對話數
        c.env.DB.prepare(`
          SELECT COUNT(*) as total
          FROM conversations c
          WHERE c.status = 'active' 
          AND ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
        `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).first(),

        // 未讀通知數
        c.env.DB.prepare(`
          SELECT COUNT(*) as total
          FROM notifications
          WHERE user_id = ? AND is_read = FALSE
          AND (expires_at IS NULL OR expires_at > datetime('now'))
        `).bind(payload?.userId).first(),

        // 今日訊息數
        c.env.DB.prepare(`
          SELECT COUNT(*) as total
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE DATE(m.created_at) = ?
          AND ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
        `).bind(today, ...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).first(),

        // 最近活動
        c.env.DB.prepare(`
          SELECT m.*, c.id as conversation_id, cu.display_name as customer_name
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          JOIN customers cu ON c.customer_id = cu.id
          WHERE ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
          ORDER BY m.created_at DESC
          LIMIT 10
        `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).all()
      ]);

      return c.json({
        success: true,
        data: {
          stats: {
            totalCustomers: totalCustomers?.total || 0,
            totalConversations: totalConversations?.total || 0,
            activeConversations: activeConversations?.total || 0,
            unreadNotifications: unreadNotifications?.total || 0,
            todayMessages: todayMessages?.total || 0
          },
          recentActivity: recentActivity.results.map((row: any) => ({
            id: row.id,
            conversationId: row.conversation_id,
            customerName: row.customer_name,
            content: row.content.substring(0, 100),
            senderType: row.sender_type,
            createdAt: row.created_at
          }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Dashboard overview error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  // 工作負載統計
  app.get('/api/dashboard/workload', jwtAuth, async (c) => {
    try {
      const payload = c.get('jwtPayload');
      
      // 團隊工作負載統計
      const teamWorkload = await c.env.DB.prepare(`
        SELECT 
          t.name as team_name,
          COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_conversations,
          COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_conversations,
          COUNT(CASE WHEN c.status = 'closed' THEN 1 END) as closed_conversations,
          COUNT(DISTINCT c.assigned_user_id) as active_agents
        FROM teams t
        LEFT JOIN conversations c ON t.id = c.assigned_team_id
        WHERE t.is_active = TRUE
        ${payload?.role !== 'admin' ? 'AND t.id = ?' : ''}
        GROUP BY t.id, t.name
        ORDER BY active_conversations DESC
      `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).all();

      // 個人工作負載（如果是客服）
      let personalWorkload = null;
      if (payload?.role === 'agent') {
        personalWorkload = await c.env.DB.prepare(`
          SELECT 
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
            COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_conversations,
            COUNT(CASE WHEN status = 'closed' AND DATE(updated_at) = DATE('now') THEN 1 END) as closed_today,
            AVG(
              CASE 
                WHEN status = 'closed' THEN 
                  (julianday(updated_at) - julianday(created_at)) * 24 * 60
                ELSE NULL 
              END
            ) as avg_resolution_time_minutes
          FROM conversations
          WHERE assigned_user_id = ?
        `).bind(payload.userId).first();
      }

      return c.json({
        success: true,
        data: {
          teamWorkload: teamWorkload.results,
          personalWorkload
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Workload stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  // 平台使用統計
  app.get('/api/dashboard/platforms', jwtAuth, async (c) => {
    try {
      const payload = c.get('jwtPayload');

      // 按平台統計客戶數
      const platformStats = await c.env.DB.prepare(`
        SELECT 
          cu.platform,
          COUNT(DISTINCT cu.id) as customer_count,
          COUNT(DISTINCT c.id) as conversation_count,
          COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_conversations
        FROM customers cu
        LEFT JOIN conversations c ON cu.id = c.customer_id
        WHERE ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
        GROUP BY cu.platform
        ORDER BY customer_count DESC
      `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).all();

      // 平台消息量趨勢（最近7天）
      const messageTrends = await c.env.DB.prepare(`
        SELECT 
          cu.platform,
          DATE(m.created_at) as date,
          COUNT(*) as message_count
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        JOIN customers cu ON c.customer_id = cu.id
        WHERE m.created_at >= date('now', '-7 days')
        AND ${payload?.role !== 'admin' ? 'c.assigned_team_id = ? OR c.assigned_team_id IS NULL' : '1=1'}
        GROUP BY cu.platform, DATE(m.created_at)
        ORDER BY date DESC, cu.platform
      `).bind(...(payload?.role !== 'admin' && payload?.teamId ? [payload.teamId] : [])).all();

      return c.json({
        success: true,
        data: {
          platformStats: platformStats.results,
          messageTrends: messageTrends.results
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Platform stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  return app;
}