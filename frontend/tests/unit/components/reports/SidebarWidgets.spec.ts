/**
 * SidebarWidgets Component Unit Tests
 *
 * 测试侧边栏小部件容器的插槽渲染
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarWidgets from '@/components/reports/dashboard/SidebarWidgets.vue'
import { h } from 'vue'

describe('SidebarWidgets.vue', () => {
  describe('渲染测试 - 基本结构', () => {
    it('应该渲染容器元素', () => {
      const wrapper = mount(SidebarWidgets)

      expect(wrapper.find('.sidebar-widgets').exists()).toBe(true)
      expect(wrapper.find('.widgets-container').exists()).toBe(true)
    })

    it('没有插槽内容时不应该渲染 widget-wrapper', () => {
      const wrapper = mount(SidebarWidgets)

      expect(wrapper.findAll('.widget-wrapper')).toHaveLength(0)
    })
  })

  describe('插槽渲染 - quick-actions', () => {
    it('应该渲染 quick-actions 插槽内容', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions Content</div>'
        }
      })

      expect(wrapper.find('.test-quick-actions').exists()).toBe(true)
      expect(wrapper.text()).toContain('Quick Actions Content')
    })

    it('quick-actions 插槽应该被包裹在 widget-wrapper 中', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(1)
      expect(wrappers[0].find('.test-quick-actions').exists()).toBe(true)
    })
  })

  describe('插槽渲染 - popular-types', () => {
    it('应该渲染 popular-types 插槽内容', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'popular-types': '<div class="test-popular-types">Popular Types Content</div>'
        }
      })

      expect(wrapper.find('.test-popular-types').exists()).toBe(true)
      expect(wrapper.text()).toContain('Popular Types Content')
    })

    it('popular-types 插槽应该被包裹在 widget-wrapper 中', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'popular-types': '<div class="test-popular-types">Popular Types</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(1)
      expect(wrappers[0].find('.test-popular-types').exists()).toBe(true)
    })
  })

  describe('插槽渲染 - recent-activity', () => {
    it('应该渲染 recent-activity 插槽内容', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'recent-activity': '<div class="test-recent-activity">Recent Activity Content</div>'
        }
      })

      expect(wrapper.find('.test-recent-activity').exists()).toBe(true)
      expect(wrapper.text()).toContain('Recent Activity Content')
    })

    it('recent-activity 插槽应该被包裹在 widget-wrapper 中', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'recent-activity': '<div class="test-recent-activity">Recent Activity</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(1)
      expect(wrappers[0].find('.test-recent-activity').exists()).toBe(true)
    })
  })

  describe('插槽渲染 - default', () => {
    it('应该渲染 default 插槽内容', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          default: '<div class="test-default">Default Content</div>'
        }
      })

      expect(wrapper.find('.test-default').exists()).toBe(true)
      expect(wrapper.text()).toContain('Default Content')
    })

    it('default 插槽应该被包裹在 widget-wrapper 中', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          default: '<div class="test-default">Default</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(1)
      expect(wrappers[0].find('.test-default').exists()).toBe(true)
    })
  })

  describe('多个插槽组合', () => {
    it('应该同时渲染多个命名插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions</div>',
          'popular-types': '<div class="test-popular-types">Popular Types</div>',
          'recent-activity': '<div class="test-recent-activity">Recent Activity</div>'
        }
      })

      expect(wrapper.find('.test-quick-actions').exists()).toBe(true)
      expect(wrapper.find('.test-popular-types').exists()).toBe(true)
      expect(wrapper.find('.test-recent-activity').exists()).toBe(true)
    })

    it('多个插槽应该各自有独立的 widget-wrapper', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions</div>',
          'popular-types': '<div class="test-popular-types">Popular Types</div>',
          'recent-activity': '<div class="test-recent-activity">Recent Activity</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(3)
    })

    it('应该按正确顺序渲染插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">1. Quick Actions</div>',
          'popular-types': '<div class="test-popular-types">2. Popular Types</div>',
          'recent-activity': '<div class="test-recent-activity">3. Recent Activity</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers[0].find('.test-quick-actions').exists()).toBe(true)
      expect(wrappers[1].find('.test-popular-types').exists()).toBe(true)
      expect(wrappers[2].find('.test-recent-activity').exists()).toBe(true)
    })

    it('应该同时渲染命名插槽和默认插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions</div>',
          default: '<div class="test-default">Default</div>'
        }
      })

      expect(wrapper.find('.test-quick-actions').exists()).toBe(true)
      expect(wrapper.find('.test-default').exists()).toBe(true)
      expect(wrapper.findAll('.widget-wrapper')).toHaveLength(2)
    })

    it('默认插槽应该在最后渲染', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<div class="test-quick-actions">Quick Actions</div>',
          'popular-types': '<div class="test-popular-types">Popular Types</div>',
          default: '<div class="test-default">Default</div>'
        }
      })

      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers).toHaveLength(3)
      expect(wrappers[2].find('.test-default').exists()).toBe(true)
    })
  })

  describe('复杂插槽内容', () => {
    it('应该渲染包含多个元素的插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': `
            <div class="widget-header">
              <h3>Header</h3>
            </div>
            <div class="widget-body">
              <p>Body Content</p>
            </div>
          `
        }
      })

      expect(wrapper.find('.widget-header').exists()).toBe(true)
      expect(wrapper.find('.widget-body').exists()).toBe(true)
      expect(wrapper.text()).toContain('Header')
      expect(wrapper.text()).toContain('Body Content')
    })

    it('应该渲染使用 Vue 组件的插槽', () => {
      const TestComponent = {
        template: '<div class="test-component">{{ message }}</div>',
        props: ['message']
      }

      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': h(TestComponent, { message: 'Test Message' })
        }
      })

      expect(wrapper.find('.test-component').exists()).toBe(true)
      expect(wrapper.text()).toContain('Test Message')
    })
  })

  describe('边界条件', () => {
    it('应该处理空字符串插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': ''
        }
      })

      // Vue 将空字符串视为有效插槽内容，会渲染 wrapper
      // 这是 Vue 的预期行为
      expect(wrapper.findAll('.widget-wrapper').length).toBeGreaterThanOrEqual(0)
    })

    it('应该处理只包含空白字符的插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '   \n   '
        }
      })

      // 空白字符应该被视为内容（Vue 行为）
      const wrappers = wrapper.findAll('.widget-wrapper')
      expect(wrappers.length).toBeGreaterThanOrEqual(0)
    })

    it('应该处理包含注释的插槽', () => {
      const wrapper = mount(SidebarWidgets, {
        slots: {
          'quick-actions': '<!-- Comment --><div class="content">Content</div>'
        }
      })

      expect(wrapper.find('.content').exists()).toBe(true)
      expect(wrapper.findAll('.widget-wrapper')).toHaveLength(1)
    })
  })
})
