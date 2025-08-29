// 活動記錄服務
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { activities } from '../db/schema';

export interface ActivityLog {
  id: number
  userId: string
  userName: string
  userRole: string
  action: string
  resourceType: string
  resourceId?: string | undefined
  details?: Record<string, unknown> | undefined
  ipAddress?: string | undefined
  userAgent?: string | undefined
  createdAt: string
}

export interface CreateActivityRequest {
  userId: string
  userName: string
  userRole: string
  action: string
  resourceType: string
  resourceId?: string | undefined
  details?: Record<string, unknown> | undefined
  ipAddress?: string | undefined
  userAgent?: string | undefined
}

export class ActivityService {
  constructor(private db: D1Database) {}

  // 記錄活動
  async logActivity(request: CreateActivityRequest): Promise<ActivityLog | null> {
    try {
      const drizzleDb = drizzle(this.db);
      const timestamp = new Date().toISOString();
      
      const result = await drizzleDb
        .insert(activities)
        .values({
          userId: request.userId,
          userName: request.userName,
          userRole: request.userRole,
          action: request.action,
          resourceType: request.resourceType,
          resourceId: request.resourceId || null,
          details: request.details ? JSON.stringify(request.details) : null,
          ipAddress: request.ipAddress || null,
          userAgent: request.userAgent || null,
          createdAt: timestamp
        })
        .returning({ id: activities.id });

      // 返回創建的活動對象
      const createdActivity: ActivityLog = {
        id: result[0]?.id || 0,
        userId: request.userId,
        userName: request.userName,
        userRole: request.userRole,
        action: request.action,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        details: request.details,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        createdAt: timestamp
      }

      console.log('✅ [Activity Service] Activity logged with ID:', createdActivity.id)
      return createdActivity
    } catch (error) {
      console.error('❌ [Activity Service] Failed to log activity:', error)
      // 不拋出錯誤，避免影響主要業務流程
      return null
    }
  }

  // 獲取活動記錄列表
  async getActivities(params: {
    page?: number | undefined
    pageSize?: number | undefined
    userId?: string | undefined
    action?: string | undefined
    resourceType?: string | undefined
    startDate?: string | undefined
    endDate?: string | undefined
  } = {}): Promise<{
    items: ActivityLog[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const {
      page = 1,
      pageSize = 50,
      userId,
      action,
      resourceType,
      startDate,
      endDate
    } = params

    // 構建 Drizzle 查詢條件
    const drizzleDb = drizzle(this.db);
    const conditions = [];

    if (userId) {
      conditions.push(eq(activities.userId, userId));
    }

    if (action) {
      conditions.push(eq(activities.action, action));
    }

    if (resourceType) {
      conditions.push(eq(activities.resourceType, resourceType));
    }

    if (startDate) {
      conditions.push(gte(activities.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(activities.createdAt, endDate));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // 獲取總數
    const [totalResult] = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(whereCondition);

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // 獲取活動記錄
    const activityList = await drizzleDb
      .select()
      .from(activities)
      .where(whereCondition)
      .orderBy(desc(activities.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items: ActivityLog[] = activityList.map(row => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userRole: row.userRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId ?? undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      createdAt: row.createdAt || new Date().toISOString()
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages
    }
  }

  // 獲取用戶活動統計
  async getUserActivityStats(userId: string, days = 30): Promise<{
    totalActions: number
    actionsByType: Record<string, number>
    recentActions: ActivityLog[]
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db);
    const conditions = and(
      eq(activities.userId, userId),
      gte(activities.createdAt, startDateStr)
    );

    // 總操作數
    const [totalResult] = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(conditions);

    const totalActions = totalResult?.count || 0;

    // 按操作類型統計 (由於 Drizzle 不支持 GROUP BY，使用原生 SQL)
    const actionStats = await this.db
      .prepare(`
        SELECT action, COUNT(*) as count 
        FROM activities 
        WHERE user_id = ? AND created_at >= ?
        GROUP BY action
        ORDER BY count DESC
      `)
      .bind(userId, startDateStr)
      .all<{ action: string; count: number }>();

    const actionsByType: Record<string, number> = {};
    (actionStats.results || []).forEach(row => {
      actionsByType[row.action] = row.count;
    });

    // 最近的操作
    const recentActivities = await this.getActivities({
      userId,
      pageSize: 10,
      startDate: startDateStr
    })

    return {
      totalActions,
      actionsByType,
      recentActions: recentActivities.items
    }
  }

  // 清理舊的活動記錄
  async cleanupOldActivities(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffDateStr = cutoffDate.toISOString()

    const drizzleDb = drizzle(this.db);
    
    // 由於 Drizzle 不支持 DELETE 返回影響的行數，使用原生 SQL
    const result = await this.db
      .prepare('DELETE FROM activities WHERE created_at < ?')
      .bind(cutoffDateStr)
      .run();

    return result.meta.changes || 0;
  }
}

// 活動類型常數
export const ACTIVITY_ACTIONS = {
  // 對話相關
  CONVERSATION_ASSIGN: 'conversation_assign',
  CONVERSATION_TRANSFER: 'conversation_transfer',
  CONVERSATION_CLOSE: 'conversation_close',
  CONVERSATION_REOPEN: 'conversation_reopen',
  
  // 訊息相關
  MESSAGE_SEND: 'message_send',
  MESSAGE_RECALL: 'message_recall',
  
  // 用戶管理
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  
  // 系統設定
  SETTINGS_UPDATE: 'settings_update',
  
  // 團隊管理
  TEAM_INVITE: 'team_invite',
  TEAM_MEMBER_UPDATE: 'team_member_update',
  TEAM_MEMBER_REMOVE: 'team_member_remove'
} as const

export const RESOURCE_TYPES = {
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
  USER: 'user',
  TEAM: 'team',
  SYSTEM: 'system'
} as const