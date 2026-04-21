/**
 * 防抖和節流工具函數
 * 用於優化實時搜索性能
 */

/* eslint-disable no-unused-vars */

/**
 * 防抖函數
 * 在事件觸發後延遲執行，如果在延遲期間再次觸發則重新計時
 *
 * @param fn - 要防抖的函數
 * @param delay - 延遲時間（毫秒）
 * @param immediate - 是否立即執行（首次觸發時）
 * @returns 防抖後的函數
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 * logger.debug('搜索:', query)
 * }, 300)
 *
 * debouncedSearch('a')
 * debouncedSearch('ab')
 * debouncedSearch('abc')
 * // 只執行最後一次: "搜索: abc"
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: unknown, ...args: Parameters<T>) {
    const callNow = immediate && !timeoutId

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      if (!immediate) {
        fn.apply(this, args)
      }
    }, delay)

    if (callNow) {
      fn.apply(this, args)
    }
  }
}

/**
 * 節流函數
 * 限制函數在指定時間內只能執行一次
 *
 * @param fn - 要節流的函數
 * @param limit - 時間限制（毫秒）
 * @param options - 配置選項
 * @returns 節流後的函數
 *
 * @example
 * const throttledScroll = throttle(() => {
 * logger.debug('滾動事件')
 * }, 100)
 *
 * window.addEventListener('scroll', throttledScroll)
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number = 300,
  options: {
    leading?: boolean
    trailing?: boolean
  } = {}
): (...args: Parameters<T>) => void {
  let inThrottle = false
  let lastArgs: Parameters<T> | null = null
  let lastContext: unknown = null

  const { leading = true, trailing = true } = options

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      if (leading) {
        fn.apply(this, args)
      }
      inThrottle = true
      lastArgs = null
      lastContext = null

      setTimeout(() => {
        inThrottle = false
        if (trailing && lastArgs) {
          fn.apply(lastContext, lastArgs)
          lastArgs = null
          lastContext = null
        }
      }, limit)
    } else {
      lastArgs = args
      lastContext = this
    }
  }
}

/**
 * 創建可取消的防抖函數
 *
 * @param fn - 要防抖的函數
 * @param delay - 延遲時間
 * @returns 帶有 cancel 方法的防抖函數
 *
 * @example
 * const search = createDebouncedFunction((query: string) => {
 * logger.debug('搜索:', query)
 * }, 300)
 *
 * search.debounced('abc')
 * search.cancel() // 取消待執行的搜索
 */
export function createDebouncedFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300
): {
  debounced: (...args: Parameters<T>) => void
  cancel: () => void
  flush: () => void
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastContext: unknown = null

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args
    lastContext = this

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      if (lastArgs) {
        fn.apply(lastContext, lastArgs)
      }
      timeoutId = null
      lastArgs = null
      lastContext = null
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
    lastContext = null
  }

  const flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId)
      fn.apply(lastContext, lastArgs)
      timeoutId = null
      lastArgs = null
      lastContext = null
    }
  }

  return { debounced, cancel, flush }
}

/**
 * 創建可取消的節流函數
 *
 * @param fn - 要節流的函數
 * @param limit - 時間限制
 * @returns 帶有 cancel 方法的節流函數
 */
export function createThrottledFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number = 300
): {
  throttled: (...args: Parameters<T>) => void
  cancel: () => void
} {
  let inThrottle = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true

      timeoutId = setTimeout(() => {
        inThrottle = false
        timeoutId = null
      }, limit)
    }
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    inThrottle = false
  }

  return { throttled, cancel }
}

/**
 * 防抖 Promise 函數
 * 用於異步操作的防抖
 *
 * @param fn - 返回 Promise 的函數
 * @param delay - 延遲時間
 * @returns 防抖後的異步函數
 *
 * @example
 * const searchAPI = debounceAsync(async (query: string) => {
 * const response = await fetch(`/api/search?q=${query}`)
 * return response.json()
 * }, 300)
 *
 * await searchAPI('abc')
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let latestResolve: ((value: ReturnType<T>) => void) | null = null
  let latestReject: ((reason?: unknown) => void) | null = null

  return function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // 拒絕之前的 Promise
      if (latestReject) {
        latestReject(new Error('Debounced'))
      }

      latestResolve = resolve as (value: ReturnType<T>) => void
      latestReject = reject

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn.apply(this, args)
          if (latestResolve) {
            latestResolve(result as ReturnType<T>)
          }
        } catch (error) {
          if (latestReject) {
            latestReject(error)
          }
        } finally {
          timeoutId = null
          latestResolve = null
          latestReject = null
        }
      }, delay)
    })
  }
}

/**
 * 立即執行防抖
 * 首次調用立即執行，後續調用防抖
 *
 * @param fn - 要防抖的函數
 * @param delay - 延遲時間
 * @returns 防抖函數
 */
export function debounceImmediate<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  return debounce(fn, delay, true)
}
