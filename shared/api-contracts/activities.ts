import { defineApiContract } from './core'

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

export interface ActivityPageResponse {
  items: ActivityLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore?: boolean
}

export function buildActivityQuery(params: ActivityFilters | { days?: number }): string {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      search.append(key, value.toString())
    }
  })

  const queryString = search.toString()
  return queryString ? `?${queryString}` : ''
}

export const activityContracts = {
  list: defineApiContract<ActivityFilters, void, ActivityPageResponse>({
    method: 'GET',
    path: filters => `/activities${buildActivityQuery(filters)}`
  }),

  getUserStats: defineApiContract<{ userId: string; days?: number }, void, ActivityStats>({
    method: 'GET',
    path: ({ userId, days }) =>
      `/activities/users/${encodeURIComponent(userId)}/stats${buildActivityQuery({ days })}`
  }),

  getOverview: defineApiContract<{ days?: number }, void, ActivityOverview>({
    method: 'GET',
    path: ({ days }) => `/activities/overview${buildActivityQuery({ days })}`
  }),

  cleanup: defineApiContract<{ days?: number }, void, { deletedCount: number }>({
    method: 'DELETE',
    path: ({ days }) => `/activities/cleanup${buildActivityQuery({ days })}`
  })
} as const
