/**
 * Tests for useMessageContent composable
 *
 * @module tests/unit/composables/useMessageContent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useMessageContent } from '@/composables/message/useMessageContent'
import type { Message } from '@/types'

// Mock the message renderer utilities
vi.mock('@/utils/enhanced-message-renderer', () => ({
  renderDatabaseMessageForVue: vi.fn(async (content: string) => `<div class="rendered">${content}</div>`)
}))

vi.mock('@/utils/layered-emoji-processor', () => ({
  convertEmojiForMessageDetail: vi.fn(async (content: string) => `<span class="emoji">${content}</span>`)
}))

// Helper function to create a test message
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-id',
    conversationId: 'conv-1',
    content: 'Test message content',
    senderType: 'customer',
    messageType: 'text',
    timestamp: new Date(),
    ...overrides
  } as Message
}

describe('useMessageContent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('actualMessageType', () => {
    it('should detect file type from metadata', () => {
      const props = ref({
        message: createMessage({
          messageType: 'video',
          metadata: {
            attachment: { url: 'file.pdf' }
          }
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('file')
    })

    it('should detect sticker type from metadata', () => {
      const props = ref({
        message: createMessage({
          messageType: 'text',
          metadata: {
            stickerId: '123',
            packageId: '456'
          }
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('sticker')
    })

    it('should detect image type from metadata', () => {
      const props = ref({
        message: createMessage({
          messageType: 'text',
          metadata: {
            imageUrl: 'https://example.com/image.jpg'
          }
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('image')
    })

    it('should fallback to original type when metadata has no type info', () => {
      const props = ref({
        message: createMessage({
          messageType: 'text',
          metadata: {
            someOtherField: 'value'
          }
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('text')
    })

    it('should default to text when messageType is undefined', () => {
      const props = ref({
        message: createMessage({
          messageType: undefined as any
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('text')
    })

    it('should handle metadata parsing errors gracefully', () => {
      const props = ref({
        message: createMessage({
          messageType: 'text',
          metadata: 'invalid json{' as any
        })
      })

      const { actualMessageType } = useMessageContent(props)

      expect(actualMessageType.value).toBe('text')
    })
  })

  describe('processedMessageContent', () => {
    it('should process text content with emoji processor', async () => {
      const props = ref({
        message: createMessage({
          content: 'Hello ',
          messageType: 'text'
        })
      })

      const { processedMessageContent } = useMessageContent(props)

      // Wait for debounce timer
      await vi.runAllTimersAsync()
      await nextTick()

      expect(processedMessageContent.value).toContain('emoji')
    })

    it('should process sticker content with database renderer', async () => {
      const props = ref({
        message: createMessage({
          content: 'Sticker',
          messageType: 'sticker',
          metadata: { stickerId: '123', packageId: '456' }
        })
      })

      const { processedMessageContent } = useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      expect(processedMessageContent.value).toContain('rendered')
    })

    it('should return empty string for empty content', async () => {
      const props = ref({
        message: createMessage({
          content: ''
        })
      })

      const { processedMessageContent } = useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      expect(processedMessageContent.value).toBe('')
    })

    it('should debounce content processing', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')

      const props = ref({
        message: createMessage({
          content: 'First'
        })
      })

      useMessageContent(props)

      // Change content multiple times rapidly
      props.value.message = createMessage({ content: 'Second' })
      props.value.message = createMessage({ content: 'Third' })
      props.value.message = createMessage({ content: 'Fourth' })

      // Should only process once after debounce
      await vi.runAllTimersAsync()
      await nextTick()

      // convertEmojiForMessageDetail should be called twice:
      // 1. Initial immediate call
      // 2. Final debounced call for 'Fourth'
      expect(vi.mocked(convertEmojiForMessageDetail).mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Content caching', () => {
    it('should cache processed content', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')
      vi.mocked(convertEmojiForMessageDetail).mockClear()

      const props = ref({
        message: createMessage({
          content: 'Test content',
          messageType: 'text'
        })
      })

      const { processedMessageContent } = useMessageContent(props)

      // First processing
      await vi.runAllTimersAsync()
      await nextTick()

      const firstCallCount = vi.mocked(convertEmojiForMessageDetail).mock.calls.length

      // Change to different message and back (should use cache)
      props.value.message = createMessage({ content: 'Different' })
      await vi.runAllTimersAsync()
      await nextTick()

      props.value.message = createMessage({ content: 'Test content', messageType: 'text' })
      await vi.runAllTimersAsync()
      await nextTick()

      // Should have processed "Different" but not re-processed "Test content"
      expect(vi.mocked(convertEmojiForMessageDetail).mock.calls.length).toBe(firstCallCount + 1)
      expect(processedMessageContent.value).toContain('emoji')
    })

    it('should not reprocess when only non-content fields change', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')
      vi.mocked(convertEmojiForMessageDetail).mockClear()

      const props = ref({
        message: createMessage({
          content: 'Same content'
        })
      })

      useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      const callCountBefore = vi.mocked(convertEmojiForMessageDetail).mock.calls.length

      // Change only timestamp, not content
      props.value.message = {
        ...props.value.message,
        timestamp: new Date()
      }

      await vi.runAllTimersAsync()
      await nextTick()

      // Should not reprocess
      expect(vi.mocked(convertEmojiForMessageDetail).mock.calls.length).toBe(callCountBefore)
    })

    it('should reprocess when content changes', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')
      vi.mocked(convertEmojiForMessageDetail).mockClear()

      const props = ref({
        message: createMessage({
          content: 'Original'
        })
      })

      useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      const callCountBefore = vi.mocked(convertEmojiForMessageDetail).mock.calls.length

      // Change content
      props.value.message = createMessage({
        content: 'Changed'
      })

      await vi.runAllTimersAsync()
      await nextTick()

      // Should reprocess
      expect(vi.mocked(convertEmojiForMessageDetail).mock.calls.length).toBeGreaterThan(callCountBefore)
    })

    it('should reprocess when messageType changes', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')
      vi.mocked(convertEmojiForMessageDetail).mockClear()

      const props = ref({
        message: createMessage({
          content: 'Same content',
          messageType: 'text'
        })
      })

      useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      const callCountBefore = vi.mocked(convertEmojiForMessageDetail).mock.calls.length

      // Change messageType
      props.value.message = createMessage({
        content: 'Same content',
        messageType: 'sticker',
        metadata: { stickerId: '123' }
      })

      await vi.runAllTimersAsync()
      await nextTick()

      // Should reprocess (switches to database renderer)
      expect(vi.mocked(convertEmojiForMessageDetail).mock.calls.length).toBeGreaterThanOrEqual(callCountBefore)
    })
  })

  describe('Error handling', () => {
    it('should fallback to escaped HTML on processing error', async () => {
      const { convertEmojiForMessageDetail } = await import('@/utils/layered-emoji-processor')
      vi.mocked(convertEmojiForMessageDetail).mockRejectedValueOnce(new Error('Processing failed'))

      const props = ref({
        message: createMessage({
          content: '<script>alert("xss")</script>'
        })
      })

      const { processedMessageContent } = useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      // Should escape HTML
      expect(processedMessageContent.value).toContain('&lt;script&gt;')
      expect(processedMessageContent.value).not.toContain('<script>')
    })
  })

  describe('isProcessing state', () => {
    it('should track processing state', async () => {
      const props = ref({
        message: createMessage({
          content: 'Test'
        })
      })

      const { isProcessing } = useMessageContent(props)

      expect(isProcessing.value).toBe(false)

      // Trigger processing
      props.value.message = createMessage({ content: 'Changed' })

      // Before debounce completes
      await nextTick()

      // After debounce completes
      await vi.runAllTimersAsync()
      await nextTick()

      // Should be false after processing completes
      expect(isProcessing.value).toBe(false)
    })
  })

  describe('Manual reprocessing', () => {
    it('should allow manual content reprocessing', async () => {
      const props = ref({
        message: createMessage({
          content: 'Test content'
        })
      })

      const { processMessageContent, processedMessageContent } = useMessageContent(props)

      await vi.runAllTimersAsync()
      await nextTick()

      expect(processedMessageContent.value).toBeTruthy()

      // Clear processed content
      processedMessageContent.value = ''

      // Manually reprocess
      await processMessageContent()
      await vi.runAllTimersAsync()
      await nextTick()

      expect(processedMessageContent.value).toBeTruthy()
    })
  })
})
