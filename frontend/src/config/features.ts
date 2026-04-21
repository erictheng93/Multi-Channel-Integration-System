import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('features')
/**
 * Feature Flags Configuration
 *
 * 功能開關配置檔案，用於控制功能的灰度發布、A/B 測試與快速回滾
 *
 * 使用方式：
 * ```typescript
 * import { FEATURE_FLAGS, isFeatureEnabled } from '@/config/features'
 *
 * if (isFeatureEnabled('QR_BACKGROUND_PRELOAD')) {
 * // 啟用功能
 * }
 * ```
 *
 * @version 1.0.0
 * @date 2025-01-28
 */

// ==================== 型別定義 ====================

export interface FeatureFlag<T = unknown> {
  enabled: boolean // 總開關
  rolloutPercentage: number // 推出百分比 (0-100)
  description: string // 功能描述
  config?: T // 功能專屬配置
}

export interface QRPreloadConfig {
  maxConcurrent: number // 最大並發請求數
  idleTimeout: number // 閒置偵測時間 (ms)
  memoryThreshold: number // 記憶體閾值 (MB)
  adaptiveThrottling: boolean // 自適應節流
  enableLogging: boolean // 啟用詳細日誌

  // 網路條件限制
  networkConditions: {
    disableOn3G: boolean // 3G 網路下禁用
    disableOnSlow: boolean // 慢速網路下禁用
    disableOnSaveData: boolean  // 省流量模式下禁用
  }

  // 優先順序權重
  priorityWeights: {
    inViewport: number // 在可視範圍內
    memberCount: number // 成員數量
    recentlyUsed: number // 最近使用
    isActive: number // 團隊活躍
  }
}

// ==================== Feature Flags ====================

export const FEATURE_FLAGS = {
  /**
   * QR Code 背景預載功能
   *
   * 功能：頁面載入後在背景智能預載 QR Code
   * 目標：減少用戶點擊延遲從 220ms → 35ms
   * 狀態：Phase 1 - MVP 測試階段
   */
  QR_BACKGROUND_PRELOAD: {
    enabled: true, //  總開關：啟用
    rolloutPercentage: 100, //  推出範圍：100% 用戶
    description: 'Background progressive QR code preloading',

    config: {
      maxConcurrent: 3, // 最多 3 個並發請求
      idleTimeout: 2000, // 頁面載入後 2 秒開始預載
      memoryThreshold: 100, // 記憶體限制 100MB
      adaptiveThrottling: true, // 啟用自適應節流
      enableLogging: true, // 啟用詳細日誌（生產環境可關閉）

      networkConditions: {
        disableOn3G: false, // 3G 網路仍啟用
        disableOnSlow: false, // 慢速網路仍啟用
        disableOnSaveData: true // 省流量模式下禁用
      },

      priorityWeights: {
        inViewport: 10, // 可見權重
        memberCount: 1, // 成員數權重
        recentlyUsed: 8, // 最近使用權重
        isActive: 5 // 活躍狀態權重
      }
    } as QRPreloadConfig
  } as FeatureFlag<QRPreloadConfig>,

  /**
   * Hover Prefetch 備用方案
   *
   * 功能：滑鼠懸停時預載 QR Code
   * 狀態：保留作為雙重保險
   */
  QR_HOVER_PREFETCH: {
    enabled: true, //  保留啟用
    rolloutPercentage: 100,
    description: 'Hover-based QR code prefetching (fallback)'
  } as FeatureFlag,

  /**
   * A/B Testing 框架
   *
   * 功能：支援 A/B 測試基礎設施
   * 狀態：預留未來使用
   */
  AB_TESTING_FRAMEWORK: {
    enabled: false, //  暫時禁用
    rolloutPercentage: 0,
    description: 'A/B testing infrastructure',

    config: {
      experimentId: '',
      variants: ['control', 'treatment'],
      metrics: ['click_delay', 'cache_hit_rate']
    }
  } as FeatureFlag
} as const

// ==================== 工具函數 ====================

/**
 * 檢查功能是否啟用
 * @param featureName 功能名稱
 * @returns 是否啟用
 */
export function isFeatureEnabled(featureName: keyof typeof FEATURE_FLAGS): boolean {
  const feature = FEATURE_FLAGS[featureName]

  if (!feature || !feature.enabled) {
    return false
  }

  // 檢查推出百分比
  if (feature.rolloutPercentage < 100) {
    // 使用穩定的用戶 ID hash（如 localStorage 中的 user_id）
    // 這裡簡化為隨機，實際應用應使用穩定 ID
    const userId = getUserId()
    const userBucket = hashString(userId) % 100

    return userBucket < feature.rolloutPercentage
  }

  return true
}

/**
 * 取得功能配置
 * @param featureName 功能名稱
 * @returns 功能配置
 */
export function getFeatureConfig<T>(featureName: keyof typeof FEATURE_FLAGS): T | undefined {
  const feature = FEATURE_FLAGS[featureName] as FeatureFlag<T>
  return feature?.config
}

/**
 * 檢查網路條件是否允許功能啟用
 * @returns 是否允許
 */
export function checkNetworkConditions(): boolean {
  const config = getFeatureConfig<QRPreloadConfig>('QR_BACKGROUND_PRELOAD')

  if (!config) {
    return true
  }

  // 檢查省流量模式
  if (config.networkConditions.disableOnSaveData) {
    const connection = (navigator as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
    if (connection?.saveData) {
      frontendLogger.debug('[FeatureFlag] Background preload disabled: Save-Data mode enabled')
      return false
    }
  }

  // 檢查網路類型（實驗性 API）
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
    const effectiveType = connection?.effectiveType

    if (config.networkConditions.disableOn3G && effectiveType === '3g') {
      frontendLogger.debug('[FeatureFlag] Background preload disabled: 3G network detected')
      return false
    }

    if (config.networkConditions.disableOnSlow && (effectiveType === 'slow-2g' || effectiveType === '2g')) {
      frontendLogger.debug('[FeatureFlag] Background preload disabled: Slow network detected')
      return false
    }
  }

  return true
}

// ==================== 輔助函數 ====================

/**
 * 取得用戶 ID（穩定標識）
 */
function getUserId(): string {
  // 優先使用 localStorage 中的穩定 ID
  let userId = localStorage.getItem('anonymous_user_id')

  if (!userId) {
    // 生成新的匿名 ID
    userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem('anonymous_user_id', userId)
  }

  return userId
}

/**
 * 簡單字串 hash 函數（用於用戶分桶）
 */
function hashString(str: string): number {
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash)
}

// ==================== 開發工具 ====================

/**
 * 開發模式下的功能控制台
 *
 * 使用方式（瀏覽器 Console）：
 * ```javascript
 * window.featureFlags.enable('QR_BACKGROUND_PRELOAD')
 * window.featureFlags.disable('QR_BACKGROUND_PRELOAD')
 * window.featureFlags.setRollout('QR_BACKGROUND_PRELOAD', 50)
 * window.featureFlags.list()
 * ```
 */
if (import.meta.env.DEV) {
  // @ts-expect-error - Development tool
  window.featureFlags = {
    list: () => {
      frontendLogger.debug(
        Object.entries(FEATURE_FLAGS).map(([name, flag]) => ({
          Feature: name,
          Enabled: flag.enabled ? '' : '',
          Rollout: `${flag.rolloutPercentage}%`,
          Description: flag.description
        }))
      )
    },

    enable: (name: keyof typeof FEATURE_FLAGS) => {
      (FEATURE_FLAGS[name] as { enabled: boolean }).enabled = true
      frontendLogger.debug(` Enabled: ${name}`)
    },

    disable: (name: keyof typeof FEATURE_FLAGS) => {
      (FEATURE_FLAGS[name] as { enabled: boolean }).enabled = false
      frontendLogger.debug(` Disabled: ${name}`)
    },

    setRollout: (name: keyof typeof FEATURE_FLAGS, percentage: number) => {
      (FEATURE_FLAGS[name] as { rolloutPercentage: number }).rolloutPercentage = Math.max(0, Math.min(100, percentage))
      frontendLogger.debug(` Set rollout for ${name}: ${percentage}%`)
    },

    getConfig: (name: keyof typeof FEATURE_FLAGS) => {
      return getFeatureConfig(name)
    }
  }

  frontendLogger.debug(' Feature Flags loaded. Type `window.featureFlags.list()` to see all flags.')
}
