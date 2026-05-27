/**
 * Tests for useMessageAttachment composable
 *
 * @module tests/unit/composables/useMessageAttachment
 */

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMessageAttachment } from '@/composables/message/useMessageAttachment'
import type { Message } from '@/types'
import { MESSAGE_STATUS } from '@/constants/message-status'

// Helper function to create a test message
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-id',
    conversationId: 'conv-1',
    content: 'Test message',
    senderType: 'customer',
    timestamp: new Date(),
    ...overrides
  } as Message
}

describe('useMessageAttachment', () => {
  describe('attachmentUrl', () => {
    it('should use prop override if provided', () => {
      const props = ref({
        message: createMessage(),
        attachmentUrl: 'https://example.com/file.pdf'
      })

      const { attachmentUrl } = useMessageAttachment(props)
      expect(attachmentUrl.value).toBe('https://example.com/file.pdf')
    })

    it('should extract URL from metadata', () => {
      const props = ref({
        message: createMessage({
          metadata: {
            attachment: {
              url: 'https://example.com/metadata-file.pdf'
            }
          }
        })
      })

      const { attachmentUrl } = useMessageAttachment(props)
      expect(attachmentUrl.value).toBe('https://example.com/metadata-file.pdf')
    })

    it('should extract URL from content', () => {
      const props = ref({
        message: createMessage({
          content: 'Check out this file: https://example.com/content-file.pdf'
        })
      })

      const { attachmentUrl } = useMessageAttachment(props)
      expect(attachmentUrl.value).toBe('https://example.com/content-file.pdf')
    })

    it('should return null if no URL found', () => {
      const props = ref({
        message: createMessage({
          content: 'No URL here'
        })
      })

      const { attachmentUrl } = useMessageAttachment(props)
      expect(attachmentUrl.value).toBeNull()
    })
  })

  describe('attachmentName', () => {
    it('should use prop override if provided', () => {
      const props = ref({
        message: createMessage(),
        attachmentName: 'override.pdf'
      })

      const { attachmentName } = useMessageAttachment(props)
      expect(attachmentName.value).toBe('override.pdf')
    })

    it('should extract name from metadata', () => {
      const props = ref({
        message: createMessage({
          metadata: {
            attachment: {
              name: 'metadata-file.pdf'
            }
          }
        })
      })

      const { attachmentName } = useMessageAttachment(props)
      expect(attachmentName.value).toBe('metadata-file.pdf')
    })

    it('should extract name from content pattern', () => {
      const props = ref({
        message: createMessage({
          content: '[檔案] important-document.pdf'
        })
      })

      const { attachmentName } = useMessageAttachment(props)
      expect(attachmentName.value).toBe('important-document.pdf')
    })

    it('should return default name if not found', () => {
      const props = ref({
        message: createMessage({
          content: 'No file name here'
        })
      })

      const { attachmentName } = useMessageAttachment(props)
      expect(attachmentName.value).toBe('附件')
    })
  })

  describe('attachmentSize', () => {
    it('should use prop override if provided', () => {
      const props = ref({
        message: createMessage(),
        attachmentSize: 1024
      })

      const { attachmentSize } = useMessageAttachment(props)
      expect(attachmentSize.value).toBe(1024)
    })

    it('should extract size from metadata', () => {
      const props = ref({
        message: createMessage({
          metadata: {
            attachment: {
              size: 2048
            }
          }
        })
      })

      const { attachmentSize } = useMessageAttachment(props)
      expect(attachmentSize.value).toBe(2048)
    })
  })

  describe('fileAttachments', () => {
    it('should return confirmed file_attachments', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'file1.pdf',
              mimeType: 'application/pdf',
              fileSize: 1024,
              fileUrl: 'https://example.com/file1.pdf'
            }
          ]
        })
      })

      const { fileAttachments } = useMessageAttachment(props)
      expect(fileAttachments.value).toHaveLength(1)
      expect(fileAttachments.value[0].filename).toBe('file1.pdf')
    })

    it('should return pending attachments for optimistic UI', () => {
      const props = ref({
        message: createMessage({
          metadata: {
            pendingAttachments: [
              {
                name: 'uploading.pdf',
                size: 1024,
                blobUrl: 'blob:http://localhost/123',
                isImage: false,
                fileType: 'application/pdf',
                typeColor: 'blue'
              }
            ]
          }
        })
      })

      const { fileAttachments } = useMessageAttachment(props)
      expect(fileAttachments.value).toHaveLength(1)
      expect(fileAttachments.value[0].filename).toBe('uploading.pdf')
      expect(fileAttachments.value[0].isPending).toBe(true)
      expect(fileAttachments.value[0].id).toContain('pending-')
    })

    it('should prioritize confirmed attachments over pending', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'confirmed.pdf',
              mimeType: 'application/pdf',
              fileSize: 1024,
              fileUrl: 'https://example.com/file.pdf'
            }
          ],
          metadata: {
            pendingAttachments: [
              {
                name: 'pending.pdf',
                size: 1024,
                blobUrl: 'blob:http://localhost/123',
                isImage: false,
                fileType: 'application/pdf',
                typeColor: 'blue'
              }
            ]
          }
        })
      })

      const { fileAttachments } = useMessageAttachment(props)
      expect(fileAttachments.value).toHaveLength(1)
      expect(fileAttachments.value[0].filename).toBe('confirmed.pdf')
    })

    it('should return empty array if no attachments', () => {
      const props = ref({
        message: createMessage()
      })

      const { fileAttachments } = useMessageAttachment(props)
      expect(fileAttachments.value).toEqual([])
    })
  })

  describe('imageAttachments', () => {
    it('should filter image attachments', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'photo.jpg',
              mimeType: 'image/jpeg',
              fileSize: 1024,
              fileUrl: 'https://example.com/photo.jpg'
            },
            {
              id: '2',
              filename: 'document.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              fileUrl: 'https://example.com/doc.pdf'
            }
          ]
        })
      })

      const { imageAttachments } = useMessageAttachment(props)
      expect(imageAttachments.value).toHaveLength(1)
      expect(imageAttachments.value[0].filename).toBe('photo.jpg')
    })
  })

  describe('nonImageAttachments', () => {
    it('should filter non-image attachments', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'photo.jpg',
              mimeType: 'image/jpeg',
              fileSize: 1024,
              fileUrl: 'https://example.com/photo.jpg'
            },
            {
              id: '2',
              filename: 'document.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              fileUrl: 'https://example.com/doc.pdf'
            }
          ]
        })
      })

      const { nonImageAttachments } = useMessageAttachment(props)
      expect(nonImageAttachments.value).toHaveLength(1)
      expect(nonImageAttachments.value[0].filename).toBe('document.pdf')
    })
  })

  describe('hasMultipleAttachments', () => {
    it('should return true for multiple attachments', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'file1.pdf',
              mimeType: 'application/pdf',
              fileSize: 1024,
              fileUrl: 'https://example.com/file1.pdf'
            },
            {
              id: '2',
              filename: 'file2.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              fileUrl: 'https://example.com/file2.pdf'
            }
          ]
        })
      })

      const { hasMultipleAttachments } = useMessageAttachment(props)
      expect(hasMultipleAttachments.value).toBe(true)
    })

    it('should return false for single attachment', () => {
      const props = ref({
        message: createMessage({
          file_attachments: [
            {
              id: '1',
              filename: 'file.pdf',
              mimeType: 'application/pdf',
              fileSize: 1024,
              fileUrl: 'https://example.com/file.pdf'
            }
          ]
        })
      })

      const { hasMultipleAttachments } = useMessageAttachment(props)
      expect(hasMultipleAttachments.value).toBe(false)
    })
  })

  describe('isFileOnlyContent', () => {
    it('should detect Chinese file pattern', () => {
      const props = ref({
        message: createMessage({
          content: '[檔案] document.pdf'
        })
      })

      const { isFileOnlyContent } = useMessageAttachment(props)
      expect(isFileOnlyContent.value).toBe(true)
    })

    it('should detect English file pattern', () => {
      const props = ref({
        message: createMessage({
          content: 'Sent a file: document.pdf'
        })
      })

      const { isFileOnlyContent } = useMessageAttachment(props)
      expect(isFileOnlyContent.value).toBe(true)
    })

    it('should detect multiple files pattern', () => {
      const props = ref({
        message: createMessage({
          content: 'Sent 3 files'
        })
      })

      const { isFileOnlyContent } = useMessageAttachment(props)
      expect(isFileOnlyContent.value).toBe(true)
    })

    it('should return false for regular text', () => {
      const props = ref({
        message: createMessage({
          content: 'This is a regular message'
        })
      })

      const { isFileOnlyContent } = useMessageAttachment(props)
      expect(isFileOnlyContent.value).toBe(false)
    })
  })

  describe('messageStatus', () => {
    it('should use message.status if available', () => {
      const props = ref({
        message: createMessage({
          status: MESSAGE_STATUS.SENT
        })
      })

      const { messageStatus } = useMessageAttachment(props)
      expect(messageStatus.value).toBe(MESSAGE_STATUS.SENT)
    })

    it('should fallback to deliveryStatus', () => {
      const props = ref({
        message: createMessage({
          deliveryStatus: MESSAGE_STATUS.DELIVERED
        })
      })

      const { messageStatus } = useMessageAttachment(props)
      expect(messageStatus.value).toBe(MESSAGE_STATUS.DELIVERED)
    })

    it('should default to SENT', () => {
      const props = ref({
        message: createMessage()
      })

      const { messageStatus } = useMessageAttachment(props)
      expect(messageStatus.value).toBe(MESSAGE_STATUS.SENT)
    })
  })

  describe('isAttachmentPending', () => {
    it('should detect pending by isPending flag', () => {
      const props = ref({
        message: createMessage()
      })

      const { isAttachmentPending } = useMessageAttachment(props)
      expect(isAttachmentPending({ isPending: true })).toBe(true)
    })

    it('should detect pending by ID prefix', () => {
      const props = ref({
        message: createMessage()
      })

      const { isAttachmentPending } = useMessageAttachment(props)
      expect(isAttachmentPending({ id: 'pending-123' })).toBe(true)
    })

    it('should detect pending by message status', () => {
      const props = ref({
        message: createMessage({
          status: 'sending'
        })
      })

      const { isAttachmentPending } = useMessageAttachment(props)
      expect(isAttachmentPending({})).toBe(true)
    })
  })

  describe('getAttachmentStatusClass', () => {
    it('should return pending class', () => {
      const props = ref({
        message: createMessage()
      })

      const { getAttachmentStatusClass } = useMessageAttachment(props)
      expect(getAttachmentStatusClass({ isPending: true })).toBe('status-pending')
    })

    it('should return failed class', () => {
      const props = ref({
        message: createMessage({
          status: MESSAGE_STATUS.FAILED
        })
      })

      const { getAttachmentStatusClass } = useMessageAttachment(props)
      expect(getAttachmentStatusClass({})).toBe('status-failed')
    })

    it('should return success class', () => {
      const props = ref({
        message: createMessage({
          status: MESSAGE_STATUS.SENT
        })
      })

      const { getAttachmentStatusClass } = useMessageAttachment(props)
      expect(getAttachmentStatusClass({})).toBe('status-success')
    })
  })

  describe('downloadFile', () => {
    it('should create download link and trigger click', () => {
      const props = ref({
        message: createMessage(),
        attachmentUrl: 'https://example.com/file.pdf',
        attachmentName: 'document.pdf'
      })

      const { downloadFile } = useMessageAttachment(props)

      // Mock document methods
      const createElement = vi.spyOn(document, 'createElement')
      const appendChild = vi.spyOn(document.body, 'appendChild')
      const removeChild = vi.spyOn(document.body, 'removeChild')

      const mockLink = {
        href: '',
        download: '',
        target: '',
        click: vi.fn()
      } as any

      createElement.mockReturnValue(mockLink)
      appendChild.mockImplementation(() => mockLink)
      removeChild.mockImplementation(() => mockLink)

      downloadFile()

      expect(mockLink.href).toBe('https://example.com/file.pdf')
      expect(mockLink.download).toBe('document.pdf')
      expect(mockLink.target).toBe('_blank')
      expect(mockLink.click).toHaveBeenCalled()

      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })

  describe('downloadAttachment', () => {
    it('should download specific attachment', () => {
      const props = ref({
        message: createMessage()
      })

      const { downloadAttachment } = useMessageAttachment(props)

      const createElement = vi.spyOn(document, 'createElement')
      const appendChild = vi.spyOn(document.body, 'appendChild')
      const removeChild = vi.spyOn(document.body, 'removeChild')

      const mockLink = {
        href: '',
        download: '',
        target: '',
        click: vi.fn()
      } as any

      createElement.mockReturnValue(mockLink)
      appendChild.mockImplementation(() => mockLink)
      removeChild.mockImplementation(() => mockLink)

      downloadAttachment({
        fileUrl: 'https://example.com/specific.pdf',
        filename: 'specific.pdf'
      })

      expect(mockLink.href).toBe('https://example.com/specific.pdf')
      expect(mockLink.download).toBe('specific.pdf')
      expect(mockLink.click).toHaveBeenCalled()

      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })

    it('should fallback to attachment id when fileUrl is missing', () => {
      const props = ref({
        message: createMessage()
      })

      const { downloadAttachment } = useMessageAttachment(props)

      const createElement = vi.spyOn(document, 'createElement')
      const appendChild = vi.spyOn(document.body, 'appendChild')
      const removeChild = vi.spyOn(document.body, 'removeChild')

      const mockLink = {
        href: '',
        download: '',
        target: '',
        click: vi.fn()
      } as any

      createElement.mockReturnValue(mockLink)
      appendChild.mockImplementation(() => mockLink)
      removeChild.mockImplementation(() => mockLink)

      downloadAttachment({
        id: 'att-123',
        filename: 'specific.pdf'
      })

      expect(mockLink.href).toBe('/api/files/download/att-123')
      expect(mockLink.download).toBe('specific.pdf')
      expect(mockLink.click).toHaveBeenCalled()

      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })
})
