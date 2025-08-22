// 系統管理 API 客戶端
import { apiClient } from './base'
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
    return apiClient.get('/system/info')
  },

  // 獲取系統設定
  getSettings: async (): Promise<ApiResponse<SystemSettings>> => {
    return apiClient.get('/system/settings')
  },

  // 更新系統設定
  updateSettings: async (settings: SystemSettingsUpdate): Promise<ApiResponse<void>> => {
    return apiClient.put('/system/settings', settings)
  },

  // 測試平台集成
  testIntegration: async (
    platform: 'line' | 'facebook', 
    config: IntegrationTestRequest
  ): Promise<ApiResponse<{ status: string; message?: string }>> => {
    return apiClient.post(`/system/integrations/${platform}/test`, config)
  },

  // 獲取系統指標
  getMetrics: async (): Promise<ApiResponse<SystemMetrics>> => {
    return apiClient.get('/system/metrics')
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
    const queryParams = new URLSearchParams()
    if (params?.level) {queryParams.append('level', params.level)}
    if (params?.startDate) {queryParams.append('startDate', params.startDate)}
    if (params?.endDate) {queryParams.append('endDate', params.endDate)}
    if (params?.limit) {queryParams.append('limit', params.limit.toString())}
    
    const queryString = queryParams.toString()
    return apiClient.get(`/api/system/logs${queryString ? `?${queryString}` : ''}`)
  },

  // 匯出系統配置
  exportConfig: async (): Promise<ApiResponse<SystemSettings>> => {
    return apiClient.get('/system/config/export')
  },

  // 導入系統配置
  importConfig: async (config: SystemSettings): Promise<ApiResponse<void>> => {
    return apiClient.post('/system/config/import', config)
  },

  // 備份資料庫
  backupDatabase: async (): Promise<ApiResponse<{
    backupId: string;
    filename: string;
    size: number;
    createdAt: Date | string;
  }>> => {
    return apiClient.post('/system/database/backup')
  },

  // 獲取備份列表
  getBackups: async (): Promise<ApiResponse<Array<{
    id: string;
    filename: string;
    size: number;
    createdAt: Date | string;
  }>>> => {
    return apiClient.get('/system/database/backups')
  },

  // 恢復資料庫
  restoreDatabase: async (backupId: string): Promise<ApiResponse<void>> => {
    return apiClient.post(`/system/database/restore/${backupId}`)
  },

  // 清除快取
  clearCache: async (type?: 'all' | 'conversations' | 'messages' | 'sessions'): Promise<ApiResponse<{
    cleared: string[];
    totalSize: number;
  }>> => {
    return apiClient.post('/system/cache/clear', { type: type || 'all' })
  },

  // 重啟系統
  restartSystem: async (): Promise<ApiResponse<void>> => {
    return apiClient.post('/system/restart')
  },

  // 健康檢查
  healthCheck: async (): Promise<ApiResponse<{
    status: 'healthy' | 'unhealthy';
    checks: {
      database: boolean;
      cache: boolean;
      integrations: {
        line: boolean;
        facebook: boolean;
      };
    };
    timestamp: Date | string;
  }>> => {
    return apiClient.get('/system/health')
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
    return apiClient.get(`/api/system/stats${period ? `?period=${period}` : ''}`)
  },

  // 更新 Webhook URL
  updateWebhookUrl: async (
    platform: 'line' | 'facebook',
    url: string
  ): Promise<ApiResponse<void>> => {
    return apiClient.put(`/api/system/webhooks/${platform}`, { url })
  },

  // 測試 Webhook
  testWebhook: async (
    platform: 'line' | 'facebook'
  ): Promise<ApiResponse<{
    success: boolean;
    responseTime: number;
    error?: string;
  }>> => {
    return apiClient.post(`/api/system/webhooks/${platform}/test`)
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
    const queryParams = new URLSearchParams()
    if (params?.type) {queryParams.append('type', params.type)}
    if (params?.startDate) {queryParams.append('startDate', params.startDate)}
    if (params?.endDate) {queryParams.append('endDate', params.endDate)}
    if (params?.limit) {queryParams.append('limit', params.limit.toString())}
    
    const queryString = queryParams.toString()
    return apiClient.get(`/api/system/events${queryString ? `?${queryString}` : ''}`)
  },

  // 系統維護模式
  setMaintenanceMode: async (enabled: boolean, message?: string): Promise<ApiResponse<void>> => {
    return apiClient.post('/system/maintenance', { enabled, message })
  },

  // 獲取維護狀態
  getMaintenanceStatus: async (): Promise<ApiResponse<{
    enabled: boolean;
    message?: string;
    scheduledAt?: Date | string;
  }>> => {
    return apiClient.get('/system/maintenance')
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
    return apiClient.post('/credentials', { platform, type, value })
  },

  // 獲取單個憑證
  getCredential: async (
    platform: 'line' | 'facebook',
    type: string
  ): Promise<ApiResponse<{ value: string }>> => {
    return apiClient.get(`/credentials/${platform}/${type}`)
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
    return apiClient.get('/credentials')
  },

  // 清除平台憑證
  clearPlatformCredentials: async (
    platform: 'line' | 'facebook'
  ): Promise<ApiResponse<void>> => {
    return apiClient.delete(`/credentials/${platform}`)
  },

  // 備份憑證
  backupCredentials: async (): Promise<ApiResponse<{
    timestamp: string;
    credentials: Record<string, string>;
    version: string;
  }>> => {
    return apiClient.get('/credentials/backup')
  }
}