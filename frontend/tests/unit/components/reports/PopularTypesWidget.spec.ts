/**
 * PopularTypesWidget Component Unit Tests
 *
 * 测试热门报表类型小部件的渲染和交互行为
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PopularTypesWidget from '@/components/reports/dashboard/PopularTypesWidget.vue'
import type { PopularType } from '@/components/reports/dashboard/PopularTypesWidget.vue'

describe('PopularTypesWidget.vue', () => {
  const mockGetReportTypeIcon = vi.fn((type) => {
    const icons: Record<string, string> = {
      'basic': '📊',
      'customer-analytics': '👥',
      'performance': '⚡'
    }
    return icons[type] || '📄'
  })

  const mockPopularTypes: PopularType[] = [
    { type: 'basic', label: '基礎報表', count: 45, percentage: 45 },
    { type: 'customer-analytics', label: '客戶分析', count: 30, percentage: 30 },
    { type: 'performance', label: '性能報表', count: 25, percentage: 25 }
  ]

  describe('渲染测试', () => {
    it('应该渲染小部件标题', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('📊 熱門報表類型')
    })

    it('应该显示 Top N 标签', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('Top 3')
    })

    it('应该渲染所有类型项', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const typeItems = wrapper.findAll('.type-item')
      expect(typeItems).toHaveLength(3)
    })

    it('应该显示每个类型的信息', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('基礎報表')
      expect(wrapper.text()).toContain('45')
      expect(wrapper.text()).toContain('45%')
      expect(wrapper.text()).toContain('客戶分析')
      expect(wrapper.text()).toContain('30')
      expect(wrapper.text()).toContain('30%')
    })

    it('应该调用 getReportTypeIcon 获取图标', () => {
      mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('basic')
      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('customer-analytics')
      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('performance')
    })

    it('应该渲染进度条', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const progressBars = wrapper.findAll('.progress-fill')
      expect(progressBars).toHaveLength(3)

      // 检查进度条宽度
      expect(progressBars[0].attributes('style')).toContain('width: 45%')
      expect(progressBars[1].attributes('style')).toContain('width: 30%')
      expect(progressBars[2].attributes('style')).toContain('width: 25%')
    })
  })

  describe('空状态', () => {
    it('空数据时应该显示空状态', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: [],
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('暫無報表數據')
    })

    it('空数据时不应该显示类型列表', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: [],
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.types-list').exists()).toBe(false)
    })

    it('空数据时不应该显示 Top N 标签', () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: [],
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.header-subtitle').exists()).toBe(false)
    })
  })

  describe('事件发射', () => {
    it('点击类型项应该发射 filter-by-type 事件', async () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const firstType = wrapper.findAll('.type-item')[0]
      await firstType.trigger('click')

      expect(wrapper.emitted('filter-by-type')).toBeTruthy()
      expect(wrapper.emitted('filter-by-type')![0]).toEqual(['basic'])
    })

    it('点击不同类型应该发射对应的类型', async () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const typeItems = wrapper.findAll('.type-item')

      await typeItems[1].trigger('click')
      expect(wrapper.emitted('filter-by-type')![0]).toEqual(['customer-analytics'])

      await typeItems[2].trigger('click')
      expect(wrapper.emitted('filter-by-type')![1]).toEqual(['performance'])
    })
  })

  describe('响应式更新', () => {
    it('应该响应 popularTypes 数据变化', async () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.findAll('.type-item')).toHaveLength(3)

      const newTypes = [...mockPopularTypes, { type: 'new-type', label: '新類型', count: 10, percentage: 10 }]
      await wrapper.setProps({ popularTypes: newTypes })

      expect(wrapper.findAll('.type-item')).toHaveLength(4)
      expect(wrapper.text()).toContain('新類型')
    })

    it('从有数据变为空数据应该显示空状态', async () => {
      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: mockPopularTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.types-list').exists()).toBe(true)

      await wrapper.setProps({ popularTypes: [] })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.types-list').exists()).toBe(false)
    })
  })

  describe('边界条件', () => {
    it('应该处理单个类型', () => {
      const singleType: PopularType[] = [
        { type: 'basic', label: '基礎報表', count: 100, percentage: 100 }
      ]

      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: singleType,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.findAll('.type-item')).toHaveLength(1)
      expect(wrapper.text()).toContain('Top 1')
      expect(wrapper.text()).toContain('100%')
    })

    it('应该处理大量类型', () => {
      const manyTypes: PopularType[] = Array.from({ length: 10 }, (_, i) => ({
        type: `type-${i}`,
        label: `類型 ${i}`,
        count: 10 - i,
        percentage: 10 - i
      }))

      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: manyTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.findAll('.type-item')).toHaveLength(10)
      expect(wrapper.text()).toContain('Top 10')
    })

    it('应该处理0百分比的类型', () => {
      const zeroPercentType: PopularType[] = [
        { type: 'basic', label: '基礎報表', count: 0, percentage: 0 }
      ]

      const wrapper = mount(PopularTypesWidget, {
        props: {
          popularTypes: zeroPercentType,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('0%')
      const progressFill = wrapper.find('.progress-fill')
      expect(progressFill.attributes('style')).toContain('width: 0%')
    })
  })
})
