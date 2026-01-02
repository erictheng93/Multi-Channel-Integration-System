/**
 * Message Sticker Composable
 *
 * Handles LINE sticker metadata parsing, URL generation, and CDN fallback logic.
 * Provides comprehensive error handling with multiple CDN sources and loading states.
 *
 * @module composables/message/useMessageSticker
 */

import { ref, computed, watch, nextTick, type Ref } from 'vue'
import type { Message } from '@/types'

/**
 * Sticker metadata structure
 */
export interface StickerMetadata {
  packageId: string
  stickerId: string
}

/**
 * Props for useMessageSticker composable
 */
export interface MessageStickerProps {
  message: Message
}

/**
 * Composable for handling LINE sticker messages
 *
 * Features:
 * - Automatic metadata parsing from message
 * - Multiple CDN sources with automatic fallback
 * - Loading state management
 * - Error handling with retry logic
 * - Debug logging for troubleshooting
 *
 * @param props - Message props containing sticker data
 * @returns Sticker state, URLs, and event handlers
 *
 * @example
 * ```typescript
 * const props = ref({ message: stickerMessage })
 * const {
 *   stickerMetadata,
 *   stickerImageUrl,
 *   stickerLoading,
 *   stickerLoadError,
 *   onStickerLoad,
 *   onStickerError,
 *   onStickerLoadStart
 * } = useMessageSticker(props)
 * ```
 */
export function useMessageSticker(props: Ref<MessageStickerProps>) {
  // ==================== State Management ====================

  /**
   * Current CDN URL index (for fallback mechanism)
   */
  const currentStickerUrlIndex = ref(0)

  /**
   * Whether sticker failed to load from all CDN sources
   */
  const stickerLoadError = ref(false)

  /**
   * Whether sticker is currently loading
   */
  const stickerLoading = ref(false)

  // ==================== Computed Properties ====================

  /**
   * Parsed sticker metadata from message
   *
   * Extracts packageId and stickerId from message.metadata
   * Handles both JSON string and object formats
   */
  const stickerMetadata = computed<StickerMetadata | null>(() => {
    // Debug logs for sticker metadata parsing
    console.log('🔍 [Sticker Debug] Message type:', props.value.message.messageType)
    console.log('🔍 [Sticker Debug] Message content:', props.value.message.content)
    console.log('🔍 [Sticker Debug] Raw metadata:', props.value.message.metadata)

    if (props.value.message.messageType !== 'sticker' || !props.value.message.metadata) {
      console.log('🔍 [Sticker Debug] Condition failed - messageType or metadata missing')
      return null
    }

    try {
      const metadata = typeof props.value.message.metadata === 'string'
        ? JSON.parse(props.value.message.metadata)
        : props.value.message.metadata

      console.log('🔍 [Sticker Debug] Parsed metadata:', metadata)

      const result: StickerMetadata = {
        packageId: metadata.packageId,
        stickerId: metadata.stickerId
      }

      console.log('🔍 [Sticker Debug] Final sticker metadata:', result)
      return result
    } catch (error) {
      console.error('❌ [Sticker Debug] Failed to parse sticker metadata:', error)
      return null
    }
  })

  /**
   * Array of all possible CDN URLs for the sticker
   *
   * Provides 4 different CDN sources in priority order:
   * 1. Android platform (primary)
   * 2. iPhone platform (fallback 1)
   * 3. iPad platform (fallback 2)
   * 4. Legacy format (final fallback)
   */
  const stickerUrls = computed<string[]>(() => {
    if (!stickerMetadata.value) {
      return []
    }

    return [
      // Format 1: Android 平台（主要）
      `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/android/sticker.png`,
      // Format 2: iPhone 平台（備用1）
      `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/iPhone/sticker.png`,
      // Format 3: iPad 平台（備用2）
      `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/iPad/sticker.png`,
      // Format 4: 舊版格式（最終回退）
      `http://dl.stickershop.line.naver.jp/products/0/0/1/${stickerMetadata.value.packageId}/android/sticker.png`
    ]
  })

  /**
   * Current sticker image URL based on fallback index
   *
   * Returns the URL at the current index in the CDN fallback chain
   */
  const stickerImageUrl = computed(() => {
    console.log('🔍 [Sticker Debug] Computing sticker image URL...')
    console.log('🔍 [Sticker Debug] stickerMetadata.value:', stickerMetadata.value)

    if (!stickerUrls.value.length) {
      console.log('🔍 [Sticker Debug] No sticker URLs available')
      return null
    }

    const currentUrl = stickerUrls.value[currentStickerUrlIndex.value]
    console.log('🔍 [Sticker Debug] Current URL index:', currentStickerUrlIndex.value)
    console.log('🔍 [Sticker Debug] Generated sticker URL:', currentUrl)
    console.log('🔍 [Sticker Debug] PackageId:', stickerMetadata.value?.packageId)
    console.log('🔍 [Sticker Debug] StickerId:', stickerMetadata.value?.stickerId)

    return currentUrl
  })

  // ==================== Event Handlers ====================

  /**
   * Handler for sticker image load start event
   *
   * Sets loading state to true and logs debug info
   */
  const onStickerLoadStart = () => {
    stickerLoading.value = true
    console.log('🔄 [Sticker Debug] Starting to load sticker...')
  }

  /**
   * Handler for sticker image load error
   *
   * Implements intelligent CDN fallback:
   * 1. Tries next CDN source if available
   * 2. Sets error state if all sources exhausted
   * 3. Logs detailed debug information
   */
  const onStickerError = () => {
    const currentUrl = stickerUrls.value[currentStickerUrlIndex.value]
    console.warn('❌ [Sticker Debug] Failed to load sticker from URL:', currentUrl)
    console.warn('❌ [Sticker Debug] Sticker ID:', stickerMetadata.value?.stickerId)

    // 嘗試下一個 CDN 源
    if (currentStickerUrlIndex.value < stickerUrls.value.length - 1) {
      currentStickerUrlIndex.value++
      console.log('🔄 [Sticker Debug] Trying fallback URL index:', currentStickerUrlIndex.value)
      console.log('🔄 [Sticker Debug] Next URL:', stickerUrls.value[currentStickerUrlIndex.value])

      // 重新觸發載入（透過重設 key 強制重新渲染）
      nextTick(() => {
        stickerLoading.value = true
      })
    } else {
      // 所有 URL 都失敗了
      console.error('💥 [Sticker Debug] All CDN sources failed for sticker:', stickerMetadata.value?.stickerId)
      stickerLoadError.value = true
      stickerLoading.value = false
    }
  }

  /**
   * Handler for successful sticker image load
   *
   * Clears error and loading states, logs success
   */
  const onStickerLoad = () => {
    console.log('✅ [Sticker Debug] Sticker loaded successfully from URL index:', currentStickerUrlIndex.value)
    console.log('✅ [Sticker Debug] Loaded URL:', stickerImageUrl.value)
    console.log('✅ [Sticker Debug] Sticker ID:', stickerMetadata.value?.stickerId)

    stickerLoadError.value = false
    stickerLoading.value = false
  }

  // ==================== Watchers ====================

  /**
   * Reset sticker state when metadata changes
   *
   * Ensures clean state when switching between different stickers
   */
  watch(
    () => stickerMetadata.value,
    () => {
      currentStickerUrlIndex.value = 0
      stickerLoadError.value = false
      stickerLoading.value = false
    }
  )

  // ==================== Return Public API ====================

  return {
    // Computed properties
    stickerMetadata,
    stickerUrls,
    stickerImageUrl,

    // State
    currentStickerUrlIndex,
    stickerLoadError,
    stickerLoading,

    // Event handlers
    onStickerLoadStart,
    onStickerError,
    onStickerLoad
  }
}
