/**
 * StatCard Component 单元测试
 *
 * 测试策略:
 * 1. Props 渲染
 * 2. Type 样式类
 * 3. Slot 插槽
 * 4. 响应式更新
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatCard from '@/components/reports/dashboard/StatCard.vue'

describe('StatCard.vue', () => {
  describe('Props 渲染', () => {
    it('應該渲染基本 props', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總報表數'
        }
      })

      expect(wrapper.find('.stat-icon').text()).toBe('📊')
      expect(wrapper.find('.stat-number').text()).toBe('100')
      expect(wrapper.find('.stat-label').text()).toBe('總報表數')
    })

    it('應該接受字符串類型的 number', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '✅',
          number: '75%',
          label: '完成率'
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('75%')
    })

    it('應該使用默認 type', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '測試'
        }
      })

      expect(wrapper.classes()).toContain('default')
    })
  })

  describe('Type 样式类', () => {
    it('應該應用 total type 類', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數',
          type: 'total'
        }
      })

      expect(wrapper.classes()).toContain('total')
    })

    it('應該應用 completed type 類', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '✅',
          number: 80,
          label: '已完成',
          type: 'completed'
        }
      })

      expect(wrapper.classes()).toContain('completed')
    })

    it('應該應用 generating type 類', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '⚙️',
          number: 10,
          label: '處理中',
          type: 'generating'
        }
      })

      expect(wrapper.classes()).toContain('generating')
    })

    it('應該應用 failed type 類', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '❌',
          number: 5,
          label: '失敗',
          type: 'failed'
        }
      })

      expect(wrapper.classes()).toContain('failed')
    })
  })

  describe('Slot 插槽', () => {
    it('應該渲染 extra slot', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數'
        },
        slots: {
          extra: '<div class="custom-extra">Extra Content</div>'
        }
      })

      expect(wrapper.find('.custom-extra').exists()).toBe(true)
      expect(wrapper.find('.custom-extra').text()).toBe('Extra Content')
    })

    it('沒有提供 extra slot 時不應該渲染', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數'
        }
      })

      // slot 位置應該存在但沒有內容
      const slotContainer = wrapper.find('.stat-card')
      expect(slotContainer.exists()).toBe(true)
    })
  })

  describe('響應式更新', () => {
    it('應該響應 props 更新', async () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數'
        }
      })

      expect(wrapper.find('.stat-number').text()).toBe('100')

      await wrapper.setProps({ number: 200 })

      expect(wrapper.find('.stat-number').text()).toBe('200')
    })

    it('應該響應 type 更新', async () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數',
          type: 'total'
        }
      })

      expect(wrapper.classes()).toContain('total')

      await wrapper.setProps({ type: 'completed' })

      expect(wrapper.classes()).toContain('completed')
      expect(wrapper.classes()).not.toContain('total')
    })
  })

  describe('DOM 結構', () => {
    it('應該具有正確的 DOM 結構', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數'
        }
      })

      expect(wrapper.find('.stat-card').exists()).toBe(true)
      expect(wrapper.find('.stat-icon').exists()).toBe(true)
      expect(wrapper.find('.stat-content').exists()).toBe(true)
      expect(wrapper.find('.stat-number').exists()).toBe(true)
      expect(wrapper.find('.stat-label').exists()).toBe(true)
    })

    it('應該具有正確的樣式類', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總數',
          type: 'total'
        }
      })

      const card = wrapper.find('.stat-card')
      expect(card.classes()).toContain('stat-card')
      expect(card.classes()).toContain('total')
    })
  })

  describe('完整渲染示例', () => {
    it('應該渲染帶有額外內容的完整卡片', () => {
      const wrapper = mount(StatCard, {
        props: {
          icon: '📊',
          number: 100,
          label: '總報表數',
          type: 'total'
        },
        slots: {
          extra: `
            <div class="stat-trend">
              <span class="trend-indicator up">↗</span>
              <span class="trend-text">本月 +10</span>
            </div>
          `
        }
      })

      // 驗證基本內容
      expect(wrapper.find('.stat-icon').text()).toBe('📊')
      expect(wrapper.find('.stat-number').text()).toBe('100')
      expect(wrapper.find('.stat-label').text()).toBe('總報表數')

      // 驗證 type 類
      expect(wrapper.classes()).toContain('total')

      // 驗證 extra slot
      expect(wrapper.find('.stat-trend').exists()).toBe(true)
      expect(wrapper.find('.trend-indicator').exists()).toBe(true)
      expect(wrapper.find('.trend-text').text()).toBe('本月 +10')
    })
  })
})
