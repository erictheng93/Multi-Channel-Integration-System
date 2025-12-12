// frontend/src/composables/useNotifications.ts
// 通知系統 Composable - 整合 WebSocket 即時推送

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNotificationsStore, type Notification } from '@/stores/notifications'
import { getWebSocketManager } from '@/services/websocketManager'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'
import { useToast } from '@/composables/useToast'

export interface UseNotificationsOptions {
  autoConnect?: boolean
  enablePolling?: boolean
  pollingInterval?: number
  enableDesktopNotifications?: boolean
  enableSound?: boolean
}

const defaultOptions: UseNotificationsOptions = {
  autoConnect: true,
  enablePolling: true,
  pollingInterval: 30000,
  enableDesktopNotifications: false,
  enableSound: false
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const opts = { ...defaultOptions, ...options }

  const store = useNotificationsStore()
  const authStore = useAuthStore()
  const wsManager = getWebSocketManager()

  // Local state
  const isConnected = ref(false)
  const desktopPermission = ref<NotificationPermission>('default')

  // Computed from store
  const notifications = computed(() => store.notifications)
  const recentNotifications = computed(() => store.recentNotifications)
  const unreadCount = computed(() => store.unreadCount)
  const hasUnread = computed(() => store.hasUnread)
  const urgentNotifications = computed(() => store.urgentNotifications)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)

  // WebSocket 通知處理
  const handleWebSocketNotification = (data: unknown) => {
    if (!data || typeof data !== 'object') {return}

    const notification = data as Notification
    console.log('🔔 [useNotifications] WebSocket notification received:', notification)

    // 🆕 特殊處理：Agent 被移出團隊事件
    if (notification.type === 'agent_removed_from_team') {
      handleAgentRemovedFromTeam(notification)
      return // 跳過普通通知處理流程
    }

    // 添加到 store
    store.addNotification(notification)

    // 桌面通知
    if (opts.enableDesktopNotifications && desktopPermission.value === 'granted') {
      showDesktopNotification(notification)
    }

    // 音效
    if (opts.enableSound) {
      playNotificationSound()
    }
  }

  /**
   * 🆕 處理 Agent 被移出團隊事件
   * 1. 顯示 Toast 通知
   * 2. 刷新對話列表
   * 3. 如果正在查看受影響的對話，強制關閉並導航到對話列表
   */
  const handleAgentRemovedFromTeam = async (notification: Notification) => {
    const { showWarning, showInfo } = useToast()
    const conversationsStore = useConversationsStore()

    // 從通知數據中提取信息
    const notificationData = notification.data as {
      teamId?: number
      teamName?: string
      removedBy?: string
      affectedConversationIds?: string[]
    } || {}

    const teamName = notificationData.teamName || '團隊'
    const affectedConversationIds = notificationData.affectedConversationIds || []

    console.log('⚠️ [useNotifications] Agent removed from team:', {
      teamName,
      affectedConversationIds
    })

    // 1. 顯示 Toast 警告通知
    showWarning('團隊成員變更', `您已被移出「${teamName}」團隊`, { duration: 6000 })

    // 2. 刷新對話列表 - 移出團隊後將看不到該團隊的對話
    try {
      await conversationsStore.fetchConversations()
      console.log('✅ [useNotifications] Conversation list refreshed after team removal')
    } catch (error) {
      console.error('❌ [useNotifications] Failed to refresh conversations:', error)
    }

    // 3. 如果正在查看受影響的對話，強制關閉並導航到對話列表
    try {
      const router = useRouter()
      const route = useRoute()

      // 檢查當前是否在對話詳情頁面
      if (route.name === 'conversation-detail' || route.path.includes('/conversations/')) {
        const currentConversationId = route.params.id as string

        // 檢查當前對話是否在受影響列表中
        if (currentConversationId && affectedConversationIds.includes(currentConversationId)) {
          console.log('🚪 [useNotifications] Force closing affected conversation:', currentConversationId)

          // 顯示額外提示
          showInfo('對話已關閉', '由於您已被移出團隊，目前查看的對話將被關閉', { duration: 4000 })

          // 導航到對話列表
          await router.push({ name: 'conversations' })
        }
      }
    } catch (error) {
      console.error('❌ [useNotifications] Failed to navigate away from conversation:', error)
      // 如果導航失敗，仍然嘗試刷新頁面
      window.location.href = '/conversations'
    }

    // 4. 添加通知到 store (供通知中心顯示)
    store.addNotification(notification)
  }

  // 設置 WebSocket 事件監聽
  const setupWebSocketListeners = () => {
    wsManager.setEventCallbacks({
      onNotification: handleWebSocketNotification,
      onConnectionStateChange: (state) => {
        isConnected.value = state === 'connected'
        console.log(`🔌 [useNotifications] WebSocket state: ${state}`)
      }
    })
  }

  // 連接 WebSocket
  const connect = async () => {
    if (!authStore.isAuthenticated) {
      console.warn('[useNotifications] Cannot connect: not authenticated')
      return
    }

    try {
      await wsManager.connect()
      isConnected.value = true
      console.log('✅ [useNotifications] WebSocket connected')
    } catch (error) {
      console.error('❌ [useNotifications] WebSocket connection failed:', error)
      isConnected.value = false
    }
  }

  // 斷開 WebSocket
  const disconnect = () => {
    wsManager.disconnect()
    isConnected.value = false
  }

  // 請求桌面通知權限
  const requestDesktopPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('[useNotifications] Desktop notifications not supported')
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      desktopPermission.value = permission
      return permission
    } catch (error) {
      console.error('[useNotifications] Failed to request notification permission:', error)
      return 'denied'
    }
  }

  // 顯示桌面通知
  const showDesktopNotification = (notification: Notification) => {
    if (!('Notification' in window) || desktopPermission.value !== 'granted') {
      return
    }

    const options: NotificationOptions = {
      body: notification.content,
      icon: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.priority === 'urgent',
      data: notification
    }

    const desktopNotif = new Notification(notification.title, options)

    desktopNotif.onclick = () => {
      window.focus()
      // 可以在這裡導航到相關頁面
      desktopNotif.close()
    }

    // 自動關閉 (非緊急通知)
    if (notification.priority !== 'urgent') {
      setTimeout(() => desktopNotif.close(), 5000)
    }
  }

  // 播放通知音效
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // 忽略自動播放限制錯誤
      })
    } catch (error) {
      console.warn('[useNotifications] Failed to play notification sound:', error)
    }
  }

  // 初始化
  const initialize = async () => {
    // 檢查桌面通知權限
    if ('Notification' in window) {
      desktopPermission.value = Notification.permission
    }

    // 設置 WebSocket 監聽
    setupWebSocketListeners()

    // 自動連接
    if (opts.autoConnect && authStore.isAuthenticated) {
      await connect()
    }

    // 載入初始數據
    await store.fetchUnreadCount()
    await store.fetchRecentNotifications()

    // 啟動輪詢 (作為 WebSocket 的備援)
    if (opts.enablePolling) {
      store.startPolling(opts.pollingInterval)
    }
  }

  // 清理
  const cleanup = () => {
    store.stopPolling()
    wsManager.clearEventCallbacks()
  }

  // 監聽認證狀態
  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (isAuth && opts.autoConnect) {
      connect()
    } else if (!isAuth) {
      disconnect()
      store.reset()
    }
  })

  // Lifecycle
  onMounted(() => {
    initialize()
  })

  onUnmounted(() => {
    cleanup()
  })

  // 公開 API
  return {
    // State
    notifications,
    recentNotifications,
    unreadCount,
    hasUnread,
    urgentNotifications,
    loading,
    error,
    isConnected,
    desktopPermission,

    // Actions
    fetchNotifications: store.fetchNotifications,
    fetchRecentNotifications: store.fetchRecentNotifications,
    fetchUnreadCount: store.fetchUnreadCount,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    deleteNotification: store.deleteNotification,

    // WebSocket
    connect,
    disconnect,

    // Desktop notifications
    requestDesktopPermission,
    showDesktopNotification,

    // Filters
    setTypeFilter: store.setTypeFilter,
    setPriorityFilter: store.setPriorityFilter,
    setReadFilter: store.setReadFilter,
    clearFilters: store.clearFilters,

    // Polling
    startPolling: store.startPolling,
    stopPolling: store.stopPolling
  }
}

// 單例版本 - 用於全局通知管理
let globalNotificationsInstance: ReturnType<typeof useNotifications> | null = null

export function useGlobalNotifications(options?: UseNotificationsOptions) {
  if (!globalNotificationsInstance) {
    globalNotificationsInstance = useNotifications(options)
  }
  return globalNotificationsInstance
}
