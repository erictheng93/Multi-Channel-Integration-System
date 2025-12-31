/**
 * Time Constants (Frontend)
 * 時間常數定義（前端）
 *
 * 提供前端常用的時間單位轉換常數
 * 使用 as const 確保類型安全和不可變性
 */

// ===== 基礎時間單位（毫秒） =====
export const TIME_MS = {
  /** 1 毫秒 */
  ONE_MS: 1,

  /** 100 毫秒 */
  HUNDRED_MS: 100,

  /** 250 毫秒 */
  QUARTER_SECOND: 250,

  /** 500 毫秒 (半秒) */
  HALF_SECOND: 500
} as const;

// ===== 秒級時間單位（毫秒） =====
export const TIME_SECONDS = {
  /** 1 秒 = 1000 毫秒 */
  ONE_SECOND: 1000,

  /** 2 秒 */
  TWO_SECONDS: 2000,

  /** 3 秒 */
  THREE_SECONDS: 3000,

  /** 5 秒 */
  FIVE_SECONDS: 5000,

  /** 10 秒 */
  TEN_SECONDS: 10000,

  /** 15 秒 */
  FIFTEEN_SECONDS: 15000,

  /** 30 秒 */
  THIRTY_SECONDS: 30000
} as const;

// ===== 分鐘級時間單位（毫秒） =====
export const TIME_MINUTES = {
  /** 1 分鐘 = 60 秒 = 60000 毫秒 */
  ONE_MINUTE: 60000,

  /** 2 分鐘 */
  TWO_MINUTES: 120000,

  /** 5 分鐘 */
  FIVE_MINUTES: 300000,

  /** 10 分鐘 */
  TEN_MINUTES: 600000,

  /** 15 分鐘 */
  FIFTEEN_MINUTES: 900000,

  /** 30 分鐘 */
  THIRTY_MINUTES: 1800000
} as const;

// ===== 小時級時間單位（毫秒） =====
export const TIME_HOURS = {
  /** 1 小時 = 60 分鐘 = 3600000 毫秒 */
  ONE_HOUR: 3600000,

  /** 2 小時 */
  TWO_HOURS: 7200000,

  /** 6 小時 */
  SIX_HOURS: 21600000,

  /** 12 小時 */
  TWELVE_HOURS: 43200000
} as const;

// ===== 天級時間單位（毫秒） =====
export const TIME_DAYS = {
  /** 1 天 = 24 小時 = 86400000 毫秒 */
  ONE_DAY: 86400000,

  /** 7 天 (一週) */
  ONE_WEEK: 604800000,

  /** 30 天 (一個月) */
  ONE_MONTH: 2592000000
} as const;

// ===== 統一時間常數 =====
export const TIME = {
  ...TIME_MS,
  ...TIME_SECONDS,
  ...TIME_MINUTES,
  ...TIME_HOURS,
  ...TIME_DAYS
} as const;

// ===== 類型定義 =====
export type TimeDuration = typeof TIME[keyof typeof TIME];

// ===== 轉換函數 =====

/**
 * 將秒轉換為毫秒
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * 將分鐘轉換為毫秒
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * 將毫秒轉換為秒
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * 格式化時間長度為人類可讀格式
 */
export function formatDuration(ms: number): string {
  if (ms < TIME.ONE_SECOND) {
    return `${ms}ms`;
  } else if (ms < TIME.ONE_MINUTE) {
    return `${msToSeconds(ms)}秒`;
  } else if (ms < TIME.ONE_HOUR) {
    return `${Math.floor(ms / TIME.ONE_MINUTE)}分鐘`;
  } else if (ms < TIME.ONE_DAY) {
    return `${Math.floor(ms / TIME.ONE_HOUR)}小時`;
  } else {
    return `${Math.floor(ms / TIME.ONE_DAY)}天`;
  }
}

/**
 * 延遲執行 (Promise-based)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== UI 相關時間常數 =====

/** 動畫持續時間 */
export const ANIMATION_DURATION = {
  /** 快速動畫：150 毫秒 */
  FAST: 150,

  /** 一般動畫：300 毫秒 */
  NORMAL: 300,

  /** 慢速動畫：500 毫秒 */
  SLOW: 500,

  /** 超慢動畫：1 秒 */
  VERY_SLOW: TIME.ONE_SECOND
} as const;

/** Toast 提示持續時間 */
export const TOAST_DURATION = {
  /** 短暫提示：2 秒 */
  SHORT: TIME.TWO_SECONDS,

  /** 一般提示：3 秒 */
  NORMAL: TIME.THREE_SECONDS,

  /** 長時間提示：5 秒 */
  LONG: TIME.FIVE_SECONDS,

  /** 超長提示：10 秒 */
  EXTRA_LONG: TIME.TEN_SECONDS
} as const;

/** 去抖動延遲 */
export const DEBOUNCE_DELAY = {
  /** 快速去抖：100 毫秒 */
  FAST: TIME_MS.HUNDRED_MS,

  /** 一般去抖：300 毫秒 */
  NORMAL: 300,

  /** 慢速去抖：500 毫秒 */
  SLOW: TIME_MS.HALF_SECOND,

  /** 超慢去抖：1 秒 */
  VERY_SLOW: TIME.ONE_SECOND
} as const;

/** 節流間隔 */
export const THROTTLE_INTERVAL = {
  /** 快速節流：100 毫秒 */
  FAST: TIME_MS.HUNDRED_MS,

  /** 一般節流：250 毫秒 */
  NORMAL: TIME_MS.QUARTER_SECOND,

  /** 慢速節流：500 毫秒 */
  SLOW: TIME_MS.HALF_SECOND,

  /** 超慢節流：1 秒 */
  VERY_SLOW: TIME.ONE_SECOND
} as const;

/** 自動重新載入間隔 */
export const AUTO_RELOAD_INTERVAL = {
  /** 即時：5 秒 */
  REALTIME: TIME.FIVE_SECONDS,

  /** 快速：10 秒 */
  FAST: TIME.TEN_SECONDS,

  /** 一般：30 秒 */
  NORMAL: TIME.THIRTY_SECONDS,

  /** 慢速：1 分鐘 */
  SLOW: TIME.ONE_MINUTE,

  /** 超慢：5 分鐘 */
  VERY_SLOW: TIME.FIVE_MINUTES
} as const;

/** WebSocket 重連延遲 */
export const WS_RECONNECT_DELAY = {
  /** 立即重連：0 毫秒 */
  IMMEDIATE: 0,

  /** 快速重連：1 秒 */
  FAST: TIME.ONE_SECOND,

  /** 一般重連：3 秒 */
  NORMAL: TIME.THREE_SECONDS,

  /** 慢速重連：5 秒 */
  SLOW: TIME.FIVE_SECONDS,

  /** 超慢重連：10 秒 */
  VERY_SLOW: TIME.TEN_SECONDS
} as const;

/** 請求超時時間 */
export const REQUEST_TIMEOUT = {
  /** 快速請求：5 秒 */
  FAST: TIME.FIVE_SECONDS,

  /** 一般請求：10 秒 */
  NORMAL: TIME.TEN_SECONDS,

  /** 慢速請求：30 秒 */
  SLOW: TIME.THIRTY_SECONDS,

  /** 檔案上傳：2 分鐘 */
  FILE_UPLOAD: TIME.TWO_MINUTES
} as const;
