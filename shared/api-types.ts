// 前後端共用的 API 類型定義
// 確保前後端接口契約一致

// 使用統一的型別定義
export * from './types'

// 向後兼容性別名
export type {
  StandardApiResponse,
  PaginatedApiResponse,
  ApiResponse,
  ApiError,
  ValidationError,
  LoginRequest,
  LoginResponse,
  Agent,
  User,
  Conversation,
  Message,
  ConversationFilters,
  SendMessageRequest,
  MessageFilters,
  UpdateMemberRequest,
  FileAttachment,
  TeamMember,
  SystemSettings,
  SystemInfo,
  SystemMetrics,
  HealthCheck,
  DatabaseBackup
} from './types'

// 所有型別現在從統一的型別系統匯出
// 這確保了型別定義的一致性和可維護性