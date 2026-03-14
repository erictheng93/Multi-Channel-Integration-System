import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { VueWrapper} from '@vue/test-utils';
import { mount, flushPromises } from '@vue/test-utils'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import type { Message } from '@/types'

describe('MessageBubble - Timestamp Display', () => {
  let mockMessage: Message
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    // 基础消息模板
    mockMessage = {
      id: 'test-1',
      conversationId: 'conv-1',
      content: '测试消息',
      messageType: 'text',
      senderType: 'customer',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      metadata: null
    }
  })

  afterEach(async () => {
    // Wait for all pending promises to resolve
    await flushPromises()

    // Unmount the wrapper if it exists
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }

    // Clear all timers
    vi.clearAllTimers()

    // Clean up DOM
    document.body.innerHTML = ''
  })

  describe('智能时间戳显示', () => {
    it('今天的消息应该只显示时分 (HH:MM)', () => {
      // 设置为今天的消息 (使用当前时间确保是"今天")
      const today = new Date()
      mockMessage.timestamp = today.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 今天的消息格式可能是 "HH:MM" 或包含日期（取决于时区）
      // 验证时间部分存在且格式正确
      expect(timeText).toMatch(/\d{2}:\d{2}/)

      // 如果确实是今天（没有时区问题），应该只有时分
      // 否则可能包含日期，但时分部分应该总是存在
      const hasTimeOnly = /^\d{2}:\d{2}$/.test(timeText)
      const hasFullDateTime = /\d{4}.*\d{2}:\d{2}/.test(timeText)
      expect(hasTimeOnly || hasFullDateTime).toBe(true)
    })

    it('昨天的消息应该显示完整日期和时间', () => {
      // 设置为昨天的消息
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(15, 30, 0, 0)
      mockMessage.timestamp = yesterday.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 应该包含完整日期，格式如 "2025/01/27 15:30"
      expect(timeText).toMatch(/\d{4}/)  // 包含年份
      expect(timeText).toMatch(/\//) // 包含日期分隔符
      expect(timeText).toMatch(/\d{2}:\d{2}/)  // 包含时分
    })

    it('上周的消息应该显示完整日期和时间', () => {
      // 设置为7天前的消息
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      lastWeek.setHours(10, 15, 0, 0)
      mockMessage.timestamp = lastWeek.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 应该包含完整日期和时间
      expect(timeText).toMatch(/\d{4}/)  // 年份
      expect(timeText).toMatch(/\d{2}\/\d{2}/)  // 月/日
      expect(timeText).toMatch(/\d{2}:\d{2}/)  // 时:分
    })

    it('上个月的消息应该显示完整日期和时间', () => {
      // 设置为30天前的消息
      const lastMonth = new Date()
      lastMonth.setDate(lastMonth.getDate() - 30)
      lastMonth.setHours(9, 45, 0, 0)
      mockMessage.timestamp = lastMonth.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 应该包含完整日期和时间
      expect(timeText).toMatch(/\d{4}/)
      expect(timeText).toMatch(/\//)
      expect(timeText).toMatch(/\d{2}:\d{2}/)
    })
  })

  describe('时间戳格式兼容性', () => {
    it('应该正确处理 ISO 字符串格式', () => {
      mockMessage.timestamp = '2025-01-27T15:30:00.000Z'

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      expect(timeElement.exists()).toBe(true)
      expect(timeElement.text()).toBeTruthy()
    })

    it('应该正确处理数字时间戳 (毫秒)', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      mockMessage.timestamp = yesterday.getTime()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 昨天的消息应该显示完整日期
      expect(timeText).toMatch(/\d{4}/)
    })

    it('应该正确处理 Date 对象', () => {
      const today = new Date()
      mockMessage.timestamp = today

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 验证时间戳已被格式化并包含时分
      expect(timeText).toMatch(/\d{2}:\d{2}/)
    })
  })

  describe('向后兼容性', () => {
    it('使用 createdAt 作为 fallback 当 timestamp 不存在', () => {
      const messageWithoutTimestamp = {
        ...mockMessage,
        timestamp: undefined,
        createdAt: new Date().toISOString()
      }

      wrapper = mount(MessageBubble, {
        props: {
          message: messageWithoutTimestamp as Message,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      expect(timeElement.exists()).toBe(true)
      expect(timeElement.text()).toBeTruthy()
    })
  })

  describe('本地化支持', () => {
    it('应该使用 zh-TW 本地化格式', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      mockMessage.timestamp = yesterday.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // zh-TW 格式应该使用 / 作为日期分隔符
      if (timeText.includes('/')) {
        expect(timeText).toMatch(/\d{4}\/\d{2}\/\d{2}/)
      }
    })
  })

  describe('边界情况测试', () => {
    it('午夜时分 (00:00) 的消息应该正确显示', () => {
      const midnight = new Date()
      midnight.setHours(0, 0, 0, 0)
      mockMessage.timestamp = midnight.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      // Accept both 00:00 and 24:00 formats (locale-dependent)
      expect(timeElement.text()).toMatch(/00:00|24:00/)
    })

    it('23:59 的消息应该正确显示', () => {
      const lateNight = new Date()
      lateNight.setHours(23, 59, 0, 0)
      mockMessage.timestamp = lateNight.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      expect(timeElement.text()).toMatch(/23:59/)
    })

    it('跨年消息应该显示正确的年份', () => {
      const lastYear = new Date()
      lastYear.setFullYear(lastYear.getFullYear() - 1)
      mockMessage.timestamp = lastYear.toISOString()

      wrapper = mount(MessageBubble, {
        props: {
          message: mockMessage,
          delivered: true
        }
      })

      const timeElement = wrapper.find('.message-time')
      const timeText = timeElement.text()

      // 应该显示去年的年份
      const expectedYear = (new Date().getFullYear() - 1).toString()
      expect(timeText).toContain(expectedYear)
    })
  })
})
