/**
 * Message Actions Composable
 *
 * Handles all user interaction actions for message bubbles:
 * - Context menu (right-click) handling
 * - Copy message to clipboard (with fallback)
 * - Reply, forward, recall, select actions
 * - Retry failed messages
 * - Actions menu visibility state
 *
 * @module composables/message/useMessageActions
 */

import { ref, type Ref } from 'vue'
import type { Message } from '@/types'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessageActions')

/**
 * Event Emitter Interface
 * Defines the callback functions for message actions
 */
export interface MessageActionEmitters {
  copy: (_message: Message) => void
  reply: (_message: Message) => void
  forward: (_message: Message) => void
  recall: (_message: Message) => void
  select: (_message: Message) => void
  retry: (_messageId: string) => void
}

/**
 * Props Interface for useMessageActions
 */
export interface MessageActionsProps {
  message: Message
}

/**
 * Message Actions Composable
 *
 * Provides reactive state and methods for message interaction
 *
 * @param props - Reactive props containing the message
 * @param emit - Event emitters for action callbacks
 * @returns Object containing action state and methods
 *
 * @example
 * ```typescript
 * const props = ref({ message })
 * const emit = {
 * copy: (msg) => logger.debug('Copied:', msg),
 * reply: (msg) => logger.debug('Replying to:', msg),
 * // ... other emitters
 * }
 *
 * const {
 * showActions,
 * showActionsMenu,
 * handleRightClick,
 * copyMessage,
 * replyToMessage
 * } = useMessageActions(props, emit)
 * ```
 */
export function useMessageActions(
  props: Ref<MessageActionsProps>,
  emit: MessageActionEmitters
) {
  /**
   * State: Show action buttons on hover
   */
  const showActions = ref(false)

  /**
   * State: Show actions dropdown menu
   */
  const showActionsMenu = ref(false)

  /**
   * Handle right-click context menu
   * Prevents default context menu and toggles actions menu
   *
   * @param event - Mouse event from right-click
   */
  const handleRightClick = (event: MouseEvent) => {
    event.preventDefault()
    showActionsMenu.value = !showActionsMenu.value
    showActions.value = true
  }

  /**
   * Toggle actions menu visibility
   */
  const toggleActionsMenu = () => {
    showActionsMenu.value = !showActionsMenu.value
  }

  /**
   * Copy message content to clipboard
   * Uses modern Clipboard API with fallback for older browsers
   *
   * @async
   */
  const copyMessage = async () => {
    try {
      // Modern Clipboard API (Chrome 63+, Firefox 53+, Safari 13.1+)
      await navigator.clipboard.writeText(props.value.message.content)
      emit.copy(props.value.message)
      showActionsMenu.value = false
    } catch (error) {
      console.error('Failed to copy message:', error)

      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = props.value.message.content
      textArea.style.position = 'fixed' // Prevent scrolling to bottom
      textArea.style.opacity = '0' // Make invisible
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        // Execute copy command (deprecated but still works as fallback)
        const successful = document.execCommand('copy')
        if (successful) {
          emit.copy(props.value.message)
        }
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError)
      }

      document.body.removeChild(textArea)
      showActionsMenu.value = false
    }
  }

  /**
   * Reply to message
   * Emits reply event and closes actions menu
   */
  const replyToMessage = () => {
    emit.reply(props.value.message)
    showActionsMenu.value = false
  }

  /**
   * Forward message to other conversations
   * Emits forward event and closes actions menu
   */
  const forwardMessage = () => {
    emit.forward(props.value.message)
    showActionsMenu.value = false
  }

  /**
   * Recall/delete message
   * Emits recall event and closes actions menu
   */
  const recallMessage = () => {
    emit.recall(props.value.message)
    showActionsMenu.value = false
  }

  /**
   * Select message for batch operations
   * Emits select event and closes actions menu
   */
  const selectMessage = () => {
    emit.select(props.value.message)
    showActionsMenu.value = false
  }

  /**
   * Retry sending failed message
   * Emits retry event with message ID
   */
  const handleRetry = () => {
    frontendLogger.debug('[useMessageActions] Retry button clicked for message:', props.value.message.id)
    emit.retry(props.value.message.id)
  }

  /**
   * Close actions menu
   * Utility method to hide the actions menu
   */
  const closeActionsMenu = () => {
    showActionsMenu.value = false
  }

  /**
   * Set hover state
   * Utility methods for mouse enter/leave events
   */
  const setShowActions = (value: boolean) => {
    showActions.value = value
  }

  /**
   * Long-press (touch) support — mirrors the desktop right-click so touch
   * users can open the full actions menu without a hover toolbar.
   * A hold opens the menu; any move (scroll) or early release cancels it.
   */
  const LONG_PRESS_DURATION = 500
  const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const clearLongPress = () => {
    if (longPressTimer.value !== null) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
  }

  const handleTouchStart = () => {
    clearLongPress()
    longPressTimer.value = setTimeout(() => {
      showActions.value = true
      showActionsMenu.value = true
      longPressTimer.value = null
    }, LONG_PRESS_DURATION)
  }

  const handleTouchEnd = () => {
    clearLongPress()
  }

  const handleTouchMove = () => {
    clearLongPress()
  }

  return {
    // State
    showActions,
    showActionsMenu,

    // Event Handlers
    handleRightClick,
    toggleActionsMenu,
    copyMessage,
    replyToMessage,
    forwardMessage,
    recallMessage,
    selectMessage,
    handleRetry,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,

    // Utility Methods
    closeActionsMenu,
    setShowActions,
    clearLongPress
  }
}
