import { createApp, type App } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

// Define ConfirmDialogProps interface locally
interface ConfirmDialogOptions {
  title: string
  message?: string
  type?: 'default' | 'warning' | 'danger' | 'info'
  confirmText?: string
  cancelText?: string
  closeOnOverlay?: boolean
}

interface DialogInstance {
  id: string
  app: unknown
  element: HTMLElement
  promise: {
    resolve: (_value: boolean) => void
    reject: () => void
  }
}

class ConfirmDialogManager {
  private dialogs: DialogInstance[] = []
  private counter = 0

  /**
   * 显示确认对话框
   * @param options 对话框选项
   * @returns Promise<boolean> - true 表示确认，false 表示取消
   */
  async show(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const id = `confirm-dialog-${++this.counter}`
      const container = document.createElement('div')
      container.id = id
      document.body.appendChild(container)

      let isResolved = false

      const handleConfirm = () => {
        if (!isResolved) {
          isResolved = true
          resolve(true)
          this.remove(id)
        }
      }

      const handleCancel = () => {
        if (!isResolved) {
          isResolved = true
          resolve(false)
          this.remove(id)
        }
      }

      const handleClose = () => {
        if (!isResolved) {
          isResolved = true
          resolve(false)
          this.remove(id)
        }
      }

      const app = createApp(ConfirmDialog, {
        ...options,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
        onClose: handleClose
      })

      app.mount(container)

      this.dialogs.push({
        id,
        app,
        element: container,
        promise: { resolve, reject }
      })
    })
  }

  private remove(id: string) {
    const index = this.dialogs.findIndex(dialog => dialog.id === id)
    if (index > -1) {
      const dialog = this.dialogs[index]

      // 延迟移除 DOM，让退场动画完成
      setTimeout(() => {
        if (dialog?.app) {
          (dialog.app as App<globalThis.Element>).unmount()
        }
        if (dialog?.element?.parentNode) {
          dialog.element.parentNode.removeChild(dialog.element)
        }
      }, 300)

      this.dialogs.splice(index, 1)
    }
  }

  /**
   * 显示警告类型的确认对话框
   */
  async warning(title: string, message?: string, options?: Partial<ConfirmDialogOptions>): Promise<boolean> {
    return this.show({
      title,
      message,
      type: 'warning',
      ...options
    })
  }

  /**
   * 显示危险操作类型的确认对话框
   */
  async danger(title: string, message?: string, options?: Partial<ConfirmDialogOptions>): Promise<boolean> {
    return this.show({
      title,
      message,
      type: 'danger',
      ...options
    })
  }

  /**
   * 显示信息类型的确认对话框
   */
  async info(title: string, message?: string, options?: Partial<ConfirmDialogOptions>): Promise<boolean> {
    return this.show({
      title,
      message,
      type: 'info',
      ...options
    })
  }

  /**
   * 关闭所有对话框
   */
  clear() {
    // Create a copy of dialog IDs to avoid modifying array during iteration
    const dialogIds = this.dialogs.map(d => d.id)

    // Resolve all promises first
    this.dialogs.forEach(dialog => {
      dialog.promise.resolve(false)
    })

    // Then remove each dialog
    dialogIds.forEach(id => {
      this.remove(id)
    })
  }
}

// 单例模式
const confirmDialogManager = new ConfirmDialogManager()

/**
 * 确认对话框 Composable
 *
 * @example
 * ```typescript
 * const { showConfirm } = useConfirmDialog()
 *
 * // 基本用法
 * const confirmed = await showConfirm({
 *   title: '确定要删除吗？',
 *   message: '此操作无法撤销'
 * })
 * if (confirmed) {
 *   // 用户点击了确定
 * }
 *
 * // 使用快捷方法
 * const result = await showWarning('确定要取消指派吗？')
 * const result = await showDanger('确定要删除所有数据吗？', '这将永久删除所有数据')
 * ```
 */
export function useConfirmDialog() {
  return {
    confirmDialog: confirmDialogManager,

    // 便捷方法
    showConfirm: (options: ConfirmDialogOptions) => confirmDialogManager.show(options),

    showWarning: (title: string, message?: string, options?: Partial<ConfirmDialogOptions>) =>
      confirmDialogManager.warning(title, message, options),

    showDanger: (title: string, message?: string, options?: Partial<ConfirmDialogOptions>) =>
      confirmDialogManager.danger(title, message, options),

    showInfo: (title: string, message?: string, options?: Partial<ConfirmDialogOptions>) =>
      confirmDialogManager.info(title, message, options),

    clearDialogs: () => confirmDialogManager.clear()
  }
}

// 全局快捷方法（可选）
export default confirmDialogManager
