import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VueWrapper} from '@vue/test-utils';
import { mount, flushPromises } from '@vue/test-utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { nextTick } from 'vue'

describe('ConfirmDialog.vue', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    // Create a div for body attachment
    const app = document.createElement('div')
    app.setAttribute('id', 'app')
    document.body.appendChild(app)
  })

  afterEach(async () => {
    // Cleanup wrapper
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }

    // Wait for all pending promises
    await flushPromises()

    // Clear timers
    vi.clearAllTimers()

    // Clean up DOM
    document.body.innerHTML = ''
  })

  describe('基础渲染', () => {
    it('应该渲染标题', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认操作'
        },
        attachTo: document.body
      })

      await nextTick()
      const title = document.querySelector('.dialog-title')
      expect(title?.textContent?.trim()).toBe('确认操作')
    })

    it('应该渲染消息', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '标题',
          message: '这是一条确认消息'
        },
        attachTo: document.body
      })

      await nextTick()
      const message = document.querySelector('.dialog-message')
      expect(message?.textContent?.trim()).toBe('这是一条确认消息')
    })

    it('消息为空时不应该渲染消息元素', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '标题'
        },
        attachTo: document.body
      })

      await nextTick()
      const message = document.querySelector('.dialog-message')
      expect(message).toBeNull()
    })
  })

  describe('对话框类型', () => {
    it('默认类型应该渲染问号图标', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          type: 'default'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.dialog-icon svg')
      expect(icon).not.toBeNull()
    })

    it('警告类型应该有 dialog-warning 类', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.dialog-warning')
      expect(container).not.toBeNull()
    })

    it('危险类型应该有 dialog-danger 类', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险操作',
          type: 'danger'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.dialog-danger')
      expect(container).not.toBeNull()
    })

    it('信息类型应该有 dialog-info 类', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '信息',
          type: 'info'
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.dialog-info')
      expect(container).not.toBeNull()
    })
  })

  describe('按钮', () => {
    it('应该渲染确认和取消按钮', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        },
        attachTo: document.body
      })

      await nextTick()
      const buttons = document.querySelectorAll('.dialog-btn')
      expect(buttons.length).toBe(2)
    })

    it('应该显示自定义确认按钮文本', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          confirmText: '好的'
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary')
      expect(confirmBtn?.textContent).toContain('好的')
    })

    it('应该显示自定义取消按钮文本', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          cancelText: '算了'
        },
        attachTo: document.body
      })

      await nextTick()
      const cancelBtn = document.querySelector('.dialog-btn-secondary')
      expect(cancelBtn?.textContent).toContain('算了')
    })

    it('默认确认按钮文本应该是"確定"', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary')
      expect(confirmBtn?.textContent).toContain('確定')
    })

    it('默认取消按钮文本应该是"取消"', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        },
        attachTo: document.body
      })

      await nextTick()
      const cancelBtn = document.querySelector('.dialog-btn-secondary')
      expect(cancelBtn?.textContent).toContain('取消')
    })
  })

  describe('事件处理', () => {
    it('点击确认按钮应该触发 confirm 事件', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLElement
      confirmBtn.click()
      await nextTick()

      expect(wrapper.emitted('confirm')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击取消按钮应该触发 cancel 事件', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        },
        attachTo: document.body
      })

      await nextTick()
      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLElement
      cancelBtn.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击遮罩层应该关闭对话框（默认行为）', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: true
        },
        attachTo: document.body
      })

      await nextTick()
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('closeOnOverlay 为 false 时点击遮罩层不应该关闭', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: false
        },
        attachTo: document.body
      })

      await nextTick()
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeFalsy()
      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('点击对话框内容不应该关闭对话框', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: true
        },
        attachTo: document.body
      })

      await nextTick()
      const container = document.querySelector('.dialog-container') as HTMLElement
      container.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('回调函数', () => {
    it('应该调用 onConfirm 回调', async () => {
      const onConfirm = vi.fn()
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onConfirm
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLElement
      confirmBtn.click()
      await nextTick()

      expect(onConfirm).toHaveBeenCalled()
    })

    it('应该调用 onCancel 回调', async () => {
      const onCancel = vi.fn()
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onCancel
        },
        attachTo: document.body
      })

      await nextTick()
      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLElement
      cancelBtn.click()
      await nextTick()

      expect(onCancel).toHaveBeenCalled()
    })

    it('应该支持异步 onConfirm 回调', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onConfirm
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLElement
      confirmBtn.click()
      await nextTick()

      expect(onConfirm).toHaveBeenCalled()
    })
  })

  describe('加载状态', () => {
    it('loading 为 true 时按钮应该禁用', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLButtonElement
      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLButtonElement

      expect(confirmBtn.disabled).toBe(true)
      expect(cancelBtn.disabled).toBe(true)
    })

    it('loading 时应该显示加载指示器', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        },
        attachTo: document.body
      })

      await nextTick()
      // HamsterLoader 应该在确认按钮中显示
      expect(wrapper.findComponent({ name: 'HamsterLoader' }).exists()).toBe(true)
    })

    it('loading 时点击取消按钮不应该触发事件', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        },
        attachTo: document.body
      })

      await nextTick()
      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLElement
      cancelBtn.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })

    it('loading 时点击遮罩层不应该关闭对话框', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true,
          closeOnOverlay: true
        },
        attachTo: document.body
      })

      await nextTick()
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay.click()
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('图标显示', () => {
    it('warning 类型应该显示警告图标', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.dialog-icon svg')
      expect(icon).not.toBeNull()
    })

    it('danger 类型应该显示危险图标', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险',
          type: 'danger'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.dialog-icon svg')
      expect(icon).not.toBeNull()
    })

    it('info 类型应该显示信息图标', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '信息',
          type: 'info'
        },
        attachTo: document.body
      })

      await nextTick()
      const icon = document.querySelector('.dialog-icon svg')
      expect(icon).not.toBeNull()
    })
  })

  describe('样式类', () => {
    it('warning 类型的确认按钮应该有 dialog-btn-warning 类', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary')
      expect(confirmBtn?.classList.contains('dialog-btn-warning')).toBe(true)
    })

    it('danger 类型的确认按钮应该有 dialog-btn-danger 类', async () => {
      wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险',
          type: 'danger'
        },
        attachTo: document.body
      })

      await nextTick()
      const confirmBtn = document.querySelector('.dialog-btn-primary')
      expect(confirmBtn?.classList.contains('dialog-btn-danger')).toBe(true)
    })
  })
})
