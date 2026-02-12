/**
 * Tests for useMessageActions composable
 *
 * @module tests/unit/composables/useMessageActions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMessageActions } from '@/composables/message/useMessageActions'
import type { Message } from '@/types'

// Helper function to create a test message
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-id',
    conversationId: 'conv-1',
    content: 'Test message content',
    senderType: 'customer',
    timestamp: new Date(),
    ...overrides
  } as Message
}

describe('useMessageActions', () => {
  let mockEmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockEmit = {
      copy: vi.fn(),
      reply: vi.fn(),
      forward: vi.fn(),
      recall: vi.fn(),
      select: vi.fn(),
      retry: vi.fn()
    }
  })

  describe('State management', () => {
    it('should initialize with hidden states', () => {
      const props = ref({ message: createMessage() })
      const { showActions, showActionsMenu } = useMessageActions(props, mockEmit)

      expect(showActions.value).toBe(false)
      expect(showActionsMenu.value).toBe(false)
    })

    it('should toggle showActions', () => {
      const props = ref({ message: createMessage() })
      const { showActions, setShowActions } = useMessageActions(props, mockEmit)

      setShowActions(true)
      expect(showActions.value).toBe(true)

      setShowActions(false)
      expect(showActions.value).toBe(false)
    })
  })

  describe('handleRightClick', () => {
    it('should prevent default and toggle menu', () => {
      const props = ref({ message: createMessage() })
      const { handleRightClick, showActionsMenu, showActions } = useMessageActions(props, mockEmit)

      const mockEvent = {
        preventDefault: vi.fn()
      } as any

      handleRightClick(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(showActionsMenu.value).toBe(true)
      expect(showActions.value).toBe(true)
    })

    it('should toggle menu off when called again', () => {
      const props = ref({ message: createMessage() })
      const { handleRightClick, showActionsMenu } = useMessageActions(props, mockEmit)

      const mockEvent = { preventDefault: vi.fn() } as any

      handleRightClick(mockEvent)
      expect(showActionsMenu.value).toBe(true)

      handleRightClick(mockEvent)
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('toggleActionsMenu', () => {
    it('should toggle menu state', () => {
      const props = ref({ message: createMessage() })
      const { toggleActionsMenu, showActionsMenu } = useMessageActions(props, mockEmit)

      expect(showActionsMenu.value).toBe(false)

      toggleActionsMenu()
      expect(showActionsMenu.value).toBe(true)

      toggleActionsMenu()
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('copyMessage', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      // Mock execCommand for fallback testing
      if (!document.execCommand) {
        document.execCommand = vi.fn().mockReturnValue(true)
      }
    })

    it('should copy message content using clipboard API', async () => {
      const props = ref({ message: createMessage({ content: 'Copy this text' }) })
      const { copyMessage, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true

      await copyMessage()

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy this text')
      expect(mockEmit.copy).toHaveBeenCalledWith(props.value.message)
      expect(showActionsMenu.value).toBe(false)
    })

    it('should handle clipboard API failure with fallback', async () => {
      // Mock clipboard API to fail
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard API failed'))
        }
      })

      const props = ref({ message: createMessage({ content: 'Fallback copy' }) })
      const { copyMessage } = useMessageActions(props, mockEmit)

      // Mock document methods for fallback
      const createElement = vi.spyOn(document, 'createElement')
      const appendChild = vi.spyOn(document.body, 'appendChild')
      const removeChild = vi.spyOn(document.body, 'removeChild')

      // Ensure execCommand is properly mocked
      const execCommandMock = vi.fn().mockReturnValue(true)
      document.execCommand = execCommandMock

      const mockTextArea = {
        value: '',
        style: {},
        focus: vi.fn(),
        select: vi.fn()
      } as any

      createElement.mockReturnValue(mockTextArea)
      appendChild.mockImplementation(() => mockTextArea)
      removeChild.mockImplementation(() => mockTextArea)

      await copyMessage()

      expect(mockTextArea.value).toBe('Fallback copy')
      expect(mockTextArea.focus).toHaveBeenCalled()
      expect(mockTextArea.select).toHaveBeenCalled()
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(mockEmit.copy).toHaveBeenCalledWith(props.value.message)

      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })

  describe('replyToMessage', () => {
    it('should emit reply event and close menu', () => {
      const props = ref({ message: createMessage() })
      const { replyToMessage, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true
      replyToMessage()

      expect(mockEmit.reply).toHaveBeenCalledWith(props.value.message)
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('forwardMessage', () => {
    it('should emit forward event and close menu', () => {
      const props = ref({ message: createMessage() })
      const { forwardMessage, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true
      forwardMessage()

      expect(mockEmit.forward).toHaveBeenCalledWith(props.value.message)
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('recallMessage', () => {
    it('should emit recall event and close menu', () => {
      const props = ref({ message: createMessage() })
      const { recallMessage, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true
      recallMessage()

      expect(mockEmit.recall).toHaveBeenCalledWith(props.value.message)
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('selectMessage', () => {
    it('should emit select event and close menu', () => {
      const props = ref({ message: createMessage() })
      const { selectMessage, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true
      selectMessage()

      expect(mockEmit.select).toHaveBeenCalledWith(props.value.message)
      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('handleRetry', () => {
    it('should emit retry event with message ID', () => {
      const props = ref({ message: createMessage({ id: 'failed-msg-123' }) })
      const { handleRetry } = useMessageActions(props, mockEmit)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      handleRetry()

      expect(mockEmit.retry).toHaveBeenCalledWith('failed-msg-123')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('closeActionsMenu', () => {
    it('should close the actions menu', () => {
      const props = ref({ message: createMessage() })
      const { closeActionsMenu, showActionsMenu } = useMessageActions(props, mockEmit)

      showActionsMenu.value = true
      closeActionsMenu()

      expect(showActionsMenu.value).toBe(false)
    })
  })

  describe('Reactive updates', () => {
    beforeEach(() => {
      // Mock clipboard API for copyMessage tests
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })
    })

    it('should react to message changes', async () => {
      const message1 = createMessage({ id: 'msg-1', content: 'First' })
      const message2 = createMessage({ id: 'msg-2', content: 'Second' })

      const props = ref({ message: message1 })
      const { copyMessage } = useMessageActions(props, mockEmit)

      // Change message
      props.value.message = message2

      await copyMessage()

      expect(mockEmit.copy).toHaveBeenCalledWith(message2)
    })
  })
})
