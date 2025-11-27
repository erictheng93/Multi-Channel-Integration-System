/**
 * 統一型別匯出
 * 提供單一入口點存取所有型別定義
 */

// 核心型別
export * from './core'

// 業務實體型別
export * from './entities'

// API 型別
export * from './api'

// 型別別名，確保向後兼容性
export type {
  // 核心型別別名
  Platform,
  UserRole,
  ConversationStatus,
  MessageType,
  SenderType,
  DeliveryStatus,
  Timestamp,
  EntityId
} from './core'

export type {
  // 實體型別別名
  User,
  Customer,
  Agent,
  Conversation,
  Message,
  FileAttachment,
  FileAttachmentData, // 檔案附件資料 (前端 UI 顯示用)
  TeamMember,
  Invitation,
  SystemSettings,
  SystemInfo,
  SystemStats,
  SystemMetrics,
  HealthCheck,
  DatabaseBackup,
  PlatformIntegration
} from './entities'

export type {
  // API 型別別名
  StandardApiResponse,
  PaginatedApiResponse,
  ApiResponse,
  ApiError,
  ValidationError,
  LoginRequest,
  LoginResponse,
  ConversationFilters,
  SendMessageRequest,
  MessageFilters,
  InviteRequest,
  UpdateMemberRequest,
  UpdateSystemSettingsRequest,
  FileUploadRequest,
  FileUploadResponse,
  SearchRequest,
  SearchResult,
  WebhookData,
  StatsRequest,
  ConversationStats,
  MessageStats,
  AgentStats
} from './api'

// 匯出常數
export { API_ERROR_CODES, HTTP_STATUS } from './core'