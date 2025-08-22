// 通知 Composable
import { ref } from 'vue'

export interface NotificationOptions {
  title: string
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  persistent?: boolean
}

export interface Notification extends NotificationOptions {
  id: string
  createdAt: Date
}

export function useNotification() {
  const notifications = ref<Notification[]>([])

  const show = (options: NotificationOptions) => {
    const notification: Notification = {
      id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date(),
      type: 'info',
      duration: 5000,
      persistent: false,
      ...options
    }

    notifications.value.push(notification)

    // 自動移除通知
    if (!notification.persistent && notification.duration && notification.duration > 0) {
      setTimeout(() => {
        remove(notification.id)
      }, notification.duration)
    }

    return notification.id
  }

  const remove = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clear = () => {
    notifications.value = []
  }

  const success = (title: string, message?: string, duration?: number) => {
    return show({ title, message, type: 'success', duration })
  }

  const error = (title: string, message?: string, persistent = true) => {
    return show({ title, message, type: 'error', persistent })
  }

  const warning = (title: string, message?: string, duration?: number) => {
    return show({ title, message, type: 'warning', duration })
  }

  const info = (title: string, message?: string, duration?: number) => {
    return show({ title, message, type: 'info', duration })
  }

  return {
    notifications,
    show,
    remove,
    clear,
    success,
    error,
    warning,
    info
  }
}