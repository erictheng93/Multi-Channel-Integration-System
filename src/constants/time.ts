/**
 * Time Constants
 * 時間常數定義
 *
 * 提供標準的時間單位轉換常數，避免硬編碼時間值
 * 使用 as const 確保類型安全和不可變性
 */

// ===== 基礎時間單位（毫秒） =====
export const TIME_MS = {
  /** 1 毫秒 */
  ONE_MS: 1,

  /** 10 毫秒 */
  TEN_MS: 10,

  /** 50 毫秒 */
  FIFTY_MS: 50,

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
  THIRTY_SECONDS: 30000,

  /** 45 秒 */
  FORTY_FIVE_SECONDS: 45000
} as const;

// ===== 分鐘級時間單位（毫秒） =====
export const TIME_MINUTES = {
  /** 1 分鐘 = 60 秒 = 60000 毫秒 */
  ONE_MINUTE: 60000,

  /** 2 分鐘 */
  TWO_MINUTES: 120000,

  /** 3 分鐘 */
  THREE_MINUTES: 180000,

  /** 5 分鐘 */
  FIVE_MINUTES: 300000,

  /** 10 分鐘 */
  TEN_MINUTES: 600000,

  /** 15 分鐘 */
  FIFTEEN_MINUTES: 900000,

  /** 30 分鐘 */
  THIRTY_MINUTES: 1800000,

  /** 45 分鐘 */
  FORTY_FIVE_MINUTES: 2700000
} as const;

// ===== 小時級時間單位（毫秒） =====
export const TIME_HOURS = {
  /** 1 小時 = 60 分鐘 = 3600000 毫秒 */
  ONE_HOUR: 3600000,

  /** 2 小時 */
  TWO_HOURS: 7200000,

  /** 3 小時 */
  THREE_HOURS: 10800000,

  /** 6 小時 */
  SIX_HOURS: 21600000,

  /** 12 小時 */
  TWELVE_HOURS: 43200000
} as const;

// ===== 天級時間單位（毫秒） =====
export const TIME_DAYS = {
  /** 1 天 = 24 小時 = 86400000 毫秒 */
  ONE_DAY: 86400000,

  /** 2 天 */
  TWO_DAYS: 172800000,

  /** 3 天 */
  THREE_DAYS: 259200000,

  /** 7 天 (一週) */
  ONE_WEEK: 604800000,

  /** 14 天 (兩週) */
  TWO_WEEKS: 1209600000,

  /** 30 天 (一個月) */
  ONE_MONTH: 2592000000,

  /** 90 天 (三個月) */
  THREE_MONTHS: 7776000000,

  /** 365 天 (一年) */
  ONE_YEAR: 31536000000
} as const;

// ===== 統一時間常數 =====
export const TIME = {
  ...TIME_MS,
  ...TIME_SECONDS,
  ...TIME_MINUTES,
  ...TIME_HOURS,
  ...TIME_DAYS
} as const;

// ===== 秒級時間單位（秒） =====
export const TIME_IN_SECONDS = {
  /** 1 秒 */
  ONE_SECOND: 1,

  /** 5 秒 */
  FIVE_SECONDS: 5,

  /** 10 秒 */
  TEN_SECONDS: 10,

  /** 30 秒 */
  THIRTY_SECONDS: 30,

  /** 1 分鐘 */
  ONE_MINUTE: 60,

  /** 5 分鐘 */
  FIVE_MINUTES: 300,

  /** 10 分鐘 */
  TEN_MINUTES: 600,

  /** 15 分鐘 */
  FIFTEEN_MINUTES: 900,

  /** 30 分鐘 */
  THIRTY_MINUTES: 1800,

  /** 1 小時 */
  ONE_HOUR: 3600,

  /** 1 天 */
  ONE_DAY: 86400,

  /** 1 週 */
  ONE_WEEK: 604800,

  /** 1 個月 (30天) */
  ONE_MONTH: 2592000,

  /** 1 年 (365天) */
  ONE_YEAR: 31536000
} as const;

// ===== 類型定義 =====
export type TimeDuration = typeof TIME[keyof typeof TIME];
export type TimeInSeconds = typeof TIME_IN_SECONDS[keyof typeof TIME_IN_SECONDS];

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
 * 將小時轉換為毫秒
 */
export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/**
 * 將天轉換為毫秒
 */
export function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * 將毫秒轉換為秒
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * 將毫秒轉換為分鐘
 */
export function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}

/**
 * 將毫秒轉換為小時
 */
export function msToHours(ms: number): number {
  return Math.floor(ms / 3600000);
}

/**
 * 將毫秒轉換為天
 */
export function msToDays(ms: number): number {
  return Math.floor(ms / 86400000);
}

/**
 * 格式化時間長度為人類可讀格式
 */
export function formatDuration(ms: number): string {
  if (ms < TIME.ONE_SECOND) {
    return `${ms}ms`;
  } else if (ms < TIME.ONE_MINUTE) {
    return `${msToSeconds(ms)}s`;
  } else if (ms < TIME.ONE_HOUR) {
    return `${msToMinutes(ms)}m`;
  } else if (ms < TIME.ONE_DAY) {
    return `${msToHours(ms)}h`;
  } else {
    return `${msToDays(ms)}d`;
  }
}

/**
 * 延遲執行 (Promise-based)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 常用時間常數別名（向後兼容） =====

/** 快取過期時間 */
export const CACHE_TTL = {
  /** 短期快取：5 分鐘 */
  SHORT: TIME.FIVE_MINUTES,

  /** 中期快取：30 分鐘 */
  MEDIUM: TIME.THIRTY_MINUTES,

  /** 長期快取：1 小時 */
  LONG: TIME.ONE_HOUR,

  /** 超長期快取：24 小時 */
  EXTRA_LONG: TIME.ONE_DAY
} as const;

/** 重試延遲時間 */
export const RETRY_DELAY = {
  /** 立即重試：0 毫秒 */
  IMMEDIATE: 0,

  /** 快速重試：1 秒 */
  FAST: TIME.ONE_SECOND,

  /** 一般重試：3 秒 */
  NORMAL: TIME.THREE_SECONDS,

  /** 慢速重試：10 秒 */
  SLOW: TIME.TEN_SECONDS,

  /** 超慢重試：30 秒 */
  VERY_SLOW: TIME.THIRTY_SECONDS
} as const;

/** 超時時間 */
export const TIMEOUT = {
  /** 快速操作：5 秒 */
  FAST: TIME.FIVE_SECONDS,

  /** 一般操作：15 秒 */
  NORMAL: TIME.FIFTEEN_SECONDS,

  /** 慢速操作：30 秒 */
  SLOW: TIME.THIRTY_SECONDS,

  /** 長時間操作：1 分鐘 */
  LONG: TIME.ONE_MINUTE,

  /** 超長操作：5 分鐘 */
  EXTRA_LONG: TIME.FIVE_MINUTES
} as const;

/** 輪詢間隔 */
export const POLLING_INTERVAL = {
  /** 即時輪詢：1 秒 */
  REALTIME: TIME.ONE_SECOND,

  /** 快速輪詢：3 秒 */
  FAST: TIME.THREE_SECONDS,

  /** 一般輪詢：5 秒 */
  NORMAL: TIME.FIVE_SECONDS,

  /** 慢速輪詢：10 秒 */
  SLOW: TIME.TEN_SECONDS,

  /** 超慢輪詢：30 秒 */
  VERY_SLOW: TIME.THIRTY_SECONDS
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
  /** 快速節流：50 毫秒 */
  FAST: TIME_MS.FIFTY_MS,

  /** 一般節流：200 毫秒 */
  NORMAL: 200,

  /** 慢速節流：500 毫秒 */
  SLOW: TIME_MS.HALF_SECOND,

  /** 超慢節流：1 秒 */
  VERY_SLOW: TIME.ONE_SECOND
} as const;
