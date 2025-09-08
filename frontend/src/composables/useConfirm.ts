import { createApp, type App } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

export interface ConfirmOptions {
  title: string
  message?: string
  type?: 'default' | 'warning' | 'danger' | 'info'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

let activeApp: App<globalThis.Element> | null = null
let activeContainer: HTMLElement | null = null

export function useConfirm() {
  const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      // Remove any existing dialog
      if (activeApp) {
        activeApp.unmount()
        activeApp = null
      }
      if (activeContainer && activeContainer.parentNode) {
        activeContainer.parentNode.removeChild(activeContainer)
        activeContainer = null
      }

      // Create dialog container
      const container = document.createElement('div')
      document.body.appendChild(container)
      activeContainer = container

      // Create Vue app with ConfirmDialog
      const app = createApp(ConfirmDialog, {
        ...options,
        onConfirm: async () => {
          try {
            if (options.onConfirm) {
              const result = options.onConfirm()
              if (result instanceof Promise) {
                await result
              }
            }
            cleanup()
            resolve(true)
          } catch (error) {
            console.error('Confirm action failed:', error)
            cleanup()
            resolve(false)
          }
        },
        onCancel: () => {
          try {
            options.onCancel?.()
            cleanup()
            resolve(false)
          } catch (error) {
            console.error('Cancel action failed:', error)
            cleanup()
            resolve(false)
          }
        },
        onClose: () => {
          cleanup()
          resolve(false)
        }
      })

      const cleanup = () => {
        if (activeApp) {
          activeApp.unmount()
          activeApp = null
        }
        if (activeContainer && activeContainer.parentNode) {
          activeContainer.parentNode.removeChild(activeContainer)
          activeContainer = null
        }
      }

      // Mount and track the app
      activeApp = app
      app.mount(container)
    })
  }

  // Convenience methods for different types
  const confirmDanger = (title: string, message?: string, confirmText?: string) => {
    return showConfirm({
      title,
      message,
      type: 'danger',
      confirmText: confirmText || '確定',
      cancelText: '取消'
    })
  }

  const confirmWarning = (title: string, message?: string, confirmText?: string) => {
    return showConfirm({
      title,
      message,
      type: 'warning',
      confirmText: confirmText || '確定',
      cancelText: '取消'
    })
  }

  const confirmInfo = (title: string, message?: string, confirmText?: string) => {
    return showConfirm({
      title,
      message,
      type: 'info',
      confirmText: confirmText || '確定',
      cancelText: '取消'
    })
  }

  const confirmDefault = (title: string, message?: string, confirmText?: string) => {
    return showConfirm({
      title,
      message,
      type: 'default',
      confirmText: confirmText || '確定',
      cancelText: '取消'
    })
  }

  return {
    showConfirm,
    confirmDanger,
    confirmWarning,
    confirmInfo,
    confirmDefault
  }
}