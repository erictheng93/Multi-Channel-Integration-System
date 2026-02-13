/**
 * Message Bubble Main Controller Composable
 *
 * Master composable that orchestrates all message bubble sub-composables.
 * Provides a unified API for the MessageBubble component.
 *
 * @module composables/message/useMessageBubble
 */

import { ref, computed, type Ref } from 'vue'
import type { Message } from '@/types'
import { useMessageTime } from './useMessageTime'
import { useMessageAttachment, type MessageAttachmentProps, type FileAttachment } from './useMessageAttachment'
import { useMessageActions, type MessageActionEmitters } from './useMessageActions'
import { useMessageSticker } from './useMessageSticker'
import { useMessageContent } from './useMessageContent'

/**
 * Props for useMessageBubble composable
 */
export interface MessageBubbleProps {
  message: Message
  delivered?: boolean
  showSender?: boolean
  uploadProgress?: number
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
}

/**
 * Main controller composable for MessageBubble component
 *
 * Orchestrates all sub-composables and provides:
 * - Time formatting (useMessageTime)
 * - Attachment handling (useMessageAttachment)
 * - User actions (useMessageActions)
 * - Sticker rendering (useMessageSticker)
 * - Content processing (useMessageContent)
 * - Image preview functionality
 * - Sender information
 *
 * @param props - Message bubble props
 * @param emit - Event emitters for parent component
 * @returns Complete message bubble API
 *
 * @example
 * ```typescript
 * const props = ref({
 *   message: myMessage,
 *   delivered: true,
 *   showSender: true
 * })
 *
 * const emit = {
 *   copy: (msg) => console.log('Copy', msg),
 *   reply: (msg) => console.log('Reply', msg),
 *   // ... other emitters
 * }
 *
 * const messageBubble = useMessageBubble(props, emit)
 * // Access: messageBubble.processedMessageContent, messageBubble.formatTime, etc.
 * ```
 */
export function useMessageBubble(
  props: Ref<MessageBubbleProps>,
  emit: MessageActionEmitters & {
    preview: (_message: Message) => void
    'image-load': (_message: Message) => void
    'image-error': (_message: Message) => void
  }
) {
  // ==================== Sub-Composables ====================

  /**
   * Time formatting composable
   */
  const { formatTime, normalizeDate, isToday, formatTimeOnly, formatDateTime } = useMessageTime()

  /**
   * Attachment handling composable
   */
  const attachmentProps = computed<MessageAttachmentProps>(() => ({
    message: props.value.message,
    attachmentUrl: props.value.attachmentUrl,
    attachmentName: props.value.attachmentName,
    attachmentSize: props.value.attachmentSize
  }))

  const {
    attachmentUrl,
    attachmentName,
    attachmentSize,
    fileAttachments,
    imageAttachments,
    nonImageAttachments,
    hasMultipleAttachments,
    isFileOnlyContent,
    messageStatus,
    downloadFile,
    downloadAttachment,
    isAttachmentPending,
    getAttachmentStatusClass,
    handleAttachmentPreview: handleAttachmentPreviewBase
  } = useMessageAttachment(attachmentProps)

  /**
   * User actions composable
   */
  const actionsProps = computed(() => ({
    message: props.value.message
  }))

  const actionsEmit = {
    copy: (message: Message) => emit.copy(message),
    reply: (message: Message) => emit.reply(message),
    forward: (message: Message) => emit.forward(message),
    recall: (message: Message) => emit.recall(message),
    select: (message: Message) => emit.select(message),
    retry: (messageId: string) => emit.retry(messageId)
  }

  const {
    showActions,
    showActionsMenu,
    handleRightClick,
    toggleActionsMenu,
    copyMessage,
    replyToMessage,
    forwardMessage,
    recallMessage,
    selectMessage,
    handleRetry,
    closeActionsMenu,
    setShowActions
  } = useMessageActions(actionsProps, actionsEmit)

  /**
   * Sticker handling composable
   */
  const stickerProps = computed(() => ({
    message: props.value.message
  }))

  const {
    stickerMetadata,
    stickerUrls,
    stickerImageUrl,
    currentStickerUrlIndex,
    stickerLoadError,
    stickerLoading,
    onStickerLoadStart,
    onStickerError,
    onStickerLoad
  } = useMessageSticker(stickerProps)

  /**
   * Content processing composable
   */
  const contentProps = computed(() => ({
    message: props.value.message
  }))

  const {
    processedMessageContent,
    actualMessageType,
    processMessageContent
  } = useMessageContent(contentProps)

  // ==================== Local State ====================

  /**
   * Image preview state
   */
  const showImagePreview = ref(false)
  const zoomLevel = ref(1)
  const imageLoaded = ref(false)
  const imageError = ref(false)

  // ==================== Computed Properties ====================

  /**
   * Determines if message is outgoing (sent by agent)
   */
  const isOutgoing = computed(() => {
    // Support both senderType and direction for test compatibility
    if ('direction' in props.value.message) {
      return (props.value.message as { direction: string }).direction === 'outgoing'
    }
    return props.value.message.senderType === 'agent'
  })

  /**
   * Sender display name
   */
  const senderName = computed(() => {
    if (props.value.message.senderType === 'customer') {
      return '客戶'
    }
    return '客服'
  })

  /**
   * Sender initials for avatar
   */
  const senderInitials = computed(() => {
    return senderName.value[0]
  })

  // ==================== Event Handlers ====================

  /**
   * Open image preview modal
   */
  const openImagePreview = () => {
    if (actualMessageType.value === 'image') {
      showImagePreview.value = true
      zoomLevel.value = 1
      emit.preview(props.value.message)
    }
  }

  /**
   * Close image preview modal
   */
  const closeImagePreview = () => {
    showImagePreview.value = false
    zoomLevel.value = 1
  }

  /**
   * Zoom in on preview image
   */
  const zoomIn = () => {
    if (zoomLevel.value < 3) {
      zoomLevel.value += 0.25
    }
  }

  /**
   * Zoom out on preview image
   */
  const zoomOut = () => {
    if (zoomLevel.value > 0.5) {
      zoomLevel.value -= 0.25
    }
  }

  /**
   * Reset zoom to 100%
   */
  const resetZoom = () => {
    zoomLevel.value = 1
  }

  /**
   * Image load success handler
   */
  const onImageLoad = () => {
    imageLoaded.value = true
    imageError.value = false
    emit['image-load'](props.value.message)
  }

  /**
   * Image load error handler
   */
  const onImageError = () => {
    imageLoaded.value = false
    imageError.value = true
    emit['image-error'](props.value.message)
  }

  /**
   * Handle attachment preview with emit wrapper
   */
  const handleAttachmentPreview = (attachment: FileAttachment) => {
    handleAttachmentPreviewBase(attachment, (message) => emit.preview(message))
  }

  // Mark fileAttachments as used (it's internally used by imageAttachments and nonImageAttachments)
  void fileAttachments

  // ==================== Return Public API ====================

  return {
    // Time formatting
    formatTime,
    normalizeDate,
    isToday,
    formatTimeOnly,
    formatDateTime,

    // Attachments
    attachmentUrl,
    attachmentName,
    attachmentSize,
    fileAttachments,
    imageAttachments,
    nonImageAttachments,
    hasMultipleAttachments,
    isFileOnlyContent,
    messageStatus,
    downloadFile,
    downloadAttachment,
    isAttachmentPending,
    getAttachmentStatusClass,
    handleAttachmentPreview,

    // Actions
    showActions,
    showActionsMenu,
    handleRightClick,
    toggleActionsMenu,
    copyMessage,
    replyToMessage,
    forwardMessage,
    recallMessage,
    selectMessage,
    handleRetry,
    closeActionsMenu,
    setShowActions,

    // Stickers
    stickerMetadata,
    stickerUrls,
    stickerImageUrl,
    currentStickerUrlIndex,
    stickerLoadError,
    stickerLoading,
    onStickerLoadStart,
    onStickerError,
    onStickerLoad,

    // Content
    processedMessageContent,
    actualMessageType,
    processMessageContent,

    // Sender info
    isOutgoing,
    senderName,
    senderInitials,

    // Image preview
    showImagePreview,
    zoomLevel,
    imageLoaded,
    imageError,
    openImagePreview,
    closeImagePreview,
    zoomIn,
    zoomOut,
    resetZoom,
    onImageLoad,
    onImageError
  }
}
