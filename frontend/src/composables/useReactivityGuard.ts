/**
 * Layer 4 Defense: Reactivity Guard - Runtime Performance Monitor
 *
 * 實時監控 computed properties 的重新計算次數，
 * 當偵測到異常時發出警告，防止無限循環
 *
 * @example
 * ```ts
 * const reactivityGuard = useReactivityGuard({ maxRecomputations: 10 })
 *
 * const messages = computed(() => {
 * reactivityGuard.trackComputed('messages')
 * // ... your logic
 * return value
 * })
 * ```
 */

import { onUnmounted, type ComputedRef } from 'vue'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useReactivityGuard')

interface ReactivityGuardOptions {
  /** 允許的最大重新計算次數（在時間窗口內） */
  maxRecomputations?: number
  /** 時間窗口（毫秒） */
  timeWindow?: number
  /** 是否自動拋出錯誤（當超過閾值時） */
  throwOnExceed?: boolean
  /** 是否在開發環境打印警告 */
  warnInDev?: boolean
}

interface ComputedMetrics {
  count: number
  windowStart: number
  lastComputed: number
  history: number[] // 最近的計算時間戳
}

export function useReactivityGuard(options: ReactivityGuardOptions = {}) {
  const {
    maxRecomputations = 100,
    timeWindow = 1000, // 1 second
    throwOnExceed = false,
    warnInDev = import.meta.env.DEV
  } = options

  // Track metrics for each computed property
  const computedMetrics = new Map<string, ComputedMetrics>()
  const alertedComputeds = new Set<string>() // 已經發出警告的 computed，避免重複警告

  /**
   * 追蹤 computed property 的重新計算
   */
  function trackComputed(name: string): void {
    const now = Date.now()
    let metrics = computedMetrics.get(name)

    if (!metrics) {
      metrics = {
        count: 0,
        windowStart: now,
        lastComputed: now,
        history: []
      }
      computedMetrics.set(name, metrics)
    }

    // 檢查是否需要重置時間窗口
    if (now - metrics.windowStart > timeWindow) {
      metrics.count = 0
      metrics.windowStart = now
      metrics.history = []
      // 清除警告狀態，允許在新窗口中再次警告
      alertedComputeds.delete(name)
    }

    metrics.count++
    metrics.lastComputed = now
    metrics.history.push(now)

    // 只保留最近100次的歷史記錄
    if (metrics.history.length > 100) {
      metrics.history.shift()
    }

    // 檢查是否超過閾值
    if (metrics.count > maxRecomputations && !alertedComputeds.has(name)) {
      alertedComputeds.add(name)

      const message = `[ReactivityGuard]  Excessive recomputations detected!
  - Computed: "${name}"
  - Count: ${metrics.count} times in ${timeWindow}ms
  - Average interval: ${calculateAverageInterval(metrics.history)}ms
  - This may indicate an infinite loop or poorly optimized reactivity chain.`

      if (warnInDev) {
        console.error(message)
        frontendLogger.debug('Computed property call stack')
      }

      if (throwOnExceed) {
        throw new Error(`Excessive recomputations in computed property "${name}"`)
      }
    }
  }

  /**
   * 手動重置特定 computed 的統計
   */
  function resetMetrics(name: string): void {
    computedMetrics.delete(name)
    alertedComputeds.delete(name)
  }

  /**
   * 重置所有統計
   */
  function resetAllMetrics(): void {
    computedMetrics.clear()
    alertedComputeds.clear()
  }

  /**
   * 獲取特定 computed 的統計信息
   */
  function getMetrics(name: string): ComputedMetrics | undefined {
    return computedMetrics.get(name)
  }

  /**
   * 獲取所有 computed 的統計信息
   */
  function getAllMetrics(): Record<string, ComputedMetrics> {
    const result: Record<string, ComputedMetrics> = {}
    computedMetrics.forEach((metrics, name) => {
      result[name] = { ...metrics }
    })
    return result
  }

  /**
   * 計算平均重新計算間隔
   */
  function calculateAverageInterval(history: number[]): number {
    if (history.length < 2) {return 0}

    let totalInterval = 0
    for (let i = 1; i < history.length; i++) {
      const current = history[i] ?? 0
      const previous = history[i - 1] ?? 0
      totalInterval += current - previous
    }

    return Math.round(totalInterval / (history.length - 1))
  }

  /**
   * 檢查是否有任何 computed 處於異常狀態
   */
  function hasAnomalies(): boolean {
    for (const [_name, metrics] of computedMetrics) {
      if (metrics.count > maxRecomputations) {
        return true
      }
    }
    return false
  }

  /**
   * 獲取異常的 computed 列表
   */
  function getAnomalies(): string[] {
    const anomalies: string[] = []
    for (const [name, metrics] of computedMetrics) {
      if (metrics.count > maxRecomputations) {
        anomalies.push(name)
      }
    }
    return anomalies
  }

  // 定期清理舊的統計數據
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []

    computedMetrics.forEach((metrics, name) => {
      // 如果超過 5 秒沒有更新，清除該統計
      if (now - metrics.lastComputed > 5000) {
        keysToDelete.push(name)
      }
    })

    keysToDelete.forEach(key => {
      computedMetrics.delete(key)
      alertedComputeds.delete(key)
    })
  }, 5000)

  // 清理定時器
  onUnmounted(() => {
    clearInterval(cleanupInterval)
  })

  return {
    trackComputed,
    resetMetrics,
    resetAllMetrics,
    getMetrics,
    getAllMetrics,
    hasAnomalies,
    getAnomalies
  }
}

/**
 * 創建一個受監控的 computed property
 * 自動追蹤重新計算次數
 */
export function createGuardedComputed<T>(
  _name: string,
  _getter: () => T,
  _guard: ReturnType<typeof useReactivityGuard>
): ComputedRef<T> {
  // This is a helper function - actual implementation would use Vue's computed
  // For now, we'll just provide the pattern
  throw new Error('Use this pattern in your component:\n\nconst value = computed(() => {\n  guard.trackComputed("name")\n  return ...\n})')
}
