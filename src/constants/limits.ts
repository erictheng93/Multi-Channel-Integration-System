/**
 * 系統限制常量
 *
 * 統一管理所有時間、大小、數量限制常量
 * 避免魔術數字（magic numbers）提升代碼可讀性和可維護性
 *
 * @module constants/limits
 */

// ============================================================================
// 時間限制 (毫秒)
// ============================================================================

/**
 * 時間相關常量（毫秒）
 */
export const TIME_LIMITS = {
  /** 1 秒 */
  ONE_SECOND_MS: 1000,

  /** 5 秒 */
  FIVE_SECONDS_MS: 5000,

  /** 10 秒 */
  TEN_SECONDS_MS: 10000,

  /** 30 秒 */
  THIRTY_SECONDS_MS: 30000,

  /** 1 分鐘 */
  ONE_MINUTE_MS: 60 * 1000,

  /** 5 分鐘 */
  FIVE_MINUTES_MS: 5 * 60 * 1000,

  /** 10 分鐘 */
  TEN_MINUTES_MS: 10 * 60 * 1000,

  /** 1 小時 */
  ONE_HOUR_MS: 60 * 60 * 1000,

  /** 24 小時 */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,

  /** 7 天 */
  ONE_WEEK_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * 時間常量（秒）- 用於 TTL 等場景
 */
export const TIME_LIMITS_SECONDS = {
  /** 1 分鐘 */
  ONE_MINUTE_S: 60,

  /** 5 分鐘 */
  FIVE_MINUTES_S: 5 * 60,

  /** 30 分鐘 */
  THIRTY_MINUTES_S: 30 * 60,

  /** 1 小時 */
  ONE_HOUR_S: 60 * 60,

  /** 1 天 */
  ONE_DAY_S: 24 * 60 * 60,

  /** 7 天 */
  ONE_WEEK_S: 7 * 24 * 60 * 60,

  /** 30 天 */
  ONE_MONTH_S: 30 * 24 * 60 * 60,
} as const;

// ============================================================================
// 超時配置
// ============================================================================

/**
 * API 和服務超時配置（毫秒）
 */
export const TIMEOUT_CONFIG = {
  /** 數據庫查詢超時 */
  DATABASE_QUERY: 5000,

  /** KV 操作超時 */
  KV_OPERATION: 3000,

  /** API 請求超時 */
  API_REQUEST: 10000,

  /** WebSocket 連接超時 */
  WEBSOCKET_CONNECT: 5000,

  /** WebSocket 消息超時 */
  WEBSOCKET_MESSAGE: 2000,

  /** Durable Object fetch 超時 */
  DURABLE_OBJECT_FETCH: 5000,

  /** 外部 API 調用超時 */
  EXTERNAL_API: 10000,

  /** 文件上傳超時 */
  FILE_UPLOAD: 30000,

  /** 批量操作超時 */
  BATCH_OPERATION: 60000,
} as const;

/**
 * 重試配置
 */
export const RETRY_CONFIG = {
  /** 基礎重試延遲（毫秒） */
  BASE_DELAY_MS: 1000,

  /** 最大重試次數 */
  MAX_ATTEMPTS: 3,

  /** 最大重試延遲（毫秒） */
  MAX_DELAY_MS: 30000,

  /** 指數退避基數 */
  EXPONENTIAL_BASE: 2,
} as const;

/**
 * 批處理和調度配置
 */
export const BATCH_CONFIG = {
  /** 批處理延遲（毫秒） */
  BATCH_DELAY_MS: 5000,

  /** 批處理窗口（毫秒） */
  BATCH_WINDOW_MS: 10000,

  /** 告警重試延遲（毫秒） */
  ALARM_RETRY_DELAY_MS: 60000,

  /** 存儲寫入防抖延遲（毫秒） */
  STORAGE_WRITE_DEBOUNCE_MS: 5000,

  /** 指標收集間隔（毫秒） */
  METRICS_INTERVAL_MS: 10000,

  /** 持久化間隔（毫秒） */
  PERSIST_INTERVAL_MS: 60000,
} as const;

// ============================================================================
// 大小限制
// ============================================================================

/**
 * 文件和數據大小限制（字節）
 */
export const SIZE_LIMITS = {
  /** 1 KB */
  ONE_KB: 1024,

  /** 1 MB */
  ONE_MB: 1024 * 1024,

  /** 5 MB - 文件上傳默認最大大小 */
  FILE_UPLOAD_MAX: 5 * 1024 * 1024,

  /** 10 MB - 文件上傳絕對最大大小 */
  FILE_UPLOAD_ABSOLUTE_MAX: 10 * 1024 * 1024,

  /** Webhook payload 最大大小 */
  WEBHOOK_PAYLOAD_MAX: 5 * 1024 * 1024,

  /** API 請求體最大大小 */
  API_REQUEST_BODY_MAX: 1 * 1024 * 1024,

  /** 消息內容最大大小 */
  MESSAGE_CONTENT_MAX: 10 * 1024,
} as const;

/**
 * 字符串長度限制
 */
export const LENGTH_LIMITS = {
  /** 文件名最大長度 */
  FILENAME_MAX: 30,

  /** 文件名最大長度（顯示用） */
  FILENAME_DISPLAY_MAX: 25,

  /** 用戶名最大長度 */
  USERNAME_MAX: 50,

  /** 郵箱最大長度 */
  EMAIL_MAX: 255,

  /** 簡短描述最大長度 */
  SHORT_DESCRIPTION_MAX: 100,

  /** 長描述最大長度 */
  LONG_DESCRIPTION_MAX: 1000,

  /** 標題最大長度 */
  TITLE_MAX: 200,

  /** 標籤名稱最大長度 */
  TAG_NAME_MAX: 50,
} as const;

/**
 * 平台特定消息長度限制
 */
export const PLATFORM_MESSAGE_LIMITS = {
  /** LINE 平台消息最大長度 */
  LINE: 5000,

  /** Facebook Messenger 消息最大長度 */
  FACEBOOK: 2000,

  /** 系統消息最大長度 */
  SYSTEM: 10000,
} as const;

// ============================================================================
// 數量和頻率限制
// ============================================================================

/**
 * 分頁和列表限制
 */
export const PAGINATION_LIMITS = {
  /** 默認每頁數量 */
  DEFAULT_PAGE_SIZE: 20,

  /** 最小每頁數量 */
  MIN_PAGE_SIZE: 1,

  /** 最大每頁數量 */
  MAX_PAGE_SIZE: 100,

  /** 最大頁碼 */
  MAX_PAGE_NUMBER: 1000,

  /** 標籤列表默認每頁數量 */
  TAG_DEFAULT_PAGE_SIZE: 50,

  /** 搜索結果最大返回數量 */
  SEARCH_MAX_RESULTS: 100,
} as const;

/**
 * 批量操作限制
 */
export const BULK_OPERATION_LIMITS = {
  /** 批量創建消息最大數量 */
  BULK_CREATE_MESSAGES_MAX: 100,

  /** 批量刪除消息最大數量 */
  BULK_DELETE_MESSAGES_MAX: 100,

  /** 消息轉發最大目標數 */
  FORWARD_TARGETS_MAX: 20,

  /** 消息標籤最大數量 */
  MESSAGE_TAGS_MAX: 10,

  /** 批量導出最大記錄數 (Workers Paid Plan 可支撐同步匯出 ~10,000 筆) */
  EXPORT_MAX_RECORDS: 5000,

  /** 批量導出最小記錄數 */
  EXPORT_MIN_RECORDS: 1,
} as const;

/**
 * 頻率和速率限制
 */
export const RATE_LIMITS = {
  /** API 速率限制窗口（毫秒） */
  WINDOW_MS: 60 * 1000,

  /** 生產環境每窗口最大請求數 */
  MAX_REQUESTS_PRODUCTION: 100,

  /** 開發環境每窗口最大請求數 */
  MAX_REQUESTS_DEVELOPMENT: 1000,

  /** WebSocket 消息速率限制窗口（毫秒） */
  WEBSOCKET_RATE_WINDOW_MS: 1000,

  /** WebSocket 每秒最大消息數 */
  WEBSOCKET_MAX_MESSAGES_PER_SECOND: 10,
} as const;

/**
 * 延遲發送 / 撤回窗口限制（秒）
 *
 * 單一事實來源：所有 delaySeconds 邊界檢查都必須引用這裡，
 * 不得散落硬編碼（DelayedMessageScheduler、delayed-message-buffer）。
 */
export const DELAYED_MESSAGE_LIMITS = {
  /** 最小延遲秒數 */
  MIN_DELAY_SECONDS: 1,

  /** 最大延遲秒數 = 最大可撤回窗口（5 分鐘） */
  MAX_DELAY_SECONDS: 300,
} as const;

/**
 * 隊列和緩存限制
 */
export const QUEUE_LIMITS = {
  /** 最大隊列大小 */
  MAX_QUEUE_SIZE: 10000,

  /** 最大條目數（清理前） */
  MAX_ENTRIES: 10000,

  /** 預熱會話數量 */
  WARMUP_CONVERSATIONS: 100,

  /** KV 列表操作限制 */
  KV_LIST_LIMIT: 1000,

  /** 消息發送持續時間歷史記錄最大數量 */
  SEND_DURATION_HISTORY_MAX: 1000,
} as const;

/**
 * 快取 TTL 配置（秒）
 */
export const CACHE_TTL = {
  /** Session 快取 TTL */
  SESSION: 86400, // 24 hours

  /** 一般快取 TTL */
  DEFAULT: 3600, // 1 hour

  /** 用戶資料快取 TTL */
  USER_PROFILE: 3600, // 1 hour

  /** CORS 最大快取時間 */
  CORS_MAX_AGE: 86400, // 24 hours

  /** JWT 過期時間 */
  JWT_EXPIRES_IN: 86400, // 24 hours
} as const;

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 將秒轉換為毫秒
 * @param seconds - 秒數
 * @returns 毫秒數
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * 將毫秒轉換為秒
 * @param ms - 毫秒數
 * @returns 秒數
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * 計算指數退避延遲
 * @param attempt - 當前嘗試次數（從 0 開始）
 * @param baseDelay - 基礎延遲（毫秒）
 * @param maxDelay - 最大延遲（毫秒）
 * @returns 計算後的延遲時間（毫秒）
 */
export function calculateExponentialBackoff(
  attempt: number,
  baseDelay: number = RETRY_CONFIG.BASE_DELAY_MS,
  maxDelay: number = RETRY_CONFIG.MAX_DELAY_MS
): number {
  const delay = baseDelay * Math.pow(RETRY_CONFIG.EXPONENTIAL_BASE, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * 檢查分頁參數是否有效
 * @param page - 頁碼
 * @param pageSize - 每頁數量
 * @returns 如果有效返回 true
 */
export function isValidPagination(page: number, pageSize: number): boolean {
  return (
    page > 0 &&
    page <= PAGINATION_LIMITS.MAX_PAGE_NUMBER &&
    pageSize >= PAGINATION_LIMITS.MIN_PAGE_SIZE &&
    pageSize <= PAGINATION_LIMITS.MAX_PAGE_SIZE
  );
}

/**
 * 標準化分頁參數
 * @param page - 頁碼
 * @param pageSize - 每頁數量
 * @returns 標準化後的分頁參數
 */
export function normalizePagination(page?: number, pageSize?: number): {
  page: number;
  pageSize: number;
} {
  return {
    page: Math.max(1, Math.min(page || 1, PAGINATION_LIMITS.MAX_PAGE_NUMBER)),
    pageSize: Math.max(
      PAGINATION_LIMITS.MIN_PAGE_SIZE,
      Math.min(pageSize || PAGINATION_LIMITS.DEFAULT_PAGE_SIZE, PAGINATION_LIMITS.MAX_PAGE_SIZE)
    ),
  };
}
