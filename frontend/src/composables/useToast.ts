import { ref, createApp, type App } from 'vue'
import Toast from '@/components/ui/Toast.vue'
import type { ToastProps } from '@/components/ui/Toast.vue'

interface ToastInstance {
  id: string
  app: unknown
  element: HTMLElement
}

class ToastManager {
  private toasts = ref<ToastInstance[]>([])
  private counter = 0

  show(options: Omit<ToastProps, 'onClose'>) {
    const id = `toast-${++this.counter}`
    const container = document.createElement('div')
    container.id = id
    document.body.appendChild(container)

    const app = createApp(Toast, {
      ...options,
      onClose: () => {
        this.remove(id)
      }
    })

    app.mount(container)
    
    this.toasts.value.push({
      id,
      app,
      element: container
    })

    return {
      close: () => this.remove(id)
    }
  }

  private remove(id: string) {
    const index = this.toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      const toast = this.toasts.value[index]
      
      // 延遲移除DOM，讓退場動畫完成
      setTimeout(() => {
        if (toast?.app) {
          (toast.app as App<Element>).unmount()
        }
        if (toast?.element?.parentNode) {
          toast.element.parentNode.removeChild(toast.element)
        }
      }, 300)
      
      this.toasts.value.splice(index, 1)
    }
  }

  success(title: string, description?: string, options?: Partial<ToastProps>) {
    return this.show({
      title,
      description,
      type: 'success',
      ...options
    })
  }

  error(title: string, description?: string, options?: Partial<ToastProps>) {
    return this.show({
      title,
      description,
      type: 'error',
      duration: 6000, // 錯誤訊息停留時間稍長
      ...options
    })
  }

  warning(title: string, description?: string, options?: Partial<ToastProps>) {
    return this.show({
      title,
      description,
      type: 'warning',
      ...options
    })
  }

  info(title: string, description?: string, options?: Partial<ToastProps>) {
    return this.show({
      title,
      description,
      type: 'info',
      ...options
    })
  }

  clear() {
    this.toasts.value.forEach(toast => {
      this.remove(toast.id)
    })
  }
}

// 單例模式
const toastManager = new ToastManager()

export function useToast() {
  return {
    toast: toastManager,
    
    // 便捷方法
    showSuccess: (title: string, description?: string, options?: Partial<ToastProps>) => 
      toastManager.success(title, description, options),
      
    showError: (title: string, description?: string, options?: Partial<ToastProps>) => 
      toastManager.error(title, description, options),
      
    showWarning: (title: string, description?: string, options?: Partial<ToastProps>) => 
      toastManager.warning(title, description, options),
      
    showInfo: (title: string, description?: string, options?: Partial<ToastProps>) => 
      toastManager.info(title, description, options),
      
    clearToasts: () => toastManager.clear()
  }
}

// 全域快捷方法（可選）
export default toastManager