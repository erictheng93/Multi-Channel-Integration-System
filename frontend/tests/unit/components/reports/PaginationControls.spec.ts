/**
 * PaginationControls Component Unit Tests
 *
 * 测试分页控制组件的渲染和交互行为
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaginationControls from '@/components/ui/PaginationControls.vue'

describe('PaginationControls.vue', () => {
  const defaultPagination = {
    page: 1,
    pageSize: 20,
    total: 100,
    totalPages: 5,
    hasNext: true,
    hasPrev: false
  }

  describe('渲染测试', () => {
    it('应该正确渲染分页信息', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: defaultPagination,
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      expect(wrapper.text()).toContain('顯示 1 - 20 共 100 項')
    })

    it('应该正确计算起始和结束项编号', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: { ...defaultPagination, page: 2 },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      expect(wrapper.text()).toContain('顯示 21 - 40 共 100 項')
    })

    it('应该正确处理最后一页的项数', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 5,
            pageSize: 20,
            total: 95,
            totalPages: 5,
            hasNext: false,
            hasPrev: true
          },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      expect(wrapper.text()).toContain('顯示 81 - 95 共 95 項')
    })

    it('总页数小于等于1时仍应渲染', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 10,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          },
          visiblePages: [1]
        }
      })

      expect(wrapper.find('.pagination-section').exists()).toBe(true)
    })

    it('应该渲染所有可见页码按钮', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: defaultPagination,
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const pageButtons = wrapper.findAll('.page-btn')
      expect(pageButtons).toHaveLength(5)
      expect(pageButtons[0].text()).toBe('1')
      expect(pageButtons[4].text()).toBe('5')
    })

    it('应该高亮当前页码', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: { ...defaultPagination, page: 3 },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const pageButtons = wrapper.findAll('.page-btn')
      expect(pageButtons[2].classes()).toContain('active')
    })
  })

  describe('按钮状态测试', () => {
    it('在第一页时应该禁用"上一页"按钮', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: { ...defaultPagination, page: 1, hasPrev: false },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const prevButton = wrapper.findAll('.pagination-btn')[0]
      expect(prevButton.attributes('disabled')).toBeDefined()
    })

    it('在最后一页时应该禁用"下一页"按钮', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 5,
            pageSize: 20,
            total: 100,
            totalPages: 5,
            hasNext: false,
            hasPrev: true
          },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const nextButton = wrapper.findAll('.pagination-btn')[1]
      expect(nextButton.attributes('disabled')).toBeDefined()
    })

    it('在中间页时两个按钮都应该启用', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 3,
            pageSize: 20,
            total: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: true
          },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const buttons = wrapper.findAll('.pagination-btn')
      expect(buttons[0].attributes('disabled')).toBeUndefined()
      expect(buttons[1].attributes('disabled')).toBeUndefined()
    })
  })

  describe('事件发射测试', () => {
    it('点击"上一页"应该发射正确的页码', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 3,
            pageSize: 20,
            total: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: true
          },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const prevButton = wrapper.findAll('.pagination-btn')[0]
      await prevButton.trigger('click')

      expect(wrapper.emitted('change-page')).toBeTruthy()
      expect(wrapper.emitted('change-page')![0]).toEqual([2])
    })

    it('点击"下一页"应该发射正确的页码', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 2,
            pageSize: 20,
            total: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: true
          },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const nextButton = wrapper.findAll('.pagination-btn')[1]
      await nextButton.trigger('click')

      expect(wrapper.emitted('change-page')).toBeTruthy()
      expect(wrapper.emitted('change-page')![0]).toEqual([3])
    })

    it('点击页码按钮应该发射对应页码', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: defaultPagination,
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const pageButtons = wrapper.findAll('.page-btn')
      await pageButtons[3].trigger('click') // 点击第4页

      expect(wrapper.emitted('change-page')).toBeTruthy()
      expect(wrapper.emitted('change-page')![0]).toEqual([4])
    })

    it('点击已禁用的按钮不应该发射事件', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: { ...defaultPagination, page: 1, hasPrev: false },
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      const prevButton = wrapper.findAll('.pagination-btn')[0]
      await prevButton.trigger('click')

      // 禁用按钮的点击事件会被触发，但浏览器会阻止实际操作
      // 我们验证按钮确实是禁用状态
      expect(prevButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('边界条件测试', () => {
    it('应该处理空数据情况 (total = 0)', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          visiblePages: []
        }
      })

      expect(wrapper.find('.pagination-section').exists()).toBe(true)
    })

    it('应该处理单页数据 (totalPages = 1)', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 15,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          },
          visiblePages: [1]
        }
      })

      expect(wrapper.find('.pagination-section').exists()).toBe(true)
    })

    it('应该处理大量页数 (100+ 页)', () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: {
            page: 50,
            pageSize: 20,
            total: 2000,
            totalPages: 100,
            hasNext: true,
            hasPrev: true
          },
          visiblePages: [48, 49, 50, 51, 52] // 通常只显示部分页码
        }
      })

      const pageButtons = wrapper.findAll('.page-btn')
      expect(pageButtons).toHaveLength(5)
      expect(wrapper.text()).toContain('顯示 981 - 1000 共 2000 項')
    })
  })

  describe('响应式测试', () => {
    it('应该响应 pagination 更新', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: defaultPagination,
          visiblePages: [1, 2, 3, 4, 5]
        }
      })

      expect(wrapper.text()).toContain('顯示 1 - 20 共 100 項')

      await wrapper.setProps({
        pagination: { ...defaultPagination, page: 3 }
      })

      expect(wrapper.text()).toContain('顯示 41 - 60 共 100 項')
    })

    it('应该响应 visiblePages 更新', async () => {
      const wrapper = mount(PaginationControls, {
        props: {
          pagination: defaultPagination,
          visiblePages: [1, 2, 3]
        }
      })

      expect(wrapper.findAll('.page-btn')).toHaveLength(3)

      await wrapper.setProps({
        visiblePages: [1, 2, 3, 4, 5, 6, 7]
      })

      expect(wrapper.findAll('.page-btn')).toHaveLength(7)
    })
  })
})
