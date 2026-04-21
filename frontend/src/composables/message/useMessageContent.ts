/**
 * Message Content Processing Composable
 *
 * Handles message content processing, type detection, and caching.
 * Integrates with emoji rendering and database message renderer.
 *
 * @module composables/message/useMessageContent
 */

import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import type { Message } from '@/types'
import { renderDatabaseMessageForVue } from '@/utils/enhanced-message-renderer'
import { convertEmojiForMessageDetail } from '@/utils/layered-emoji-processor'
import { escapeHtml } from '@/utils/message/formatting'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessageContent')

/**
 * Props for useMessageContent composable
 */
export interface MessageContentProps {
  message: Message
}

/**
 * Message type with smart detection based on metadata
 */
export type MessageType = 'text' | 'image' | 'file' | 'sticker' | 'video' | 'audio' | 'location'

/**
 * Composable for processing and rendering message content
 *
 * Features:
 * - Smart message type detection from metadata
 * - Async content processing with debouncing
 * - LRU cache for processed content (max 100 entries)
 * - Integration with emoji renderer and database message renderer
 * - Automatic cleanup on component unmount
 *
 * @param props - Message props containing content to process
 * @returns Processed content, message type, and processing state
 *
 * @example
 * ```typescript
 * const props = ref({ message: textMessage })
 * const {
 * processedMessageContent,
 * actualMessageType,
 * isProcessing
 * } = useMessageContent(props)
 * ```
 */
export function useMessageContent(props: Ref<MessageContentProps>) {
  // ==================== State Management ====================

  /**
   * Processed message content (HTML string)
   */
  const processedMessageContent = ref('')

  /**
   * Whether content is currently being processed
   */
  const isProcessing = ref(false)

  /**
   * LRU cache for processed content
   * Key format: "content|messageType|metadata"
   * Max size: 100 entries
   */
  const contentCache = new Map<string, string>()

  /**
   * Debounce timer for content processing
   */
  let debounceTimer: number | null = null

  // ==================== Computed Properties ====================

  /**
   * Smart message type detection
   *
   * Uses defensive programming to handle LINE API type misclassification:
   * - Checks metadata for actual content type
   * - Falls back to messageType if metadata doesn't indicate otherwise
   * - Prevents frontend display errors from backend type mistakes
   */
  const actualMessageType = computed<MessageType>(() => {
    const originalType = props.value.message.messageType as MessageType

    // Check metadata for file information
    if (props.value.message.metadata) {
      try {
        const metadata = typeof props.value.message.metadata === 'string'
          ? JSON.parse(props.value.message.metadata)
          : props.value.message.metadata

        // If metadata contains file attachment info, check if it's actually an image
        // before classifying as 'file'. WEBP/PNG/JPG files from LINE arrive with
        // fileName in metadata but should render as inline images, not file cards.
        if (metadata.attachment || metadata.file || metadata.fileName) {
          const fileName = (metadata.fileName || metadata.file || '') as string
          const ext = fileName.split('.').pop()?.toLowerCase() || ''
          const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
          if (imageExts.includes(ext)) {
            return 'image'
          }
          return 'file'
        }

        // If metadata contains sticker info, it's a sticker message
        if (metadata.stickerId || metadata.packageId) {
          return 'sticker'
        }

        // If metadata contains image info, it's an image message
        // Backend stores: originalContentUrl, previewImageUrl (LINE format)
        // Also check: imageUrl, previewUrl (generic format)
        if (metadata.imageUrl || metadata.previewUrl || metadata.originalContentUrl || metadata.previewImageUrl) {
          return 'image'
        }
      } catch (error) {
        console.warn('[MessageContent] Failed to parse metadata for type detection:', error)
      }
    }

    // If unable to determine from metadata, use original type
    return originalType || 'text'
  })

  // ==================== Content Processing ====================

  /**
   * Process message content with caching and debouncing
   *
   * Processing flow:
   * 1. Check cache for existing processed content
   * 2. If sticker: use database message renderer
   * 3. If other: use layered emoji processor
   * 4. Cache result with LRU eviction (max 100 entries)
   * 5. Fallback to escaped HTML on error
   */
  const processMessageContent = async () => {
    if (!props.value.message.content) {
      processedMessageContent.value = ''
      return
    }

    // Clear previous debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // Debounce processing to avoid excessive calls
    debounceTimer = window.setTimeout(async () => {
      try {
        isProcessing.value = true

        // Create content identifier for caching
        const messageType = props.value.message.messageType || 'text'
        const contentIdentifier = `${props.value.message.content}|${messageType}|${JSON.stringify(props.value.message.metadata || {})}`

        // Check cache
        if (contentCache.has(contentIdentifier)) {
          const cachedContent = contentCache.get(contentIdentifier)
          if (cachedContent) {
            processedMessageContent.value = cachedContent
            isProcessing.value = false
            return
          }
        }

        if (import.meta.env.DEV) {
          frontendLogger.debug('[MessageContent] Processing content...')
          frontendLogger.debug('[MessageContent] Message type:', messageType)
          frontendLogger.debug('[MessageContent] Content length:', props.value.message.content.length)
        }

        let result: string

        // If sticker message, use complete database message renderer (includes sticker handling)
        if (messageType === 'sticker' && props.value.message.metadata) {
          const metadataString = typeof props.value.message.metadata === 'string'
            ? props.value.message.metadata
            : JSON.stringify(props.value.message.metadata)

          result = await renderDatabaseMessageForVue(
            props.value.message.content,
            messageType,
            metadataString
          )
        } else {
          // Other message types use layered emoji processor (Layer 1 + Layer 2)
          result = await convertEmojiForMessageDetail(props.value.message.content)
        }

        // Cache result with LRU eviction (limit cache size to prevent memory leak)
        if (contentCache.size > 100) {
          const firstKey = contentCache.keys().next().value
          if (firstKey) {
            contentCache.delete(firstKey)
          }
        }
        contentCache.set(contentIdentifier, result)

        processedMessageContent.value = result

        if (import.meta.env.DEV) {
          frontendLogger.debug('[MessageContent] Content processed successfully')
        }
      } catch (error) {
        console.error('[MessageContent] Error processing content:', error)
        // If processing fails, use original content (escaped HTML)
        processedMessageContent.value = escapeHtml(props.value.message.content)
      } finally {
        isProcessing.value = false
      }
    }, 100) // 100ms debounce
  }

  // ==================== Watchers ====================

  /**
   * Watch message changes and reprocess content
   *
   * Only reprocesses if actual content/type/metadata changed
   * to avoid unnecessary work
   */
  watch(
    () => props.value.message,
    (newValue, oldValue) => {
      // Only reprocess when actual content changes
      if (!oldValue ||
          newValue.content !== oldValue.content ||
          newValue.messageType !== oldValue.messageType ||
          JSON.stringify(newValue.metadata) !== JSON.stringify(oldValue.metadata)) {
        processMessageContent()
      }
    },
    { immediate: true, deep: true }
  )

  // ==================== Lifecycle Hooks ====================

  /**
   * Cleanup on component unmount
   *
   * Clears debounce timer and content cache to prevent memory leaks
   */
  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    contentCache.clear()
  })

  // ==================== Return Public API ====================

  return {
    // Computed properties
    processedMessageContent,
    actualMessageType,
    isProcessing,

    // Methods (for manual reprocessing if needed)
    processMessageContent
  }
}
