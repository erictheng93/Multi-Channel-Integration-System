// Messaging 模組統一類型定義
// Unified type definitions for messaging module

// ======================== 基礎訊息類型 ========================

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location';
export type SenderType = 'customer' | 'agent' | 'system';
export type Platform = 'line' | 'facebook' | 'webchat';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'recalled';

// 基礎訊息介面
export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  customerSenderId?: number | null;
  agentSenderId?: string | null;
  content: string;
  messageType: MessageType;
  platformMessageId?: string | null;
  isRecalled: boolean;
  recallDeadline?: string | null;
  recalledAt?: string | null;
  isSent: boolean;
  sentAt?: string | null;
  deliveryStatus: DeliveryStatus;
  replyToMessageId?: string | null;
  metadata?: MessageMetadata;
  createdAt: string;
  updatedAt: string;
}

// 訊息詳細資訊 (包含關聯數據)
export interface MessageWithDetails extends Message {
  senderName?: string;
  senderAvatar?: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  readReceipts?: MessageReadReceipt[];
}

// 訊息列表項目 (用於列表顯示)
export interface MessageListItem extends Message {
  senderName?: string;
  senderAvatar?: string;
  attachmentCount: number;
  hasReactions: boolean;
  isRead: boolean;
}

// ======================== 訊息元數據 ========================

export interface MessageMetadata {
  // 平台特定資訊
  platform?: {
    messageId?: string;
    threadId?: string;
    userId?: string;
  };

  // 附件資訊
  attachments?: {
    url: string;
    type: MessageType;
    size?: number;
    filename?: string;
    thumbnailUrl?: string;
  }[];

  // 位置資訊
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    title?: string;
  };

  // 貼圖資訊
  sticker?: {
    packageId: string;
    stickerId: string;
    stickerResourceType?: string;
  };

  // 自訂欄位
  customFields?: {
    [key: string]: unknown;
  };
}

// ======================== 訊息召回類型 ========================

export interface MessageRecall {
  id: string;
  messageId: string;
  conversationId: string;
  requestedBy: string;
  reason?: string;
  status: 'pending' | 'successful' | 'failed' | 'expired';
  failureReason?: string;
  recalledAt?: string;
  createdAt: string;
}

// 召回請求
export interface RecallRequest {
  messageId: string;
  reason?: string;
}

// 召回回應
export interface RecallResponse {
  success: boolean;
  messageId: string;
  recalledAt?: string;
  error?: string;
  canRecall: boolean;
  recallDeadline?: string;
}

// ======================== 批量操作類型 ========================

export interface BatchMessageOperation {
  id: string;
  type: 'send' | 'recall' | 'update';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  createdBy: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  results: BatchOperationResult[];
}

export interface BatchOperationResult {
  itemId: string;
  status: 'success' | 'failed';
  result?: unknown;
  error?: string;
}

// 批量發送請求
export interface BatchSendRequest {
  messages: {
    conversationId: string;
    content: string;
    messageType?: MessageType;
    metadata?: Partial<MessageMetadata>;
  }[];
}

// ======================== 訊息搜尋類型 ========================

export interface MessageSearchQuery {
  conversationId?: string;
  content?: string;
  senderType?: SenderType;
  senderId?: string;
  messageType?: MessageType;
  dateFrom?: string;
  dateTo?: string;
  isRecalled?: boolean;
  deliveryStatus?: DeliveryStatus;
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
}

export interface MessageSearchResult {
  messages: MessageWithDetails[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ======================== 訊息統計類型 ========================

export interface MessageStats {
  total: number;
  byType: Record<MessageType, number>;
  bySender: Record<SenderType, number>;
  byStatus: Record<DeliveryStatus, number>;
  byPlatform: Record<Platform, number>;
  recalled: number;
  withAttachments: number;
  averageResponseTime: number; // 毫秒
  peakHours: { hour: number; count: number }[];
}

export interface ConversationMessageStats {
  conversationId: string;
  totalMessages: number;
  customerMessages: number;
  agentMessages: number;
  systemMessages: number;
  lastMessageAt?: string;
  averageResponseTime: number;
}

// ======================== 附件和反應類型 ========================

export interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  reaction: string; // emoji
  createdAt: string;
}

export interface MessageReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// ======================== API 回應類型 ========================

export interface MessageResponse {
  message: MessageWithDetails;
}

export interface MessageListResponse {
  messages: MessageListItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats?: {
    totalMessages: number;
    unreadCount: number;
  };
}

// ======================== 權限和驗證類型 ========================

export interface MessagePermissions {
  canSend: boolean;
  canRecall: boolean;
  canViewHistory: boolean;
  canBatchOperation: boolean;
  canAccessStats: boolean;
}

export interface MessageAccessScope {
  conversationIds?: string[];
  teamIds?: number[];
  platforms?: Platform[];
  isGlobalAccess: boolean;
}

// ======================== 驗證規則類型 ========================

export interface MessageValidationRules {
  content: {
    maxLength: number;
    minLength: number;
    allowedTypes: MessageType[];
  };
  attachments: {
    maxSize: number; // bytes
    allowedMimeTypes: string[];
    maxCount: number;
  };
  batch: {
    maxBatchSize: number;
    maxConcurrentBatches: number;
  };
}

// ======================== 錯誤類型 ========================

export interface MessageError extends Error {
  code:
    | 'MESSAGE_NOT_FOUND'
    | 'INVALID_MESSAGE_DATA'
    | 'PERMISSION_DENIED'
    | 'RECALL_DEADLINE_EXCEEDED'
    | 'BATCH_OPERATION_FAILED'
    | 'QUOTA_EXCEEDED';
  details?: unknown;
}

export class MessageNotFoundError extends Error implements MessageError {
  code = 'MESSAGE_NOT_FOUND' as const;
  constructor(messageId: string) {
    super(`Message with ID ${messageId} not found`);
  }
}

export class RecallDeadlineExceededError extends Error implements MessageError {
  code = 'RECALL_DEADLINE_EXCEEDED' as const;
  constructor(messageId: string, deadline: string) {
    super(`Cannot recall message ${messageId}, deadline ${deadline} has passed`);
  }
}

export class InvalidMessageDataError extends Error implements MessageError {
  code = 'INVALID_MESSAGE_DATA' as const;
  constructor(message: string, public details?: unknown) {
    super(message);
  }
}

// ======================== 預設驗證規則 ========================

export const DEFAULT_MESSAGE_VALIDATION: MessageValidationRules = {
  content: {
    maxLength: 5000,
    minLength: 1,
    allowedTypes: ['text', 'image', 'video', 'audio', 'file', 'sticker'],
  },
  attachments: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain'
    ],
    maxCount: 5,
  },
  batch: {
    maxBatchSize: 100,
    maxConcurrentBatches: 5,
  },
} as const;

// ======================== 模組資訊 ========================

export const MESSAGING_MODULE_INFO = {
  name: 'messaging',
  version: '1.0.0',
  description: 'Unified messaging module with delayed send, recall, and batch operations',
  supportedPlatforms: ['line', 'facebook', 'webchat'] as Platform[],
  features: [
    'Real-time messaging',
    'Delayed message sending (1-120 seconds)',
    'Message recall functionality',
    'Batch operations',
    'File attachments',
    'Message search and filtering',
    'Statistics and analytics',
    'Multi-platform support',
  ],
  dependencies: [
    '../../shared/database/schema',
    '../../shared/utils/api-response',
    '../../shared/types',
    'drizzle-orm',
    'hono',
  ],
} as const;
