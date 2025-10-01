// src/routes/enhanced-routes.ts
// 增強功能路由配置

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth, requireRole /*, requireTeamAccess*/ } from '../middleware/auth';
import { drizzle } from 'drizzle-orm/d1';
import { 
  customers, 
  conversations, 
  messages, 
  teams, 
  notifications 
} from '../db/schema';
import { 
  count, 
  sql, 
  eq, 
  and, 
  or, 
  isNull, 
  desc 
} from 'drizzle-orm';

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
      const db = drizzle(c.env.DB);
      
      // Build conditions for team-based access control
      const isAdmin = payload?.role === 'admin';
      const teamCondition = isAdmin 
        ? undefined 
        : payload?.teamId 
          ? or(eq(conversations.assignedTeamId, payload.teamId), isNull(conversations.assignedTeamId))
          : isNull(conversations.assignedTeamId);
      
      // 並行獲取各種統計數據
      const [
        totalCustomersResult,
        totalConversationsResult,
        activeConversationsResult,
        unreadNotificationsResult,
        todayMessagesResult,
        recentActivityResults
      ] = await Promise.all([
        // 總客戶數 - count distinct customers with team access control
        db.select({ 
          total: sql<number>`COUNT(DISTINCT ${customers.id})` 
        })
        .from(customers)
        .leftJoin(conversations, eq(customers.id, conversations.customerId))
        .where(teamCondition)
        .get(),

        // 總對話數
        db.select({ 
          total: count() 
        })
        .from(conversations)
        .where(teamCondition)
        .get(),

        // 活躍對話數
        db.select({ 
          total: count() 
        })
        .from(conversations)
        .where(
          teamCondition 
            ? and(eq(conversations.status, 'active'), teamCondition)
            : eq(conversations.status, 'active')
        )
        .get(),

        // 未讀通知數
        db.select({ 
          total: count() 
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, payload?.userId || ''),
            eq(notifications.isRead, false),
            or(
              isNull(notifications.expiresAt),
              sql`${notifications.expiresAt} > datetime('now')`
            )
          )
        )
        .get(),

        // 今日訊息數
        db.select({ 
          total: count() 
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(
          teamCondition 
            ? and(sql`DATE(${messages.createdAt}) = ${today}`, teamCondition)
            : sql`DATE(${messages.createdAt}) = ${today}`
        )
        .get(),

        // 最近活動
        db.select({
          id: messages.id,
          conversationId: conversations.id,
          customerName: customers.displayName,
          content: messages.content,
          senderType: messages.senderType,
          createdAt: messages.createdAt
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(teamCondition)
        .orderBy(desc(messages.createdAt))
        .limit(10)
        .all()
      ]);

      return c.json({
        success: true,
        data: {
          stats: {
            totalCustomers: totalCustomersResult?.total || 0,
            totalConversations: totalConversationsResult?.total || 0,
            activeConversations: activeConversationsResult?.total || 0,
            unreadNotifications: unreadNotificationsResult?.total || 0,
            todayMessages: todayMessagesResult?.total || 0
          },
          recentActivity: recentActivityResults.map((row) => ({
            id: row.id,
            conversationId: row.conversationId,
            customerName: row.customerName,
            content: row.content.substring(0, 100),
            senderType: row.senderType,
            createdAt: row.createdAt
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
      const db = drizzle(c.env.DB);
      
      
      // 團隊工作負載統計 - Using complex aggregation with raw SQL for now
      const teamWorkloadQuery = payload?.role !== 'admin' && payload?.teamId
        ? sql`
          SELECT 
            ${teams.name} as team_name,
            COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END) as active_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'pending' THEN 1 END) as pending_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'closed' THEN 1 END) as closed_conversations,
            COUNT(DISTINCT ${conversations.assignedUserId}) as active_agents
          FROM ${teams} t
          LEFT JOIN ${conversations} c ON ${teams.id} = ${conversations.assignedTeamId}
          WHERE ${teams.isActive} = TRUE AND ${teams.id} = ${payload.teamId}
          GROUP BY ${teams.id}, ${teams.name}
          ORDER BY active_conversations DESC
        `
        : sql`
          SELECT 
            ${teams.name} as team_name,
            COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END) as active_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'pending' THEN 1 END) as pending_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'closed' THEN 1 END) as closed_conversations,
            COUNT(DISTINCT ${conversations.assignedUserId}) as active_agents
          FROM ${teams} t
          LEFT JOIN ${conversations} c ON ${teams.id} = ${conversations.assignedTeamId}
          WHERE ${teams.isActive} = TRUE
          GROUP BY ${teams.id}, ${teams.name}
          ORDER BY active_conversations DESC
        `;

      const teamWorkloadResults = await db.run(teamWorkloadQuery);

      // 個人工作負載（如果是客服）
      let personalWorkload = null;
      if (payload?.role === 'agent') {
        const personalWorkloadResult = await db.run(sql`
          SELECT 
            COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END) as active_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'assigned' THEN 1 END) as assigned_conversations,
            COUNT(CASE WHEN ${conversations.status} = 'closed' AND DATE(${conversations.updatedAt}) = DATE('now') THEN 1 END) as closed_today,
            AVG(
              CASE 
                WHEN ${conversations.status} = 'closed' THEN 
                  (julianday(${conversations.updatedAt}) - julianday(${conversations.createdAt})) * 24 * 60
                ELSE NULL 
              END
            ) as avg_resolution_time_minutes
          FROM ${conversations}
          WHERE ${conversations.assignedUserId} = ${payload.userId}
        `);
        
        personalWorkload = personalWorkloadResult.results || []?.[0] || null;
      }

      return c.json({
        success: true,
        data: {
          teamWorkload: teamWorkloadResults.results || [],
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
      const db = drizzle(c.env.DB);
      
      // Build team access condition
      const teamCondition = payload?.role === 'admin' 
        ? undefined 
        : payload?.teamId 
          ? or(eq(conversations.assignedTeamId, payload.teamId), isNull(conversations.assignedTeamId))
          : isNull(conversations.assignedTeamId);

      // 按平台統計客戶數 - Complex aggregation using raw SQL
      const platformStatsQuery = teamCondition 
        ? sql`
          SELECT 
            ${customers.platform} as platform,
            COUNT(DISTINCT ${customers.id}) as customer_count,
            COUNT(DISTINCT ${conversations.id}) as conversation_count,
            COUNT(DISTINCT CASE WHEN ${conversations.status} = 'active' THEN ${conversations.id} END) as active_conversations
          FROM ${customers} cu
          LEFT JOIN ${conversations} c ON ${customers.id} = ${conversations.customerId}
          WHERE (${conversations.assignedTeamId} = ${payload?.teamId} OR ${conversations.assignedTeamId} IS NULL)
          GROUP BY ${customers.platform}
          ORDER BY customer_count DESC
        `
        : sql`
          SELECT 
            ${customers.platform} as platform,
            COUNT(DISTINCT ${customers.id}) as customer_count,
            COUNT(DISTINCT ${conversations.id}) as conversation_count,
            COUNT(DISTINCT CASE WHEN ${conversations.status} = 'active' THEN ${conversations.id} END) as active_conversations
          FROM ${customers} cu
          LEFT JOIN ${conversations} c ON ${customers.id} = ${conversations.customerId}
          GROUP BY ${customers.platform}
          ORDER BY customer_count DESC
        `;
      
      const platformStatsResults = await db.run(platformStatsQuery);

      // 平台消息量趨勢（最近7天）
      const messageTrendsQuery = teamCondition 
        ? sql`
          SELECT 
            ${customers.platform} as platform,
            DATE(${messages.createdAt}) as date,
            COUNT(*) as message_count
          FROM ${messages} m
          JOIN ${conversations} c ON ${messages.conversationId} = ${conversations.id}
          JOIN ${customers} cu ON ${conversations.customerId} = ${customers.id}
          WHERE ${messages.createdAt} >= date('now', '-7 days')
          AND (${conversations.assignedTeamId} = ${payload?.teamId} OR ${conversations.assignedTeamId} IS NULL)
          GROUP BY ${customers.platform}, DATE(${messages.createdAt})
          ORDER BY date DESC, ${customers.platform}
        `
        : sql`
          SELECT 
            ${customers.platform} as platform,
            DATE(${messages.createdAt}) as date,
            COUNT(*) as message_count
          FROM ${messages} m
          JOIN ${conversations} c ON ${messages.conversationId} = ${conversations.id}
          JOIN ${customers} cu ON ${conversations.customerId} = ${customers.id}
          WHERE ${messages.createdAt} >= date('now', '-7 days')
          GROUP BY ${customers.platform}, DATE(${messages.createdAt})
          ORDER BY date DESC, ${customers.platform}
        `;
      
      const messageTrendsResults = await db.run(messageTrendsQuery);

      return c.json({
        success: true,
        data: {
          platformStats: platformStatsResults.results || [],
          messageTrends: messageTrendsResults.results || []
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