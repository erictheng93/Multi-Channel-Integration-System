/**
 * ReportsSection Component Unit Tests
 *
 * 测试报表列表容器的渲染和交互行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportsSection from '@/components/reports/dashboard/ReportsSection.vue'
import ReportCard from '@/components/reports/dashboard/ReportCard.vue'
import ReportRow from '@/components/reports/dashboard/ReportRow.vue'
import type { ReportBase } from '@/types/reports'

describe('ReportsSection.vue', () => {
  const mockHelpers = {
    getTypeBadgeClass: vi.fn(() => 'basic'),
    getReportTypeIcon: vi.fn(() => ''),
    getStatusIcon: vi.fn(() => ''),
    getStatusLabel: vi.fn(() => '已完成'),
    getStatusClass: vi.fn(() => 'completed'),
    getFormatIcon: vi.fn(() => ''),
    getFormatLabel: vi.fn(() => 'JSON'),
    formatRelativeTime: vi.fn(() => '5 分鐘前'),
    formatFileSize: vi.fn(() => '1.2 MB'),
    truncateText: vi.fn((text) => text)
  }

  const mockReports: ReportBase[] = [
    {
      id: 'report-1',
      title: '客戶數據分析報表',
      type: 'basic',
      status: 'completed',
      format: 'json',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:35:00Z',
      fileSize: 1258291,
      downloadUrl: 'https://example.com/download/report-1'
    },
    {
      id: 'report-2',
      title: '性能分析報表',
      type: 'performance',
      status: 'generating',
      format: 'csv',
      createdAt: '2024-01-15T10:25:00Z',
      updatedAt: '2024-01-15T10:25:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试 - 基本结构', () => {
    it('应该渲染区段标题', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('報表列表')
    })

    it('非加载时应该显示报表数量', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.report-count').exists()).toBe(true)
      expect(wrapper.text()).toContain('共 2 項')
    })

    it('加载时不应该显示报表数量', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: true,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.report-count').exists()).toBe(false)
    })

    it('应该渲染排序控制', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.sort-control').exists()).toBe(true)
      expect(wrapper.text()).toContain('排序：')
    })

    it('应该渲染视图模式切换按钮', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const viewButtons = wrapper.findAll('.view-btn')
      expect(viewButtons).toHaveLength(2)
      expect(viewButtons[0].text()).toContain('網格')
      expect(viewButtons[1].text()).toContain('列表')
    })
  })

  describe('加载状态', () => {
    it('加载时应该显示加载状态', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: true,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.loading-state').exists()).toBe(true)
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
      expect(wrapper.text()).toContain('載入中...')
    })

    it('加载时不应该显示报表列表', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: true,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.reports-grid').exists()).toBe(false)
      expect(wrapper.find('.reports-list').exists()).toBe(false)
    })
  })

  describe('空状态', () => {
    it('无报表时应该显示空状态', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: [],
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('暫無報表')
    })

    it('应该显示自定义空状态消息', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: [],
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          emptyMessage: '沒有符合條件的報表',
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('沒有符合條件的報表')
    })

    it('showCreateButton 为 true 时应该显示创建按钮', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: [],
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          showCreateButton: true,
          ...mockHelpers
        }
      })

      const createBtn = wrapper.find('.btn-primary')
      expect(createBtn.exists()).toBe(true)
      expect(createBtn.text()).toContain('建立報表')
    })

    it('showCreateButton 为 false 时不应该显示创建按钮', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: [],
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          showCreateButton: false,
          ...mockHelpers
        }
      })

      expect(wrapper.find('.btn-primary').exists()).toBe(false)
    })

    it('点击创建按钮应该发射 create-report 事件', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: [],
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          showCreateButton: true,
          ...mockHelpers
        }
      })

      await wrapper.find('.btn-primary').trigger('click')

      expect(wrapper.emitted('create-report')).toBeTruthy()
    })
  })

  describe('视图模式 - 网格视图', () => {
    it('viewMode 为 grid 时应该显示网格视图', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.reports-grid').exists()).toBe(true)
      expect(wrapper.find('.reports-list').exists()).toBe(false)
    })

    it('网格视图应该为每个报表渲染 ReportCard', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const cards = wrapper.findAllComponents(ReportCard)
      expect(cards).toHaveLength(2)
    })

    it('网格视图按钮应该激活', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const gridBtn = wrapper.findAll('.view-btn')[0]
      expect(gridBtn.classes()).toContain('active')
    })
  })

  describe('视图模式 - 列表视图', () => {
    it('viewMode 为 list 时应该显示列表视图', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'list',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.reports-list').exists()).toBe(true)
      expect(wrapper.find('.reports-grid').exists()).toBe(false)
    })

    it('列表视图应该显示表头', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'list',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const header = wrapper.find('.list-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('類型')
      expect(header.text()).toContain('標題')
      expect(header.text()).toContain('狀態')
      expect(header.text()).toContain('格式')
      expect(header.text()).toContain('建立時間')
      expect(header.text()).toContain('大小')
      expect(header.text()).toContain('操作')
    })

    it('列表视图应该为每个报表渲染 ReportRow', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'list',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const rows = wrapper.findAllComponents(ReportRow)
      expect(rows).toHaveLength(2)
    })

    it('列表视图按钮应该激活', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'list',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const listBtn = wrapper.findAll('.view-btn')[1]
      expect(listBtn.classes()).toContain('active')
    })
  })

  describe('事件发射 - 视图模式切换', () => {
    it('点击网格按钮应该发射 update:viewMode', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'list',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      await wrapper.findAll('.view-btn')[0].trigger('click')

      expect(wrapper.emitted('update:viewMode')).toBeTruthy()
      expect(wrapper.emitted('update:viewMode')![0]).toEqual(['grid'])
    })

    it('点击列表按钮应该发射 update:viewMode', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      await wrapper.findAll('.view-btn')[1].trigger('click')

      expect(wrapper.emitted('update:viewMode')).toBeTruthy()
      expect(wrapper.emitted('update:viewMode')![0]).toEqual(['list'])
    })
  })

  describe('事件发射 - 排序', () => {
    it('更改排序应该发射 update:sortOrder', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const sortSelect = wrapper.find('.sort-select')
      await sortSelect.setValue('asc')

      expect(wrapper.emitted('update:sortOrder')).toBeTruthy()
      expect(wrapper.emitted('update:sortOrder')![0]).toEqual(['asc'])
    })

    it('排序选择器应该显示当前排序', () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'asc',
          ...mockHelpers
        }
      })

      const sortSelect = wrapper.find('.sort-select')
      expect((sortSelect.element as HTMLSelectElement).value).toBe('asc')
    })
  })

  describe('事件转发', () => {
    it('应该转发 view-report 事件', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const card = wrapper.findComponent(ReportCard)
      await card.vm.$emit('view-report', 'report-1')

      expect(wrapper.emitted('view-report')).toBeTruthy()
      expect(wrapper.emitted('view-report')![0]).toEqual(['report-1'])
    })

    it('应该转发 download-report 事件', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const card = wrapper.findComponent(ReportCard)
      await card.vm.$emit('download-report', mockReports[0])

      expect(wrapper.emitted('download-report')).toBeTruthy()
      expect(wrapper.emitted('download-report')![0]).toEqual([mockReports[0]])
    })

    it('应该转发 delete-report 事件', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      const card = wrapper.findComponent(ReportCard)
      await card.vm.$emit('delete-report', mockReports[0])

      expect(wrapper.emitted('delete-report')).toBeTruthy()
      expect(wrapper.emitted('delete-report')![0]).toEqual([mockReports[0]])
    })
  })

  describe('响应式更新', () => {
    it('应该响应 reports 变化', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('共 2 項')

      await wrapper.setProps({ reports: [mockReports[0]] })

      expect(wrapper.text()).toContain('共 1 項')
    })

    it('应该响应 loading 状态变化', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.loading-state').exists()).toBe(false)
      expect(wrapper.find('.reports-grid').exists()).toBe(true)

      await wrapper.setProps({ loading: true })

      expect(wrapper.find('.loading-state').exists()).toBe(true)
      expect(wrapper.find('.reports-grid').exists()).toBe(false)
    })

    it('应该响应 viewMode 变化', async () => {
      const wrapper = mount(ReportsSection, {
        props: {
          reports: mockReports,
          loading: false,
          viewMode: 'grid',
          sortOrder: 'desc',
          ...mockHelpers
        }
      })

      expect(wrapper.find('.reports-grid').exists()).toBe(true)
      expect(wrapper.find('.reports-list').exists()).toBe(false)

      await wrapper.setProps({ viewMode: 'list' })

      expect(wrapper.find('.reports-grid').exists()).toBe(false)
      expect(wrapper.find('.reports-list').exists()).toBe(true)
    })
  })
})
