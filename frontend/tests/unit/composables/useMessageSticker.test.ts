/**
 * Tests for useMessageSticker composable
 *
 * @module tests/unit/composables/useMessageSticker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useMessageSticker } from '@/composables/message/useMessageSticker'
import type { Message } from '@/types'

// Helper function to create a sticker message
function createStickerMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'sticker-1',
    conversationId: 'conv-1',
    content: 'Sticker',
    senderType: 'customer',
    messageType: 'sticker',
    timestamp: new Date(),
    metadata: {
      packageId: '11537',
      stickerId: '52002734'
    },
    ...overrides
  } as Message
}

describe('useMessageSticker', () => {
  describe('stickerMetadata', () => {
    it('should parse sticker metadata from object', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { stickerMetadata } = useMessageSticker(props)

      expect(stickerMetadata.value).toEqual({
        packageId: '11537',
        stickerId: '52002734'
      })
    })

    it('should parse sticker metadata from JSON string', () => {
      const props = ref({
        message: createStickerMessage({
          metadata: JSON.stringify({
            packageId: '11537',
            stickerId: '52002734'
          })
        })
      })

      const { stickerMetadata } = useMessageSticker(props)

      expect(stickerMetadata.value).toEqual({
        packageId: '11537',
        stickerId: '52002734'
      })
    })

    it('should return null for non-sticker messages', () => {
      const props = ref({
        message: createStickerMessage({
          messageType: 'text'
        })
      })

      const { stickerMetadata } = useMessageSticker(props)

      expect(stickerMetadata.value).toBeNull()
    })

    it('should return null when metadata is missing', () => {
      const props = ref({
        message: createStickerMessage({
          metadata: undefined
        })
      })

      const { stickerMetadata } = useMessageSticker(props)

      expect(stickerMetadata.value).toBeNull()
    })

    it('should handle invalid JSON metadata gracefully', () => {
      const props = ref({
        message: createStickerMessage({
          metadata: 'invalid json{' as any
        })
      })

      const { stickerMetadata } = useMessageSticker(props)

      expect(stickerMetadata.value).toBeNull()
    })
  })

  describe('stickerUrls', () => {
    it('should generate all 4 CDN URLs', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { stickerUrls } = useMessageSticker(props)

      expect(stickerUrls.value).toHaveLength(4)
      expect(stickerUrls.value[0]).toContain('android/sticker.png')
      expect(stickerUrls.value[1]).toContain('iPhone/sticker.png')
      expect(stickerUrls.value[2]).toContain('iPad/sticker.png')
      expect(stickerUrls.value[3]).toContain('line.naver.jp')
    })

    it('should use correct stickerId in URLs', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { stickerUrls } = useMessageSticker(props)

      // First 3 URLs use stickerId
      expect(stickerUrls.value[0]).toContain('52002734')
      expect(stickerUrls.value[1]).toContain('52002734')
      expect(stickerUrls.value[2]).toContain('52002734')

      // Last URL (legacy format) uses packageId
      expect(stickerUrls.value[3]).toContain('11537')
    })

    it('should return empty array when no metadata', () => {
      const props = ref({
        message: createStickerMessage({
          metadata: undefined
        })
      })

      const { stickerUrls } = useMessageSticker(props)

      expect(stickerUrls.value).toEqual([])
    })
  })

  describe('stickerImageUrl', () => {
    it('should return first URL by default', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { stickerImageUrl, stickerUrls } = useMessageSticker(props)

      expect(stickerImageUrl.value).toBe(stickerUrls.value[0])
    })

    it('should return null when no URLs available', () => {
      const props = ref({
        message: createStickerMessage({
          metadata: undefined
        })
      })

      const { stickerImageUrl } = useMessageSticker(props)

      expect(stickerImageUrl.value).toBeNull()
    })
  })

  describe('Loading states', () => {
    it('should initialize with correct default states', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { stickerLoading, stickerLoadError, currentStickerUrlIndex } = useMessageSticker(props)

      expect(stickerLoading.value).toBe(false)
      expect(stickerLoadError.value).toBe(false)
      expect(currentStickerUrlIndex.value).toBe(0)
    })
  })

  describe('Event handlers', () => {
    beforeEach(() => {
      // Clear console mocks
      vi.clearAllMocks()
    })

    it('should set loading state on load start', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { onStickerLoadStart, stickerLoading } = useMessageSticker(props)

      expect(stickerLoading.value).toBe(false)
      onStickerLoadStart()
      expect(stickerLoading.value).toBe(true)
    })

    it('should clear loading and error states on successful load', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { onStickerLoad, stickerLoading, stickerLoadError } = useMessageSticker(props)

      stickerLoading.value = true
      stickerLoadError.value = true

      onStickerLoad()

      expect(stickerLoading.value).toBe(false)
      expect(stickerLoadError.value).toBe(false)
    })

    it('should fallback to next URL on error', async () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { onStickerError, currentStickerUrlIndex, stickerLoading } = useMessageSticker(props)

      expect(currentStickerUrlIndex.value).toBe(0)

      onStickerError()

      expect(currentStickerUrlIndex.value).toBe(1)

      await nextTick()
      expect(stickerLoading.value).toBe(true)
    })

    it('should set error state when all CDN sources fail', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { onStickerError, currentStickerUrlIndex, stickerLoadError, stickerLoading } = useMessageSticker(props)

      // Fail all 4 CDN sources
      onStickerError() // 0 -> 1
      onStickerError() // 1 -> 2
      onStickerError() // 2 -> 3
      onStickerError() // 3 -> error state

      expect(currentStickerUrlIndex.value).toBe(3)
      expect(stickerLoadError.value).toBe(true)
      expect(stickerLoading.value).toBe(false)
    })
  })

  describe('Metadata change watcher', () => {
    it('should reset state when metadata changes', async () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { currentStickerUrlIndex, stickerLoadError, stickerLoading, onStickerError } = useMessageSticker(props)

      // Simulate some error states
      onStickerError()
      onStickerError()

      expect(currentStickerUrlIndex.value).toBe(2)

      // Change metadata
      props.value.message = createStickerMessage({
        metadata: {
          packageId: '99999',
          stickerId: '88888888'
        }
      })

      await nextTick()

      // State should be reset
      expect(currentStickerUrlIndex.value).toBe(0)
      expect(stickerLoadError.value).toBe(false)
      expect(stickerLoading.value).toBe(false)
    })

    it('should reset state when message object reference changes', async () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { currentStickerUrlIndex, onStickerError } = useMessageSticker(props)

      // Simulate error state
      onStickerError()
      expect(currentStickerUrlIndex.value).toBe(1)

      // Change message object reference (even with same metadata values)
      // This is expected behavior - watch reacts to object reference changes
      props.value.message = {
        ...props.value.message,
        content: 'Different sticker text'
      }

      await nextTick()

      // State should be reset because message object changed
      expect(currentStickerUrlIndex.value).toBe(0)
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete load-error-retry cycle', async () => {
      const props = ref({
        message: createStickerMessage()
      })

      const {
        stickerImageUrl,
        stickerUrls,
        currentStickerUrlIndex,
        stickerLoading,
        stickerLoadError,
        onStickerLoadStart,
        onStickerError,
        onStickerLoad
      } = useMessageSticker(props)

      // Initial state
      expect(stickerImageUrl.value).toBe(stickerUrls.value[0])
      expect(currentStickerUrlIndex.value).toBe(0)

      // Start loading
      onStickerLoadStart()
      expect(stickerLoading.value).toBe(true)

      // First CDN fails
      onStickerError()
      expect(currentStickerUrlIndex.value).toBe(1)
      expect(stickerImageUrl.value).toBe(stickerUrls.value[1])

      await nextTick()
      expect(stickerLoading.value).toBe(true)

      // Second CDN succeeds
      onStickerLoad()
      expect(stickerLoading.value).toBe(false)
      expect(stickerLoadError.value).toBe(false)
    })

    it('should provide correct CDN source indicator', () => {
      const props = ref({
        message: createStickerMessage()
      })

      const { currentStickerUrlIndex, onStickerError } = useMessageSticker(props)

      expect(currentStickerUrlIndex.value).toBe(0) // Android CDN

      onStickerError()
      expect(currentStickerUrlIndex.value).toBe(1) // iPhone CDN

      onStickerError()
      expect(currentStickerUrlIndex.value).toBe(2) // iPad CDN

      onStickerError()
      expect(currentStickerUrlIndex.value).toBe(3) // Legacy CDN
    })
  })
})
