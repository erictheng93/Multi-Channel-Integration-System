// Activities Module - Activity Handler
// 活動模組 - 活動記錄處理器

import { Context } from 'hono'
import type { Bindings } from '@/types'
import { ActivityService } from '@modules/activities/services/ActivityService'
import { ActivityStatsService } from '@modules/activities/services/ActivityStatsService'
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse
} from '@/utils/api-response'
import { HTTP_STATUS } from '@/constants/http-status'

export class ActivityHandler {
  private activityService: ActivityService
  private statsService: ActivityStatsService

  constructor(database: D1Database) {
    this.activityService = new ActivityService(database)
    this.statsService = new ActivityStatsService(database)
  }

  /**
   * 獲取活動記錄列表
   */
  async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload) {
        return errorResponse(c, 'Unauthorized', HTTP_STATUS.UNAUTHORIZED)
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

      if (filterUserId !== undefined) {
        params.userId = typeof filterUserId === 'string' ? filterUserId : filterUserId.toString()
      }
      if (action !== undefined) params.action = action
      if (resourceType !== undefined) params.resourceType = resourceType
      if (startDate !== undefined) params.startDate = startDate
      if (endDate !== undefined) params.endDate = endDate

      const result = await this.activityService.getActivities(params)

      return paginatedResponse(c, result.items, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      })
    } catch (error) {
      console.error('Failed to get activities:', error)
      if (error instanceof Error && error.message.includes('Invalid query parameters')) {
        return validationErrorResponse(c, [
          { field: 'query', message: error.message, value: null }
        ])
      }
      return errorResponse(c, 'Failed to get activities', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取用戶活動統計
   */
  async getUserStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload) {
        return errorResponse(c, 'Unauthorized', HTTP_STATUS.UNAUTHORIZED)
      }

      const targetUserId = c.req.param('userId')
      const days = parseInt(c.req.query('days') || '30')

      // 權限檢查：只有 admin 可以查看其他用戶的統計，其他用戶只能查看自己的
      if (payload.role !== 'admin' && targetUserId !== payload.userId) {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const stats = await this.activityService.getUserActivityStats(targetUserId, days)

      return successResponse(c, stats)
    } catch (error) {
      console.error('Failed to get user activity stats:', error)
      return errorResponse(c, 'Failed to get user activity stats', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 清理舊的活動記錄（僅限 admin）
   */
  async cleanup(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const daysToKeep = parseInt(c.req.query('days') || '90')

      const deletedCount = await this.activityService.cleanupOldActivities(daysToKeep)

      return successResponse(
        c,
        { deletedCount },
        `Cleaned up ${deletedCount} old activity records`
      )
    } catch (error) {
      console.error('Failed to cleanup activities:', error)
      if (error instanceof Error && error.message.includes('Invalid cleanup parameters')) {
        return validationErrorResponse(c, [
          { field: 'daysToKeep', message: error.message, value: null }
        ])
      }
      return errorResponse(c, 'Failed to cleanup activities', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取活動統計概覽（僅限 admin）
   */
  async getOverview(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '7')
      const overview = await this.statsService.getOverview(days)

      return successResponse(c, overview)
    } catch (error) {
      console.error('Failed to get activity overview:', error)
      return errorResponse(c, 'Failed to get activity overview', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取資源類型統計
   */
  async getResourceStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '30')
      const stats = await this.statsService.getResourceTypeStats(days)

      return successResponse(c, stats)
    } catch (error) {
      console.error('Failed to get resource stats:', error)
      return errorResponse(c, 'Failed to get resource stats', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取用戶角色統計
   */
  async getRoleStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '30')
      const stats = await this.statsService.getUserRoleStats(days)

      return successResponse(c, stats)
    } catch (error) {
      console.error('Failed to get role stats:', error)
      return errorResponse(c, 'Failed to get role stats', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取活動趨勢
   */
  async getTrends(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '30')
      const trends = await this.statsService.getActivityTrends(days)

      return successResponse(c, trends)
    } catch (error) {
      console.error('Failed to get activity trends:', error)
      return errorResponse(c, 'Failed to get activity trends', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取活動熱力圖
   */
  async getHeatmap(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '30')
      const heatmap = await this.statsService.getActivityHeatmap(days)

      return successResponse(c, heatmap)
    } catch (error) {
      console.error('Failed to get activity heatmap:', error)
      return errorResponse(c, 'Failed to get activity heatmap', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取性能指標
   */
  async getMetrics(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const days = parseInt(c.req.query('days') || '7')
      const metrics = await this.statsService.getPerformanceMetrics(days)

      return successResponse(c, metrics)
    } catch (error) {
      console.error('Failed to get activity metrics:', error)
      return errorResponse(c, 'Failed to get activity metrics', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取活動詳情
   */
  async getById(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload) {
        return errorResponse(c, 'Unauthorized', HTTP_STATUS.UNAUTHORIZED)
      }

      const id = parseInt(c.req.param('id'))
      if (isNaN(id)) {
        return validationErrorResponse(c, [
          { field: 'id', message: 'Invalid activity ID', value: c.req.param('id') }
        ])
      }

      const activity = await this.activityService.getActivityById(id)
      if (!activity) {
        return errorResponse(c, 'Activity not found', HTTP_STATUS.NOT_FOUND)
      }

      // 權限檢查：只有 admin 或活動所有者可以查看詳情
      if (payload.role !== 'admin' && activity.userId !== payload.userId) {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      return successResponse(c, activity)
    } catch (error) {
      console.error('Failed to get activity by ID:', error)
      return errorResponse(c, 'Failed to get activity', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 獲取自定義時間段統計
   */
  async getCustomStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload')
      if (!payload || payload.role !== 'admin') {
        return errorResponse(c, 'Forbidden', HTTP_STATUS.FORBIDDEN)
      }

      const startDate = c.req.query('startDate')
      const endDate = c.req.query('endDate')

      if (!startDate || !endDate) {
        return validationErrorResponse(c, [
          { field: 'dateRange', message: 'Start date and end date are required', value: { startDate, endDate } }
        ])
      }

      const stats = await this.statsService.getCustomPeriodStats(startDate, endDate)

      return successResponse(c, stats)
    } catch (error) {
      console.error('Failed to get custom stats:', error)
      return errorResponse(c, 'Failed to get custom stats', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

// 創建處理器實例的工廠函數
export const createActivityHandler = (database: D1Database) => {
  return new ActivityHandler(database)
}

// 導出傳統的處理器對象格式（向後兼容）
export const activityHandler = {
  list: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).list(c),
  getUserStats: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getUserStats(c),
  cleanup: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).cleanup(c),
  getOverview: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getOverview(c),
  getResourceStats: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getResourceStats(c),
  getRoleStats: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getRoleStats(c),
  getTrends: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getTrends(c),
  getHeatmap: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getHeatmap(c),
  getMetrics: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getMetrics(c),
  getById: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getById(c),
  getCustomStats: (c: Context<{ Bindings: Bindings }>) => createActivityHandler(c.env.DB).getCustomStats(c)
}