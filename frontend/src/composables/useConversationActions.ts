/**
 * Conversation Actions Composable (Stub)
 *
 * Close/reopen functionality has been removed as part of status cleanup.
 * This composable is kept for backward compatibility but provides no-op actions.
 *
 * @module composables/useConversationActions
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * ConversationController 接口 (simplified - close/reopen removed)
 */
export interface ConversationController {
  // No close/reopen methods needed
  [key: string]: any
}

/**
 * useConversationActions 配置選項 (kept for backward compatibility)
 */
export interface ConversationActionsOptions {
  closeConfirmation?: {
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
  }
  toastMessages?: {
    closeSuccess?: string
    closeError?: string
    reopenSuccess?: string
    reopenError?: string
  }
  confirmBeforeClose?: boolean
}

/**
 * useConversationActions 返回值
 */
export interface ConversationActionsReturn {
  // State
  isClosing: Ref<boolean>

  // Actions (no-ops)
  close: () => Promise<boolean>
  reopen: () => Promise<boolean>
}

/**
 * 對話操作管理 Composable (Stub)
 *
 * Close/reopen functionality has been removed.
 * All actions return false (no-op).
 */
export function useConversationActions(
  _controller: ConversationController,
  _options: ConversationActionsOptions = {}
): ConversationActionsReturn {
  const isClosing = ref(false)

  const close = async (): Promise<boolean> => {
    console.warn('[useConversationActions] close() is deprecated and has no effect')
    return false
  }

  const reopen = async (): Promise<boolean> => {
    console.warn('[useConversationActions] reopen() is deprecated and has no effect')
    return false
  }

  return {
    isClosing,
    close,
    reopen,
  }
}
