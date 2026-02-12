/**
 * New Message Notification Composable
 *
 * 管理新消息通知徽章的显示/隐藏逻辑和交互
 * 当用户向上滚动时收到新消息，显示通知徽章提示用户
 *
 * @module composables/useNewMessageNotification
 * @example
 * ```typescript
 * const notification = useNewMessageNotification({
 *   scrollToBottom: () => controller.scrollToBottom()
 * })
 *
 * // In template
 * <NewMessageNotification
 *   :is-visible="notification.isVisible.value"
 *   :count="newMessageCount"
 *   @click="notification.scrollToNewest"
 *   @dismiss="notification.dismiss"
 * />
 * ```
 */

import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * useNewMessageNotification 配置选项
 */
export interface NewMessageNotificationOptions {
  /**
   * 滚动到底部的函数
   */
  scrollToBottom?: () => void

  /**
   * 新消息计数 (Ref)
   * 当 count > 0 且用户向上滚动时，显示通知
   */
  newMessageCount?: Ref<number>

  /**
   * 是否自动隐藏 (当滚动到底部时)
   * 默认: true
   */
  autoHide?: boolean

  /**
   * 自动隐藏延迟 (毫秒)
   * 点击通知后延迟隐藏，让用户看到滚动动画
   * 默认: 300ms
   */
  autoHideDelay?: number
}

/**
 * useNewMessageNotification 返回值
 */
export interface NewMessageNotificationReturn {
  // State
  /** 通知是否可见 */
  isVisible: Ref<boolean>

  // Actions
  /** 滚动到最新消息 */
  scrollToNewest: () => void
  /** 暂时关闭通知 */
  dismiss: () => void
  /** 显示通知 (当收到新消息且向上滚动时) */
  show: () => void
  /** 隐藏通知 */
  hide: () => void
  /** 处理滚动事件 (自动隐藏) */
  handleScroll: (_isAtBottom: boolean) => void
}

/**
 * 新消息通知管理 Composable
 *
 * 功能:
 * - ✅ 新消息通知显示/隐藏
 * - ✅ 滚动到最新消息
 * - ✅ 手动关闭通知
 * - ✅ 自动隐藏 (滚动到底部时)
 * - ✅ 消息计数跟踪
 *
 * 交互流程:
 * 1. 用户向上滚动查看历史消息
 * 2. 收到新消息时调用 show()
 * 3. 显示通知徽章
 * 4. 用户点击通知 → scrollToNewest() → 滚动到底部并隐藏
 * 5. 或用户手动滚动到底部 → handleScroll(true) → 自动隐藏
 *
 * @param options - 配置选项
 * @returns 通知状态和操作方法
 */
export function useNewMessageNotification(
  options: NewMessageNotificationOptions = {}
): NewMessageNotificationReturn {
  const {
    scrollToBottom,
    newMessageCount,
    autoHide = true,
    autoHideDelay = 300,
  } = options

  // ============================================================================
  // State
  // ============================================================================

  const isVisible = ref(false)

  // ============================================================================
  // Watchers
  // ============================================================================

  // 监听消息计数变化 - 如果计数归零，隐藏通知
  if (newMessageCount) {
    watch(newMessageCount, (count) => {
      if (count === 0 && isVisible.value) {
        hide()
      }
    })
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 滚动到最新消息
   * 点击通知时调用
   */
  const scrollToNewest = (): void => {
    scrollToBottom?.()

    // 延迟隐藏，让用户看到滚动动画
    if (autoHideDelay > 0) {
      setTimeout(() => {
        hide()
      }, autoHideDelay)
    } else {
      hide()
    }
  }

  /**
   * 暂时关闭通知
   * 不滚动，只是隐藏通知
   */
  const dismiss = (): void => {
    hide()
  }

  /**
   * 显示通知
   * 当收到新消息且用户向上滚动时调用
   */
  const show = (): void => {
    isVisible.value = true
  }

  /**
   * 隐藏通知
   */
  const hide = (): void => {
    isVisible.value = false
  }

  /**
   * 处理滚动事件
   * @param isAtBottom - 是否滚动到底部
   */
  const handleScroll = (isAtBottom: boolean): void => {
    if (autoHide && isAtBottom) {
      hide()
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isVisible,

    // Actions
    scrollToNewest,
    dismiss,
    show,
    hide,
    handleScroll,
  }
}
