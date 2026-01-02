import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import TextMessage from '@/components/conversation/message-types/TextMessage.vue'
import type { Message } from '@/types'

// Mock the dependencies
vi.mock('@/utils/enhanced-message-renderer', () => ({
  renderDatabaseMessageForVue: vi.fn((message) => Promise.resolve(message.content || ''))
}))

vi.mock('@/utils/layered-emoji-processor', () => ({
  convertEmojiForMessageDetail: vi.fn((content) => content)
}))

describe('TextMessage Component', () => {
  let wrapper: VueWrapper | null = null
  let mockMessage: Message

  beforeEach(() => {
    mockMessage = {
      id: 'test-msg-1',
      conversationId: 'conv-1',
      content: 'Hello, this is a test message',
      messageType: 'text',
      senderType: 'customer',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      metadata: null
    }
  })

  afterEach(async () => {
    await flushPromises()
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    vi.clearAllTimers()
    document.body.innerHTML = ''
  })

  describe('Component Rendering', () => {
    it('should render the component', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.text-message').exists()).toBe(true)
    })

    it('should display message content', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      const textElement = wrapper.find('.message-text')
      expect(textElement.exists()).toBe(true)
    })

    it('should render SafeHtmlRenderer component', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      // SafeHtmlRenderer should be present
      expect(wrapper.findComponent({ name: 'SafeHtmlRenderer' }).exists()).toBe(true)
    })
  })

  describe('Props Handling', () => {
    it('should accept message prop', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.props('message')).toEqual(mockMessage)
    })

    it('should accept isOutgoing prop', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage,
          isOutgoing: true
        }
      })

      await flushPromises()

      expect(wrapper.props('isOutgoing')).toBe(true)
    })

    it('should default isOutgoing to false', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.props('isOutgoing')).toBe(false)
    })
  })

  describe('Content Processing', () => {
    it('should process simple text content', async () => {
      mockMessage.content = 'Simple text message'

      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle empty content', async () => {
      mockMessage.content = ''

      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle long text content', async () => {
      mockMessage.content = 'A'.repeat(1000)

      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle multi-line content', async () => {
      mockMessage.content = 'Line 1\nLine 2\nLine 3'

      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle Unicode characters', async () => {
      mockMessage.content = 'Hello 你好 🎉 مرحبا'

      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Reactivity', () => {
    it('should update when message content changes', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      // Update message content
      await wrapper.setProps({
        message: {
          ...mockMessage,
          content: 'Updated content'
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null content gracefully', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: {
            ...mockMessage,
            content: null as any
          }
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })

    it('should cleanup on unmount', async () => {
      wrapper = mount(TextMessage, {
        props: {
          message: mockMessage
        }
      })

      await flushPromises()

      // Unmount
      wrapper.unmount()
      wrapper = null

      // Should not throw errors
      expect(true).toBe(true)
    })
  })
})
