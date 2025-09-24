import { onUnmounted } from 'vue'

// DOM 類型定義
interface AddEventListenerOptions {
  capture?: boolean
  once?: boolean
  passive?: boolean
  signal?: globalThis.AbortSignal
}

interface EventListener {
  (_evt: Event): void
}

export interface EventHandler {
  // 事件監聽器管理
  addEventListener: (_element: EventTarget, _event: string, _handler: EventListener, _options?: AddEventListenerOptions) => void
  removeEventListener: (_element: EventTarget, _event: string, _handler: EventListener) => void

  // 計時器管理
  setTimeout: (_callback: () => void, _delay: number) => number
  clearTimeout: (_timerId: number) => void
  setInterval: (_callback: () => void, _delay: number) => number
  clearInterval: (_timerId: number) => void

  // 清理所有事件和計時器
  cleanup: () => void

  // 防抖和節流函數
  debounce: <T extends (..._args: any[]) => any>(_func: T, _delay: number) => (..._args: Parameters<T>) => void
  throttle: <T extends (..._args: any[]) => any>(_func: T, _delay: number) => (..._args: Parameters<T>) => void
}

interface RegisteredEventListener {
  element: EventTarget
  event: string
  handler: EventListener
}

/**
 * 統一的事件處理管理 composable
 * 自動清理事件監聽器和計時器，防止記憶體洩漏
 */
export function useEventHandler(): EventHandler {
  const eventListeners: RegisteredEventListener[] = []
  const timeouts = new Set<number>()
  const intervals = new Set<number>()
  const debounceTimers = new Map<Function, number>()
  const throttleTimers = new Map<Function, number>()

  // 添加事件監聽器
  const addEventListener = (
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    element.addEventListener(event, handler, options)
    eventListeners.push({ element, event, handler })
  }

  // 移除事件監聽器
  const removeEventListener = (
    element: EventTarget,
    event: string,
    handler: EventListener
  ) => {
    element.removeEventListener(event, handler)
    const index = eventListeners.findIndex(
      listener => listener.element === element &&
                 listener.event === event &&
                 listener.handler === handler
    )
    if (index > -1) {
      eventListeners.splice(index, 1)
    }
  }

  // 設定計時器
  const setTimeoutManaged = (callback: () => void, delay: number): number => {
    const timerId = window.setTimeout(() => {
      callback()
      timeouts.delete(timerId)
    }, delay)
    timeouts.add(timerId)
    return timerId
  }

  // 清除計時器
  const clearTimeoutManaged = (timerId: number) => {
    window.clearTimeout(timerId)
    timeouts.delete(timerId)
  }

  // 設定間隔計時器
  const setIntervalManaged = (callback: () => void, delay: number): number => {
    const timerId = window.setInterval(callback, delay)
    intervals.add(timerId)
    return timerId
  }

  // 清除間隔計時器
  const clearIntervalManaged = (timerId: number) => {
    window.clearInterval(timerId)
    intervals.delete(timerId)
  }

  // 防抖函數
  const debounce = <T extends (..._args: any[]) => any>(
    func: T,
    delay: number
  ): ((..._args: Parameters<T>) => void) => {
    return (..._args: Parameters<T>) => {
      const existingTimer = debounceTimers.get(func)
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      const timerId = window.setTimeout(() => {
        func(..._args)
        debounceTimers.delete(func)
      }, delay)

      debounceTimers.set(func, timerId)
    }
  }

  // 節流函數
  const throttle = <T extends (..._args: any[]) => any>(
    func: T,
    delay: number
  ): ((..._args: Parameters<T>) => void) => {
    return (..._args: Parameters<T>) => {
      if (!throttleTimers.has(func)) {
        func(..._args)

        const timerId = window.setTimeout(() => {
          throttleTimers.delete(func)
        }, delay)

        throttleTimers.set(func, timerId)
      }
    }
  }

  // 清理所有事件和計時器
  const cleanup = () => {
    // 清理事件監聽器
    eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler)
    })
    eventListeners.length = 0

    // 清理計時器
    timeouts.forEach(timerId => window.clearTimeout(timerId))
    timeouts.clear()

    intervals.forEach(timerId => window.clearInterval(timerId))
    intervals.clear()

    // 清理防抖和節流計時器
    debounceTimers.forEach(timerId => window.clearTimeout(timerId))
    debounceTimers.clear()

    throttleTimers.forEach(timerId => window.clearTimeout(timerId))
    throttleTimers.clear()
  }

  // 組件卸載時自動清理
  onUnmounted(cleanup)

  return {
    addEventListener,
    removeEventListener,
    setTimeout: setTimeoutManaged,
    clearTimeout: clearTimeoutManaged,
    setInterval: setIntervalManaged,
    clearInterval: clearIntervalManaged,
    cleanup,
    debounce,
    throttle
  }
}