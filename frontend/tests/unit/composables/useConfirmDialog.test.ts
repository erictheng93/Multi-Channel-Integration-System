import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

describe('useConfirmDialog', () => {
  let cleanup: (() => void)[]

  beforeEach(() => {
    cleanup = []
    // 清理 body 中的所有对话框容器
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup.forEach(fn => fn())
    cleanup = []
    // 清理所有对话框
    const { clearDialogs } = useConfirmDialog()
    clearDialogs()
    document.body.innerHTML = ''
  })

  describe('基础功能', () => {
    it('应该暴露正确的 API', () => {
      const dialog = useConfirmDialog()

      expect(dialog).toHaveProperty('confirmDialog')
      expect(dialog).toHaveProperty('showConfirm')
      expect(dialog).toHaveProperty('showWarning')
      expect(dialog).toHaveProperty('showDanger')
      expect(dialog).toHaveProperty('showInfo')
      expect(dialog).toHaveProperty('clearDialogs')
    })

    it('应该是单例模式', () => {
      const dialog1 = useConfirmDialog()
      const dialog2 = useConfirmDialog()

      expect(dialog1.confirmDialog).toBe(dialog2.confirmDialog)
    })
  })

  describe('showConfirm', () => {
    it('应该创建对话框 DOM 元素', async () => {
      const { showConfirm } = useConfirmDialog()

      // 启动对话框（不等待）
      const promise = showConfirm({
        title: '测试标题',
        message: '测试消息'
      })

      await nextTick()

      // 检查 DOM 中是否创建了对话框
      const dialogElement = document.querySelector('.dialog-overlay')
      expect(dialogElement).toBeTruthy()

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {}) // 捕获清理时的拒绝
    })

    it('应该在 DOM 中显示正确的标题和消息', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({
        title: '确认删除',
        message: '此操作无法撤销'
      })

      await nextTick()

      const title = document.querySelector('.dialog-title')
      const message = document.querySelector('.dialog-message')

      expect(title?.textContent).toContain('确认删除')
      expect(message?.textContent).toContain('此操作无法撤销')

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该在点击确认时返回 true', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({
        title: '测试'
      })

      await nextTick()

      // 查找并点击确认按钮
      const confirmButton = Array.from(document.querySelectorAll('.dialog-btn')).find(
        btn => btn.textContent?.includes('確定')
      ) as HTMLButtonElement

      expect(confirmButton).toBeTruthy()
      confirmButton.click()

      const result = await promise
      expect(result).toBe(true)
    })

    it('应该在点击取消时返回 false', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({
        title: '测试'
      })

      await nextTick()

      // 查找并点击取消按钮
      const cancelButton = Array.from(document.querySelectorAll('.dialog-btn')).find(
        btn => btn.textContent?.includes('取消')
      ) as HTMLButtonElement

      expect(cancelButton).toBeTruthy()
      cancelButton.click()

      const result = await promise
      expect(result).toBe(false)
    })

    it('应该支持自定义按钮文本', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({
        title: '测试',
        confirmText: '好的',
        cancelText: '算了'
      })

      await nextTick()

      const confirmButton = document.querySelector('.dialog-btn-primary')
      const cancelButton = document.querySelector('.dialog-btn-secondary')

      expect(confirmButton?.textContent).toContain('好的')
      expect(cancelButton?.textContent).toContain('算了')

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })
  })

  describe('showWarning', () => {
    it('应该创建警告类型的对话框', async () => {
      const { showWarning } = useConfirmDialog()

      const promise = showWarning('警告标题', '警告消息')

      await nextTick()

      const dialogContainer = document.querySelector('.dialog-container')
      expect(dialogContainer?.classList.contains('dialog-warning')).toBe(true)

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该显示警告图标', async () => {
      const { showWarning } = useConfirmDialog()

      const promise = showWarning('警告')

      await nextTick()

      const icon = document.querySelector('.dialog-icon')
      expect(icon).toBeTruthy()

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })
  })

  describe('showDanger', () => {
    it('应该创建危险类型的对话框', async () => {
      const { showDanger } = useConfirmDialog()

      const promise = showDanger('危险操作', '无法恢复')

      await nextTick()

      const dialogContainer = document.querySelector('.dialog-container')
      expect(dialogContainer?.classList.contains('dialog-danger')).toBe(true)

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })
  })

  describe('showInfo', () => {
    it('应该创建信息类型的对话框', async () => {
      const { showInfo } = useConfirmDialog()

      const promise = showInfo('提示信息')

      await nextTick()

      const dialogContainer = document.querySelector('.dialog-container')
      expect(dialogContainer?.classList.contains('dialog-info')).toBe(true)

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })
  })

  describe('clearDialogs', () => {
    it('应该关闭所有打开的对话框', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      // 创建多个对话框
      const promise1 = showConfirm({ title: '对话框 1' })
      const promise2 = showConfirm({ title: '对话框 2' })

      await nextTick()

      // 验证对话框存在
      let dialogs = document.querySelectorAll('.dialog-overlay')
      expect(dialogs.length).toBeGreaterThan(0)

      // 清理所有对话框
      clearDialogs()

      // 等待 Promise 完成
      await Promise.all([
        promise1.catch(() => {}),
        promise2.catch(() => {})
      ])

      await nextTick()

      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 400))

      // 验证对话框已关闭
      dialogs = document.querySelectorAll('.dialog-overlay')
      expect(dialogs.length).toBe(0)
    })

    it('清理后所有 Promise 应该返回 false', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      const promise = showConfirm({ title: '测试' })

      await nextTick()

      clearDialogs()

      const result = await promise
      expect(result).toBe(false)
    })
  })

  describe('多个对话框', () => {
    it('应该支持同时显示多个对话框', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      const promise1 = showConfirm({ title: '对话框 1' })
      const promise2 = showConfirm({ title: '对话框 2' })

      await nextTick()

      const overlays = document.querySelectorAll('.dialog-overlay')
      expect(overlays.length).toBeGreaterThanOrEqual(1)

      // 清理
      clearDialogs()
      await Promise.all([
        promise1.catch(() => {}),
        promise2.catch(() => {})
      ])

      await new Promise(resolve => setTimeout(resolve, 400))
    })
  })

  describe('边界情况', () => {
    it('应该处理空标题', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({ title: '' })

      await nextTick()

      const title = document.querySelector('.dialog-title')
      expect(title).toBeTruthy()

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该处理没有消息的情况', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({ title: '只有标题' })

      await nextTick()

      const message = document.querySelector('.dialog-message')
      // 消息元素可能不存在或为空
      if (message) {
        expect(message.textContent).toBe('')
      }

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该处理快速连续调用', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(showConfirm({ title: `对话框 ${i}` }))
      }

      await nextTick()

      // 清理
      clearDialogs()
      await Promise.all(promises.map(p => p.catch(() => {})))

      await new Promise(resolve => setTimeout(resolve, 400))
    })
  })

  describe('内存管理', () => {
    it('应该在对话框关闭后清理 DOM 元素', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({ title: '测试' })

      await nextTick()

      // 确认对话框存在
      let overlay = document.querySelector('.dialog-overlay')
      expect(overlay).toBeTruthy()

      // 点击确认关闭
      const confirmButton = document.querySelector('.dialog-btn-primary') as HTMLButtonElement
      confirmButton.click()

      await promise

      // 等待清理动画完成
      await new Promise(resolve => setTimeout(resolve, 400))

      // 验证 DOM 已清理
      overlay = document.querySelector('.dialog-overlay')
      expect(overlay).toBeFalsy()
    })
  })
})
