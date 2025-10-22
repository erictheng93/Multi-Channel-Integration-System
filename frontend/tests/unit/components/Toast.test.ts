import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '@/components/ui/Toast.vue'
import { nextTick } from 'vue'

describe('Toast.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染标题', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试标题'
        }
      })

      expect(wrapper.find('.toast-title').text()).toBe('测试标题')
    })

    it('应该渲染描述', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '标题',
          description: '这是描述文本'
        }
      })

      expect(wrapper.find('.toast-description').text()).toBe('这是描述文本')
    })

    it('描述为空时不应该渲染描述元素', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '标题'
        }
      })

      expect(wrapper.find('.toast-description').exists()).toBe(false)
    })
  })

  describe('Toast 类型', () => {
    it('应该正确渲染成功类型', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '成功',
          type: 'success'
        }
      })

      expect(wrapper.find('.toast-success').exists()).toBe(true)
    })

    it('应该正确渲染错误类型', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '错误',
          type: 'error'
        }
      })

      expect(wrapper.find('.toast-error').exists()).toBe(true)
    })

    it('应该正确渲染警告类型', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '警告',
          type: 'warning'
        }
      })

      expect(wrapper.find('.toast-warning').exists()).toBe(true)
    })

    it('应该正确渲染信息类型', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '信息',
          type: 'info'
        }
      })

      expect(wrapper.find('.toast-info').exists()).toBe(true)
    })

    it('默认应该是成功类型', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '默认'
        }
      })

      expect(wrapper.find('.toast-success').exists()).toBe(true)
    })
  })

  describe('进度条', () => {
    it('默认应该显示进度条', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          showProgress: true
        }
      })

      expect(wrapper.find('.toast-progress').exists()).toBe(true)
    })

    it('showProgress 为 false 时不应该显示进度条', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          showProgress: false
        }
      })

      expect(wrapper.find('.toast-progress').exists()).toBe(false)
    })
  })

  describe('关闭按钮', () => {
    it('默认不应该显示关闭按钮', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试'
        }
      })

      expect(wrapper.find('.toast-close').exists()).toBe(false)
    })

    it('showCloseButton 为 true 时应该显示关闭按钮', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        }
      })

      expect(wrapper.find('.toast-close').exists()).toBe(true)
    })

    it('点击关闭按钮应该触发 close 事件', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        }
      })

      await wrapper.find('.toast-close').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('操作按钮', () => {
    it('有 actionText 时应该显示操作按钮', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '查看详情'
        }
      })

      expect(wrapper.find('.toast-action-btn').exists()).toBe(true)
      expect(wrapper.find('.toast-action-btn').text()).toBe('查看详情')
    })

    it('点击操作按钮应该触发 action 事件', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        }
      })

      await wrapper.find('.toast-action-btn').trigger('click')

      expect(wrapper.emitted('action')).toBeTruthy()
    })

    it('点击操作按钮应该关闭 Toast', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        }
      })

      await wrapper.find('.toast-action-btn').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('自动关闭', () => {
    it('应该在指定时间后自动关闭', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: 1000
        }
      })

      expect(wrapper.emitted('close')).toBeFalsy()

      // 快进 1000ms
      vi.advanceTimersByTime(1000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('duration 为 0 时不应该自动关闭', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: 0
        }
      })

      vi.advanceTimersByTime(10000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('duration 为负数时不应该自动关闭', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: -1
        }
      })

      vi.advanceTimersByTime(10000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('交互行为', () => {
    it('点击 Toast 应该触发默认行为', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试'
        }
      })

      await wrapper.find('.toast-container').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('有操作按钮时点击 Toast 应该触发操作', async () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        }
      })

      await wrapper.find('.toast-container').trigger('click')

      expect(wrapper.emitted('action')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('回调函数', () => {
    it('应该调用 onClose 回调', async () => {
      const onClose = vi.fn()
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          onClose,
          showCloseButton: true
        }
      })

      await wrapper.find('.toast-close').trigger('click')
      await nextTick()

      expect(onClose).toHaveBeenCalled()
    })

    it('应该调用 onAction 回调', async () => {
      const onAction = vi.fn()
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作',
          onAction
        }
      })

      await wrapper.find('.toast-action-btn').trigger('click')
      await nextTick()

      expect(onAction).toHaveBeenCalled()
    })
  })

  describe('可访问性', () => {
    it('关闭按钮应该有 aria-label', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        }
      })

      const closeButton = wrapper.find('.toast-close')
      expect(closeButton.attributes('aria-label')).toBe('關閉通知')
    })
  })

  describe('图标渲染', () => {
    it('成功类型应该渲染勾选图标', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '成功',
          type: 'success'
        }
      })

      const icon = wrapper.find('.toast-icon svg')
      expect(icon.exists()).toBe(true)
    })

    it('错误类型应该渲染警告图标', () => {
      const wrapper = mount(Toast, {
        props: {
          title: '错误',
          type: 'error'
        }
      })

      const icon = wrapper.find('.toast-icon svg')
      expect(icon.exists()).toBe(true)
    })
  })
})
