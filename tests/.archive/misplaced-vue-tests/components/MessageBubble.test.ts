// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/components/MessageBubble.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageBubble from '@/components/conversation/MessageBubble.vue'

describe('MessageBubble Component', () => {
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props: any = {}) => {
    return mount(MessageBubble, {
      props: {
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User',
          ...props.message
        },
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render message content', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Hello World',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.text()).toContain('Hello World')
    })

    it('should apply correct CSS classes for incoming messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.classes()).toContain('message-bubble')
      expect(wrapper.classes()).toContain('incoming')
    })

    it('should apply correct CSS classes for outgoing messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'outgoing',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Agent'
        }
      })

      expect(wrapper.classes()).toContain('message-bubble')
      expect(wrapper.classes()).toContain('outgoing')
    })

    it('should display sender name for incoming messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'John Doe'
        }
      })

      expect(wrapper.text()).toContain('John Doe')
    })

    it('should display timestamp', () => {
      const timestamp = new Date('2024-01-01T12:00:00Z').toISOString()
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp,
          senderName: 'Test User'
        }
      })

      // Should contain formatted time
      expect(wrapper.html()).toContain('12:00')
    })
  })

  describe('Message Types', () => {
    it('should render text messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'This is a text message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.message-content').text()).toBe('This is a text message')
    })

    it('should render image messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'https://example.com/image.jpg',
          messageType: 'image',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('img').exists()).toBe(true)
      expect(wrapper.find('img').attributes('src')).toBe('https://example.com/image.jpg')
    })

    it('should render file messages', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'document.pdf',
          messageType: 'file',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.file-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('document.pdf')
    })
  })

  describe('Platform Indicators', () => {
    it('should show LINE platform indicator', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.platform-indicator').exists()).toBe(true)
      expect(wrapper.find('.platform-indicator').classes()).toContain('line')
    })

    it('should show Facebook platform indicator', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'facebook',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.platform-indicator').exists()).toBe(true)
      expect(wrapper.find('.platform-indicator').classes()).toContain('facebook')
    })
  })

  describe('Message Status', () => {
    it('should show sending status', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'outgoing',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Agent',
          status: 'sending'
        }
      })

      expect(wrapper.find('.message-status').exists()).toBe(true)
      expect(wrapper.find('.message-status').classes()).toContain('sending')
    })

    it('should show sent status', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'outgoing',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Agent',
          status: 'sent'
        }
      })

      expect(wrapper.find('.message-status').exists()).toBe(true)
      expect(wrapper.find('.message-status').classes()).toContain('sent')
    })

    it('should show error status', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'outgoing',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Agent',
          status: 'error'
        }
      })

      expect(wrapper.find('.message-status').exists()).toBe(true)
      expect(wrapper.find('.message-status').classes()).toContain('error')
    })
  })

  describe('Long Messages', () => {
    it('should handle long text messages', () => {
      const longMessage = 'A'.repeat(1000)
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: longMessage,
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.message-content').text()).toBe(longMessage)
    })

    it('should preserve line breaks in messages', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3'
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: multilineMessage,
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.message-content').html()).toContain('Line 1<br>Line 2<br>Line 3')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      expect(wrapper.attributes('role')).toBe('article')
      expect(wrapper.attributes('aria-label')).toContain('Test User')
    })

    it('should have proper alt text for images', () => {
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'https://example.com/image.jpg',
          messageType: 'image',
          direction: 'incoming',
          platform: 'line',
          timestamp: new Date().toISOString(),
          senderName: 'Test User'
        }
      })

      const img = wrapper.find('img')
      expect(img.attributes('alt')).toBe('Image from Test User')
    })
  })

  describe('Time Formatting', () => {
    it('should format time correctly', () => {
      const timestamp = new Date('2024-01-01T14:30:00Z').toISOString()
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp,
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.message-time').text()).toBe('14:30')
    })

    it('should handle different time zones', () => {
      const timestamp = new Date('2024-01-01T09:15:00Z').toISOString()
      const wrapper = createWrapper({
        message: {
          id: 'msg-1',
          content: 'Test message',
          messageType: 'text',
          direction: 'incoming',
          platform: 'line',
          timestamp,
          senderName: 'Test User'
        }
      })

      expect(wrapper.find('.message-time').text()).toBe('09:15')
    })
  })
})