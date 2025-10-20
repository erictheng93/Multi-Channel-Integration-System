// Session 模組測試用 Mock 資料
// Mock data for session module testing

import type {
  ConversationSession,
  SessionStats,
  SessionActivityStats,
  BatchOperationResult
} from '@session/types/session-types';

// ======================== Mock 會話資料 ========================

/**
 * 多種類型的測試會話資料
 */
export const mockSessions: Record<string, ConversationSession> = {
  activeCustomerSupport: {
    id: 'session_test_001',
    conversationId: 'conv_001',
    sessionType: 'support',
    topic: '產品功能諮詢',
    startTime: '2024-01-15T10:00:00.000Z',
    endTime: null,
    lastActivity: '2024-01-15T11:30:00.000Z',
    messageCount: 12,
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T11:30:00.000Z',
    priority: 'high',
    sentiment: 'neutral',
    tags: ['product', 'inquiry', 'urgent'],
    metadata: {
      customerTier: 'premium',
      assignedAgent: 'agent_001',
      category: 'technical_support'
    }
  },

  inactiveMarketing: {
    id: 'session_test_002',
    conversationId: 'conv_002',
    sessionType: 'marketing',
    topic: '新產品推廣活動',
    startTime: '2024-01-14T14:00:00.000Z',
    endTime: '2024-01-14T15:30:00.000Z',
    lastActivity: '2024-01-14T15:30:00.000Z',
    messageCount: 8,
    isActive: false,
    createdAt: '2024-01-14T14:00:00.000Z',
    updatedAt: '2024-01-14T15:30:00.000Z',
    priority: 'medium',
    sentiment: 'positive',
    tags: ['marketing', 'promotion', 'campaign'],
    metadata: {
      campaignId: 'camp_2024_001',
      conversionRate: 0.15,
      engagement: 'high'
    }
  },

  scheduledMaintenance: {
    id: 'session_test_003',
    conversationId: 'conv_003',
    sessionType: 'scheduled',
    topic: '系統維護通知',
    startTime: '2024-01-13T20:00:00.000Z',
    endTime: '2024-01-13T20:05:00.000Z',
    lastActivity: '2024-01-13T20:05:00.000Z',
    messageCount: 3,
    isActive: false,
    createdAt: '2024-01-13T20:00:00.000Z',
    updatedAt: '2024-01-13T20:05:00.000Z',
    priority: 'low',
    sentiment: 'neutral',
    tags: ['maintenance', 'notification', 'system'],
    metadata: {
      maintenanceType: 'scheduled',
      estimatedDuration: 120, // minutes
      affectedServices: ['api', 'dashboard']
    }
  },

  continuousChat: {
    id: 'session_test_004',
    conversationId: 'conv_004',
    sessionType: 'continuous',
    topic: '一般客服諮詢',
    startTime: '2024-01-15T09:00:00.000Z',
    endTime: null,
    lastActivity: '2024-01-15T12:00:00.000Z',
    messageCount: 25,
    isActive: true,
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T12:00:00.000Z',
    priority: 'medium',
    sentiment: 'positive',
    tags: ['general', 'customer_service', 'ongoing'],
    metadata: {
      sessionDurationMinutes: 180,
      responseTime: 45, // seconds
      satisfactionScore: 4.5
    }
  },

  longRunningSession: {
    id: 'session_test_005',
    conversationId: 'conv_005',
    sessionType: 'support',
    topic: '複雜技術問題排查',
    startTime: '2024-01-12T10:00:00.000Z',
    endTime: null,
    lastActivity: '2024-01-15T16:00:00.000Z',
    messageCount: 89,
    isActive: true,
    createdAt: '2024-01-12T10:00:00.000Z',
    updatedAt: '2024-01-15T16:00:00.000Z',
    priority: 'urgent',
    sentiment: 'negative',
    tags: ['technical', 'complex', 'escalated', 'priority'],
    metadata: {
      escalationLevel: 2,
      engineersInvolved: ['eng_001', 'eng_002'],
      incidentId: 'INC-2024-001'
    }
  }
};

// ======================== Mock 統計資料 ========================

export const mockSessionStats: SessionStats = {
  totalSessions: 150,
  activeSessions: 35,
  inactiveSessions: 115,
  averageMessagesPerSession: 18,
  averageSessionDuration: 120, // minutes
  sessionsByType: {
    continuous: 60,
    scheduled: 25,
    support: 45,
    marketing: 20
  },
  sessionsByPriority: {
    low: 40,
    medium: 70,
    high: 25,
    urgent: 15
  },
  sessionsBySentiment: {
    positive: 65,
    negative: 25,
    neutral: 60
  },
  topicsDistribution: [
    { topic: '產品諮詢', count: 45, percentage: 30.0 },
    { topic: '技術支援', count: 35, percentage: 23.3 },
    { topic: '訂單問題', count: 25, percentage: 16.7 },
    { topic: '帳戶管理', count: 20, percentage: 13.3 },
    { topic: '其他', count: 25, percentage: 16.7 }
  ],
  dailyStats: [
    { date: '2024-01-15', sessionCount: 12, messageCount: 180, avgDuration: 95 },
    { date: '2024-01-14', sessionCount: 15, messageCount: 220, avgDuration: 110 },
    { date: '2024-01-13', sessionCount: 8, messageCount: 95, avgDuration: 75 },
    { date: '2024-01-12', sessionCount: 18, messageCount: 280, avgDuration: 135 },
    { date: '2024-01-11', sessionCount: 11, messageCount: 150, avgDuration: 88 }
  ]
};

export const mockActivityStats: SessionActivityStats = {
  conversationId: 'conv_001',
  timeRange: 'week',
  activities: [
    { date: '2024-01-15', sessionsCreated: 5, sessionsEnded: 3, messagesSent: 45, activeTime: 180 },
    { date: '2024-01-14', sessionsCreated: 7, sessionsEnded: 6, messagesSent: 62, activeTime: 240 },
    { date: '2024-01-13', sessionsCreated: 3, sessionsEnded: 2, messagesSent: 28, activeTime: 120 },
    { date: '2024-01-12', sessionsCreated: 8, sessionsEnded: 4, messagesSent: 58, activeTime: 200 },
    { date: '2024-01-11', sessionsCreated: 4, sessionsEnded: 5, messagesSent: 38, activeTime: 160 },
    { date: '2024-01-10', sessionsCreated: 6, sessionsEnded: 3, messagesSent: 42, activeTime: 175 },
    { date: '2024-01-09', sessionsCreated: 2, sessionsEnded: 4, messagesSent: 22, activeTime: 95 }
  ],
  summary: {
    totalActivity: 35,
    avgSessionsPerDay: 5.0,
    avgMessagesPerSession: 17.8,
    peakActivityHour: 14,
    leastActivityHour: 3
  }
};

// ======================== Mock 批量操作結果 ========================

export const mockBatchOperationResults: Record<string, BatchOperationResult> = {
  successfulClose: {
    success: true,
    totalRequested: 5,
    successCount: 5,
    failedCount: 0,
    results: [
      { sessionId: 'session_test_001', success: true },
      { sessionId: 'session_test_002', success: true },
      { sessionId: 'session_test_003', success: true },
      { sessionId: 'session_test_004', success: true },
      { sessionId: 'session_test_005', success: true }
    ]
  },

  partialFailure: {
    success: false,
    totalRequested: 3,
    successCount: 2,
    failedCount: 1,
    results: [
      { sessionId: 'session_test_001', success: true },
      { sessionId: 'session_test_002', success: true },
      { sessionId: 'session_test_invalid', success: false, error: 'Session not found' }
    ]
  },

  completeFailure: {
    success: false,
    totalRequested: 2,
    successCount: 0,
    failedCount: 2,
    results: [
      { sessionId: 'session_invalid_001', success: false, error: 'Session not found' },
      { sessionId: 'session_invalid_002', success: false, error: 'Permission denied' }
    ]
  }
};

// ======================== Mock 邊界檢測場景 ========================

export const mockBoundaryScenarios = {
  timeGap: {
    description: '時間間隔過長，應創建新會話',
    currentSession: mockSessions.activeCustomerSupport,
    newMessage: '你好，我有新的問題想要詢問',
    senderType: 'customer' as const,
    expectedDetection: {
      shouldCreateNew: true,
      reason: 'time_gap' as const,
      confidence: 0.9,
      metadata: { timeDiffMinutes: 120 }
    }
  },

  messageLimit: {
    description: '訊息數量達到上限，應創建新會話',
    currentSession: mockSessions.longRunningSession,
    newMessage: '還有一個問題',
    senderType: 'customer' as const,
    expectedDetection: {
      shouldCreateNew: true,
      reason: 'message_limit' as const,
      confidence: 0.8,
      metadata: { currentMessageCount: 89 }
    }
  },

  topicChange: {
    description: '主題變化，應創建新會話',
    currentSession: mockSessions.activeCustomerSupport,
    newMessage: '另外，我想問一下關於帳單的問題',
    senderType: 'customer' as const,
    expectedDetection: {
      shouldCreateNew: true,
      reason: 'topic_change' as const,
      confidence: 0.6,
      suggestedTopic: '帳戶問題'
    }
  },

  continuousFlow: {
    description: '正常對話流程，應繼續當前會話',
    currentSession: mockSessions.continuousChat,
    newMessage: '謝謝你的幫助，我了解了',
    senderType: 'customer' as const,
    expectedDetection: {
      shouldCreateNew: false,
      reason: 'manual' as const,
      confidence: 0.1
    }
  }
};

// ======================== Mock API 回應 ========================

export const mockApiResponses = {
  successfulCreate: {
    success: true,
    data: mockSessions.activeCustomerSupport,
    message: 'Session created successfully',
    timestamp: '2024-01-15T12:00:00.000Z'
  },

  successfulList: {
    success: true,
    data: {
      sessions: [
        mockSessions.activeCustomerSupport,
        mockSessions.continuousChat
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      summary: {
        totalSessions: 2,
        activeSessions: 2,
        inactiveSessions: 0,
        byType: { continuous: 1, support: 1, scheduled: 0, marketing: 0 },
        byPriority: { low: 0, medium: 1, high: 1, urgent: 0 }
      }
    },
    timestamp: '2024-01-15T12:00:00.000Z'
  },

  notFoundError: {
    success: false,
    error: 'Session not found',
    timestamp: '2024-01-15T12:00:00.000Z'
  },

  validationError: {
    success: false,
    error: 'Invalid session ID format',
    timestamp: '2024-01-15T12:00:00.000Z'
  },

  permissionError: {
    success: false,
    error: 'Insufficient permissions to access session',
    timestamp: '2024-01-15T12:00:00.000Z'
  }
};

// ======================== Mock JWT Payload ========================

export const mockJwtPayloads = {
  admin: {
    userId: 'admin_001',
    username: 'admin',
    role: 'admin',
    teamId: 1,
    permissions: ['session:view', 'session:create', 'session:update', 'session:delete', 'session:stats'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  teamLead: {
    userId: 'team_001',
    username: 'team_lead',
    role: 'team',
    teamId: 2,
    permissions: ['session:view', 'session:create', 'session:update', 'session:stats'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  agent: {
    userId: 'agent_001',
    username: 'agent',
    role: 'agent',
    teamId: 2,
    permissions: ['session:view', 'session:create', 'session:update'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  expired: {
    userId: 'user_001',
    username: 'expired_user',
    role: 'agent',
    teamId: 1,
    permissions: ['session:view'],
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600 // expired 1 hour ago
  }
};

// ======================== Mock 測試場景配置 ========================

export const mockTestScenarios = {
  loadTesting: {
    sessionCount: 100,
    messageCountPerSession: 20,
    concurrentUsers: 50,
    durationMinutes: 10
  },

  stressTesting: {
    sessionCount: 1000,
    messageCountPerSession: 50,
    concurrentUsers: 200,
    durationMinutes: 30
  },

  boundaryTesting: {
    maxSessionId: 'a'.repeat(255),
    maxTopicLength: 'x'.repeat(200),
    maxTagCount: 10,
    maxBatchSize: 100
  }
};

// ======================== Helper Functions ========================

/**
 * 根據條件篩選 Mock 會話
 */
export function filterMockSessions(filter: {
  isActive?: boolean;
  sessionType?: string;
  priority?: string;
}): ConversationSession[] {
  return Object.values(mockSessions).filter(session => {
    if (filter.isActive !== undefined && session.isActive !== filter.isActive) return false;
    if (filter.sessionType && session.sessionType !== filter.sessionType) return false;
    if (filter.priority && session.priority !== filter.priority) return false;
    return true;
  });
}

/**
 * 取得指定數量的 Mock 會話
 */
export function getMockSessionsBatch(count: number): ConversationSession[] {
  const sessions = Object.values(mockSessions);
  return sessions.slice(0, Math.min(count, sessions.length));
}

/**
 * 生成隨機 Mock 會話
 */
export function generateRandomMockSession(): ConversationSession {
  const types: ConversationSession['sessionType'][] = ['continuous', 'scheduled', 'support', 'marketing'];
  const priorities: ConversationSession['priority'][] = ['low', 'medium', 'high', 'urgent'];
  const sentiments: ConversationSession['sentiment'][] = ['positive', 'negative', 'neutral'];

  const now = new Date();
  const startTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `session_random_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    conversationId: `conv_random_${Math.random().toString(36).substr(2, 8)}`,
    sessionType: types[Math.floor(Math.random() * types.length)],
    topic: `Random Topic ${Math.floor(Math.random() * 1000)}`,
    startTime,
    endTime: Math.random() > 0.7 ? now.toISOString() : null,
    lastActivity: new Date(now.getTime() - Math.random() * 60 * 60 * 1000).toISOString(),
    messageCount: Math.floor(Math.random() * 100),
    isActive: Math.random() > 0.3,
    createdAt: startTime,
    updatedAt: new Date().toISOString(),
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    tags: ['random', 'test'],
    metadata: { generated: true, randomSeed: Math.random() }
  };
}