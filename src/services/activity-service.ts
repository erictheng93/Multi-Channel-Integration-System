// 活動記錄服務

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
  async logActivity(request: CreateActivityRequest): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO activities (
            user_id, user_name, user_role, action, resource_type, 
            resource_id, details, ip_address, user_agent, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          request.userId,
          request.userName,
          request.userRole,
          request.action,
          request.resourceType,
          request.resourceId || null,
          request.details ? JSON.stringify(request.details) : null,
          request.ipAddress || null,
          request.userAgent || null
        )
        .run()
    } catch (error) {
      console.error('Failed to log activity:', error)
      // 不拋出錯誤，避免影響主要業務流程
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

    // 構建查詢條件
    const conditions: string[] = []
    const bindings: unknown[] = []

    if (userId) {
      conditions.push('user_id = ?')
      bindings.push(userId)
    }

    if (action) {
      conditions.push('action = ?')
      bindings.push(action)
    }

    if (resourceType) {
      conditions.push('resource_type = ?')
      bindings.push(resourceType)
    }

    if (startDate) {
      conditions.push('created_at >= ?')
      bindings.push(startDate)
    }

    if (endDate) {
      conditions.push('created_at <= ?')
      bindings.push(endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 獲取總數
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as count FROM activities ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>()

    const total = countResult?.count || 0
    const totalPages = Math.ceil(total / pageSize)
    const offset = (page - 1) * pageSize

    // 獲取活動記錄
    const activities = await this.db
      .prepare(`
        SELECT 
          id, user_id, user_name, user_role, action, resource_type,
          resource_id, details, ip_address, user_agent, created_at
        FROM activities 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...bindings, pageSize, offset)
      .all<{
        id: number
        user_id: string
        user_name: string
        user_role: string
        action: string
        resource_type: string
        resource_id: string | null
        details: string | null
        ip_address: string | null
        user_agent: string | null
        created_at: string
      }>()

    const items: ActivityLog[] = activities.results.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      createdAt: row.created_at
    }))

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

    // 總操作數
    const totalResult = await this.db
      .prepare(`
        SELECT COUNT(*) as count 
        FROM activities 
        WHERE user_id = ? AND created_at >= ?
      `)
      .bind(userId, startDateStr)
      .first<{ count: number }>()

    const totalActions = totalResult?.count || 0

    // 按操作類型統計
    const actionStats = await this.db
      .prepare(`
        SELECT action, COUNT(*) as count 
        FROM activities 
        WHERE user_id = ? AND created_at >= ?
        GROUP BY action
        ORDER BY count DESC
      `)
      .bind(userId, startDateStr)
      .all<{ action: string; count: number }>()

    const actionsByType: Record<string, number> = {}
    actionStats.results.forEach(row => {
      actionsByType[row.action] = row.count
    })

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

    const result = await this.db
      .prepare('DELETE FROM activities WHERE created_at < ?')
      .bind(cutoffDateStr)
      .run()

    return result.meta.changes || 0
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