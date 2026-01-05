/**
 * Notification Keyboard Navigation Composable
 *
 * Manages keyboard shortcuts and navigation for notifications
 */

import { ref, type ComputedRef } from 'vue'
import type { Notification } from '@/stores/notifications'

export function useNotificationKeyboard(
  notifications: ComputedRef<Notification[]>,
  handleNotificationClick: (_notification: Notification) => void
) {
  // ==================== State ====================

  const focusedNotificationIndex = ref<number>(-1)
  const notificationRefs = ref<HTMLElement[]>([])

  // ==================== Methods ====================

  const focusNotification = (index: number) => {
    if (notificationRefs.value[index]) {
      notificationRefs.value[index].focus()
      notificationRefs.value[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const setNotificationRef = (el: HTMLElement | null, index: number) => {
    if (el) {
      notificationRefs.value[index] = el
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const notificationCount = notifications.value.length

    if (notificationCount === 0) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusedNotificationIndex.value = Math.min(focusedNotificationIndex.value + 1, notificationCount - 1)
        focusNotification(focusedNotificationIndex.value)
        break

      case 'ArrowUp':
        event.preventDefault()
        focusedNotificationIndex.value = Math.max(focusedNotificationIndex.value - 1, 0)
        focusNotification(focusedNotificationIndex.value)
        break

      case 'Enter':
        event.preventDefault()
        if (focusedNotificationIndex.value >= 0 && focusedNotificationIndex.value < notificationCount) {
          const notification = notifications.value[focusedNotificationIndex.value]
          if (notification) {
            handleNotificationClick(notification)
          }
        }
        break

      case 'Escape':
        event.preventDefault()
        // Clear focus
        focusedNotificationIndex.value = -1
        ;(document.activeElement as HTMLElement)?.blur()
        break
    }
  }

  // ==================== Return API ====================

  return {
    // State
    focusedNotificationIndex,
    notificationRefs,

    // Methods
    handleKeyDown,
    setNotificationRef
  }
}
