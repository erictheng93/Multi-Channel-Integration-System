import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils'
import Toast from '@/components/ui/Toast.vue'
import { nextTick } from 'vue'

describe('Toast.vue', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    // Create a div for body attachment
    const app = document.createElement('div')
    app.setAttribute('id', 'app')
    document.body.appendChild(app)
  })

  afterEach(() => {
    // Cleanup wrapper
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }

    // Clear timers
    vi.clearAllTimers()
    vi.restoreAllMocks()

    // Clean up DOM
    document.body.innerHTML = ''
  })

  describe('基础渲染', () => {
    it('应该渲染标题', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试标题'
        },
        attachTo: document.body
      })

      await nextTick()
      const title = document.querySelector('.toast-title')
      expect(title?.textContent?.trim()).toBe('测试标题')
    })

    it('应该渲染描述', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '标题',
          description: '这是描述文本'
        },
        attachTo: document.body
      })

      await nextTick()
      const description = document.querySelector('.toast-description')
      expect(description?.textContent?.trim()).toBe('这是描述文本')
    })

    it('描述为空时不应该渲染描述元素', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '标题'
        },
        attachTo: document.body
      })

      await nextTick()
      const description = document.querySelector('.toast-description')
      expect(description).toBeNull()
    })
  })

  describe('Toast 类型', () => {
    it('应该正确渲染成功类型', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '成功',
          type: 'success'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-success')
      expect(container).not.toBeNull()
    })

    it('应该正确渲染错误类型', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '错误',
          type: 'error'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-error')
      expect(container).not.toBeNull()
    })

    it('应该正确渲染警告类型', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '警告',
          type: 'warning'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-warning')
      expect(container).not.toBeNull()
    })

    it('应该正确渲染信息类型', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '信息',
          type: 'info'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-info')
      expect(container).not.toBeNull()
    })

    it('默认应该是成功类型', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '默认'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-success')
      expect(container).not.toBeNull()
    })
  })

  describe('进度条', () => {
    it('默认应该显示进度条', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          showProgress: true
        },
        attachTo: document.body
      })

      await nextTick()
      const progress = document.querySelector('.toast-progress')
      expect(progress).not.toBeNull()
    })

    it('showProgress 为 false 时不应该显示进度条', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          showProgress: false
        },
        attachTo: document.body
      })

      await nextTick()
      const progress = document.querySelector('.toast-progress')
      expect(progress).toBeNull()
    })
  })

  describe('关闭按钮', () => {
    it('默认不应该显示关闭按钮', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试'
        },
        attachTo: document.body
      })

      await nextTick()
      const closeBtn = document.querySelector('.toast-close')
      expect(closeBtn).toBeNull()
    })

    it('showCloseButton 为 true 时应该显示关闭按钮', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        },
        attachTo: document.body
      })

      await nextTick()
      const closeBtn = document.querySelector('.toast-close')
      expect(closeBtn).not.toBeNull()
    })

    it('点击关闭按钮应该触发 close 事件', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        },
        attachTo: document.body
      })

      await nextTick()
      const closeBtn = document.querySelector('.toast-close') as HTMLElement
      closeBtn.click()
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('操作按钮', () => {
    it('有 actionText 时应该显示操作按钮', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '查看详情'
        },
        attachTo: document.body
      })

      await nextTick()
      const actionBtn = document.querySelector('.toast-action-btn') as HTMLElement
      expect(actionBtn).not.toBeNull()
      expect(actionBtn.textContent?.trim()).toBe('查看详情')
    })

    it('点击操作按钮应该触发 action 事件', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        },
        attachTo: document.body
      })

      await nextTick()
      const actionBtn = document.querySelector('.toast-action-btn') as HTMLElement
      actionBtn.click()
      await nextTick()

      expect(wrapper.emitted('action')).toBeTruthy()
    })

    it('点击操作按钮应该关闭 Toast', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        },
        attachTo: document.body
      })

      await nextTick()
      const actionBtn = document.querySelector('.toast-action-btn') as HTMLElement
      actionBtn.click()
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('自动关闭', () => {
    it('应该在指定时间后自动关闭', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: 1000
        },
        attachTo: document.body
      })

      await nextTick()
      expect(wrapper.emitted('close')).toBeFalsy()

      // 快进 1000ms
      vi.advanceTimersByTime(1000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('duration 为 0 时不应该自动关闭', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: 0
        },
        attachTo: document.body
      })

      await nextTick()
      vi.advanceTimersByTime(10000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('duration 为负数时不应该自动关闭', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          duration: -1
        },
        attachTo: document.body
      })

      await nextTick()
      vi.advanceTimersByTime(10000)
      await nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('交互行为', () => {
    it('点击 Toast 应该触发默认行为', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-container') as HTMLElement
      container.click()
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('有操作按钮时点击 Toast 应该触发操作', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.toast-container') as HTMLElement
      container.click()
      await nextTick()

      expect(wrapper.emitted('action')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('回调函数', () => {
    it('应该调用 onClose 回调', async () => {
      const onClose = vi.fn()
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          onClose,
          showCloseButton: true
        },
        attachTo: document.body
      })

      await nextTick()
      const closeBtn = document.querySelector('.toast-close') as HTMLElement
      closeBtn.click()
      await nextTick()

      expect(onClose).toHaveBeenCalled()
    })

    it('应该调用 onAction 回调', async () => {
      const onAction = vi.fn()
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          actionText: '操作',
          onAction
        },
        attachTo: document.body
      })

      await nextTick()
      const actionBtn = document.querySelector('.toast-action-btn') as HTMLElement
      actionBtn.click()
      await nextTick()

      expect(onAction).toHaveBeenCalled()
    })
  })

  describe('可访问性', () => {
    it('关闭按钮应该有 aria-label', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '测试',
          showCloseButton: true
        },
        attachTo: document.body
      })

      await nextTick()
      const closeButton = document.querySelector('.toast-close') as HTMLElement
      expect(closeButton.getAttribute('aria-label')).toBe('關閉通知')
    })
  })

  describe('图标渲染', () => {
    it('成功类型应该渲染勾选图标', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '成功',
          type: 'success'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.toast-icon svg')
      expect(icon).not.toBeNull()
    })

    it('错误类型应该渲染警告图标', async () => {
      wrapper = mount(Toast, {
        props: {
          title: '错误',
          type: 'error'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.toast-icon svg')
      expect(icon).not.toBeNull()
    })
  })
})
