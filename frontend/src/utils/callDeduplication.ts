import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('callDeduplication')
/**
 * Layer 1 Defense: Call Deduplication Utility
 *
 * 防止同一個異步函數被重複調用，解決 race condition
 *
 * @example
 * ```ts
 * const debouncedLoad = createDedupedAsyncFunction(
 * loadConversation,
 * { key: 'loadConversation' }
 * )
 *
 * // 即使被調用多次，只會執行一次
 * debouncedLoad()
 * debouncedLoad() // 被忽略，返回第一次調用的 Promise
 * ```
 */

interface DedupOptions {
  /** 唯一標識符，用於區分不同的函數調用 */
  key: string
  /** 超時時間（毫秒），超過此時間後允許重新調用 */
  timeout?: number
  /** 是否在開發環境打印警告 */
  warnOnDuplicate?: boolean
}

interface PendingCall {
  promise: Promise<unknown>
  timestamp: number
  count: number // 重複調用計數
}

// 全局 pending calls 映射表
const pendingCalls = new Map<string, PendingCall>()

/**
 * 創建一個防重複調用的異步函數包裝器
 */
export function createDedupedAsyncFunction<T extends (..._args: never[]) => Promise<unknown>>(
  fn: T,
  options: DedupOptions
): T {
  const { key, timeout = 30000, warnOnDuplicate = import.meta.env.DEV } = options

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now()
    const pending = pendingCalls.get(key)

    // 檢查是否有正在進行的調用
    if (pending) {
      // 檢查是否超時
      if (now - pending.timestamp < timeout) {
        pending.count++

        if (warnOnDuplicate) {
          console.warn(
            `[CallDedup]  Duplicate call detected for "${key}"`,
            `\n  - Duplicate count: ${pending.count}`,
            `\n  - Time since first call: ${now - pending.timestamp}ms`,
            `\n  - Returning existing promise instead of re-executing`
          )
        }

        // 返回現有的 Promise
        return pending.promise as ReturnType<T>
      } else {
        // 超時，清除舊的調用記錄
        pendingCalls.delete(key)
        if (warnOnDuplicate) {
          frontendLogger.debug(
            `[CallDedup]  Previous call for "${key}" timed out, allowing new call`
          )
        }
      }
    }

    // 執行新的調用
    try {
      const promise = fn(...args)

      // 記錄 pending call
      pendingCalls.set(key, {
        promise,
        timestamp: now,
        count: 1
      })

      if (warnOnDuplicate) {
        frontendLogger.debug(`[CallDedup]  Executing new call for "${key}"`)
      }

      // 等待完成
      const result = await promise

      // 完成後清除記錄
      pendingCalls.delete(key)

      if (warnOnDuplicate) {
        frontendLogger.debug(`[CallDedup]  Call completed for "${key}"`)
      }

      return result as ReturnType<T>
    } catch (error) {
      // 錯誤時也要清除記錄
      pendingCalls.delete(key)

      if (warnOnDuplicate) {
        console.error(`[CallDedup]  Call failed for "${key}":`, error)
      }

      throw error
    }
  }) as T
}

/**
 * 手動清除特定函數的 pending 狀態
 */
export function clearPendingCall(key: string): void {
  if (pendingCalls.has(key)) {
    pendingCalls.delete(key)
    if (import.meta.env.DEV) {
      frontendLogger.debug(`[CallDedup]  Manually cleared pending call for "${key}"`)
    }
  }
}

/**
 * 獲取當前所有 pending calls 的統計信息
 */
export function getPendingCallsStats(): Record<string, { count: number; age: number }> {
  const now = Date.now()
  const stats: Record<string, { count: number; age: number }> = {}

  pendingCalls.forEach((pending, key) => {
    stats[key] = {
      count: pending.count,
      age: now - pending.timestamp
    }
  })

  return stats
}

/**
 * 檢查是否有任何 pending calls
 */
export function hasPendingCalls(): boolean {
  return pendingCalls.size > 0
}

/**
 * 清除所有 pending calls（僅在測試或緊急情況下使用）
 */
export function clearAllPendingCalls(): void {
  const count = pendingCalls.size
  pendingCalls.clear()
  if (import.meta.env.DEV && count > 0) {
    console.warn(`[CallDedup]  Cleared ${count} pending calls`)
  }
}
