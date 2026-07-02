// Delayed Message Module - Type Definitions
// 延遲訊息模組 - 型別定義

export interface DelayedMessageRequest {
  conversationId: string;
  content: string;
  delaySeconds: number; // range: DELAYED_MESSAGE_LIMITS (1-300 seconds)
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
  senderId: string;
  recipientPlatformId: string;
  platform: 'line' | 'facebook';
}

export interface DelayedMessageEntity {
  id: string;
  conversationId: string;
  agentId: string;
  content: string;
  messageType: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  cancelledAt?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  scheduledSendTime?: string;
  recallDeadline?: string;
}

export interface RecallResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recallDeadline?: string;
}

export interface ProcessResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface PendingMessagesResult {
  items: DelayedMessageEntity[];
  total: number;
  page: number;
  pageSize: number;
}

// Event Types for Broadcasting
export interface DelayedMessageEvent {
  type: 'delayed_message_countdown' | 'delayed_message_recalled' | 'delayed_message_sent' | 'delayed_message_failed';
  conversationId: string;
  messageId: string;
  agentId: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
}

// Storage Interface
export interface DelayedMessageStorage {
  saveMessage(message: DelayedMessageEntity): Promise<boolean>;
  getMessageById(messageId: string): Promise<DelayedMessageEntity | null>;
  updateMessageStatus(messageId: string, status: string, timestamp: Date): Promise<boolean>;
  getPendingMessages(agentId: string, page: number, pageSize: number): Promise<PendingMessagesResult>;
  markAsRecallable(messageId: string, recallInfo: RecallInfo): Promise<boolean>;
  checkRecallable(messageId: string): Promise<RecallInfo | null>;
  markAsCancelled(messageId: string, cancelInfo: CancelInfo): Promise<boolean>;
  isCancelled(messageId: string): Promise<boolean>;
  cleanup(messageId: string): Promise<boolean>;
}

export interface RecallInfo {
  recallable: boolean;
  expiresAt: string;
  conversationId: string;
  senderId: string;
  platform: string;
}

export interface CancelInfo {
  cancelled: boolean;
  cancelledAt: string;
  cancelledBy: string;
}

// Validation Rules
export interface ValidationRule<T> {
  validate(value: T): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Platform Message Interface
export interface PlatformMessageSender {
  sendMessage(messageData: PlatformMessageData): Promise<boolean>;
  platform: 'line' | 'facebook';
}

export interface PlatformMessageData {
  recipientId: string;
  content: string;
  messageType: string;
  mediaUrl?: string;
}

// Error Types
export class DelayedMessageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DelayedMessageError';
  }
}

export class ValidationError extends DelayedMessageError {
  constructor(message: string, public field: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class StorageError extends DelayedMessageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class SchedulingError extends DelayedMessageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCHEDULING_ERROR', details);
    this.name = 'SchedulingError';
  }
}

export class ProcessingError extends DelayedMessageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROCESSING_ERROR', details);
    this.name = 'ProcessingError';
  }
}