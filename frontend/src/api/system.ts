// 系統管理 API 客戶端
import { authenticatedFetch } from './authenticatedFetch'
import { credentialContracts, feedbackContracts, systemContracts } from '@shared/api-contracts'
import { callApiContract } from './contract-client'
import type { ApiResponse } from '@/types'

interface SystemInfo {
  version: string;
  environment: string;
  lastUpdate: Date | string;
  dbStatus: 'online' | 'offline' | 'error';
  cacheStatus: 'online' | 'offline' | 'error';
  uptime: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
  diskUsage?: {
    used: number;
    total: number;
  };
}

interface SystemSettings {
  general?: {
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  };
  integrations?: {
    line?: {
      channelId?: string;
      channelSecret?: string;
      accessToken?: string;
      status: 'connected' | 'disconnected' | 'error';
    };
    facebook?: {
      appId?: string;
      appSecret?: string;
      pageId?: string;
      pageToken?: string;
      status: 'connected' | 'disconnected' | 'error';
    };
  };
  advanced?: {
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  };
}

// 用於部分更新的介面
interface SystemSettingsUpdate {
  general?: Partial<SystemSettings['general']>;
  integrations?: {
    line?: Partial<{
      channelId?: string;
      channelSecret?: string;
      accessToken?: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
    facebook?: Partial<{
      appId?: string;
      appSecret?: string;
      pageId?: string;
      pageToken?: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
  };
  advanced?: Partial<SystemSettings['advanced']>;
}

interface IntegrationTestRequest {
  channelId?: string;
  channelSecret?: string;
  accessToken?: string;
  appId?: string;
  appSecret?: string;
  pageId?: string;
  pageToken?: string;
}

interface SystemMetrics {
  activeUsers: number;
  totalConversations: number;
  messagesToday: number;
  averageResponseTime: number;
  systemLoad: number;
  errorRate: number;
}

export const systemApi = {
  // 獲取系統資訊
  getSystemInfo: async (): Promise<ApiResponse<SystemInfo>> => {
    return callApiContract(systemContracts.info, {}) as Promise<ApiResponse<SystemInfo>>
  },

  // 獲取系統設定
  getSettings: async (): Promise<ApiResponse<SystemSettings>> => {
    return callApiContract(systemContracts.settings, {}) as Promise<ApiResponse<SystemSettings>>
  },

  // 更新系統設定
  updateSettings: async (settings: SystemSettingsUpdate): Promise<ApiResponse<void>> => {
    return callApiContract(systemContracts.updateSettings, {}, settings)
  },

  // 測試平台集成
  testIntegration: async (
    platform: 'line' | 'facebook', 
    config: IntegrationTestRequest
  ): Promise<ApiResponse<{ status: string; message?: string }>> => {
    return callApiContract(systemContracts.testIntegration, { platform }, config)
  },

  // 獲取系統指標
  getMetrics: async (): Promise<ApiResponse<SystemMetrics>> => {
    return callApiContract(systemContracts.metrics, {}) as Promise<ApiResponse<SystemMetrics>>
  },

  // 獲取系統日誌
  getLogs: async (params?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ApiResponse<{
    logs: Array<{
      id: string;
      level: string;
      message: string;
      timestamp: Date | string;
      source?: string;
      metadata?: Record<string, unknown>;
    }>;
    total: number;
  }>> => {
    return callApiContract(systemContracts.logs, params) as Promise<ApiResponse<{
      logs: Array<{
        id: string;
        level: string;
        message: string;
        timestamp: Date | string;
        source?: string;
        metadata?: Record<string, unknown>;
      }>;
      total: number;
    }>>
  },

  // 匯出系統配置
  exportConfig: async (): Promise<ApiResponse<SystemSettings>> => {
    return callApiContract(systemContracts.exportConfig, {}) as Promise<ApiResponse<SystemSettings>>
  },

  // 導入系統配置
  importConfig: async (config: SystemSettings): Promise<ApiResponse<void>> => {
    return callApiContract(systemContracts.importConfig, {}, config)
  },

  // 完整健康檢查 (使用統一健康檢查系統)
  // Uses raw fetch: backend returns 503 when components are critical, but the response body
  // still contains valid health data. apiClient would retry on 5xx and discard the data.
  healthCheck: async (): Promise<{
    success: boolean;
    data?: {
      overall: { status: string; message: string; timestamp: string };
      components: Array<{
        component: string;
        version: string;
        status: { status: string; message: string; timestamp: string; responseTime?: number; details?: Record<string, unknown> };
        lastCheck: string;
        checkInterval: number;
      }>;
      infrastructure: Record<string, { status: string; message: string; timestamp: string; responseTime?: number }>;
      performance: { apiResponseTime: number; databaseQueryTime: number; cacheHitRate: number };
    };
    message?: string;
  }> => {
    try {
      const { getBackendUrl } = await import('@/config/runtime')
      const baseUrl = import.meta.env.DEV ? '/api' : `${getBackendUrl()}/api`
      const response = await authenticatedFetch(`${baseUrl}/health/system`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const json = await response.json()
      return { success: true, data: json.data, message: json.message }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '健康檢查失敗' }
    }
  },

  // 系統統計
  getStats: async (period?: '1h' | '24h' | '7d' | '30d'): Promise<ApiResponse<{
    period: string;
    stats: {
      requests: number;
      errors: number;
      averageResponseTime: number;
      activeUsers: number;
      conversations: {
        total: number;
        new: number;
        closed: number;
      };
      messages: {
        total: number;
        sent: number;
        received: number;
      };
    };
    timeline: Array<{
      timestamp: Date | string;
      requests: number;
      errors: number;
      responseTime: number;
    }>;
  }>> => {
    return callApiContract(systemContracts.stats, { period }) as Promise<ApiResponse<{
      period: string;
      stats: {
        requests: number;
        errors: number;
        averageResponseTime: number;
        activeUsers: number;
        conversations: {
          total: number;
          new: number;
          closed: number;
        };
        messages: {
          total: number;
          sent: number;
          received: number;
        };
      };
      timeline: Array<{
        timestamp: Date | string;
        requests: number;
        errors: number;
        responseTime: number;
      }>;
    }>>
  },

  // 獲取 Dashboard 統計數據
  getDashboardStats: async (): Promise<ApiResponse<{
    totalMessages: number;
    totalCustomers: number;
    totalConversations: number;
    todayMessages: number;
    onlineAgents: number;
    responseTime: string;
    satisfactionRate: number;
    resolvedToday: number;
    timestamp: string;
  }>> => {
    return callApiContract(systemContracts.dashboardStats, {}) as Promise<ApiResponse<{
      totalMessages: number;
      totalCustomers: number;
      totalConversations: number;
      todayMessages: number;
      onlineAgents: number;
      responseTime: string;
      satisfactionRate: number;
      resolvedToday: number;
      timestamp: string;
    }>>
  },

  // 更新 Webhook URL
  updateWebhookUrl: async (
    platform: 'line' | 'facebook',
    url: string
  ): Promise<ApiResponse<void>> => {
    return callApiContract(systemContracts.updateWebhookUrl, { platform }, { url })
  },

  // 測試 Webhook
  testWebhook: async (
    platform: 'line' | 'facebook'
  ): Promise<ApiResponse<{
    success: boolean;
    responseTime: number;
    error?: string;
  }>> => {
    return callApiContract(systemContracts.testWebhook, { platform }) as Promise<ApiResponse<{
      success: boolean;
      responseTime: number;
      error?: string;
    }>>
  },

  // 獲取系統事件日誌
  getEvents: async (params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ApiResponse<{
    events: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      severity: 'info' | 'warning' | 'error';
      timestamp: Date | string;
      metadata?: Record<string, unknown>;
    }>;
    total: number;
  }>> => {
    return callApiContract(systemContracts.events, params) as Promise<ApiResponse<{
      events: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        severity: 'info' | 'warning' | 'error';
        timestamp: Date | string;
        metadata?: Record<string, unknown>;
      }>;
      total: number;
    }>>
  },

  // 系統維護模式
  setMaintenanceMode: async (enabled: boolean, message?: string): Promise<ApiResponse<void>> => {
    return callApiContract(systemContracts.setMaintenance, {}, { enabled, message })
  },

  // 獲取維護狀態
  getMaintenanceStatus: async (): Promise<ApiResponse<{
    enabled: boolean;
    message?: string;
    scheduledAt?: Date | string;
  }>> => {
    return callApiContract(systemContracts.maintenanceStatus, {}) as Promise<ApiResponse<{
      enabled: boolean;
      message?: string;
      scheduledAt?: Date | string;
    }>>
  }
}

// 憑證管理 API
export const credentialsApi = {
  // 儲存憑證
  storeCredential: async (
    platform: 'line' | 'facebook',
    type: string,
    value: string
  ): Promise<ApiResponse<void>> => {
    return callApiContract(credentialContracts.store, {}, { platform, type, value })
  },

  // 獲取單個憑證
  getCredential: async (
    platform: 'line' | 'facebook',
    type: string
  ): Promise<ApiResponse<{ value: string }>> => {
    return callApiContract(credentialContracts.get, { platform, type })
  },

  // 獲取所有憑證
  getAllCredentials: async (): Promise<ApiResponse<{
    line: {
      channelId: string;
      channelSecret: string;
      accessToken: string;
    };
    facebook: {
      appId: string;
      appSecret: string;
      pageId: string;
      pageToken: string;
    };
  }>> => {
    return callApiContract(credentialContracts.all, {}) as Promise<ApiResponse<{
      line: {
        channelId: string;
        channelSecret: string;
        accessToken: string;
      };
      facebook: {
        appId: string;
        appSecret: string;
        pageId: string;
        pageToken: string;
      };
    }>>
  },

  // 清除平台憑證
  clearPlatformCredentials: async (
    platform: 'line' | 'facebook'
  ): Promise<ApiResponse<void>> => {
    return callApiContract(credentialContracts.clearPlatform, { platform })
  },

}

// 客户满意度反馈 API
export const feedbackApi = {
  // 提交客户反馈
  submitFeedback: async (feedback: {
    conversationId: string;
    customerId: number;
    agentId?: string;
    rating: number;
    comment?: string;
    feedbackType?: 'satisfaction' | 'service_quality' | 'response_time';
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<{
    id: string;
    conversationId: string;
    rating: number;
    createdAt: string;
  }>> => {
    return callApiContract(feedbackContracts.submit, {}, feedback) as Promise<ApiResponse<{
      id: string;
      conversationId: string;
      rating: number;
      createdAt: string;
    }>>
  },

  // 获取满意度统计
  getStats: async (timeRange?: '24h' | '7d' | '30d' | 'all'): Promise<ApiResponse<{
    satisfactionRate: number;
    totalFeedback: number;
    averageRating: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    timeRange: string;
    timestamp: string;
  }>> => {
    return callApiContract(feedbackContracts.stats, { timeRange }) as Promise<ApiResponse<{
      satisfactionRate: number;
      totalFeedback: number;
      averageRating: number;
      ratingDistribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
      };
      timeRange: string;
      timestamp: string;
    }>>
  },

  // 获取特定对话的反馈
  getConversationFeedback: async (conversationId: string): Promise<ApiResponse<{
    conversationId: string;
    feedback: Array<{
      id: string;
      rating: number;
      comment?: string;
      feedbackType: string;
      customerName: string;
      agentName?: string;
      createdAt: string;
    }>;
    count: number;
  }>> => {
    return callApiContract(feedbackContracts.byConversation, { conversationId }) as Promise<ApiResponse<{
      conversationId: string;
      feedback: Array<{
        id: string;
        rating: number;
        comment?: string;
        feedbackType: string;
        customerName: string;
        agentName?: string;
        createdAt: string;
      }>;
      count: number;
    }>>
  },

  // 获取反馈列表（带分页）
  getFeedbackList: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<{
    feedback: Array<{
      id: string;
      conversationId: string;
      rating: number;
      comment?: string;
      feedbackType: string;
      customerName: string;
      agentName?: string;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>> => {
    return callApiContract(feedbackContracts.list, params) as Promise<ApiResponse<{
      feedback: Array<{
        id: string;
        conversationId: string;
        rating: number;
        comment?: string;
        feedbackType: string;
        customerName: string;
        agentName?: string;
        createdAt: string;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>>
  }
}
