/**
 * Unit Tests for RecentConversationsCard Component
 *
 * @module tests/unit/components/dashboard/RecentConversationsCard.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentConversationsCard from '@/components/dashboard/RecentConversationsCard.vue'
import type { Conversation } from '@/types'

// Stub child components
const HamsterLoaderStub = {
  name: 'HamsterLoader',
  template: '<div class="hamster-loader">{{ message }}</div>',
  props: ['message']
}

const EmptyStateStub = {
  name: 'EmptyState',
  template: '<div class="empty-state"><h3>{{ title }}</h3><p>{{ description }}</p><slot name="actions"></slot></div>',
  props: ['title', 'description']
}

const ConversationCardStub = {
  name: 'ConversationCard',
  template: '<div class="conversation-card" @click="$emit(\'select\', conversation)">{{ conversation.id }}</div>',
  props: ['conversation']
}

// Mock conversations
const mockConversations: Conversation[] = [
  {
    id: '1',
    platform: 'line',
    platformUserId: 'user1',
    status: 'open',
    lastMessageAt: new Date('2025-01-01T12:00:00'),
    createdAt: new Date('2025-01-01T10:00:00'),
    updatedAt: new Date('2025-01-01T12:00:00')
  },
  {
    id: '2',
    platform: 'line',
    platformUserId: 'user2',
    status: 'assigned',
    lastMessageAt: new Date('2025-01-01T11:00:00'),
    createdAt: new Date('2025-01-01T09:00:00'),
    updatedAt: new Date('2025-01-01T11:00:00')
  }
]

describe('RecentConversationsCard', () => {
  const defaultGlobalStubs = {
    HamsterLoader: HamsterLoaderStub,
    EmptyState: EmptyStateStub,
    ConversationCard: ConversationCardStub,
    RouterLink: {
      template: '<a class="view-all-link"><slot /></a>',
      props: ['to']
    }
  }

  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: []
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.conversations-card').exists()).toBe(true)
      expect(wrapper.find('.card-header').exists()).toBe(true)
      expect(wrapper.find('.card-body').exists()).toBe(true)
    })

    it('应该显示默认标题和副标题', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('最近對話')
      expect(wrapper.find('.card-subtitle').text()).toBe('最新的客戶互動記錄')
    })

    it('应该显示自定义标题和副标题', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          title: '自定义标题',
          subtitle: '自定义副标题'
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('自定义标题')
      expect(wrapper.find('.card-subtitle').text()).toBe('自定义副标题')
    })

    it('应该显示查看全部链接', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.view-all-link').exists()).toBe(true)
      expect(wrapper.find('.view-all-link').text()).toBe('查看全部')
    })

    it('可以隐藏查看全部链接', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          showViewAllLink: false
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.view-all-link').exists()).toBe(false)
    })
  })

  describe('加载状态', () => {
    it('加载时应该显示加载器', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          loading: true
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findComponent(HamsterLoaderStub).exists()).toBe(true)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(false)
      expect(wrapper.find('.conversation-list').exists()).toBe(false)
    })

    it('应该显示自定义加载消息', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          loading: true,
          loadingMessage: '正在加载...'
        },
        global: { stubs: defaultGlobalStubs }
      })

      const loader = wrapper.findComponent(HamsterLoaderStub)
      expect(loader.props('message')).toBe('正在加载...')
    })
  })

  describe('空状态', () => {
    it('无数据时应该显示空状态', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          loading: false
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(true)
      expect(wrapper.find('.conversation-list').exists()).toBe(false)
    })

    it('应该显示默认空状态文本', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      const emptyState = wrapper.findComponent(EmptyStateStub)
      expect(emptyState.props('title')).toBe('暫無對話記錄')
      expect(emptyState.props('description')).toBe('當有新的客戶對話時，會顯示在這裡')
    })

    it('应该显示自定义空状态文本', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          emptyTitle: '无数据',
          emptyDescription: '请稍后再试'
        },
        global: { stubs: defaultGlobalStubs }
      })

      const emptyState = wrapper.findComponent(EmptyStateStub)
      expect(emptyState.props('title')).toBe('无数据')
      expect(emptyState.props('description')).toBe('请稍后再试')
    })

    it('空状态应该显示刷新按钮', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      const button = wrapper.find('.btn-primary')
      expect(button.exists()).toBe(true)
      expect(button.text()).toBe('刷新數據')
    })

    it('刷新按钮应该触发refresh事件', async () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      await wrapper.find('.btn-primary').trigger('click')
      expect(wrapper.emitted('refresh')).toBeTruthy()
    })
  })

  describe('对话列表', () => {
    it('有数据时应该显示对话列表', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: mockConversations,
          loading: false
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.conversation-list').exists()).toBe(true)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(false)
      expect(wrapper.findComponent(HamsterLoaderStub).exists()).toBe(false)
    })

    it('应该渲染所有对话卡片', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: mockConversations },
        global: { stubs: defaultGlobalStubs }
      })

      const cards = wrapper.findAllComponents(ConversationCardStub)
      expect(cards).toHaveLength(2)
    })

    it('应该传递对话数据给卡片', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: mockConversations },
        global: { stubs: defaultGlobalStubs }
      })

      const cards = wrapper.findAllComponents(ConversationCardStub)
      expect(cards[0].props('conversation')).toEqual(mockConversations[0])
      expect(cards[1].props('conversation')).toEqual(mockConversations[1])
    })

    it('应该为每个对话卡片设置唯一key', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: mockConversations },
        global: { stubs: defaultGlobalStubs }
      })

      const cards = wrapper.findAllComponents(ConversationCardStub)
      expect(cards[0].props('conversation').id).toBe('1')
      expect(cards[1].props('conversation').id).toBe('2')
    })
  })

  describe('事件处理', () => {
    it('选择对话应该触发select事件', async () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: mockConversations },
        global: { stubs: defaultGlobalStubs }
      })

      const cards = wrapper.findAllComponents(ConversationCardStub)
      await cards[0].trigger('select', mockConversations[0])

      expect(wrapper.emitted('select')).toBeTruthy()
    })

    it('刷新应该触发refresh事件', async () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      await wrapper.find('.btn-primary').trigger('click')

      expect(wrapper.emitted('refresh')).toBeTruthy()
      expect(wrapper.emitted('refresh')).toHaveLength(1)
    })
  })

  describe('响应式更新', () => {
    it('应该在对话列表更新时重新渲染', async () => {
      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: [] },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findAllComponents(ConversationCardStub)).toHaveLength(0)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(true)

      await wrapper.setProps({ conversations: mockConversations })

      expect(wrapper.findAllComponents(ConversationCardStub)).toHaveLength(2)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(false)
    })

    it('应该在加载状态更新时重新渲染', async () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          loading: false
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findComponent(HamsterLoaderStub).exists()).toBe(false)

      await wrapper.setProps({ loading: true })
      expect(wrapper.findComponent(HamsterLoaderStub).exists()).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('应该处理大量对话', () => {
      const manyConversations = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        platform: 'line' as const,
        platformUserId: `user${i}`,
        status: 'open' as const,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      const wrapper = mount(RecentConversationsCard, {
        props: { conversations: manyConversations },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findAllComponents(ConversationCardStub)).toHaveLength(50)
    })

    it('应该处理空字符串标题', () => {
      const wrapper = mount(RecentConversationsCard, {
        props: {
          conversations: [],
          title: '',
          subtitle: ''
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('')
      expect(wrapper.find('.card-subtitle').text()).toBe('')
    })
  })
})
