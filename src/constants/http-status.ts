/**
 * HTTP Status Codes Constants
 * HTTP 狀態碼常數定義
 *
 * 完整的 HTTP 狀態碼集合，涵蓋所有標準狀態碼
 * 使用 as const 確保類型安全和不可變性
 */

// ===== 成功狀態 (2xx) =====
export const HTTP_SUCCESS = {
  /** 200 OK - 請求成功 */
  OK: 200,

  /** 201 Created - 資源已創建 */
  CREATED: 201,

  /** 202 Accepted - 請求已接受，處理中 */
  ACCEPTED: 202,

  /** 203 Non-Authoritative Information - 非權威資訊 */
  NON_AUTHORITATIVE_INFO: 203,

  /** 204 No Content - 無內容返回 */
  NO_CONTENT: 204,

  /** 205 Reset Content - 重置內容 */
  RESET_CONTENT: 205,

  /** 206 Partial Content - 部分內容 */
  PARTIAL_CONTENT: 206
} as const;

// ===== 重定向狀態 (3xx) =====
export const HTTP_REDIRECT = {
  /** 300 Multiple Choices - 多種選擇 */
  MULTIPLE_CHOICES: 300,

  /** 301 Moved Permanently - 永久移動 */
  MOVED_PERMANENTLY: 301,

  /** 302 Found - 暫時移動 */
  FOUND: 302,

  /** 303 See Other - 查看其他位置 */
  SEE_OTHER: 303,

  /** 304 Not Modified - 未修改 */
  NOT_MODIFIED: 304,

  /** 307 Temporary Redirect - 暫時重定向 */
  TEMPORARY_REDIRECT: 307,

  /** 308 Permanent Redirect - 永久重定向 */
  PERMANENT_REDIRECT: 308
} as const;

// ===== 客戶端錯誤 (4xx) =====
export const HTTP_CLIENT_ERROR = {
  /** 400 Bad Request - 錯誤的請求 */
  BAD_REQUEST: 400,

  /** 401 Unauthorized - 未授權 */
  UNAUTHORIZED: 401,

  /** 402 Payment Required - 需要付款 */
  PAYMENT_REQUIRED: 402,

  /** 403 Forbidden - 禁止訪問 */
  FORBIDDEN: 403,

  /** 404 Not Found - 資源不存在 */
  NOT_FOUND: 404,

  /** 405 Method Not Allowed - 方法不允許 */
  METHOD_NOT_ALLOWED: 405,

  /** 406 Not Acceptable - 不可接受 */
  NOT_ACCEPTABLE: 406,

  /** 407 Proxy Authentication Required - 需要代理認證 */
  PROXY_AUTH_REQUIRED: 407,

  /** 408 Request Timeout - 請求超時 */
  REQUEST_TIMEOUT: 408,

  /** 409 Conflict - 衝突 */
  CONFLICT: 409,

  /** 410 Gone - 資源已永久刪除 */
  GONE: 410,

  /** 411 Length Required - 需要長度標頭 */
  LENGTH_REQUIRED: 411,

  /** 412 Precondition Failed - 前置條件失敗 */
  PRECONDITION_FAILED: 412,

  /** 413 Payload Too Large - 請求實體過大 */
  PAYLOAD_TOO_LARGE: 413,

  /** 414 URI Too Long - URI 過長 */
  URI_TOO_LONG: 414,

  /** 415 Unsupported Media Type - 不支援的媒體類型 */
  UNSUPPORTED_MEDIA_TYPE: 415,

  /** 416 Range Not Satisfiable - 範圍無法滿足 */
  RANGE_NOT_SATISFIABLE: 416,

  /** 417 Expectation Failed - 期望失敗 */
  EXPECTATION_FAILED: 417,

  /** 418 I'm a teapot - 我是茶壺 (RFC 2324) */
  IM_A_TEAPOT: 418,

  /** 421 Misdirected Request - 錯誤導向請求 */
  MISDIRECTED_REQUEST: 421,

  /** 422 Unprocessable Entity - 無法處理的實體 */
  UNPROCESSABLE_ENTITY: 422,

  /** 423 Locked - 資源被鎖定 */
  LOCKED: 423,

  /** 424 Failed Dependency - 依賴失敗 */
  FAILED_DEPENDENCY: 424,

  /** 425 Too Early - 過早 */
  TOO_EARLY: 425,

  /** 426 Upgrade Required - 需要升級 */
  UPGRADE_REQUIRED: 426,

  /** 428 Precondition Required - 需要前置條件 */
  PRECONDITION_REQUIRED: 428,

  /** 429 Too Many Requests - 請求過多 */
  TOO_MANY_REQUESTS: 429,

  /** 431 Request Header Fields Too Large - 請求標頭欄位過大 */
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,

  /** 451 Unavailable For Legal Reasons - 因法律原因不可用 */
  UNAVAILABLE_FOR_LEGAL_REASONS: 451
} as const;

// ===== 伺服器錯誤 (5xx) =====
export const HTTP_SERVER_ERROR = {
  /** 500 Internal Server Error - 內部伺服器錯誤 */
  INTERNAL_SERVER_ERROR: 500,

  /** 501 Not Implemented - 未實作 */
  NOT_IMPLEMENTED: 501,

  /** 502 Bad Gateway - 錯誤的閘道 */
  BAD_GATEWAY: 502,

  /** 503 Service Unavailable - 服務不可用 */
  SERVICE_UNAVAILABLE: 503,

  /** 504 Gateway Timeout - 閘道超時 */
  GATEWAY_TIMEOUT: 504,

  /** 505 HTTP Version Not Supported - 不支援的 HTTP 版本 */
  HTTP_VERSION_NOT_SUPPORTED: 505,

  /** 506 Variant Also Negotiates - 變體也在協商 */
  VARIANT_ALSO_NEGOTIATES: 506,

  /** 507 Insufficient Storage - 儲存空間不足 */
  INSUFFICIENT_STORAGE: 507,

  /** 508 Loop Detected - 檢測到循環 */
  LOOP_DETECTED: 508,

  /** 510 Not Extended - 未擴展 */
  NOT_EXTENDED: 510,

  /** 511 Network Authentication Required - 需要網路認證 */
  NETWORK_AUTH_REQUIRED: 511
} as const;

// ===== 統一導出：所有狀態碼 =====
export const HTTP_STATUS = {
  ...HTTP_SUCCESS,
  ...HTTP_REDIRECT,
  ...HTTP_CLIENT_ERROR,
  ...HTTP_SERVER_ERROR
} as const;

// ===== 類型定義 =====
export type HttpSuccessCode = typeof HTTP_SUCCESS[keyof typeof HTTP_SUCCESS];
export type HttpRedirectCode = typeof HTTP_REDIRECT[keyof typeof HTTP_REDIRECT];
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
 * 判斷是否為重定向狀態碼 (3xx)
 */
export function isHttpRedirectStatus(status: number): status is HttpRedirectCode {
  return status >= 300 && status < 400;
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
 * 取得狀態碼的分類名稱
 */
export function getHttpStatusCategory(status: number): string {
  if (isHttpSuccessStatus(status)) return 'Success';
  if (isHttpRedirectStatus(status)) return 'Redirect';
  if (isHttpClientErrorStatus(status)) return 'Client Error';
  if (isHttpServerErrorStatus(status)) return 'Server Error';
  return 'Unknown';
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
