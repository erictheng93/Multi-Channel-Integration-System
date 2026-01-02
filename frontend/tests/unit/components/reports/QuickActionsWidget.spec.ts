/**
 * QuickActionsWidget Component Unit Tests
 *
 * 测试快速操作小部件的渲染和交互行为
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickActionsWidget from '@/components/reports/dashboard/QuickActionsWidget.vue'

describe('QuickActionsWidget.vue', () => {
  describe('渲染测试', () => {
    it('应该渲染小部件标题', () => {
      const wrapper = mount(QuickActionsWidget)

      expect(wrapper.text()).toContain('⚡ 快速操作')
    })

    it('应该渲染4个操作按钮', () => {
      const wrapper = mount(QuickActionsWidget)

      const buttons = wrapper.findAll('.action-item')
      expect(buttons).toHaveLength(4)
    })

    it('应该正确渲染所有操作项', () => {
      const wrapper = mount(QuickActionsWidget)

      expect(wrapper.text()).toContain('建立報表')
      expect(wrapper.text()).toContain('重新整理')
      expect(wrapper.text()).toContain('匯出全部')
      expect(wrapper.text()).toContain('報表設定')
    })

    it('建立報表按钮应该有 primary 类', () => {
      const wrapper = mount(QuickActionsWidget)

      const createButton = wrapper.findAll('.action-item')[0]
      expect(createButton.classes()).toContain('primary')
    })
  })

  describe('加载状态', () => {
    it('加载时应该显示"載入中..."', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          loading: true
        }
      })

      expect(wrapper.text()).toContain('載入中...')
    })

    it('非加载时应该显示"更新報表列表"', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          loading: false
        }
      })

      expect(wrapper.text()).toContain('更新報表列表')
    })

    it('加载时应该禁用重新整理按钮', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          loading: true
        }
      })

      const refreshButton = wrapper.findAll('.action-item')[1]
      expect(refreshButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('totalReports 显示', () => {
    it('应该显示报表总数', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          totalReports: 42
        }
      })

      expect(wrapper.text()).toContain('下載所有報表 (42)')
    })

    it('报表总数为0时应该禁用导出按钮', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          totalReports: 0
        }
      })

      const exportButton = wrapper.findAll('.action-item')[2]
      expect(exportButton.attributes('disabled')).toBeDefined()
    })

    it('有报表时应该启用导出按钮', () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          totalReports: 10
        }
      })

      const exportButton = wrapper.findAll('.action-item')[2]
      expect(exportButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('事件发射', () => {
    it('点击建立報表应该发射 create-report 事件', async () => {
      const wrapper = mount(QuickActionsWidget)

      const createButton = wrapper.findAll('.action-item')[0]
      await createButton.trigger('click')

      expect(wrapper.emitted('create-report')).toBeTruthy()
      expect(wrapper.emitted('create-report')![0]).toEqual([])
    })

    it('点击重新整理应该发射 refresh 事件', async () => {
      const wrapper = mount(QuickActionsWidget)

      const refreshButton = wrapper.findAll('.action-item')[1]
      await refreshButton.trigger('click')

      expect(wrapper.emitted('refresh')).toBeTruthy()
      expect(wrapper.emitted('refresh')![0]).toEqual([])
    })

    it('点击匯出全部应该发射 export-all 事件', async () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          totalReports: 10
        }
      })

      const exportButton = wrapper.findAll('.action-item')[2]
      await exportButton.trigger('click')

      expect(wrapper.emitted('export-all')).toBeTruthy()
      expect(wrapper.emitted('export-all')![0]).toEqual([])
    })

    it('点击報表設定应该发射 view-settings 事件', async () => {
      const wrapper = mount(QuickActionsWidget)

      const settingsButton = wrapper.findAll('.action-item')[3]
      await settingsButton.trigger('click')

      expect(wrapper.emitted('view-settings')).toBeTruthy()
      expect(wrapper.emitted('view-settings')![0]).toEqual([])
    })
  })

  describe('响应式更新', () => {
    it('应该响应 loading prop 变化', async () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          loading: false
        }
      })

      expect(wrapper.text()).toContain('更新報表列表')

      await wrapper.setProps({ loading: true })

      expect(wrapper.text()).toContain('載入中...')
    })

    it('应该响应 totalReports prop 变化', async () => {
      const wrapper = mount(QuickActionsWidget, {
        props: {
          totalReports: 0
        }
      })

      const exportButton = wrapper.findAll('.action-item')[2]
      expect(exportButton.attributes('disabled')).toBeDefined()

      await wrapper.setProps({ totalReports: 5 })

      expect(wrapper.text()).toContain('下載所有報表 (5)')
      expect(exportButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('默认 props', () => {
    it('默认 loading 应该为 false', () => {
      const wrapper = mount(QuickActionsWidget)

      expect(wrapper.text()).toContain('更新報表列表')
      expect(wrapper.text()).not.toContain('載入中...')
    })

    it('默认 totalReports 应该为 0', () => {
      const wrapper = mount(QuickActionsWidget)

      expect(wrapper.text()).toContain('下載所有報表 (0)')
      const exportButton = wrapper.findAll('.action-item')[2]
      expect(exportButton.attributes('disabled')).toBeDefined()
    })
  })
})
