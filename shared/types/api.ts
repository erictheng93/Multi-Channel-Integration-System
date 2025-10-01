/**
 * API 專用型別定義
 * 統一的 API 請求/響應格式
 */

import type { ApiErrorCode, Timestamp, EntityId } from './core'
import type { Agent } from './entities'

// 標準 API 響應格式
export interface StandardApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
  requestId?: string
  metadata?: {
    errorCode?: string
    processedAt?: string
    queryTime?: number
    cacheHit?: boolean
    totalRecords?: number
    [key: string]: unknown
  }
}

// 分頁響應格式
export interface PaginatedApiResponse<T = unknown> extends StandardApiResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 前端專用 API 響應（包含狀態碼）
export interface ApiResponse<T = unknown> extends StandardApiResponse<T> {
  status?: number // 接受任何數字狀態碼，確保向後兼容
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// API 錯誤
export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
  field?: string
}

export interface ValidationError extends ApiError {
  field: string
  value?: unknown
}

// 認證相關 API
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  refreshToken?: string
  agent: Agent
  mustChangePassword?: boolean
  tempToken?: string
}

// 對話相關 API
export interface ConversationFilters {
  status?: string
  assignedTo?: string
  platform?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface ConversationListRequest {
  page?: number
  limit?: number
  filters?: ConversationFilters
}

export interface ConversationAssignRequest {
  conversationId: EntityId
  agentId: EntityId
}

// 訊息相關 API
export interface SendMessageRequest {
  content: string
  messageType?: string
  platform?: string
  mediaUrl?: string
}

export interface MessageFilters {
  conversationId?: EntityId
  senderType?: string
  platform?: string
  messageType?: string
  dateFrom?: string
  dateTo?: string
}

// 團隊管理 API
export interface InviteRequest {
  email: string
  name: string
  role: 'admin' | 'agent'
}

export interface UpdateMemberRequest {
  name?: string
  role?: 'admin' | 'agent'
  isActive?: boolean
}

// 系統設定 API
export interface UpdateSystemSettingsRequest {
  general?: {
    systemName?: string
    contactEmail?: string
    timezone?: string
    language?: string
  }
  integrations?: {
    line?: {
      channelId?: string
      channelSecret?: string
      accessToken?: string
    }
    facebook?: {
      appId?: string
      appSecret?: string
      pageId?: string
      pageToken?: string
    }
  }
  advanced?: {
    messageQueueSize?: number
    messageTimeout?: number
    cacheExpiry?: number
    sessionExpiry?: number
    enableRateLimit?: boolean
    enableLogging?: boolean
    enableMetrics?: boolean
  }
}

// 檔案上傳 API
export interface FileUploadRequest {
  file: File
  conversationId: EntityId
  messageType?: string
}

export interface FileUploadResponse {
  fileId: EntityId
  filename: string
  fileSize: number
  mimeType: string
  storageUrl: string
}

// 搜尋 API
export interface SearchRequest {
  query: string
  type?: 'conversations' | 'messages' | 'users'
  filters?: Record<string, unknown>
  page?: number
  limit?: number
}

export interface SearchResult<T> {
  items: T[]
  total: number
  query: string
  searchTime: number
}

// Webhook 相關
export interface WebhookData {
  platform: string
  userId: string
  userName: string
  message: string
  mediaUrl?: string
  timestamp: Timestamp
}

// 統計和報告 API
export interface StatsRequest {
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month'
}

export interface ConversationStats {
  total: number
  active: number
  closed: number
  averageResponseTime: number
  satisfactionScore: number
}

export interface MessageStats {
  total: number
  byType: Record<string, number>
  byPlatform: Record<string, number>
  byHour: Record<string, number>
}

export interface AgentStats {
  totalAgents: number
  activeAgents: number
  averageHandlingTime: number
  conversationsPerAgent: Record<string, number>
}