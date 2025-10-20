/**
 * 核心業務型別定義
 * 平台無關的基礎型別，供整個專案使用
 */

// 基礎枚舉型別
export type Platform = 'line' | 'facebook'
export type UserRole = 'admin' | 'agent' // Simplified from 3-tier (admin/team/agent) to 2-tier (admin/agent)
export type ConversationStatus = 'open' | 'assigned' | 'closed'
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker'
export type SenderType = 'user' | 'agent' | 'system' | 'customer' // 保留 customer 以支援現有代碼
export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed'

// 時間戳類型
export type Timestamp = number // Unix timestamp in milliseconds

// ID 類型
export type EntityId = string
export type DatabaseId = number

// 狀態類型
export type ConnectionStatus = 'connected' | 'disconnected' | 'error'
export type UploadStatus = 'pending' | 'uploaded' | 'failed' | 'deleted'
export type InvitationStatus = 'pending' | 'used' | 'expired'

// 系統設定相關
export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'zh-TW' | 'en' | 'zh-CN'
export type Density = 'compact' | 'comfortable' | 'spacious'

// 錯誤代碼
export const API_ERROR_CODES = {
  // 認證相關
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // 驗證相關
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // 資源相關
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // 系統相關
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

// HTTP 狀態碼
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]