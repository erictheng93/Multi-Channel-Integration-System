/**
 * ConversationMobileCards.vue Unit Tests
 *
 * Mirrors the desktop table: 未讀 (personal) is a numeric badge, 待回覆 (team-wide) is a pill without minutes.
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

function lastMessage(senderType: 'customer' | 'agent', content = 'Hello World'): Conversation['lastMessage'] {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderType,
    senderId: 'user-1',
    content,
    messageType: 'text',
    platform: 'line',
    timestamp: now.toISOString(),
    createdAt: now.toISOString()
  } as Conversation['lastMessage']
}

function mountCards(conversations: Conversation[]) {
  return mount(ConversationMobileCards, {
    props: { conversations },
    global: { stubs: { TransitionGroup: false } }
  })
}

describe('ConversationMobileCards.vue', () => {
  describe('Card rendering', () => {
    it('should render no cards when conversations is empty', () => {
      expect(mountCards([]).findAll('.conversation-card')).toHaveLength(0)
    })

    it('should render one card per conversation', () => {
      const wrapper = mountCards([
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' }),
        createConversation({ id: 'c3' })
      ])
      expect(wrapper.findAll('.conversation-card')).toHaveLength(3)
    })
  })

  describe('Customer name display', () => {
    it('should display customer.name when available', () => {
      const conv = createConversation({
        customer: { id: 'c1', name: 'Alice', platform: 'line', platformUserId: 'line-1', createdAt: now.toISOString() }
      })
      expect(mountCards([conv]).find('.customer-name').text()).toBe('Alice')
    })

    it('should fall back to user.name', () => {
      const conv = createConversation({
        user: { id: 'u1', name: 'Bob', platform: 'facebook', platformUserId: 'fb-1', createdAt: now.toISOString() }
      })
      expect(mountCards([conv]).find('.customer-name').text()).toBe('Bob')
    })

    it('should display "未知用戶" when no customer or user', () => {
      expect(mountCards([createConversation()]).find('.customer-name').text()).toBe('未知用戶')
    })
  })

  describe('Status pill', () => {
    // Pills are reserved for 待回覆 / 逾期; every other state and the team are quiet text
    const pills = (wrapper: ReturnType<typeof mountCards>) => wrapper.findAll('.card-pills .ui-pill, .card-pills .state-text, .card-pills .team-text').map(p => p.text())

    it('closed -> 已結案', () => {
      expect(pills(mountCards([createConversation({ status: 'closed' })]))).toContain('已結案')
    })

    it('assigned to a team -> 進行中 plus the team name', () => {
      const result = pills(mountCards([createConversation({ assignedTeamId: 1, assignedTeam: { id: 1, name: 'Support Team' } })]))
      expect(result).toContain('進行中')
      expect(result).toContain('Support Team')
    })

    it('not assigned -> 待處理 and 未指派', () => {
      const wrapper = mountCards([createConversation()])
      expect(pills(wrapper)).toContain('待處理')
      expect(wrapper.find('.unassigned').text()).toBe('未指派')
    })
  })

  describe('Last message', () => {
    it('should display "暫無訊息" when no lastMessage', () => {
      expect(mountCards([createConversation()]).find('.last-message').text()).toBe('暫無訊息')
    })

    it('should display message content when lastMessage exists', () => {
      const wrapper = mountCards([createConversation({ lastMessage: lastMessage('customer') })])
      expect(wrapper.find('.last-message').text()).toBe('Hello World')
    })

    it('prefixes agent messages with 你：', () => {
      const wrapper = mountCards([createConversation({ lastMessage: lastMessage('agent', 'Done') })])
      expect(wrapper.find('.last-message').text()).toMatch(/^你：\s*Done$/)
    })
  })

  describe('待回覆 (team-wide)', () => {
    it('shows a 待回覆 pill (no minutes) when the customer wrote last on an open conversation', () => {
      const wrapper = mountCards([createConversation({ lastMessage: lastMessage('customer') })])
      const pill = wrapper.findAll('.card-pills .ui-pill').find(p => p.text() === '待回覆')
      expect(pill).toBeTruthy()
      expect(pill!.text()).not.toMatch(/\d/)
    })

    it('shows 已回覆 when an agent replied last', () => {
      expect(mountCards([createConversation({ lastMessage: lastMessage('agent') })]).findAll('.card-pills .state-text').map(p => p.text())).toContain('已回覆')
    })

    it('shows the free-reply countdown only while the window is open', () => {
      const open = mountCards([createConversation({ replyWindowExpiresAt: Date.now() + 30_000 })])
      expect(open.text()).toMatch(/免費回覆 \d+ 秒/)
      const past = mountCards([createConversation({ replyWindowExpiresAt: Date.now() - 1000 })])
      expect(past.text()).not.toContain('免費回覆')
    })
  })

  describe('Timestamp', () => {
    it('should render a relative time on the card', () => {
      const wrapper = mountCards([createConversation({ updatedAt: new Date(Date.now() - 5 * 60_000).toISOString() })])
      expect(wrapper.find('.card-time').text()).toBe('5 分鐘前')
    })
  })

  describe('未讀 (personal) indicator', () => {
    it('shows a numeric unread badge with the definition as tooltip', () => {
      const badge = mountCards([createConversation({ unreadCount: 3 })]).find('.unread-badge')
      expect(badge.text()).toBe('3')
      expect(badge.attributes('title')).toBe('未讀＝你尚未開啟')
      expect(badge.attributes('aria-label')).toBe('未讀 3 則訊息（未讀＝你尚未開啟）')
    })

    it('shows no badge when nothing is unread', () => {
      expect(mountCards([createConversation({ unreadCount: 0 })]).find('.unread-badge').exists()).toBe(false)
    })

    it('shows no badge on a closed conversation even with a stale unread count', () => {
      expect(mountCards([createConversation({ unreadCount: 1, status: 'closed' })]).find('.unread-badge').exists()).toBe(false)
    })

    it('should add has-unread class to card when unread', () => {
      expect(mountCards([createConversation({ unreadCount: 5 })]).find('.conversation-card').classes()).toContain('has-unread')
    })

    it('should not add has-unread class when read', () => {
      expect(mountCards([createConversation({ unreadCount: 0 })]).find('.conversation-card').classes()).not.toContain('has-unread')
    })
  })

  describe('Select emit', () => {
    it('should emit "select" with conversation id on card click', async () => {
      const wrapper = mountCards([createConversation({ id: 'mc-42' })])
      await wrapper.find('.conversation-card').trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['mc-42'])
    })

    it('should emit correct id for each card', async () => {
      const wrapper = mountCards([createConversation({ id: 'mc1' }), createConversation({ id: 'mc2' })])
      await wrapper.findAll('.conversation-card')[1].trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['mc2'])
    })
  })
})

describe('ConversationMobileCards.vue selection mode', () => {
  const list = [
    { id: 'c1', userId: 'u1', status: 'active', unreadCount: 0, updatedAt: 1 },
    { id: 'c2', userId: 'u2', status: 'closed', unreadCount: 0, updatedAt: 1 }
  ] as unknown as Conversation[]

  it('shows checkboxes only in selection mode and toggles on card click', async () => {
    const off = mount(ConversationMobileCards, { props: { conversations: list } })
    expect(off.findAll('input[type="checkbox"]')).toHaveLength(0)

    const on = mount(ConversationMobileCards, {
      props: { conversations: list, selectionMode: true, selectedIds: new Set(['c2']) }
    })
    const boxes = on.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect((boxes[1].element as HTMLInputElement).checked).toBe(true)

    await on.findAll('.conversation-card')[0].trigger('click')
    expect(on.emitted('toggle-select')).toEqual([['c1']])
    expect(on.emitted('select')).toBeUndefined()
  })
})
