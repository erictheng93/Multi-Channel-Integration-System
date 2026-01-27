/**
 * Unit Tests for ActivityFeedCard Component
 *
 * @module tests/unit/components/dashboard/ActivityFeedCard.test
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityFeedCard from '@/components/dashboard/ActivityFeedCard.vue'
import type { Activity } from '@/components/dashboard/ActivityFeedCard.vue'

// Stub child components
const HamsterLoaderStub = {
  name: 'HamsterLoader',
  template: '<div class="hamster-loader">{{ message }}</div>',
  props: ['message']
}

const EmptyStateStub = {
  name: 'EmptyState',
  template: '<div class="empty-state"><h3>{{ title }}</h3><p>{{ description }}</p></div>',
  props: ['title', 'description']
}

// Mock icon component
const MockIcon = {
  name: 'MockIcon',
  template: '<svg class="mock-icon" />'
}

// Mock functions
const mockGetActivityIcon = vi.fn(() => MockIcon)
const mockFormatTime = vi.fn((date: Date) => '5分钟前')

// Mock activities
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'message',
    title: '新消息',
    description: '客户发来了新消息',
    priority: 'high',
    createdAt: new Date('2025-01-01T12:00:00')
  },
  {
    id: '2',
    type: 'assignment',
    title: '对话分配',
    description: '对话已分配给张三',
    priority: 'medium',
    createdAt: new Date('2025-01-01T11:00:00')
  },
  {
    id: '3',
    type: 'resolved',
    title: '对话解决',
    description: '对话已标记为已解决',
    priority: 'low',
    createdAt: new Date('2025-01-01T10:00:00')
  }
]

describe('ActivityFeedCard', () => {
  const defaultGlobalStubs = {
    HamsterLoader: HamsterLoaderStub,
    EmptyState: EmptyStateStub,
    RouterLink: {
      template: '<a class="view-all-link"><slot /></a>',
      props: ['to']
    }
  }

  const defaultProps = {
    isConnected: true,
    activities: [],
    getActivityIcon: mockGetActivityIcon,
    formatTime: mockFormatTime
  }

  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: defaultProps,
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.activity-card').exists()).toBe(true)
      expect(wrapper.find('.card-header').exists()).toBe(true)
      expect(wrapper.find('.card-body').exists()).toBe(true)
    })

    it('应该显示默认标题', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: defaultProps,
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('活動動態')
    })

    it('应该显示自定义标题', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          title: '自定义活动'
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('自定义活动')
    })
  })

  describe('连接状态', () => {
    it('连接时应该显示已连线状态', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          isConnected: true,
          connectionState: 'connected' // 使用新的 connectionState prop
        },
        global: { stubs: defaultGlobalStubs }
      })

      const status = wrapper.find('.connection-status')
      expect(status.classes()).toContain('connected')
      expect(status.text()).toBe('● 即時更新中') // 組件更新後的新文字
    })

    it('断连时应该显示未连线状态', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          isConnected: false,
          connectionState: 'disconnected' // 使用新的 connectionState prop
        },
        global: { stubs: defaultGlobalStubs }
      })

      const status = wrapper.find('.connection-status')
      expect(status.classes()).toContain('disconnected')
      expect(status.text()).toBe('○ 即時更新已暫停') // 組件更新後的新文字
    })

    it('正在连接时应该显示连接中状态', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          isConnected: false,
          connectionState: 'connecting'
        },
        global: { stubs: defaultGlobalStubs }
      })

      const status = wrapper.find('.connection-status')
      expect(status.classes()).toContain('connecting')
      expect(status.text()).toBe('◐ 正在連接...')
    })

    it('连接错误时应该显示错误状态', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          isConnected: false,
          connectionState: 'error'
        },
        global: { stubs: defaultGlobalStubs }
      })

      const status = wrapper.find('.connection-status')
      expect(status.classes()).toContain('error')
      expect(status.text()).toBe('✕ 連線失敗')
    })
  })

  describe('加载状态', () => {
    it('加载时应该显示加载器', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          loading: true
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findComponent(HamsterLoaderStub).exists()).toBe(true)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(false)
      expect(wrapper.find('.activity-list').exists()).toBe(false)
    })
  })

  describe('空状态', () => {
    it('无数据时应该显示空状态', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: []
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(true)
      expect(wrapper.find('.activity-list').exists()).toBe(false)
    })

    it('应该显示默认空状态文本', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: defaultProps,
        global: { stubs: defaultGlobalStubs }
      })

      const emptyState = wrapper.findComponent(EmptyStateStub)
      expect(emptyState.props('title')).toBe('暫無重要活動')
      expect(emptyState.props('description')).toBe('當有重要的系統活動時，會顯示在這裡')
    })
  })

  describe('活动列表', () => {
    it('有数据时应该显示活动列表', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: mockActivities
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.activity-list').exists()).toBe(true)
      expect(wrapper.findComponent(EmptyStateStub).exists()).toBe(false)
    })

    it('应该渲染所有活动项', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: mockActivities
        },
        global: { stubs: defaultGlobalStubs }
      })

      const items = wrapper.findAll('.activity-item')
      expect(items).toHaveLength(3)
    })

    it('应该显示活动标题和描述', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: [mockActivities[0]]
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.activity-title').text()).toBe('新消息')
      expect(wrapper.find('.activity-description').text()).toBe('客户发来了新消息')
    })

    it('应该为每个活动调用图标函数', () => {
      mockGetActivityIcon.mockClear()

      mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: mockActivities
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(mockGetActivityIcon).toHaveBeenCalledWith('message')
      expect(mockGetActivityIcon).toHaveBeenCalledWith('assignment')
      expect(mockGetActivityIcon).toHaveBeenCalledWith('resolved')
    })

    it('应该为每个活动调用时间格式化函数', () => {
      mockFormatTime.mockClear()

      mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: mockActivities
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(mockFormatTime).toHaveBeenCalledTimes(3)
    })
  })

  describe('优先级', () => {
    it('高优先级活动应该有优先级标记', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: [mockActivities[0]]
        },
        global: { stubs: defaultGlobalStubs }
      })

      const item = wrapper.find('.activity-item')
      expect(item.classes()).toContain('high')
      expect(wrapper.find('.activity-priority').exists()).toBe(true)
      expect(wrapper.find('.activity-priority').text()).toBe('🔴')
    })

    it('中优先级活动应该有对应样式', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: [mockActivities[1]]
        },
        global: { stubs: defaultGlobalStubs }
      })

      const item = wrapper.find('.activity-item')
      expect(item.classes()).toContain('medium')
    })

    it('低优先级活动不应该有优先级标记', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: [mockActivities[2]]
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.activity-priority').exists()).toBe(false)
    })
  })

  describe('查看全部链接', () => {
    it('应该显示查看全部链接', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: defaultProps,
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.view-all-link').exists()).toBe(true)
      expect(wrapper.find('.view-all-link').text()).toBe('查看全部')
    })

    it('可以隐藏查看全部链接', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          showViewAllLink: false
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.view-all-link').exists()).toBe(false)
    })
  })

  describe('响应式更新', () => {
    it('应该在活动列表更新时重新渲染', async () => {
      const wrapper = mount(ActivityFeedCard, {
        props: defaultProps,
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findAll('.activity-item')).toHaveLength(0)

      await wrapper.setProps({ activities: mockActivities })
      expect(wrapper.findAll('.activity-item')).toHaveLength(3)
    })

    it('应该在连接状态更新时重新渲染', async () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          isConnected: true,
          connectionState: 'connected' // 需要設置 connectionState 來控制 CSS class
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.connection-status').classes()).toContain('connected')

      await wrapper.setProps({ isConnected: false, connectionState: 'disconnected' })
      expect(wrapper.find('.connection-status').classes()).toContain('disconnected')
    })
  })

  describe('边界情况', () => {
    it('应该处理大量活动', () => {
      const manyActivities = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        type: 'message',
        title: `活动 ${i}`,
        description: `描述 ${i}`,
        priority: 'low' as const,
        createdAt: new Date()
      }))

      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          activities: manyActivities
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.findAll('.activity-item')).toHaveLength(50)
    })

    it('应该处理空字符串标题', () => {
      const wrapper = mount(ActivityFeedCard, {
        props: {
          ...defaultProps,
          title: ''
        },
        global: { stubs: defaultGlobalStubs }
      })

      expect(wrapper.find('.card-title').text()).toBe('')
    })
  })
})
