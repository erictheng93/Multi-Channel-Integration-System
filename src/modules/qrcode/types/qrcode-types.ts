// QRCode 模組類型定義
// 定義二維碼相關的所有類型和介面

import type { Bindings } from '@/types';

// ======================== 基礎類型 ========================

/**
 * QR Code 類型枚舉
 */
export type QRCodeType =
  | 'url'           // URL 連結
  | 'text'          // 純文字
  | 'contact'       // 聯絡人資訊
  | 'wifi'          // WiFi 連接資訊
  | 'sms'           // SMS 簡訊
  | 'email'         // 電子郵件
  | 'phone'         // 電話號碼
  | 'event'         // 事件/日曆
  | 'location'      // 地理位置
  | 'app'           // 應用程式連結
  | 'social';       // 社群媒體

/**
 * QR Code 錯誤修正等級
 */
export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * QR Code 輸出格式
 */
export type QRCodeOutputFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'base64';

/**
 * QR Code 狀態
 */
export type QRCodeStatus = 'active' | 'expired' | 'disabled' | 'pending';

// ======================== 核心資料結構 ========================

/**
 * QR Code 記錄
 */
export interface QRCodeRecord {
  id: string;
  name: string;
  description?: string;
  type: QRCodeType;
  content: string;
  status: QRCodeStatus;

  // 生成設定
  size: number;
  errorCorrectionLevel: QRCodeErrorCorrectionLevel;
  outputFormat: QRCodeOutputFormat;

  // 樣式設定
  foregroundColor: string;
  backgroundColor: string;
  logoUrl?: string;
  borderWidth?: number;

  // 中繼資料
  teamId?: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;

  // 統計資料
  scanCount: number;
  lastScannedAt?: string;

  // 額外設定
  customData?: Record<string, any>;
  tags?: string[];
}

/**
 * QR Code 創建請求
 */
export interface CreateQRCodeRequest {
  name: string;
  description?: string;
  type: QRCodeType;
  content: string;

  // 生成設定 (可選，有預設值)
  size?: number;
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  outputFormat?: QRCodeOutputFormat;

  // 樣式設定 (可選)
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  borderWidth?: number;

  // 進階設定
  expiresAt?: string;
  customData?: Record<string, any>;
  tags?: string[];
}

/**
 * QR Code 更新請求
 */
export interface UpdateQRCodeRequest {
  name?: string;
  description?: string;
  content?: string;
  status?: QRCodeStatus;

  // 樣式更新
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  borderWidth?: number;

  // 設定更新
  expiresAt?: string;
  customData?: Record<string, any>;
  tags?: string[];
}

/**
 * QR Code 生成選項
 */
export interface QRCodeGenerationOptions {
  size: number;
  errorCorrectionLevel: QRCodeErrorCorrectionLevel;
  outputFormat: QRCodeOutputFormat;
  foregroundColor: string;
  backgroundColor: string;
  logoUrl?: string;
  borderWidth?: number;
  includeMargin?: boolean;
}

// ======================== 查詢和過濾 ========================

/**
 * QR Code 列表查詢參數
 */
export interface QRCodeListQuery {
  // 基本過濾
  type?: QRCodeType;
  status?: QRCodeStatus;
  teamId?: number;
  createdBy?: number;

  // 時間過濾
  createdAfter?: string;
  createdBefore?: string;

  // 搜尋
  search?: string;  // 名稱或描述搜尋
  tags?: string[];

  // 分頁
  page?: number;
  limit?: number;

  // 排序
  sortBy?: 'name' | 'createdAt' | 'scanCount' | 'lastScannedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * QR Code 統計查詢
 */
export interface QRCodeStatsQuery {
  teamId?: number;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

// ======================== 響應類型 ========================

/**
 * QR Code 列表響應
 */
export interface QRCodeListResponse {
  data: QRCodeRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * QR Code 詳情響應
 */
export interface QRCodeDetailResponse extends QRCodeRecord {
  // 生成的 QR Code 內容
  qrCodeData?: string;  // Base64 編碼的圖片或 SVG
  qrCodeUrl?: string;   // 如果儲存在 R2

  // 詳細統計
  scanHistory?: Array<{
    scannedAt: string;
    userAgent?: string;
    ipAddress?: string;
    location?: string;
  }>;
}

/**
 * QR Code 統計響應
 */
export interface QRCodeStatsResponse {
  totalQRCodes: number;
  activeQRCodes: number;
  totalScans: number;

  // 按類型分組
  typeDistribution: Array<{
    type: QRCodeType;
    count: number;
    scanCount: number;
  }>;

  // 時間序列數據
  scanTrends: Array<{
    date: string;
    scanCount: number;
    newQRCodes: number;
  }>;

  // 熱門 QR Code
  topQRCodes: Array<{
    id: string;
    name: string;
    scanCount: number;
  }>;
}

/**
 * 批次操作請求
 */
export interface BatchQRCodeRequest {
  operation: 'create' | 'update' | 'delete' | 'disable';
  qrCodes: Array<CreateQRCodeRequest | UpdateQRCodeRequest | { id: string }>;
}

/**
 * 批次操作響應
 */
export interface BatchQRCodeResponse {
  success: boolean;
  results: Array<{
    success: boolean;
    id?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ======================== 服務介面 ========================

/**
 * QR Code 服務介面
 */
export interface IQRCodeService {
  // 基本 CRUD
  create(data: CreateQRCodeRequest, userId: number, teamId?: number): Promise<QRCodeRecord>;
  findById(id: string, userId: number): Promise<QRCodeDetailResponse | null>;
  update(id: string, data: UpdateQRCodeRequest, userId: number): Promise<QRCodeRecord>;
  delete(id: string, userId: number): Promise<boolean>;

  // 列表和搜尋
  list(query: QRCodeListQuery, userId: number): Promise<QRCodeListResponse>;

  // QR Code 生成
  generateQRCode(content: string, options: QRCodeGenerationOptions): Promise<string>;
  regenerateQRCode(id: string, userId: number): Promise<QRCodeDetailResponse>;

  // 統計和分析
  getStats(query: QRCodeStatsQuery, userId: number): Promise<QRCodeStatsResponse>;
  recordScan(id: string, scanData?: { userAgent?: string; ipAddress?: string }): Promise<void>;

  // 批次操作
  batchOperation(request: BatchQRCodeRequest, userId: number): Promise<BatchQRCodeResponse>;
}

// ======================== 中間件類型 ========================

/**
 * QR Code 中間件上下文
 */
export interface QRCodeMiddlewareContext {
  qrCode?: QRCodeRecord;
  canAccess?: boolean;
  canModify?: boolean;
}

// ======================== 錯誤類型 ========================

/**
 * QR Code 錯誤代碼
 */
export type QRCodeErrorCode =
  | 'QR_CODE_NOT_FOUND'
  | 'QR_CODE_EXPIRED'
  | 'QR_CODE_DISABLED'
  | 'INVALID_QR_CODE_TYPE'
  | 'INVALID_QR_CODE_CONTENT'
  | 'GENERATION_FAILED'
  | 'INVALID_SIZE'
  | 'INVALID_ERROR_CORRECTION_LEVEL'
  | 'INVALID_OUTPUT_FORMAT'
  | 'LOGO_UPLOAD_FAILED'
  | 'BATCH_OPERATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXCEEDED';

/**
 * QR Code 錯誤
 */
export interface QRCodeError extends Error {
  code: QRCodeErrorCode;
  details?: any;
}

// ======================== 設定和常數 ========================

/**
 * QR Code 預設設定
 */
export const QR_CODE_DEFAULTS = {
  size: 300,
  errorCorrectionLevel: 'M' as QRCodeErrorCorrectionLevel,
  outputFormat: 'png' as QRCodeOutputFormat,
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  borderWidth: 0,
  includeMargin: true,

  // 限制
  maxSize: 2000,
  minSize: 100,
  maxContentLength: 4296,  // QR Code 理論最大容量
  maxBatchSize: 50,

  // 快取設定
  cacheTtlSeconds: 3600,  // 1 小時
} as const;

/**
 * QR Code 權限
 */
export const QR_CODE_PERMISSIONS = {
  CREATE: 'qrcode:create',
  READ: 'qrcode:read',
  UPDATE: 'qrcode:update',
  DELETE: 'qrcode:delete',
  MANAGE_ALL: 'qrcode:manage_all',
  VIEW_STATS: 'qrcode:view_stats',
  BATCH_OPERATIONS: 'qrcode:batch_operations',
} as const;

// ======================== 類型匯出 ========================

export type QRCodePermission = typeof QR_CODE_PERMISSIONS[keyof typeof QR_CODE_PERMISSIONS];