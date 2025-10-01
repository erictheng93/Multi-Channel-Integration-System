// System Module Types
// 系統模組類型定義

// 系統狀態類型
export interface SystemStatus {
  overall: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      type: string;
    };
    kv: {
      status: 'available' | 'unavailable';
      namespaces: string[];
    };
    r2: {
      status: 'available' | 'unavailable';
      bucket: string;
    };
    queue: {
      status: 'available' | 'unavailable';
      name: string;
    };
  };
  environment: string;
}

// 健康檢查響應
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected';
  version: string;
  error?: string;
}

// 系統信息
export interface SystemInfo {
  version: string;
  environment: string;
  lastUpdate: string;
  dbStatus: 'online' | 'offline';
  cacheStatus: 'online' | 'offline';
  uptime: number;
}

// API 端點信息
export interface ApiInfo {
  name: string;
  version: string;
  endpoints: Record<string, string>;
  timestamp: string;
}

// 數據統計
export interface SystemStats {
  totalMessages: number;
  totalCustomers: number;
  totalConversations: number;
  recentMessages: any[];
}

// 系統設置響應（不包含敏感信息）
export interface SystemSettingsResponse {
  general?: {
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  };
  integrations?: {
    line?: {
      status: 'connected' | 'disconnected' | 'error';
    };
    facebook?: {
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

// 系統設置更新（部分更新）
export interface SystemSettingsUpdate {
  general?: Partial<{
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  }>;
  integrations?: {
    line?: Partial<{
      channelId: string;
      channelSecret: string;
      accessToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
    facebook?: Partial<{
      appId: string;
      appSecret: string;
      pageId: string;
      pageToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
  };
  advanced?: Partial<{
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  }>;
}

// 消息回復統計
export interface MessageRepliesResponse {
  messageId: string;
  replies: any[];
  count: number;
}

// 對話消息樹結構
export interface ConversationMessageTree {
  conversationId: string;
  messages: any[];
  replyMap: Record<string, any[]>;
  totalMessages: number;
}

// 撤回統計
export interface RecallStats {
  totalMessages: number;
  recalledMessages: number;
  successfulRecalls: number;
  failedRecalls: number;
}

// 平台整合測試結果
export interface IntegrationTestResult {
  platform: 'line' | 'facebook';
  status: 'success' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}

// 系統指標
export interface SystemMetrics {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: {
    inbound: number;
    outbound: number;
  };
  requests?: {
    total: number;
    successful: number;
    failed: number;
  };
  timestamp: string;
}

// 備份信息
export interface BackupInfo {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  type: 'full' | 'incremental';
  status: 'completed' | 'in_progress' | 'failed';
}

// 系統服務介面
export interface SystemServiceInterface {
  // 健康檢查
  checkHealth(): Promise<HealthCheckResponse>;
  getSystemStatus(): Promise<SystemStatus>;

  // 系統信息
  getSystemInfo(): Promise<SystemInfo>;
  getApiInfo(): Promise<ApiInfo>;

  // 統計數據
  getStats(): Promise<SystemStats>;
  getRecallStats(): Promise<RecallStats>;

  // 設置管理
  getSettings(): Promise<SystemSettingsResponse>;
  updateSettings(settings: SystemSettingsUpdate): Promise<SystemSettingsResponse>;

  // 平台整合測試
  testIntegration(platform: 'line' | 'facebook'): Promise<IntegrationTestResult>;

  // 系統管理
  getMetrics(): Promise<SystemMetrics>;
  createBackup(): Promise<BackupInfo>;
  getBackups(): Promise<BackupInfo[]>;
  restoreBackup(backupId: string): Promise<boolean>;
  clearCache(): Promise<boolean>;
  restartSystem(): Promise<boolean>;
}

// API 響應類型
export interface SystemApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}