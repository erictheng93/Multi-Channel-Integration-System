/**
 * Unit Tests for StatCard Component
 *
 * @module tests/unit/components/dashboard/StatCard.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatCard from '@/components/dashboard/StatCard.vue'

// Mock icon component
const MockIcon = {
  name: 'MockIcon',
  template: '<svg class="mock-icon"><circle /></svg>'
}

describe('StatCard', () => {
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 42,
          label: '测试标签',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-card').exists()).toBe(true)
      expect(wrapper.find('.stat-content').exists()).toBe(true)
      expect(wrapper.find('.stat-icon').exists()).toBe(true)
    })

    it('应该显示正确的数值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 123,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('123')
    })

    it('应该显示正确的标签', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '待处理对话',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-label').text()).toBe('待处理对话')
    })

    it('应该渲染图标组件', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      const iconContainer = wrapper.find('.stat-icon')
      expect(iconContainer.exists()).toBe(true)
      expect(iconContainer.find('.mock-icon').exists()).toBe(true)
    })
  })

  describe('数值类型', () => {
    it('应该支持数字类型的值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 999,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('999')
    })

    it('应该支持字符串类型的值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: '5分钟',
          label: '响应时间',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('5分钟')
    })

    it('应该支持零值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 0,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('0')
    })

    it('应该支持大数值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 999999,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('999999')
    })

    it('应该支持负数值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: -10,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('-10')
    })

    it('应该支持小数值', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 12.5,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('12.5')
    })

    it('应该支持空字符串', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: '',
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('')
    })

    it('应该支持带单位的字符串', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: '92%',
          label: '满意度',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('92%')
    })
  })

  describe('变体 (Variants)', () => {
    it('应该使用默认变体', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('default')
    })

    it('应该应用 pending 变体', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '待处理',
          icon: MockIcon,
          variant: 'pending'
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('pending')
    })

    it('应该应用 active 变体', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '处理中',
          icon: MockIcon,
          variant: 'active'
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('active')
    })

    it('应该应用 messages 变体', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 100,
          label: '今日消息',
          icon: MockIcon,
          variant: 'messages'
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('messages')
    })

    it('应该应用 agents 变体', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 5,
          label: '在线客服',
          icon: MockIcon,
          variant: 'agents'
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('agents')
    })

    it('每个变体应该只有一个变体类', () => {
      const variants = ['pending', 'active', 'messages', 'agents', 'default'] as const

      variants.forEach(variant => {
        const wrapper = mount(StatCard, {
          props: {
            value: 10,
            label: '测试',
            icon: MockIcon,
            variant
          }
        })

        const classes = wrapper.find('.stat-card').classes()
        const variantClasses = classes.filter(c => variants.includes(c as any))
        expect(variantClasses).toHaveLength(1)
        expect(variantClasses[0]).toBe(variant)
      })
    })
  })

  describe('DOM 结构', () => {
    it('应该有正确的嵌套结构', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      const card = wrapper.find('.stat-card')
      expect(card.exists()).toBe(true)

      const content = card.find('.stat-content')
      expect(content.exists()).toBe(true)

      const number = content.find('.stat-number')
      const label = content.find('.stat-label')
      expect(number.exists()).toBe(true)
      expect(label.exists()).toBe(true)

      const iconContainer = card.find('.stat-icon')
      expect(iconContainer.exists()).toBe(true)
    })

    it('stat-content 应该在 stat-icon 之前', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      const card = wrapper.find('.stat-card')
      const children = Array.from(card.element.children)
      const contentIndex = children.findIndex(el => el.classList.contains('stat-content'))
      const iconIndex = children.findIndex(el => el.classList.contains('stat-icon'))

      expect(contentIndex).toBeLessThan(iconIndex)
    })
  })

  describe('图标组件', () => {
    it('应该使用 component :is 渲染图标', () => {
      const CustomIcon = {
        name: 'CustomIcon',
        template: '<div class="custom-icon">Custom</div>'
      }

      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: CustomIcon
        }
      })

      expect(wrapper.find('.custom-icon').exists()).toBe(true)
      expect(wrapper.find('.custom-icon').text()).toBe('Custom')
    })

    it('应该支持不同的图标组件', () => {
      const Icon1 = {
        name: 'Icon1',
        template: '<svg class="icon-1"></svg>'
      }

      const Icon2 = {
        name: 'Icon2',
        template: '<svg class="icon-2"></svg>'
      }

      const wrapper1 = mount(StatCard, {
        props: {
          value: 10,
          label: '测试1',
          icon: Icon1
        }
      })

      const wrapper2 = mount(StatCard, {
        props: {
          value: 20,
          label: '测试2',
          icon: Icon2
        }
      })

      expect(wrapper1.find('.icon-1').exists()).toBe(true)
      expect(wrapper2.find('.icon-2').exists()).toBe(true)
    })

    it('应该在 stat-icon 容器内渲染图标', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      const iconContainer = wrapper.find('.stat-icon')
      const icon = iconContainer.find('.mock-icon')

      expect(icon.exists()).toBe(true)
      expect(icon.element.parentElement).toBe(iconContainer.element)
    })
  })

  describe('边界情况', () => {
    it('应该处理超长标签文字', () => {
      const longLabel = '这是一个非常非常非常非常非常长的标签文字用于测试组件的边界情况处理能力'

      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: longLabel,
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-label').text()).toBe(longLabel)
    })

    it('应该处理包含特殊字符的标签', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '标签 <>&"\' 特殊字符',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-label').text()).toContain('标签')
      expect(wrapper.find('.stat-label').text()).toContain('特殊字符')
    })

    it('应该处理空标签', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-label').text()).toBe('')
    })

    it('应该处理 HTML 实体在值中', () => {
      const wrapper = mount(StatCard, {
        props: {
          value: '&lt;100&gt;',
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').exists()).toBe(true)
    })
  })

  describe('响应式更新', () => {
    it('应该在值更新时重新渲染', async () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('10')

      await wrapper.setProps({ value: 20 })
      expect(wrapper.find('.stat-number').text()).toBe('20')
    })

    it('应该在标签更新时重新渲染', async () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '标签1',
          icon: MockIcon
        }
      })

      expect(wrapper.find('.stat-label').text()).toBe('标签1')

      await wrapper.setProps({ label: '标签2' })
      expect(wrapper.find('.stat-label').text()).toBe('标签2')
    })

    it('应该在变体更新时重新渲染', async () => {
      const wrapper = mount(StatCard, {
        props: {
          value: 10,
          label: '测试',
          icon: MockIcon,
          variant: 'pending'
        }
      })

      expect(wrapper.find('.stat-card').classes()).toContain('pending')

      await wrapper.setProps({ variant: 'active' })
      expect(wrapper.find('.stat-card').classes()).toContain('active')
      expect(wrapper.find('.stat-card').classes()).not.toContain('pending')
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

      const wrapper = mount(StatCard, {
        props: {
          value: 10,
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
