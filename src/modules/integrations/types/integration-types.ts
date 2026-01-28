// Integration 模組核心類型定義
// Core type definitions for Integration module

// ======================== 基礎平台類型 ========================

/**
 * 支援的整合平台列舉
 */
export type IntegrationPlatform =
  | 'line'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'whatsapp'
  | 'wechat'
  | 'custom';

/**
 * 平台整合狀態
 */
export type IntegrationStatus =
  | 'active'
  | 'inactive'
  | 'error'
  | 'configuring'
  | 'testing'
  | 'suspended';

/**
 * 憑證類型定義
 */
export type CredentialType =
  | 'access_token'
  | 'refresh_token'
  | 'api_key'
  | 'webhook_secret'
  | 'app_secret'
  | 'certificate'
  | 'oauth_credentials';

// ======================== 核心介面定義 ========================

/**
 * 平台整合記錄
 */
export interface IntegrationRecord {
  id: string;
  platform: IntegrationPlatform;
  name: string;
  displayName?: string;
  description?: string;
  status: IntegrationStatus;

  // 基本設定
  config: IntegrationConfig;
  credentials: EncryptedCredentials;

  // 功能設定
  features: PlatformFeatures;
  webhookConfig?: WebhookConfiguration;

  // 元數據
  teamId?: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;

  // 統計數據
  stats?: IntegrationStats;

  // 健康狀態
  health?: HealthStatus;
}

/**
 * 平台整合設定
 */
export interface IntegrationConfig {
  // 基本設定
  enabled: boolean;
  autoRetry: boolean;
  maxRetries: number;
  retryDelayMs: number;

  // 速率限制
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
    burstSize?: number;
  };

  // 訊息設定
  messageConfig?: {
    maxLength: number;
    supportedTypes: MessageType[];
    autoTranslate?: boolean;
    defaultLanguage?: string;
  };

  // 通知設定
  notifications?: {
    webhookUrl?: string;
    emailAlerts?: string[];
    slackChannel?: string;
  };

  // 高級設定
  advanced?: Record<string, any>;
}

/**
 * 加密憑證存儲
 */
export interface EncryptedCredentials {
  encryptedData: string;
  keyId: string;
  algorithm: string;
  createdAt: string;
  expiresAt?: string;

  // 憑證元數據（非機密）
  metadata: {
    type: CredentialType[];
    scopes?: string[];
    permissions?: string[];
    lastValidated?: string;
  };
}

/**
 * 平台功能配置
 */
export interface PlatformFeatures {
  messaging: {
    sendText: boolean;
    sendImage: boolean;
    sendFile: boolean;
    sendLocation: boolean;
    sendQuickReply: boolean;
    sendCarousel: boolean;
    sendTemplate: boolean;
  };

  receiving: {
    receiveText: boolean;
    receiveImage: boolean;
    receiveFile: boolean;
    receiveLocation: boolean;
    receivePostback: boolean;
  };

  advanced: {
    richMenu: boolean;
    broadcast: boolean;
    multicast: boolean;
    push: boolean;
    userProfile: boolean;
  };
}

/**
 * Webhook 配置
 */
export interface WebhookConfiguration {
  enabled: boolean;
  endpoint: string;
  secret?: string;

  // 事件訂閱
  events: WebhookEventType[];

  // 驗證設定
  verification: {
    method: 'signature' | 'token' | 'none';
    headerName?: string;
    algorithm?: string;
  };

  // 重試設定
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoffMs: number;
  };

  // 過濾設定
  filters?: {
    userIds?: string[];
    messageTypes?: MessageType[];
    keywords?: string[];
  };
}

/**
 * Webhook 事件類型
 */
export type WebhookEventType =
  | 'message'
  | 'postback'
  | 'follow'
  | 'unfollow'
  | 'join'
  | 'leave'
  | 'memberJoin'
  | 'memberLeave'
  | 'beacon'
  | 'accountLink'
  | 'delivery'
  | 'read'
  | 'error';

/**
 * 訊息類型
 */
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'sticker'
  | 'imagemap'
  | 'template'
  | 'flex';

/**
 * 整合統計數據
 */
export interface IntegrationStats {
  // 訊息統計
  messages: {
    sent: number;
    received: number;
    failed: number;
    pending: number;
  };

  // API 調用統計
  apiCalls: {
    successful: number;
    failed: number;
    rateLimited: number;
    total: number;
  };

  // Webhook 統計
  webhooks: {
    received: number;
    processed: number;
    failed: number;
    invalid: number;
  };

  // 時間統計
  timing: {
    averageResponseTimeMs: number;
    maxResponseTimeMs: number;
    minResponseTimeMs: number;
    last24h: number;
  };

  // 更新時間
  lastUpdated: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * 健康狀態
 */
export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'error' | 'unknown';

  checks: {
    connectivity: HealthCheck;
    authentication: HealthCheck;
    webhook: HealthCheck;
    rateLimit: HealthCheck;
    storage: HealthCheck;
  };

  lastChecked: string;
  nextCheck: string;
}

/**
 * 健康檢查項目
 */
export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message?: string;
  duration?: number;
  checkedAt: string;

  details?: {
    latency?: number;
    errorRate?: number;
    lastError?: string;
    metadata?: Record<string, any>;
  };
}

// ======================== 請求/回應類型 ========================

/**
 * 創建整合請求
 */
export interface CreateIntegrationRequest {
  platform: IntegrationPlatform;
  name: string;
  displayName?: string;
  description?: string;

  config: Partial<IntegrationConfig>;
  credentials: Record<string, string | number | boolean>;
  features?: Partial<PlatformFeatures>;
  webhookConfig?: Partial<WebhookConfiguration>;

  teamId?: number;
}

/**
 * 更新整合請求
 */
export interface UpdateIntegrationRequest {
  name?: string;
  displayName?: string;
  description?: string;
  status?: IntegrationStatus;

  config?: Partial<IntegrationConfig>;
  credentials?: Record<string, string | number | boolean>;
  features?: Partial<PlatformFeatures>;
  webhookConfig?: Partial<WebhookConfiguration>;
}

/**
 * 整合列表查詢
 */
export interface IntegrationListQuery {
  platform?: IntegrationPlatform;
  status?: IntegrationStatus;
  teamId?: number;
  createdBy?: number;

  search?: string;
  sortBy?: 'name' | 'platform' | 'status' | 'createdAt' | 'lastUsedAt';
  sortOrder?: 'asc' | 'desc';

  page?: number;
  limit?: number;
}

/**
 * 整合列表回應
 */
export interface IntegrationListResponse {
  integrations: IntegrationRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    applied: IntegrationListQuery;
    available: {
      platforms: IntegrationPlatform[];
      statuses: IntegrationStatus[];
    };
  };
}

/**
 * 測試整合請求
 */
export interface TestIntegrationRequest {
  type: 'connectivity' | 'authentication' | 'webhook' | 'message' | 'full';

  // 訊息測試設定
  messageTest?: {
    recipient: string;
    content: string;
    type: MessageType;
  };

  // Webhook 測試設定
  webhookTest?: {
    eventType: WebhookEventType;
    payload?: Record<string, any>;
  };
}

/**
 * 測試整合回應
 */
export interface TestIntegrationResponse {
  success: boolean;
  type: string;

  results: {
    connectivity?: TestResult;
    authentication?: TestResult;
    webhook?: TestResult;
    message?: TestResult;
  };

  summary: {
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
  };

  recommendations?: string[];
  timestamp: string;
}

/**
 * 測試結果
 */
export interface TestResult {
  passed: boolean;
  message: string;
  duration: number;

  details?: {
    httpStatus?: number;
    responseTime?: number;
    errorCode?: string;
    metadata?: Record<string, any>;
  };

  warnings?: string[];
}

// ======================== 平台特定類型 ========================

/**
 * LINE OA 特定設定
 */
export interface LineIntegrationConfig extends IntegrationConfig {
  channelId: string;
  richMenus?: {
    default?: string;
    conditional?: Array<{
      menuId: string;
      condition: string;
    }>;
  };

  liff?: {
    enabled: boolean;
    apps: Array<{
      liffId: string;
      name: string;
      type: 'compact' | 'tall' | 'full';
    }>;
  };
}

/**
 * Facebook 特定設定
 */
export interface FacebookIntegrationConfig extends IntegrationConfig {
  pageId: string;
  appId: string;

  messenger?: {
    greetingText?: string;
    persistentMenu?: any[];
    getStartedPayload?: string;
  };

  instagram?: {
    enabled: boolean;
    businessAccountId?: string;
  };
}

// ======================== 批量操作類型 ========================

/**
 * 批量整合操作
 */
export interface BatchIntegrationOperation {
  action: 'create' | 'update' | 'delete' | 'test' | 'toggle';
  integrations: Array<{
    id?: string;
    data: CreateIntegrationRequest | UpdateIntegrationRequest;
  }>;

  options?: {
    continueOnError: boolean;
    validateOnly: boolean;
    parallel: boolean;
  };
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult {
  success: boolean;
  total: number;

  results: {
    successful: number;
    failed: number;
    skipped: number;
  };

  details: Array<{
    index: number;
    id?: string;
    success: boolean;
    error?: string;
    data?: IntegrationRecord;
  }>;

  summary: string;
  duration: number;
  timestamp: string;
}

// ======================== 服務介面類型 ========================

/**
 * 整合服務介面
 */
export interface IIntegrationService {
  // 基本 CRUD
  create(data: CreateIntegrationRequest, userId: number): Promise<IntegrationRecord>;
  getById(id: string, userId: number, teamId?: number): Promise<IntegrationRecord | null>;
  list(query: IntegrationListQuery, userId: number, teamId?: number): Promise<IntegrationListResponse>;
  update(id: string, data: UpdateIntegrationRequest, userId: number): Promise<IntegrationRecord>;
  delete(id: string, userId: number): Promise<boolean>;

  // 狀態管理
  activate(id: string, userId: number): Promise<IntegrationRecord>;
  deactivate(id: string, userId: number): Promise<IntegrationRecord>;
  test(id: string, request: TestIntegrationRequest, userId: number): Promise<TestIntegrationResponse>;

  // 統計和監控
  getStats(id: string, userId: number): Promise<IntegrationStats>;
  getHealth(id: string, userId: number): Promise<HealthStatus>;
  refreshStats(id: string, userId: number): Promise<IntegrationStats>;

  // 批量操作
  batchOperation(operation: BatchIntegrationOperation, userId: number): Promise<BatchOperationResult>;
}

/**
 * 平台適配器介面
 */
export interface IPlatformAdapter {
  platform: IntegrationPlatform;

  // 連接管理
  connect(credentials: Record<string, any>, config: IntegrationConfig): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;

  // 訊息操作
  sendMessage(recipient: string, message: any): Promise<any>;
  receiveMessage(webhook: any): Promise<any>;

  // 用戶操作
  getUserProfile(userId: string): Promise<any>;

  // 健康檢查
  healthCheck(): Promise<HealthCheck>;

  // 統計數據
  getStats(): Promise<Partial<IntegrationStats>>;
}

// ======================== 錯誤類型 ========================

/**
 * 整合未找到錯誤
 */
export class IntegrationNotFoundError extends Error {
  constructor(id: string) {
    super(`Integration not found: ${id}`);
    this.name = 'IntegrationNotFoundError';
  }
}

/**
 * 整合驗證錯誤
 */
export class IntegrationValidationError extends Error {
  public field: string;
  public code: string;

  constructor(field: string, message: string, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'IntegrationValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * 平台連接錯誤
 */
export class PlatformConnectionError extends Error {
  public platform: IntegrationPlatform;
  public statusCode?: number;
  public originalError?: Error;

  constructor(platform: IntegrationPlatform, message: string, statusCode?: number, originalError?: Error) {
    super(message);
    this.name = 'PlatformConnectionError';
    this.platform = platform;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

/**
 * 憑證錯誤
 */
export class CredentialError extends Error {
  public type: CredentialType;
  public reason: 'expired' | 'invalid' | 'missing' | 'encrypted_error';

  constructor(type: CredentialType, reason: CredentialError['reason'], message: string) {
    super(message);
    this.name = 'CredentialError';
    this.type = type;
    this.reason = reason;
  }
}

// ======================== 常數定義 ========================

/**
 * 預設整合設定
 */
export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  enabled: true,
  autoRetry: true,
  maxRetries: 3,
  retryDelayMs: 1000,

  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
    burstSize: 10
  },

  messageConfig: {
    maxLength: 2000,
    supportedTypes: ['text', 'image', 'file'],
    autoTranslate: false,
    defaultLanguage: 'zh-TW'
  }
};

/**
 * 預設平台功能
 */
export const DEFAULT_PLATFORM_FEATURES: PlatformFeatures = {
  messaging: {
    sendText: true,
    sendImage: false,
    sendFile: false,
    sendLocation: false,
    sendQuickReply: false,
    sendCarousel: false,
    sendTemplate: false
  },

  receiving: {
    receiveText: true,
    receiveImage: false,
    receiveFile: false,
    receiveLocation: false,
    receivePostback: false
  },

  advanced: {
    richMenu: false,
    broadcast: false,
    multicast: false,
    push: false,
    userProfile: false
  }
};

/**
 * 支援的平台列表及其功能
 */
export const PLATFORM_CAPABILITIES: Record<IntegrationPlatform, Partial<PlatformFeatures>> = {
  line: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendLocation: true,
      sendQuickReply: true,
      sendCarousel: true,
      sendTemplate: true
    },
    advanced: {
      richMenu: true,
      broadcast: true,
      multicast: true,
      push: true,
      userProfile: true
    }
  },

  facebook: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendLocation: false,
      sendQuickReply: true,
      sendCarousel: false,
      sendTemplate: true
    },
    advanced: {
      richMenu: false,
      broadcast: true,
      multicast: false,
      push: false,
      userProfile: true
    }
  },

  instagram: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: false,
      sendLocation: false,
      sendQuickReply: false,
      sendCarousel: false,
      sendTemplate: false
    }
  },

  telegram: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendLocation: true,
      sendQuickReply: false,
      sendCarousel: false,
      sendTemplate: false
    }
  },

  whatsapp: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendLocation: false,
      sendQuickReply: false,
      sendCarousel: false,
      sendTemplate: true
    }
  },

  wechat: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: false,
      sendLocation: false,
      sendQuickReply: false,
      sendCarousel: false,
      sendTemplate: false
    }
  },

  custom: {
    messaging: {
      sendText: true,
      sendImage: false,
      sendFile: false,
      sendLocation: false,
      sendQuickReply: false,
      sendCarousel: false,
      sendTemplate: false
    }
  }
};

// ======================== 工具類型 ========================

/**
 * 整合上下文
 */
export interface IntegrationContext {
  integration: IntegrationRecord;
  user: {
    id: number;
    role: string;
    teamId?: number;
  };
  request: {
    ip: string;
    userAgent: string;
    timestamp: string;
  };
}

/**
 * 平台事件
 */
export interface PlatformEvent {
  id: string;
  integrationId: string;
  platform: IntegrationPlatform;
  type: WebhookEventType;

  source: {
    userId: string;
    type: 'user' | 'group' | 'room';
    id?: string;
  };

  message?: {
    id: string;
    type: MessageType;
    content: any;
    timestamp: string;
  };

  timestamp: string;
  processed: boolean;
  error?: string;
}