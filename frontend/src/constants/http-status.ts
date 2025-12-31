/**
 * HTTP Status Codes Constants (Frontend)
 * HTTP 狀態碼常數定義（前端）
 *
 * 前端常用的 HTTP 狀態碼集合
 * 使用 as const 確保類型安全和不可變性
 */

// ===== 成功狀態 (2xx) =====
export const HTTP_SUCCESS = {
  /** 200 OK - 請求成功 */
  OK: 200,

  /** 201 Created - 資源已創建 */
  CREATED: 201,

  /** 204 No Content - 無內容返回 */
  NO_CONTENT: 204
} as const;

// ===== 客戶端錯誤 (4xx) =====
export const HTTP_CLIENT_ERROR = {
  /** 400 Bad Request - 錯誤的請求 */
  BAD_REQUEST: 400,

  /** 401 Unauthorized - 未授權 */
  UNAUTHORIZED: 401,

  /** 403 Forbidden - 禁止訪問 */
  FORBIDDEN: 403,

  /** 404 Not Found - 資源不存在 */
  NOT_FOUND: 404,

  /** 409 Conflict - 衝突 */
  CONFLICT: 409,

  /** 422 Unprocessable Entity - 無法處理的實體 */
  UNPROCESSABLE_ENTITY: 422,

  /** 429 Too Many Requests - 請求過多 */
  TOO_MANY_REQUESTS: 429
} as const;

// ===== 伺服器錯誤 (5xx) =====
export const HTTP_SERVER_ERROR = {
  /** 500 Internal Server Error - 內部伺服器錯誤 */
  INTERNAL_SERVER_ERROR: 500,

  /** 502 Bad Gateway - 錯誤的閘道 */
  BAD_GATEWAY: 502,

  /** 503 Service Unavailable - 服務不可用 */
  SERVICE_UNAVAILABLE: 503,

  /** 504 Gateway Timeout - 閘道超時 */
  GATEWAY_TIMEOUT: 504
} as const;

// ===== 統一導出：所有狀態碼 =====
export const HTTP_STATUS = {
  ...HTTP_SUCCESS,
  ...HTTP_CLIENT_ERROR,
  ...HTTP_SERVER_ERROR
} as const;

// ===== 類型定義 =====
export type HttpSuccessCode = typeof HTTP_SUCCESS[keyof typeof HTTP_SUCCESS];
export type HttpClientErrorCode = typeof HTTP_CLIENT_ERROR[keyof typeof HTTP_CLIENT_ERROR];
export type HttpServerErrorCode = typeof HTTP_SERVER_ERROR[keyof typeof HTTP_SERVER_ERROR];
export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

// ===== 輔助函數 =====

/**
 * 判斷是否為成功狀態碼 (2xx)
 */
export function isHttpSuccessStatus(status: number): status is HttpSuccessCode {
  return status >= 200 && status < 300;
}

/**
 * 判斷是否為客戶端錯誤狀態碼 (4xx)
 */
export function isHttpClientErrorStatus(status: number): status is HttpClientErrorCode {
  return status >= 400 && status < 500;
}

/**
 * 判斷是否為伺服器錯誤狀態碼 (5xx)
 */
export function isHttpServerErrorStatus(status: number): status is HttpServerErrorCode {
  return status >= 500 && status < 600;
}

/**
 * 判斷是否為錯誤狀態碼 (4xx 或 5xx)
 */
export function isHttpErrorStatus(status: number): boolean {
  return isHttpClientErrorStatus(status) || isHttpServerErrorStatus(status);
}

/**
 * 取得錯誤訊息（前端友善）
 */
export function getErrorMessage(status: number): string {
  switch (status) {
    case HTTP_STATUS.BAD_REQUEST:
      return '請求格式錯誤，請檢查輸入資料';
    case HTTP_STATUS.UNAUTHORIZED:
      return '登入已過期，請重新登入';
    case HTTP_STATUS.FORBIDDEN:
      return '您沒有權限執行此操作';
    case HTTP_STATUS.NOT_FOUND:
      return '請求的資源不存在';
    case HTTP_STATUS.CONFLICT:
      return '資料衝突，請重新整理後再試';
    case HTTP_STATUS.UNPROCESSABLE_ENTITY:
      return '資料驗證失敗，請檢查輸入';
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return '請求過於頻繁，請稍後再試';
    case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      return '伺服器錯誤，請稍後再試';
    case HTTP_STATUS.BAD_GATEWAY:
      return '網路閘道錯誤';
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
      return '服務暫時不可用，請稍後再試';
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return '請求超時，請檢查網路連線';
    default:
      return `發生錯誤 (${status})`;
  }
}

// ===== 常用狀態碼別名（向後兼容） =====
export const STATUS_OK = HTTP_STATUS.OK;
export const STATUS_CREATED = HTTP_STATUS.CREATED;
export const STATUS_NO_CONTENT = HTTP_STATUS.NO_CONTENT;
export const STATUS_BAD_REQUEST = HTTP_STATUS.BAD_REQUEST;
export const STATUS_UNAUTHORIZED = HTTP_STATUS.UNAUTHORIZED;
export const STATUS_FORBIDDEN = HTTP_STATUS.FORBIDDEN;
export const STATUS_NOT_FOUND = HTTP_STATUS.NOT_FOUND;
export const STATUS_CONFLICT = HTTP_STATUS.CONFLICT;
export const STATUS_INTERNAL_ERROR = HTTP_STATUS.INTERNAL_SERVER_ERROR;
export const STATUS_SERVICE_UNAVAILABLE = HTTP_STATUS.SERVICE_UNAVAILABLE;
