// 活動記錄處理器
import { Context } from 'hono'
import type { Bindings } from '../types'
import { ActivityService } from '../services/activity-service'
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse
} from '../utils/api-response'
import { drizzle } from 'drizzle-orm/d1'
import { sql, gte, count } from 'drizzle-orm'
import { activities } from '../db/schema'

export const activityHandler = {
  // 獲取活動記錄列表
  async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload) {
        return errorResponse(c, 'Unauthorized', 401)
      }

      // 解析查詢參數
      const page = parseInt(c.req.query('page') || '1')
      const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100)
      const userId = c.req.query('userId')
      const action = c.req.query('action')
      const resourceType = c.req.query('resourceType')
      const startDate = c.req.query('startDate')
      const endDate = c.req.query('endDate')

      // 權限檢查：只有 admin 可以查看所有活動，其他用戶只能查看自己的
      const filterUserId = payload.role === 'admin' ? userId : payload.userId

      const activityService = new ActivityService(c.env.DB)

      // Build params object with only defined values
      const params: {
        page: number
        pageSize: number
        userId?: string | undefined
        action?: string | undefined
        resourceType?: string | undefined
        startDate?: string | undefined
        endDate?: string | undefined
      } = {
        page,
        pageSize
      }

      if (filterUserId !== undefined) params.userId = filterUserId
      if (action !== undefined) params.action = action
      if (resourceType !== undefined) params.resourceType = resourceType
      if (startDate !== undefined) params.startDate = startDate
      if (endDate !== undefined) params.endDate = endDate

      const result = await activityService.getActivities(params)

      return paginatedResponse(c, result.items, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      })

    } catch (error) {
      console.error('Failed to get activities:', error)
      return errorResponse(c, 'Failed to get activities', 500)
    }
  },

  // 獲取用戶活動統計
  async getUserStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload) {
        return errorResponse(c, 'Unauthorized', 401)
      }

      const targetUserId = c.req.param('userId')
      const days = parseInt(c.req.query('days') || '30')

      // 權限檢查：只有 admin 可以查看其他用戶的統計，其他用戶只能查看自己的
      if (payload.role !== 'admin' && targetUserId !== payload.userId) {
        return errorResponse(c, 'Forbidden', 403)
      }

      const activityService = new ActivityService(c.env.DB)
      const stats = await activityService.getUserActivityStats(targetUserId, days)

      return successResponse(c, stats)

    } catch (error) {
      console.error('Failed to get user activity stats:', error)
      return errorResponse(c, 'Failed to get user activity stats', 500)
    }
  },

  // 清理舊的活動記錄（僅限 admin）
  async cleanup(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', 403)
      }

      const daysToKeep = parseInt(c.req.query('days') || '90')

      if (daysToKeep < 30) {
        return validationErrorResponse(c, [
          { field: 'days', message: 'Must keep at least 30 days of activity logs', value: daysToKeep }
        ])
      }

      const activityService = new ActivityService(c.env.DB)
      const deletedCount = await activityService.cleanupOldActivities(daysToKeep)

      return successResponse(c, { deletedCount }, `Cleaned up ${deletedCount} old activity records`)

    } catch (error) {
      console.error('Failed to cleanup activities:', error)
      return errorResponse(c, 'Failed to cleanup activities', 500)
    }
  },

  // 獲取活動統計概覽（僅限 admin）
  async getOverview(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', 403)
      }

      const days = parseInt(c.req.query('days') || '7')
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString()

      const drizzleDb = drizzle(c.env.DB)

      // 總活動數
      const totalResult = await drizzleDb
        .select({ count: count() })
        .from(activities)
        .where(gte(activities.createdAt, startDateStr))

      // 按操作類型統計
      const actionStats = await drizzleDb
        .select({
          action: activities.action,
          count: count().as('count')
        })
        .from(activities)
        .where(gte(activities.createdAt, startDateStr))
        .groupBy(activities.action)
        .orderBy(sql`count DESC`)

      // 按用戶統計
      const userStats = await drizzleDb
        .select({
          userName: activities.userName,
          userRole: activities.userRole,
          count: count().as('count')
        })
        .from(activities)
        .where(gte(activities.createdAt, startDateStr))
        .groupBy(activities.userId, activities.userName, activities.userRole)
        .orderBy(sql`count DESC`)
        .limit(10)

      // 按日期統計
      const dailyStats = await drizzleDb
        .select({
          date: sql`DATE(${activities.createdAt})`.as('date'),
          count: count().as('count')
        })
        .from(activities)
        .where(gte(activities.createdAt, startDateStr))
        .groupBy(sql`DATE(${activities.createdAt})`)
        .orderBy(sql`date DESC`)

      const overview = {
        totalActivities: totalResult[0]?.count || 0,
        actionStats: actionStats.reduce((acc: Record<string, number>, row: any) => {
          acc[row.action] = row.count
          return acc
        }, {} as Record<string, number>),
        topUsers: userStats,
        dailyStats: dailyStats,
        period: {
          days,
          startDate: startDateStr,
          endDate: new Date().toISOString()
        }
      }

      return successResponse(c, overview)

    } catch (error) {
      console.error('Failed to get activity overview:', error)
      return errorResponse(c, 'Failed to get activity overview', 500)
    }
  }
}