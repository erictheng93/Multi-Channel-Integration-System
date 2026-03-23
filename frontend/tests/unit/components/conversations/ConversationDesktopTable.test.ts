/**
 * ConversationDesktopTable.vue Unit Tests
 *
 * Tests:
 * - Table structure rendering (thead, tbody, columns)
 * - Row rendering per conversation
 * - Customer name fallback logic
 * - Platform badge text and class
 * - Status badge text and class
 * - Last message display (with emoji processor mock)
 * - Assigned agent / team display
 * - Timestamp formatting
 * - Click emits 'select' with conversation id
 * - Empty list rendering
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationDesktopTable from '@/components/conversations/ConversationDesktopTable.vue'
import type { Conversation } from '@/types'

// Mock emoji processor
vi.mock('@/utils/layered-emoji-processor', () => ({
  convertEmojiForConversationList: (content: string) => content
}))

const now = new Date('2026-03-06T10:00:00Z')

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    status: 'active',
    unreadCount: 0,
    lastMessageAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides
  } as Conversation
}

function mountTable(conversations: Conversation[]) {
  return mount(ConversationDesktopTable, {
    props: { conversations },
    global: {
      stubs: {
        TransitionGroup: false
      }
    }
  })
}

describe('ConversationDesktopTable.vue', () => {
  describe('Table structure', () => {
    it('should render a table with correct column headers', () => {
      const wrapper = mountTable([])
      const headers = wrapper.findAll('th')
      expect(headers).toHaveLength(6)
      expect(headers[0].text()).toBe('客戶')
      expect(headers[1].text()).toBe('平台')
      expect(headers[2].text()).toBe('狀態')
      expect(headers[3].text()).toBe('最後訊息')
      expect(headers[4].text()).toBe('負責人')
      expect(headers[5].text()).toBe('更新時間')
    })

    it('should render no rows when conversations is empty', () => {
      const wrapper = mountTable([])
      expect(wrapper.findAll('.conversation-row')).toHaveLength(0)
    })
  })

  describe('Row rendering', () => {
    it('should render one row per conversation', () => {
      const conversations = [
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' }),
        createConversation({ id: 'c3' })
      ]
      const wrapper = mountTable(conversations)
      expect(wrapper.findAll('.conversation-row')).toHaveLength(3)
    })

    it('should set animation delay based on index', () => {
      const conversations = [
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' })
      ]
      const wrapper = mountTable(conversations)
      const rows = wrapper.findAll('.conversation-row')
      expect(rows[0].attributes('style')).toContain('animation-delay: 0ms')
      expect(rows[1].attributes('style')).toContain('animation-delay: 50ms')
    })
  })

  describe('Customer name display', () => {
    it('should display customer.name when available', () => {
      const conv = createConversation({
        customer: {
          id: 'c1',
          name: 'Alice',
          platform: 'line',
          platformUserId: 'line-1',
          createdAt: now.toISOString()
        }
      })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.customer-name').text()).toBe('Alice')
    })

    it('should fall back to user.name', () => {
      const conv = createConversation({
        user: {
          id: 'u1',
          name: 'Bob',
          platform: 'facebook',
          platformUserId: 'fb-1',
          createdAt: now.toISOString()
        }
      })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.customer-name').text()).toBe('Bob')
    })

    it('should display "未知用戶" when no customer or user', () => {
      const conv = createConversation()
      const wrapper = mountTable([conv])
      expect(wrapper.find('.customer-name').text()).toBe('未知用戶')
    })

    it('should display userId in customer-id cell', () => {
      const conv = createConversation({ userId: 'uid-42' })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.customer-id').text()).toContain('uid-42')
    })
  })

  describe('Platform badge', () => {
    it.each([
      ['line', 'LINE'],
      ['facebook', 'Facebook'],
      ['instagram', 'Instagram'],
      ['whatsapp', 'WhatsApp']
    ])('should display "%s" as "%s"', (platform, expected) => {
      const conv = createConversation({ platform: platform as Conversation['platform'] })
      const wrapper = mountTable([conv])
      const badge = wrapper.find('.platform-badge')
      expect(badge.text()).toBe(expected)
      expect(badge.classes()).toContain(platform)
    })

    it('should default to LINE when no platform', () => {
      const conv = createConversation()
      // No platform set, no user.platform
      const wrapper = mountTable([conv])
      expect(wrapper.find('.platform-badge').text()).toBe('LINE')
    })
  })

  describe('Status badge', () => {
    const statusCases: Array<[Conversation['status'], string]> = [
      ['active', '進行中'],
      ['assigned', '已指派'],
      ['pending', '待處理'],
      ['in-progress', '處理中'],
      ['waiting', '等待中']
    ]

    it.each(statusCases)('should display status "%s" as "%s"', (status, expected) => {
      const conv = createConversation({ status })
      const wrapper = mountTable([conv])
      const badge = wrapper.find('.status-badge')
      expect(badge.text()).toBe(expected)
      expect(badge.classes()).toContain(status)
    })
  })

  describe('Last message', () => {
    it('should display "暫無訊息" when no lastMessage', () => {
      const conv = createConversation()
      const wrapper = mountTable([conv])
      expect(wrapper.find('.last-message').text()).toBe('暫無訊息')
    })

    it('should display message content when lastMessage exists', () => {
      const conv = createConversation({
        lastMessage: {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderType: 'customer',
          senderId: 'user-1',
          content: 'Hello World',
          messageType: 'text',
          platform: 'line',
          timestamp: now.toISOString(),
          createdAt: now.toISOString()
        }
      })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.last-message').text()).toBe('Hello World')
    })
  })

  describe('Assigned agent', () => {
    it('should display "未指派" when no assignedTeam', () => {
      const conv = createConversation()
      const wrapper = mountTable([conv])
      expect(wrapper.find('.assigned-agent').text()).toBe('未指派')
    })

    it('should display team name when assignedTeam exists', () => {
      const conv = createConversation({
        assignedTeam: { id: 1, name: 'Support Team' }
      })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.assigned-agent').text()).toContain('Support Team')
    })
  })

  describe('Timestamp', () => {
    it('should format updatedAt as locale string', () => {
      const conv = createConversation({ updatedAt: now.toISOString() })
      const wrapper = mountTable([conv])
      const timestamp = wrapper.find('.timestamp').text()
      // The formatted string should contain date components
      expect(timestamp).toBeTruthy()
      expect(timestamp.length).toBeGreaterThan(0)
    })
  })

  describe('Select emit', () => {
    it('should emit "select" with conversation id on row click', async () => {
      const conv = createConversation({ id: 'conv-42' })
      const wrapper = mountTable([conv])
      await wrapper.find('.conversation-row').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual(['conv-42'])
    })

    it('should emit correct id for each row', async () => {
      const conversations = [
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' })
      ]
      const wrapper = mountTable(conversations)
      const rows = wrapper.findAll('.conversation-row')

      await rows[1].trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['c2'])
    })
  })

  describe('Unread indicator', () => {
    it('should show unread dot when conversation has unreadCount > 0', () => {
      const conv = createConversation({ unreadCount: 3 })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.unread-dot').exists()).toBe(true)
    })

    it('should not show unread dot when unreadCount is 0', () => {
      const conv = createConversation({ unreadCount: 0 })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.unread-dot').exists()).toBe(false)
    })

    it('should add has-unread class to row when unread', () => {
      const conv = createConversation({ unreadCount: 5 })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.conversation-row').classes()).toContain('has-unread')
    })

    it('should not add has-unread class when read', () => {
      const conv = createConversation({ unreadCount: 0 })
      const wrapper = mountTable([conv])
      expect(wrapper.find('.conversation-row').classes()).not.toContain('has-unread')
    })

    it('should include sr-only text for accessibility', () => {
      const conv = createConversation({ unreadCount: 2 })
      const wrapper = mountTable([conv])
      const srOnly = wrapper.find('.sr-only')
      expect(srOnly.exists()).toBe(true)
      expect(srOnly.text()).toContain('未讀')
    })
  })
})
