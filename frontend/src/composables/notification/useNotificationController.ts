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

import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore, type Notification } from '@/stores/notifications'
import { notificationApi } from '@/api/notifications'
import { useToast } from '@/composables/useToast'
import { useWebSocketStore, type SubscriptionId } from '@/stores/websocket'
import type { WebSocketMessage } from '@/services/websocketClient'
import { useNotificationFilters } from './useNotificationFilters'
import { useNotificationActions } from './useNotificationActions'
import { useNotificationSettings } from './useNotificationSettings'
import { useNotificationKeyboard } from './useNotificationKeyboard'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useNotificationController')

export function useNotificationController() {
  const router = useRouter()
  const store = useNotificationsStore()
  const { showSuccess } = useToast()
  const wsStore = useWebSocketStore()

  // WebSocket subscription management
  let notificationSubscriptionId: SubscriptionId | null = null

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

  /**
   * Handle real-time notification updates from global WebSocket
   * Phase B3: Using global WebSocket Store with subscription pattern
   */
  const handleRealtimeNotification = (message: WebSocketMessage) => {
    frontendLogger.debug('[NotificationController] Real-time notification received:', message.type)

    // Handle notification message
    if (message.type === 'notification') {
      if (message.data && typeof message.data === 'object') {
        if ('notification' in message.data && message.data.notification) {
          store.addNotification(message.data.notification as Notification)
        } else {
          // If data itself is the notification
          store.addNotification(message.data as Notification)
        }
      }

      // Refresh stats
      store.fetchStats()
    }
  }

  // ==================== Lifecycle ====================

  const initialize = async () => {
    frontendLogger.debug('[NotificationController] Initializing (Phase B3)...')

    // Load initial data
    await Promise.all([
      store.fetchNotifications(),
      store.fetchStats(),
      settings.loadSettings()
    ])

    // Ensure global WebSocket is connected
    if (!wsStore.isConnected) {
      frontendLogger.debug('[NotificationController] Connecting to global WebSocket...')
      await wsStore.connect()
    }

    // Subscribe to notifications channel for real-time updates
    notificationSubscriptionId = wsStore.subscribe('notifications', (message) => {
      handleRealtimeNotification(message)
    })

    frontendLogger.debug(`[NotificationController] Subscribed to notifications (ID: ${notificationSubscriptionId?.substring(0, 8)})`)

    // Reduce polling frequency since we have WebSocket
    // Only poll every 2 minutes as a fallback
    if (!wsStore.isConnected) {
      store.startPolling(120000) // 2 minutes instead of 30 seconds
      frontendLogger.debug('[NotificationController] Fallback polling enabled (WebSocket disconnected)')
    }

    // Add keyboard event listener
    document.addEventListener('keydown', keyboard.handleKeyDown)
    frontendLogger.debug('[NotificationController] Keyboard navigation enabled')
  }

  const cleanup = () => {
    frontendLogger.debug('[NotificationController] Cleaning up...')

    // Unsubscribe from notifications channel
    if (notificationSubscriptionId) {
      wsStore.unsubscribe(notificationSubscriptionId)
      notificationSubscriptionId = null
      frontendLogger.debug('[NotificationController] Unsubscribed from notifications')
    }

    // Remove keyboard event listener
    document.removeEventListener('keydown', keyboard.handleKeyDown)

    // Stop polling
    store.stopPolling()
  }

  // Automatic cleanup on component unmount
  onUnmounted(() => {
    cleanup()
  })

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
