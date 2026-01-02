/**
 * Tests for useMessageBubble composable (Main Controller)
 *
 * @module tests/unit/composables/useMessageBubble
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMessageBubble } from '@/composables/message/useMessageBubble'
import type { Message } from '@/types'

// Mock the message renderer utilities
vi.mock('@/utils/enhanced-message-renderer', () => ({
  renderDatabaseMessageForVue: vi.fn(async (content: string) => content)
}))

vi.mock('@/utils/layered-emoji-processor', () => ({
  convertEmojiForMessageDetail: vi.fn(async (content: string) => content)
}))

// Helper function to create a test message
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-id',
    conversationId: 'conv-1',
    content: 'Test message',
    senderType: 'customer',
    messageType: 'text',
    timestamp: new Date(),
    ...overrides
  } as Message
}

describe('useMessageBubble', () => {
  let mockEmit: any

  beforeEach(() => {
    mockEmit = {
      copy: vi.fn(),
      reply: vi.fn(),
      forward: vi.fn(),
      recall: vi.fn(),
      select: vi.fn(),
      retry: vi.fn(),
      preview: vi.fn(),
      'image-load': vi.fn(),
      'image-error': vi.fn()
    }
  })

  describe('Initialization', () => {
    it('should initialize all sub-composables correctly', () => {
      const props = ref({
        message: createMessage(),
        delivered: true,
        showSender: true
      })

      const result = useMessageBubble(props, mockEmit)

      // Verify all APIs are exposed
      expect(result.formatTime).toBeDefined()
      expect(result.attachmentUrl).toBeDefined()
      expect(result.copyMessage).toBeDefined()
      expect(result.stickerMetadata).toBeDefined()
      expect(result.processedMessageContent).toBeDefined()
      expect(result.isOutgoing).toBeDefined()
    })

    it('should provide all time formatting functions', () => {
      const props = ref({ message: createMessage() })
      const result = useMessageBubble(props, mockEmit)

      expect(result.formatTime).toBeTypeOf('function')
      expect(result.normalizeDate).toBeTypeOf('function')
      expect(result.isToday).toBeTypeOf('function')
      expect(result.formatTimeOnly).toBeTypeOf('function')
      expect(result.formatDateTime).toBeTypeOf('function')
    })

    it('should provide all attachment functions', () => {
      const props = ref({ message: createMessage() })
      const result = useMessageBubble(props, mockEmit)

      expect(result.downloadFile).toBeTypeOf('function')
      expect(result.downloadAttachment).toBeTypeOf('function')
      expect(result.isAttachmentPending).toBeTypeOf('function')
      expect(result.getAttachmentStatusClass).toBeTypeOf('function')
      expect(result.handleAttachmentPreview).toBeTypeOf('function')
    })

    it('should provide all action handlers', () => {
      const props = ref({ message: createMessage() })
      const result = useMessageBubble(props, mockEmit)

      expect(result.copyMessage).toBeTypeOf('function')
      expect(result.replyToMessage).toBeTypeOf('function')
      expect(result.forwardMessage).toBeTypeOf('function')
      expect(result.recallMessage).toBeTypeOf('function')
      expect(result.selectMessage).toBeTypeOf('function')
      expect(result.handleRetry).toBeTypeOf('function')
    })
  })

  describe('Sender information', () => {
    it('should identify outgoing messages from agent', () => {
      const props = ref({
        message: createMessage({
          senderType: 'agent'
        })
      })

      const { isOutgoing } = useMessageBubble(props, mockEmit)

      expect(isOutgoing.value).toBe(true)
    })

    it('should identify incoming messages from customer', () => {
      const props = ref({
        message: createMessage({
          senderType: 'customer'
        })
      })

      const { isOutgoing } = useMessageBubble(props, mockEmit)

      expect(isOutgoing.value).toBe(false)
    })

    it('should support direction field for test compatibility', () => {
      const props = ref({
        message: {
          ...createMessage(),
          direction: 'outgoing'
        } as any
      })

      const { isOutgoing } = useMessageBubble(props, mockEmit)

      expect(isOutgoing.value).toBe(true)
    })

    it('should provide correct sender name for customer', () => {
      const props = ref({
        message: createMessage({
          senderType: 'customer'
        })
      })

      const { senderName } = useMessageBubble(props, mockEmit)

      expect(senderName.value).toBe('客戶')
    })

    it('should provide correct sender name for agent', () => {
      const props = ref({
        message: createMessage({
          senderType: 'agent'
        })
      })

      const { senderName } = useMessageBubble(props, mockEmit)

      expect(senderName.value).toBe('客服')
    })

    it('should provide sender initials', () => {
      const props = ref({
        message: createMessage({
          senderType: 'customer'
        })
      })

      const { senderInitials } = useMessageBubble(props, mockEmit)

      expect(senderInitials.value).toBe('客')
    })
  })

  describe('Image preview functionality', () => {
    it('should initialize image preview state correctly', () => {
      const props = ref({ message: createMessage() })

      const {
        showImagePreview,
        zoomLevel,
        imageLoaded,
        imageError
      } = useMessageBubble(props, mockEmit)

      expect(showImagePreview.value).toBe(false)
      expect(zoomLevel.value).toBe(1)
      expect(imageLoaded.value).toBe(false)
      expect(imageError.value).toBe(false)
    })

    it('should open image preview for image messages', () => {
      const props = ref({
        message: createMessage({
          messageType: 'image'
        })
      })

      const { openImagePreview, showImagePreview, zoomLevel } = useMessageBubble(props, mockEmit)

      openImagePreview()

      expect(showImagePreview.value).toBe(true)
      expect(zoomLevel.value).toBe(1)
      expect(mockEmit.preview).toHaveBeenCalledWith(props.value.message)
    })

    it('should not open preview for non-image messages', () => {
      const props = ref({
        message: createMessage({
          messageType: 'text'
        })
      })

      const { openImagePreview, showImagePreview } = useMessageBubble(props, mockEmit)

      openImagePreview()

      expect(showImagePreview.value).toBe(false)
      expect(mockEmit.preview).not.toHaveBeenCalled()
    })

    it('should close image preview', () => {
      const props = ref({ message: createMessage() })

      const { openImagePreview, closeImagePreview, showImagePreview, zoomLevel } = useMessageBubble(props, mockEmit)

      // Open first
      props.value.message = createMessage({ messageType: 'image' })
      openImagePreview()
      expect(showImagePreview.value).toBe(true)

      // Close
      closeImagePreview()

      expect(showImagePreview.value).toBe(false)
      expect(zoomLevel.value).toBe(1)
    })

    it('should zoom in on preview', () => {
      const props = ref({ message: createMessage() })

      const { zoomIn, zoomLevel } = useMessageBubble(props, mockEmit)

      expect(zoomLevel.value).toBe(1)

      zoomIn()
      expect(zoomLevel.value).toBe(1.25)

      zoomIn()
      expect(zoomLevel.value).toBe(1.5)
    })

    it('should not zoom in beyond 3x', () => {
      const props = ref({ message: createMessage() })

      const { zoomIn, zoomLevel } = useMessageBubble(props, mockEmit)

      // Zoom to max
      zoomLevel.value = 3

      zoomIn()
      expect(zoomLevel.value).toBe(3)
    })

    it('should zoom out on preview', () => {
      const props = ref({ message: createMessage() })

      const { zoomOut, zoomLevel } = useMessageBubble(props, mockEmit)

      zoomLevel.value = 2

      zoomOut()
      expect(zoomLevel.value).toBe(1.75)

      zoomOut()
      expect(zoomLevel.value).toBe(1.5)
    })

    it('should not zoom out below 0.5x', () => {
      const props = ref({ message: createMessage() })

      const { zoomOut, zoomLevel } = useMessageBubble(props, mockEmit)

      zoomLevel.value = 0.5

      zoomOut()
      expect(zoomLevel.value).toBe(0.5)
    })

    it('should reset zoom to 100%', () => {
      const props = ref({ message: createMessage() })

      const { resetZoom, zoomLevel } = useMessageBubble(props, mockEmit)

      zoomLevel.value = 2.5

      resetZoom()
      expect(zoomLevel.value).toBe(1)
    })
  })

  describe('Image load event handlers', () => {
    it('should handle successful image load', () => {
      const props = ref({ message: createMessage() })

      const { onImageLoad, imageLoaded, imageError } = useMessageBubble(props, mockEmit)

      onImageLoad()

      expect(imageLoaded.value).toBe(true)
      expect(imageError.value).toBe(false)
      expect(mockEmit['image-load']).toHaveBeenCalledWith(props.value.message)
    })

    it('should handle image load error', () => {
      const props = ref({ message: createMessage() })

      const { onImageError, imageLoaded, imageError } = useMessageBubble(props, mockEmit)

      onImageError()

      expect(imageLoaded.value).toBe(false)
      expect(imageError.value).toBe(true)
      expect(mockEmit['image-error']).toHaveBeenCalledWith(props.value.message)
    })
  })

  describe('Integration with sub-composables', () => {
    it('should pass props correctly to attachment composable', () => {
      const props = ref({
        message: createMessage(),
        attachmentUrl: 'https://example.com/file.pdf',
        attachmentName: 'document.pdf',
        attachmentSize: 1024
      })

      const { attachmentUrl, attachmentName, attachmentSize } = useMessageBubble(props, mockEmit)

      expect(attachmentUrl.value).toBe('https://example.com/file.pdf')
      expect(attachmentName.value).toBe('document.pdf')
      expect(attachmentSize.value).toBe(1024)
    })

    it('should emit action events correctly', async () => {
      const props = ref({ message: createMessage() })

      const { copyMessage, replyToMessage, forwardMessage } = useMessageBubble(props, mockEmit)

      // Mock clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      await copyMessage()
      expect(mockEmit.copy).toHaveBeenCalledWith(props.value.message)

      replyToMessage()
      expect(mockEmit.reply).toHaveBeenCalledWith(props.value.message)

      forwardMessage()
      expect(mockEmit.forward).toHaveBeenCalledWith(props.value.message)
    })

    it('should handle attachment preview with custom emit', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [{
            id: '1',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            fileUrl: 'https://example.com/test.pdf'
          }]
        })
      })

      const { handleAttachmentPreview, fileAttachments } = useMessageBubble(props, mockEmit)

      handleAttachmentPreview(fileAttachments.value[0])

      expect(mockEmit.preview).toHaveBeenCalledWith(props.value.message)
    })
  })

  describe('Reactive updates', () => {
    it('should react to message changes', () => {
      const props = ref({
        message: createMessage({
          senderType: 'customer'
        })
      })

      const { senderName, isOutgoing } = useMessageBubble(props, mockEmit)

      expect(senderName.value).toBe('客戶')
      expect(isOutgoing.value).toBe(false)

      // Change sender
      props.value.message = createMessage({
        senderType: 'agent'
      })

      expect(senderName.value).toBe('客服')
      expect(isOutgoing.value).toBe(true)
    })

    it('should react to prop changes', () => {
      const props = ref({
        message: createMessage(),
        attachmentUrl: 'file1.pdf'
      })

      const { attachmentUrl } = useMessageBubble(props, mockEmit)

      expect(attachmentUrl.value).toBe('file1.pdf')

      props.value.attachmentUrl = 'file2.pdf'

      expect(attachmentUrl.value).toBe('file2.pdf')
    })
  })
})
