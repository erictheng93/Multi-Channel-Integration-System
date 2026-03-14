/**
 * FiltersSection Component Unit Tests
 *
 * 测试筛选器面板的渲染和交互行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FiltersSection from '@/components/reports/dashboard/FiltersSection.vue'
import type { ReportListQuery } from '@/types/reports'

describe('FiltersSection.vue', () => {
  const mockGetReportTypeIcon = vi.fn((type) => {
    const icons: Record<string, string> = {
      'basic': '',
      'customer-analytics': '',
      'performance': ''
    }
    return icons[type] || ''
  })

  const mockGroupedReportTypes = [
    {
      category: 'standard',
      title: '標準報表',
      types: [
        { value: 'basic', label: '基礎報表' },
        { value: 'customer-analytics', label: '客戶分析' }
      ]
    },
    {
      category: 'advanced',
      title: '進階報表',
      types: [
        { value: 'performance', label: '性能報表' }
      ]
    }
  ]

  const defaultFilters: ReportListQuery = {
    type: undefined,
    status: undefined,
    format: undefined,
    startDate: undefined,
    endDate: undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该渲染筛选器标题', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('篩選器')
    })

    it('应该渲染所有筛选器组', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.text()).toContain('報表類型')
      expect(wrapper.text()).toContain('狀態')
      expect(wrapper.text()).toContain('格式')
      expect(wrapper.text()).toContain('建立時間')
      expect(wrapper.text()).toContain('搜尋')
    })

    it('有活动筛选器时应该显示重置按钮', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: true,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.filter-reset').exists()).toBe(true)
      expect(wrapper.text()).toContain('清除篩選')
    })

    it('无活动筛选器时不应该显示重置按钮', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.filter-reset').exists()).toBe(false)
    })

    it('应该渲染分组的报表类型', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const optgroups = wrapper.findAll('optgroup')
      expect(optgroups).toHaveLength(2)
      expect(optgroups[0].attributes('label')).toBe('標準報表')
      expect(optgroups[1].attributes('label')).toBe('進階報表')
    })

    it('应该为每个报表类型调用 getReportTypeIcon', () => {
      mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('basic')
      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('customer-analytics')
      expect(mockGetReportTypeIcon).toHaveBeenCalledWith('performance')
    })
  })

  describe('状态选项测试', () => {
    it('应该渲染所有状态选项', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const statusSelect = wrapper.findAll('.filter-select')[1] // 第二个 select 是状态
      expect(statusSelect.text()).toContain('全部狀態')
      expect(statusSelect.text()).toContain(' 待處理')
      expect(statusSelect.text()).toContain(' 生成中')
      expect(statusSelect.text()).toContain(' 已完成')
      expect(statusSelect.text()).toContain(' 失敗')
      expect(statusSelect.text()).toContain(' 已過期')
    })
  })

  describe('格式选项测试', () => {
    it('应该渲染所有格式选项', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const formatSelect = wrapper.findAll('.filter-select')[2] // 第三个 select 是格式
      expect(formatSelect.text()).toContain('全部格式')
      expect(formatSelect.text()).toContain(' JSON')
      expect(formatSelect.text()).toContain(' CSV')
      expect(formatSelect.text()).toContain(' Excel')
      expect(formatSelect.text()).toContain(' PDF')
      expect(formatSelect.text()).toContain(' HTML')
    })
  })

  describe('筛选器值绑定', () => {
    it('应该正确绑定筛选器值', () => {
      const filters: ReportListQuery = {
        type: 'basic',
        status: 'completed',
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      }

      const wrapper = mount(FiltersSection, {
        props: {
          filters,
          searchQuery: 'test query',
          hasActiveFilters: true,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const selects = wrapper.findAll('.filter-select')
      const dateInputs = wrapper.findAll('.filter-date')
      const searchInput = wrapper.find('.search-input')

      expect((selects[0].element as HTMLSelectElement).value).toBe('basic')
      expect((selects[1].element as HTMLSelectElement).value).toBe('completed')
      expect((selects[2].element as HTMLSelectElement).value).toBe('json')
      expect((dateInputs[0].element as HTMLInputElement).value).toBe('2024-01-01')
      expect((dateInputs[1].element as HTMLInputElement).value).toBe('2024-01-31')
      expect((searchInput.element as HTMLInputElement).value).toBe('test query')
    })
  })

  describe('事件发射 - 筛选器更新', () => {
    it('更改类型筛选器应该发射 update:filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const typeSelect = wrapper.findAll('.filter-select')[0]
      await typeSelect.setValue('basic')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, type: 'basic' }
      ])
    })

    it('更改状态筛选器应该发射 update:filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const statusSelect = wrapper.findAll('.filter-select')[1]
      await statusSelect.setValue('completed')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, status: 'completed' }
      ])
    })

    it('更改格式筛选器应该发射 update:filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const formatSelect = wrapper.findAll('.filter-select')[2]
      await formatSelect.setValue('json')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, format: 'json' }
      ])
    })

    it('更改开始日期应该发射 update:filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const startDateInput = wrapper.findAll('.filter-date')[0]
      await startDateInput.setValue('2024-01-01')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, startDate: '2024-01-01' }
      ])
    })

    it('更改结束日期应该发射 update:filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const endDateInput = wrapper.findAll('.filter-date')[1]
      await endDateInput.setValue('2024-01-31')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, endDate: '2024-01-31' }
      ])
    })

    it('选择空值应该将筛选器设为 undefined', async () => {
      const filters: ReportListQuery = {
        ...defaultFilters,
        type: 'basic'
      }

      const wrapper = mount(FiltersSection, {
        props: {
          filters,
          searchQuery: '',
          hasActiveFilters: true,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const typeSelect = wrapper.findAll('.filter-select')[0]
      await typeSelect.setValue('')

      expect(wrapper.emitted('update:filters')).toBeTruthy()
      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...defaultFilters, type: undefined }
      ])
    })
  })

  describe('事件发射 - 搜索', () => {
    it('输入搜索内容应该发射 update:searchQuery', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const searchInput = wrapper.find('.search-input')
      await searchInput.setValue('test search')

      expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
      expect(wrapper.emitted('update:searchQuery')![0]).toEqual(['test search'])
    })
  })

  describe('事件发射 - 重置', () => {
    it('点击重置按钮应该发射 reset-filters', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: true,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const resetButton = wrapper.find('.filter-reset')
      await resetButton.trigger('click')

      expect(wrapper.emitted('reset-filters')).toBeTruthy()
      expect(wrapper.emitted('reset-filters')![0]).toEqual([])
    })
  })

  describe('响应式更新', () => {
    it('应该响应 filters prop 变化', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const typeSelect = wrapper.findAll('.filter-select')[0]
      expect((typeSelect.element as HTMLSelectElement).value).toBe('')

      await wrapper.setProps({
        filters: { ...defaultFilters, type: 'basic' }
      })

      expect((typeSelect.element as HTMLSelectElement).value).toBe('basic')
    })

    it('应该响应 hasActiveFilters 变化', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.filter-reset').exists()).toBe(false)

      await wrapper.setProps({ hasActiveFilters: true })

      expect(wrapper.find('.filter-reset').exists()).toBe(true)
    })

    it('应该响应 searchQuery 变化', async () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const searchInput = wrapper.find('.search-input')
      expect((searchInput.element as HTMLInputElement).value).toBe('')

      await wrapper.setProps({ searchQuery: 'new query' })

      expect((searchInput.element as HTMLInputElement).value).toBe('new query')
    })
  })

  describe('DOM 结构', () => {
    it('应该有正确的日期筛选器结构', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      const dateFilters = wrapper.find('.date-filters')
      expect(dateFilters.exists()).toBe(true)
      expect(wrapper.find('.date-separator').text()).toBe('至')
      expect(wrapper.findAll('.filter-date')).toHaveLength(2)
    })

    it('应该有正确的搜索输入结构', () => {
      const wrapper = mount(FiltersSection, {
        props: {
          filters: defaultFilters,
          searchQuery: '',
          hasActiveFilters: false,
          groupedReportTypes: mockGroupedReportTypes,
          getReportTypeIcon: mockGetReportTypeIcon
        }
      })

      expect(wrapper.find('.search-input-wrapper').exists()).toBe(true)
      expect(wrapper.find('.search-input').exists()).toBe(true)
      expect(wrapper.find('.search-icon').text()).toBe('')
    })
  })
})
