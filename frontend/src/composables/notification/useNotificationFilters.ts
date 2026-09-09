/**
 * Notification Filters Composable
 *
 * Manages notification filtering logic
 */

import { ref, computed } from 'vue'
import type { NotificationType, NotificationPriority, useNotificationsStore } from '@/stores/notifications'

export function useNotificationFilters(store: ReturnType<typeof useNotificationsStore>) {
  // ==================== State ====================

  const selectedType = ref<NotificationType | ''>('')
  const selectedPriority = ref<NotificationPriority | ''>('')
  const selectedReadStatus = ref<boolean | undefined>(undefined)

  // ==================== Computed ====================

  const hasActiveFilters = computed(() =>
    selectedType.value !== '' ||
    selectedPriority.value !== '' ||
    selectedReadStatus.value !== undefined
  )

  // ==================== Configuration ====================

  const notificationTypes = [
    { value: 'new_message', label: '新訊息' },
    { value: 'conversation_assigned', label: '對話指派' },
    { value: 'conversation_transferred', label: '對話轉移' },
    { value: 'mention', label: '提及' },
    { value: 'system', label: '系統通知' },
    { value: 'customer_responded', label: '客戶回覆' },
    { value: 'task_reminder', label: '任務提醒' }
  ]

  const priorities = [
    { value: 'urgent', label: '緊急' },
    { value: 'high', label: '高' },
    { value: 'normal', label: '一般' },
    { value: 'low', label: '低' }
  ]

  // ==================== Methods ====================

  const applyFilters = () => {
    store.fetchNotifications({
      type: selectedType.value || undefined,
      priority: selectedPriority.value || undefined,
      isRead: selectedReadStatus.value
    })
  }

  const clearFilters = () => {
    selectedType.value = ''
    selectedPriority.value = ''
    selectedReadStatus.value = undefined
    store.clearFilters()
  }

  // ==================== Return API ====================

  return {
    // State
    selectedType,
    selectedPriority,
    selectedReadStatus,

    // Computed
    hasActiveFilters,

    // Configuration
    notificationTypes,
    priorities,

    // Methods
    applyFilters,
    clearFilters
  }
}
