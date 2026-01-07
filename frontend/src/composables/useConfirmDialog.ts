/**
 * Global Confirmation Dialog System with Promise-based API
 *
 * @module useConfirmDialog
 * @description Provides a singleton confirmation dialog manager that dynamically creates
 * and manages dialog instances using Vue's createApp API. All dialogs are teleported to
 * document.body and managed centrally to prevent conflicts.
 *
 * @example Basic Usage
 * ```ts
 * import { useConfirmDialog } from '@/composables/useConfirmDialog'
 *
 * const { showConfirm } = useConfirmDialog()
 *
 * const confirmed = await showConfirm({
 *   title: 'Delete Customer Tag?',
 *   message: 'This action cannot be undone.',
 *   type: 'danger'
 * })
 *
 * if (confirmed) {
 *   // User clicked confirm
 *   await deleteTag()
 * }
 * ```
 *
 * @example Using Shortcut Methods
 * ```ts
 * const { showWarning, showDanger, showInfo } = useConfirmDialog()
 *
 * // Warning dialog (yellow theme)
 * const result = await showWarning('Unsaved Changes', 'Do you want to continue?')
 *
 * // Danger dialog (red theme) for destructive actions
 * const result = await showDanger('Delete All Data?', 'This will permanently delete everything.')
 *
 * // Info dialog (blue theme) for informational confirmations
 * const result = await showInfo('Confirm Logout', 'You will need to login again.')
 * ```
 *
 * Features:
 * - **Promise-based API** - Async/await support for clean control flow
 * - **Singleton pattern** - Single manager instance prevents dialog conflicts
 * - **Multiple dialog types** - default, warning, danger, info with themed styling
 * - **Keyboard support** - ESC to cancel, Enter to confirm
 * - **Automatic cleanup** - Dialogs are unmounted after 300ms animation
 * - **TypeScript support** - Full type safety with interfaces
 *
 * @see {@link frontend/src/components/ui/ConfirmDialog.vue} for the underlying dialog component
 */

import { createApp, type App } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

/**
 * Configuration options for confirmation dialog
 */
interface ConfirmDialogOptions {
  /** Dialog title - displayed prominently at the top */
  title: string

  /** Optional message body - supports multi-line text */
  message?: string

  /** Dialog theme affecting colors and icon
   * - 'default': Neutral blue theme
   * - 'warning': Yellow theme for caution
   * - 'danger': Red theme for destructive actions
   * - 'info': Blue theme for informational
   */
  type?: 'default' | 'warning' | 'danger' | 'info'

  /** Custom text for confirm button (default: "確認") */
  confirmText?: string

  /** Custom text for cancel button (default: "取消") */
  cancelText?: string

  /** Whether clicking overlay closes dialog (default: true) */
  closeOnOverlay?: boolean
}

/**
 * Internal dialog instance tracking
 * @internal
 */
interface DialogInstance {
  id: string
  app: unknown
  element: HTMLElement
  promise: {
    resolve: (_value: boolean) => void
    reject: () => void
  }
}

/**
 * Singleton Dialog Manager
 *
 * Manages multiple confirmation dialogs with automatic cleanup and promise resolution.
 * Each dialog is created as a separate Vue app instance and teleported to document.body.
 *
 * @internal This class is not exported directly - use useConfirmDialog() instead
 */
class ConfirmDialogManager {
  private dialogs: DialogInstance[] = []
  private counter = 0

  /**
   * Display a confirmation dialog and wait for user response
   *
   * @param options - Dialog configuration options
   * @returns Promise that resolves to true if confirmed, false if canceled/closed
   *
   * @example
   * ```ts
   * const confirmed = await confirmDialogManager.show({
   *   title: 'Delete Item',
   *   message: 'Are you sure?',
   *   type: 'danger'
   * })
   * ```
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
   * Display warning-themed confirmation dialog
   *
   * @param title - Dialog title
   * @param message - Optional message body
   * @param options - Additional options to override defaults
   * @returns Promise that resolves to true if confirmed, false if canceled
   *
   * @example
   * ```ts
   * const result = await confirmDialogManager.warning(
   *   'Unsaved Changes',
   *   'Do you want to discard your changes?'
   * )
   * ```
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
   * Display danger-themed confirmation dialog for destructive actions
   *
   * @param title - Dialog title
   * @param message - Optional message body
   * @param options - Additional options to override defaults
   * @returns Promise that resolves to true if confirmed, false if canceled
   *
   * @example
   * ```ts
   * const result = await confirmDialogManager.danger(
   *   'Delete All Data',
   *   'This action cannot be undone. All data will be permanently deleted.'
   * )
   * ```
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
   * Display info-themed confirmation dialog for informational confirmations
   *
   * @param title - Dialog title
   * @param message - Optional message body
   * @param options - Additional options to override defaults
   * @returns Promise that resolves to true if confirmed, false if canceled
   *
   * @example
   * ```ts
   * const result = await confirmDialogManager.info(
   *   'Confirm Logout',
   *   'You will need to login again to access the system.'
   * )
   * ```
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
   * Close all active dialogs immediately
   *
   * All pending promises will be resolved with false (canceled).
   * Useful for cleanup when navigating away or during app teardown.
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
