import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import type { Message } from '@/types'

// Fixed local "now" so the today / not-today boundary never depends on when the suite runs.
const NOW = new Date(2026, 10, 25, 12, 0, 0)

describe('MessageBubble - Timestamp Display', () => {
  let mockMessage: Message
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockMessage = {
      id: 'test-1',
      conversationId: 'conv-1',
      content: '测试消息',
      messageType: 'text',
      senderType: 'customer',
      timestamp: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      metadata: null
    }
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const renderTime = (message: Message): string => {
    wrapper = mount(MessageBubble, { props: { message, delivered: true } })
    // ICU versions differ on the separator between date and time (space vs thin space)
    return wrapper.find('.message-time').text().replace(/\s+/g, ' ')
  }

  describe('智能时间戳显示', () => {
    it('今天的消息只显示时分 (HH:MM)', () => {
      mockMessage.timestamp = new Date(2026, 10, 25, 9, 5).toISOString()
      expect(renderTime(mockMessage)).toBe('09:05')
    })

    it('昨天的消息显示完整日期和时间', () => {
      mockMessage.timestamp = new Date(2026, 10, 24, 15, 30).toISOString()
      expect(renderTime(mockMessage)).toBe('2026/11/24 15:30')
    })

    it('30 天前的消息显示完整日期和时间', () => {
      mockMessage.timestamp = new Date(2026, 9, 26, 9, 45).toISOString()
      expect(renderTime(mockMessage)).toBe('2026/10/26 09:45')
    })

    it('跨年消息显示去年的年份', () => {
      mockMessage.timestamp = new Date(2025, 10, 25, 10, 15).toISOString()
      expect(renderTime(mockMessage)).toBe('2025/11/25 10:15')
    })
  })

  describe('时间戳格式兼容性', () => {
    it('接受数字时间戳 (毫秒)', () => {
      mockMessage.timestamp = new Date(2026, 10, 24, 8, 0).getTime()
      expect(renderTime(mockMessage)).toBe('2026/11/24 08:00')
    })

    it('接受 Date 对象', () => {
      mockMessage.timestamp = new Date(2026, 10, 25, 7, 30)
      expect(renderTime(mockMessage)).toBe('07:30')
    })

    it('timestamp 不存在时使用 createdAt', () => {
      const message = {
        ...mockMessage,
        timestamp: undefined,
        createdAt: new Date(2026, 10, 25, 6, 45).toISOString()
      } as Message
      expect(renderTime(message)).toBe('06:45')
    })
  })

  describe('边界情况', () => {
    it('23:59 仍属于今天，只显示时分', () => {
      mockMessage.timestamp = new Date(2026, 10, 25, 23, 59).toISOString()
      expect(renderTime(mockMessage)).toBe('23:59')
    })

    it('昨天 23:59 与今天 00:00 的显示格式不同', () => {
      mockMessage.timestamp = new Date(2026, 10, 24, 23, 59).toISOString()
      expect(renderTime(mockMessage)).toBe('2026/11/24 23:59')
      wrapper?.unmount()

      mockMessage.timestamp = new Date(2026, 10, 25, 0, 0).toISOString()
      expect(renderTime(mockMessage)).toMatch(/^(00|24):00$/)
    })
  })
})
