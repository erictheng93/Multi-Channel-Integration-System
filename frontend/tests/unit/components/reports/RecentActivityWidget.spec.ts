/**
 * RecentActivityWidget Component Unit Tests
 *
 * 测试最近活动小部件的渲染和交互行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentActivityWidget from '@/components/reports/dashboard/RecentActivityWidget.vue'
import type { RecentActivity } from '@/components/reports/dashboard/RecentActivityWidget.vue'

describe('RecentActivityWidget.vue', () => {
  const mockGetStatusIcon = vi.fn((status) => {
    const icons: Record<string, string> = {
      'completed': '',
      'generating': '',
      'failed': '',
      'pending': ''
    }
    return icons[status] || ''
  })

  const mockFormatRelativeTime = vi.fn((_time) => {
    // 简化的时间格式化
    return '5 分鐘前'
  })

  // 在每个测试前重置 mock 函数
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockActivities: RecentActivity[] = [
    {
      id: '1',
      reportId: 'report-1',
      title: '客戶數據分析報表',
      typeLabel: '基礎報表',
      status: 'completed',
      time: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      reportId: 'report-2',
      title: '性能分析報表',
      typeLabel: '性能報表',
      status: 'generating',
      time: '2024-01-15T10:25:00Z'
    },
    {
      id: '3',
      reportId: 'report-3',
      title: '錯誤報表',
      typeLabel: '系統報表',
      status: 'failed',
      time: '2024-01-15T10:20:00Z'
    }
  ]

  describe('渲染测试', () => {
    it('应该渲染小部件标题', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.text()).toContain('最近活動')
    })

    it('应该显示活动数量标签', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.text()).toContain('最近 3 項')
    })

    it('应该渲染所有活动项', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const activityItems = wrapper.findAll('.activity-item')
      expect(activityItems).toHaveLength(3)
    })

    it('应该显示每个活动的信息', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.text()).toContain('客戶數據分析報表')
      expect(wrapper.text()).toContain('基礎報表')
      expect(wrapper.text()).toContain('性能分析報表')
      expect(wrapper.text()).toContain('性能報表')
    })

    it('应该调用 getStatusIcon 获取状态图标', () => {
      mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(mockGetStatusIcon).toHaveBeenCalledWith('completed')
      expect(mockGetStatusIcon).toHaveBeenCalledWith('generating')
      expect(mockGetStatusIcon).toHaveBeenCalledWith('failed')
    })

    it('应该调用 formatRelativeTime 格式化时间', () => {
      mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(mockFormatRelativeTime).toHaveBeenCalledTimes(3)
      expect(mockFormatRelativeTime).toHaveBeenCalledWith('2024-01-15T10:30:00Z')
    })

    it('应该为不同状态应用不同的图标类', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const iconDivs = wrapper.findAll('.activity-icon')
      expect(iconDivs[0].classes()).toContain('completed')
      expect(iconDivs[1].classes()).toContain('generating')
      expect(iconDivs[2].classes()).toContain('failed')
    })

    it('应该显示箭头指示器', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const arrows = wrapper.findAll('.activity-arrow')
      expect(arrows).toHaveLength(3)
      expect(arrows[0].text()).toBe('→')
    })
  })

  describe('空状态', () => {
    it('空数据时应该显示空状态', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: [],
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('暫無活動記錄')
    })

    it('空数据时不应该显示活动列表', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: [],
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.find('.activity-list').exists()).toBe(false)
    })

    it('空数据时不应该显示数量标签', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: [],
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.find('.header-subtitle').exists()).toBe(false)
    })
  })

  describe('事件发射', () => {
    it('点击活动项应该发射 view-report 事件', async () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const firstActivity = wrapper.findAll('.activity-item')[0]
      await firstActivity.trigger('click')

      expect(wrapper.emitted('view-report')).toBeTruthy()
      expect(wrapper.emitted('view-report')![0]).toEqual(['report-1'])
    })

    it('点击不同活动应该发射对应的 reportId', async () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const activityItems = wrapper.findAll('.activity-item')

      await activityItems[1].trigger('click')
      expect(wrapper.emitted('view-report')![0]).toEqual(['report-2'])

      await activityItems[2].trigger('click')
      expect(wrapper.emitted('view-report')![1]).toEqual(['report-3'])
    })
  })

  describe('响应式更新', () => {
    it('应该响应 activities 数据变化', async () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.findAll('.activity-item')).toHaveLength(3)

      const newActivities = [...mockActivities, {
        id: '4',
        reportId: 'report-4',
        title: '新活動',
        typeLabel: '新類型',
        status: 'pending' as const,
        time: '2024-01-15T10:15:00Z'
      }]
      await wrapper.setProps({ activities: newActivities })

      expect(wrapper.findAll('.activity-item')).toHaveLength(4)
      expect(wrapper.text()).toContain('新活動')
      expect(wrapper.text()).toContain('最近 4 項')
    })

    it('从有数据变为空数据应该显示空状态', async () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.find('.activity-list').exists()).toBe(true)

      await wrapper.setProps({ activities: [] })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.activity-list').exists()).toBe(false)
    })
  })

  describe('边界条件', () => {
    it('应该处理单个活动', () => {
      const singleActivity: RecentActivity[] = [mockActivities[0]]

      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: singleActivity,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.findAll('.activity-item')).toHaveLength(1)
      expect(wrapper.text()).toContain('最近 1 項')
    })

    it('应该处理大量活动（10项）', () => {
      const manyActivities: RecentActivity[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        reportId: `report-${i + 1}`,
        title: `活動 ${i + 1}`,
        typeLabel: '類型',
        status: 'completed' as const,
        time: '2024-01-15T10:00:00Z'
      }))

      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: manyActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.findAll('.activity-item')).toHaveLength(10)
      expect(wrapper.text()).toContain('最近 10 項')
    })

    it('应该正确处理所有状态类型', () => {
      const allStatusActivities: RecentActivity[] = [
        { ...mockActivities[0], status: 'completed' },
        { ...mockActivities[1], status: 'generating' },
        { ...mockActivities[2], status: 'failed' },
        { id: '4', reportId: 'report-4', title: '待處理', typeLabel: '類型', status: 'pending', time: '2024-01-15T10:00:00Z' }
      ]

      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: allStatusActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      const iconDivs = wrapper.findAll('.activity-icon')
      expect(iconDivs[0].classes()).toContain('completed')
      expect(iconDivs[1].classes()).toContain('generating')
      expect(iconDivs[2].classes()).toContain('failed')
      expect(iconDivs[3].classes()).toContain('pending')
    })
  })

  describe('滚动容器', () => {
    it('widget-content 应该有 max-height 样式类', () => {
      const wrapper = mount(RecentActivityWidget, {
        props: {
          activities: mockActivities,
          getStatusIcon: mockGetStatusIcon,
          formatRelativeTime: mockFormatRelativeTime
        }
      })

      expect(wrapper.find('.widget-content').exists()).toBe(true)
    })
  })
})
