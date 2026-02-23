// Session 模組測試輔助工具
// Session module test helpers and utilities

import type {
  ConversationSession,
  CreateSessionData,
  UpdateSessionData,
  SessionListQuery,
  SessionSearchQuery,
  BatchSessionOperation,
  SessionMessage,
  SessionStats
} from '@session/types/session-types';

// ======================== 測試資料生成器 ========================

/**
 * 生成測試用的會話ID (UUID v4 格式)
 */
export function generateTestSessionId(): string {
  // 生成符合 UUID v4 格式的測試 ID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成測試用的對話ID (UUID v4 格式)
 */
export function generateTestConversationId(): string {
  // 生成符合 UUID v4 格式的測試 ID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成測試用的會話資料
 */
export function createMockSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  const now = new Date().toISOString();
  const sessionId = generateTestSessionId();

  return {
    id: sessionId,
    conversationId: generateTestConversationId(),
    sessionType: 'continuous',
    topic: 'Test Session Topic',
    startTime: now,
    endTime: null,
    lastActivity: now,
    messageCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    priority: 'medium',
    sentiment: 'neutral',
    tags: ['test'],
    metadata: { testData: true },
    ...overrides
  };
}

/**
 * 生成測試用的創建會話資料
 */
export function createMockCreateSessionData(overrides: Partial<CreateSessionData> = {}): CreateSessionData {
  return {
    conversationId: generateTestConversationId(),
    sessionType: 'continuous',
    topic: 'Test Topic',
    messageContent: 'Hello, this is a test message',
    senderType: 'customer',
    priority: 'medium',
    tags: ['test'],
    metadata: { source: 'test' },
    ...overrides
  };
}

/**
 * 生成測試用的更新會話資料
 */
export function createMockUpdateSessionData(overrides: Partial<UpdateSessionData> = {}): UpdateSessionData {
  return {
    topic: 'Updated Topic',
    sessionType: 'support',
    priority: 'high',
    sentiment: 'positive',
    tags: ['updated', 'test'],
    metadata: { updated: true },
    ...overrides
  };
}

/**
 * 生成測試用的會話訊息
 */
export function createMockSessionMessage(overrides: Partial<SessionMessage> = {}): SessionMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId: generateTestSessionId(),
    conversationId: generateTestConversationId(),
    senderId: 'test_customer_123',
    senderType: 'customer',
    content: 'This is a test message',
    messageType: 'text',
    sessionSequence: 1,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 生成測試用的批量操作資料
 */
export function createMockBatchOperation(overrides: Partial<BatchSessionOperation> = {}): BatchSessionOperation {
  return {
    sessionIds: [generateTestSessionId(), generateTestSessionId()],
    action: 'close',
    data: {
      priority: 'high',
      tags: ['batch_test'],
      endTime: new Date().toISOString(),
      isActive: false
    },
    ...overrides
  };
}

// ======================== 查詢參數生成器 ========================

/**
 * 生成測試用的列表查詢參數
 */
export function createMockListQuery(overrides: Partial<SessionListQuery> = {}): SessionListQuery {
  return {
    conversationId: undefined,
    isActive: true,
    sessionType: 'continuous',
    priority: 'medium',
    sentiment: 'neutral',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    topic: 'test',
    tag: 'test',
    page: 1,
    pageSize: 20,
    ...overrides
  };
}

/**
 * 生成測試用的搜尋查詢參數
 */
export function createMockSearchQuery(overrides: Partial<SessionSearchQuery> = {}): SessionSearchQuery {
  return {
    query: 'test search',
    conversationId: generateTestConversationId(),
    sessionType: 'continuous',
    limit: 10,
    ...overrides
  };
}

// ======================== 測試場景生成器 ========================

/**
 * 生成活躍會話測試場景
 */
export function createActiveSessionScenario(): {
  session: ConversationSession;
  messages: SessionMessage[];
  stats: Partial<SessionStats>;
} {
  const session = createMockSession({
    isActive: true,
    messageCount: 5,
    topic: 'Active Session Test'
  });

  const messages = Array.from({ length: 5 }, (_, index) =>
    createMockSessionMessage({
      sessionId: session.id,
      conversationId: session.conversationId,
      sessionSequence: index + 1,
      content: `Test message ${index + 1}`
    })
  );

  const stats: Partial<SessionStats> = {
    totalSessions: 1,
    activeSessions: 1,
    inactiveSessions: 0,
    averageMessagesPerSession: 5
  };

  return { session, messages, stats };
}

/**
 * 生成會話邊界檢測測試場景
 */
export function createBoundaryDetectionScenarios() {
  return {
    timeGap: {
      currentSession: createMockSession({
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        isActive: true
      }),
      newMessage: 'Hello, I have a new question',
      senderType: 'customer' as const,
      expectedResult: {
        shouldCreateNew: true,
        reason: 'time_gap' as const,
        confidence: 0.9
      }
    },
    messageLimit: {
      currentSession: createMockSession({
        messageCount: 50,
        isActive: true
      }),
      newMessage: 'Another message',
      senderType: 'customer' as const,
      expectedResult: {
        shouldCreateNew: true,
        reason: 'message_limit' as const,
        confidence: 0.8
      }
    },
    topicChange: {
      currentSession: createMockSession({
        topic: 'Product Inquiry',
        isActive: true,
        messageCount: 10
      }),
      newMessage: 'By the way, I have a different question about billing',
      senderType: 'customer' as const,
      expectedResult: {
        shouldCreateNew: true,
        reason: 'topic_change' as const,
        confidence: 0.6
      }
    },
    continuousSession: {
      currentSession: createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        messageCount: 10,
        isActive: true
      }),
      newMessage: 'Thank you for your help',
      senderType: 'customer' as const,
      expectedResult: {
        shouldCreateNew: false,
        reason: 'manual' as const,
        confidence: 0.1
      }
    }
  };
}

// ======================== 測試驗證函數 ========================

/**
 * 驗證會話資料完整性
 */
export function validateSessionData(session: ConversationSession): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!session.id) errors.push('Missing session ID');
  if (!session.conversationId) errors.push('Missing conversation ID');
  if (!session.startTime) errors.push('Missing start time');
  if (!session.createdAt) errors.push('Missing created at timestamp');
  if (typeof session.isActive !== 'boolean') errors.push('isActive must be boolean');
  if (typeof session.messageCount !== 'number') errors.push('messageCount must be number');

  if (!['continuous', 'scheduled', 'support', 'marketing'].includes(session.sessionType)) {
    errors.push('Invalid session type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 驗證API回應格式
 */
export function validateApiResponse(response: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof response !== 'object') errors.push('Response must be object');
  if (typeof response.success !== 'boolean') errors.push('Missing success field');
  if (!response.timestamp) errors.push('Missing timestamp');

  if (response.success && !response.data) {
    errors.push('Successful response must include data');
  }

  if (!response.success && !response.error) {
    errors.push('Error response must include error message');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 驗證分頁資料格式
 */
export function validatePaginationData(pagination: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pagination) errors.push('Missing pagination data');
  if (typeof pagination.page !== 'number') errors.push('page must be number');
  if (typeof pagination.pageSize !== 'number') errors.push('pageSize must be number');
  if (typeof pagination.total !== 'number') errors.push('total must be number');
  if (typeof pagination.totalPages !== 'number') errors.push('totalPages must be number');
  if (typeof pagination.hasNext !== 'boolean') errors.push('hasNext must be boolean');
  if (typeof pagination.hasPrev !== 'boolean') errors.push('hasPrev must be boolean');

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ======================== 測試工具函數 ========================

/**
 * 等待指定時間
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成隨機字串
 */
export function generateRandomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 深度複製物件
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 比較兩個物件是否相等 (忽略特定欄位)
 */
export function compareObjects(
  obj1: any,
  obj2: any,
  ignoreFields: string[] = ['createdAt', 'updatedAt', 'timestamp']
): boolean {
  const clean1 = { ...obj1 };
  const clean2 = { ...obj2 };

  ignoreFields.forEach(field => {
    delete clean1[field];
    delete clean2[field];
  });

  return JSON.stringify(clean1) === JSON.stringify(clean2);
}

// ======================== 測試環境設定 ========================

/**
 * 設定測試環境變數
 */
export function setupTestEnvironment() {
  return {
    JWT_SECRET: 'test_jwt_secret_key_for_sessions',
    DATABASE: 'test_session_database',
    KV_NAMESPACE: 'test_session_kv',
    NODE_ENV: 'test',
    LOG_LEVEL: 'debug'
  };
}

/**
 * 清理測試資料
 */
export async function cleanupTestData(sessionIds: string[] = []): Promise<void> {
  // TODO: 實作清理測試資料的邏輯
  console.log(`Cleaning up test sessions: ${sessionIds.join(', ')}`);
}

// ======================== 錯誤測試輔助 ========================

/**
 * 生成測試錯誤場景
 */
export function createErrorScenarios() {
  return {
    invalidSessionId: {
      sessionId: 'invalid-session-id-format',
      expectedError: 'Invalid session ID format',
      expectedStatus: 400
    },
    missingAuthToken: {
      headers: {},
      expectedError: 'Missing or invalid authorization header',
      expectedStatus: 401
    },
    insufficientPermissions: {
      userRole: 'guest',
      expectedError: 'Insufficient permissions',
      expectedStatus: 403
    },
    sessionNotFound: {
      sessionId: generateTestSessionId(),
      expectedError: 'Session not found',
      expectedStatus: 404
    },
    validationError: {
      invalidData: {
        conversationId: 'invalid-uuid',
        senderType: 'invalid_type'
      },
      expectedError: 'Invalid conversationId format',
      expectedStatus: 400
    }
  };
}

/**
 * 驗證錯誤回應格式
 * Supports both flat (error: "string") and nested (error: { message: "..." }) formats
 */
export function validateErrorResponse(
  response: any,
  expectedStatus: number,
  expectedError?: string
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (response.success !== false) {
    errors.push('Error response success should be false');
  }

  if (!response.error) {
    errors.push('Missing error message');
  }

  // Handle both flat string and nested object error formats
  const errorStr = typeof response.error === 'string'
    ? response.error
    : (response.error?.message || response.error?.code || '');

  if (expectedError && errorStr && !errorStr.includes(expectedError)) {
    errors.push(`Expected error message containing '${expectedError}', got '${errorStr}'`);
  }

  if (!response.timestamp) {
    errors.push('Missing timestamp in error response');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}