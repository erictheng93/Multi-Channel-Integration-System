/**
 * ConversationMobileCards.vue Unit Tests
 *
 * Tests:
 * - Card rendering per conversation
 * - Customer name fallback logic
 * - Platform badge text and class
 * - Status badge text and class
 * - Last message display
 * - Assigned agent / team display
 * - Timestamp formatting
 * - Click emits 'select' with conversation id
 * - Empty list rendering
 * - Card structure (header / body / footer)
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationMobileCards from '@/components/conversations/ConversationMobileCards.vue'
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

function mountCards(conversations: Conversation[]) {
  return mount(ConversationMobileCards, {
    props: { conversations },
    global: {
      stubs: {
        TransitionGroup: false
      }
    }
  })
}

describe('ConversationMobileCards.vue', () => {
  describe('Card rendering', () => {
    it('should render no cards when conversations is empty', () => {
      const wrapper = mountCards([])
      expect(wrapper.findAll('.conversation-card')).toHaveLength(0)
    })

    it('should render one card per conversation', () => {
      const conversations = [
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' }),
        createConversation({ id: 'c3' })
      ]
      const wrapper = mountCards(conversations)
      expect(wrapper.findAll('.conversation-card')).toHaveLength(3)
    })

    it('should set animation delay based on index', () => {
      const conversations = [
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' })
      ]
      const wrapper = mountCards(conversations)
      const cards = wrapper.findAll('.conversation-card')
      expect(cards[0].attributes('style')).toContain('animation-delay: 0ms')
      expect(cards[1].attributes('style')).toContain('animation-delay: 50ms')
    })
  })

  describe('Card structure', () => {
    it('should have header, body, and footer sections', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      expect(wrapper.find('.card-header').exists()).toBe(true)
      expect(wrapper.find('.card-body').exists()).toBe(true)
      expect(wrapper.find('.card-footer').exists()).toBe(true)
    })

    it('should have badges container in header', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      expect(wrapper.find('.card-header .badges').exists()).toBe(true)
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
      const wrapper = mountCards([conv])
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
      const wrapper = mountCards([conv])
      expect(wrapper.find('.customer-name').text()).toBe('Bob')
    })

    it('should display "未知用戶" when no customer or user', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      expect(wrapper.find('.customer-name').text()).toBe('未知用戶')
    })

    it('should display userId in customer-id', () => {
      const conv = createConversation({ userId: 'uid-7' })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.customer-id').text()).toContain('uid-7')
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
      const wrapper = mountCards([conv])
      const badge = wrapper.find('.platform-badge')
      expect(badge.text()).toBe(expected)
      expect(badge.classes()).toContain(platform)
    })

    it('should default to LINE when no platform', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
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
      const wrapper = mountCards([conv])
      const badge = wrapper.find('.status-badge')
      expect(badge.text()).toBe(expected)
      expect(badge.classes()).toContain(status)
    })
  })

  describe('Last message', () => {
    it('should display "暫無訊息" when no lastMessage', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      expect(wrapper.find('.last-message').text()).toBe('暫無訊息')
    })

    it('should display message content when lastMessage exists', () => {
      const conv = createConversation({
        lastMessage: {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderType: 'customer',
          senderId: 'user-1',
          content: 'Hello from mobile',
          messageType: 'text',
          platform: 'line',
          timestamp: now.toISOString(),
          createdAt: now.toISOString()
        }
      })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.last-message').text()).toBe('Hello from mobile')
    })
  })

  describe('Assigned agent', () => {
    it('should display "未指派" when no assignedTeam', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      const footer = wrapper.find('.assigned-agent')
      expect(footer.text()).toContain('未指派')
    })

    it('should display team name when assignedTeam exists', () => {
      const conv = createConversation({
        assignedTeam: { id: 1, name: 'Mobile Team' }
      })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.assigned-agent').text()).toContain('Mobile Team')
    })

    it('should include "負責人:" label in footer', () => {
      const conv = createConversation()
      const wrapper = mountCards([conv])
      expect(wrapper.find('.assigned-agent').text()).toContain('負責人:')
    })
  })

  describe('Timestamp', () => {
    it('should render timestamp in card footer', () => {
      const conv = createConversation({ updatedAt: now.toISOString() })
      const wrapper = mountCards([conv])
      const timestamp = wrapper.find('.card-footer .timestamp')
      expect(timestamp.exists()).toBe(true)
      expect(timestamp.text()).toBeTruthy()
    })
  })

  describe('Unread indicator', () => {
    it('should show unread dot when conversation has unreadCount > 0', () => {
      const conv = createConversation({ unreadCount: 3 })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.unread-dot').exists()).toBe(true)
    })

    it('should not show unread dot when unreadCount is 0', () => {
      const conv = createConversation({ unreadCount: 0 })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.unread-dot').exists()).toBe(false)
    })

    it('should add has-unread class to card when unread', () => {
      const conv = createConversation({ unreadCount: 5 })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.conversation-card').classes()).toContain('has-unread')
    })

    it('should not add has-unread class when read', () => {
      const conv = createConversation({ unreadCount: 0 })
      const wrapper = mountCards([conv])
      expect(wrapper.find('.conversation-card').classes()).not.toContain('has-unread')
    })

    it('should include sr-only text for accessibility', () => {
      const conv = createConversation({ unreadCount: 2 })
      const wrapper = mountCards([conv])
      const srOnly = wrapper.find('.sr-only')
      expect(srOnly.exists()).toBe(true)
      expect(srOnly.text()).toContain('未讀')
    })
  })

  describe('Select emit', () => {
    it('should emit "select" with conversation id on card click', async () => {
      const conv = createConversation({ id: 'conv-mobile-1' })
      const wrapper = mountCards([conv])
      await wrapper.find('.conversation-card').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual(['conv-mobile-1'])
    })

    it('should emit correct id for each card', async () => {
      const conversations = [
        createConversation({ id: 'mc1' }),
        createConversation({ id: 'mc2' })
      ]
      const wrapper = mountCards(conversations)
      const cards = wrapper.findAll('.conversation-card')

      await cards[1].trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['mc2'])
    })
  })
})
