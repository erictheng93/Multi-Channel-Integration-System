// Activities Module - Core Activity Service
// 活動模組 - 核心活動記錄服務

import { eq, and, gte, lte, desc, count, lt, sql } from 'drizzle-orm'
import { createDbClient } from '../../../db/drizzle-factory'
import { activities } from '@/db/schema'
import {
  ActivityLog,
  CreateActivityRequest,
  ActivityQueryParams,
  ActivityListResponse,
  UserActivityStats
} from '../types/interfaces'
import { ActivityValidator } from '@modules/activities/utils/validators'
import { ACTIVITY_ACTIONS } from '@modules/activities/constants/actions'
import { RESOURCE_TYPES } from '@modules/activities/constants/resources'

export class ActivityService {
  constructor(private db: D1Database) {}

  /**
   * 記錄活動
   */
  async logActivity(request: CreateActivityRequest): Promise<ActivityLog | null> {
    try {
      // 驗證請求數據
      const validationErrors = ActivityValidator.validateCreateRequest(request)
      if (validationErrors.length > 0) {
        console.warn('❌ [Activity Service] Validation failed:', validationErrors)
        return null
      }

      const drizzleDb = createDbClient(this.db)
      const timestamp = new Date().toISOString()

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
        .returning({ id: activities.id })

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

  /**
   * 獲取活動記錄列表
   */
  async getActivities(params: ActivityQueryParams = {}): Promise<ActivityListResponse> {
    // 驗證查詢參數
    const validationErrors = ActivityValidator.validateQueryParams(params)
    if (validationErrors.length > 0) {
      throw new Error(`Invalid query parameters: ${validationErrors.map(e => e.message).join(', ')}`)
    }

    const {
      page = 1,
      pageSize = 50,
      userId,
      action,
      resourceType,
      startDate,
      endDate
    } = params

    const drizzleDb = createDbClient(this.db)
    const conditions = []

    if (userId) {
      conditions.push(eq(activities.userId, userId))
    }

    if (action) {
      conditions.push(eq(activities.action, action))
    }

    if (resourceType) {
      conditions.push(eq(activities.resourceType, resourceType))
    }

    if (startDate) {
      conditions.push(gte(activities.createdAt, startDate))
    }

    if (endDate) {
      conditions.push(lte(activities.createdAt, endDate))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // 獲取總數
    const [totalResult] = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(whereCondition)

    const total = totalResult?.count || 0
    const totalPages = Math.ceil(total / pageSize)
    const offset = (page - 1) * pageSize

    // 獲取活動記錄
    const activityList = await drizzleDb
      .select()
      .from(activities)
      .where(whereCondition)
      .orderBy(desc(activities.createdAt))
      .limit(pageSize)
      .offset(offset)

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
    }))

    return {
      items,
      total,
      page,
      pageSize,
      totalPages
    }
  }

  /**
   * 獲取用戶活動統計
   */
  async getUserActivityStats(userId: string, days = 30): Promise<UserActivityStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = createDbClient(this.db)
    const conditions = and(
      eq(activities.userId, userId),
      gte(activities.createdAt, startDateStr)
    )

    // 總操作數
    const [totalResult] = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(conditions)

    const totalActions = totalResult?.count || 0

    // 按操作類型統計
    const actionStats = await drizzleDb.run(sql`
        SELECT action, COUNT(*) as count
        FROM activities
        WHERE user_id = ${userId} AND created_at >= ${startDateStr}
        GROUP BY action
        ORDER BY count DESC
      `)

    const actionsByType: Record<string, number> = {}
    ;(actionStats.results || []).forEach((row: any) => {
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

  /**
   * 清理舊的活動記錄
   */
  async cleanupOldActivities(daysToKeep = 90): Promise<number> {
    // 驗證參數
    const validationErrors = ActivityValidator.validateCleanupParams(daysToKeep)
    if (validationErrors.length > 0) {
      throw new Error(`Invalid cleanup parameters: ${validationErrors.map(e => e.message).join(', ')}`)
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffDateStr = cutoffDate.toISOString()

    const drizzleDb = createDbClient(this.db)

    // 先查詢要刪除的記錄數量
    const toDeleteCount = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(lt(activities.createdAt, cutoffDateStr))

    // 執行刪除操作
    await drizzleDb
      .delete(activities)
      .where(lt(activities.createdAt, cutoffDateStr))

    const deletedCount = toDeleteCount[0]?.count || 0
    console.log(`✅ [Activity Service] Cleaned up ${deletedCount} old activities`)

    return deletedCount
  }

  /**
   * 批次記錄活動
   */
  async logBatchActivities(requests: CreateActivityRequest[]): Promise<ActivityLog[]> {
    const results: ActivityLog[] = []

    for (const request of requests) {
      const result = await this.logActivity(request)
      if (result) {
        results.push(result)
      }
    }

    return results
  }

  /**
   * 檢查活動是否存在
   */
  async activityExists(id: number): Promise<boolean> {
    const drizzleDb = createDbClient(this.db)
    const result = await drizzleDb
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1)

    return result.length > 0
  }

  /**
   * 獲取活動詳情
   */
  async getActivityById(id: number): Promise<ActivityLog | null> {
    const drizzleDb = createDbClient(this.db)
    const result = await drizzleDb
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    const row = result[0]
    if (!row) {
      throw new Error('Activity not found')
    }
    return {
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
    }
  }

  // 導出常數供外部使用
  static get ACTIONS() {
    return ACTIVITY_ACTIONS
  }

  static get RESOURCE_TYPES() {
    return RESOURCE_TYPES
  }
}