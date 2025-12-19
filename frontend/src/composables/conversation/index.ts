/**
 * Conversation Composables - Unified Exports
 *
 * 這個模塊提供了完整的對話管理業務邏輯 Composables。
 *
 * ## 使用方式
 *
 * ### 方式 1: 使用主控制器（推薦）
 * ```typescript
 * import { useConversationController } from '@/composables/conversation'
 *
 * const controller = useConversationController(conversationId.value)
 *
 * onMounted(async () => {
 *   await controller.initialize()
 * })
 *
 * onUnmounted(() => {
 *   controller.cleanup()
 * })
 * ```
 *
 * ### 方式 2: 單獨使用子模塊（用於測試或特殊需求）
 * ```typescript
 * import {
 *   useConversationState,
 *   useMessageHandlers,
 *   useWebSocketIntegration,
 *   useConversationActions
 * } from '@/composables/conversation'
 *
 * const state = useConversationState(conversationId)
 * const handlers = useMessageHandlers(conversationId, state)
 * // ...
 * ```
 */

// ===== 主控制器（推薦使用） =====
export { useConversationController } from './useConversationController'
export type {
  ConversationController,
  ConversationControllerOptions
} from './useConversationController'

// ===== 子模塊 Composables =====
export { useConversationState } from './useConversationState'
export type {
  ConversationState,
  ConversationStateOptions
} from './useConversationState'

export { useMessageHandlers } from './useMessageHandlers'
export type {
  MessageHandlers,
  MessagePendingData,
  UploadProgressData,
  MessageConfirmedData,
  MessageFailedData,
  MessageSentData,
  RetryAttachment
} from './useMessageHandlers'

export { useWebSocketIntegration } from './useWebSocketIntegration'
export type { WebSocketIntegration } from './useWebSocketIntegration'

export { useConversationActions } from './useConversationActions'
export type {
  ConversationActions,
  ScrollTarget
} from './useConversationActions'
