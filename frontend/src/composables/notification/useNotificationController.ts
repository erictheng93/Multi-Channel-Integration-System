/**
 * Notification List Controller
 *
 * Manages all business logic for the notification list page
 * - Notification data fetching and management
 * - Filtering and pagination
 * - Actions (mark as read, delete, etc.)
 * - Settings management
 * - WebSocket real-time updates
 * - Keyboard navigation
 */

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore, type Notification } from '@/stores/notifications'
import { notificationApi } from '@/api/notifications'
import { useToast } from '@/composables/useToast'
import { useWebSocket } from '@/composables/useWebSocket'
import { useNotificationFilters } from './useNotificationFilters'
import { useNotificationActions } from './useNotificationActions'
import { useNotificationSettings } from './useNotificationSettings'
import { useNotificationKeyboard } from './useNotificationKeyboard'

export function useNotificationController() {
  const router = useRouter()
  const store = useNotificationsStore()
  const { showSuccess } = useToast()
  const {
    isConnected: wsConnected,
    setEventCallbacks,
    clearEventCallbacks
  } = useWebSocket({ autoConnect: true })

  // ==================== Sub-composables ====================

  // Filters management
  const filters = useNotificationFilters(store)

  // Actions (mark as read, delete, etc.)
  const actions = useNotificationActions(store, showSuccess, router)

  // Settings management
  const settings = useNotificationSettings(notificationApi, showSuccess)

  // Keyboard navigation
  const keyboard = useNotificationKeyboard(
    computed(() => store.notifications),
    actions.handleNotificationClick
  )

  // ==================== State ====================

  const showSettings = ref(false)

  // ==================== Computed ====================

  const notifications = computed(() => store.notifications)
  const stats = computed(() => store.stats)
  const loading = computed(() => store.loading)
  const loadingMore = computed(() => store.loadingMore)
  const pagination = computed(() => store.pagination)
  const canLoadMore = computed(() => store.canLoadMore)
  const hasUnread = computed(() => store.hasUnread)

  // ==================== WebSocket ====================

  const handleNewNotification = (data: unknown) => {
    console.log('🔔 [NotificationController] New notification received via WebSocket:', data)

    // Add to store (will update UI automatically)
    if (data && typeof data === 'object') {
      if ('notification' in data && data.notification) {
        store.addNotification(data.notification as Notification)
      } else {
        // If data itself is the notification
        store.addNotification(data as Notification)
      }
    }

    // Refresh stats
    store.fetchStats()
  }

  // ==================== Lifecycle ====================

  const initialize = async () => {
    // Load initial data
    await Promise.all([
      store.fetchNotifications(),
      store.fetchStats(),
      settings.loadSettings()
    ])

    // Setup WebSocket event callbacks for real-time updates
    if (setEventCallbacks) {
      setEventCallbacks({
        onNotification: (notification: unknown) => {
          console.log('🔔 [NotificationController] New notification received via WebSocket:', notification)
          handleNewNotification(notification)
        }
      })
      console.log('✅ [NotificationController] WebSocket event callbacks registered')
    }

    // Reduce polling frequency since we have WebSocket
    // Only poll every 2 minutes as a fallback
    if (!wsConnected.value) {
      store.startPolling(120000) // 2 minutes instead of 30 seconds
      console.log('📡 [NotificationController] Fallback polling enabled (WebSocket disconnected)')
    }

    // Add keyboard event listener
    document.addEventListener('keydown', keyboard.handleKeyDown)
    console.log('⌨️ [NotificationController] Keyboard navigation enabled')
  }

  const cleanup = () => {
    // Cleanup WebSocket event callbacks
    if (clearEventCallbacks) {
      clearEventCallbacks()
      console.log('🧹 [NotificationController] WebSocket event callbacks cleared')
    }

    // Remove keyboard event listener
    document.removeEventListener('keydown', keyboard.handleKeyDown)

    // Stop polling
    store.stopPolling()
  }

  // ==================== Return API ====================

  return {
    // State
    showSettings,

    // Computed
    notifications,
    stats,
    loading,
    loadingMore,
    pagination,
    canLoadMore,
    hasUnread,

    // Filters
    filters,

    // Actions
    actions,

    // Settings
    settings,

    // Keyboard
    keyboard,

    // Lifecycle
    initialize,
    cleanup
  }
}
