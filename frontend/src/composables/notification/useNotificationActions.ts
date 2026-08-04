/**
 * Notification Actions Composable
 *
 * Manages notification action logic (mark as read, delete, etc.)
 */

import { ref } from 'vue'
import type { Router } from 'vue-router'
import type { Notification, useNotificationsStore } from '@/stores/notifications'

export function useNotificationActions(
  store: ReturnType<typeof useNotificationsStore>,
  showSuccess: (_message: string) => void,
  router: Router
) {
  // ==================== State ====================

  const markingAllRead = ref(false)

  // ==================== Methods ====================

  const handleMarkRead = async (id: string) => {
    const success = await store.markAsRead(id)
    if (success) {
      showSuccess('已標記為已讀')
    }
  }

  const handleMarkAllRead = async () => {
    markingAllRead.value = true
    try {
      const success = await store.markAllAsRead()
      if (success) {
        showSuccess('已將所有通知標記為已讀')
      }
    } finally {
      markingAllRead.value = false
    }
  }

  const handleDelete = async (id: string) => {
    const success = await store.deleteNotification(id)
    if (success) {
      showSuccess('通知已刪除')
    }
  }

  const handleLoadMore = () => {
    store.loadMoreNotifications()
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      store.markAsRead(notification.id)
    }

    // Navigate based on type
    const { type, data } = notification

    if (['new_message', 'customer_responded', 'conversation_assigned', 'conversation_transferred', 'mention', 'task_reminder'].includes(type)) {
      if (data?.conversationId) {
        router.push(`/conversations/${data.conversationId}`)
      }
    }
  }

  // ==================== Return API ====================

  return {
    // State
    markingAllRead,

    // Methods
    handleMarkRead,
    handleMarkAllRead,
    handleDelete,
    handleLoadMore,
    handleNotificationClick
  }
}
