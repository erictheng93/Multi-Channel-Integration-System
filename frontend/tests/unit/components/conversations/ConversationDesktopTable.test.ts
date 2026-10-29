/**
 * ConversationDesktopTable.vue Unit Tests
 *
 * Markup follows the approved list design. Two terms stay separate:
 * - 未讀 (personal): numeric badge next to the name, from unreadCount
 * - 待回覆 (team-wide): pill when the last message is the customer's on an open conversation (no wait minutes)
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
      expect(headers).toHaveLength(5)
      expect(headers[0].text()).toBe('客戶')
      expect(headers[1].text()).toBe('最後訊息')
      expect(headers[2].text()).toContain('狀態')
      expect(headers[3].text()).toBe('負責人')
      expect(headers[4].text()).toBe('更新')
    })

    it('explains 未讀 and 待回覆 on the reply-status header', () => {
      const wrapper = mountTable([])
      expect(wrapper.findAll('th')[2].attributes('title')).toBe('未讀＝你尚未開啟；待回覆＝近 7 天內，客戶來訊後尚無客服回覆')
    })

    it('should render no rows when conversations is empty', () => {
      const wrapper = mountTable([])
      expect(wrapper.findAll('.conversation-row')).toHaveLength(0)
    })
  })

  describe('Row rendering', () => {
    it('should render one row per conversation', () => {
      const wrapper = mountTable([
        createConversation({ id: 'c1' }),
        createConversation({ id: 'c2' }),
        createConversation({ id: 'c3' })
      ])
      expect(wrapper.findAll('.conversation-row')).toHaveLength(3)
    })
  })

  describe('Customer name display', () => {
    it('should display customer.name when available', () => {
      const conv = createConversation({
        customer: { id: 'c1', name: 'Alice', platform: 'line', platformUserId: 'line-1', createdAt: now.toISOString() }
      })
      expect(mountTable([conv]).find('.customer-name').text()).toBe('Alice')
    })

    it('should fall back to user.name', () => {
      const conv = createConversation({
        user: { id: 'u1', name: 'Bob', platform: 'facebook', platformUserId: 'fb-1', createdAt: now.toISOString() }
      })
      expect(mountTable([conv]).find('.customer-name').text()).toBe('Bob')
    })

    it('should display "未知用戶" when no customer or user', () => {
      expect(mountTable([createConversation()]).find('.customer-name').text()).toBe('未知用戶')
    })

    it('should display the platform and how long ago the conversation began in the customer-id line', () => {
      const wrapper = mountTable([createConversation({ platform: 'facebook', createdAt: new Date(Date.now() - 3 * 864e5) })])
      expect(wrapper.find('.customer-id').text()).toContain('Messenger')
      expect(wrapper.find('.customer-id').text()).toContain('3 天前開始')
    })

    it('should default to LINE when no platform', () => {
      expect(mountTable([createConversation()]).find('.customer-id').text()).toContain('LINE')
    })
  })

  describe('Status pill', () => {
    it('closed -> 已結案', () => {
      expect(mountTable([createConversation({ status: 'closed' })]).find('.status-cell .ui-pill').text()).toBe('已結案')
    })

    it('assigned to a team -> 進行中', () => {
      const wrapper = mountTable([createConversation({ assignedTeamId: 1, assignedTeam: { id: 1, name: 'A' } })])
      expect(wrapper.find('.status-cell .ui-pill').text()).toBe('進行中')
    })

    it('not assigned -> 待處理', () => {
      expect(mountTable([createConversation()]).find('.status-cell .ui-pill').text()).toBe('待處理')
    })
  })

  describe('Last message', () => {
    it('should display "暫無訊息" when no lastMessage', () => {
      expect(mountTable([createConversation()]).find('.last-message').text()).toBe('暫無訊息')
    })

    it('should display message content when lastMessage exists', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('customer') })])
      expect(wrapper.find('.last-message').text()).toBe('Hello World')
    })

    it('prefixes agent messages with 你：and mutes them', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('agent', 'Done') })])
      expect(wrapper.find('.last-message').text()).toMatch(/^你：\s*Done$/)
      expect(wrapper.find('.last-message').classes()).toContain('from-agent')
    })
  })

  describe('待回覆 (team-wide) pill', () => {
    it('shows 待回覆 without minutes when the customer wrote last on an open conversation', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('customer'), oldestUnreadAt: now.toISOString() })])
      const cell = wrapper.find('.status-cell')
      expect(cell.text()).toBe('待回覆')
      expect(cell.text()).not.toMatch(/\d/)
    })

    it('shows 已回覆 when an agent replied last', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('agent') })])
      expect(wrapper.find('.status-cell').text()).toBe('已回覆')
    })

    const daysAgo = (d: number): string => new Date(Date.now() - d * 86_400_000).toISOString()

    it('uses the backend marker: a sticker or thanks after a reply (awaitingSince null) is answered, not waiting', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('customer', '謝謝'), awaitingSince: null })])
      expect(wrapper.find('.status-cell').text()).toBe('已回覆')
    })

    it('shows 待回覆 for a wait inside the 7-day window', () => {
      const wrapper = mountTable([createConversation({ lastMessage: lastMessage('customer'), awaitingSince: daysAgo(6) })])
      expect(wrapper.find('.status-cell').text()).toBe('待回覆')
    })

    it('shows a stale wait as 已等 N 天 (not 待回覆), with 從未回覆 only when no human ever replied', () => {
      const wrapper = mountTable([
        createConversation({ id: 'a', lastMessage: lastMessage('customer'), awaitingSince: daysAgo(30), neverReplied: true }),
        createConversation({ id: 'b', lastMessage: lastMessage('customer'), awaitingSince: daysAgo(9), neverReplied: false })
      ])
      const cells = wrapper.findAll('.status-cell')
      expect(cells[0]!.text()).toContain('已等 30 天')
      expect(cells[0]!.text()).toContain('從未回覆')
      expect(cells[0]!.text()).not.toContain('待回覆')
      expect(cells[1]!.text()).toContain('已等 9 天')
      expect(cells[1]!.text()).not.toContain('從未回覆')
    })

    it('shows neither on a closed conversation', () => {
      const wrapper = mountTable([createConversation({ status: 'closed', lastMessage: lastMessage('customer') })])
      expect(wrapper.find('.status-cell').text()).toBe('已結案')
    })

    it('shows the free-reply countdown only while the window is open', () => {
      const open = mountTable([createConversation({ replyWindowExpiresAt: Date.now() + 30_000 })])
      expect(open.find('.free-pill').text()).toMatch(/^免費回覆 \d+ 秒$/)
      const past = mountTable([createConversation({ replyWindowExpiresAt: Date.now() - 1000 })])
      expect(past.find('.free-pill').exists()).toBe(false)
    })
  })

  describe('Assigned team', () => {
    it('should display "未指派" when no assignedTeam', () => {
      expect(mountTable([createConversation()]).find('.unassigned').text()).toBe('未指派')
    })

    it('should display team name when assignedTeam exists', () => {
      const wrapper = mountTable([createConversation({ assignedTeam: { id: 1, name: 'Support Team' } })])
      expect(wrapper.find('.agent-cell').text()).toContain('Support Team')
    })
  })

  describe('Timestamp', () => {
    it('shows a relative time with the full time as tooltip', () => {
      const wrapper = mountTable([createConversation({ updatedAt: new Date(Date.now() - 5 * 60_000).toISOString() })])
      expect(wrapper.find('.time-cell').text()).toBe('5 分鐘前')
      expect(wrapper.find('.time-cell').attributes('title')).toBeTruthy()
    })
  })

  describe('Select emit', () => {
    it('should emit "select" with conversation id on row click', async () => {
      const wrapper = mountTable([createConversation({ id: 'conv-42' })])
      await wrapper.find('.conversation-row').trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['conv-42'])
    })

    it('should emit correct id for each row', async () => {
      const wrapper = mountTable([createConversation({ id: 'c1' }), createConversation({ id: 'c2' })])
      await wrapper.findAll('.conversation-row')[1].trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual(['c2'])
    })
  })

  describe('未讀 (personal) indicator', () => {
    it('shows a numeric unread badge with the definition as tooltip', () => {
      const badge = mountTable([createConversation({ unreadCount: 3 })]).find('.unread-badge')
      expect(badge.text()).toBe('3')
      expect(badge.attributes('title')).toBe('未讀＝你尚未開啟')
    })

    it('shows no badge when there is nothing unread', () => {
      expect(mountTable([createConversation({ unreadCount: 0 })]).find('.unread-badge').exists()).toBe(false)
    })

    it('shows no badge on a closed conversation even with a stale unread count', () => {
      expect(mountTable([createConversation({ unreadCount: 1, status: 'closed' })]).find('.unread-badge').exists()).toBe(false)
    })

    it('should add has-unread class to row when unread', () => {
      expect(mountTable([createConversation({ unreadCount: 5 })]).find('.conversation-row').classes()).toContain('has-unread')
    })

    it('should not add has-unread class when read', () => {
      expect(mountTable([createConversation({ unreadCount: 0 })]).find('.conversation-row').classes()).not.toContain('has-unread')
    })

    it('should label the badge with the unread count for accessibility', () => {
      const badge = mountTable([createConversation({ unreadCount: 2 })]).find('.unread-badge')
      expect(badge.attributes('aria-label')).toBe('未讀 2 則訊息（未讀＝你尚未開啟）')
    })
  })

  describe('Selection mode', () => {
    const list = [createConversation({ id: 'c1' }), createConversation({ id: 'c2' })]

    function mountSelecting(selected: string[] = []) {
      return mount(ConversationDesktopTable, {
        props: { conversations: list, selectionMode: true, selectedIds: new Set(selected) },
        global: { stubs: { TransitionGroup: false } }
      })
    }

    it('renders no checkboxes outside selection mode', () => {
      const wrapper = mountTable(list)
      expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
      expect(wrapper.findAll('th')).toHaveLength(5)
    })

    it('renders a checkbox column (header + one per row) in selection mode', () => {
      const wrapper = mountSelecting(['c1'])
      const boxes = wrapper.findAll('input[type="checkbox"]')
      expect(boxes).toHaveLength(3)
      expect(wrapper.findAll('th')).toHaveLength(6)
      expect(boxes[0].attributes('aria-label')).toBe('全選本頁對話')
      expect((boxes[1].element as HTMLInputElement).checked).toBe(true)
      expect((boxes[2].element as HTMLInputElement).checked).toBe(false)
    })

    it('row click toggles selection instead of emitting select', async () => {
      const wrapper = mountSelecting()
      await wrapper.findAll('.conversation-row')[1].trigger('click')
      expect(wrapper.emitted('toggle-select')).toEqual([['c2']])
      expect(wrapper.emitted('select')).toBeUndefined()
    })

    it('header checkbox emits toggle-select-all and is indeterminate when partially selected', async () => {
      const wrapper = mountSelecting(['c1'])
      await nextTick()
      const header = wrapper.findAll('input[type="checkbox"]')[0]
      expect((header.element as HTMLInputElement).indeterminate).toBe(true)
      await header.trigger('change')
      expect(wrapper.emitted('toggle-select-all')).toHaveLength(1)
    })

    it('header checkbox is checked when every row is selected', () => {
      const wrapper = mountSelecting(['c1', 'c2'])
      const header = wrapper.findAll('input[type="checkbox"]')[0].element as HTMLInputElement
      expect(header.checked).toBe(true)
      expect(header.indeterminate).toBe(false)
    })
  })
})
