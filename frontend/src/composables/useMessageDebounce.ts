// useMessageDebounce - 防止消息重复发送的防抖机制
// Prevents duplicate message sending with debounce protection

import { ref, computed } from 'vue'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessageDebounce')

export interface MessageDebounceConfig {
  /** 防抖延迟时间 (毫秒) */
  delay?: number
  /** 是否启用防抖 */
  enabled?: boolean
}

export interface MessageDebounceState {
  /** 是否正在发送中 */
  isSending: boolean
  /** 上次发送时间戳 */
  lastSentTime: number
  /** 被阻止的请求数量 */
  blockedCount: number
}

/**
 * 消息发送防抖 Composable
 *
 * 功能:
 * - 防止快速连续点击触发多次发送
 * - 追踪发送状态和时间
 * - 提供可视化的发送状态
 *
 * @example
 * ```typescript
 * const { isSending, canSend, markSending, markComplete } = useMessageDebounce(500)
 *
 * const sendMessage = async () => {
 * if (!canSend()) {
 * console.warn('发送太快，已阻止')
 * return
 * }
 *
 * markSending()
 * try {
 * await api.send(...)
 * } finally {
 * markComplete()
 * }
 * }
 * ```
 */
export function useMessageDebounce(config: MessageDebounceConfig = {}) {
  const {
    delay = 500,
    enabled = true
  } = config

  // 内部状态
  const state = ref<MessageDebounceState>({
    isSending: false,
    lastSentTime: 0,
    blockedCount: 0
  })

  // Computed 属性
  const isSending = computed(() => state.value.isSending)
  const lastSentTime = computed(() => state.value.lastSentTime)
  const blockedCount = computed(() => state.value.blockedCount)

  /**
   * 检查是否可以发送消息
   * @returns true 如果可以发送，false 如果需要等待
   */
  const canSend = (): boolean => {
    // 如果禁用防抖，总是允许
    if (!enabled) {
      return true
    }

    // 如果正在发送中，阻止
    if (state.value.isSending) {
      console.warn('[MessageDebounce] Already sending, blocked')
      state.value.blockedCount++
      return false
    }

    // 检查时间间隔
    const now = Date.now()
    const timeSinceLastSend = now - state.value.lastSentTime

    if (timeSinceLastSend < delay) {
      const remainingTime = delay - timeSinceLastSend
      console.warn(`[MessageDebounce] Too fast (${timeSinceLastSend}ms since last), need to wait ${remainingTime}ms more`)
      state.value.blockedCount++
      return false
    }

    return true
  }

  /**
   * 标记开始发送
   * 更新状态为发送中，并记录时间戳
   */
  const markSending = () => {
    state.value.isSending = true
    state.value.lastSentTime = Date.now()
    frontendLogger.debug('[MessageDebounce] Marked as sending')
  }

  /**
   * 标记发送完成
   * 清除发送中状态
   */
  const markComplete = () => {
    state.value.isSending = false
    frontendLogger.debug('[MessageDebounce] Marked as complete')
  }

  /**
   * 标记发送失败
   * 清除发送中状态，但保留时间戳防止立即重试
   */
  const markFailed = (error?: Error) => {
    state.value.isSending = false
    console.error('[MessageDebounce] Marked as failed:', error?.message)
  }

  /**
   * 重置所有状态
   * 用于清理或测试
   */
  const reset = () => {
    state.value = {
      isSending: false,
      lastSentTime: 0,
      blockedCount: 0
    }
    frontendLogger.debug('[MessageDebounce] State reset')
  }

  /**
   * 获取防抖统计信息
   */
  const getStats = () => ({
    isSending: state.value.isSending,
    lastSentTime: state.value.lastSentTime,
    blockedCount: state.value.blockedCount,
    timeSinceLastSend: Date.now() - state.value.lastSentTime,
    config: { delay, enabled }
  })

  return {
    // 状态
    isSending,
    lastSentTime,
    blockedCount,

    // 方法
    canSend,
    markSending,
    markComplete,
    markFailed,
    reset,
    getStats
  }
}

/**
 * 创建全局消息防抖实例
 * 用于在多个组件间共享防抖状态
 */
let globalDebounceInstance: ReturnType<typeof useMessageDebounce> | null = null

export function useGlobalMessageDebounce(config?: MessageDebounceConfig) {
  if (!globalDebounceInstance) {
    globalDebounceInstance = useMessageDebounce(config)
  }
  return globalDebounceInstance
}
