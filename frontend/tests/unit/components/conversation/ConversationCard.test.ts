/**
 * ConversationCard.vue 單元測試
 *
 * 測試覆蓋範圍：
 * - 狀態判定邏輯（effectiveStatus）
 * - 狀態顯示文字（statusDisplayText）
 * - 活躍狀態指示（isOnline）
 * - 基本渲染
 * - 用戶互動
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import ConversationCard from '@/components/conversation/ConversationCard.vue'
import type { Conversation } from '@/types'

// Mock composables
vi.mock('@/composables/usePrefetch', () => ({
  usePrefetch: () => ({
    prefetchApiData: vi.fn()
  })
}))

// Mock emoji processor
vi.mock('@/utils/layered-emoji-processor', () => ({
  convertEmojiForConversationList: (content: string) => content
}))

describe('ConversationCard.vue', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  // 創建測試用的對話數據
  const createMockConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
    id: 'conv-1',
    userId: 'user-1',
    status: 'active',
    platform: 'line',
    unreadCount: 0,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: {
      id: 'customer-1',
      name: 'Test Customer',
      platform: 'line',
      platformUserId: 'line-user-1',
      createdAt: new Date().toISOString()
    },
    ...overrides
  })

  const createWrapper = (conversation: Conversation, selected = false) => {
    return mount(ConversationCard, {
      props: {
        conversation,
        selected
      },
      global: {
        plugins: [pinia],
        stubs: {
          // Stub icons
          UserCheckIcon: { template: '<svg class="user-check-icon" />' },
          ChevronRightIcon: { template: '<svg class="chevron-icon" />' },
          NewCustomerBadge: { template: '<span class="new-customer-badge" />' }
        }
      }
    })
  }

  describe('狀態判定邏輯 (effectiveStatus)', () => {
    it('當 firstResponseAt 有值時，應返回 assigned', () => {
      const conversation = createMockConversation({
        firstResponseAt: new Date().toISOString()
      })
      const wrapper = createWrapper(conversation)

      // 檢查 data-status 屬性
      expect(wrapper.attributes('data-status')).toBe('assigned')
    })

    it('當 firstResponseAt 為 null 時，應返回 pending', () => {
      const conversation = createMockConversation({
        firstResponseAt: null
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.attributes('data-status')).toBe('pending')
    })

    it('當 firstResponseAt 為 undefined 時，應返回 pending', () => {
      const conversation = createMockConversation()
      // 確保 firstResponseAt 不存在
      delete (conversation as any).firstResponseAt
      const wrapper = createWrapper(conversation)

      expect(wrapper.attributes('data-status')).toBe('pending')
    })

    it('不應受 conversation.status 原始值影響', () => {
      // 即使原始 status 是 'active'，沒有 firstResponseAt 仍應顯示 pending
      const conversation = createMockConversation({
        status: 'active',
        firstResponseAt: null
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.attributes('data-status')).toBe('pending')
    })

    it('不應受 assignedTeam 影響（新邏輯移除了這個依賴）', () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team' },
        firstResponseAt: null // 沒有回覆過
      })
      const wrapper = createWrapper(conversation)

      // 新邏輯只看 firstResponseAt，不看 assignedTeam
      expect(wrapper.attributes('data-status')).toBe('pending')
    })
  })

  describe('狀態顯示文字 (statusDisplayText)', () => {
    it('pending 狀態應顯示「待處理」', () => {
      const conversation = createMockConversation({
        firstResponseAt: null
      })
      const wrapper = createWrapper(conversation)

      const statusText = wrapper.find('.status-text')
      expect(statusText.text()).toBe('待處理')
    })

    it('assigned 狀態應顯示「處理中」', () => {
      const conversation = createMockConversation({
        firstResponseAt: new Date().toISOString()
      })
      const wrapper = createWrapper(conversation)

      const statusText = wrapper.find('.status-text')
      expect(statusText.text()).toBe('處理中')
    })
  })

  describe('活躍狀態指示 (isOnline)', () => {
    it('pending 狀態時 avatar 應有 is-active class', () => {
      const conversation = createMockConversation({
        firstResponseAt: null
      })
      const wrapper = createWrapper(conversation)

      const avatar = wrapper.find('.avatar')
      expect(avatar.classes()).toContain('is-active')
    })

    it('assigned 狀態時 avatar 不應有 is-active class', () => {
      const conversation = createMockConversation({
        firstResponseAt: new Date().toISOString()
      })
      const wrapper = createWrapper(conversation)

      const avatar = wrapper.find('.avatar')
      expect(avatar.classes()).not.toContain('is-active')
    })
  })

  describe('狀態樣式 (CSS classes)', () => {
    it('pending 狀態應有正確的 status-pill class', () => {
      const conversation = createMockConversation({
        firstResponseAt: null
      })
      const wrapper = createWrapper(conversation)

      const statusPill = wrapper.find('.status-pill')
      expect(statusPill.classes()).toContain('status-pending')
    })

    it('assigned 狀態應有正確的 status-pill class', () => {
      const conversation = createMockConversation({
        firstResponseAt: new Date().toISOString()
      })
      const wrapper = createWrapper(conversation)

      const statusPill = wrapper.find('.status-pill')
      expect(statusPill.classes()).toContain('status-assigned')
    })
  })

  describe('基本渲染', () => {
    it('應正確渲染組件結構', () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.conversation-card-apple').exists()).toBe(true)
      expect(wrapper.find('.avatar-section').exists()).toBe(true)
      expect(wrapper.find('.content-section').exists()).toBe(true)
      expect(wrapper.find('.end-section').exists()).toBe(true)
    })

    it('應顯示客戶名稱', () => {
      const conversation = createMockConversation({
        customer: {
          id: 'c1',
          name: 'John Doe',
          platform: 'line',
          platformUserId: 'line-123',
          createdAt: new Date().toISOString()
        }
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.customer-name').text()).toBe('John Doe')
    })

    it('應顯示客戶姓名縮寫', () => {
      const conversation = createMockConversation({
        customer: {
          id: 'c1',
          name: 'John Doe',
          platform: 'line',
          platformUserId: 'line-123',
          createdAt: new Date().toISOString()
        }
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.avatar-text').text()).toBe('JD')
    })

    it('當有未讀訊息時應顯示未讀標識 (green dot)', () => {
      const conversation = createMockConversation({
        unreadCount: 5
      })
      const wrapper = createWrapper(conversation)

      const unreadBadge = wrapper.find('.unread-badge')
      expect(unreadBadge.exists()).toBe(true)
      // Green dot has no text content (no count display)
      expect(unreadBadge.text()).toBe('')
    })

    it('無未讀訊息時不應顯示未讀徽章', () => {
      const conversation = createMockConversation({
        unreadCount: 0
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.unread-badge').exists()).toBe(false)
    })

    it('當有未讀訊息時應有 has-unread class', () => {
      const conversation = createMockConversation({
        unreadCount: 3
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.classes()).toContain('has-unread')
    })

    it('無未讀訊息時不應有 has-unread class', () => {
      const conversation = createMockConversation({
        unreadCount: 0
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.classes()).not.toContain('has-unread')
    })
  })

  describe('選中狀態', () => {
    it('選中時應有 is-selected class', () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation, true)

      expect(wrapper.classes()).toContain('is-selected')
    })

    it('未選中時不應有 is-selected class', () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation, false)

      expect(wrapper.classes()).not.toContain('is-selected')
    })
  })

  describe('用戶互動', () => {
    it('點擊時應發出 select 事件', async () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      await wrapper.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([conversation])
    })

    it('按 Enter 鍵時應發出 select 事件', async () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      await wrapper.trigger('keydown.enter')

      expect(wrapper.emitted('select')).toBeTruthy()
    })

    it('按空格鍵時應發出 select 事件', async () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      await wrapper.trigger('keydown.space')

      expect(wrapper.emitted('select')).toBeTruthy()
    })
  })

  describe('團隊指派顯示', () => {
    it('有指派團隊時應顯示團隊名稱', () => {
      const conversation = createMockConversation({
        assignedTeam: { id: 1, name: 'Customer Support' },
        firstResponseAt: new Date().toISOString()
      })
      const wrapper = createWrapper(conversation)

      const assignedBadge = wrapper.find('.assigned-badge')
      expect(assignedBadge.exists()).toBe(true)
      expect(assignedBadge.text()).toContain('Customer Support')
    })

    it('無指派團隊時不應顯示團隊徽章', () => {
      const conversation = createMockConversation({
        assignedTeam: null
      })
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.assigned-badge').exists()).toBe(false)
    })
  })

  describe('LIFF 預通知（等待加入）', () => {
    it('當 _liffMetadata.isPending 為 true 時應顯示等待加入徽章', () => {
      const conversation = createMockConversation() as any
      conversation._liffMetadata = { isPending: true }
      const wrapper = createWrapper(conversation)

      const pendingBadge = wrapper.find('.pending-badge')
      expect(pendingBadge.exists()).toBe(true)
      expect(pendingBadge.text()).toContain('等待加入')
    })

    it('正常對話不應顯示等待加入徽章', () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.pending-badge').exists()).toBe(false)
    })
  })

  describe('邊緣情況', () => {
    it('應處理缺少 customer 的情況', () => {
      const conversation = createMockConversation()
      delete (conversation as any).customer
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.customer-name').text()).toBe('未知用戶')
    })

    it('應處理缺少 lastMessage 的情況', () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      expect(wrapper.find('.message-preview').text()).toBe('暫無訊息')
    })

    it('應截斷過長的訊息預覽', () => {
      const conversation = createMockConversation({
        lastMessage: {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderType: 'customer',
          senderId: 'user-1',
          content: 'A'.repeat(100), // 100個字符
          messageType: 'text',
          platform: 'line',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      })
      const wrapper = createWrapper(conversation)

      const preview = wrapper.find('.message-preview').text()
      expect(preview.length).toBeLessThanOrEqual(53) // 50 + '...'
      expect(preview.endsWith('...')).toBe(true)
    })
  })
})
