// Session 模組類型定義
// 對話會話管理相關的所有類型和介面

import type { Bindings } from '@/types';
import type { Context } from 'hono';

// ======================== 基礎類型 ========================

/**
 * 對話會話基礎資訊
 */
export interface ConversationSession {
  id: string;
  conversationId: string;
  sessionType: 'continuous' | 'scheduled' | 'support' | 'marketing';
  topic?: string | null;
  startTime: string;
  endTime?: string | null;
  lastActivity: string;
  messageCount: number;
  isActive: boolean;
  createdAt: string;
  // 以下欄位為擴展功能，暫時通過 metadata 實現
  updatedAt?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * 會話創建資料
 */
export interface CreateSessionData {
  conversationId: string;
  sessionType?: ConversationSession['sessionType'];
  topic?: string;
  messageContent?: string;
  senderType: 'customer' | 'agent' | 'system';
  priority?: ConversationSession['priority'];
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * 會話更新資料
 */
export interface UpdateSessionData {
  topic?: string | null;
  sessionType?: ConversationSession['sessionType'];
  endTime?: string | null;
  isActive?: boolean;
  priority?: ConversationSession['priority'];
  sentiment?: ConversationSession['sentiment'];
  tags?: string[];
  metadata?: Record<string, any>;
}

// ======================== 查詢和分頁 ========================

/**
 * 會話列表查詢參數
 */
export interface SessionListQuery {
  conversationId?: string;
  isActive?: boolean;
  sessionType?: ConversationSession['sessionType'];
  priority?: ConversationSession['priority'];
  sentiment?: ConversationSession['sentiment'];
  startDate?: string;
  endDate?: string;
  topic?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 會話搜尋參數
 */
export interface SessionSearchQuery {
  query: string;
  conversationId?: string;
  sessionType?: ConversationSession['sessionType'];
  limit?: number;
  [key: string]: unknown;
}

/**
 * 會話列表回應
 */
export interface SessionListResponse {
  sessions: ConversationSession[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalSessions: number;
    activeSessions: number;
    inactiveSessions: number;
    byType: Record<ConversationSession['sessionType'], number>;
    byPriority: Record<NonNullable<ConversationSession['priority']>, number>;
  };
}

// ======================== 統計和分析 ========================

/**
 * 會話統計資訊
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  inactiveSessions: number;
  averageMessagesPerSession: number;
  averageSessionDuration: number; // in minutes
  sessionsByType: Record<ConversationSession['sessionType'], number>;
  sessionsByPriority: Record<NonNullable<ConversationSession['priority']>, number>;
  sessionsBySentiment: Record<NonNullable<ConversationSession['sentiment']>, number> | null;
  topicsDistribution: Array<{
    topic: string;
    count: number;
    percentage: number;
  }>;
  dailyStats: Array<{
    date: string;
    sessionCount: number;
    messageCount: number;
    avgDuration: number;
  }>;
}

/**
 * 會話活動統計
 */
export interface SessionActivityStats {
  conversationId?: string;
  timeRange: 'day' | 'week' | 'month' | 'year';
  activities: Array<{
    date: string;
    sessionsCreated: number;
    sessionsEnded: number;
    messagesSent: number;
    activeTime: number; // in minutes
  }>;
  summary: {
    totalActivity: number;
    avgSessionsPerDay: number;
    avgMessagesPerSession: number;
    peakActivityHour: number;
    leastActivityHour: number;
  };
}

// ======================== 會話管理配置 ========================

/**
 * 會話配置選項
 */
export interface SessionConfig {
  timeGapThreshold: number; // minutes
  maxMessagesPerSession: number;
  maxSessionDuration: number; // hours
  topicChangeKeywords: string[];
  autoCloseInactive: boolean;
  inactiveThreshold: number; // minutes
  enableSentimentAnalysis: boolean;
  enableTopicDetection: boolean;
}

/**
 * 會話邊界檢測結果
 */
export interface SessionBoundaryDetection {
  shouldCreateNew: boolean;
  reason: 'time_gap' | 'message_limit' | 'duration_limit' | 'topic_change' | 'manual' | 'first_session';
  confidence: number; // 0-1
  suggestedTopic?: string;
  metadata?: Record<string, any>;
}

// ======================== 會話訊息關聯 ========================

/**
 * 會話中的訊息
 */
export interface SessionMessage {
  id: string;
  sessionId: string;
  conversationId: string;
  senderId: string;
  senderType: 'customer' | 'agent' | 'system';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'file' | 'system';
  sessionSequence: number;
  platformMessageId?: string | undefined;
  createdAt: string;
  metadata?: Record<string, any> | undefined;
}

/**
 * 會話訊息列表回應
 */
export interface SessionMessagesResponse {
  sessionId: string;
  messages: SessionMessage[];
  messageCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ======================== 批量操作 ========================

/**
 * 批量會話操作
 */
export interface BatchSessionOperation {
  sessionIds: string[];
  action: 'close' | 'reopen' | 'update_priority' | 'add_tags' | 'remove_tags' | 'delete';
  data?: {
    priority?: ConversationSession['priority'];
    tags?: string[];
    endTime?: string;
    isActive?: boolean;
  };
  [key: string]: unknown;
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult {
  success: boolean;
  totalRequested: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    sessionId: string;
    success: boolean;
    error?: string;
  }>;
}

// ======================== 服務介面 ========================

/**
 * Session Service 介面
 */
export interface SessionServiceInterface {
  // 基本CRUD操作
  create(data: CreateSessionData): Promise<ConversationSession>;
  get(sessionId: string): Promise<ConversationSession | null>;
  update(sessionId: string, data: UpdateSessionData): Promise<ConversationSession>;
  delete(sessionId: string): Promise<boolean>;

  // 列表和搜尋
  list(query: SessionListQuery): Promise<SessionListResponse>;
  search(query: SessionSearchQuery): Promise<ConversationSession[]>;

  // 會話管理
  getOrCreate(conversationId: string, messageContent: string, senderType: 'customer' | 'agent' | 'system'): Promise<ConversationSession>;
  closeSession(sessionId: string): Promise<boolean>;
  reopenSession(sessionId: string): Promise<boolean>;

  // 訊息相關
  getMessages(sessionId: string, page?: number, pageSize?: number): Promise<SessionMessagesResponse>;
  addMessage(sessionId: string, messageData: Omit<SessionMessage, 'id' | 'sessionId' | 'sessionSequence' | 'createdAt'>): Promise<SessionMessage>;

  // 統計和分析
  getStats(conversation_id?: string): Promise<SessionStats>;
  getActivityStats(query: Omit<SessionActivityStats, 'activities' | 'summary'>): Promise<SessionActivityStats>;

  // 批量操作
  batchOperation(operation: BatchSessionOperation, userId?: string): Promise<BatchOperationResult>;

  // 工具方法
  detectSessionBoundary(currentSession: ConversationSession | null, messageContent: string, senderType: 'customer' | 'agent' | 'system'): Promise<SessionBoundaryDetection>;
  extractTopic(messageContent: string): Promise<string | null>;
  analyzeSessionHealth(sessionId: string): Promise<{ healthy: boolean; issues: string[]; suggestions: string[] }>;
}

// ======================== 中間件類型 ========================

/**
 * Session Context 擴展
 */
export interface SessionContext extends Context<{ Bindings: Bindings }> {
  get: {
    sessionId?: string;
    session?: ConversationSession;
    sessionQuery?: SessionListQuery;
    sessionSearchQuery?: SessionSearchQuery;
    createSessionData?: CreateSessionData;
    updateSessionData?: UpdateSessionData;
    batchOperation?: BatchSessionOperation;
  } & Context<{ Bindings: Bindings }>['get'];
  set: Context<{ Bindings: Bindings }>['set'] & {
    (key: 'sessionId', value: string): void;
    (key: 'session', value: ConversationSession): void;
    (key: 'sessionQuery', value: SessionListQuery): void;
    (key: 'sessionSearchQuery', value: SessionSearchQuery): void;
    (key: 'createSessionData', value: CreateSessionData): void;
    (key: 'updateSessionData', value: UpdateSessionData): void;
    (key: 'batchOperation', value: BatchSessionOperation): void;
  };
}

// ======================== 錯誤類型 ========================

/**
 * Session 相關錯誤
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'SessionValidationError';
  }
}

export class SessionOperationError extends Error {
  constructor(message: string, public operation: string) {
    super(message);
    this.name = 'SessionOperationError';
  }
}

// ======================== 預設配置 ========================

/**
 * 預設會話配置
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  timeGapThreshold: 30, // 30 minutes
  maxMessagesPerSession: 50,
  maxSessionDuration: 24, // 24 hours
  topicChangeKeywords: [
    '另外', '還有', '換個話題', '問個別的', '新問題',
    'by the way', 'btw', 'another question', 'different topic'
  ],
  autoCloseInactive: true,
  inactiveThreshold: 60, // 60 minutes
  enableSentimentAnalysis: true,
  enableTopicDetection: true
};

/**
 * 預設分頁設定
 */
export const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100
};

/**
 * 會話類型選項
 */
export const SESSION_TYPES: ConversationSession['sessionType'][] = [
  'continuous',
  'scheduled',
  'support',
  'marketing'
];

/**
 * 優先級選項
 */
export const PRIORITY_LEVELS: ConversationSession['priority'][] = [
  'low',
  'medium',
  'high',
  'urgent'
];

/**
 * 情感選項
 */
export const SENTIMENT_TYPES: ConversationSession['sentiment'][] = [
  'positive',
  'negative',
  'neutral'
];