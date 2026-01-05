/**
 * Conversation Actions Composable
 *
 * 管理对话操作 (关闭/重新打开) 的逻辑和状态
 * 包含确认对话框、错误处理和 Toast 提示
 *
 * @module composables/useConversationActions
 * @example
 * ```typescript
 * const controller = useConversationController(conversationId)
 * const actions = useConversationActions(controller)
 *
 * // In template
 * <button @click="actions.close" :disabled="actions.isClosing.value">
 *   关闭对话
 * </button>
 * <button @click="actions.reopen">
 *   重新打开
 * </button>
 * ```
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

/**
 * ConversationController 接口
 * (简化版，只包含需要的方法)
 */
export interface ConversationController {
  closeConversation: () => Promise<boolean>
  reopenConversation: () => Promise<boolean>
}

/**
 * useConversationActions 配置选项
 */
export interface ConversationActionsOptions {
  /**
   * 关闭前确认对话框配置
   */
  closeConfirmation?: {
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
  }

  /**
   * Toast 提示文本配置
   */
  toastMessages?: {
    closeSuccess?: string
    closeError?: string
    reopenSuccess?: string
    reopenError?: string
  }

  /**
   * 是否在关闭前显示确认对话框 (默认: true)
   */
  confirmBeforeClose?: boolean
}

/**
 * useConversationActions 返回值
 */
export interface ConversationActionsReturn {
  // State
  /** 是否正在关闭中 */
  isClosing: Ref<boolean>

  // Actions
  /** 关闭对话 (带确认) */
  close: () => Promise<boolean>
  /** 重新打开对话 */
  reopen: () => Promise<boolean>
}

/**
 * 对话操作管理 Composable
 *
 * 功能:
 * - ✅ 关闭对话 (带确认对话框)
 * - ✅ 重新打开对话
 * - ✅ Loading 状态管理
 * - ✅ Toast 提示集成
 * - ✅ 错误处理
 *
 * @param controller - ConversationController 实例
 * @param options - 配置选项
 * @returns 对话操作状态和方法
 */
export function useConversationActions(
  controller: ConversationController,
  options: ConversationActionsOptions = {}
): ConversationActionsReturn {
  const {
    closeConfirmation = {},
    toastMessages = {},
    confirmBeforeClose = true,
  } = options

  // Default confirmation text
  const confirmationConfig = {
    title: closeConfirmation.title ?? '確定要關閉這個對話嗎？',
    message: closeConfirmation.message ?? '關閉後將無法繼續發送訊息',
    confirmText: closeConfirmation.confirmText ?? '關閉對話',
    cancelText: closeConfirmation.cancelText ?? '取消',
  }

  // Default toast messages
  const toastConfig = {
    closeSuccess: toastMessages.closeSuccess ?? '對話已關閉',
    closeError: toastMessages.closeError ?? '關閉失敗',
    reopenSuccess: toastMessages.reopenSuccess ?? '對話已重新打開',
    reopenError: toastMessages.reopenError ?? '重新打開失敗',
  }

  const { showSuccess, showError } = useToast()
  const { showConfirm } = useConfirm()

  // ============================================================================
  // State
  // ============================================================================

  const isClosing = ref(false)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 关闭对话
   *
   * 流程:
   * 1. 显示确认对话框 (如果启用)
   * 2. 用户确认后调用 controller.closeConversation()
   * 3. 显示成功/失败 Toast
   * 4. 返回操作结果
   *
   * @returns Promise<boolean> - 是否成功关闭
   */
  const close = async (): Promise<boolean> => {
    try {
      // Step 1: 确认对话框
      if (confirmBeforeClose) {
        const confirmed = await showConfirm({
          title: confirmationConfig.title,
          message: confirmationConfig.message,
          confirmText: confirmationConfig.confirmText,
          cancelText: confirmationConfig.cancelText,
          type: 'warning',
        })

        if (!confirmed) {
          return false // 用户取消
        }
      }

      // Step 2: 执行关闭
      isClosing.value = true

      const success = await controller.closeConversation()

      // Step 3: 显示 Toast
      if (success) {
        showSuccess(toastConfig.closeSuccess)
      } else {
        showError(toastConfig.closeError)
      }

      return success
    } catch (error) {
      console.error('[useConversationActions] Close conversation error:', error)
      showError('關閉對話時發生錯誤')
      return false
    } finally {
      isClosing.value = false
    }
  }

  /**
   * 重新打开对话
   *
   * 流程:
   * 1. 调用 controller.reopenConversation()
   * 2. 显示成功/失败 Toast
   * 3. 返回操作结果
   *
   * @returns Promise<boolean> - 是否成功重新打开
   */
  const reopen = async (): Promise<boolean> => {
    try {
      const success = await controller.reopenConversation()

      if (success) {
        showSuccess(toastConfig.reopenSuccess)
      } else {
        showError(toastConfig.reopenError)
      }

      return success
    } catch (error) {
      console.error('[useConversationActions] Reopen conversation error:', error)
      showError('重新打開對話時發生錯誤')
      return false
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isClosing,

    // Actions
    close,
    reopen,
  }
}
