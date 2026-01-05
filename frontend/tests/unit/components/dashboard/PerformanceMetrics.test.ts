/**
 * Unit Tests for PerformanceMetrics Component
 *
 * @module tests/unit/components/dashboard/PerformanceMetrics.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PerformanceMetrics from '@/components/dashboard/PerformanceMetrics.vue'
import PerformanceCard from '@/components/dashboard/PerformanceCard.vue'

describe('PerformanceMetrics', () => {
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: '5分钟',
          satisfactionRate: 92,
          resolvedToday: 45
        }
      })

      expect(wrapper.find('.performance-section').exists()).toBe(true)
      expect(wrapper.find('.section-header').exists()).toBe(true)
      expect(wrapper.find('.performance-grid').exists()).toBe(true)
    })

    it('应该渲染默认标题和副标题', () => {
      const wrapper = mount(PerformanceMetrics)

      expect(wrapper.find('.section-title').text()).toBe('效能指標')
      expect(wrapper.find('.section-subtitle').text()).toBe('今日系統表現概覽')
    })

    it('应该渲染自定义标题和副标题', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          title: '自定义标题',
          subtitle: '自定义副标题'
        }
      })

      expect(wrapper.find('.section-title').text()).toBe('自定义标题')
      expect(wrapper.find('.section-subtitle').text()).toBe('自定义副标题')
    })

    it('应该渲染3个性能卡片', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards).toHaveLength(3)
    })
  })

  describe('性能卡片内容', () => {
    it('应该正确传递响应时间', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: '5分钟'
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const responseTimeCard = cards[0]

      expect(responseTimeCard.props('value')).toBe('5分钟')
      expect(responseTimeCard.props('label')).toBe('平均回應時間')
      expect(responseTimeCard.props('variant')).toBe('response-time')
    })

    it('应该正确传递满意度并格式化', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 92
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const satisfactionCard = cards[1]

      expect(satisfactionCard.props('value')).toBe('92%')
      expect(satisfactionCard.props('label')).toBe('客戶滿意度')
      expect(satisfactionCard.props('variant')).toBe('satisfaction')
    })

    it('应该正确传递今日解决数', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          resolvedToday: 45
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const resolvedCard = cards[2]

      expect(resolvedCard.props('value')).toBe(45)
      expect(resolvedCard.props('label')).toBe('今日已解決')
      expect(resolvedCard.props('variant')).toBe('resolved')
    })

    it('应该为每个卡片传递正确的图标', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)

      // Each card should have an icon prop
      cards.forEach(card => {
        expect(card.props('icon')).toBeDefined()
        expect(card.props('icon')).not.toBeNull()
      })
    })
  })

  describe('默认值', () => {
    it('应该使用默认的响应时间', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)
      const responseTimeCard = cards[0]

      expect(responseTimeCard.props('value')).toBe('0分鐘')
    })

    it('应该使用默认的满意度', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)
      const satisfactionCard = cards[1]

      expect(satisfactionCard.props('value')).toBe('0%')
    })

    it('应该使用默认的解决数', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)
      const resolvedCard = cards[2]

      expect(resolvedCard.props('value')).toBe(0)
    })
  })

  describe('满意度格式化', () => {
    it('应该为满意度添加百分号', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 85
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const satisfactionCard = cards[1]

      expect(satisfactionCard.props('value')).toBe('85%')
    })

    it('应该正确格式化零值满意度', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 0
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const satisfactionCard = cards[1]

      expect(satisfactionCard.props('value')).toBe('0%')
    })

    it('应该正确格式化100%满意度', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 100
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      const satisfactionCard = cards[1]

      expect(satisfactionCard.props('value')).toBe('100%')
    })
  })

  describe('DOM 结构', () => {
    it('应该有正确的嵌套结构', () => {
      const wrapper = mount(PerformanceMetrics)

      const section = wrapper.find('.performance-section')
      expect(section.exists()).toBe(true)

      const header = section.find('.section-header')
      expect(header.exists()).toBe(true)

      const title = header.find('.section-title')
      const subtitle = header.find('.section-subtitle')
      expect(title.exists()).toBe(true)
      expect(subtitle.exists()).toBe(true)

      const grid = section.find('.performance-grid')
      expect(grid.exists()).toBe(true)
    })

    it('header 应该在 grid 之前', () => {
      const wrapper = mount(PerformanceMetrics)

      const section = wrapper.find('.performance-section')
      const children = Array.from(section.element.children)
      const headerIndex = children.findIndex(el => el.classList.contains('section-header'))
      const gridIndex = children.findIndex(el => el.classList.contains('performance-grid'))

      expect(headerIndex).toBeLessThan(gridIndex)
    })
  })

  describe('响应式更新', () => {
    it('应该在响应时间更新时重新渲染', async () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: '5分钟'
        }
      })

      let cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[0].props('value')).toBe('5分钟')

      await wrapper.setProps({ responseTime: '3分钟' })
      cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[0].props('value')).toBe('3分钟')
    })

    it('应该在满意度更新时重新渲染', async () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 85
        }
      })

      let cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[1].props('value')).toBe('85%')

      await wrapper.setProps({ satisfactionRate: 95 })
      cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[1].props('value')).toBe('95%')
    })

    it('应该在解决数更新时重新渲染', async () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          resolvedToday: 30
        }
      })

      let cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[2].props('value')).toBe(30)

      await wrapper.setProps({ resolvedToday: 50 })
      cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[2].props('value')).toBe(50)
    })

    it('应该在标题更新时重新渲染', async () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          title: '标题1',
          subtitle: '副标题1'
        }
      })

      expect(wrapper.find('.section-title').text()).toBe('标题1')
      expect(wrapper.find('.section-subtitle').text()).toBe('副标题1')

      await wrapper.setProps({
        title: '标题2',
        subtitle: '副标题2'
      })

      expect(wrapper.find('.section-title').text()).toBe('标题2')
      expect(wrapper.find('.section-subtitle').text()).toBe('副标题2')
    })
  })

  describe('边界情况', () => {
    it('应该处理负数响应时间', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: -1
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[0].props('value')).toBe(-1)
    })

    it('应该处理负数满意度', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: -5
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[1].props('value')).toBe('-5%')
    })

    it('应该处理超过100的满意度', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          satisfactionRate: 150
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[1].props('value')).toBe('150%')
    })

    it('应该处理负数解决数', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          resolvedToday: -10
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[2].props('value')).toBe(-10)
    })

    it('应该处理大数值', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          resolvedToday: 999999
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[2].props('value')).toBe(999999)
    })

    it('应该处理空字符串标题', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          title: '',
          subtitle: ''
        }
      })

      expect(wrapper.find('.section-title').text()).toBe('')
      expect(wrapper.find('.section-subtitle').text()).toBe('')
    })

    it('应该处理数字类型的响应时间', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: 5
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)
      expect(cards[0].props('value')).toBe(5)
    })
  })

  describe('卡片顺序', () => {
    it('应该按正确顺序渲染卡片', () => {
      const wrapper = mount(PerformanceMetrics, {
        props: {
          responseTime: '5分钟',
          satisfactionRate: 92,
          resolvedToday: 45
        }
      })

      const cards = wrapper.findAllComponents(PerformanceCard)

      expect(cards).toHaveLength(3)
      expect(cards[0].props('label')).toBe('平均回應時間')
      expect(cards[1].props('label')).toBe('客戶滿意度')
      expect(cards[2].props('label')).toBe('今日已解決')
    })

    it('应该按正确顺序渲染变体', () => {
      const wrapper = mount(PerformanceMetrics)

      const cards = wrapper.findAllComponents(PerformanceCard)

      expect(cards[0].props('variant')).toBe('response-time')
      expect(cards[1].props('variant')).toBe('satisfaction')
      expect(cards[2].props('variant')).toBe('resolved')
    })
  })
})
