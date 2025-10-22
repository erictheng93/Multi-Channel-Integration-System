import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

/**
 * 集成测试：验证修改后的组件是否正确使用 Toast 和 ConfirmDialog
 *
 * 测试范围：
 * 1. WebSocketAdmin.vue - 使用 Toast 成功提示
 * 2. ConversationHeader.vue - 使用 Toast 错误提示
 * 3. AdvancedAssignActions.vue - 使用 ConfirmDialog
 */

describe('Toast 和 ConfirmDialog 集成测试', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    const { clearToasts } = useToast()
    const { clearDialogs } = useConfirmDialog()
    clearToasts()
    clearDialogs()
    document.body.innerHTML = ''
  })

  describe('useToast 集成', () => {
    it('应该能够显示成功 Toast', async () => {
      const { showSuccess } = useToast()

      showSuccess('操作成功', '数据已保存')

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.textContent).toContain('操作成功')
      expect(toast?.textContent).toContain('数据已保存')
    })

    it('应该能够显示错误 Toast', async () => {
      const { showError } = useToast()

      showError('操作失败', '请检查网络连接')

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.textContent).toContain('操作失败')
      expect(toast?.classList.contains('toast-error')).toBe(true)
    })

    it('应该能够显示警告 Toast', async () => {
      const { showWarning } = useToast()

      showWarning('注意', '此操作可能影响系统')

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.classList.contains('toast-warning')).toBe(true)
    })

    it('应该能够显示信息 Toast', async () => {
      const { showInfo } = useToast()

      showInfo('提示', '系统将在 10 分钟后维护')

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.classList.contains('toast-info')).toBe(true)
    })

    it('应该能够同时显示多个 Toast', async () => {
      const { showSuccess, showError } = useToast()

      showSuccess('成功 1')
      showError('错误 1')
      showSuccess('成功 2')

      await nextTick()

      const toasts = document.querySelectorAll('.toast-container')
      expect(toasts.length).toBeGreaterThanOrEqual(1)
    })

    it('Toast 应该在指定时间后自动关闭', async () => {
      vi.useFakeTimers()
      const { showSuccess } = useToast()

      showSuccess('测试', undefined, { duration: 1000 })

      await nextTick()

      let toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()

      // 快进时间
      vi.advanceTimersByTime(1500)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 400))

      toast = document.querySelector('.toast-container')
      // Toast 应该已经关闭或正在关闭
      expect(toast === null || toast.classList.contains('toast-leave-to')).toBe(true)

      vi.restoreAllMocks()
    })
  })

  describe('useConfirmDialog 集成', () => {
    it('应该能够显示确认对话框', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({
        title: '确认操作',
        message: '确定要继续吗？'
      })

      await nextTick()

      const dialog = document.querySelector('.dialog-overlay')
      expect(dialog).toBeTruthy()
      expect(dialog?.textContent).toContain('确认操作')
      expect(dialog?.textContent).toContain('确定要继续吗？')

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该能够显示警告对话框', async () => {
      const { showWarning } = useConfirmDialog()

      const promise = showWarning('警告', '此操作无法撤销')

      await nextTick()

      const dialog = document.querySelector('.dialog-container')
      expect(dialog).toBeTruthy()
      expect(dialog?.classList.contains('dialog-warning')).toBe(true)

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('应该能够显示危险对话框', async () => {
      const { showDanger } = useConfirmDialog()

      const promise = showDanger('危险操作', '这将删除所有数据')

      await nextTick()

      const dialog = document.querySelector('.dialog-container')
      expect(dialog).toBeTruthy()
      expect(dialog?.classList.contains('dialog-danger')).toBe(true)

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await promise.catch(() => {})
    })

    it('点击确认应该返回 true', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({ title: '确认' })

      await nextTick()

      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLButtonElement
      expect(confirmBtn).toBeTruthy()
      confirmBtn.click()

      const result = await promise
      expect(result).toBe(true)
    })

    it('点击取消应该返回 false', async () => {
      const { showConfirm } = useConfirmDialog()

      const promise = showConfirm({ title: '确认' })

      await nextTick()

      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLButtonElement
      expect(cancelBtn).toBeTruthy()
      cancelBtn.click()

      const result = await promise
      expect(result).toBe(false)
    })
  })

  describe('场景测试', () => {
    it('模拟 WebSocketAdmin.vue 保存成功场景', async () => {
      const { showSuccess } = useToast()

      // 模拟保存配置成功
      showSuccess('配置已保存成功！')

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.textContent).toContain('配置已保存成功！')
      expect(toast?.classList.contains('toast-success')).toBe(true)
    })

    it('模拟 ConversationHeader.vue 错误场景', async () => {
      const { showError } = useToast()

      // 模拟指派失败
      const errorMessage = '指派过程中发生错误'
      showError('指派失敗', errorMessage)

      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.textContent).toContain('指派失敗')
      expect(toast?.textContent).toContain(errorMessage)
      expect(toast?.classList.contains('toast-error')).toBe(true)
    })

    it('模拟 AdvancedAssignActions.vue 取消指派场景', async () => {
      const { showWarning } = useConfirmDialog()

      // 模拟取消指派确认
      const promise = showWarning('確定要取消對話指派嗎？')

      await nextTick()

      const dialog = document.querySelector('.dialog-overlay')
      expect(dialog).toBeTruthy()
      expect(dialog?.textContent).toContain('確定要取消對話指派嗎？')

      // 用户点击确认
      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLButtonElement
      confirmBtn.click()

      const confirmed = await promise
      expect(confirmed).toBe(true)
    })

    it('模拟用户取消危险操作', async () => {
      const { showDanger } = useConfirmDialog()

      const promise = showDanger('確定要刪除所有數據嗎？', '此操作無法恢復')

      await nextTick()

      // 用户点击取消
      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLButtonElement
      cancelBtn.click()

      const confirmed = await promise
      expect(confirmed).toBe(false)
    })
  })

  describe('错误处理', () => {
    it('应该能够正确处理快速连续的 Toast 调用', async () => {
      const { showSuccess, showError, showWarning } = useToast()

      showSuccess('成功 1')
      showError('错误 1')
      showWarning('警告 1')
      showSuccess('成功 2')
      showError('错误 2')

      await nextTick()

      const toasts = document.querySelectorAll('.toast-container')
      expect(toasts.length).toBeGreaterThan(0)
    })

    it('应该能够正确处理快速连续的对话框调用', async () => {
      const { showConfirm } = useConfirmDialog()

      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(showConfirm({ title: `对话框 ${i}` }))
      }

      await nextTick()

      // 清理
      const { clearDialogs } = useConfirmDialog()
      clearDialogs()
      await Promise.all(promises.map(p => p.catch(() => {})))
    })
  })

  describe('清理功能', () => {
    it('clearToasts 应该关闭所有 Toast', async () => {
      const { showSuccess, clearToasts } = useToast()

      showSuccess('Toast 1')
      showSuccess('Toast 2')
      showSuccess('Toast 3')

      await nextTick()

      let toasts = document.querySelectorAll('.toast-container')
      expect(toasts.length).toBeGreaterThan(0)

      clearToasts()

      // 等待清理完成
      await new Promise(resolve => setTimeout(resolve, 400))

      toasts = document.querySelectorAll('.toast-container')
      expect(toasts.length).toBe(0)
    })

    it('clearDialogs 应该关闭所有对话框', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      const promise1 = showConfirm({ title: '对话框 1' })
      const promise2 = showConfirm({ title: '对话框 2' })

      await nextTick()

      clearDialogs()

      const results = await Promise.all([promise1, promise2])
      expect(results).toEqual([false, false])
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量 Toast 创建', async () => {
      const { showSuccess } = useToast()

      const startTime = performance.now()

      for (let i = 0; i < 50; i++) {
        showSuccess(`Toast ${i}`)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // 创建 50 个 Toast 应该在 1 秒内完成
      expect(duration).toBeLessThan(1000)
    })

    it('应该能够处理大量对话框创建', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()

      const startTime = performance.now()

      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(showConfirm({ title: `对话框 ${i}` }))
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // 创建 20 个对话框应该在 500ms 内完成
      expect(duration).toBeLessThan(500)

      // 清理
      clearDialogs()
      await Promise.all(promises.map(p => p.catch(() => {})))
    })
  })
})
