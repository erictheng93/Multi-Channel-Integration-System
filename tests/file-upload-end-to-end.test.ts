// 檔案上傳端到端測試
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/file-upload-end-to-end.test.ts
// Created by: Integration Test Developer

// CRITICAL: Fix Vue Test Utils Event Interface Issue
// This must be done BEFORE any imports from @vue/test-utils
console.log('🔧 [FILE-LEVEL] Setting up Event interfaces for Vue Test Utils...')

// DOM Event constructor is set up in setup.ts

// Event interfaces are now set up in setup.ts
console.log('🔧 [FILE-LEVEL] Using DOM event interfaces from setup.ts')

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import MessageInput from '../frontend/src/components/conversation/MessageInput.vue'

// Mock the message API
vi.mock('../frontend/src/api/message', () => ({
  messageApi: {
    send: vi.fn(),
    uploadAttachment: vi.fn()
  }
}))

// Mock the icon components
vi.mock('../frontend/src/components/icons', () => ({
  SendIcon: { template: '<svg data-testid="send-icon"></svg>' },
  SmileIcon: { template: '<svg data-testid="smile-icon"></svg>' },
  PaperclipIcon: { template: '<svg data-testid="paperclip-icon"></svg>' },
  FileIcon: { template: '<svg data-testid="file-icon"></svg>' },
  XIcon: { template: '<svg data-testid="x-icon"></svg>' },
  LoadingIcon: { template: '<svg data-testid="loading-icon"></svg>' }
}))

describe('File Upload End-to-End Integration', () => {
  let pinia: any
  let mockMessageApi: any

  beforeAll(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Get mocked API
    const { messageApi } = await import('../frontend/src/api/message')
    mockMessageApi = messageApi
  })

  const createWrapper = (props = {}) => {
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

  describe('Complete File Upload Flow', () => {
    it('should handle complete file upload and message sending flow', async () => {
      const wrapper = createWrapper()
      
      // Mock successful upload response
      mockMessageApi.uploadAttachment.mockResolvedValue({
        success: true,
        data: {
          id: 'attachment-123',
          url: 'https://example.com/file.jpg',
          filename: 'test.jpg'
        }
      })

      // Mock successful message send response
      mockMessageApi.send.mockResolvedValue({
        success: true,
        data: {
          id: 'message-123',
          content: 'Check out this image!',
          attachments: ['attachment-123']
        }
      })

      // Simulate file selection
      const fileInput = wrapper.find('.file-input')
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      // Verify attachment is added
      expect(wrapper.vm.attachments).toHaveLength(1)
      expect(wrapper.vm.attachments[0].name).toBe('test.jpg')

      // Add message text
      const textarea = wrapper.find('.message-textarea')
      await textarea.setValue('Check out this image!')

      // Send message
      const sendButton = wrapper.find('.send-button')
      await sendButton.trigger('click')
      await nextTick()

      // Verify upload was called
      expect(mockMessageApi.uploadAttachment).toHaveBeenCalledWith('test-conversation-id', {
        file: mockFile,
        messageType: 'image'
      })

      // Verify message send was called with attachment ID
      expect(mockMessageApi.send).toHaveBeenCalledWith('test-conversation-id', {
        content: 'Check out this image!',
        messageType: 'file',
        platform: 'line',
        attachmentIds: ['attachment-123']
      })

      // Verify input is cleared
      expect(wrapper.vm.messageText).toBe('')
      expect(wrapper.vm.attachments).toHaveLength(0)

      // Verify event is emitted
      expect(wrapper.emitted('message-sent')).toBeTruthy()
    })

    it('should handle file upload failure gracefully', async () => {
      const wrapper = createWrapper()
      
      // Mock failed upload response
      mockMessageApi.uploadAttachment.mockResolvedValue({
        success: false,
        error: 'File too large'
      })

      // Simulate file selection
      const fileInput = wrapper.find('.file-input')
      const mockFile = new File(['test content'], 'large.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      // Add message text
      const textarea = wrapper.find('.message-textarea')
      await textarea.setValue('This should fail')

      // Try to send message
      const sendButton = wrapper.find('.send-button')
      await sendButton.trigger('click')
      await nextTick()

      // Verify upload was attempted
      expect(mockMessageApi.uploadAttachment).toHaveBeenCalled()

      // Verify message send was NOT called due to upload failure
      expect(mockMessageApi.send).not.toHaveBeenCalled()

      // Verify error is shown
      expect(wrapper.find('.error-message').text()).toContain('large.jpg 上傳失敗')
    })

    it('should handle multiple file uploads', async () => {
      const wrapper = createWrapper()
      
      // Mock successful uploads
      mockMessageApi.uploadAttachment
        .mockResolvedValueOnce({
          success: true,
          data: { id: 'attachment-1', url: 'file1.jpg' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 'attachment-2', url: 'file2.pdf' }
        })

      mockMessageApi.send.mockResolvedValue({
        success: true,
        data: { id: 'message-123' }
      })

      // Simulate multiple file selection
      const fileInput = wrapper.find('.file-input')
      const mockFiles = [
        new File(['image content'], 'image.jpg', { type: 'image/jpeg' }),
        new File(['doc content'], 'document.pdf', { type: 'application/pdf' })
      ]
      
      Object.defineProperty(fileInput.element, 'files', {
        value: mockFiles,
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      // Verify both attachments are added
      expect(wrapper.vm.attachments).toHaveLength(2)

      // Send message
      const sendButton = wrapper.find('.send-button')
      await sendButton.trigger('click')
      await nextTick()

      // Verify both uploads were called
      expect(mockMessageApi.uploadAttachment).toHaveBeenCalledTimes(2)
      expect(mockMessageApi.uploadAttachment).toHaveBeenNthCalledWith(1, 'test-conversation-id', {
        file: mockFiles[0],
        messageType: 'image'
      })
      expect(mockMessageApi.uploadAttachment).toHaveBeenNthCalledWith(2, 'test-conversation-id', {
        file: mockFiles[1],
        messageType: 'file'
      })

      // Verify message send with both attachment IDs
      expect(mockMessageApi.send).toHaveBeenCalledWith('test-conversation-id', {
        content: '',
        messageType: 'file',
        platform: 'line',
        attachmentIds: ['attachment-1', 'attachment-2']
      })
    })

    it('should send message with attachments only (no text)', async () => {
      const wrapper = createWrapper()
      
      mockMessageApi.uploadAttachment.mockResolvedValue({
        success: true,
        data: { id: 'attachment-123', url: 'file.jpg' }
      })

      mockMessageApi.send.mockResolvedValue({
        success: true,
        data: { id: 'message-123' }
      })

      // Add file without text
      const fileInput = wrapper.find('.file-input')
      const mockFile = new File(['content'], 'file.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      // Send button should be enabled with attachment only
      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeUndefined()

      await sendButton.trigger('click')
      await nextTick()

      // Verify message sent with empty content but with attachment
      expect(mockMessageApi.send).toHaveBeenCalledWith('test-conversation-id', {
        content: '',
        messageType: 'file',
        platform: 'line',
        attachmentIds: ['attachment-123']
      })
    })
  })

  describe('File Validation', () => {
    it('should validate file types correctly', async () => {
      const wrapper = createWrapper()
      
      // Test valid image file
      const fileInput = wrapper.find('.file-input')
      const validFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [validFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      expect(wrapper.vm.attachments).toHaveLength(1)
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('should show error for oversized files', async () => {
      const wrapper = createWrapper()
      
      // Create a file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      })
      
      const fileInput = wrapper.find('.file-input')
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      expect(wrapper.vm.attachments).toHaveLength(0)
      expect(wrapper.find('.error-message').text()).toContain('超過 10MB 限制')
    })
  })

  describe('UI State Management', () => {
    it('should show loading state during upload and send', async () => {
      const wrapper = createWrapper()
      
      // Mock delayed responses
      mockMessageApi.uploadAttachment.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { id: 'attachment-123' }
        }), 100))
      )

      mockMessageApi.send.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { id: 'message-123' }
        }), 100))
      )

      // Add file and text
      const fileInput = wrapper.find('.file-input')
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      // Use JSDOM's Document to create proper events
      const changeEvent = document.createEvent('Event')
      changeEvent.initEvent('change', true, false)
      Object.defineProperty(changeEvent, 'target', {
        value: fileInput.element,
        writable: false
      })
      fileInput.element.dispatchEvent(changeEvent)
      await nextTick()

      const textarea = wrapper.find('.message-textarea')
      await textarea.setValue('Test message')

      // Start sending
      const sendButton = wrapper.find('.send-button')
      await sendButton.trigger('click')

      // Should show loading state
      expect(wrapper.find('[data-testid="loading-icon"]').exists()).toBe(true)
      expect(sendButton.classes()).toContain('sending')
      expect(sendButton.attributes('disabled')).toBeDefined()
    })
  })

  afterAll(() => {
    vi.clearAllMocks()
  })
})