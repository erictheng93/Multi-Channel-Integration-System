/**
 * Unit Tests for PerformanceCard Component
 *
 * @module tests/unit/components/dashboard/PerformanceCard.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PerformanceCard from '@/components/dashboard/PerformanceCard.vue'

// Mock icon component
const MockIcon = {
  name: 'MockIcon',
  template: '<svg class="mock-icon"><circle /></svg>'
}

describe('PerformanceCard', () => {
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '5分钟',
          label: '平均响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-card').exists()).toBe(true)
      expect(wrapper.find('.performance-icon').exists()).toBe(true)
      expect(wrapper.find('.performance-content').exists()).toBe(true)
    })

    it('应该显示正确的值', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '5分钟',
          label: '响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('5分钟')
    })

    it('应该显示正确的标签', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 92,
          label: '客户满意度',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-label').text()).toBe('客户满意度')
    })

    it('应该渲染图标组件', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon
        }
      })

      const iconContainer = wrapper.find('.performance-icon')
      expect(iconContainer.exists()).toBe(true)
      expect(iconContainer.find('.mock-icon').exists()).toBe(true)
    })
  })

  describe('数值类型', () => {
    it('应该支持数字类型的值', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 92,
          label: '满意度',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('92')
    })

    it('应该支持字符串类型的值', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '5分钟',
          label: '响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('5分钟')
    })

    it('应该支持零值', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 0,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('0')
    })

    it('应该支持带单位的字符串', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '92%',
          label: '满意度',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('92%')
    })
  })

  describe('变体 (Variants)', () => {
    it('应该使用默认变体', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-card').classes()).toContain('default')
      expect(wrapper.find('.performance-icon').classes()).toContain('default')
    })

    it('应该应用 response-time 变体', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '5分钟',
          label: '响应时间',
          icon: MockIcon,
          variant: 'response-time'
        }
      })

      expect(wrapper.find('.performance-card').classes()).toContain('response-time')
      expect(wrapper.find('.performance-icon').classes()).toContain('response-time')
    })

    it('应该应用 satisfaction 变体', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '92%',
          label: '满意度',
          icon: MockIcon,
          variant: 'satisfaction'
        }
      })

      expect(wrapper.find('.performance-card').classes()).toContain('satisfaction')
      expect(wrapper.find('.performance-icon').classes()).toContain('satisfaction')
    })

    it('应该应用 resolved 变体', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 45,
          label: '已解决',
          icon: MockIcon,
          variant: 'resolved'
        }
      })

      expect(wrapper.find('.performance-card').classes()).toContain('resolved')
      expect(wrapper.find('.performance-icon').classes()).toContain('resolved')
    })

    it('每个变体应该只有一个变体类', () => {
      const variants = ['response-time', 'satisfaction', 'resolved', 'default'] as const

      variants.forEach(variant => {
        const wrapper = mount(PerformanceCard, {
          props: {
            value: 100,
            label: '测试',
            icon: MockIcon,
            variant
          }
        })

        const cardClasses = wrapper.find('.performance-card').classes()
        const iconClasses = wrapper.find('.performance-icon').classes()

        const cardVariantClasses = cardClasses.filter(c => variants.includes(c as any))
        const iconVariantClasses = iconClasses.filter(c => variants.includes(c as any))

        expect(cardVariantClasses).toHaveLength(1)
        expect(iconVariantClasses).toHaveLength(1)
        expect(cardVariantClasses[0]).toBe(variant)
        expect(iconVariantClasses[0]).toBe(variant)
      })
    })
  })

  describe('DOM 结构', () => {
    it('应该有正确的嵌套结构', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon
        }
      })

      const card = wrapper.find('.performance-card')
      expect(card.exists()).toBe(true)

      const icon = card.find('.performance-icon')
      const content = card.find('.performance-content')
      expect(icon.exists()).toBe(true)
      expect(content.exists()).toBe(true)

      const value = content.find('.performance-value')
      const label = content.find('.performance-label')
      expect(value.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('performance-icon 应该在 performance-content 之前', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon
        }
      })

      const card = wrapper.find('.performance-card')
      const children = Array.from(card.element.children)
      const iconIndex = children.findIndex(el => el.classList.contains('performance-icon'))
      const contentIndex = children.findIndex(el => el.classList.contains('performance-content'))

      expect(iconIndex).toBeLessThan(contentIndex)
    })
  })

  describe('图标组件', () => {
    it('应该使用 component :is 渲染图标', () => {
      const CustomIcon = {
        name: 'CustomIcon',
        template: '<div class="custom-icon">Custom</div>'
      }

      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: CustomIcon
        }
      })

      expect(wrapper.find('.custom-icon').exists()).toBe(true)
      expect(wrapper.find('.custom-icon').text()).toBe('Custom')
    })

    it('应该在 performance-icon 容器内渲染图标', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon
        }
      })

      const iconContainer = wrapper.find('.performance-icon')
      const icon = iconContainer.find('.mock-icon')

      expect(icon.exists()).toBe(true)
      expect(icon.element.parentElement).toBe(iconContainer.element)
    })
  })

  describe('边界情况', () => {
    it('应该处理超长标签文字', () => {
      const longLabel = '这是一个非常非常非常非常非常长的性能指标标签文字'

      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: longLabel,
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-label').text()).toBe(longLabel)
    })

    it('应该处理空标签', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-label').text()).toBe('')
    })

    it('应该处理空字符串值', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '',
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('')
    })

    it('应该处理特殊字符', () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '< 1分钟',
          label: '响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').exists()).toBe(true)
    })
  })

  describe('响应式更新', () => {
    it('应该在值更新时重新渲染', async () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: '5分钟',
          label: '响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-value').text()).toBe('5分钟')

      await wrapper.setProps({ value: '3分钟' })
      expect(wrapper.find('.performance-value').text()).toBe('3分钟')
    })

    it('应该在标签更新时重新渲染', async () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '标签1',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.performance-label').text()).toBe('标签1')

      await wrapper.setProps({ label: '标签2' })
      expect(wrapper.find('.performance-label').text()).toBe('标签2')
    })

    it('应该在变体更新时重新渲染', async () => {
      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: MockIcon,
          variant: 'response-time'
        }
      })

      expect(wrapper.find('.performance-card').classes()).toContain('response-time')

      await wrapper.setProps({ variant: 'satisfaction' })
      expect(wrapper.find('.performance-card').classes()).toContain('satisfaction')
      expect(wrapper.find('.performance-card').classes()).not.toContain('response-time')
    })

    it('应该在图标更新时重新渲染', async () => {
      const Icon1 = {
        name: 'Icon1',
        template: '<div class="icon-1">Icon 1</div>'
      }

      const Icon2 = {
        name: 'Icon2',
        template: '<div class="icon-2">Icon 2</div>'
      }

      const wrapper = mount(PerformanceCard, {
        props: {
          value: 100,
          label: '测试',
          icon: Icon1
        }
      })

      expect(wrapper.find('.icon-1').exists()).toBe(true)

      await wrapper.setProps({ icon: Icon2 })
      expect(wrapper.find('.icon-2').exists()).toBe(true)
      expect(wrapper.find('.icon-1').exists()).toBe(false)
    })
  })
})
