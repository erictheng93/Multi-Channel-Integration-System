/**
 * MessageBubble.vue Unit Tests
 *
 * Tests:
 * - Basic rendering for text, image, and file message types
 * - Customer vs agent message alignment/styling (incoming vs outgoing)
 * - System message rendering
 * - Timestamp display
 * - Sender info display
 * - Message status indicators (sending, delivered, failed)
 * - Action buttons (copy, reply, forward, recall)
 * - Upload progress display
 * - Props validation and defaults
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import type { Message } from '@/types'

// ============================================================================
// Mocks
// ============================================================================

// Mock composables/message
vi.mock('@/composables/message', () => {
  const { ref, computed } = require('vue')

  return {
    useMessageTime: () => ({
      formatTime: (ts: unknown) => {
        if (!ts) {return ''}
        const d = new Date(typeof ts === 'number' ? ts : String(ts))
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      },
    }),
    useMessageAttachment: (props: { value: { message: Message } }) => ({
      fileAttachments: computed(() => []),
      imageAttachments: computed(() => []),
      videoAttachments: computed(() => []),
      documentAttachments: computed(() => []),
      hasMultipleAttachments: computed(() => false),
      isFileOnlyContent: computed(() => false),
      messageStatus: computed(() => props.value?.message?.deliveryStatus || 'sent'),
      downloadFile: vi.fn(),
      downloadAttachment: vi.fn(),
      handleAttachmentPreview: vi.fn(),
      isAttachmentPending: vi.fn(() => false),
      getAttachmentStatusClass: vi.fn(() => ''),
    }),
    useMessageActions: (
      _props: unknown,
      emitters: Record<string, (..._args: unknown[]) => void>,
    ) => ({
      showActions: ref(false),
      showActionsMenu: ref(false),
      handleRightClick: vi.fn(),
      toggleActionsMenu: vi.fn(),
      copyMessage: vi.fn(() => emitters.copy?.({} as Message)),
      replyToMessage: vi.fn(() => emitters.reply?.({} as Message)),
      forwardMessage: vi.fn(() => emitters.forward?.({} as Message)),
      recallMessage: vi.fn(() => emitters.recall?.({} as Message)),
      selectMessage: vi.fn(() => emitters.select?.({} as Message)),
      handleRetry: vi.fn(() => emitters.retry?.('msg-1')),
    }),
    useMessageSticker: () => ({
      stickerMetadata: ref(null),
      stickerUrls: ref([]),
      stickerImageUrl: ref(null),
      currentStickerUrlIndex: ref(0),
      stickerLoadError: ref(false),
      stickerLoading: ref(false),
      onStickerLoadStart: vi.fn(),
      onStickerError: vi.fn(),
      onStickerLoad: vi.fn(),
    }),
    useMessageContent: (props: { value: { message: Message } }) => ({
      processedMessageContent: computed(
        () => props.value?.message?.content || '',
      ),
      actualMessageType: computed(
        () => props.value?.message?.messageType || 'text',
      ),
    }),
    useVideoPlayer: () => ({
      showVideoPreview: ref(false),
      previewVideoAttachment: ref(null),
      openVideoPreview: vi.fn(),
      closeVideoPreview: vi.fn(),
    }),
  }
})

// Mock utilities
vi.mock('@/utils/message', () => ({
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) {return `${bytes} B`}
    return `${(bytes / 1024).toFixed(1)} KB`
  },
  getFileExtension: (filename: string) => {
    const ext = filename.split('.').pop()
    return ext ? `.${ext.toUpperCase()}` : ''
  },
  getFileTypeClass: () => 'file-type-default',
  isImageFile: () => false,
}))

// Mock sub-components
vi.mock('@/components/ui/SafeHtmlRenderer.vue', () => ({
  default: {
    name: 'SafeHtmlRenderer',
    props: ['html'],
    template: '<div class="safe-html" v-html="html"></div>',
  },
}))

vi.mock('@/components/file/FileAttachmentCard.vue', () => ({
  default: {
    name: 'FileAttachmentCard',
    props: ['attachment', 'compact'],
    template: '<div class="file-attachment-card">{{ attachment?.filename }}</div>',
  },
}))

vi.mock('@/components/media/VideoPlayer.vue', () => ({
  default: {
    name: 'VideoPlayer',
    props: ['attachment', 'messageStatus', 'showStatus'],
    template: '<div class="video-player"></div>',
  },
}))

vi.mock('@/components/media/VideoPreviewModal.vue', () => ({
  default: {
    name: 'VideoPreviewModal',
    props: ['show', 'attachment', 'downloadAttachment'],
    template: '<div class="video-preview-modal" v-if="show"></div>',
  },
}))

vi.mock('@/components/conversation/support/ImagePreviewModal.vue', () => ({
  default: {
    name: 'ImagePreviewModal',
    props: ['show', 'imageUrl', 'imageName', 'imageSize'],
    template: '<div class="image-preview-modal" v-if="show"></div>',
  },
}))

// Mock icon components
vi.mock('@/components/icons', () => ({
  CheckIcon: { template: '<svg class="check-icon" />' },
  XIcon: { template: '<svg class="x-icon" />' },
  SearchIcon: { template: '<svg class="search-icon" />' },
  DownloadIcon: { template: '<svg class="download-icon" />' },
  FileIcon: { template: '<svg class="file-icon" />' },
  ImageIcon: { template: '<svg class="image-icon" />' },
  CopyIcon: { template: '<svg class="copy-icon" />' },
  ReplyIcon: { template: '<svg class="reply-icon" />' },
  MoreVerticalIcon: { template: '<svg class="more-icon" />' },
  ForwardIcon: { template: '<svg class="forward-icon" />' },
  TrashIcon: { template: '<svg class="trash-icon" />' },
}))

// ============================================================================
// Helpers
// ============================================================================

const NOW = new Date('2026-03-06T10:30:00Z')

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderType: 'customer',
    senderId: 'user-1',
    content: 'Hello, world!',
    messageType: 'text',
    platform: 'line',
    timestamp: NOW.getTime(),
    createdAt: NOW.toISOString(),
    ...overrides,
  } as Message
}

function mountBubble(
  messageOverrides: Partial<Message> = {},
  propsOverrides: Record<string, unknown> = {},
) {
  return mount(MessageBubble, {
    props: {
      message: createMessage(messageOverrides),
      ...propsOverrides,
    },
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('MessageBubble.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Basic Rendering
  // --------------------------------------------------------------------------

  describe('Basic rendering', () => {
    it('renders the root element with message-bubble class', () => {
      const wrapper = mountBubble()
      expect(wrapper.classes()).toContain('message-bubble')
    })

    it('renders text message content via SafeHtmlRenderer', () => {
      const wrapper = mountBubble({ content: 'Test message content' })
      const renderer = wrapper.find('.safe-html.message-text')
      expect(renderer.exists()).toBe(true)
      expect(renderer.html()).toContain('Test message content')
    })

    it('renders image message when type is image and attachmentUrl is provided', () => {
      const wrapper = mountBubble(
        { messageType: 'image', content: '' },
        { attachmentUrl: 'https://example.com/image.png', attachmentName: 'photo.png' },
      )
      const media = wrapper.find('.message-media')
      expect(media.exists()).toBe(true)
      const img = wrapper.find('img.message-image-content')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://example.com/image.png')
    })

    it('renders file message when type is file and attachmentUrl is provided', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/doc.pdf',
          attachmentName: 'doc.pdf',
          attachmentSize: 2048,
        },
      )
      const fileContent = wrapper.find('.message-file-content')
      expect(fileContent.exists()).toBe(true)
      expect(wrapper.find('.file-name').text()).toBe('doc.pdf')
    })

    it('displays file size formatted correctly for file messages', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/doc.pdf',
          attachmentName: 'doc.pdf',
          attachmentSize: 2048,
        },
      )
      const sizeEl = wrapper.find('.file-size')
      expect(sizeEl.exists()).toBe(true)
      expect(sizeEl.text()).toBe('2.0 KB')
    })

    it('displays file extension for file messages', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/doc.pdf',
          attachmentName: 'report.pdf',
          attachmentSize: 1024,
        },
      )
      const typeEl = wrapper.find('.file-type')
      expect(typeEl.exists()).toBe(true)
      expect(typeEl.text()).toBe('.PDF')
    })
  })

  // --------------------------------------------------------------------------
  // Incoming vs Outgoing (Customer vs Agent)
  // --------------------------------------------------------------------------

  describe('Incoming vs Outgoing messages', () => {
    it('applies message-incoming class for customer messages', () => {
      const wrapper = mountBubble({ senderType: 'customer' })
      expect(wrapper.classes()).toContain('message-incoming')
      expect(wrapper.classes()).not.toContain('message-outgoing')
    })

    it('applies message-outgoing class for agent messages', () => {
      const wrapper = mountBubble({ senderType: 'agent' })
      expect(wrapper.classes()).toContain('message-outgoing')
      expect(wrapper.classes()).not.toContain('message-incoming')
    })

    it('applies message-delivered class for delivered outgoing messages', () => {
      const wrapper = mountBubble({ senderType: 'agent' }, { delivered: true })
      expect(wrapper.classes()).toContain('message-delivered')
    })

    it('applies message-failed class for non-delivered outgoing messages', () => {
      const wrapper = mountBubble({ senderType: 'agent' }, { delivered: false })
      expect(wrapper.classes()).toContain('message-failed')
    })

    it('does not apply delivered/failed classes for incoming messages', () => {
      const wrapper = mountBubble({ senderType: 'customer' }, { delivered: false })
      // incoming messages should not have message-failed
      expect(wrapper.classes()).not.toContain('message-failed')
      expect(wrapper.classes()).not.toContain('message-delivered')
    })
  })

  // --------------------------------------------------------------------------
  // System Messages
  // --------------------------------------------------------------------------

  describe('System messages', () => {
    it('renders system message as incoming (not outgoing)', () => {
      const wrapper = mountBubble({ senderType: 'system', content: 'System notification' })
      expect(wrapper.classes()).toContain('message-incoming')
      expect(wrapper.classes()).not.toContain('message-outgoing')
    })

    it('displays system message content', () => {
      const wrapper = mountBubble({ senderType: 'system', content: 'Conversation assigned' })
      expect(wrapper.text()).toContain('Conversation assigned')
    })
  })

  // --------------------------------------------------------------------------
  // Sender Info
  // --------------------------------------------------------------------------

  describe('Sender info', () => {
    it('shows sender info for incoming messages when showSender is true', () => {
      const wrapper = mountBubble(
        { senderType: 'customer', senderName: 'Alice' },
        { showSender: true },
      )
      const senderInfo = wrapper.find('.sender-info')
      expect(senderInfo.exists()).toBe(true)
      expect(wrapper.find('.sender-name').text()).toBe('Alice')
    })

    it('hides sender info when showSender is false (default)', () => {
      const wrapper = mountBubble({ senderType: 'customer', senderName: 'Alice' })
      expect(wrapper.find('.sender-info').exists()).toBe(false)
    })

    it('does not show sender info for outgoing messages even if showSender is true', () => {
      const wrapper = mountBubble(
        { senderType: 'agent', senderName: 'Bob' },
        { showSender: true },
      )
      expect(wrapper.find('.sender-info').exists()).toBe(false)
    })

    it('displays sender initials from name', () => {
      const wrapper = mountBubble(
        { senderType: 'customer', senderName: 'Charlie' },
        { showSender: true },
      )
      expect(wrapper.find('.sender-avatar').text()).toBe('C')
    })

    it('defaults sender name for customer when senderName is not provided', () => {
      const wrapper = mountBubble(
        { senderType: 'customer' },
        { showSender: true },
      )
      // Defaults to the Chinese label for customer
      expect(wrapper.find('.sender-name').text()).toContain('客戶')
    })
  })

  // --------------------------------------------------------------------------
  // Timestamp
  // --------------------------------------------------------------------------

  describe('Timestamp display', () => {
    it('displays formatted time from timestamp', () => {
      const wrapper = mountBubble({ timestamp: new Date('2026-03-06T14:30:00Z').getTime() })
      const timeEl = wrapper.find('time.message-time')
      expect(timeEl.exists()).toBe(true)
      // The mock formatTime returns HH:MM
      expect(timeEl.text()).toMatch(/\d{2}:\d{2}/)
    })

    it('renders the time element', () => {
      const wrapper = mountBubble()
      expect(wrapper.find('.message-time').exists()).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Agent Attribution
  // --------------------------------------------------------------------------

  describe('Agent attribution', () => {
    it('shows agent name for outgoing messages with senderName', () => {
      const wrapper = mountBubble({ senderType: 'agent', senderName: 'Agent Smith' })
      const attribution = wrapper.find('.agent-attribution')
      expect(attribution.exists()).toBe(true)
      expect(attribution.text()).toBe('Agent Smith')
    })

    it('does not show agent attribution for incoming messages', () => {
      const wrapper = mountBubble({ senderType: 'customer', senderName: 'Customer A' })
      expect(wrapper.find('.agent-attribution').exists()).toBe(false)
    })

    it('does not show agent attribution when senderName is empty', () => {
      const wrapper = mountBubble({ senderType: 'agent' })
      expect(wrapper.find('.agent-attribution').exists()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Message Status Indicators
  // --------------------------------------------------------------------------

  describe('Message status indicators', () => {
    it('shows status indicator only for outgoing messages', () => {
      const wrapper = mountBubble({ senderType: 'agent' })
      expect(wrapper.find('.message-status').exists()).toBe(true)
    })

    it('does not show status indicator for incoming messages', () => {
      const wrapper = mountBubble({ senderType: 'customer' })
      expect(wrapper.find('.message-status').exists()).toBe(false)
    })

    it('shows delivered check icon for delivered messages', () => {
      const wrapper = mountBubble(
        { senderType: 'agent', deliveryStatus: 'delivered' },
        { delivered: true },
      )
      expect(wrapper.find('.status-delivered').exists()).toBe(true)
    })

    it('shows failed icon for failed delivery status', () => {
      const wrapper = mountBubble(
        {
          senderType: 'agent',
          deliveryStatus: 'failed',
          status: 'failed',
        },
        { delivered: false },
      )
      const failedWrapper = wrapper.find('.status-failed-wrapper')
      expect(failedWrapper.exists()).toBe(true)
    })

    it('shows retry button for failed messages', () => {
      const wrapper = mountBubble(
        {
          senderType: 'agent',
          deliveryStatus: 'failed',
          status: 'failed',
        },
        { delivered: false },
      )
      const retryBtn = wrapper.find('.retry-btn')
      expect(retryBtn.exists()).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Upload Progress
  // --------------------------------------------------------------------------

  describe('Upload progress', () => {
    it('shows progress bar when uploadProgress is provided', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/file.zip',
          attachmentName: 'file.zip',
          attachmentSize: 5000,
          uploadProgress: 45,
        },
      )
      const progress = wrapper.find('.file-progress')
      expect(progress.exists()).toBe(true)
      expect(wrapper.find('.progress-text').text()).toBe('45%')
    })

    it('does not show progress bar when uploadProgress is undefined', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/file.zip',
          attachmentName: 'file.zip',
          attachmentSize: 5000,
        },
      )
      expect(wrapper.find('.file-progress').exists()).toBe(false)
    })

    it('renders progress bar width matching uploadProgress percentage', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/file.zip',
          attachmentName: 'file.zip',
          attachmentSize: 1000,
          uploadProgress: 75,
        },
      )
      const fill = wrapper.find('.progress-fill')
      expect(fill.exists()).toBe(true)
      expect(fill.attributes('style')).toContain('width: 75%')
    })
  })

  // --------------------------------------------------------------------------
  // CSS Classes based on message type
  // --------------------------------------------------------------------------

  describe('CSS classes based on message type', () => {
    it('applies message-image class for image messages', () => {
      const wrapper = mountBubble(
        { messageType: 'image' },
        { attachmentUrl: 'https://example.com/img.png' },
      )
      expect(wrapper.classes()).toContain('message-image')
    })

    it('applies message-file class for file messages', () => {
      const wrapper = mountBubble(
        { messageType: 'file' },
        { attachmentUrl: 'https://example.com/doc.pdf', attachmentName: 'doc.pdf' },
      )
      expect(wrapper.classes()).toContain('message-file')
    })

    it('does not apply message-image or message-file for text messages', () => {
      const wrapper = mountBubble({ messageType: 'text' })
      expect(wrapper.classes()).not.toContain('message-image')
      expect(wrapper.classes()).not.toContain('message-file')
    })
  })

  // --------------------------------------------------------------------------
  // Media Caption
  // --------------------------------------------------------------------------

  describe('Media caption', () => {
    it('shows caption text below image when content is provided', () => {
      const wrapper = mountBubble(
        { messageType: 'image', content: 'Photo caption here' },
        { attachmentUrl: 'https://example.com/img.png', attachmentName: 'img.png' },
      )
      const caption = wrapper.find('.media-caption')
      expect(caption.exists()).toBe(true)
      expect(caption.text()).toBe('Photo caption here')
    })

    it('shows caption text below file when content is provided', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: 'See attached report' },
        {
          attachmentUrl: 'https://example.com/report.pdf',
          attachmentName: 'report.pdf',
          attachmentSize: 1000,
        },
      )
      const caption = wrapper.find('.media-caption')
      expect(caption.exists()).toBe(true)
      expect(caption.text()).toBe('See attached report')
    })
  })

  // --------------------------------------------------------------------------
  // Image Message Specifics
  // --------------------------------------------------------------------------

  describe('Image message specifics', () => {
    it('sets lazy loading attribute on image', () => {
      const wrapper = mountBubble(
        { messageType: 'image' },
        { attachmentUrl: 'https://example.com/img.png', attachmentName: 'photo.png' },
      )
      const img = wrapper.find('img.message-image-content')
      expect(img.attributes('loading')).toBe('lazy')
    })

    it('sets alt text from attachmentName', () => {
      const wrapper = mountBubble(
        { messageType: 'image' },
        { attachmentUrl: 'https://example.com/img.png', attachmentName: 'my-photo.png' },
      )
      const img = wrapper.find('img.message-image-content')
      expect(img.attributes('alt')).toBe('my-photo.png')
    })

    it('displays download button in image overlay', () => {
      const wrapper = mountBubble(
        { messageType: 'image' },
        { attachmentUrl: 'https://example.com/img.png', attachmentName: 'img.png' },
      )
      const overlay = wrapper.find('.image-overlay')
      expect(overlay.exists()).toBe(true)
      const actionBtns = wrapper.findAll('.image-action-btn')
      expect(actionBtns.length).toBeGreaterThanOrEqual(2)
    })
  })

  // --------------------------------------------------------------------------
  // File Message Specifics
  // --------------------------------------------------------------------------

  describe('File message specifics', () => {
    it('renders download button for file messages', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/file.zip',
          attachmentName: 'file.zip',
          attachmentSize: 1000,
        },
      )
      const downloadBtn = wrapper.find('.file-action-btn.primary')
      expect(downloadBtn.exists()).toBe(true)
      expect(downloadBtn.text()).toContain('下載')
    })

    it('does not show file size when attachmentSize is 0', () => {
      const wrapper = mountBubble(
        { messageType: 'file', content: '' },
        {
          attachmentUrl: 'https://example.com/file.zip',
          attachmentName: 'file.zip',
          attachmentSize: 0,
        },
      )
      // attachmentSize is 0 (falsy), so v-if="attachmentSize" should hide it
      expect(wrapper.find('.file-size').exists()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Props Defaults
  // --------------------------------------------------------------------------

  describe('Props defaults', () => {
    it('defaults delivered to true', () => {
      const wrapper = mountBubble({ senderType: 'agent' })
      // With delivered=true and outgoing, should have message-delivered
      expect(wrapper.classes()).toContain('message-delivered')
      expect(wrapper.classes()).not.toContain('message-failed')
    })

    it('defaults showSender to false', () => {
      const wrapper = mountBubble({ senderType: 'customer' })
      expect(wrapper.find('.sender-info').exists()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Mouse Interactions (Actions)
  // --------------------------------------------------------------------------

  describe('Mouse interactions', () => {
    it('shows action buttons on mouseenter', async () => {
      const wrapper = mountBubble()
      await wrapper.trigger('mouseenter')
      // The showActions ref is controlled by the mock, but the event handler sets it
      // Since we mock useMessageActions, showActions is a ref(false)
      // The trigger calls handleRightClick etc. but showActions is set directly in component
      // Actually, the component does showActions = true on mouseenter directly
      // But our mock returns a ref(false) for showActions... the component sets showActions.value = true
      // Wait - the component does @mouseenter="showActions = true" which sets the ref from the composable
      // Since we returned ref(false), setting .value = true should work
      // Need to await nextTick
      const { nextTick } = require('vue')
      await nextTick()
      // Check if message-actions div shows up
      const actions = wrapper.find('.message-actions')
      expect(actions.exists()).toBe(true)
    })

    it('hides action buttons on mouseleave', async () => {
      const wrapper = mountBubble()
      await wrapper.trigger('mouseenter')
      const { nextTick } = require('vue')
      await nextTick()
      expect(wrapper.find('.message-actions').exists()).toBe(true)

      await wrapper.trigger('mouseleave')
      await nextTick()
      expect(wrapper.find('.message-actions').exists()).toBe(false)
    })

    it('shows copy button in actions', async () => {
      const wrapper = mountBubble()
      await wrapper.trigger('mouseenter')
      const { nextTick } = require('vue')
      await nextTick()
      const copyBtn = wrapper.find('.action-btn[title="複製"]')
      expect(copyBtn.exists()).toBe(true)
    })

    it('shows reply button only for incoming messages', async () => {
      const incomingWrapper = mountBubble({ senderType: 'customer' })
      await incomingWrapper.trigger('mouseenter')
      const { nextTick } = require('vue')
      await nextTick()
      expect(incomingWrapper.find('.action-btn[title="回覆"]').exists()).toBe(true)

      const outgoingWrapper = mountBubble({ senderType: 'agent' })
      await outgoingWrapper.trigger('mouseenter')
      await nextTick()
      expect(outgoingWrapper.find('.action-btn[title="回覆"]').exists()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Sticker Message
  // --------------------------------------------------------------------------

  describe('Sticker message', () => {
    it('renders sticker placeholder when no sticker URL and no processed content change', () => {
      const wrapper = mountBubble({
        messageType: 'sticker',
        content: '[Sticker]',
      })
      const stickerDiv = wrapper.find('.message-sticker')
      expect(stickerDiv.exists()).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Direction-based outgoing detection
  // --------------------------------------------------------------------------

  describe('Direction-based outgoing detection', () => {
    it('treats direction=outgoing as outgoing message', () => {
      const msg = createMessage({ senderType: 'customer' }) as Message & { direction: string }
      ;(msg as Record<string, unknown>).direction = 'outgoing'
      const wrapper = mount(MessageBubble, { props: { message: msg } })
      expect(wrapper.classes()).toContain('message-outgoing')
    })

    it('treats direction=incoming as incoming message', () => {
      const msg = createMessage({ senderType: 'agent' }) as Message & { direction: string }
      ;(msg as Record<string, unknown>).direction = 'incoming'
      const wrapper = mount(MessageBubble, { props: { message: msg } })
      expect(wrapper.classes()).toContain('message-incoming')
    })
  })
})
