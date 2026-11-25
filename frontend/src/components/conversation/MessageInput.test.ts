// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/components/conversation/MessageInput.test.ts
// Created by: Component Test Developer
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { TestComponentInstance, MockProps } from '@/types/test-types'

// Mock the message API first before importing the component
vi.mock('@/api/message', () => ({
  messageApi: {
    send: vi.fn(),
    list: vi.fn(),
    listPaginated: vi.fn(),
    search: vi.fn(),
    recallMessage: vi.fn(),
    uploadAttachment: vi.fn(),
    markAsRead: vi.fn(),
    get: vi.fn(),
    edit: vi.fn(),
    sendQuickReply: vi.fn()
  }
}))

vi.mock('@/api/authenticatedFetch', () => ({
  authenticatedFetch: vi.fn()
}))

import MessageInput from './MessageInput.vue'
import { authenticatedFetch } from '@/api/authenticatedFetch'
import { messageApi } from '@/api/message'

// Get access to the mocked API
const mockMessageApi = vi.mocked(messageApi)
const mockAuthenticatedFetch = vi.mocked(authenticatedFetch)

function mockFetchJson(body: unknown) {
  mockAuthenticatedFetch.mockResolvedValue({ json: async () => body } as unknown as Response)
}

// Mock the icon components
vi.mock('@/components/icons', () => ({
  SendIcon: {
    template: '<svg data-testid="send-icon"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>'
  },
  SmileIcon: {
    template: '<svg data-testid="smile-icon"><circle cx="12" cy="12" r="10"/></svg>'
  },
  PaperclipIcon: {
    template: '<svg data-testid="paperclip-icon"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/></svg>'
  },
  FileIcon: {
    template: '<svg data-testid="file-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>'
  },
  XIcon: {
    template: '<svg data-testid="x-icon"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  },
  XCircleIcon: {
    template: '<svg data-testid="x-circle-icon"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6m0-6 6 6"/></svg>'
  },
  CheckCircleIcon: {
    template: '<svg data-testid="check-circle-icon"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>'
  },
  LoadingIcon: {
    template: '<svg data-testid="loading-icon" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
  }
}))

describe('MessageInput Component', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockFetchJson({ success: true, message: { id: 'real-default' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createWrapper = (props: MockProps = {}): VueWrapper<TestComponentInstance> => {
    return mount(MessageInput, {
      props: {
        conversationId: 'test-conversation-id',
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render the message input component', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.message-input').exists()).toBe(true)
      expect(wrapper.find('.message-textarea').exists()).toBe(true)
      expect(wrapper.find('.send-button').exists()).toBe(true)
      expect(wrapper.find('[data-testid="smile-icon"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="paperclip-icon"]').exists()).toBe(true)
    })

    it('should have correct placeholder text', () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      expect(textarea.attributes('placeholder')).toBe('輸入訊息...')
    })

    it('should disable input when disabled prop is true', () => {
      const wrapper = createWrapper({ disabled: true })
      const textarea = wrapper.find('.message-textarea')
      const actionButtons = wrapper.findAll('.action-btn')

      expect(textarea.attributes('disabled')).toBeDefined()
      actionButtons.forEach(button => {
        expect(button.attributes('disabled')).toBeDefined()
      })
    })
  })

  describe('Text Input Functionality', () => {
    it('should update messageText when typing', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('Hello, World!')

      // Check the input value directly instead of component internal state
      expect((textarea.element as globalThis.HTMLTextAreaElement).value).toBe('Hello, World!')
    })

    it('should handle Enter key to send message', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown', { key: 'Enter' })

      // Component emits message-pending event immediately (optimistic UI)
      const emittedEvents = wrapper.emitted('message-pending')
      expect(emittedEvents).toBeTruthy()
      if (emittedEvents && emittedEvents.length > 0 && emittedEvents[0]) {
        const pendingMessage = emittedEvents[0][0] as Record<string, unknown>
        expect(pendingMessage.content).toBe('Test message')
        expect(pendingMessage.status).toBe('sending')  // No attachments = sending status
      }
    })

    it('should not send message on Shift+Enter', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

      // Shift+Enter should NOT trigger message send
      const emittedEvents = wrapper.emitted('message-pending')
      expect(emittedEvents).toBeFalsy()
    })

    // IME (注音/拼音/日文) 組字中的 Enter 是「確認選字」，不是「送出訊息」
    it('should not send message on Enter while the IME is composing', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('今天的訂單')
      await textarea.trigger('keydown', { key: 'Enter', isComposing: true })

      expect(wrapper.emitted('message-pending')).toBeFalsy()
    })

    it('should not send message on Enter with legacy IME keyCode 229', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('今天的訂單')
      await textarea.trigger('keydown', { key: 'Enter', keyCode: 229 })

      expect(wrapper.emitted('message-pending')).toBeFalsy()
    })

    // Safari 先送 compositionend、再送 isComposing=false 的 Enter keydown
    it('should not send message on Enter right after compositionend (Safari)', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('今天的訂單')
      await textarea.trigger('compositionend')
      await textarea.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('message-pending')).toBeFalsy()
    })

    it('should send message on Enter once the composition grace window has passed', async () => {
      vi.useFakeTimers()
      try {
        const wrapper = createWrapper()
        const textarea = wrapper.find('.message-textarea')

        await textarea.setValue('今天的訂單')
        await textarea.trigger('compositionend')
        await textarea.trigger('keydown', { key: 'Enter' })
        expect(wrapper.emitted('message-pending')).toBeFalsy()

        vi.advanceTimersByTime(100)
        await textarea.trigger('keydown', { key: 'Enter' })

        expect(wrapper.emitted('message-pending')).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should auto-resize textarea based on content', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      // Mock scrollHeight
      Object.defineProperty(textarea.element, 'scrollHeight', {
        value: 60,
        writable: true
      })

      await textarea.setValue('Line 1\nLine 2\nLine 3')
      await textarea.trigger('input')

      expect((textarea.element as globalThis.HTMLTextAreaElement).style.height).toBe('60px')
    })
  })

  describe('Message Sending', () => {
    const sentBody = () => JSON.parse(String(mockAuthenticatedFetch.mock.calls[0]?.[1]?.body))

    it('emits message-pending optimistically, clears the input and trims the content', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('  Test message  ')
      await wrapper.find('.send-button').trigger('click')

      const pending = wrapper.emitted('message-pending')?.[0]?.[0] as { content: string; tempId: string; status: string }
      expect(pending.content).toBe('Test message')
      expect(pending.status).toBe('sending')
      expect(pending.tempId).toBeTruthy()
      expect((textarea.element as globalThis.HTMLTextAreaElement).value).toBe('')
      await flushPromises()
      expect(sentBody().content).toBe('Test message')
    })

    it('confirms the optimistic message with the server id on success', async () => {
      mockFetchJson({ success: true, message: { id: 'real-1', deliveryStatus: 'buffered', recallDeadline: '2026-11-25T00:00:00Z' } })
      const wrapper = createWrapper()

      await wrapper.find('.message-textarea').setValue('hello')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()

      const pending = wrapper.emitted('message-pending')?.[0]?.[0] as { tempId: string }
      const confirmed = wrapper.emitted('message-confirmed')?.[0]?.[0] as Record<string, unknown>
      expect(confirmed).toMatchObject({ tempId: pending.tempId, realId: 'real-1', deliveryStatus: 'buffered' })
      expect(wrapper.emitted('message-failed')).toBeFalsy()
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('reports a server rejection with retry data and shows the error inline', async () => {
      mockFetchJson({ success: false, error: { message: 'Quota exceeded' } })
      const wrapper = createWrapper()

      await wrapper.find('.message-textarea').setValue('hello')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()

      const failed = wrapper.emitted('message-failed')?.[0]?.[0] as { error: string; retryData: { content: string } }
      expect(failed.error).toBe('Quota exceeded')
      expect(failed.retryData.content).toBe('hello')
      expect(wrapper.emitted('message-confirmed')).toBeFalsy()
      expect(wrapper.find('.error-message').text()).toContain('Quota exceeded')
    })

    it('shows a network-specific message when fetch itself fails', async () => {
      mockAuthenticatedFetch.mockRejectedValue(new TypeError('Failed to fetch'))
      const wrapper = createWrapper()
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await wrapper.find('.message-textarea').setValue('hello')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('message-failed')).toHaveLength(1)
      expect(wrapper.find('.error-message').text()).toContain('網路連接失敗')
    })

    it('clears the inline error when the user types again', async () => {
      mockFetchJson({ success: false, error: { message: 'Quota exceeded' } })
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('hello')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()
      expect(wrapper.find('.error-message').exists()).toBe(true)

      await textarea.trigger('input')
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('clears the inline error when the conversation changes', async () => {
      mockFetchJson({ success: false, error: { message: 'Quota exceeded' } })
      const wrapper = createWrapper({ conversationId: 'conv-1' })

      await wrapper.find('.message-textarea').setValue('hello')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()
      expect(wrapper.find('.error-message').exists()).toBe(true)

      await wrapper.setProps({ conversationId: 'conv-2' })
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('shows the sending state while the request is in flight', async () => {
      let release: (value: unknown) => void = () => {}
      mockAuthenticatedFetch.mockReturnValue(new Promise((resolve) => { release = resolve }))
      const wrapper = createWrapper()
      const sendButton = wrapper.find('.send-button')

      await wrapper.find('.message-textarea').setValue('hello')
      await sendButton.trigger('click')
      await nextTick()
      expect(sendButton.classes()).toContain('sending')
      expect(wrapper.find('[data-testid="loading-icon"]').exists()).toBe(true)

      release({ json: async () => ({ success: true, message: { id: 'real-1' } }) })
      await flushPromises()
      expect(sendButton.classes()).not.toContain('sending')
    })

    it('does not send empty or whitespace-only messages', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.send-button').trigger('click')
      await wrapper.find('.message-textarea').setValue('   ')
      await wrapper.find('.send-button').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('message-pending')).toBeFalsy()
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled()
    })
  })

  describe('File Attachment Functionality', () => {
    it('should trigger file input when paperclip button is clicked', async () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')

      await wrapper.find('button[title="Attachment"]').trigger('click')

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should handle file selection', async () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      const mockFile = new globalThis.File(['test content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')
      await nextTick()

      // Check if attachment preview is shown instead of internal state
      expect(wrapper.find('.attachments-preview').exists()).toBe(true)
      expect(wrapper.find('.attachment-name').text()).toBe('test.txt')
    })


    it('should emit attachment-upload event', async () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      const mockFile = new globalThis.File(['test content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')

      expect(wrapper.emitted('attachment-upload')).toBeTruthy()
      const emittedEvents = wrapper.emitted('attachment-upload')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents?.[0]?.[0]).toMatchObject({
        name: 'test.txt',
        file: mockFile
      })
    })

    it('should remove attachment when remove button is clicked', async () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      const mockFile = new globalThis.File(['test content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')
      await nextTick()
      expect(wrapper.find('.attachments-preview').exists()).toBe(true)

      await wrapper.find('.remove-attachment').trigger('click')
      await nextTick()
      expect(wrapper.find('.attachments-preview').exists()).toBe(false)
    })

    it('should reject files larger than 10MB', async () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      const largeFile = new globalThis.File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })

      await fileInput.trigger('change')
      await nextTick()

      expect(wrapper.find('.attachments-preview').exists()).toBe(false)
      expect(wrapper.emitted('attachment-upload')).toBeFalsy()
      expect(wrapper.find('.error-message').text()).toContain('exceeds 10MB limit')
    })
  })

  describe('Clipboard Paste Functionality', () => {
    beforeEach(() => {
      // jsdom 未實作 createObjectURL/revokeObjectURL（圖片附件建立預覽時需要）
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url') as typeof globalThis.URL.createObjectURL
      globalThis.URL.revokeObjectURL = vi.fn() as typeof globalThis.URL.revokeObjectURL
    })

    const createPasteEvent = (
      files: globalThis.File[],
      options: { textOnly?: boolean } = {}
    ): Event => {
      const event = new Event('paste', { bubbles: true, cancelable: true })
      const items = options.textOnly
        ? [{ kind: 'string', type: 'text/plain', getAsFile: () => null }]
        : files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file }))
      Object.defineProperty(event, 'clipboardData', {
        value: { items, files }
      })
      return event
    }

    it('should add pasted screenshot as attachment with a recognizable name', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      // Chrome/Firefox 剪貼簿截圖的通用檔名固定是 image.png
      const screenshot = new globalThis.File(['fake-image-data'], 'image.png', { type: 'image/png' })
      const pasteEvent = createPasteEvent([screenshot])

      textarea.element.dispatchEvent(pasteEvent)
      await nextTick()

      expect(pasteEvent.defaultPrevented).toBe(true)
      expect(wrapper.find('.attachments-preview').exists()).toBe(true)
      expect(wrapper.find('.attachment-name').text()).toMatch(/^pasted-\d{8}-\d{6}\.png$/)
    })

    it('should keep original filename when pasting a copied real file', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      const photo = new globalThis.File(['photo-data'], 'photo.jpg', { type: 'image/jpeg' })
      textarea.element.dispatchEvent(createPasteEvent([photo]))
      await nextTick()

      expect(wrapper.find('.attachment-name').text()).toBe('photo.jpg')
    })

    it('should add multiple pasted images as separate attachments', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      const imageA = new globalThis.File(['aaa'], 'image.png', { type: 'image/png' })
      const imageB = new globalThis.File(['bbbb'], 'image.png', { type: 'image/png' })
      textarea.element.dispatchEvent(createPasteEvent([imageA, imageB]))
      await nextTick()

      const names = wrapper.findAll('.attachment-name')
      expect(names).toHaveLength(2)
      expect(names[0]?.text()).toMatch(/^pasted-\d{8}-\d{6}\.png$/)
      expect(names[1]?.text()).toMatch(/^pasted-\d{8}-\d{6}-2\.png$/)
    })

    it('should not intercept text-only paste (browser default preserved)', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      const pasteEvent = createPasteEvent([], { textOnly: true })
      textarea.element.dispatchEvent(pasteEvent)
      await nextTick()

      expect(pasteEvent.defaultPrevented).toBe(false)
      expect(wrapper.find('.attachments-preview').exists()).toBe(false)
    })

    it('should emit attachment-upload for pasted image', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      const screenshot = new globalThis.File(['fake-image-data'], 'image.png', { type: 'image/png' })
      textarea.element.dispatchEvent(createPasteEvent([screenshot]))
      await nextTick()

      const emittedEvents = wrapper.emitted('attachment-upload')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents?.[0]?.[0]).toMatchObject({ isImage: true })
    })

    it('should reject pasted images larger than 10MB', async () => {
      const wrapper = createWrapper()
      const textarea = wrapper.find('.message-textarea')

      const largeImage = new globalThis.File(
        ['x'.repeat(11 * 1024 * 1024)],
        'image.png',
        { type: 'image/png' }
      )
      textarea.element.dispatchEvent(createPasteEvent([largeImage]))
      await nextTick()

      expect(wrapper.find('.attachments-preview').exists()).toBe(false)
      const errorMessage = wrapper.find('.error-message')
      expect(errorMessage.exists()).toBe(true)
      expect(errorMessage.text()).toContain('exceeds 10MB limit')
    })
  })

  describe('Emoji Picker', () => {
    it('should show emoji picker when emoji button is clicked', async () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.emoji-picker-popup').exists()).toBe(false)

      await wrapper.find('button[title="Emoji"]').trigger('click')
      await nextTick()

      expect(wrapper.find('.emoji-picker-popup').exists()).toBe(true)
    })

    it('should hide emoji picker when clicked again', async () => {
      const wrapper = createWrapper()

      // Show picker
      await wrapper.find('button[title="Emoji"]').trigger('click')
      await nextTick()
      expect(wrapper.find('.emoji-picker-popup').exists()).toBe(true)

      // Hide picker
      await wrapper.find('button[title="Emoji"]').trigger('click')
      await nextTick()
      expect(wrapper.find('.emoji-picker-popup').exists()).toBe(false)
    })
  })

  describe('Conversation Changes', () => {
    it('should clear input when conversation changes', async () => {
      const wrapper = createWrapper({ conversationId: 'conv-1' })
      const textarea = wrapper.find('.message-textarea')

      await textarea.setValue('Test message')
      expect((textarea.element as globalThis.HTMLTextAreaElement).value).toBe('Test message')

      await wrapper.setProps({ conversationId: 'conv-2' })
      await nextTick()

      expect((textarea.element as globalThis.HTMLTextAreaElement).value).toBe('')
    })

    it('should clear attachments when conversation changes', async () => {
      const wrapper = createWrapper({ conversationId: 'conv-1' })
      const fileInput = wrapper.find('.file-input')

      const mockFile = new globalThis.File(['test content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')
      await nextTick()
      expect(wrapper.find('.attachments-preview').exists()).toBe(true)

      await wrapper.setProps({ conversationId: 'conv-2' })
      await nextTick()

      expect(wrapper.find('.attachments-preview').exists()).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('should have proper button types', () => {
      const wrapper = createWrapper()
      const actionButtons = wrapper.findAll('.action-btn')

      actionButtons.forEach(button => {
        expect(button.attributes('type')).toBe('button')
      })
    })

    it('should have proper file input accept attribute', () => {
      const wrapper = createWrapper()
      const fileInput = wrapper.find('.file-input')

      expect(fileInput.attributes('accept')).toBe('image/*,application/pdf,.doc,.docx')
    })
  })
})