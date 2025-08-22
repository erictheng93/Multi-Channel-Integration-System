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

      const db = c.env.DB

      // 總活動數
      const totalResult = await db
        .prepare('SELECT COUNT(*) as count FROM activities WHERE created_at >= ?')
        .bind(startDateStr)
        .first<{ count: number }>()

      // 按操作類型統計
      const actionStats = await db
        .prepare(`
          SELECT action, COUNT(*) as count 
          FROM activities 
          WHERE created_at >= ?
          GROUP BY action
          ORDER BY count DESC
        `)
        .bind(startDateStr)
        .all<{ action: string; count: number }>()

      // 按用戶統計
      const userStats = await db
        .prepare(`
          SELECT user_name, user_role, COUNT(*) as count 
          FROM activities 
          WHERE created_at >= ?
          GROUP BY user_id, user_name, user_role
          ORDER BY count DESC
          LIMIT 10
        `)
        .bind(startDateStr)
        .all<{ user_name: string; user_role: string; count: number }>()

      // 按日期統計
      const dailyStats = await db
        .prepare(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM activities 
          WHERE created_at >= ?
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `)
        .bind(startDateStr)
        .all<{ date: string; count: number }>()

      const overview = {
        totalActivities: totalResult?.count || 0,
        actionStats: actionStats.results.reduce((acc, row) => {
          acc[row.action] = row.count
          return acc
        }, {} as Record<string, number>),
        topUsers: userStats.results,
        dailyStats: dailyStats.results,
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