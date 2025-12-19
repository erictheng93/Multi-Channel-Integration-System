// frontend/src/stores/notifications.ts
// 通知系統 Pinia Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  notificationApi,
  type Notification,
  type NotificationStats,
  type NotificationType,
  type NotificationPriority,
  type NotificationListParams,
  type CreateNotificationRequest
} from '@/api/notifications'
import { translateError } from '@/utils/error-handler'

export const useNotificationsStore = defineStore('notifications', () => {
  // ==================== State ====================
  const notifications = ref<Notification[]>([])
  const recentNotifications = ref<Notification[]>([])
  const stats = ref<NotificationStats | null>(null)
  const unreadCount = ref(0)

  // Loading states
  const loading = ref(false)
  const refreshing = ref(false)
  const loadingMore = ref(false)

  // Error state
  const error = ref<string | null>(null)

  // Pagination
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })

  // Filters
  const filters = ref<NotificationListParams>({
    type: undefined,
    priority: undefined,
    isRead: undefined
  })

  // Polling
  let pollingInterval: ReturnType<typeof setInterval> | null = null
  const pollingEnabled = ref(false)

  // ==================== Computed ====================
  const unreadNotifications = computed(() =>
    notifications.value.filter(n => !n.isRead)
  )

  const hasUnread = computed(() => unreadCount.value > 0)

  const groupedByType = computed(() => {
    const groups: Record<NotificationType, Notification[]> = {
      new_message: [],
      conversation_assigned: [],
      conversation_transferred: [],
      mention: [],
      system: [],
      priority_changed: [],
      customer_responded: [],
      task_reminder: [],
      'agent_removed_from_team': [],  // Agent 被移出團隊通知
      'customer_followed': [],         // 🆕 新客戶加入通知
      'new_conversation': []           // 🆕 新對話創建通知
    }

    notifications.value.forEach(n => {
      if (groups[n.type]) {
        groups[n.type].push(n)
      }
    })

    return groups
  })

  const urgentNotifications = computed(() =>
    notifications.value.filter(n => n.priority === 'urgent' && !n.isRead)
  )

  const canLoadMore = computed(() =>
    pagination.value.page < pagination.value.totalPages && !loadingMore.value
  )

  // ==================== Utility Functions ====================
  const clearError = () => {
    error.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error('[NotificationsStore]', err)
    error.value = translateError(err, defaultMessage)
    setTimeout(clearError, 5000)
  }

  // ==================== Actions ====================

  // 獲取通知列表
  const fetchNotifications = async (newFilters?: NotificationListParams, page = 1, append = false) => {
    if (newFilters) {
      filters.value = { ...filters.value, ...newFilters }
    }

    if (append) {
      loadingMore.value = true
    } else {
      loading.value = true
    }
    error.value = null

    try {
      const response = await notificationApi.list({
        ...filters.value,
        page,
        pageSize: pagination.value.pageSize
      })

      if (response.success && response.data) {
        const data = response.data

        if (append) {
          const existingIds = new Set(notifications.value.map(n => n.id))
          const newNotifications = data.items.filter(n => !existingIds.has(n.id))
          notifications.value = [...notifications.value, ...newNotifications]
        } else {
          notifications.value = data.items
        }

        pagination.value = {
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages
        }

        console.log(`📬 [NotificationsStore] Loaded ${data.items.length} notifications`)
      } else {
        handleError(response.error, '獲取通知列表失敗')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入通知')
    } finally {
      loading.value = false
      loadingMore.value = false
      refreshing.value = false
    }
  }

  // 刷新通知列表
  const refreshNotifications = async () => {
    console.log('🔄 [NotificationsStore] Refreshing notifications')
    refreshing.value = true
    await fetchNotifications(undefined, 1, false)
  }

  // 載入更多
  const loadMoreNotifications = async () => {
    if (!canLoadMore.value) {return}
    const nextPage = pagination.value.page + 1
    console.log(`📄 [NotificationsStore] Loading page ${nextPage}`)
    await fetchNotifications(undefined, nextPage, true)
  }

  // 獲取最近通知
  const fetchRecentNotifications = async (limit = 10) => {
    try {
      const response = await notificationApi.getRecent(limit)
      if (response.success && response.data) {
        recentNotifications.value = response.data.notifications
        console.log(`📬 [NotificationsStore] Loaded ${response.data.count} recent notifications`)
      }
    } catch (err) {
      console.error('[NotificationsStore] Failed to fetch recent notifications:', err)
    }
  }

  // 獲取未讀數量
  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount()
      if (response.success && response.data) {
        unreadCount.value = response.data.count
      }
    } catch (err) {
      console.error('[NotificationsStore] Failed to fetch unread count:', err)
    }
  }

  // 獲取統計資料
  const fetchStats = async () => {
    try {
      const response = await notificationApi.getStats()
      if (response.success && response.data) {
        stats.value = response.data
        unreadCount.value = response.data.unread
      }
    } catch (err) {
      console.error('[NotificationsStore] Failed to fetch stats:', err)
    }
  }

  // 標記為已讀
  const markAsRead = async (id: string) => {
    // 樂觀更新
    const notification = notifications.value.find(n => n.id === id)
    if (notification && !notification.isRead) {
      notification.isRead = true
      notification.readAt = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }

    try {
      const response = await notificationApi.markAsRead(id)
      if (!response.success) {
        // 回滾
        if (notification) {
          notification.isRead = false
          notification.readAt = undefined
          unreadCount.value++
        }
        handleError(response.error, '標記已讀失敗')
        return false
      }
      console.log(`✅ [NotificationsStore] Marked notification ${id} as read`)
      return true
    } catch (err) {
      // 回滾
      if (notification) {
        notification.isRead = false
        notification.readAt = undefined
        unreadCount.value++
      }
      handleError(err, '標記已讀失敗')
      return false
    }
  }

  // 批量標記為已讀
  const markAllAsRead = async (type?: NotificationType) => {
    const previousUnreadCount = unreadCount.value
    const previousNotifications = notifications.value.map(n => ({ ...n }))

    // 樂觀更新
    notifications.value.forEach(n => {
      if (!type || n.type === type) {
        if (!n.isRead) {
          n.isRead = true
          n.readAt = new Date().toISOString()
        }
      }
    })
    unreadCount.value = type
      ? notifications.value.filter(n => !n.isRead).length
      : 0

    try {
      const response = await notificationApi.markAllAsRead(type)
      if (!response.success) {
        // 回滾
        notifications.value = previousNotifications
        unreadCount.value = previousUnreadCount
        handleError(response.error, '批量標記已讀失敗')
        return false
      }
      console.log(`✅ [NotificationsStore] Marked ${response.data?.updated || 'all'} notifications as read`)
      return true
    } catch (err) {
      // 回滾
      notifications.value = previousNotifications
      unreadCount.value = previousUnreadCount
      handleError(err, '批量標記已讀失敗')
      return false
    }
  }

  // 刪除通知
  const deleteNotification = async (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    const notification = notifications.value[index]

    if (index === -1) {return false}

    // 樂觀更新
    notifications.value.splice(index, 1)
    if (notification && !notification.isRead) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }

    try {
      const response = await notificationApi.delete(id)
      if (!response.success) {
        // 回滾
        if (notification) {
          notifications.value.splice(index, 0, notification)
          if (!notification.isRead) {
            unreadCount.value++
          }
        }
        handleError(response.error, '刪除通知失敗')
        return false
      }
      console.log(`🗑️ [NotificationsStore] Deleted notification ${id}`)
      return true
    } catch (err) {
      // 回滾
      if (notification) {
        notifications.value.splice(index, 0, notification)
        if (!notification.isRead) {
          unreadCount.value++
        }
      }
      handleError(err, '刪除通知失敗')
      return false
    }
  }

  // 創建通知
  const createNotification = async (request: CreateNotificationRequest) => {
    try {
      const response = await notificationApi.create(request)
      if (response.success && response.data) {
        // 刷新列表以獲取新通知
        await fetchRecentNotifications()
        await fetchUnreadCount()
        console.log(`✅ [NotificationsStore] Created notification ${response.data.id}`)
        return response.data.id
      }
      handleError(response.error, '創建通知失敗')
      return null
    } catch (err) {
      handleError(err, '創建通知失敗')
      return null
    }
  }

  // 添加新通知 (用於即時推送)
  const addNotification = (notification: Notification) => {
    // 檢查是否已存在
    const exists = notifications.value.some(n => n.id === notification.id)
    if (!exists) {
      notifications.value.unshift(notification)
      recentNotifications.value.unshift(notification)

      // 保持最近通知列表長度
      if (recentNotifications.value.length > 10) {
        recentNotifications.value.pop()
      }

      if (!notification.isRead) {
        unreadCount.value++
      }

      console.log(`🔔 [NotificationsStore] New notification received: ${notification.id}`)
    }
  }

  // ==================== Polling ====================

  // 開始輪詢
  const startPolling = (intervalMs = 30000) => {
    if (pollingInterval) {
      stopPolling()
    }

    pollingEnabled.value = true
    console.log(`🔄 [NotificationsStore] Starting polling every ${intervalMs}ms`)

    // 立即執行一次
    fetchUnreadCount()
    fetchRecentNotifications()

    pollingInterval = setInterval(() => {
      if (pollingEnabled.value) {
        fetchUnreadCount()
        fetchRecentNotifications()
      }
    }, intervalMs)
  }

  // 停止輪詢
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    pollingEnabled.value = false
    console.log('⏹️ [NotificationsStore] Polling stopped')
  }

  // ==================== Filter Actions ====================

  const setTypeFilter = async (type?: NotificationType) => {
    filters.value.type = type
    await fetchNotifications(undefined, 1, false)
  }

  const setPriorityFilter = async (priority?: NotificationPriority) => {
    filters.value.priority = priority
    await fetchNotifications(undefined, 1, false)
  }

  const setReadFilter = async (isRead?: boolean) => {
    filters.value.isRead = isRead
    await fetchNotifications(undefined, 1, false)
  }

  const clearFilters = async () => {
    filters.value = {
      type: undefined,
      priority: undefined,
      isRead: undefined
    }
    await fetchNotifications(undefined, 1, false)
  }

  // ==================== Reset ====================

  const reset = () => {
    stopPolling()
    notifications.value = []
    recentNotifications.value = []
    stats.value = null
    unreadCount.value = 0
    loading.value = false
    refreshing.value = false
    loadingMore.value = false
    error.value = null
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    }
    filters.value = {
      type: undefined,
      priority: undefined,
      isRead: undefined
    }
  }

  // ==================== Return ====================
  return {
    // State
    notifications,
    recentNotifications,
    stats,
    unreadCount,
    loading,
    refreshing,
    loadingMore,
    error,
    pagination,
    filters,
    pollingEnabled,

    // Computed
    unreadNotifications,
    hasUnread,
    groupedByType,
    urgentNotifications,
    canLoadMore,

    // Actions
    fetchNotifications,
    refreshNotifications,
    loadMoreNotifications,
    fetchRecentNotifications,
    fetchUnreadCount,
    fetchStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    addNotification,

    // Polling
    startPolling,
    stopPolling,

    // Filters
    setTypeFilter,
    setPriorityFilter,
    setReadFilter,
    clearFilters,

    // Reset
    reset,
    clearError
  }
})

// 類型匯出
export type {
  Notification,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  NotificationListParams,
  CreateNotificationRequest
} from '@/api/notifications'
