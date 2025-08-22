// 活動記錄 API 客戶端
import { apiClient } from './base'
import type { ApiResponse, PaginatedResponse } from '@/types'

export interface ActivityLog {
  id: number
  userId: string
  userName: string
  userRole: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface ActivityFilters {
  userId?: string
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface ActivityStats {
  totalActions: number
  actionsByType: Record<string, number>
  recentActions: ActivityLog[]
}

export interface ActivityOverview {
  totalActivities: number
  actionStats: Record<string, number>
  topUsers: Array<{
    user_name: string
    user_role: string
    count: number
  }>
  dailyStats: Array<{
    date: string
    count: number
  }>
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

// Input validation helper
const validateActivityFilters = (filters: ActivityFilters): ActivityFilters => {
  const validated: ActivityFilters = {}
  
  if (filters.page && filters.page > 0 && filters.page <= 10000) {
    validated.page = Math.floor(filters.page)
  }
  if (filters.pageSize && filters.pageSize > 0 && filters.pageSize <= 100) {
    validated.pageSize = Math.floor(filters.pageSize)
  }
  if (filters.userId && /^[a-zA-Z0-9-_]+$/.test(filters.userId)) {
    validated.userId = filters.userId
  }
  if (filters.action && /^[a-zA-Z_]+$/.test(filters.action)) {
    validated.action = filters.action
  }
  if (filters.resourceType && /^[a-zA-Z_]+$/.test(filters.resourceType)) {
    validated.resourceType = filters.resourceType
  }
  if (filters.startDate && !isNaN(Date.parse(filters.startDate))) {
    validated.startDate = filters.startDate
  }
  if (filters.endDate && !isNaN(Date.parse(filters.endDate))) {
    validated.endDate = filters.endDate
  }
  
  return validated
}

export const activitiesApi = {
  // 獲取活動記錄列表
  list: async (filters: ActivityFilters = {}): Promise<ApiResponse<PaginatedResponse<ActivityLog>>> => {
    const validatedFilters = validateActivityFilters(filters)
    const params = new URLSearchParams()
    
    Object.entries(validatedFilters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString())
      }
    })

    const queryString = params.toString()
    return apiClient.get(`/api/activities${queryString ? `?${queryString}` : ''}`)
  },

  // 獲取用戶活動統計
  getUserStats: async (userId: string, days = 30): Promise<ApiResponse<ActivityStats>> => {
    // Validate userId format
    if (!userId || !/^[a-zA-Z0-9-_]+$/.test(userId)) {
      return { success: false, error: 'Invalid user ID format' }
    }
    
    // Validate days parameter
    const validDays = Math.max(1, Math.min(365, Math.floor(days)))
    
    const params = new URLSearchParams()
    if (validDays !== 30) { params.append('days', validDays.toString()) }
    
    const queryString = params.toString()
    return apiClient.get(`/api/activities/users/${encodeURIComponent(userId)}/stats${queryString ? `?${queryString}` : ''}`)
  },

  // 獲取活動統計概覽（僅限管理員）
  getOverview: async (days = 7): Promise<ApiResponse<ActivityOverview>> => {
    // Validate days parameter
    const validDays = Math.max(1, Math.min(365, Math.floor(days)))
    
    const params = new URLSearchParams()
    if (validDays !== 7) { params.append('days', validDays.toString()) }
    
    const queryString = params.toString()
    return apiClient.get(`/api/activities/overview${queryString ? `?${queryString}` : ''}`)
  },

  // 清理舊的活動記錄（僅限管理員）
  cleanup: async (daysToKeep = 90): Promise<ApiResponse<{ deletedCount: number }>> => {
    // Validate daysToKeep parameter (minimum 30 days for safety)
    const validDays = Math.max(30, Math.min(3650, Math.floor(daysToKeep)))
    
    const params = new URLSearchParams()
    if (validDays !== 90) { params.append('days', validDays.toString()) }
    
    const queryString = params.toString()
    return apiClient.delete(`/api/activities/cleanup${queryString ? `?${queryString}` : ''}`)
  },

  // 匯出活動記錄
  export: async (filters: ActivityFilters = {}): Promise<ApiResponse<Blob>> => {
    // Validate and sanitize filters
    const validatedFilters: ActivityFilters = {}
    
    if (filters.userId && /^[a-zA-Z0-9-_]+$/.test(filters.userId)) {
      validatedFilters.userId = filters.userId
    }
    if (filters.action && /^[a-zA-Z_]+$/.test(filters.action)) {
      validatedFilters.action = filters.action
    }
    if (filters.resourceType && /^[a-zA-Z_]+$/.test(filters.resourceType)) {
      validatedFilters.resourceType = filters.resourceType
    }
    if (filters.startDate && !isNaN(Date.parse(filters.startDate))) {
      validatedFilters.startDate = filters.startDate
    }
    if (filters.endDate && !isNaN(Date.parse(filters.endDate))) {
      validatedFilters.endDate = filters.endDate
    }

    const params = new URLSearchParams()
    Object.entries(validatedFilters).forEach(([key, value]) => {
      if (value) { params.append(key, value) }
    })

    const queryString = params.toString()
    
    try {
      // Use apiClient for consistent authentication
      const response = await fetch(`/api/activities/export${queryString ? `?${queryString}` : ''}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Accept': 'text/csv'
        }
      })

      if (!response.ok) {
        // Sanitize error messages to prevent information disclosure
        const sanitizedError = response.status === 403 
          ? 'Access denied' 
          : response.status === 404 
          ? 'Export endpoint not found'
          : 'Export failed'
        return { success: false, error: sanitizedError }
      }

      const blob = await response.blob()
      return { success: true, data: blob }
    } catch (error) {
      return { 
        success: false, 
        error: 'Export request failed' // Generic error message
      }
    }
  }
}