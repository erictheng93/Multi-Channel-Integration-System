/**
 * Unit Tests for StatsGrid Component
 *
 * @module tests/unit/components/dashboard/StatsGrid.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsGrid from '@/components/dashboard/StatsGrid.vue'

describe('StatsGrid', () => {
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(StatsGrid)

      expect(wrapper.find('.stats-overview').exists()).toBe(true)
      expect(wrapper.find('.stats-grid').exists()).toBe(true)
    })

    it('应该渲染插槽内容', () => {
      const wrapper = mount(StatsGrid, {
        slots: {
          default: '<div class="test-slot">Test Content</div>'
        }
      })

      expect(wrapper.find('.test-slot').exists()).toBe(true)
      expect(wrapper.find('.test-slot').text()).toBe('Test Content')
    })

    it('应该渲染多个插槽子元素', () => {
      const wrapper = mount(StatsGrid, {
        slots: {
          default: `
            <div class="card-1">Card 1</div>
            <div class="card-2">Card 2</div>
            <div class="card-3">Card 3</div>
            <div class="card-4">Card 4</div>
          `
        }
      })

      expect(wrapper.findAll('.stats-grid > div')).toHaveLength(4)
      expect(wrapper.find('.card-1').text()).toBe('Card 1')
      expect(wrapper.find('.card-4').text()).toBe('Card 4')
    })

    it('空插槽时应该正确渲染', () => {
      const wrapper = mount(StatsGrid)

      const grid = wrapper.find('.stats-grid')
      expect(grid.exists()).toBe(true)
      expect(grid.element.children.length).toBe(0)
    })
  })

  describe('结构', () => {
    it('应该有正确的 DOM 结构', () => {
      const wrapper = mount(StatsGrid, {
        slots: {
          default: '<div>Content</div>'
        }
      })

      const overview = wrapper.find('.stats-overview')
      expect(overview.exists()).toBe(true)

      const grid = overview.find('.stats-grid')
      expect(grid.exists()).toBe(true)
      expect(grid.element.parentElement).toBe(overview.element)
    })
  })

  describe('样式类', () => {
    it('应该应用正确的 CSS 类', () => {
      const wrapper = mount(StatsGrid)

      expect(wrapper.classes()).toContain('stats-overview')
      expect(wrapper.find('.stats-grid').exists()).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('应该处理空字符串插槽', () => {
      const wrapper = mount(StatsGrid, {
        slots: {
          default: ''
        }
      })

      expect(wrapper.find('.stats-grid').exists()).toBe(true)
    })

    it('应该处理包含特殊字符的插槽内容', () => {
      const wrapper = mount(StatsGrid, {
        slots: {
          default: '<div>特殊字符: &lt;&gt;&amp;"\'</div>'
        }
      })

      expect(wrapper.find('.stats-grid').exists()).toBe(true)
    })

    it('应该处理大量子元素', () => {
      const cards = Array.from({ length: 20 }, (_, i) =>
        `<div class="card-${i}">Card ${i}</div>`
      ).join('')

      const wrapper = mount(StatsGrid, {
        slots: {
          default: cards
        }
      })

      expect(wrapper.findAll('.stats-grid > div')).toHaveLength(20)
    })
  })
})
