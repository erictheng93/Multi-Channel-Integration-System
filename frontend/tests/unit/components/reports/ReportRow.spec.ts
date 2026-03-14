/**
 * ReportRow Component Unit Tests
 *
 * 测试列表视图报表行组件的渲染和交互行为
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportRow from '@/components/reports/dashboard/ReportRow.vue'
import type { ReportBase } from '@/types/reports'

describe('ReportRow.vue', () => {
  // Mock helper functions
  const mockHelpers = {
    getTypeBadgeClass: vi.fn((type) => type === 'basic' ? 'basic' : 'enterprise'),
    getReportTypeIcon: vi.fn(() => ''),
    getStatusIcon: vi.fn((status) => status === 'completed' ? '' : ''),
    getStatusLabel: vi.fn((status) => status === 'completed' ? '已完成' : '待處理'),
    getStatusClass: vi.fn((status) => status),
    getFormatIcon: vi.fn(() => ''),
    getFormatLabel: vi.fn(() => 'JSON'),
    formatRelativeTime: vi.fn(() => '5 分鐘前'),
    formatFileSize: vi.fn(() => '1.2 MB'),
    truncateText: vi.fn((text, length) => text.length > length ? `${text.substring(0, length)  }...` : text)
  }

  const mockReport: ReportBase = {
    id: 'report-1',
    title: '客戶數據分析報表',
    description: '這是一個詳細的客戶數據分析報表，包含多個維度的數據統計',
    type: 'basic',
    format: 'json',
    status: 'completed',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:35:00Z',
    fileSize: 1258291,
    downloadUrl: 'https://example.com/download/report-1'
  }

  describe('Props 渲染', () => {
    it('应该渲染基本报表信息', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('客戶數據分析報表')
      expect(wrapper.text()).toContain('已完成')
      expect(wrapper.text()).toContain('JSON')
      expect(wrapper.text()).toContain('5 分鐘前')
      expect(wrapper.text()).toContain('1.2 MB')
    })

    it('应该调用 getTypeBadgeClass 获取徽章类别', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(mockHelpers.getTypeBadgeClass).toHaveBeenCalledWith('basic')
      expect(wrapper.find('.report-type-badge').classes()).toContain('basic')
    })

    it('应该调用所有helper方法', () => {
      mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(mockHelpers.getReportTypeIcon).toHaveBeenCalled()
      expect(mockHelpers.getStatusIcon).toHaveBeenCalledWith('completed')
      expect(mockHelpers.getStatusLabel).toHaveBeenCalledWith('completed')
      expect(mockHelpers.getStatusClass).toHaveBeenCalledWith('completed')
      expect(mockHelpers.getFormatIcon).toHaveBeenCalledWith('json')
      expect(mockHelpers.getFormatLabel).toHaveBeenCalledWith('json')
      expect(mockHelpers.formatRelativeTime).toHaveBeenCalledWith('2024-01-15T10:30:00Z')
      expect(mockHelpers.formatFileSize).toHaveBeenCalledWith(1258291)
    })

    it('应该截断长描述文本', () => {
      const _wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(mockHelpers.truncateText).toHaveBeenCalledWith(mockReport.description, 60)
    })

    it('没有描述时不应该渲染描述元素', () => {
      const reportWithoutDesc = { ...mockReport, description: undefined }
      const wrapper = mount(ReportRow, {
        props: {
          report: reportWithoutDesc,
          ...mockHelpers
        }
      })

      expect(wrapper.find('.report-description').exists()).toBe(false)
    })

    it('没有文件大小时应该显示连字符', () => {
      const reportWithoutSize = { ...mockReport, fileSize: undefined }
      const wrapper = mount(ReportRow, {
        props: {
          report: reportWithoutSize,
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('-')
    })
  })

  describe('状态类别应用', () => {
    it('应该应用 completed 状态类别', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, status: 'completed' },
          ...mockHelpers
        }
      })

      const statusBadge = wrapper.find('.status-badge')
      expect(statusBadge.classes()).toContain('completed')
    })

    it('应该应用 pending 状态类别', () => {
      const helpers = {
        ...mockHelpers,
        getStatusClass: vi.fn(() => 'pending')
      }
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, status: 'pending' },
          ...helpers
        }
      })

      const statusBadge = wrapper.find('.status-badge')
      expect(statusBadge.classes()).toContain('pending')
    })

    it('应该应用 failed 状态类别', () => {
      const helpers = {
        ...mockHelpers,
        getStatusClass: vi.fn(() => 'failed')
      }
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, status: 'failed' },
          ...helpers
        }
      })

      const statusBadge = wrapper.find('.status-badge')
      expect(statusBadge.classes()).toContain('failed')
    })
  })

  describe('按钮状态', () => {
    it('报表已完成且有下载链接时应该启用下载按钮', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      const downloadBtn = wrapper.findAll('.action-btn')[0]
      expect(downloadBtn.attributes('disabled')).toBeUndefined()
    })

    it('报表未完成时应该禁用下载按钮', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, status: 'pending', downloadUrl: undefined },
          ...mockHelpers
        }
      })

      const downloadBtn = wrapper.findAll('.action-btn')[0]
      expect(downloadBtn.attributes('disabled')).toBeDefined()
    })

    it('报表没有下载链接时应该禁用下载按钮', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, downloadUrl: undefined },
          ...mockHelpers
        }
      })

      const downloadBtn = wrapper.findAll('.action-btn')[0]
      expect(downloadBtn.attributes('disabled')).toBeDefined()
    })

    it('报表生成中时应该禁用删除按钮', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: { ...mockReport, status: 'generating' },
          ...mockHelpers
        }
      })

      const deleteBtn = wrapper.findAll('.action-btn')[1]
      expect(deleteBtn.attributes('disabled')).toBeDefined()
    })

    it('其他状态下应该启用删除按钮', () => {
      const statuses: Array<'completed' | 'failed' | 'pending' | 'expired'> = ['completed', 'failed', 'pending', 'expired']

      statuses.forEach((status) => {
        const wrapper = mount(ReportRow, {
          props: {
            report: { ...mockReport, status },
            ...mockHelpers
          }
        })

        const deleteBtn = wrapper.findAll('.action-btn')[1]
        expect(deleteBtn.attributes('disabled')).toBeUndefined()
      })
    })
  })

  describe('事件发射', () => {
    it('点击行应该发射 view-report 事件', async () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      await wrapper.find('.report-row').trigger('click')

      expect(wrapper.emitted('view-report')).toBeTruthy()
      expect(wrapper.emitted('view-report')![0]).toEqual(['report-1'])
    })

    it('点击下载按钮应该发射 download-report 事件并阻止冒泡', async () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      const downloadBtn = wrapper.findAll('.action-btn')[0]
      await downloadBtn.trigger('click')

      expect(wrapper.emitted('download-report')).toBeTruthy()
      expect(wrapper.emitted('download-report')![0]).toEqual([mockReport])
      // 点击按钮不应该触发行的 view-report 事件 (使用 @click.stop)
      expect(wrapper.emitted('view-report')).toBeFalsy()
    })

    it('点击删除按钮应该发射 delete-report 事件并阻止冒泡', async () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      const deleteBtn = wrapper.findAll('.action-btn')[1]
      await deleteBtn.trigger('click')

      expect(wrapper.emitted('delete-report')).toBeTruthy()
      expect(wrapper.emitted('delete-report')![0]).toEqual([mockReport])
      // 点击按钮不应该触发行的 view-report 事件
      expect(wrapper.emitted('view-report')).toBeFalsy()
    })
  })

  describe('响应式更新', () => {
    it('应该响应报表数据更新', async () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(wrapper.text()).toContain('客戶數據分析報表')

      await wrapper.setProps({
        report: { ...mockReport, title: '更新後的報表標題' }
      })

      expect(wrapper.text()).toContain('更新後的報表標題')
    })

    it('应该响应状态变更', async () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      const downloadBtn = wrapper.findAll('.action-btn')[0]
      expect(downloadBtn.attributes('disabled')).toBeUndefined()

      await wrapper.setProps({
        report: { ...mockReport, status: 'pending', downloadUrl: undefined }
      })

      const updatedDownloadBtn = wrapper.findAll('.action-btn')[0]
      expect(updatedDownloadBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('DOM 结构', () => {
    it('应该具有正确的网格布局类', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      expect(wrapper.find('.report-row').exists()).toBe(true)
      expect(wrapper.find('.type-cell').exists()).toBe(true)
      expect(wrapper.find('.title-cell').exists()).toBe(true)
      expect(wrapper.find('.status-cell').exists()).toBe(true)
      expect(wrapper.find('.format-cell').exists()).toBe(true)
      expect(wrapper.find('.time-cell').exists()).toBe(true)
      expect(wrapper.find('.size-cell').exists()).toBe(true)
      expect(wrapper.find('.actions-cell').exists()).toBe(true)
    })

    it('应该有正确数量的操作按钮', () => {
      const wrapper = mount(ReportRow, {
        props: {
          report: mockReport,
          ...mockHelpers
        }
      })

      const actionButtons = wrapper.findAll('.action-btn')
      expect(actionButtons).toHaveLength(2)
      expect(actionButtons[0].attributes('title')).toBe('下載')
      expect(actionButtons[1].attributes('title')).toBe('刪除')
    })
  })
})
