/**
 * 業務實體型別定義
 * 統一的業務實體結構，確保前後端一致性
 */

import type {
  Platform,
  UserRole,
  ConversationStatus,
  MessageType,
  SenderType,
  DeliveryStatus,
  ConnectionStatus,
  UploadStatus,
  InvitationStatus,
  Theme,
  Language,
  Density,
  Timestamp,
  EntityId
} from './core'

// 用戶相關
export interface User {
  id: EntityId
  name: string
  platform: Platform
  platformUserId: string
  avatarUrl?: string
  createdAt: Timestamp
}

// 向後兼容別名
export type Customer = User

export interface Agent {
  id: EntityId
  email: string
  name: string
  displayName: string
  role: UserRole
  teamId?: number
  isActive: boolean
  isOnline?: boolean // 向後兼容字段
  platforms?: Platform[] // 向後兼容字段
  createdAt: Timestamp
  lastActive?: Timestamp
}

// 團隊資訊（簡化版）
export interface TeamInfo {
  id: number
  name: string
  description?: string | null
}

// 對話相關
export interface Conversation {
  id: EntityId
  userId: EntityId
  user?: User
  customer?: User // 向後兼容別名
  assignedTo?: EntityId
  assignedAgent?: Agent
  assignedAgentId?: EntityId // 向後兼容字段
  assignedUserId?: EntityId // 🆕 資料庫欄位名稱 (與 assignedAgentId 同義)
  assignedTeamId?: number // 🆕 團隊指派欄位
  assignedTeam?: TeamInfo | null // 🆕 團隊資訊 (包含完整資訊)
  status: ConversationStatus
  platform?: Platform // 向後兼容字段
  lastMessageAt: Timestamp
  lastMessage?: Message // 向後兼容字段
  unreadCount: number
  createdAt: Timestamp | Date // 支援兩種格式
  updatedAt: Timestamp | Date // 支援兩種格式
}

// 訊息附件 metadata 類型
export interface MessageAttachment {
  url?: string
  name?: string
  size?: number
  type?: string
}

export interface MessageMetadata {
  attachment?: MessageAttachment
  isRead?: boolean
  [key: string]: unknown
}

// 檔案附件資料 - 用於前端 UI 顯示 (Flex Message Card)
export interface FileAttachmentData {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  fileUrl: string
}

export interface Message {
  id: EntityId
  conversationId: EntityId
  senderType: SenderType
  senderId: EntityId
  content: string
  messageType: MessageType
  mediaUrl?: string
  platform: Platform
  timestamp: Timestamp | Date // 支援兩種格式
  createdAt: Timestamp | Date // 支援兩種格式
  updatedAt?: Timestamp | Date // 支援兩種格式
  deliveryStatus?: DeliveryStatus
  status?: DeliveryStatus // 別名，向後兼容
  metadata?: MessageMetadata
  attachments?: MessageAttachment[] // 附件陣列 (legacy)
  file_attachments?: FileAttachmentData[] // 檔案附件陣列 (新格式，用於 Flex Message Card 顯示)
  senderName?: string // 發送者名稱，用於 UI 顯示
}

// 檔案附件
export interface FileAttachment {
  id: EntityId
  messageId: EntityId
  conversationId: EntityId
  originalFilename: string
  storedFilename: string
  fileSize: number
  mimeType: string
  fileExtension: string
  storagePath: string
  storageUrl: string
  uploadStatus: UploadStatus
  uploadedBy: EntityId
  createdAt: Timestamp
  updatedAt: Timestamp
}

// 團隊管理
export interface TeamMember {
  id: EntityId
  email: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: Date
  lastActive?: Date
}

export interface Invitation {
  id: EntityId
  email: string
  name: string
  role: UserRole
  token: string
  createdAt: Date
  expiresAt: Date
  usedAt?: Date
  invitedByName: string
  status: InvitationStatus
}

// 系統設定
export interface SystemSettings {
  theme: Theme
  language: Language
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
    email: boolean
  }
  autoRefresh: {
    enabled: boolean
    interval: number // in seconds
  }
  display: {
    density: Density
    showAvatars: boolean
    showTimestamps: boolean
    messagePreview: boolean
  }
}

export interface SystemInfo {
  version: string
  environment: string
  lastUpdate: string
  dbStatus: ConnectionStatus
  cacheStatus: ConnectionStatus
  uptime: number
}

export interface SystemStats {
  totalConversations: number
  activeAgents: number
  responseTime: number
  satisfaction: number
  uptime: number
}

export interface SystemMetrics {
  activeUsers: number
  totalConversations: number
  messagesToday: number
  averageResponseTime: number
  systemLoad: number
  errorRate: number
}

// 健康檢查
export interface HealthCheck {
  status: 'healthy' | 'unhealthy'
  checks: {
    database: boolean
    cache: boolean
    integrations: {
      line: boolean
      facebook: boolean
    }
  }
  timestamp: string
}

// 備份
export interface DatabaseBackup {
  id: EntityId
  filename: string
  size: number
  createdAt: string
}

// 平台整合設定
export interface PlatformIntegration {
  line?: {
    channelId: string
    channelSecret: string
    accessToken: string
    status: ConnectionStatus
  }
  facebook?: {
    appId: string
    appSecret: string
    pageId: string
    pageToken: string
    status: ConnectionStatus
  }
}