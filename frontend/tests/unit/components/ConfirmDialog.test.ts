import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { nextTick } from 'vue'

describe('ConfirmDialog.vue', () => {
  describe('基础渲染', () => {
    it('应该渲染标题', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认操作'
        }
      })

      expect(wrapper.find('.dialog-title').text()).toBe('确认操作')
    })

    it('应该渲染消息', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '标题',
          message: '这是一条确认消息'
        }
      })

      expect(wrapper.find('.dialog-message').text()).toBe('这是一条确认消息')
    })

    it('消息为空时不应该渲染消息元素', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '标题'
        }
      })

      expect(wrapper.find('.dialog-message').exists()).toBe(false)
    })
  })

  describe('对话框类型', () => {
    it('默认类型应该渲染问号图标', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          type: 'default'
        }
      })

      expect(wrapper.find('.dialog-icon svg').exists()).toBe(true)
    })

    it('警告类型应该有 dialog-warning 类', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        }
      })

      expect(wrapper.find('.dialog-warning').exists()).toBe(true)
    })

    it('危险类型应该有 dialog-danger 类', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险操作',
          type: 'danger'
        }
      })

      expect(wrapper.find('.dialog-danger').exists()).toBe(true)
    })

    it('信息类型应该有 dialog-info 类', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '信息',
          type: 'info'
        }
      })

      expect(wrapper.find('.dialog-info').exists()).toBe(true)
    })
  })

  describe('按钮', () => {
    it('应该渲染确认和取消按钮', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        }
      })

      const buttons = wrapper.findAll('.dialog-btn')
      expect(buttons.length).toBe(2)
    })

    it('应该显示自定义确认按钮文本', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          confirmText: '好的'
        }
      })

      const confirmBtn = wrapper.find('.dialog-btn-primary')
      expect(confirmBtn.text()).toContain('好的')
    })

    it('应该显示自定义取消按钮文本', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          cancelText: '算了'
        }
      })

      const cancelBtn = wrapper.find('.dialog-btn-secondary')
      expect(cancelBtn.text()).toContain('算了')
    })

    it('默认确认按钮文本应该是"確定"', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        }
      })

      const confirmBtn = wrapper.find('.dialog-btn-primary')
      expect(confirmBtn.text()).toContain('確定')
    })

    it('默认取消按钮文本应该是"取消"', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        }
      })

      const cancelBtn = wrapper.find('.dialog-btn-secondary')
      expect(cancelBtn.text()).toContain('取消')
    })
  })

  describe('事件处理', () => {
    it('点击确认按钮应该触发 confirm 事件', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        }
      })

      await wrapper.find('.dialog-btn-primary').trigger('click')

      expect(wrapper.emitted('confirm')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击取消按钮应该触发 cancel 事件', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认'
        }
      })

      await wrapper.find('.dialog-btn-secondary').trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击遮罩层应该关闭对话框（默认行为）', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: true
        }
      })

      await wrapper.find('.dialog-overlay').trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('closeOnOverlay 为 false 时点击遮罩层不应该关闭', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: false
        }
      })

      await wrapper.find('.dialog-overlay').trigger('click')

      expect(wrapper.emitted('cancel')).toBeFalsy()
      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('点击对话框内容不应该关闭对话框', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          closeOnOverlay: true
        }
      })

      await wrapper.find('.dialog-container').trigger('click')

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('回调函数', () => {
    it('应该调用 onConfirm 回调', async () => {
      const onConfirm = vi.fn()
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onConfirm
        }
      })

      await wrapper.find('.dialog-btn-primary').trigger('click')
      await nextTick()

      expect(onConfirm).toHaveBeenCalled()
    })

    it('应该调用 onCancel 回调', async () => {
      const onCancel = vi.fn()
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onCancel
        }
      })

      await wrapper.find('.dialog-btn-secondary').trigger('click')
      await nextTick()

      expect(onCancel).toHaveBeenCalled()
    })

    it('应该支持异步 onConfirm 回调', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          onConfirm
        }
      })

      await wrapper.find('.dialog-btn-primary').trigger('click')
      await nextTick()

      expect(onConfirm).toHaveBeenCalled()
    })
  })

  describe('加载状态', () => {
    it('loading 为 true 时按钮应该禁用', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        }
      })

      const confirmBtn = wrapper.find('.dialog-btn-primary')
      const cancelBtn = wrapper.find('.dialog-btn-secondary')

      expect(confirmBtn.attributes('disabled')).toBeDefined()
      expect(cancelBtn.attributes('disabled')).toBeDefined()
    })

    it('loading 时应该显示加载指示器', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        }
      })

      // HamsterLoader 应该在确认按钮中显示
      expect(wrapper.findComponent({ name: 'HamsterLoader' }).exists()).toBe(true)
    })

    it('loading 时点击取消按钮不应该触发事件', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true
        }
      })

      await wrapper.find('.dialog-btn-secondary').trigger('click')

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })

    it('loading 时点击遮罩层不应该关闭对话框', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '确认',
          loading: true,
          closeOnOverlay: true
        }
      })

      await wrapper.find('.dialog-overlay').trigger('click')

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('图标显示', () => {
    it('warning 类型应该显示警告图标', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        }
      })

      const icon = wrapper.find('.dialog-icon svg')
      expect(icon.exists()).toBe(true)
    })

    it('danger 类型应该显示危险图标', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险',
          type: 'danger'
        }
      })

      const icon = wrapper.find('.dialog-icon svg')
      expect(icon.exists()).toBe(true)
    })

    it('info 类型应该显示信息图标', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '信息',
          type: 'info'
        }
      })

      const icon = wrapper.find('.dialog-icon svg')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('样式类', () => {
    it('warning 类型的确认按钮应该有 dialog-btn-warning 类', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '警告',
          type: 'warning'
        }
      })

      const confirmBtn = wrapper.find('.dialog-btn-primary')
      expect(confirmBtn.classes()).toContain('dialog-btn-warning')
    })

    it('danger 类型的确认按钮应该有 dialog-btn-danger 类', () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          title: '危险',
          type: 'danger'
        }
      })

      const confirmBtn = wrapper.find('.dialog-btn-primary')
      expect(confirmBtn.classes()).toContain('dialog-btn-danger')
    })
  })
})
