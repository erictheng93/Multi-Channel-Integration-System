/**
 * Unit Tests for useMessageHandlers Composable
 *
 * @module tests/unit/composables/conversation/useMessageHandlers.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useMessageHandlers } from '@/composables/conversation/useMessageHandlers'
import type {
  MessagePendingData,
  UploadProgressData,
  MessageConfirmedData,
  MessageFailedData,
  MessageSentData
} from '@/composables/conversation/useMessageHandlers'
import type { Message } from '@/types'
import type { ConversationState } from '@/composables/conversation/useConversationState'

// ===== Mocks =====

const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
    showWarning: vi.fn()
  })
}))

const mockUploadSingleFile = vi.fn()

vi.mock('@/composables/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadSingleFile: mockUploadSingleFile
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentAgent: {
      id: 'agent-1',
      name: 'TestAgent',
      displayName: 'Test Agent'
    }
  })
}))

// ===== Helpers =====

function createMockState(messages: Message[] = []): ConversationState {
  const messagesRef = ref<Message[]>(messages)

  return {
    conversation: ref({
      id: 'conv-1',
      customerId: 'customer-1',
      platform: 'line',
      status: 'active',
      lastMessageAt: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    }),
    httpMessages: {
      messages: messagesRef,
      addMessage: vi.fn((msg: Message) => {
        messagesRef.value.push(msg)
      }),
      sendMessage: vi.fn().mockResolvedValue(true),
      sendMessageWithAttachments: vi.fn().mockResolvedValue({ success: true }),
      loading: ref(false),
      error: ref(null),
      hasMore: ref(false),
      loadMessages: vi.fn(),
      loadMoreMessages: vi.fn(),
      totalCount: ref(0),
      currentPage: ref(1),
      pageSize: ref(30)
    },
    addMessage: vi.fn((msg: Message) => {
      messagesRef.value.push(msg)
    })
  } as unknown as ConversationState
}

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'agent-1',
    senderType: 'agent',
    content: 'Hello',
    messageType: 'text',
    platform: 'line',
    timestamp: Date.now(),
    createdAt: Date.now(),
    status: 'sent',
    deliveryStatus: 'sent',
    senderName: 'Test Agent',
    metadata: {},
    ...overrides
  } as Message
}

// ===== Tests =====

describe('useMessageHandlers', () => {
  let state: ConversationState
  let handlers: ReturnType<typeof useMessageHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    state = createMockState()
    handlers = useMessageHandlers('conv-1', state)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should initialize with empty tracking sets', () => {
      expect(handlers.pendingMessageIds.size).toBe(0)
      expect(handlers.sentMessageIds.size).toBe(0)
      expect(handlers.pendingByCorrelationId.size).toBe(0)
      expect(handlers.correlationToRealId.size).toBe(0)
    })

    it('should expose lastUserActivity as a ref', () => {
      expect(handlers.lastUserActivity.value).toBeGreaterThan(0)
    })
  })

  describe('trackUserActivity', () => {
    it('should update lastUserActivity timestamp', () => {
      const before = handlers.lastUserActivity.value
      vi.advanceTimersByTime(1000)
      handlers.trackUserActivity()
      expect(handlers.lastUserActivity.value).toBeGreaterThan(before)
    })
  })

  describe('handleMessageSent', () => {
    it('should not error on valid message data', () => {
      const data: MessageSentData = {
        content: 'Hello world',
        attachments: []
      }
      expect(() => handlers.handleMessageSent(data)).not.toThrow()
    })

    it('should skip empty messages with no attachments', () => {
      const data: MessageSentData = {
        content: '   ',
        attachments: []
      }
      // Should return early without error
      expect(() => handlers.handleMessageSent(data)).not.toThrow()
    })

    it('should accept messages with only file_attachments and empty content', () => {
      const data: MessageSentData = {
        content: '',
        attachments: [],
        file_attachments: [
          { id: 'f1', filename: 'test.pdf', mimeType: 'application/pdf', fileSize: 1024, fileUrl: '/files/test.pdf' }
        ]
      }
      expect(() => handlers.handleMessageSent(data)).not.toThrow()
    })

    it('should update lastUserActivity', () => {
      const before = handlers.lastUserActivity.value
      vi.advanceTimersByTime(100)
      handlers.handleMessageSent({ content: 'hi', attachments: [] })
      expect(handlers.lastUserActivity.value).toBeGreaterThan(before)
    })
  })

  describe('handleMessagePending', () => {
    it('should add optimistic message to state', () => {
      const data: MessagePendingData = {
        tempId: 'temp-1',
        content: 'Pending message',
        attachments: [],
        status: 'sending'
      }

      handlers.handleMessagePending(data)

      expect(state.addMessage).toHaveBeenCalledTimes(1)
      const addedMsg = (state.addMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message
      expect(addedMsg.id).toBe('temp-1')
      expect(addedMsg.content).toBe('Pending message')
      expect(addedMsg.status).toBe('pending')
      expect(addedMsg.deliveryStatus).toBe('pending')
      expect(addedMsg.senderType).toBe('agent')
      expect(addedMsg.senderId).toBe('agent-1')
      expect(addedMsg.messageType).toBe('text')
    })

    it('should set messageType to file when attachments exist', () => {
      const data: MessagePendingData = {
        tempId: 'temp-2',
        content: 'With file',
        attachments: [
          { name: 'test.pdf', size: 1024, isImage: false, fileType: 'PDF', typeColor: 'red' }
        ],
        status: 'uploading'
      }

      handlers.handleMessagePending(data)

      const addedMsg = (state.addMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message
      expect(addedMsg.messageType).toBe('file')
    })

    it('should register tempId in pendingMessageIds', () => {
      handlers.handleMessagePending({
        tempId: 'temp-3',
        content: 'Test',
        attachments: [],
        status: 'sending'
      })

      expect(handlers.pendingMessageIds.has('temp-3')).toBe(true)
    })

    it('should register in pendingByCorrelationId', () => {
      handlers.handleMessagePending({
        tempId: 'temp-4',
        correlationId: 'corr-abc',
        content: 'Test',
        attachments: [],
        status: 'sending'
      })

      expect(handlers.pendingByCorrelationId.has('corr-abc')).toBe(true)
      const info = handlers.pendingByCorrelationId.get('corr-abc')
      expect(info?.tempId).toBe('temp-4')
      expect(info?.content).toBe('Test')
    })

    it('should auto-generate correlationId if not provided', () => {
      handlers.handleMessagePending({
        tempId: 'temp-5',
        content: 'No corr',
        attachments: [],
        status: 'sending'
      })

      expect(handlers.pendingByCorrelationId.size).toBe(1)
      const [corrId] = [...handlers.pendingByCorrelationId.keys()]
      expect(corrId).toMatch(/^corr-/)
    })

    it('should store pendingAttachments in metadata', () => {
      handlers.handleMessagePending({
        tempId: 'temp-6',
        content: 'Attachments',
        attachments: [
          { name: 'img.png', size: 2048, blobUrl: 'blob:url', isImage: true, fileType: 'Image', typeColor: 'green' }
        ],
        status: 'uploading',
        uploadProgress: 50
      })

      const addedMsg = (state.addMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message
      const meta = addedMsg.metadata as Record<string, unknown>
      expect(meta.uploadStatus).toBe('uploading')
      expect(meta.uploadProgress).toBe(50)
      expect(meta.pendingAttachments).toHaveLength(1)
      expect((meta.pendingAttachments as Array<Record<string, unknown>>)[0].name).toBe('img.png')
    })

    it('should use conversation platform', () => {
      handlers.handleMessagePending({
        tempId: 'temp-7',
        content: 'Test',
        attachments: [],
        status: 'sending'
      })

      const addedMsg = (state.addMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message
      expect(addedMsg.platform).toBe('line')
    })
  })

  describe('handleUploadProgress', () => {
    it('should update progress on existing pending message', () => {
      const messages = [
        createMessage({
          id: 'temp-up-1',
          status: 'pending',
          deliveryStatus: 'pending',
          metadata: { uploadProgress: 0, uploadStatus: 'uploading' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      const data: UploadProgressData = {
        tempId: 'temp-up-1',
        progress: 75,
        status: 'uploading'
      }

      handlers.handleUploadProgress(data)

      const msg = state.httpMessages.messages.value[0]
      expect(msg.deliveryStatus).toBe('pending')
      const meta = msg.metadata as Record<string, unknown>
      expect(meta.uploadProgress).toBe(75)
      expect(meta.uploadStatus).toBe('uploading')
    })

    it('should set deliveryStatus to sending when status is sending', () => {
      const messages = [
        createMessage({
          id: 'temp-up-2',
          status: 'pending',
          deliveryStatus: 'pending',
          metadata: { uploadProgress: 0, uploadStatus: 'uploading' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleUploadProgress({
        tempId: 'temp-up-2',
        progress: 100,
        status: 'sending'
      })

      const msg = state.httpMessages.messages.value[0]
      expect(msg.status).toBe('sending')
      expect(msg.deliveryStatus).toBe('sending')
    })

    it('should be a no-op if message is not found', () => {
      state = createMockState([])
      handlers = useMessageHandlers('conv-1', state)

      expect(() =>
        handlers.handleUploadProgress({ tempId: 'nonexistent', progress: 50, status: 'uploading' })
      ).not.toThrow()
    })
  })

  describe('handleMessageConfirmed', () => {
    it('should update tempId to realId when no race condition (normal flow)', () => {
      const messages = [
        createMessage({
          id: 'temp-c-1',
          status: 'pending',
          deliveryStatus: 'pending',
          metadata: { uploadProgress: 100, pendingAttachments: [] }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)
      handlers.pendingMessageIds.add('temp-c-1')

      const data: MessageConfirmedData = {
        tempId: 'temp-c-1',
        realId: 'real-1'
      }

      handlers.handleMessageConfirmed(data)

      const msg = state.httpMessages.messages.value[0]
      expect(msg.id).toBe('real-1')
      expect(msg.status).toBe('sent')
      expect(msg.deliveryStatus).toBe('sent')
      // Cleanup metadata
      const meta = msg.metadata as Record<string, unknown>
      expect(meta.uploadProgress).toBeUndefined()
      expect(meta.pendingAttachments).toBeUndefined()
    })

    it('should transfer tracking from pendingMessageIds to sentMessageIds', () => {
      const messages = [createMessage({ id: 'temp-c-2', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)
      handlers.pendingMessageIds.add('temp-c-2')

      handlers.handleMessageConfirmed({ tempId: 'temp-c-2', realId: 'real-2' })

      expect(handlers.pendingMessageIds.has('temp-c-2')).toBe(false)
      expect(handlers.sentMessageIds.has('real-2')).toBe(true)
    })

    it('should handle race condition: remove duplicate when WebSocket added realId first', () => {
      // Both temp and real messages exist (WS added the real one first)
      const messages = [
        createMessage({ id: 'temp-c-3', status: 'pending', deliveryStatus: 'pending' }),
        createMessage({ id: 'real-3', status: 'sent', deliveryStatus: 'sent' })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleMessageConfirmed({ tempId: 'temp-c-3', realId: 'real-3' })

      // The temp message should be removed, real message kept
      expect(state.httpMessages.messages.value).toHaveLength(1)
      expect(state.httpMessages.messages.value[0].id).toBe('real-3')
      expect(state.httpMessages.messages.value[0].status).toBe('sent')
    })

    it('should update file_attachments on confirmed message', () => {
      const messages = [
        createMessage({ id: 'temp-c-4', status: 'pending', deliveryStatus: 'pending' })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      const fileAttachments = [
        { id: 'f1', filename: 'doc.pdf', mimeType: 'application/pdf', fileSize: 5000, fileUrl: '/files/doc.pdf' }
      ]

      handlers.handleMessageConfirmed({
        tempId: 'temp-c-4',
        realId: 'real-4',
        file_attachments: fileAttachments
      })

      const msg = state.httpMessages.messages.value[0]
      expect(msg.file_attachments).toEqual(fileAttachments)
    })

    it('should update file_attachments on existing real message during race condition', () => {
      const messages = [
        createMessage({ id: 'temp-c-5', status: 'pending', deliveryStatus: 'pending' }),
        createMessage({ id: 'real-5', status: 'sent', deliveryStatus: 'sent' })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      const fileAttachments = [
        { id: 'f2', filename: 'img.png', mimeType: 'image/png', fileSize: 2000, fileUrl: '/files/img.png' }
      ]

      handlers.handleMessageConfirmed({
        tempId: 'temp-c-5',
        realId: 'real-5',
        file_attachments: fileAttachments
      })

      const remaining = state.httpMessages.messages.value
      expect(remaining).toHaveLength(1)
      expect(remaining[0].file_attachments).toEqual(fileAttachments)
    })

    it('should handle edge case: only realId exists', () => {
      const messages = [
        createMessage({ id: 'real-6', status: 'pending', deliveryStatus: 'pending' })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleMessageConfirmed({ tempId: 'temp-gone', realId: 'real-6' })

      expect(state.httpMessages.messages.value[0].status).toBe('sent')
    })

    it('should handle edge case: neither tempId nor realId exist', () => {
      state = createMockState([])
      handlers = useMessageHandlers('conv-1', state)

      expect(() =>
        handlers.handleMessageConfirmed({ tempId: 'ghost-temp', realId: 'ghost-real' })
      ).not.toThrow()
    })

    it('should track correlationId to realId mapping', () => {
      const messages = [createMessage({ id: 'temp-corr', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      // Simulate pending with correlationId
      handlers.pendingByCorrelationId.set('corr-123', {
        tempId: 'temp-corr',
        correlationId: 'corr-123',
        content: 'Test',
        createdAt: Date.now()
      })

      handlers.handleMessageConfirmed({ tempId: 'temp-corr', realId: 'real-corr' })

      expect(handlers.pendingByCorrelationId.has('corr-123')).toBe(false)
      expect(handlers.correlationToRealId.get('corr-123')).toBe('real-corr')
    })

    it('should use explicit correlationId from data over lookup', () => {
      const messages = [createMessage({ id: 'temp-ec', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleMessageConfirmed({
        tempId: 'temp-ec',
        realId: 'real-ec',
        correlationId: 'explicit-corr'
      })

      expect(handlers.correlationToRealId.get('explicit-corr')).toBe('real-ec')
    })

    it('should clean up sentMessageIds after timeout', () => {
      const messages = [createMessage({ id: 'temp-cleanup', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleMessageConfirmed({ tempId: 'temp-cleanup', realId: 'real-cleanup' })

      expect(handlers.sentMessageIds.has('real-cleanup')).toBe(true)

      // Advance 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(handlers.sentMessageIds.has('real-cleanup')).toBe(false)
    })

    it('should clean up correlationToRealId after timeout', () => {
      const messages = [createMessage({ id: 'temp-ct', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)
      handlers.pendingByCorrelationId.set('corr-ct', {
        tempId: 'temp-ct', correlationId: 'corr-ct', content: 'x', createdAt: Date.now()
      })

      handlers.handleMessageConfirmed({ tempId: 'temp-ct', realId: 'real-ct' })

      expect(handlers.correlationToRealId.has('corr-ct')).toBe(true)

      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(handlers.correlationToRealId.has('corr-ct')).toBe(false)
    })
  })

  describe('handleMessageFailed', () => {
    it('should mark message as failed', () => {
      const messages = [
        createMessage({
          id: 'temp-f-1',
          status: 'pending',
          deliveryStatus: 'pending',
          metadata: {}
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      const data: MessageFailedData = {
        tempId: 'temp-f-1',
        error: 'Network error'
      }

      handlers.handleMessageFailed(data)

      const msg = state.httpMessages.messages.value[0]
      expect(msg.status).toBe('failed')
      expect(msg.deliveryStatus).toBe('failed')
      const meta = msg.metadata as Record<string, unknown>
      expect(meta.error).toBe('Network error')
    })

    it('should store retry data in metadata', () => {
      const messages = [
        createMessage({
          id: 'temp-f-2',
          status: 'pending',
          deliveryStatus: 'pending',
          metadata: {}
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      const retryAttachments = [
        { name: 'test.txt', size: 4, file: mockFile, isImage: false, fileType: 'Text', typeColor: 'gray' }
      ]

      handlers.handleMessageFailed({
        tempId: 'temp-f-2',
        error: 'Upload failed',
        retryData: {
          content: 'Retry content',
          attachments: retryAttachments
        }
      })

      const meta = state.httpMessages.messages.value[0].metadata as Record<string, unknown>
      expect(meta.retryContent).toBe('Retry content')
      expect(meta.retryAttachments).toEqual(retryAttachments)
    })

    it('should be a no-op if message not found', () => {
      state = createMockState([])
      handlers = useMessageHandlers('conv-1', state)

      expect(() =>
        handlers.handleMessageFailed({ tempId: 'nonexistent', error: 'Error' })
      ).not.toThrow()
    })
  })

  describe('updateOptimisticMessageStatus', () => {
    it('should update status of existing message', () => {
      const messages = [createMessage({ id: 'opt-1', status: 'pending', deliveryStatus: 'pending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.updateOptimisticMessageStatus('opt-1', 'sending')

      expect(state.httpMessages.messages.value[0].status).toBe('sending')
      expect(state.httpMessages.messages.value[0].deliveryStatus).toBe('sending')
    })

    it('should update to sent status', () => {
      const messages = [createMessage({ id: 'opt-2', status: 'sending', deliveryStatus: 'sending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.updateOptimisticMessageStatus('opt-2', 'sent')

      expect(state.httpMessages.messages.value[0].status).toBe('sent')
    })

    it('should update to failed status', () => {
      const messages = [createMessage({ id: 'opt-3', status: 'sending', deliveryStatus: 'sending' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.updateOptimisticMessageStatus('opt-3', 'failed')

      expect(state.httpMessages.messages.value[0].status).toBe('failed')
    })

    it('should be a no-op if message not found', () => {
      state = createMockState([])
      handlers = useMessageHandlers('conv-1', state)

      expect(() => handlers.updateOptimisticMessageStatus('missing', 'sent')).not.toThrow()
    })
  })

  describe('isSentMessage', () => {
    it('should return true for messageId in pendingMessageIds', () => {
      handlers.pendingMessageIds.add('pend-1')
      expect(handlers.isSentMessage('pend-1')).toBe(true)
    })

    it('should return true for messageId in sentMessageIds', () => {
      handlers.sentMessageIds.add('sent-1')
      expect(handlers.isSentMessage('sent-1')).toBe(true)
    })

    it('should return false for unknown messageId', () => {
      expect(handlers.isSentMessage('unknown-id')).toBe(false)
    })

    it('should return true when correlationId is in pendingByCorrelationId', () => {
      handlers.pendingByCorrelationId.set('corr-x', {
        tempId: 'temp-x', correlationId: 'corr-x', content: 'test', createdAt: Date.now()
      })

      expect(handlers.isSentMessage('any-id', 'corr-x')).toBe(true)
    })

    it('should return true when correlationId maps to a known realId', () => {
      handlers.correlationToRealId.set('corr-y', 'real-y')
      handlers.sentMessageIds.add('real-y')

      expect(handlers.isSentMessage('some-id', 'corr-y')).toBe(true)
    })

    it('should return true when correlationId maps to the given messageId', () => {
      handlers.correlationToRealId.set('corr-z', 'real-z')

      expect(handlers.isSentMessage('real-z', 'corr-z')).toBe(true)
    })

    it('should return true when messageId is found via correlation mapping reverse lookup', () => {
      handlers.correlationToRealId.set('corr-rev', 'real-rev')

      // No correlationId passed, but messageId matches a realId in correlationToRealId
      expect(handlers.isSentMessage('real-rev')).toBe(true)
    })

    it('should return false when correlationId does not match anything', () => {
      expect(handlers.isSentMessage('nothing', 'no-corr')).toBe(false)
    })
  })

  describe('getTempIdByCorrelationId', () => {
    it('should return tempId for known correlationId', () => {
      handlers.pendingByCorrelationId.set('corr-lookup', {
        tempId: 'temp-lookup', correlationId: 'corr-lookup', content: 'hi', createdAt: Date.now()
      })

      expect(handlers.getTempIdByCorrelationId('corr-lookup')).toBe('temp-lookup')
    })

    it('should return undefined for unknown correlationId', () => {
      expect(handlers.getTempIdByCorrelationId('unknown')).toBeUndefined()
    })
  })

  describe('getRealIdByCorrelationId', () => {
    it('should return realId for known correlationId', () => {
      handlers.correlationToRealId.set('corr-real', 'real-id')

      expect(handlers.getRealIdByCorrelationId('corr-real')).toBe('real-id')
    })

    it('should return undefined for unknown correlationId', () => {
      expect(handlers.getRealIdByCorrelationId('unknown')).toBeUndefined()
    })
  })

  describe('retryFailedMessage', () => {
    it('should retry a failed text message successfully', async () => {
      const messages = [
        createMessage({
          id: 'retry-1',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Retry me',
          metadata: { error: 'Previous error' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      await handlers.retryFailedMessage('retry-1')

      expect(state.httpMessages.sendMessage).toHaveBeenCalledWith('Retry me')
      expect(state.httpMessages.messages.value[0].status).toBe('sent')
      expect(mockShowSuccess).toHaveBeenCalled()
    })

    it('should do nothing if message is not found', async () => {
      state = createMockState([])
      handlers = useMessageHandlers('conv-1', state)

      await handlers.retryFailedMessage('nonexistent')

      expect(state.httpMessages.sendMessage).not.toHaveBeenCalled()
    })

    it('should do nothing if message is not in failed status', async () => {
      const messages = [createMessage({ id: 'not-failed', status: 'sent', deliveryStatus: 'sent' })]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      await handlers.retryFailedMessage('not-failed')

      expect(state.httpMessages.sendMessage).not.toHaveBeenCalled()
    })

    it('should use retryContent from metadata if available', async () => {
      const messages = [
        createMessage({
          id: 'retry-meta',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Original',
          metadata: { retryContent: 'Corrected content', error: 'err' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      await handlers.retryFailedMessage('retry-meta')

      expect(state.httpMessages.sendMessage).toHaveBeenCalledWith('Corrected content')
    })

    it('should retry with attachments and re-upload files', async () => {
      const mockFile = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
      const retryAttachments = [
        { name: 'doc.pdf', size: 4, file: mockFile, isImage: false, fileType: 'PDF', typeColor: 'red' }
      ]

      const messages = [
        createMessage({
          id: 'retry-att',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'With file',
          metadata: {
            error: 'Upload failed',
            retryContent: 'With file',
            retryAttachments
          }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      mockUploadSingleFile.mockResolvedValue({ success: true, fileId: 'uploaded-1' })

      await handlers.retryFailedMessage('retry-att')

      expect(mockUploadSingleFile).toHaveBeenCalledTimes(1)
      expect(state.httpMessages.sendMessageWithAttachments).toHaveBeenCalledWith(
        'With file',
        ['uploaded-1'],
        { messageType: 'file', platform: 'line' }
      )
      expect(mockShowSuccess).toHaveBeenCalled()
    })

    it('should mark as failed if upload fails during retry', async () => {
      const mockFile = new File(['data'], 'fail.txt', { type: 'text/plain' })
      const retryAttachments = [
        { name: 'fail.txt', size: 4, file: mockFile, isImage: false, fileType: 'Text', typeColor: 'gray' }
      ]

      const messages = [
        createMessage({
          id: 'retry-fail-upload',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Fail upload',
          metadata: { retryContent: 'Fail upload', retryAttachments, error: 'old' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      mockUploadSingleFile.mockResolvedValue({ success: false, error: 'Upload error' })

      await handlers.retryFailedMessage('retry-fail-upload')

      expect(state.httpMessages.messages.value[0].status).toBe('failed')
      expect(mockShowError).toHaveBeenCalled()
    })

    it('should mark as failed if sendMessage returns false', async () => {
      const messages = [
        createMessage({
          id: 'retry-send-fail',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Send fail',
          metadata: { error: 'Previous' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)
      ;(state.httpMessages.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      await handlers.retryFailedMessage('retry-send-fail')

      expect(state.httpMessages.messages.value[0].status).toBe('failed')
      expect(mockShowError).toHaveBeenCalled()
    })

    it('should mark as failed if an exception occurs during retry', async () => {
      const messages = [
        createMessage({
          id: 'retry-exception',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Exception',
          metadata: { error: 'old' }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)
      ;(state.httpMessages.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'))

      await handlers.retryFailedMessage('retry-exception')

      expect(state.httpMessages.messages.value[0].status).toBe('failed')
      expect(mockShowError).toHaveBeenCalled()
    })

    it('should clean retry metadata on successful retry', async () => {
      const messages = [
        createMessage({
          id: 'retry-clean',
          status: 'failed',
          deliveryStatus: 'failed',
          content: 'Clean',
          metadata: {
            error: 'old error',
            retryContent: 'Clean',
            retryAttachments: [],
            uploadStatus: 'uploading',
            uploadProgress: 50
          }
        })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      await handlers.retryFailedMessage('retry-clean')

      const meta = state.httpMessages.messages.value[0].metadata as Record<string, unknown>
      expect(meta.retryContent).toBeUndefined()
      expect(meta.retryAttachments).toBeUndefined()
      expect(meta.uploadStatus).toBeUndefined()
      expect(meta.uploadProgress).toBeUndefined()
      expect(meta.error).toBeUndefined()
    })
  })

  describe('full message lifecycle', () => {
    it('should track message from pending to confirmed', () => {
      // Step 1: Message pending
      handlers.handleMessagePending({
        tempId: 'lifecycle-temp',
        correlationId: 'lifecycle-corr',
        content: 'Lifecycle test',
        attachments: [],
        status: 'sending'
      })

      expect(handlers.pendingMessageIds.has('lifecycle-temp')).toBe(true)
      expect(handlers.pendingByCorrelationId.has('lifecycle-corr')).toBe(true)
      expect(handlers.isSentMessage('lifecycle-temp')).toBe(true)
      expect(handlers.isSentMessage('any', 'lifecycle-corr')).toBe(true)

      // Step 2: Message confirmed
      handlers.handleMessageConfirmed({
        tempId: 'lifecycle-temp',
        realId: 'lifecycle-real',
        correlationId: 'lifecycle-corr'
      })

      expect(handlers.pendingMessageIds.has('lifecycle-temp')).toBe(false)
      expect(handlers.sentMessageIds.has('lifecycle-real')).toBe(true)
      expect(handlers.isSentMessage('lifecycle-real')).toBe(true)
      expect(handlers.pendingByCorrelationId.has('lifecycle-corr')).toBe(false)
      expect(handlers.correlationToRealId.get('lifecycle-corr')).toBe('lifecycle-real')

      // Verify getTempIdByCorrelationId no longer returns (pending cleared)
      expect(handlers.getTempIdByCorrelationId('lifecycle-corr')).toBeUndefined()
      // Verify getRealIdByCorrelationId returns the real ID
      expect(handlers.getRealIdByCorrelationId('lifecycle-corr')).toBe('lifecycle-real')
    })

    it('should track message from pending to failed', () => {
      const messages = [
        createMessage({ id: 'fail-lifecycle', status: 'pending', deliveryStatus: 'pending', metadata: {} })
      ]
      state = createMockState(messages)
      handlers = useMessageHandlers('conv-1', state)

      handlers.handleMessageFailed({
        tempId: 'fail-lifecycle',
        error: 'Server error',
        retryData: { content: 'retry', attachments: [] }
      })

      const msg = state.httpMessages.messages.value[0]
      expect(msg.status).toBe('failed')
      expect((msg.metadata as Record<string, unknown>).error).toBe('Server error')
    })
  })
})
