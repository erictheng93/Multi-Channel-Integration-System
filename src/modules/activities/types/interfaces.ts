// Activities Module - Core Interfaces
// 活動模組 - 核心介面定義

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

export interface ActivityQueryParams {
  page?: number | undefined
  pageSize?: number | undefined
  userId?: string | undefined
  action?: string | undefined
  resourceType?: string | undefined
  resourceId?: string | undefined
  startDate?: string | undefined
  endDate?: string | undefined
}

export interface ActivityListResponse {
  items: ActivityLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface UserActivityStats {
  totalActions: number
  actionsByType: Record<string, number>
  recentActions: ActivityLog[]
}

export interface ActivityOverview {
  totalActivities: number
  actionStats: Record<string, number>
  topUsers: Array<{
    userName: string
    userRole: string
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

// Team Activity specific interfaces
export interface TeamActivityParams {
  userId: string
  userName: string
  userRole: string
  teamId: number
  teamName: string
}

export interface TeamCreateActivityParams extends TeamActivityParams {
  description?: string
}

export interface TeamUpdateActivityParams extends TeamActivityParams {
  updates: unknown
}

export interface MemberActivityParams extends TeamActivityParams {
  addedAgentId?: string
  addedAgentName?: string
  removedAgentId?: string
  removedAgentName?: string
}

export interface QRCodeActivityParams extends TeamActivityParams {
  campaignName?: string
}
